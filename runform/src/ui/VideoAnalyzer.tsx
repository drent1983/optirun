import { useEffect, useRef, useState, type DragEvent } from 'react';
import { detectPose, getPoseLandmarker } from '../capture/pose';
import { estimateFps, forEachFrame, loadVideo } from '../capture/videoFrames';
import { analyze, type Analysis } from '../gait/analyze';
import { recommend } from '../gait/drills';
import { assess } from '../gait/rules';
import { LM, paceBand, parsePace, type CameraPlane, type FramePose } from '../gait/types';
import { saveSession } from '../store/db';
import { ContactTimeline } from './ContactTimeline';
import { drawLegend, drawSkeleton } from './drawSkeleton';
import { Icon } from './icons';
import { MetricsPanel } from './MetricsPanel';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading-model' }
  | { kind: 'processing'; done: number; total: number; etaSec: number | null }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

type Tab = 'video' | 'metrics' | 'drills';

export function VideoAnalyzer({ onSaved }: { onSaved: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [plane, setPlane] = useState<CameraPlane>('lateral');
  const [paceText, setPaceText] = useState('5:00');
  const [heightCm, setHeightCm] = useState(175);
  const [fps, setFps] = useState<number>(30);
  const [fpsDetected, setFpsDetected] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rawFrames, setRawFrames] = useState<FramePose[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [tab, setTab] = useState<Tab>('video');
  const [dragOver, setDragOver] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const pace = parsePace(paceText);
  const canProcess = file !== null && pace !== null && heightCm > 100 && status.kind !== 'processing';

  // Cargar el video cuando cambia el archivo y estimar fps.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !file) return;
    let cancelled = false;
    setAnalysis(null);
    setRawFrames(null);
    setSaved(false);
    setFpsDetected(null);
    setTab('video');
    setStatus({ kind: 'idle' });
    (async () => {
      try {
        await loadVideo(video, file);
        const detected = await estimateFps(video);
        if (cancelled) return;
        setFpsDetected(detected);
        if (detected) setFps(detected);
      } catch (err) {
        if (!cancelled) setStatus({ kind: 'error', message: String(err) });
      }
    })();
    return () => {
      cancelled = true;
      if (video.src) URL.revokeObjectURL(video.src);
    };
  }, [file]);

  // Dibujar el esqueleto suavizado sincronizado con la reproducción.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { frames, contacts } = analysis;
    const strikeAt = new Map<number, number>();
    for (const c of contacts) {
      const ankle = c.side === 'left' ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
      for (let k = c.strike; k < Math.min(c.toeOff, c.strike + 3); k++) strikeAt.set(k, ankle);
    }
    let raf = 0;
    let lastIdx = -1;
    const draw = () => {
      const idx = Math.min(frames.length - 1, Math.floor(video.currentTime * fps));
      if (idx !== lastIdx) {
        lastIdx = idx;
        setCurrentTime(video.currentTime);
        const f = frames[idx];
        const hud = [
          `${video.currentTime.toFixed(2)} s  ·  frame ${idx}`,
          strikeAt.has(idx)
            ? `Contacto ${strikeAt.get(idx) === LM.LEFT_ANKLE ? 'izquierdo' : 'derecho'}`
            : ' ',
        ];
        if (f?.points) {
          drawSkeleton(ctx, f.points, canvas.width, canvas.height, {
            hud,
            highlightAnkle: strikeAt.get(idx) ?? null,
          });
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        if (showLegend) drawLegend(ctx, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analysis, fps, showLegend, tab]);

  // Atajos de teclado del reproductor (solo con la pestaña Video activa).
  useEffect(() => {
    if (!analysis || tab !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    const contacts = analysis.contacts;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const step = (e.shiftKey ? 5 : 1) / fps;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          video.pause();
          video.currentTime = Math.min(video.duration, video.currentTime + step);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.pause();
          video.currentTime = Math.max(0, video.currentTime - step);
          break;
        case ' ':
          e.preventDefault();
          if (video.paused) void video.play();
          else video.pause();
          break;
        case ']': {
          e.preventDefault();
          const next = contacts.find((c) => c.strike / fps > video.currentTime + 0.5 / fps);
          if (next) {
            video.pause();
            video.currentTime = next.strike / fps + 0.5 / fps;
          }
          break;
        }
        case '[': {
          e.preventDefault();
          const prev = [...contacts].reverse().find((c) => c.strike / fps < video.currentTime - 1.5 / fps);
          if (prev) {
            video.pause();
            video.currentTime = prev.strike / fps + 0.5 / fps;
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [analysis, tab, fps]);

  async function process() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !file) return;
    stopRef.current = false;
    setAnalysis(null);
    setRawFrames(null);
    setSaved(false);
    setTab('video');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    try {
      setStatus({ kind: 'loading-model' });
      const landmarker = await getPoseLandmarker();
      const collected: FramePose[] = [];
      const startedAt = performance.now();
      setStatus({ kind: 'processing', done: 0, total: 0, etaSec: null });

      await forEachFrame(
        video,
        {
          fps,
          shouldStop: () => stopRef.current,
          onProgress: (done, total) => {
            const elapsed = (performance.now() - startedAt) / 1000;
            const etaSec = done > 3 && total ? (elapsed / done) * (total - done) : null;
            setStatus({ kind: 'processing', done, total, etaSec });
          },
        },
        (i, tsMs) => {
          const pose = detectPose(landmarker, video, i, tsMs);
          collected.push(pose);
          if (ctx && pose.points) {
            drawSkeleton(ctx, pose.points, canvas.width, canvas.height, {
              hud: [`Procesando  ·  frame ${i}`],
            });
          }
        },
      );

      if (stopRef.current) {
        setStatus({ kind: 'idle' });
        return;
      }

      const result = analyze({
        frames: collected,
        width: video.videoWidth,
        height: video.videoHeight,
        fps,
        heightCm,
        plane,
      });
      setRawFrames(collected);
      setAnalysis(result);
      setDuration(video.duration);
      setStatus({ kind: 'done' });
      setTab('metrics');
      video.pause();
      video.currentTime = 0;
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function save() {
    const video = videoRef.current;
    if (!video || !analysis || !rawFrames || !file || pace === null) return;
    const detected = rawFrames.filter((f) => f.points).length;
    await saveSession({
      createdAt: Date.now(),
      name: file.name.replace(/\.[^.]+$/, ''),
      plane,
      paceSecPerKm: pace,
      paceBand: paceBand(pace),
      heightCm,
      fps,
      durationSec: video.duration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      frameCount: rawFrames.length,
      detectionRate: rawFrames.length ? detected / rawFrames.length : 0,
      frames: analysis.frames,
      analysis: {
        calibration: analysis.calibration,
        contacts: analysis.contacts,
        metrics: analysis.metrics,
      },
    });
    setSaved(true);
    onSaved();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('video/')) setFile(f);
  }

  function seek(t: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(video.duration || 0, t));
  }

  const detectionRate =
    rawFrames && rawFrames.length ? rawFrames.filter((f) => f.points).length / rawFrames.length : null;

  const step = analysis ? 4 : status.kind === 'processing' || status.kind === 'loading-model' ? 3 : file ? 2 : 1;
  const recCount = analysis ? recommend(assess(analysis.metrics, plane)).length : 0;
  const issues = analysis
    ? assess(analysis.metrics, plane).filter((a) => a.light === 'red' || a.light === 'yellow').length
    : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analizar</h1>
          <p>Sube un video de 15 a 20 segundos y obtén métricas, semáforo y ejercicios.</p>
        </div>
      </div>

      <div className="stepper" aria-hidden>
        {['Video', 'Parámetros', 'Procesar', 'Resultados'].map((label, i) => {
          const n = i + 1;
          const cls = n < step ? 'done' : n === step ? 'active' : '';
          return (
            <div key={label} className={`step ${cls}`}>
              <span className="n">{n < step ? <Icon name="check" size={12} /> : n}</span>
              {label}
            </div>
          );
        })}
      </div>

      <section className="card anim-up">
        <div className="card-head">
          <div className="card-title">
            <div className="ico">
              <Icon name="upload" />
            </div>
            <h2>Video y parámetros</h2>
          </div>
          {file && (
            <span className="file-chip">
              <Icon name="video" size={14} /> {file.name}
              <button className="btn-icon" style={{ padding: 3, border: 'none' }} onClick={() => setFile(null)} aria-label="Quitar video">
                <Icon name="x" size={13} />
              </button>
            </span>
          )}
        </div>

        {!file && (
          <label
            className={`dropzone ${dragOver ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="ico">
              <Icon name="upload" size={22} />
            </div>
            <strong>Arrastra un video o haz clic para elegirlo</strong>
            <span>MP4 o MOV del móvil · plano lateral o frontal · 30 o 60 fps</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <div className="form-grid" style={{ marginTop: file ? 0 : 16 }}>
          <label className="field">
            Plano de cámara
            <select value={plane} onChange={(e) => setPlane(e.target.value as CameraPlane)}>
              <option value="lateral">Lateral</option>
              <option value="frontal">Frontal</option>
            </select>
          </label>

          <label className="field">
            Ritmo (min/km)
            <input
              value={paceText}
              onChange={(e) => setPaceText(e.target.value)}
              placeholder="5:00"
              aria-invalid={pace === null}
            />
          </label>

          <label className="field">
            Estatura (cm)
            <input
              type="number"
              min={100}
              max={230}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
            />
          </label>

          <label className="field">
            FPS {fpsDetected ? <small>detectado: {fpsDetected}</small> : <small>del video</small>}
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              {[24, 25, 30, 50, 60, 120, 240].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={process} disabled={!canProcess}>
            <Icon name="play" size={16} /> Procesar video
          </button>
          {status.kind === 'processing' && (
            <button className="btn btn-ghost" onClick={() => (stopRef.current = true)}>
              <Icon name="x" size={16} /> Cancelar
            </button>
          )}
          {analysis && !saved && (
            <button className="btn btn-ghost" onClick={save}>
              <Icon name="save" size={16} /> Guardar sesión
            </button>
          )}
          {saved && (
            <span className="pill pill-green anim-pop">
              <Icon name="check" size={12} /> Sesión guardada
            </span>
          )}
        </div>

        <StatusLine status={status} detectionRate={detectionRate} />
      </section>

      {file && (
        <section className="card anim-up" style={{ animationDelay: '60ms' }}>
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={tab === 'video'} onClick={() => setTab('video')}>
              <Icon name="video" size={15} /> Video
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === 'metrics'}
              onClick={() => setTab('metrics')}
              disabled={!analysis}
            >
              <Icon name="gauge" size={15} /> Métricas
              {analysis && <span className="count">{issues}</span>}
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === 'drills'}
              onClick={() => setTab('drills')}
              disabled={!analysis}
            >
              <Icon name="trend" size={15} /> Ejercicios
              {analysis && <span className="count">{recCount}</span>}
            </button>
            {analysis && tab === 'video' && (
              <label className="toggle" style={{ marginLeft: 'auto', paddingRight: 8 }}>
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                />
                <Icon name="legend" size={14} /> Leyenda
              </label>
            )}
          </div>

          <div style={{ display: tab === 'video' ? 'block' : 'none' }}>
            <div className="video-stage-wrap">
              <div className="video-stage">
                <video ref={videoRef} controls playsInline muted />
                <canvas ref={canvasRef} />
              </div>
            </div>
            {analysis && (
              <ContactTimeline
                contacts={analysis.contacts}
                duration={duration}
                currentTime={currentTime}
                fps={fps}
                onSeek={seek}
              />
            )}
          </div>

          {analysis && tab !== 'video' && (
            <div className="tab-panel" key={tab}>
              <MetricsPanel
                metrics={analysis.metrics}
                contacts={analysis.contacts}
                calibration={analysis.calibration}
                plane={plane}
                diagnostics={analysis.diagnostics}
                view={tab === 'metrics' ? 'metrics' : 'drills'}
              />
            </div>
          )}
        </section>
      )}
    </>
  );
}

function StatusLine({ status, detectionRate }: { status: Status; detectionRate: number | null }) {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'loading-model':
      return (
        <div className="status">
          <Icon name="download" size={16} /> Cargando modelo de pose (30 MB, solo la primera vez)…
        </div>
      );
    case 'processing': {
      const pct = status.total ? (status.done / status.total) * 100 : 0;
      const eta = status.etaSec;
      return (
        <div className="status progress-box">
          <div className="progress-head">
            <span className="progress-pct">{pct.toFixed(0)}%</span>
            <span className="muted">
              frame {status.done} de {status.total}
              {eta !== null ? ` · quedan ${fmtSeconds(eta)}` : ''}
            </span>
          </div>
          <progress value={status.done} max={status.total || 1} />
        </div>
      );
    }
    case 'done':
      return (
        <div className="status ok anim-pop">
          <Icon name="check" size={16} /> Listo. Pose detectada en{' '}
          {detectionRate !== null ? Math.round(detectionRate * 100) : 0}% de los frames.
        </div>
      );
    case 'error':
      return (
        <div className="status error">
          <Icon name="alert" size={16} /> {status.message}
        </div>
      );
  }
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.max(1, Math.round(s))} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m} min ${r.toString().padStart(2, '0')} s`;
}
