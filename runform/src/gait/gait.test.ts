import { describe, expect, it } from 'vitest';
import { calibrate } from './calibration';
import { detectAllContacts } from './events';
import { computeMetrics } from './metrics';
import { assess, evaluate } from './rules';
import { interpolateGaps, median, percentile, smoothFrames } from './smoothing';
import { LANDMARK_COUNT, LM, type FramePose, type Point } from './types';

const W = 1080;
const H = 1920;

/**
 * Genera una carrera sintética en plano lateral.
 * - cadencia: pasos/min (ambos pies)
 * - gct: fracción del ciclo de paso en apoyo (0..1)
 * - vo: oscilación vertical de cadera en píxeles
 * Las piernas alternan con medio ciclo de desfase.
 */
function syntheticRun(opts: {
  fps: number;
  seconds: number;
  cadence: number;
  gct: number;
  voPx: number;
  legPx?: number;
}): FramePose[] {
  const { fps, seconds, cadence, gct, voPx } = opts;
  const legPx = opts.legPx ?? 900; // cadera-tobillo en px
  const stepPeriod = 60 / cadence; // s por paso
  const stridePeriod = stepPeriod * 2; // s por zancada de un pie
  const groundY = 1700;
  const hipBaseY = groundY - legPx;
  const frames: FramePose[] = [];
  const n = Math.round(seconds * fps);

  for (let i = 0; i < n; i++) {
    const t = i / fps;
    const points: Point[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, v: 1 }));
    // La cadera oscila dos veces por zancada (una por paso), mínimo en apoyo medio.
    const hipY = hipBaseY + (voPx / 2) * -Math.cos((2 * Math.PI * t) / stepPeriod);

    const foot = (phase: number) => {
      // Fase del ciclo de zancada de este pie en [0,1). Apoyo en [0, gct).
      const ph = (((t / stridePeriod + phase) % 1) + 1) % 1;
      if (ph < gct) return { y: groundY, x: 540 + (0.5 - ph / gct) * 200 };
      // Vuelo: el pie sube con una campana.
      const s = (ph - gct) / (1 - gct);
      return { y: groundY - 220 * Math.sin(Math.PI * s), x: 540 + (s - 0.5) * 300 };
    };

    const left = foot(0);
    const right = foot(0.5);
    const set = (idx: number, x: number, y: number) => {
      points[idx] = { x: x / W, y: y / H, z: 0, v: 1 };
    };

    set(LM.LEFT_HIP, 540, hipY);
    set(LM.RIGHT_HIP, 540, hipY);
    set(LM.LEFT_SHOULDER, 560, hipY - 500);
    set(LM.RIGHT_SHOULDER, 560, hipY - 500);
    // Rodilla en el punto medio con algo de flexión para que muslo + pierna = legPx aprox.
    for (const [side, f, hip, knee, ankle, heel, toe] of [
      ['l', left, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
      ['r', right, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
    ] as const) {
      void side;
      void hip;
      const ankleY = f.y - 60;
      // Rodilla en el punto que hace muslo = pierna = legPx / 2 exactamente.
      const half = legPx / 2;
      const hx = 540;
      const d = Math.hypot(f.x - hx, ankleY - hipY);
      const h = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
      const mx = (hx + f.x) / 2;
      const my = (hipY + ankleY) / 2;
      // Perpendicular al segmento cadera-tobillo, hacia delante.
      const nx = (ankleY - hipY) / d;
      const ny = -(f.x - hx) / d;
      set(knee, mx + nx * h, my + ny * h);
      set(ankle, f.x, ankleY);
      set(heel, f.x - 30, f.y);
      set(toe, f.x + 60, f.y);
    }
    frames.push({ t, i, points });
  }
  return frames;
}

describe('smoothing utils', () => {
  it('median y percentile', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([0, 10], 0.5)).toBe(5);
  });

  it('interpolateGaps rellena huecos cortos y respeta los largos', () => {
    const base = syntheticRun({ fps: 30, seconds: 1, cadence: 180, gct: 0.35, voPx: 60 });
    base[5].points = null;
    base[6].points = null;
    for (let k = 15; k < 25; k++) base[k].points = null;
    const out = interpolateGaps(base, 3);
    expect(out[5].points).not.toBeNull();
    expect(out[6].points).not.toBeNull();
    expect(out[20].points).toBeNull();
  });

  it('smoothFrames conserva la longitud y no altera una señal constante', () => {
    const frames: FramePose[] = Array.from({ length: 10 }, (_, i) => ({
      t: i / 30,
      i,
      points: Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.3, y: 0.7, z: 0, v: 1 })),
    }));
    const out = smoothFrames(frames, 2);
    expect(out).toHaveLength(10);
    expect(out[5].points![0].x).toBeCloseTo(0.3, 6);
    expect(out[5].points![0].y).toBeCloseTo(0.7, 6);
  });
});

describe('calibration', () => {
  it('estima píxeles por metro a partir de la estatura', () => {
    const frames = syntheticRun({ fps: 30, seconds: 2, cadence: 180, gct: 0.35, voPx: 60, legPx: 900 });
    const cal = calibrate(frames, W, H, 180);
    expect(cal).not.toBeNull();
    // legPx 900 = 0.491 * estatura_px -> estatura_px = 1833 -> 1833 / 1.80 m
    expect(cal!.pxPerMeter).toBeGreaterThan(950);
    expect(cal!.pxPerMeter).toBeLessThan(1100);
  });
});

describe('detección de eventos y métricas', () => {
  it('recupera cadencia, tiempo de contacto y oscilación vertical en una carrera sintética', () => {
    const fps = 60;
    const cadence = 180; // -> paso 333 ms, zancada 667 ms
    const gct = 0.36; // 36% de la zancada en apoyo -> 240 ms
    const voPx = 80;
    const frames = syntheticRun({ fps, seconds: 12, cadence, gct, voPx, legPx: 900 });

    const contacts = detectAllContacts(frames, W, H, { fps });
    expect(contacts.length).toBeGreaterThan(20);

    const cal = calibrate(frames, W, H, 180)!;
    const m = computeMetrics(frames, contacts, W, H, fps, cal);

    expect(m.cadence.value).toBeGreaterThan(cadence - 4);
    expect(m.cadence.value).toBeLessThan(cadence + 4);

    const expectedGct = gct * ((60 / cadence) * 2) * 1000; // 240 ms
    expect(Math.abs(m.contactTimeMs.value - expectedGct)).toBeLessThan(2.5 * (1000 / fps));

    const expectedVoCm = (voPx / cal.pxPerMeter) * 100;
    expect(Math.abs(m.verticalOscillationCm.value - expectedVoCm)).toBeLessThan(1.5);

    expect(m.contactTimeBySide.left.n).toBeGreaterThan(5);
    expect(m.contactTimeBySide.right.n).toBeGreaterThan(5);
  });

  it('no detecta contactos si el pie no se mueve', () => {
    const frames: FramePose[] = Array.from({ length: 120 }, (_, i) => ({
      t: i / 30,
      i,
      points: Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.8, z: 0, v: 1 })),
    }));
    expect(detectAllContacts(frames, W, H, { fps: 30 })).toHaveLength(0);
  });
});

describe('rules', () => {
  it('asigna semáforo según banda', () => {
    const t = {
      id: 'cadence' as const,
      label: '',
      unit: '',
      decimals: 0,
      group: 'ritmo' as const,
      icon: 'activity',
      planes: ['lateral' as const],
      description: '',
      lowMeans: '',
      highMeans: '',
      minSamples: 3,
      band: { green: [170, 190] as [number, number], yellow: [[160, 170] as [number, number]] },
    };
    expect(evaluate({ value: 175, sd: 0, n: 10 }, t)).toBe('green');
    expect(evaluate({ value: 165, sd: 0, n: 10 }, t)).toBe('yellow');
    expect(evaluate({ value: 150, sd: 0, n: 10 }, t)).toBe('red');
    expect(evaluate({ value: 175, sd: 0, n: 1 }, t)).toBe('unknown');
    expect(evaluate({ value: NaN, sd: 0, n: 10 }, t)).toBe('unknown');
  });

  it('assess devuelve una evaluación por umbral', () => {
    const frames = syntheticRun({ fps: 60, seconds: 10, cadence: 180, gct: 0.36, voPx: 80 });
    const contacts = detectAllContacts(frames, W, H, { fps: 60 });
    const cal = calibrate(frames, W, H, 180);
    const m = computeMetrics(frames, contacts, W, H, 60, cal);
    const a = assess(m);
    const ids = a.map((x) => x.threshold.id);
    expect(ids).toContain('cadence');
    expect(ids).toContain('contactTimeMs');
    expect(ids).toContain('verticalOscillationCm');
    expect(ids).toContain('shinAngleAtStrikeDeg');
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.find((x) => x.threshold.id === 'cadence')!.light).toBe('green');
  });
});
