/**
 * Utilidades para recorrer un video frame a frame de forma determinista.
 *
 * En vez de reproducir el video y confiar en requestVideoFrameCallback (que
 * salta frames si la inferencia es más lenta que el video), avanzamos con
 * `currentTime` y esperamos el evento `seeked`. Así procesamos todos los frames.
 */

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  /** fps estimados con requestVideoFrameCallback, o null si no se pudo. */
  fps: number | null;
}

export function loadVideo(video: HTMLVideoElement, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('No se pudo cargar el video'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
    video.src = url;
    video.load();
  });
}

/**
 * Estima los fps reproduciendo el video en silencio unos frames y midiendo
 * la diferencia de `mediaTime` entre callbacks. Devuelve null si el
 * navegador no soporta requestVideoFrameCallback.
 */
export async function estimateFps(video: HTMLVideoElement, samples = 20): Promise<number | null> {
  if (typeof video.requestVideoFrameCallback !== 'function') return null;

  const wasMuted = video.muted;
  video.muted = true;
  video.currentTime = 0;

  const deltas: number[] = [];
  let last: number | null = null;

  const fps = await new Promise<number | null>((resolve) => {
    let handle = 0;
    const timeout = setTimeout(() => {
      video.cancelVideoFrameCallback(handle);
      resolve(null);
    }, 4000);

    const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (last !== null) {
        const d = meta.mediaTime - last;
        if (d > 0) deltas.push(d);
      }
      last = meta.mediaTime;
      if (deltas.length >= samples) {
        clearTimeout(timeout);
        resolve(1 / median(deltas));
        return;
      }
      handle = video.requestVideoFrameCallback(tick);
    };
    handle = video.requestVideoFrameCallback(tick);
    void video.play().catch(() => {
      clearTimeout(timeout);
      resolve(null);
    });
  });

  video.pause();
  video.currentTime = 0;
  video.muted = wasMuted;

  if (fps === null) return null;
  return snapFps(fps);
}

/** Redondea a los fps habituales de un móvil para no arrastrar ruido. */
function snapFps(fps: number): number {
  const common = [24, 25, 30, 50, 60, 120, 240];
  let best = common[0];
  for (const c of common) if (Math.abs(c - fps) < Math.abs(best - fps)) best = c;
  return Math.abs(best - fps) / best < 0.08 ? best : Math.round(fps);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 1e-4 && video.readyState >= 2) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

export interface FrameIterationOptions {
  fps: number;
  /** Devuelve true para cancelar. */
  shouldStop?: () => boolean;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Recorre todos los frames del video en orden y llama a `onFrame` con el
 * video ya posicionado en cada uno. El timestamp en ms es estrictamente
 * creciente, como exige MediaPipe en modo VIDEO.
 */
export async function forEachFrame(
  video: HTMLVideoElement,
  opts: FrameIterationOptions,
  onFrame: (frameIndex: number, timestampMs: number) => void,
): Promise<void> {
  const step = 1 / opts.fps;
  const total = Math.max(1, Math.floor(video.duration * opts.fps));
  video.pause();
  for (let i = 0; i < total; i++) {
    if (opts.shouldStop?.()) return;
    // Pequeño offset para caer dentro del frame y no en el borde.
    const t = Math.min(i * step + step * 0.5, video.duration - 1e-3);
    await seekTo(video, t);
    onFrame(i, Math.round(t * 1000));
    opts.onProgress?.(i + 1, total);
  }
}
