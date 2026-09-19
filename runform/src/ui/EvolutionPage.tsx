import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GROUPS, THRESHOLDS, type Light } from '../gait/rules';
import { buildSeries, compareSessions, type SessionLike } from '../gait/series';
import { formatPace, type CameraPlane, type PaceBand } from '../gait/types';
import { db, type Session } from '../store/db';
import { LineChart } from './charts/LineChart';
import { drawComparison, normalizePose, representativeFrame, type Phase } from './compareSkeleton';
import { Icon, type IconName } from './icons';

const BANDS: Array<PaceBand | 'all'> = ['all', '<4:00', '4:00-4:45', '4:45-5:30', '5:30-6:15', '>6:15'];

const LIGHT_LABEL: Record<Light, string> = {
  green: 'Bien',
  yellow: 'Mejorable',
  red: 'Atención',
  unknown: 'Sin datos',
};

function toLike(s: Session): SessionLike {
  return {
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    plane: s.plane,
    paceBand: s.paceBand,
    paceSecPerKm: s.paceSecPerKm,
    metrics: s.analysis ? (s.analysis.metrics as unknown as Record<string, unknown>) : null,
  };
}

export function EvolutionPage({ onNavigate }: { onNavigate?: (p: 'analyze') => void }) {
  const sessions = useLiveQuery(() => db.sessions.orderBy('createdAt').toArray(), []);
  const [plane, setPlane] = useState<CameraPlane>('lateral');
  const [band, setBand] = useState<PaceBand | 'all'>('all');
  const [tableView, setTableView] = useState(false);
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);

  const withAnalysis = useMemo(() => (sessions ?? []).filter((s) => s.analysis), [sessions]);
  const likes = useMemo(() => withAnalysis.map(toLike), [withAnalysis]);
  const series = useMemo(() => buildSeries(likes, THRESHOLDS, plane, band), [likes, plane, band]);
  const inPlane = withAnalysis.filter((s) => s.plane === plane);
  const sessionCount = new Set(series.flatMap((s) => s.points.map((p) => p.sessionId))).size;

  // Selección efectiva para comparar: la elegida si sigue existiendo en este
  // plano, si no las dos últimas. Se deriva en render, sin efectos.
  const effectiveA = inPlane.some((s) => s.id === aId) ? aId : inPlane[inPlane.length - 2]?.id ?? null;
  const effectiveB = inPlane.some((s) => s.id === bId) ? bId : inPlane[inPlane.length - 1]?.id ?? null;
  const a = inPlane.find((s) => s.id === effectiveA) ?? null;
  const b = inPlane.find((s) => s.id === effectiveB) ?? null;

  if (!sessions) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Evolución</h1>
          <p>Cómo cambian tus métricas entre sesiones. Compara solo ritmos parecidos.</p>
        </div>
      </div>

      {withAnalysis.length === 0 ? (
        <div className="card">
          <div className="empty center">
            <div className="ico">
              <Icon name="chart" size={22} />
            </div>
            <strong>Todavía no hay sesiones analizadas</strong>
            <p className="muted">Guarda al menos dos sesiones para ver la evolución.</p>
            {onNavigate && (
              <button className="btn btn-primary" onClick={() => onNavigate('analyze')}>
                <Icon name="video" size={16} /> Ir a Analizar
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="filters">
              <label className="field">
                Plano
                <select value={plane} onChange={(e) => setPlane(e.target.value as CameraPlane)}>
                  <option value="lateral">Lateral</option>
                  <option value="frontal">Frontal</option>
                </select>
              </label>
              <label className="field">
                Banda de ritmo
                <select value={band} onChange={(e) => setBand(e.target.value as PaceBand | 'all')}>
                  {BANDS.map((bnd) => (
                    <option key={bnd} value={bnd}>
                      {bnd === 'all' ? 'Todas' : `${bnd} min/km`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="filters-right">
                <span className="pill">
                  <Icon name="list" size={12} /> {sessionCount} sesiones
                </span>
                <label className="toggle">
                  <input type="checkbox" checked={tableView} onChange={(e) => setTableView(e.target.checked)} />
                  <Icon name="list" size={14} /> Ver como tabla
                </label>
              </div>
            </div>

            {band === 'all' && sessionCount > 1 && (
              <p className="hint">
                <Icon name="info" size={14} /> Estás mezclando ritmos. La cadencia y el tiempo de contacto
                cambian con la velocidad: filtra por banda para comparar de verdad.
              </p>
            )}
          </section>

          {GROUPS.map((grp) => {
            const list = series.filter((s) => s.threshold.group === grp.id);
            if (list.length === 0) return null;
            return (
              <section key={grp.id} className="card">
                <div className="group-head">
                  <div className="ico">
                    <Icon name={grp.icon as IconName} />
                  </div>
                  <h4>
                    {grp.title}
                    <small>{grp.blurb}</small>
                  </h4>
                </div>

                {tableView ? (
                  <SeriesTable list={list} />
                ) : (
                  <div className="charts-grid">
                    {list.map((s) => (
                      <LineChart key={s.threshold.id} series={s} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <section className="card">
            <div className="card-head">
              <div className="card-title">
                <div className="ico">
                  <Icon name="compare" />
                </div>
                <div>
                  <h2>Comparar dos sesiones</h2>
                  <small className="muted">Métrica a métrica y esqueleto superpuesto en el contacto.</small>
                </div>
              </div>
            </div>

            {inPlane.length < 2 ? (
              <p className="muted">Necesitas al menos dos sesiones en plano {plane}.</p>
            ) : (
              <>
                <div className="filters">
                  <label className="field">
                    <span className="swatch swatch-a" /> Sesión A
                    <select value={effectiveA ?? ''} onChange={(e) => setAId(Number(e.target.value))}>
                      {inPlane.map((s) => (
                        <option key={s.id} value={s.id}>
                          {sessionLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="swatch swatch-b" /> Sesión B
                    <select value={effectiveB ?? ''} onChange={(e) => setBId(Number(e.target.value))}>
                      {inPlane.map((s) => (
                        <option key={s.id} value={s.id}>
                          {sessionLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {a && b && a.paceBand !== b.paceBand && (
                  <p className="hint">
                    <Icon name="alert" size={14} /> Las dos sesiones están en bandas de ritmo distintas (
                    {a.paceBand} y {b.paceBand}). Las diferencias pueden deberse a la velocidad.
                  </p>
                )}

                {a && b && (
                  <div className="compare-layout">
                    <CompareTable a={a} b={b} />
                    <SkeletonCompare a={a} b={b} />
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

function sessionLabel(s: Session): string {
  return `${s.name} · ${new Date(s.createdAt).toLocaleDateString()} · ${formatPace(s.paceSecPerKm)}`;
}

function SeriesTable({ list }: { list: ReturnType<typeof buildSeries> }) {
  const sessions = list[0]?.points.map((p) => ({ id: p.sessionId, name: p.name, t: p.t })) ?? [];
  // Unión de sesiones presentes en cualquier serie del grupo.
  const all = new Map<number | undefined, { name: string; t: number }>();
  for (const s of list) for (const p of s.points) all.set(p.sessionId, { name: p.name, t: p.t });
  const cols = [...all.entries()].sort((x, y) => x[1].t - y[1].t);
  void sessions;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            {cols.map(([id, c]) => (
              <th key={String(id)}>
                {c.name}
                <br />
                <span className="subtle">{new Date(c.t).toLocaleDateString()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.threshold.id}>
              <td>
                <strong style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Icon name={s.threshold.icon as IconName} size={14} /> {s.threshold.label}
                </strong>
                <span className="subtle"> {s.threshold.unit}</span>
              </td>
              {cols.map(([id]) => {
                const p = s.points.find((q) => q.sessionId === id);
                return (
                  <td key={String(id)}>
                    {p ? (
                      <span className={`pill pill-${p.light}`} title={LIGHT_LABEL[p.light]}>
                        {p.value.toFixed(s.threshold.decimals)}
                      </span>
                    ) : (
                      <span className="subtle">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ a, b }: { a: Session; b: Session }) {
  const deltas = compareSessions(toLike(a), toLike(b), THRESHOLDS);
  const improved = deltas.filter((d) => d.improved === true).length;
  const worse = deltas.filter((d) => d.improved === false).length;
  return (
    <div>
      <div className="summary">
        <span className="pill pill-green">
          <Icon name="trend" size={12} /> {improved} mejoran
        </span>
        <span className="pill pill-red">
          <Icon name="alert" size={12} /> {worse} empeoran
        </span>
        <span className="pill">{deltas.length - improved - worse} igual o sin datos</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            <th>
              <span className="swatch swatch-a" /> A
            </th>
            <th>
              <span className="swatch swatch-b" /> B
            </th>
            <th>Cambio</th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => {
            const t = d.threshold;
            const fa = d.a && Number.isFinite(d.a.value) ? d.a.value.toFixed(t.decimals) : '—';
            const fb = d.b && Number.isFinite(d.b.value) ? d.b.value.toFixed(t.decimals) : '—';
            const cls = d.improved === true ? 'ok' : d.improved === false ? 'error' : 'subtle';
            return (
              <tr key={t.id}>
                <td>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <Icon name={t.icon as IconName} size={14} /> {t.label}
                    <span className="subtle">{t.unit}</span>
                  </span>
                </td>
                <td>
                  <span className={`pill pill-${d.lightA}`}>{fa}</span>
                </td>
                <td>
                  <span className={`pill pill-${d.lightB}`}>{fb}</span>
                </td>
                <td className={cls}>
                  {Number.isFinite(d.diff) ? (
                    <>
                      {d.diff > 0 ? '+' : ''}
                      {d.diff.toFixed(t.decimals)}
                      {d.improved === true && <Icon name="check" size={12} style={{ marginLeft: 4 }} />}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonCompare({ a, b }: { a: Session; b: Session }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('strike');
  const size = 320;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !a.analysis || !b.analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const colors = {
      a: css.getPropertyValue('--series-a').trim() || '#2a78d6',
      b: css.getPropertyValue('--series-b').trim() || '#eb6834',
      grid: css.getPropertyValue('--border-strong').trim() || '#ccc',
    };
    const src = (s: Session) => ({
      frames: s.frames,
      contacts: s.analysis!.contacts,
      width: s.videoWidth,
      height: s.videoHeight,
      legLengthPx: s.analysis!.calibration?.legLengthPx ?? null,
      facing: s.analysis!.metrics.facing ?? 1,
    });
    const sa = src(a);
    const sb = src(b);
    const side = a.analysis.metrics.nearSide ?? 'left';
    const fa = representativeFrame(sa, phase, side);
    const fb = representativeFrame(sb, phase, b.analysis.metrics.nearSide ?? side);
    drawComparison(
      ctx,
      size,
      fa ? normalizePose(fa, sa) : null,
      fb ? normalizePose(fb, sb) : null,
      colors,
    );
  }, [a, b, phase]);

  return (
    <div className="skeleton-compare">
      <div className="tabs" style={{ margin: '0 0 10px' }}>
        {(
          [
            ['strike', 'Contacto'],
            ['midstance', 'Apoyo medio'],
            ['toeoff', 'Despegue'],
          ] as Array<[Phase, string]>
        ).map(([p, label]) => (
          <button key={p} className="tab" role="tab" aria-selected={phase === p} onClick={() => setPhase(p)}>
            {label}
          </button>
        ))}
      </div>
      <canvas ref={ref} width={size} height={size} className="compare-canvas" />
      <div className="legend">
        <span>
          <span className="swatch swatch-a" /> {a.name}
        </span>
        <span>
          <span className="swatch swatch-b" /> {b.name}
        </span>
      </div>
      <p className="subtle" style={{ fontSize: '0.78rem' }}>
        Esqueletos normalizados por longitud de pierna, centrados en la cadera y orientados hacia la derecha.
      </p>
    </div>
  );
}
