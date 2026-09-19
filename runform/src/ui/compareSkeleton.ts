import type { Contact } from '../gait/events';
import { LM, SKELETON_CONNECTIONS, type FramePose, type Point } from '../gait/types';

export interface SkeletonSource {
  frames: FramePose[];
  contacts: Contact[];
  width: number;
  height: number;
  /** Longitud de pierna en píxeles, para normalizar la escala entre sesiones. */
  legLengthPx: number | null;
  /** +1 si mira a la derecha. Se espeja para que ambas sesiones miren igual. */
  facing: 1 | -1;
}

export type Phase = 'strike' | 'midstance' | 'toeoff';

/** Frame representativo: mediana de los contactos del lado indicado en la fase pedida. */
export function representativeFrame(src: SkeletonSource, phase: Phase, side: 'left' | 'right'): Point[] | null {
  const cs = src.contacts.filter((c) => c.side === side);
  if (cs.length === 0) return null;
  const c = cs[Math.floor(cs.length / 2)];
  const idx =
    phase === 'strike' ? c.strike : phase === 'toeoff' ? c.toeOff - 1 : Math.floor((c.strike + c.toeOff) / 2);
  return src.frames[Math.max(0, Math.min(src.frames.length - 1, idx))]?.points ?? null;
}

/**
 * Convierte una pose a coordenadas normalizadas: origen en el centro de caderas,
 * escala en longitudes de pierna, mirando hacia +x. Devuelve puntos en "unidades
 * de pierna" (x hacia delante, y hacia abajo).
 */
export function normalizePose(points: Point[], src: SkeletonSource): Array<{ x: number; y: number; v: number }> {
  const lh = points[LM.LEFT_HIP];
  const rh = points[LM.RIGHT_HIP];
  const cx = ((lh.x + rh.x) / 2) * src.width;
  const cy = ((lh.y + rh.y) / 2) * src.height;
  const fallbackLeg = Math.hypot(
    (points[LM.LEFT_HIP].x - points[LM.LEFT_ANKLE].x) * src.width,
    (points[LM.LEFT_HIP].y - points[LM.LEFT_ANKLE].y) * src.height,
  );
  const leg = src.legLengthPx ?? (fallbackLeg || 1);
  return points.map((p) => ({
    x: ((p.x * src.width - cx) * src.facing) / leg,
    y: (p.y * src.height - cy) / leg,
    v: p.v,
  }));
}

/**
 * Dibuja dos esqueletos normalizados superpuestos en un canvas cuadrado.
 * A en azul, B en naranja (misma pareja validada que en los gráficos).
 */
export function drawComparison(
  ctx: CanvasRenderingContext2D,
  size: number,
  a: Array<{ x: number; y: number; v: number }> | null,
  b: Array<{ x: number; y: number; v: number }> | null,
  colors: { a: string; b: string; grid: string },
  minVisibility = 0.4,
): void {
  ctx.clearRect(0, 0, size, size);
  // 1 longitud de pierna = size / 3.2 píxeles; caderas a 40 % de la altura.
  const scale = size / 3.2;
  const ox = size / 2;
  const oy = size * 0.42;

  // Suelo aproximado y eje vertical.
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(ox, 8);
  ctx.lineTo(ox, size - 8);
  ctx.stroke();
  ctx.setLineDash([]);

  const draw = (pts: Array<{ x: number; y: number; v: number }>, color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const p = pts[i];
      const q = pts[j];
      if (p.v < minVisibility || q.v < minVisibility) continue;
      ctx.beginPath();
      ctx.moveTo(ox + p.x * scale, oy + p.y * scale);
      ctx.lineTo(ox + q.x * scale, oy + q.y * scale);
      ctx.stroke();
    }
    for (const [i] of SKELETON_CONNECTIONS) {
      const p = pts[i];
      if (p.v < minVisibility) continue;
      ctx.beginPath();
      ctx.arc(ox + p.x * scale, oy + p.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  if (a) draw(a, colors.a, 0.9);
  if (b) draw(b, colors.b, 0.9);
}
