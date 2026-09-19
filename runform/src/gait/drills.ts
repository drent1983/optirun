import type { Assessment } from './rules';
import type { MetricKey } from './rules';

export interface Drill {
  id: string;
  name: string;
  /** Qué corrige y cómo se hace, en dos o tres frases. */
  how: string;
  /** Dosis sugerida. */
  dose: string;
}

export const DRILLS: Record<string, Drill> = {
  metronome: {
    id: 'metronome',
    name: 'Correr con metrónomo',
    how: 'Pon un metrónomo un 5 % por encima de tu cadencia actual y ajusta el paso al clic. Acorta la zancada, no aceleres.',
    dose: '3 bloques de 3 min dentro de un rodaje suave, 2 veces por semana.',
  },
  skipping: {
    id: 'skipping',
    name: 'Skipping bajo',
    how: 'Trote en el sitio con rodillas bajas y contacto muy rápido con el suelo, pie bajo el cuerpo.',
    dose: '4 x 20 s antes de correr.',
  },
  aSkip: {
    id: 'aSkip',
    name: 'A-skips',
    how: 'Elevación de rodilla alternada con un pequeño salto, aterrizando con el pie debajo de la cadera. Marca el golpe de pie hacia abajo, no hacia delante.',
    dose: '3 x 20 m antes de las series.',
  },
  wallDrill: {
    id: 'wallDrill',
    name: 'Wall drill',
    how: 'Manos en la pared, cuerpo inclinado en línea. Alterna rodillas llevando el pie a aterrizar bajo la cadera, sin adelantarlo.',
    dose: '3 x 20 repeticiones por pierna.',
  },
  barefootStrides: {
    id: 'barefootStrides',
    name: 'Rectas descalzo en césped',
    how: 'Rectas suaves descalzo sobre hierba. El cuerpo evita el talón de forma natural y acerca el apoyo al centro de masas.',
    dose: '4 a 6 rectas de 60 m, 1 vez por semana, progresando despacio.',
  },
  fallingDrill: {
    id: 'fallingDrill',
    name: 'Falling drill',
    how: 'De pie, déjate caer hacia delante desde los tobillos, cuerpo en línea recta, y empieza a correr justo antes de perder el equilibrio. Enseña a inclinarse desde el tobillo y no desde la cintura.',
    dose: '6 a 8 repeticiones antes de correr.',
  },
  hipFlexorMobility: {
    id: 'hipFlexorMobility',
    name: 'Movilidad de flexores de cadera',
    how: 'Estocada baja con la pelvis en retroversión, empujando la cadera hacia delante sin arquear la espalda.',
    dose: '2 x 45 s por lado, diario.',
  },
  bounding: {
    id: 'bounding',
    name: 'Bounding',
    how: 'Zancadas largas y exageradas empujando fuerte con la pierna de atrás. Busca extensión completa de la cadera trasera.',
    dose: '4 x 30 m, con recuperación completa.',
  },
  gluteBridge: {
    id: 'gluteBridge',
    name: 'Puente de glúteo a una pierna',
    how: 'Tumbado, una pierna apoyada, eleva la cadera hasta alinear hombro, cadera y rodilla. Aprieta el glúteo arriba.',
    dose: '3 x 12 por lado.',
  },
  jumpRope: {
    id: 'jumpRope',
    name: 'Comba baja',
    how: 'Saltos mínimos con la comba, tobillos rígidos y contactos breves. Enseña a rebotar sin subir.',
    dose: '3 x 1 min.',
  },
  quietRunning: {
    id: 'quietRunning',
    name: 'Carrera silenciosa',
    how: 'Corre intentando hacer el mínimo ruido con los pies. Reduce la oscilación y el impacto.',
    dose: 'Bloques de 2 min dentro de un rodaje.',
  },
  armSwingMirror: {
    id: 'armSwingMirror',
    name: 'Braceo frente al espejo',
    how: 'Sentado, brazos a 90°, bracea adelante y atrás desde el hombro sin cruzar la línea media. Manos relajadas, codos hacia atrás.',
    dose: '3 x 30 s.',
  },
  shoulderRelax: {
    id: 'shoulderRelax',
    name: 'Sacudir hombros en carrera',
    how: 'Cada pocos minutos, deja caer los brazos y sacude las manos 5 segundos, luego recoloca el codo cerca de 90°.',
    dose: 'Cada 5 min en rodajes.',
  },
  calfRaises: {
    id: 'calfRaises',
    name: 'Elevaciones de gemelo excéntricas',
    how: 'Sube con dos pies y baja lento con uno. Prepara el aquiles para una pisada más adelantada.',
    dose: '3 x 15 por lado.',
  },
  stepDown: {
    id: 'stepDown',
    name: 'Step-down controlado',
    how: 'Desde un escalón, baja despacio con una pierna manteniendo la rodilla alineada con el pie.',
    dose: '3 x 10 por lado.',
  },
};

/** Ejercicios por métrica y dirección de la desviación. */
const MAP: Partial<Record<MetricKey, { low?: string[]; high?: string[] }>> = {
  cadence: { low: ['metronome', 'skipping', 'aSkip'], high: ['bounding'] },
  contactTimeMs: { high: ['metronome', 'skipping', 'jumpRope'] },
  flightTimeMs: { low: ['skipping', 'bounding'], high: ['metronome', 'quietRunning'] },
  verticalOscillationCm: { high: ['metronome', 'quietRunning', 'jumpRope'] },
  trunkLeanDeg: { low: ['fallingDrill', 'wallDrill'], high: ['fallingDrill', 'gluteBridge'] },
  kneeAngleAtStrikeDeg: { high: ['aSkip', 'wallDrill', 'metronome'], low: ['stepDown', 'gluteBridge'] },
  shinAngleAtStrikeDeg: { high: ['metronome', 'wallDrill', 'aSkip', 'barefootStrides'] },
  overstridePct: { high: ['metronome', 'wallDrill', 'fallingDrill'] },
  footAngleAtStrikeDeg: { high: ['barefootStrides', 'metronome', 'calfRaises'], low: ['calfRaises', 'quietRunning'] },
  hipExtensionDeg: { low: ['hipFlexorMobility', 'bounding', 'gluteBridge'] },
  elbowAngleDeg: { low: ['shoulderRelax', 'armSwingMirror'], high: ['armSwingMirror'] },
  pelvicDropDeg: { high: ['sidePlank', 'gluteBridge', 'singleLegSquat'] },
  kneeCrossoverPct: { high: ['monsterWalk', 'stepDown', 'singleLegSquat'], low: ['stepDown'] },
  armCrossPct: { high: ['armSwingMirror', 'shoulderRelax'] },
};

Object.assign(DRILLS, {
  sidePlank: {
    id: 'sidePlank',
    name: 'Plancha lateral',
    how: 'Apoyo en antebrazo y pie, cuerpo en línea. Activa el glúteo medio del lado de abajo. Progresa elevando la pierna de arriba.',
    dose: '3 x 30 a 45 s por lado.',
  },
  singleLegSquat: {
    id: 'singleLegSquat',
    name: 'Sentadilla a una pierna',
    how: 'Baja despacio a una pierna manteniendo la pelvis nivelada y la rodilla sobre el pie. Usa un espejo o graba de frente.',
    dose: '3 x 8 por lado.',
  },
  monsterWalk: {
    id: 'monsterWalk',
    name: 'Monster walks con banda',
    how: 'Banda en tobillos o rodillas, semiflexión, pasos laterales y diagonales sin que las rodillas se junten.',
    dose: '3 x 12 pasos por dirección.',
  },
} satisfies Record<string, Drill>);

export interface Recommendation {
  assessment: Assessment;
  finding: string;
  drills: Drill[];
}

/**
 * Convierte las evaluaciones amarillas y rojas en hallazgos con ejercicios,
 * ordenadas de más a menos grave y sin repetir ejercicios entre hallazgos.
 */
export function recommend(assessments: Assessment[]): Recommendation[] {
  const order = { red: 0, yellow: 1, green: 2, unknown: 3 };
  const used = new Set<string>();
  return assessments
    .filter((a) => a.light === 'red' || a.light === 'yellow')
    .sort((a, b) => order[a.light] - order[b.light])
    .map((a) => {
      const dir = a.direction ?? 'high';
      const ids = MAP[a.threshold.id]?.[dir] ?? [];
      const drills = ids.filter((id) => !used.has(id)).map((id) => DRILLS[id]);
      drills.forEach((d) => used.add(d.id));
      const finding = dir === 'low' ? a.threshold.lowMeans : a.threshold.highMeans;
      return { assessment: a, finding: finding || a.threshold.description, drills };
    });
}
