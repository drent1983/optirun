import { describe, expect, it } from 'vitest';
import {
  armsCrossing,
  classifyFootStrike,
  facingDirection,
  footAngle,
  hipExtension,
  jointAngle,
  kneeAngle,
  kneeCrossover,
  pelvicDrop,
  segmentAngleFromVertical,
  shinAngle,
  trunkLean,
  type FrameGeometry,
} from './angles';
import { recommend } from './drills';
import { assess } from './rules';
import type { GaitMetrics, MetricValue } from './metrics';
import { LANDMARK_COUNT, LM, type FramePose, type Point } from './types';

const W = 1000;
const H = 1000;
const g: FrameGeometry = { width: W, height: H, facing: 1, minVisibility: 0.5 };

function blankPoints(): Point[] {
  return Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0, v: 1 }));
}
function setPx(points: Point[], idx: number, x: number, y: number) {
  points[idx] = { x: x / W, y: y / H, z: 0, v: 1 };
}

describe('geometría básica', () => {
  it('jointAngle: 90° en una escuadra y 180° alineados', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90, 5);
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180, 5);
  });

  it('segmentAngleFromVertical: signo según sentido de la marcha', () => {
    const top = { x: 0, y: 0 };
    const bottomAhead = { x: 10, y: 100 }; // abajo y hacia +x
    expect(segmentAngleFromVertical(top, bottomAhead, 1)).toBeGreaterThan(0);
    expect(segmentAngleFromVertical(top, bottomAhead, -1)).toBeLessThan(0);
    expect(segmentAngleFromVertical(top, { x: 0, y: 100 }, 1)).toBeCloseTo(0, 5);
  });
});

describe('ángulos de carrera', () => {
  it('tronco inclinado hacia delante da valor positivo', () => {
    const p = blankPoints();
    // Caderas en (500,600); hombros 300 px más arriba y 50 px por delante (x mayor, facing +1).
    setPx(p, LM.LEFT_HIP, 500, 600);
    setPx(p, LM.RIGHT_HIP, 500, 600);
    setPx(p, LM.LEFT_SHOULDER, 550, 300);
    setPx(p, LM.RIGHT_SHOULDER, 550, 300);
    const lean = trunkLean(p, g);
    expect(lean).toBeCloseTo(Math.atan2(50, 300) * (180 / Math.PI), 3);
    expect(lean).toBeGreaterThan(0);
  });

  it('rodilla recta = 180, tibia adelantada positiva, extensión de cadera positiva', () => {
    const p = blankPoints();
    setPx(p, LM.LEFT_HIP, 500, 500);
    setPx(p, LM.LEFT_KNEE, 500, 700);
    setPx(p, LM.LEFT_ANKLE, 500, 900);
    expect(kneeAngle(p, 'left', g)).toBeCloseTo(180, 3);
    expect(shinAngle(p, 'left', g)).toBeCloseTo(0, 3);

    // Tobillo 100 px por delante de la rodilla: tibia ~26.6° adelantada.
    setPx(p, LM.LEFT_ANKLE, 600, 900);
    expect(shinAngle(p, 'left', g)).toBeCloseTo(26.57, 1);

    // Rodilla 100 px por detrás de la cadera: extensión ~26.6°.
    setPx(p, LM.LEFT_KNEE, 400, 700);
    expect(hipExtension(p, 'left', g)).toBeCloseTo(26.57, 1);
  });

  it('ángulo del pie: talón, media y antepié', () => {
    const p = blankPoints();
    // Punta 20 px más alta que el talón, pie de 100 px: ~11.3° -> talón.
    setPx(p, LM.LEFT_HEEL, 500, 900);
    setPx(p, LM.LEFT_FOOT_INDEX, 600, 880);
    const heel = footAngle(p, 'left', g);
    expect(heel).toBeGreaterThan(8);
    expect(classifyFootStrike(heel)).toBe('heel');

    setPx(p, LM.LEFT_FOOT_INDEX, 600, 900);
    expect(classifyFootStrike(footAngle(p, 'left', g))).toBe('midfoot');

    setPx(p, LM.LEFT_FOOT_INDEX, 600, 915);
    expect(classifyFootStrike(footAngle(p, 'left', g))).toBe('forefoot');
    expect(classifyFootStrike(NaN)).toBeNull();
  });

  it('facingDirection sigue la dirección talón → punta', () => {
    const mk = (dir: number): FramePose => {
      const p = blankPoints();
      setPx(p, LM.LEFT_HEEL, 500, 900);
      setPx(p, LM.LEFT_FOOT_INDEX, 500 + 80 * dir, 900);
      setPx(p, LM.RIGHT_HEEL, 500, 900);
      setPx(p, LM.RIGHT_FOOT_INDEX, 500 + 80 * dir, 900);
      return { t: 0, i: 0, points: p };
    };
    expect(facingDirection([mk(1), mk(1)])).toBe(1);
    expect(facingDirection([mk(-1), mk(-1)])).toBe(-1);
  });
});

describe('plano frontal', () => {
  it('caída pélvica positiva cuando la cadera en vuelo está más baja', () => {
    const p = blankPoints();
    // Apoyo izquierdo. Cadera izquierda en x=450, derecha en x=550 (100 px de ancho).
    setPx(p, LM.LEFT_HIP, 450, 500);
    setPx(p, LM.RIGHT_HIP, 550, 510); // la derecha (en vuelo) 10 px más baja
    expect(pelvicDrop(p, 'left', g)).toBeCloseTo(Math.atan2(10, 100) * (180 / Math.PI), 3);
    // Con apoyo derecho el signo se invierte.
    expect(pelvicDrop(p, 'right', g)).toBeLessThan(0);
  });

  it('cruce de rodilla positivo cuando la rodilla va hacia la línea media', () => {
    const p = blankPoints();
    setPx(p, LM.LEFT_HIP, 450, 500);
    setPx(p, LM.RIGHT_HIP, 550, 500);
    // Pierna izquierda vertical: cadera y tobillo en x=450.
    setPx(p, LM.LEFT_ANKLE, 450, 900);
    setPx(p, LM.LEFT_KNEE, 450, 700);
    expect(kneeCrossover(p, 'left', g)).toBeCloseTo(0, 5);
    // Rodilla 20 px hacia el centro (x mayor, porque el centro está en 500): +20 %.
    setPx(p, LM.LEFT_KNEE, 470, 700);
    expect(kneeCrossover(p, 'left', g)).toBeCloseTo(20, 3);
    // Rodilla hacia fuera: negativo.
    setPx(p, LM.LEFT_KNEE, 430, 700);
    expect(kneeCrossover(p, 'left', g)).toBeCloseTo(-20, 3);
  });

  it('detecta muñecas que cruzan la línea media', () => {
    const p = blankPoints();
    setPx(p, LM.LEFT_SHOULDER, 400, 300);
    setPx(p, LM.RIGHT_SHOULDER, 600, 300);
    setPx(p, LM.LEFT_WRIST, 380, 500);
    setPx(p, LM.RIGHT_WRIST, 620, 500);
    expect(armsCrossing(p, g)).toBe(false);
    setPx(p, LM.LEFT_WRIST, 540, 500); // cruza al lado derecho
    expect(armsCrossing(p, g)).toBe(true);
    p[LM.LEFT_WRIST].v = 0;
    p[LM.RIGHT_WRIST].v = 0;
    expect(armsCrossing(p, g)).toBeNull();
  });
});

describe('recomendaciones', () => {
  const mv = (value: number, n = 50): MetricValue => ({ value, sd: 0, n });
  const base: GaitMetrics = {
    cadence: mv(178),
    contactTimeMs: mv(230),
    contactTimeBySide: { left: mv(230), right: mv(230) },
    flightTimeMs: mv(110),
    verticalOscillationCm: mv(7),
    trunkLeanDeg: mv(7),
    kneeAngleAtStrikeDeg: mv(160),
    shinAngleAtStrikeDeg: mv(2),
    overstridePct: mv(15),
    hipExtensionDeg: mv(20),
    footAngleAtStrikeDeg: mv(2),
    footStrike: { heel: 0, midfoot: 10, forefoot: 0 },
    elbowAngleDeg: mv(90),
    pelvicDropDeg: { value: NaN, sd: NaN, n: 0 },
    kneeCrossoverPct: { value: NaN, sd: NaN, n: 0 },
    armCrossPct: { value: NaN, sd: NaN, n: 0 },
    nearSide: 'left',
    facing: 1,
    frameMs: 33,
    contacts: 20,
  };

  it('sin desviaciones no hay recomendaciones', () => {
    const a = assess(base);
    expect(a.every((x) => x.light === 'green')).toBe(true);
    expect(recommend(a)).toHaveLength(0);
  });

  it('cadencia baja y tibia adelantada generan ejercicios sin repetir', () => {
    const m: GaitMetrics = { ...base, cadence: mv(155), shinAngleAtStrikeDeg: mv(14) };
    const recs = recommend(assess(m));
    expect(recs.length).toBe(2);
    expect(recs[0].assessment.light).toBe('red');
    const ids = recs.flatMap((r) => r.drills.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('metronome');
  });
});
