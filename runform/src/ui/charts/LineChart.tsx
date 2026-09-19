import { useId, useMemo, useState } from 'react';
import type { MetricSeries, SeriesPoint } from '../../gait/series';

/**
 * Gráfico de línea de una sola serie (una métrica a lo largo de las sesiones).
 * - Banda verde de referencia detrás de la línea.
 * - Línea de 2 px, marcadores de 8 px con anillo de superficie.
 * - Crosshair y tooltip al pasar el ratón. Sin leyenda: el título nombra la serie.
 */
export function LineChart({
  series,
  width = 320,
  height = 150,
  onPointClick,
}: {
  series: MetricSeries;
  width?: number;
  height?: number;
  onPointClick?: (p: SeriesPoint) => void;
}) {
  const { threshold: t, points } = series;
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();

  const pad = { top: 12, right: 14, bottom: 26, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const { y, x, ticks } = useMemo(() => {
    const [g0, g1] = t.band.green;
    const values = points.map((p) => p.value);
    const yellow = t.band.yellow.flat();
    // Dominio: datos + banda verde, con margen.
    const lo0 = Math.min(g0, ...values, ...(values.length ? [] : yellow));
    const hi0 = Math.max(g1 >= 900 ? g0 : g1, ...values, ...(values.length ? [] : yellow));
    const span = hi0 - lo0 || 1;
    const lo = lo0 - span * 0.15;
    const hi = hi0 + span * 0.15;
    const y = (v: number) => pad.top + h - ((v - lo) / (hi - lo)) * h;
    const n = points.length;
    const x = (i: number) => pad.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
    const ticks = niceTicks(lo, hi, 4);
    return { y, x, ticks };
  }, [points, t, h, w, pad.left, pad.top]);

  const [g0, g1] = t.band.green;
  const greenTop = y(g1 >= 900 ? Math.max(g0, ...points.map((p) => p.value)) + 1 : g1);
  const greenBottom = y(g0);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestD = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  }

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart">
      <div className="chart-title">
        <span>{t.label}</span>
        <span className="chart-unit">{t.unit}</span>
      </div>
      {points.length === 0 ? (
        <div className="chart-empty subtle">Sin sesiones con esta métrica</div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart-svg"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`${t.label}: ${points.length} sesiones`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.left} y={pad.top} width={w} height={h} />
            </clipPath>
          </defs>

          {/* Banda verde de referencia */}
          <rect
            x={pad.left}
            y={Math.min(greenTop, greenBottom)}
            width={w}
            height={Math.max(2, Math.abs(greenBottom - greenTop))}
            className="chart-green"
            clipPath={`url(#${clipId})`}
          />

          {/* Grid y eje Y */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} className="chart-grid" />
              <text x={pad.left - 6} y={y(v)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
                {fmtTick(v, t.decimals)}
              </text>
            </g>
          ))}

          {/* Eje X: primera y última fecha */}
          <text x={x(0)} y={height - 8} className="chart-tick" textAnchor={points.length > 1 ? 'start' : 'middle'}>
            {fmtDate(points[0].t)}
          </text>
          {points.length > 1 && (
            <text x={x(points.length - 1)} y={height - 8} className="chart-tick" textAnchor="end">
              {fmtDate(points[points.length - 1].t)}
            </text>
          )}

          {/* Crosshair */}
          {hp && hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} className="chart-crosshair" />
          )}

          {/* Línea */}
          {points.length > 1 && <path d={path} className="chart-line" />}

          {/* Marcadores */}
          {points.map((p, i) => (
            <g
              key={i}
              className={`chart-dot dot-${p.light} ${hover === i ? 'is-hover' : ''}`}
              onClick={() => onPointClick?.(p)}
              style={{ cursor: onPointClick ? 'pointer' : 'default' }}
            >
              <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 4} className="chart-dot-ring" />
              <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 4.5 : 3} className="chart-dot-fill" />
              {/* Área de impacto mayor que el marcador */}
              <circle cx={x(i)} cy={y(p.value)} r={12} fill="transparent" />
            </g>
          ))}

          {/* Etiqueta directa del último valor */}
          {points.length > 0 && hover === null && (
            <text
              x={x(points.length - 1) - 6}
              y={y(points[points.length - 1].value) - 9}
              className="chart-label"
              textAnchor="end"
            >
              {points[points.length - 1].value.toFixed(t.decimals)}
            </text>
          )}
        </svg>
      )}

      {hp && (
        <div className="chart-tooltip">
          <strong>
            {hp.value.toFixed(t.decimals)} {t.unit}
          </strong>
          <span className="subtle">
            {hp.name} · {new Date(hp.t).toLocaleDateString()} · {hp.paceBand} · n={hp.n}
          </span>
        </div>
      )}
    </div>
  );
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function fmtTick(v: number, decimals: number): string {
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(Math.min(decimals, 1));
}

function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}
