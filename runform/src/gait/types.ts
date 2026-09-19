/** Índices de los 33 landmarks de MediaPipe Pose. */
export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export const LANDMARK_COUNT = 33;

/** Conexiones del esqueleto relevantes para carrera (sin cara ni dedos). */
export const SKELETON_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

export interface Point {
  x: number;
  y: number;
  z: number;
  /** Probabilidad 0..1 de que el punto sea visible. */
  v: number;
}

/** Pose de un frame: 33 puntos normalizados (0..1 respecto al ancho y alto del video). */
export interface FramePose {
  /** Tiempo del frame en el video, en segundos. */
  t: number;
  /** Índice del frame. */
  i: number;
  /** null si no se detectó ninguna persona. */
  points: Point[] | null;
}

export type CameraPlane = 'lateral' | 'frontal';

/** Bandas de ritmo en min/km. */
export type PaceBand = '<4:00' | '4:00-4:45' | '4:45-5:30' | '5:30-6:15' | '>6:15';

export function paceBand(secondsPerKm: number): PaceBand {
  if (secondsPerKm < 240) return '<4:00';
  if (secondsPerKm < 285) return '4:00-4:45';
  if (secondsPerKm < 330) return '4:45-5:30';
  if (secondsPerKm < 375) return '5:30-6:15';
  return '>6:15';
}

/** Convierte "4:35" a segundos por km. Devuelve null si el formato no es válido. */
export function parsePace(text: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

export function formatPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
