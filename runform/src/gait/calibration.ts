import { median } from './smoothing';
import { LM, type FramePose, type Point } from './types';

/**
 * Proporciones antropométricas (Drillis & Contini, 1966) respecto a la estatura.
 * Muslo + pierna (cadera a tobillo) ≈ 0.245 + 0.246 de la estatura.
 */
const LEG_FRACTION_OF_STATURE = 0.491;

export interface Calibration {
  /** Píxeles por metro. */
  pxPerMeter: number;
  /** Longitud de pierna (cadera a tobillo) en píxeles, mediana del video. */
  legLengthPx: number;
  /** Frames usados. */
  samples: number;
}

/** Convierte un punto normalizado a píxeles. */
export function toPx(p: Point, width: number, height: number): { x: number; y: number } {
  return { x: p.x * width, y: p.y * height };
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Calibra píxel a metro con la estatura del corredor y la longitud de pierna
 * observada. Usa la suma de segmentos muslo + pierna (robusta a la flexión de
 * rodilla) y la mediana sobre todos los frames válidos.
 */
export function calibrate(
  frames: FramePose[],
  width: number,
  height: number,
  heightCm: number,
  minVisibility = 0.5,
): Calibration | null {
  const legs: number[] = [];
  for (const f of frames) {
    if (!f.points) continue;
    for (const [hip, knee, ankle] of [
      [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
      [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
    ] as const) {
      const h = f.points[hip];
      const k = f.points[knee];
      const a = f.points[ankle];
      if (Math.min(h.v, k.v, a.v) < minVisibility) continue;
      legs.push(
        dist(toPx(h, width, height), toPx(k, width, height)) +
          dist(toPx(k, width, height), toPx(a, width, height)),
      );
    }
  }
  if (legs.length < 10) return null;
  const legLengthPx = median(legs);
  const staturePx = legLengthPx / LEG_FRACTION_OF_STATURE;
  return {
    pxPerMeter: staturePx / (heightCm / 100),
    legLengthPx,
    samples: legs.length,
  };
}
