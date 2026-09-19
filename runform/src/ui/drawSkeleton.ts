import { LM, SKELETON_CONNECTIONS, type Point } from '../gait/types';

const LEFT_SIDE = new Set<number>([
  LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.LEFT_HIP,
  LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX,
]);

const JOINTS = Array.from(new Set(SKELETON_CONNECTIONS.flat()));

export const SKELETON_COLORS = {
  left: '#ff8a5c',
  right: '#5ad1ff',
  center: '#f2f4f7',
  outline: 'rgba(0, 0, 0, 0.65)',
  event: '#ffd166',
};

export interface DrawOptions {
  minVisibility?: number;
  /** Texto pequeño en la esquina superior izquierda (tiempo, frame, etc.). */
  hud?: string[];
  /** Resalta un pie (índice del tobillo) como evento de contacto. */
  highlightAnkle?: number | null;
}

/**
 * Dibuja el esqueleto sobre un canvas del mismo tamaño que el video.
 * Lado izquierdo del cuerpo en naranja, derecho en azul, tronco en blanco.
 * Cada hueso lleva un contorno oscuro para leerse sobre cualquier fondo.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  height: number,
  opts: DrawOptions = {},
): void {
  const minVis = opts.minVisibility ?? 0.4;
  const scale = Math.max(width, height) / 720;
  const bone = Math.max(3, 5 * scale);
  const outline = bone + Math.max(2, 3 * scale);

  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const px = (p: Point) => [p.x * width, p.y * height] as const;

  // 1. Contorno oscuro de todos los huesos.
  ctx.strokeStyle = SKELETON_COLORS.outline;
  ctx.lineWidth = outline;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    if (points[a].v < minVis || points[b].v < minVis) continue;
    line(ctx, px(points[a]), px(points[b]));
  }

  // 2. Huesos de color con un leve brillo.
  ctx.lineWidth = bone;
  ctx.shadowBlur = 6 * scale;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    if (points[a].v < minVis || points[b].v < minVis) continue;
    const c = colorFor(a, b);
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    line(ctx, px(points[a]), px(points[b]));
  }
  ctx.shadowBlur = 0;

  // 3. Línea del tronco (centro de hombros a centro de caderas).
  const trunk = midline(points, minVis);
  if (trunk) {
    ctx.strokeStyle = SKELETON_COLORS.outline;
    ctx.lineWidth = outline * 0.8;
    line(ctx, trunk[0], trunk[1], width, height);
    ctx.strokeStyle = SKELETON_COLORS.center;
    ctx.lineWidth = bone * 0.8;
    ctx.setLineDash([bone * 2, bone * 1.5]);
    line(ctx, trunk[0], trunk[1], width, height);
    ctx.setLineDash([]);
  }

  // 4. Articulaciones: disco de color con anillo claro.
  const r = Math.max(4, 6 * scale);
  for (const j of JOINTS) {
    const p = points[j];
    if (p.v < minVis) continue;
    const [x, y] = px(p);
    ctx.beginPath();
    ctx.arc(x, y, r + 1.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = SKELETON_COLORS.outline;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = LEFT_SIDE.has(j) ? SKELETON_COLORS.left : SKELETON_COLORS.right;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }

  // 5. Cabeza: círculo centrado en la nariz, radio según distancia entre orejas.
  const nose = points[LM.NOSE];
  const le = points[LM.LEFT_EAR];
  const re = points[LM.RIGHT_EAR];
  if (nose.v >= minVis && (le.v >= minVis || re.v >= minVis)) {
    const ear = le.v >= re.v ? le : re;
    const [nx, ny] = px(nose);
    const [ex, ey] = px(ear);
    const hr = Math.max(Math.hypot(nx - ex, ny - ey) * 1.1, r * 2.5);
    ctx.beginPath();
    ctx.arc((nx + ex) / 2, (ny + ey) / 2, hr, 0, Math.PI * 2);
    ctx.strokeStyle = SKELETON_COLORS.outline;
    ctx.lineWidth = outline * 0.7;
    ctx.stroke();
    ctx.strokeStyle = SKELETON_COLORS.center;
    ctx.lineWidth = bone * 0.7;
    ctx.stroke();
  }

  // 6. Evento de contacto: anillo pulsante en el tobillo.
  if (opts.highlightAnkle != null) {
    const p = points[opts.highlightAnkle];
    if (p && p.v >= minVis) {
      const [x, y] = px(p);
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.strokeStyle = SKELETON_COLORS.event;
      ctx.lineWidth = bone * 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
      ctx.fill();
    }
  }

  // 7. HUD.
  if (opts.hud && opts.hud.length) drawHud(ctx, opts.hud, scale);
}

export function drawLegend(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const scale = Math.max(width, height) / 720;
  const font = Math.round(13 * scale);
  ctx.font = `600 ${font}px system-ui, sans-serif`;
  const items: Array<[string, string]> = [
    ['Izquierdo', SKELETON_COLORS.left],
    ['Derecho', SKELETON_COLORS.right],
    ['Tronco', SKELETON_COLORS.center],
  ];
  const pad = 8 * scale;
  const rowH = font * 1.6;
  const boxW = 120 * scale;
  const boxH = rowH * items.length + pad;
  const x = width - boxW - pad;
  const y = height - boxH - pad;
  roundRect(ctx, x, y, boxW, boxH, 8 * scale, 'rgba(10, 12, 16, 0.6)');
  items.forEach(([label, color], i) => {
    const cy = y + pad / 2 + rowH * i + rowH / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + pad + 5 * scale, cy, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + pad + 16 * scale, cy);
  });
}

function drawHud(ctx: CanvasRenderingContext2D, lines: string[], scale: number) {
  const font = Math.round(14 * scale);
  ctx.font = `600 ${font}px ui-monospace, Consolas, monospace`;
  const pad = 8 * scale;
  const rowH = font * 1.5;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
  const h = rowH * lines.length + pad;
  roundRect(ctx, pad, pad, w, h, 8 * scale, 'rgba(10, 12, 16, 0.65)');
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, pad * 2, pad + pad / 2 + rowH * i + rowH / 2));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(
  ctx: CanvasRenderingContext2D,
  a: readonly [number, number],
  b: readonly [number, number],
  scaleX = 1,
  scaleY = 1,
) {
  ctx.beginPath();
  ctx.moveTo(a[0] * scaleX, a[1] * scaleY);
  ctx.lineTo(b[0] * scaleX, b[1] * scaleY);
  ctx.stroke();
}

/** Devuelve [centroHombros, centroCaderas] en coordenadas normalizadas. */
function midline(points: Point[], minVis: number): [[number, number], [number, number]] | null {
  const ls = points[LM.LEFT_SHOULDER];
  const rs = points[LM.RIGHT_SHOULDER];
  const lh = points[LM.LEFT_HIP];
  const rh = points[LM.RIGHT_HIP];
  if (Math.min(ls.v, rs.v, lh.v, rh.v) < minVis) return null;
  return [
    [(ls.x + rs.x) / 2, (ls.y + rs.y) / 2],
    [(lh.x + rh.x) / 2, (lh.y + rh.y) / 2],
  ];
}

function colorFor(a: number, b: number): string {
  const la = LEFT_SIDE.has(a);
  const lb = LEFT_SIDE.has(b);
  if (la && lb) return SKELETON_COLORS.left;
  if (!la && !lb) return SKELETON_COLORS.right;
  return SKELETON_COLORS.center;
}
