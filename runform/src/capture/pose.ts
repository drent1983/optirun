import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { FramePose, Point } from '../gait/types';

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const MODEL_PATH = `${import.meta.env.BASE_URL}mediapipe/models/pose_landmarker_heavy.task`;

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/**
 * Crea (una sola vez) el PoseLandmarker en modo VIDEO.
 * Intenta GPU y cae a CPU si WebGL no está disponible.
 */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

async function createLandmarker(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('PoseLandmarker GPU no disponible, usando CPU', err);
    return PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/**
 * Ejecuta la pose sobre el frame actual del video.
 * `timestampMs` debe ser estrictamente creciente entre llamadas.
 */
export function detectPose(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  frameIndex: number,
  timestampMs: number,
): FramePose {
  const result = landmarker.detectForVideo(video, timestampMs);
  const lm = result.landmarks[0];
  const points: Point[] | null = lm
    ? lm.map((p) => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 }))
    : null;
  return { t: timestampMs / 1000, i: frameIndex, points };
}
