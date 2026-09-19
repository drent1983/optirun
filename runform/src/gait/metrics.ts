import {
  ankleAheadOfHip,
  armsCrossing,
  classifyFootStrike,
  elbowAngle,
  facingDirection,
  footAngle,
  hipExtension,
  kneeAngle,
  kneeCrossover,
  nearSide as pickNearSide,
  pelvicDrop,
  shinAngle,
  trunkLean,
  type FrameGeometry,
} from './angles';
import { type Calibration, toPx } from './calibration';
import type { Contact, Side } from './events';
import { mean, median, stddev } from './smoothing';
import { LM, type CameraPlane, type FramePose } from './types';

export interface MetricValue {
  /** Valor medio. NaN si no se pudo calcular. */
  value: number;
  /** Desviación estándar entre zancadas. */
  sd: number;
  /** Número de muestras (zancadas o pasos). */
  n: number;
}

export interface GaitMetrics {
  /** Pasos por minuto (ambos pies). */
  cadence: MetricValue;
  /** Tiempo de contacto en ms, ambos pies. */
  contactTimeMs: MetricValue;
  contactTimeBySide: Record<Side, MetricValue>;
  /** Tiempo de vuelo en ms (entre despegue de un pie y contacto del otro). */
  flightTimeMs: MetricValue;
  /** Oscilación vertical del centro de caderas en cm. */
  verticalOscillationCm: MetricValue;
  /** Inclinación del tronco hacia delante en grados, media de todo el video. */
  trunkLeanDeg: MetricValue;
  /** Ángulo de rodilla en el contacto inicial (180 = recta). */
  kneeAngleAtStrikeDeg: MetricValue;
  /** Ángulo de tibia en el contacto (positivo = tobillo adelantado). */
  shinAngleAtStrikeDeg: MetricValue;
  /** Tobillo por delante de la cadera en el contacto, como % de la longitud de pierna. */
  overstridePct: MetricValue;
  /** Extensión de cadera en el despegue (grados del muslo tras la vertical). */
  hipExtensionDeg: MetricValue;
  /** Ángulo del pie en el contacto (positivo = talón). */
  footAngleAtStrikeDeg: MetricValue;
  /** Reparto de tipo de pisada en los contactos analizados. */
  footStrike: { heel: number; midfoot: number; forefoot: number };
  /** Ángulo del codo del brazo cercano, media del video. */
  elbowAngleDeg: MetricValue;
  /** Plano frontal: caída pélvica en apoyo medio, grados. */
  pelvicDropDeg: MetricValue;
  /** Plano frontal: cruce de rodilla en apoyo medio, % del ancho de caderas. */
  kneeCrossoverPct: MetricValue;
  /** Plano frontal: % de frames con alguna muñeca cruzando la línea media. */
  armCrossPct: MetricValue;
  /** Lado usado para los ángulos (el más visible). */
  nearSide: Side;
  /** +1 si el corredor mira hacia la derecha de la imagen. */
  facing: 1 | -1;
  /** Resolución temporal: 1000 / fps, para mostrar el margen de error. */
  frameMs: number;
  /** Número de contactos válidos usados. */
  contacts: number;
}

const EMPTY: MetricValue = { value: NaN, sd: NaN, n: 0 };

function summarize(values: number[]): MetricValue {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return EMPTY;
  return { value: mean(clean), sd: stddev(clean), n: clean.length };
}

export function computeCadence(contacts: Contact[], fps: number): MetricValue {
  if (contacts.length < 3) return EMPTY;
  const intervals: number[] = [];
  for (let i = 1; i < contacts.length; i++) {
    intervals.push((contacts[i].strike - contacts[i - 1].strike) / fps);
  }
  // Descartar intervalos anómalos (pasos perdidos duplican el intervalo).
  const med = median(intervals);
  const good = intervals.filter((d) => d > med * 0.6 && d < med * 1.5);
  if (good.length === 0) return EMPTY;
  const stepsPerMin = good.map((d) => 60 / d);
  return summarize(stepsPerMin);
}

export function computeContactTime(contacts: Contact[], fps: number): MetricValue {
  return summarize(contacts.map((c) => ((c.toeOff - c.strike) / fps) * 1000));
}

export function computeFlightTime(contacts: Contact[], fps: number): MetricValue {
  const flights: number[] = [];
  for (let i = 1; i < contacts.length; i++) {
    const gap = contacts[i].strike - contacts[i - 1].toeOff;
    // Vuelo válido: pies alternos y hueco razonable.
    if (contacts[i].side !== contacts[i - 1].side && gap >= 0 && gap / fps < 0.4) {
      flights.push((gap / fps) * 1000);
    }
  }
  return summarize(flights);
}

/**
 * Oscilación vertical: amplitud (máx - mín) de la altura del centro de caderas
 * dentro de cada paso (entre contactos consecutivos), convertida a cm.
 */
export function computeVerticalOscillation(
  frames: FramePose[],
  contacts: Contact[],
  width: number,
  height: number,
  cal: Calibration | null,
  minVisibility = 0.5,
): MetricValue {
  if (!cal || contacts.length < 2) return EMPTY;
  const hipY = frames.map((f) => {
    if (!f.points) return NaN;
    const l = f.points[LM.LEFT_HIP];
    const r = f.points[LM.RIGHT_HIP];
    if (l.v < minVisibility && r.v < minVisibility) return NaN;
    if (l.v < minVisibility) return toPx(r, width, height).y;
    if (r.v < minVisibility) return toPx(l, width, height).y;
    return (toPx(l, width, height).y + toPx(r, width, height).y) / 2;
  });

  const amplitudes: number[] = [];
  for (let i = 1; i < contacts.length; i++) {
    const seg = hipY.slice(contacts[i - 1].strike, contacts[i].strike).filter((v) => !Number.isNaN(v));
    if (seg.length < 3) continue;
    amplitudes.push(((Math.max(...seg) - Math.min(...seg)) / cal.pxPerMeter) * 100);
  }
  return summarize(amplitudes);
}

export function computeMetrics(
  frames: FramePose[],
  contacts: Contact[],
  width: number,
  height: number,
  fps: number,
  cal: Calibration | null,
  plane: CameraPlane = 'lateral',
): GaitMetrics {
  const left = contacts.filter((c) => c.side === 'left');
  const right = contacts.filter((c) => c.side === 'right');
  const angles = computeAngles(frames, contacts, width, height, cal);
  const frontal = computeFrontal(frames, contacts, width, height, plane);
  return {
    ...frontal,
    cadence: computeCadence(contacts, fps),
    contactTimeMs: computeContactTime(contacts, fps),
    contactTimeBySide: {
      left: computeContactTime(left, fps),
      right: computeContactTime(right, fps),
    },
    flightTimeMs: computeFlightTime(contacts, fps),
    verticalOscillationCm: computeVerticalOscillation(frames, contacts, width, height, cal),
    ...angles,
    frameMs: 1000 / fps,
    contacts: contacts.length,
  };
}

type AngleMetrics = Pick<
  GaitMetrics,
  | 'trunkLeanDeg'
  | 'kneeAngleAtStrikeDeg'
  | 'shinAngleAtStrikeDeg'
  | 'overstridePct'
  | 'hipExtensionDeg'
  | 'footAngleAtStrikeDeg'
  | 'footStrike'
  | 'elbowAngleDeg'
  | 'nearSide'
  | 'facing'
>;

/**
 * Métricas angulares del plano lateral. Se calculan solo en el lado cercano a
 * la cámara: la pierna lejana queda parcialmente ocluida y sus ángulos no son fiables.
 */
export function computeAngles(
  frames: FramePose[],
  contacts: Contact[],
  width: number,
  height: number,
  cal: Calibration | null,
  minVisibility = 0.5,
): AngleMetrics {
  const facing = facingDirection(frames);
  const side = pickNearSide(frames);
  const g: FrameGeometry = { width, height, facing, minVisibility };
  const near = contacts.filter((c) => c.side === side);

  const at = (idx: number) => frames[Math.max(0, Math.min(frames.length - 1, idx))]?.points ?? null;

  // Medias sobre todo el video.
  const trunk: number[] = [];
  const elbow: number[] = [];
  for (const f of frames) {
    if (!f.points) continue;
    trunk.push(trunkLean(f.points, g));
    elbow.push(elbowAngle(f.points, side, g));
  }

  // Valores en el instante de contacto y de despegue.
  const knee: number[] = [];
  const shin: number[] = [];
  const over: number[] = [];
  const hipExt: number[] = [];
  const foot: number[] = [];
  const strikes = { heel: 0, midfoot: 0, forefoot: 0 };

  for (const c of near) {
    const ps = at(c.strike);
    if (ps) {
      knee.push(kneeAngle(ps, side, g));
      shin.push(shinAngle(ps, side, g));
      if (cal) over.push((ankleAheadOfHip(ps, side, g) / cal.legLengthPx) * 100);
      const fa = footAngle(ps, side, g);
      foot.push(fa);
      const kind = classifyFootStrike(fa);
      if (kind) strikes[kind]++;
    }
    const pt = at(c.toeOff - 1);
    if (pt) hipExt.push(hipExtension(pt, side, g));
  }

  return {
    trunkLeanDeg: summarize(trunk),
    kneeAngleAtStrikeDeg: summarize(knee),
    shinAngleAtStrikeDeg: summarize(shin),
    overstridePct: summarize(over),
    hipExtensionDeg: summarize(hipExt),
    footAngleAtStrikeDeg: summarize(foot),
    footStrike: strikes,
    elbowAngleDeg: summarize(elbow),
    nearSide: side,
    facing,
  };
}

type FrontalMetrics = Pick<GaitMetrics, 'pelvicDropDeg' | 'kneeCrossoverPct' | 'armCrossPct'>;

/**
 * Métricas del plano frontal, medidas en el apoyo medio de cada contacto.
 * En plano lateral devuelven "sin datos" para no evaluar algo que no se ve.
 */
export function computeFrontal(
  frames: FramePose[],
  contacts: Contact[],
  width: number,
  height: number,
  plane: CameraPlane,
  minVisibility = 0.5,
): FrontalMetrics {
  if (plane !== 'frontal') {
    return { pelvicDropDeg: EMPTY, kneeCrossoverPct: EMPTY, armCrossPct: EMPTY };
  }
  const g: FrameGeometry = { width, height, facing: 1, minVisibility };
  const drop: number[] = [];
  const cross: number[] = [];
  for (const c of contacts) {
    const mid = Math.floor((c.strike + c.toeOff) / 2);
    const p = frames[mid]?.points;
    if (!p) continue;
    drop.push(pelvicDrop(p, c.side, g));
    cross.push(kneeCrossover(p, c.side, g));
  }

  let crossing = 0;
  let seen = 0;
  for (const f of frames) {
    if (!f.points) continue;
    const r = armsCrossing(f.points, g);
    if (r === null) continue;
    seen++;
    if (r) crossing++;
  }
  const armCrossPct: MetricValue = seen
    ? { value: (crossing / seen) * 100, sd: 0, n: seen }
    : EMPTY;

  return {
    pelvicDropDeg: summarize(drop),
    kneeCrossoverPct: summarize(cross),
    armCrossPct,
  };
}
