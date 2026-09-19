import { toPx } from './calibration';
import type { Side } from './events';
import { mean } from './smoothing';
import { LM, type FramePose, type Point } from './types';

type XY = { x: number; y: number };

const RAD = 180 / Math.PI;

/** Ángulo en grados en el vértice b del triángulo a-b-c. 180 = alineados. */
export function jointAngle(a: XY, b: XY, c: XY): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n === 0) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / n))) * RAD;
}

/**
 * Ángulo de un segmento respecto a la vertical, con signo.
 * `top` y `bottom` son el extremo superior e inferior del segmento (en anatomía).
 * Positivo cuando el extremo inferior está por delante del superior en el
 * sentido de la marcha (`facing`: +1 si el corredor mira hacia x creciente).
 * El eje y de la imagen crece hacia abajo.
 */
export function segmentAngleFromVertical(top: XY, bottom: XY, facing: 1 | -1): number {
  const dx = (bottom.x - top.x) * facing;
  const dy = bottom.y - top.y; // positivo hacia abajo
  return Math.atan2(dx, dy) * RAD;
}

/**
 * Sentido de la marcha: +1 si el corredor mira hacia la derecha de la imagen.
 * Se estima con la dirección talón → punta de ambos pies a lo largo del video.
 */
export function facingDirection(frames: FramePose[], minVisibility = 0.3): 1 | -1 {
  let sum = 0;
  for (const f of frames) {
    if (!f.points) continue;
    for (const [heel, toe] of [
      [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
      [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
    ] as const) {
      const h = f.points[heel];
      const t = f.points[toe];
      if (h.v < minVisibility || t.v < minVisibility) continue;
      sum += t.x - h.x;
    }
  }
  return sum >= 0 ? 1 : -1;
}

/**
 * Lado más cercano a la cámara en plano lateral: el que tiene mayor
 * visibilidad media en cadera, rodilla y tobillo.
 */
export function nearSide(frames: FramePose[]): Side {
  const score = (hip: number, knee: number, ankle: number) =>
    mean(
      frames
        .filter((f) => f.points)
        .map((f) => (f.points![hip].v + f.points![knee].v + f.points![ankle].v) / 3),
    );
  const l = score(LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE);
  const r = score(LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE);
  return l >= r ? 'left' : 'right';
}

export const SIDE_LM = {
  left: {
    shoulder: LM.LEFT_SHOULDER,
    elbow: LM.LEFT_ELBOW,
    wrist: LM.LEFT_WRIST,
    hip: LM.LEFT_HIP,
    knee: LM.LEFT_KNEE,
    ankle: LM.LEFT_ANKLE,
    heel: LM.LEFT_HEEL,
    toe: LM.LEFT_FOOT_INDEX,
  },
  right: {
    shoulder: LM.RIGHT_SHOULDER,
    elbow: LM.RIGHT_ELBOW,
    wrist: LM.RIGHT_WRIST,
    hip: LM.RIGHT_HIP,
    knee: LM.RIGHT_KNEE,
    ankle: LM.RIGHT_ANKLE,
    heel: LM.RIGHT_HEEL,
    toe: LM.RIGHT_FOOT_INDEX,
  },
} as const;

export interface FrameGeometry {
  width: number;
  height: number;
  facing: 1 | -1;
  minVisibility: number;
}

function visible(points: Point[], idxs: number[], minVis: number): boolean {
  return idxs.every((i) => points[i].v >= minVis);
}

function px(points: Point[], idx: number, g: FrameGeometry): XY {
  return toPx(points[idx], g.width, g.height);
}

function hipMid(points: Point[], g: FrameGeometry): XY | null {
  const l = points[LM.LEFT_HIP];
  const r = points[LM.RIGHT_HIP];
  if (l.v < g.minVisibility && r.v < g.minVisibility) return null;
  if (l.v < g.minVisibility) return px(points, LM.RIGHT_HIP, g);
  if (r.v < g.minVisibility) return px(points, LM.LEFT_HIP, g);
  const a = px(points, LM.LEFT_HIP, g);
  const b = px(points, LM.RIGHT_HIP, g);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function shoulderMid(points: Point[], g: FrameGeometry): XY | null {
  const l = points[LM.LEFT_SHOULDER];
  const r = points[LM.RIGHT_SHOULDER];
  if (l.v < g.minVisibility && r.v < g.minVisibility) return null;
  if (l.v < g.minVisibility) return px(points, LM.RIGHT_SHOULDER, g);
  if (r.v < g.minVisibility) return px(points, LM.LEFT_SHOULDER, g);
  const a = px(points, LM.LEFT_SHOULDER, g);
  const b = px(points, LM.RIGHT_SHOULDER, g);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Inclinación del tronco respecto a la vertical. Positivo = hacia delante. */
export function trunkLean(points: Point[], g: FrameGeometry): number {
  const s = shoulderMid(points, g);
  const h = hipMid(points, g);
  if (!s || !h) return NaN;
  // El tronco va de cadera (abajo) a hombro (arriba): top = hombro, bottom = cadera.
  // Inclinación hacia delante = hombro por delante de la cadera = bottom detrás → signo negativo.
  return -segmentAngleFromVertical(s, h, g.facing);
}

/** Ángulo de rodilla (cadera-rodilla-tobillo). 180 = pierna recta. */
export function kneeAngle(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  if (!visible(points, [s.hip, s.knee, s.ankle], g.minVisibility)) return NaN;
  return jointAngle(px(points, s.hip, g), px(points, s.knee, g), px(points, s.ankle, g));
}

/**
 * Ángulo de la tibia respecto a la vertical. Positivo = tobillo por delante
 * de la rodilla (pie que aterriza adelantado, indicador de overstriding).
 */
export function shinAngle(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  if (!visible(points, [s.knee, s.ankle], g.minVisibility)) return NaN;
  return segmentAngleFromVertical(px(points, s.knee, g), px(points, s.ankle, g), g.facing);
}

/**
 * Ángulo del muslo respecto a la vertical. Positivo = rodilla por detrás de
 * la cadera (extensión de cadera, se mide en el despegue).
 */
export function hipExtension(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  if (!visible(points, [s.hip, s.knee], g.minVisibility)) return NaN;
  return -segmentAngleFromVertical(px(points, s.hip, g), px(points, s.knee, g), g.facing);
}

/**
 * Distancia horizontal del tobillo por delante del centro de caderas, en
 * píxeles, positiva hacia delante. Se normaliza fuera con la longitud de pierna.
 */
export function ankleAheadOfHip(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  const h = hipMid(points, g);
  if (!h || points[s.ankle].v < g.minVisibility) return NaN;
  return (px(points, s.ankle, g).x - h.x) * g.facing;
}

/**
 * Ángulo del pie respecto al suelo en grados. Positivo = punta más alta que el
 * talón (aterrizaje de talón). Negativo = talón más alto (antepié).
 */
export function footAngle(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  if (!visible(points, [s.heel, s.toe], g.minVisibility)) return NaN;
  const h = px(points, s.heel, g);
  const t = px(points, s.toe, g);
  const dx = (t.x - h.x) * g.facing;
  const dy = h.y - t.y; // positivo si la punta está más alta
  return Math.atan2(dy, Math.abs(dx)) * RAD;
}

export type FootStrike = 'heel' | 'midfoot' | 'forefoot';

export function classifyFootStrike(angleDeg: number): FootStrike | null {
  if (!Number.isFinite(angleDeg)) return null;
  if (angleDeg > 8) return 'heel';
  if (angleDeg < -5) return 'forefoot';
  return 'midfoot';
}

/* ---------- Plano frontal ---------- */

/**
 * Caída pélvica en apoyo: inclinación de la línea de caderas en grados.
 * Positivo cuando la cadera del lado en vuelo (contrario a `stanceSide`) queda
 * más baja que la del lado de apoyo (signo de Trendelenburg).
 */
export function pelvicDrop(points: Point[], stanceSide: Side, g: FrameGeometry): number {
  const l = points[LM.LEFT_HIP];
  const r = points[LM.RIGHT_HIP];
  if (l.v < g.minVisibility || r.v < g.minVisibility) return NaN;
  const lp = px(points, LM.LEFT_HIP, g);
  const rp = px(points, LM.RIGHT_HIP, g);
  const width = Math.abs(lp.x - rp.x);
  if (width < 1) return NaN;
  const stance = stanceSide === 'left' ? lp : rp;
  const swing = stanceSide === 'left' ? rp : lp;
  return Math.atan2(swing.y - stance.y, width) * RAD;
}

/**
 * Cruce de rodilla en apoyo: desplazamiento horizontal de la rodilla respecto
 * a la línea cadera-tobillo del mismo lado, en % del ancho de caderas.
 * Positivo = rodilla hacia la línea media del cuerpo (valgo dinámico).
 */
export function kneeCrossover(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  if (!visible(points, [s.hip, s.knee, s.ankle, LM.LEFT_HIP, LM.RIGHT_HIP], g.minVisibility)) return NaN;
  const hip = px(points, s.hip, g);
  const knee = px(points, s.knee, g);
  const ankle = px(points, s.ankle, g);
  const lp = px(points, LM.LEFT_HIP, g);
  const rp = px(points, LM.RIGHT_HIP, g);
  const hipWidth = Math.abs(lp.x - rp.x);
  if (hipWidth < 1) return NaN;
  const midX = (lp.x + rp.x) / 2;
  const dy = ankle.y - hip.y;
  if (Math.abs(dy) < 1) return NaN;
  const t = (knee.y - hip.y) / dy;
  const lineX = hip.x + (ankle.x - hip.x) * t;
  const offset = knee.x - lineX;
  // Medial = hacia el centro del cuerpo.
  const medialSign = midX >= hip.x ? 1 : -1;
  return ((offset * medialSign) / hipWidth) * 100;
}

/**
 * True si alguna muñeca cruza la línea media del cuerpo (plano frontal).
 * Se compara el lado de la muñeca con el lado de su propio hombro.
 */
export function armsCrossing(points: Point[], g: FrameGeometry): boolean | null {
  const ls = points[LM.LEFT_SHOULDER];
  const rs = points[LM.RIGHT_SHOULDER];
  if (ls.v < g.minVisibility || rs.v < g.minVisibility) return null;
  const midX = (px(points, LM.LEFT_SHOULDER, g).x + px(points, LM.RIGHT_SHOULDER, g).x) / 2;
  let any = false;
  let seen = false;
  for (const side of ['left', 'right'] as const) {
    const s = SIDE_LM[side];
    if (points[s.wrist].v < g.minVisibility) continue;
    seen = true;
    const shoulderSide = Math.sign(px(points, s.shoulder, g).x - midX);
    const wristSide = Math.sign(px(points, s.wrist, g).x - midX);
    if (shoulderSide !== 0 && wristSide !== 0 && shoulderSide !== wristSide) any = true;
  }
  return seen ? any : null;
}

/** Ángulo del codo (hombro-codo-muñeca). */
export function elbowAngle(points: Point[], side: Side, g: FrameGeometry): number {
  const s = SIDE_LM[side];
  if (!visible(points, [s.shoulder, s.elbow, s.wrist], g.minVisibility)) return NaN;
  return jointAngle(px(points, s.shoulder, g), px(points, s.elbow, g), px(points, s.wrist, g));
}
