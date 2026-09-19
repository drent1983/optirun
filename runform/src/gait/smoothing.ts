import { LANDMARK_COUNT, type FramePose, type Point } from './types';

/**
 * Rellena huecos cortos (frames sin pose) por interpolación lineal entre
 * el último y el siguiente frame válidos. Huecos mayores que `maxGap` se dejan en null.
 */
export function interpolateGaps(frames: FramePose[], maxGap = 3): FramePose[] {
  const out = frames.map((f) => ({ ...f }));
  let i = 0;
  while (i < out.length) {
    if (out[i].points) {
      i++;
      continue;
    }
    const start = i;
    while (i < out.length && !out[i].points) i++;
    const end = i; // primer índice válido tras el hueco (o length)
    const gap = end - start;
    const prev = start > 0 ? out[start - 1].points : null;
    const next = end < out.length ? out[end].points : null;
    if (prev && next && gap <= maxGap) {
      for (let k = start; k < end; k++) {
        const a = (k - start + 1) / (gap + 1);
        out[k].points = prev.map((p, j) => lerpPoint(p, next[j], a));
      }
    }
  }
  return out;
}

function lerpPoint(p: Point, q: Point, a: number): Point {
  return {
    x: p.x + (q.x - p.x) * a,
    y: p.y + (q.y - p.y) * a,
    z: p.z + (q.z - p.z) * a,
    v: Math.min(p.v, q.v),
  };
}

/**
 * Suavizado offline con ventana gaussiana centrada por landmark y coordenada.
 * No introduce retardo (a diferencia de un filtro causal). Los frames null
 * se saltan y no contaminan a sus vecinos.
 *
 * @param radius frames a cada lado. 2 es adecuado para 30 fps, 3-4 para 60 fps.
 */
export function smoothFrames(frames: FramePose[], radius = 2): FramePose[] {
  if (radius <= 0) return frames;
  const sigma = radius / 1.5;
  const weights: number[] = [];
  for (let k = -radius; k <= radius; k++) weights.push(Math.exp(-(k * k) / (2 * sigma * sigma)));

  return frames.map((f, i) => {
    if (!f.points) return f;
    const acc: Point[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0, v: 0 }));
    let wsum = 0;
    for (let k = -radius; k <= radius; k++) {
      const g = frames[i + k];
      if (!g?.points) continue;
      const w = weights[k + radius];
      wsum += w;
      for (let j = 0; j < LANDMARK_COUNT; j++) {
        acc[j].x += g.points[j].x * w;
        acc[j].y += g.points[j].y * w;
        acc[j].z += g.points[j].z * w;
        acc[j].v += g.points[j].v * w;
      }
    }
    if (wsum === 0) return f;
    return {
      ...f,
      points: acc.map((p) => ({ x: p.x / wsum, y: p.y / wsum, z: p.z / wsum, v: p.v / wsum })),
    };
  });
}

/** Mediana de un array numérico (no muta el original). */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

/** Percentil p (0..1) por interpolación lineal. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
