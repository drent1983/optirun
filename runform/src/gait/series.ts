import type { MetricValue } from './metrics';
import { evaluate, type Light, type Threshold } from './rules';
import type { CameraPlane, PaceBand } from './types';

/** Lo mínimo que la evolución necesita de una sesión guardada. */
export interface SessionLike {
  id?: number;
  name: string;
  createdAt: number;
  plane: CameraPlane;
  paceBand: PaceBand;
  paceSecPerKm: number;
  metrics: Record<string, unknown> | null;
}

export interface SeriesPoint {
  sessionId: number | undefined;
  name: string;
  t: number;
  value: number;
  sd: number;
  n: number;
  light: Light;
  paceBand: PaceBand;
}

export interface MetricSeries {
  threshold: Threshold;
  points: SeriesPoint[];
}

function metricOf(s: SessionLike, key: string): MetricValue | null {
  const m = s.metrics?.[key] as MetricValue | undefined;
  if (!m || typeof m.value !== 'number') return null;
  return m;
}

/**
 * Construye una serie temporal por umbral a partir de las sesiones dadas,
 * filtrando por plano y, opcionalmente, banda de ritmo. Ordena por fecha y
 * omite sesiones sin valor finito para esa métrica.
 */
export function buildSeries(
  sessions: SessionLike[],
  thresholds: Threshold[],
  plane: CameraPlane,
  paceBand: PaceBand | 'all',
): MetricSeries[] {
  const pool = sessions
    .filter((s) => s.plane === plane && (paceBand === 'all' || s.paceBand === paceBand))
    .sort((a, b) => a.createdAt - b.createdAt);

  return thresholds
    .filter((t) => t.planes.includes(plane))
    .map((t) => ({
      threshold: t,
      points: pool.flatMap<SeriesPoint>((s) => {
        const m = metricOf(s, t.id);
        if (!m || !Number.isFinite(m.value)) return [];
        return [
          {
            sessionId: s.id,
            name: s.name,
            t: s.createdAt,
            value: m.value,
            sd: m.sd,
            n: m.n,
            light: evaluate(m, t),
            paceBand: s.paceBand,
          },
        ];
      }),
    }));
}

export interface Delta {
  threshold: Threshold;
  a: MetricValue | null;
  b: MetricValue | null;
  /** b - a. NaN si falta alguno. */
  diff: number;
  /** true si b está más cerca (o dentro) de la banda verde que a. */
  improved: boolean | null;
  lightA: Light;
  lightB: Light;
}

/** Distancia de un valor a la banda verde. 0 si está dentro. */
export function distanceToGreen(value: number, t: Threshold): number {
  const [g0, g1] = t.band.green;
  if (value < g0) return g0 - value;
  if (value > g1) return value - g1;
  return 0;
}

/** Compara dos sesiones métrica a métrica. */
export function compareSessions(a: SessionLike, b: SessionLike, thresholds: Threshold[]): Delta[] {
  const plane = a.plane;
  return thresholds
    .filter((t) => t.planes.includes(plane))
    .map((t) => {
      const ma = metricOf(a, t.id);
      const mb = metricOf(b, t.id);
      const okA = ma && Number.isFinite(ma.value);
      const okB = mb && Number.isFinite(mb.value);
      const diff = okA && okB ? mb.value - ma.value : NaN;
      let improved: boolean | null = null;
      if (okA && okB) {
        const da = distanceToGreen(ma.value, t);
        const db = distanceToGreen(mb.value, t);
        improved = db < da ? true : db > da ? false : null;
      }
      return {
        threshold: t,
        a: ma,
        b: mb,
        diff,
        improved,
        lightA: ma ? evaluate(ma, t) : 'unknown',
        lightB: mb ? evaluate(mb, t) : 'unknown',
      };
    });
}
