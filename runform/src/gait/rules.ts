import type { GaitMetrics, MetricValue } from './metrics';
import type { CameraPlane } from './types';

export type Light = 'green' | 'yellow' | 'red' | 'unknown';

/** Claves de GaitMetrics cuyo valor es un MetricValue. */
export type MetricKey = {
  [K in keyof GaitMetrics]: GaitMetrics[K] extends MetricValue ? K : never;
}[keyof GaitMetrics];

export interface Band {
  /** Intervalo [min, max] inclusivo para verde. */
  green: [number, number];
  /** Intervalos amarillos. Lo que no cae en verde ni amarillo es rojo. */
  yellow: Array<[number, number]>;
}

export type MetricGroup = 'ritmo' | 'pisada' | 'postura' | 'brazos' | 'frontal';

export interface GroupInfo {
  id: MetricGroup;
  title: string;
  icon: string;
  blurb: string;
}

export const GROUPS: GroupInfo[] = [
  { id: 'ritmo', title: 'Ritmo y rebote', icon: 'gauge', blurb: 'Cadencia, tiempos de contacto y vuelo, oscilación vertical.' },
  { id: 'pisada', title: 'Pisada y contacto', icon: 'footprints', blurb: 'Cómo y dónde aterriza el pie respecto al cuerpo.' },
  { id: 'postura', title: 'Postura', icon: 'person', blurb: 'Inclinación del tronco y extensión de cadera.' },
  { id: 'brazos', title: 'Brazos', icon: 'arm', blurb: 'Ángulo de codo y braceo.' },
  { id: 'frontal', title: 'Alineación frontal', icon: 'frontal', blurb: 'Caída pélvica y cruce de rodillas, desde el plano frontal.' },
];

export interface Threshold {
  id: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  group: MetricGroup;
  icon: string;
  /** Planos de cámara en los que la métrica es válida. */
  planes: CameraPlane[];
  description: string;
  /** Qué significa un valor alto y uno bajo, para el informe. */
  lowMeans: string;
  highMeans: string;
  band: Band;
  /** Mínimo de muestras para dar semáforo. */
  minSamples: number;
}

/**
 * Umbrales orientativos para ritmos de rodaje (4:30-6:00 min/km).
 * Referencias: Souza 2016, Folland 2017, Moore 2016. Ajustar con datos propios.
 */
export const THRESHOLDS: Threshold[] = [
  {
    id: 'cadence',
    label: 'Cadencia',
    unit: 'ppm',
    decimals: 0,
    group: 'ritmo',
    icon: 'activity',
    planes: ['lateral', 'frontal'],
    description: 'Pasos por minuto contando ambos pies.',
    lowMeans: 'Cadencia baja: zancadas largas y más tiempo en el aire y en el suelo.',
    highMeans: 'Cadencia muy alta para este ritmo: pasos cortos poco eficientes.',
    band: { green: [170, 190], yellow: [[160, 170], [190, 200]] },
    minSamples: 6,
  },
  {
    id: 'contactTimeMs',
    label: 'Tiempo de contacto',
    unit: 'ms',
    decimals: 0,
    group: 'ritmo',
    icon: 'ground',
    planes: ['lateral', 'frontal'],
    description: 'Tiempo que el pie está en el suelo en cada paso.',
    lowMeans: '',
    highMeans: 'Contacto largo: el pie frena y empuja durante demasiado tiempo.',
    band: { green: [0, 240], yellow: [[240, 280]] },
    minSamples: 6,
  },
  {
    id: 'flightTimeMs',
    label: 'Tiempo de vuelo',
    unit: 'ms',
    decimals: 0,
    group: 'ritmo',
    icon: 'wind',
    planes: ['lateral', 'frontal'],
    description: 'Tiempo sin ningún pie en el suelo entre pasos.',
    lowMeans: 'Vuelo muy corto: carrera arrastrada, poca elasticidad.',
    highMeans: 'Vuelo largo: probablemente saltas demasiado en cada paso.',
    band: { green: [80, 160], yellow: [[50, 80], [160, 200]] },
    minSamples: 6,
  },
  {
    id: 'verticalOscillationCm',
    label: 'Oscilación vertical',
    unit: 'cm',
    decimals: 1,
    group: 'ritmo',
    icon: 'wave',
    planes: ['lateral', 'frontal'],
    description: 'Cuánto sube y baja el centro de caderas en cada paso.',
    lowMeans: '',
    highMeans: 'Oscilación alta: gastas energía en subir y bajar en vez de avanzar.',
    band: { green: [0, 8], yellow: [[8, 10]] },
    minSamples: 6,
  },
  {
    id: 'trunkLeanDeg',
    label: 'Inclinación de tronco',
    unit: '°',
    decimals: 1,
    group: 'postura',
    icon: 'lean',
    planes: ['lateral'],
    description: 'Inclinación del tronco hacia delante respecto a la vertical.',
    lowMeans: 'Tronco vertical o hacia atrás: el pie tiende a aterrizar adelantado.',
    highMeans: 'Tronco muy inclinado: probablemente desde la cintura, no desde el tobillo.',
    band: { green: [4, 12], yellow: [[0, 4], [12, 16]] },
    minSamples: 30,
  },
  {
    id: 'hipExtensionDeg',
    label: 'Extensión de cadera',
    unit: '°',
    decimals: 1,
    group: 'postura',
    icon: 'hip',
    planes: ['lateral'],
    description: 'Cuánto queda el muslo por detrás de la vertical en el despegue.',
    lowMeans: 'Poca extensión: empujas poco hacia atrás y compensas adelantando el pie.',
    highMeans: '',
    band: { green: [15, 40], yellow: [[10, 15]] },
    minSamples: 4,
  },
  {
    id: 'kneeAngleAtStrikeDeg',
    label: 'Rodilla al contacto',
    unit: '°',
    decimals: 0,
    group: 'pisada',
    icon: 'knee',
    planes: ['lateral'],
    description: 'Ángulo de la rodilla cuando el pie toca el suelo. 180 es la pierna recta.',
    lowMeans: 'Rodilla muy flexionada al contacto: aterrizaje "sentado".',
    highMeans: 'Rodilla casi recta al contacto: la pierna llega rígida y frena.',
    band: { green: [150, 170], yellow: [[140, 150], [170, 175]] },
    minSamples: 4,
  },
  {
    id: 'shinAngleAtStrikeDeg',
    label: 'Tibia al contacto',
    unit: '°',
    decimals: 1,
    group: 'pisada',
    icon: 'shin',
    planes: ['lateral'],
    description: 'Inclinación de la tibia al contacto. Positivo = tobillo por delante de la rodilla.',
    lowMeans: 'Tobillo por detrás de la rodilla al contacto: poco frecuente, revisa la detección.',
    highMeans: 'Tibia adelantada: overstriding, el pie aterriza lejos del cuerpo y frena.',
    band: { green: [-6, 6], yellow: [[6, 12], [-10, -6]] },
    minSamples: 4,
  },
  {
    id: 'overstridePct',
    label: 'Pie adelantado',
    unit: '% pierna',
    decimals: 0,
    group: 'pisada',
    icon: 'stride',
    planes: ['lateral'],
    description: 'Distancia del tobillo por delante de la cadera al contacto, en % de la longitud de pierna.',
    lowMeans: '',
    highMeans: 'El pie aterriza muy por delante del centro de masas.',
    band: { green: [0, 22], yellow: [[22, 30], [-10, 0]] },
    minSamples: 4,
  },
  {
    id: 'footAngleAtStrikeDeg',
    label: 'Ángulo del pie',
    unit: '°',
    decimals: 1,
    group: 'pisada',
    icon: 'foot',
    planes: ['lateral'],
    description: 'Positivo = talón primero, negativo = antepié primero, cerca de cero = pisada media.',
    lowMeans: 'Antepié marcado: mucha carga en gemelo y aquiles.',
    highMeans: 'Talón muy marcado: suele ir con tibia adelantada y frenado.',
    band: { green: [-8, 10], yellow: [[10, 20], [-14, -8]] },
    minSamples: 4,
  },
  {
    id: 'elbowAngleDeg',
    label: 'Ángulo de codo',
    unit: '°',
    decimals: 0,
    group: 'brazos',
    icon: 'elbow',
    planes: ['lateral'],
    description: 'Ángulo medio del codo del brazo cercano a la cámara.',
    lowMeans: 'Codo muy cerrado: hombros tensos y braceo corto.',
    highMeans: 'Brazo muy extendido: braceo largo que cuesta energía.',
    band: { green: [75, 105], yellow: [[65, 75], [105, 120]] },
    minSamples: 30,
  },
  {
    id: 'pelvicDropDeg',
    label: 'Caída pélvica',
    unit: '°',
    decimals: 1,
    group: 'frontal',
    icon: 'pelvis',
    planes: ['frontal'],
    description: 'Inclinación de la línea de caderas en el apoyo medio. Positivo = la cadera del lado en vuelo cae.',
    lowMeans: 'Cadera del lado en vuelo más alta que la de apoyo: poco habitual, revisa la detección.',
    highMeans: 'Caída pélvica marcada: glúteo medio débil o poco activo en el apoyo.',
    band: { green: [-3, 5], yellow: [[5, 8], [-6, -3]] },
    minSamples: 4,
  },
  {
    id: 'kneeCrossoverPct',
    label: 'Cruce de rodilla',
    unit: '% caderas',
    decimals: 0,
    group: 'frontal',
    icon: 'crossover',
    planes: ['frontal'],
    description: 'Cuánto se desplaza la rodilla hacia la línea media respecto a la línea cadera-tobillo, en el apoyo medio.',
    lowMeans: 'Rodilla hacia fuera (varo dinámico).',
    highMeans: 'Rodilla hacia dentro (valgo dinámico): sobrecarga de rodilla y cadera.',
    band: { green: [-8, 12], yellow: [[12, 20], [-15, -8]] },
    minSamples: 4,
  },
  {
    id: 'armCrossPct',
    label: 'Cruce de brazos',
    unit: '% frames',
    decimals: 0,
    group: 'frontal',
    icon: 'arm',
    planes: ['frontal'],
    description: 'Porcentaje de frames en los que alguna muñeca cruza la línea media del cuerpo.',
    lowMeans: '',
    highMeans: 'Braceo cruzado: genera rotación de tronco que las piernas deben compensar.',
    band: { green: [0, 10], yellow: [[10, 25]] },
    minSamples: 30,
  },
];

export function evaluate(value: MetricValue, t: Threshold): Light {
  if (!Number.isFinite(value.value) || value.n < t.minSamples) return 'unknown';
  const v = value.value;
  const inRange = ([a, b]: [number, number]) => v >= a && v <= b;
  if (inRange(t.band.green)) return 'green';
  if (t.band.yellow.some(inRange)) return 'yellow';
  return 'red';
}

/** Indica si el valor está por debajo o por encima de la banda verde. */
export function direction(value: MetricValue, t: Threshold): 'low' | 'high' | null {
  if (!Number.isFinite(value.value)) return null;
  if (value.value < t.band.green[0]) return 'low';
  if (value.value > t.band.green[1]) return 'high';
  return null;
}

export interface Assessment {
  threshold: Threshold;
  value: MetricValue;
  light: Light;
  direction: 'low' | 'high' | null;
}

export function assess(metrics: GaitMetrics, plane: CameraPlane = 'lateral'): Assessment[] {
  return THRESHOLDS.filter((t) => t.planes.includes(plane)).map((t) => {
    const value = metrics[t.id];
    return { threshold: t, value, light: evaluate(value, t), direction: direction(value, t) };
  });
}
