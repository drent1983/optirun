import { toPx } from './calibration';
import { percentile } from './smoothing';
import { LM, type FramePose } from './types';

export type Side = 'left' | 'right';

export interface Contact {
  side: Side;
  /** Frame de contacto inicial. */
  strike: number;
  /** Primer frame en vuelo tras el apoyo. */
  toeOff: number;
  /** Tiempo del contacto inicial en segundos. */
  t: number;
}

export interface EventDetectionOptions {
  fps: number;
  minVisibility?: number;
  /** Duración mínima de un apoyo en ms. Filtra falsos positivos. */
  minStanceMs?: number;
  /** Duración máxima de un apoyo en ms. */
  maxStanceMs?: number;
}

const SIDE_LANDMARKS = {
  left: { heel: LM.LEFT_HEEL, toe: LM.LEFT_FOOT_INDEX, ankle: LM.LEFT_ANKLE },
  right: { heel: LM.RIGHT_HEEL, toe: LM.RIGHT_FOOT_INDEX, ankle: LM.RIGHT_ANKLE },
} as const;

/**
 * Altura del punto más bajo del pie por frame, en píxeles (y crece hacia abajo).
 * NaN si el pie no es visible.
 */
export function footLowestY(
  frames: FramePose[],
  side: Side,
  width: number,
  height: number,
  minVisibility = 0.3,
): number[] {
  const { heel, toe, ankle } = SIDE_LANDMARKS[side];
  return frames.map((f) => {
    if (!f.points) return NaN;
    const h = f.points[heel];
    const t = f.points[toe];
    const a = f.points[ankle];
    const candidates = [h, t, a].filter((p) => p.v >= minVisibility);
    if (candidates.length === 0) return NaN;
    return Math.max(...candidates.map((p) => toPx(p, width, height).y));
  });
}

/**
 * Detecta apoyos de un pie por umbral de altura: el pie está en el suelo
 * cuando su punto más bajo se encuentra en la banda inferior de su recorrido.
 *
 * Método: suelo = percentil 95 de la altura del pie; techo = percentil 5.
 * Apoyo = altura por encima de suelo - 0.25 * (suelo - techo).
 * Se descartan apoyos demasiado cortos o largos y el primero y el último
 * (pueden estar cortados por los bordes del video).
 */
export interface SideDiagnostics {
  side: Side;
  frames: number;
  validFrames: number;
  ground: number;
  ceiling: number;
  range: number;
  threshold: number;
  vThresh: number;
  rawSegments: number;
  refinedKept: number;
  /** Duraciones en frames de los segmentos crudos, para ver qué filtra. */
  rawDurations: number[];
  contacts: Contact[];
  reason: string | null;
}

export function detectContacts(
  frames: FramePose[],
  side: Side,
  width: number,
  height: number,
  opts: EventDetectionOptions,
): Contact[] {
  return diagnoseContacts(frames, side, width, height, opts).contacts;
}

/**
 * Igual que detectContacts pero devuelve además todos los valores intermedios
 * para poder entender por qué no se detectan apoyos en un video concreto.
 */
export function diagnoseContacts(
  frames: FramePose[],
  side: Side,
  width: number,
  height: number,
  opts: EventDetectionOptions,
): SideDiagnostics {
  const minVis = opts.minVisibility ?? 0.3;
  const minStance = Math.max(2, Math.round(((opts.minStanceMs ?? 100) / 1000) * opts.fps));
  const maxStance = Math.round(((opts.maxStanceMs ?? 500) / 1000) * opts.fps);

  const y = footLowestY(frames, side, width, height, minVis);
  const valid = y.filter((v) => !Number.isNaN(v));
  const diag: SideDiagnostics = {
    side,
    frames: frames.length,
    validFrames: valid.length,
    ground: NaN,
    ceiling: NaN,
    range: NaN,
    threshold: NaN,
    vThresh: NaN,
    rawSegments: 0,
    refinedKept: 0,
    rawDurations: [],
    contacts: [],
    reason: null,
  };
  if (valid.length < opts.fps) {
    diag.reason = 'Menos de un segundo de frames con el pie visible';
    return diag;
  }

  const ground = percentile(valid, 0.95);
  const ceiling = percentile(valid, 0.05);
  const range = ground - ceiling;
  const threshold = ground - 0.25 * range;
  Object.assign(diag, { ground, ceiling, range, threshold });
  if (range < 4) {
    diag.reason = 'El pie apenas cambia de altura (rango < 4 px)';
    return diag;
  }

  // 1. Máscara de apoyo y cierre de huecos de 1 frame.
  const stance = y.map((v) => !Number.isNaN(v) && v >= threshold);
  for (let i = 1; i < stance.length - 1; i++) {
    if (!stance[i] && stance[i - 1] && stance[i + 1]) stance[i] = true;
  }

  // 2. Agrupar en segmentos.
  const segments: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i < stance.length; i++) {
    if (stance[i] && start < 0) start = i;
    if (!stance[i] && start >= 0) {
      segments.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0) segments.push([start, stance.length]);
  diag.rawSegments = segments.length;
  diag.rawDurations = segments.map(([s, e]) => e - s);

  // 3. Refinar bordes: el pie en el suelo está cerca del nivel del suelo y
  //    casi sin velocidad vertical. Si el refinado deja el segmento demasiado
  //    corto, se conserva el segmento crudo.
  const vy = y.map((v, i) => (i > 0 && !Number.isNaN(v) && !Number.isNaN(y[i - 1]) ? v - y[i - 1] : NaN));
  const speeds = vy.filter((v) => !Number.isNaN(v)).map(Math.abs);
  const vThresh = 0.25 * percentile(speeds, 0.9);
  diag.vThresh = vThresh;
  const tight = ground - 0.12 * range;
  const onGround = (i: number) =>
    !Number.isNaN(y[i]) && y[i] >= tight && (Number.isNaN(vy[i]) || Math.abs(vy[i]) <= vThresh);

  const refined = segments.map(([s, e]) => {
    let a = s;
    let b = e;
    while (a < b - 1 && !onGround(a)) a++;
    while (b > a + 1 && !onGround(b - 1)) b--;
    return b - a >= minStance ? ([a, b] as [number, number]) : ([s, e] as [number, number]);
  });

  // 4. Filtrar por duración y descartar los extremos.
  const kept = refined.filter(([s, e]) => e - s >= minStance && e - s <= maxStance);
  diag.refinedKept = kept.length;
  const contacts = kept.map<Contact>(([s, e]) => ({ side, strike: s, toeOff: e, t: frames[s].t }));

  if (contacts.length <= 2) {
    diag.reason =
      segments.length === 0
        ? 'Ningún tramo por debajo del umbral de suelo'
        : `Solo ${contacts.length} apoyos con duración válida (${minStance}-${maxStance} frames)`;
    return diag;
  }
  diag.contacts = contacts.slice(1, -1);
  return diag;
}

/** Detecta apoyos de ambos pies y los devuelve ordenados por tiempo. */
export function detectAllContacts(
  frames: FramePose[],
  width: number,
  height: number,
  opts: EventDetectionOptions,
): Contact[] {
  return [
    ...detectContacts(frames, 'left', width, height, opts),
    ...detectContacts(frames, 'right', width, height, opts),
  ].sort((a, b) => a.strike - b.strike);
}

export function diagnoseAll(
  frames: FramePose[],
  width: number,
  height: number,
  opts: EventDetectionOptions,
): SideDiagnostics[] {
  return [
    diagnoseContacts(frames, 'left', width, height, opts),
    diagnoseContacts(frames, 'right', width, height, opts),
  ];
}
