import type { Calibration } from '../gait/calibration';
import { recommend } from '../gait/drills';
import type { Contact, SideDiagnostics } from '../gait/events';
import type { GaitMetrics } from '../gait/metrics';
import { assess, GROUPS, type Assessment, type Light } from '../gait/rules';
import type { CameraPlane } from '../gait/types';
import { DrillsPanel } from './DrillsPanel';
import { Icon, type IconName } from './icons';

const LIGHT_LABEL: Record<Light, string> = {
  green: 'Bien',
  yellow: 'Mejorable',
  red: 'Atención',
  unknown: 'Sin datos',
};

export interface MetricsPanelProps {
  metrics: GaitMetrics;
  contacts: Contact[];
  calibration: Calibration | null;
  plane: CameraPlane;
  diagnostics?: SideDiagnostics[];
  /** 'metrics' muestra solo tarjetas; 'drills' solo recomendaciones; 'all' ambas. */
  view?: 'metrics' | 'drills' | 'all';
}

export function MetricsPanel({
  metrics,
  contacts,
  calibration,
  plane,
  diagnostics,
  view = 'all',
}: MetricsPanelProps) {
  const left = contacts.filter((c) => c.side === 'left').length;
  const right = contacts.filter((c) => c.side === 'right').length;
  const items = assess(metrics, plane);
  const recs = recommend(items);

  if (contacts.length < 4) {
    return <NoContacts diagnostics={diagnostics} />;
  }

  const fs = metrics.footStrike;
  const fsTotal = fs.heel + fs.midfoot + fs.forefoot;
  const pct = (n: number) => (fsTotal ? Math.round((n / fsTotal) * 100) : 0);
  const sideName = metrics.nearSide === 'left' ? 'izquierdo' : 'derecho';

  return (
    <div className="metrics">
      {view !== 'drills' && (
        <>
          <Summary items={items} />

          {GROUPS.map((grp) => {
            const list = items.filter((a) => a.threshold.group === grp.id);
            const showStrike = grp.id === 'pisada' && fsTotal > 0 && plane === 'lateral';
            if (list.length === 0 && !showStrike) return null;
            return (
              <section key={grp.id} className="metrics-group">
                <div className="group-head">
                  <div className="ico">
                    <Icon name={grp.icon as IconName} />
                  </div>
                  <h4>
                    {grp.title}
                    <small>{grp.blurb}</small>
                  </h4>
                </div>
                <div className="metrics-grid">
                  {list.map((a) => (
                    <MetricCard key={a.threshold.id} a={a} />
                  ))}
                  {showStrike && (
                    <article className="metric metric-info">
                      <header>
                        <div className="m-ico">
                          <Icon name="footprints" size={16} />
                        </div>
                        <span className="metric-label">Tipo de pisada</span>
                        <span className="pill pill-info">{fsTotal} apoyos</span>
                      </header>
                      <div className="strike-bar" aria-hidden>
                        <span style={{ width: `${pct(fs.heel)}%` }} className="strike-heel" />
                        <span style={{ width: `${pct(fs.midfoot)}%` }} className="strike-mid" />
                        <span style={{ width: `${pct(fs.forefoot)}%` }} className="strike-fore" />
                      </div>
                      <div className="metric-sub">
                        Talón {pct(fs.heel)}% · Media {pct(fs.midfoot)}% · Antepié {pct(fs.forefoot)}%
                      </div>
                      <p className="metric-desc">
                        Reparto de los contactos del lado {sideName}, el más cercano a la cámara.
                      </p>
                    </article>
                  )}
                </div>
              </section>
            );
          })}

          <div className="metrics-footer">
            <span>
              <Icon name="footprints" size={14} /> {contacts.length} apoyos (izq {left}, der {right})
            </span>
            <span>
              <Icon name="ground" size={14} /> Contacto izq/der {fmt(metrics.contactTimeBySide.left.value)} /{' '}
              {fmt(metrics.contactTimeBySide.right.value)} ms
            </span>
            <span>
              <Icon name="timer" size={14} /> ±{metrics.frameMs.toFixed(0)} ms por frame
            </span>
            {plane === 'lateral' && (
              <span>
                <Icon name="eye" size={14} /> Ángulos del lado {sideName}
              </span>
            )}
            <span>
              <Icon name="ruler" size={14} />{' '}
              {calibration ? `${calibration.pxPerMeter.toFixed(0)} px/m` : 'sin calibración'}
            </span>
          </div>
        </>
      )}

      {view !== 'metrics' && (
        <>
          {view === 'all' && (
            <div className="card-head" style={{ marginTop: 22 }}>
              <div className="card-title">
                <div className="ico">
                  <Icon name="trend" />
                </div>
                <h3>Qué mejorar y cómo</h3>
              </div>
            </div>
          )}
          <DrillsPanel recommendations={recs} />
        </>
      )}
    </div>
  );
}

function NoContacts({ diagnostics }: { diagnostics?: SideDiagnostics[] }) {
  return (
    <div className="empty">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Icon name="alert" />
        <strong>No se detectaron suficientes apoyos.</strong>
      </div>
      <p className="muted">
        Se necesitan al menos 4 contactos con el suelo. Comprueba que se ven los pies completos y
        que el tramo dura 15 segundos o más.
      </p>
      {diagnostics && (
        <details>
          <summary>Diagnóstico de la detección</summary>
          <table className="diag">
            <thead>
              <tr>
                <th>Pie</th>
                <th>Frames válidos</th>
                <th>Suelo</th>
                <th>Techo</th>
                <th>Rango</th>
                <th>Tramos</th>
                <th>Duraciones</th>
                <th>Válidos</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.map((d) => (
                <tr key={d.side}>
                  <td>{d.side === 'left' ? 'Izq' : 'Der'}</td>
                  <td>
                    {d.validFrames}/{d.frames}
                  </td>
                  <td>{fmt(d.ground)}</td>
                  <td>{fmt(d.ceiling)}</td>
                  <td>{fmt(d.range)}</td>
                  <td>{d.rawSegments}</td>
                  <td className="mono">{d.rawDurations.slice(0, 30).join(' ')}</td>
                  <td>{d.refinedKept}</td>
                  <td>{d.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function Summary({ items }: { items: Assessment[] }) {
  const count = (l: Light) => items.filter((a) => a.light === l).length;
  return (
    <div className="summary">
      <span className="pill pill-green">
        <Icon name="check" size={12} /> {count('green')} bien
      </span>
      <span className="pill pill-yellow">
        <Icon name="alert" size={12} /> {count('yellow')} mejorable
      </span>
      <span className="pill pill-red">
        <Icon name="alert" size={12} /> {count('red')} atención
      </span>
      {count('unknown') > 0 && (
        <span className="pill">
          <Icon name="info" size={12} /> {count('unknown')} sin datos
        </span>
      )}
    </div>
  );
}

function MetricCard({ a }: { a: Assessment }) {
  const { threshold: t, value, light } = a;
  const [g0, g1] = t.band.green;
  return (
    <article className={`metric metric-${light}`} title={t.description}>
      <header>
        <div className="m-ico">
          <Icon name={t.icon as IconName} size={16} />
        </div>
        <span className="metric-label">{t.label}</span>
        <span className={`pill pill-${light}`}>{LIGHT_LABEL[light]}</span>
      </header>
      <div className="metric-value">
        {Number.isFinite(value.value) ? value.value.toFixed(t.decimals) : '—'}
        <span className="metric-unit">{t.unit}</span>
      </div>
      <RangeBar a={a} />
      <div className="metric-sub">
        {Number.isFinite(value.sd) && value.n > 1
          ? `± ${value.sd.toFixed(t.decimals)} · ${value.n} muestras`
          : `${value.n} muestras`}
        {' · '}objetivo {fmtRange(g0, g1, t.decimals)}
      </div>
    </article>
  );
}

/** Barra con la banda verde y la posición del valor. */
function RangeBar({ a }: { a: Assessment }) {
  const { threshold: t, value } = a;
  const [g0, g1] = t.band.green;
  const all = [g0, g1, ...t.band.yellow.flat()];
  const span = Math.max(...all) - Math.min(...all) || 1;
  const lo = Math.min(...all) - span * 0.25;
  const hi = Math.max(...all) + span * 0.25;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="range-bar" aria-hidden>
      <span className="green" style={{ left: pos(g0), width: `calc(${pos(g1)} - ${pos(g0)})` }} />
      {Number.isFinite(value.value) && <span className="marker" style={{ left: pos(value.value) }} />}
    </div>
  );
}

function fmtRange(a: number, b: number, d: number): string {
  if (b >= 900) return `≥ ${a.toFixed(d)}`;
  if (a <= 0 && b > 0 && a === 0) return `≤ ${b.toFixed(d)}`;
  return `${a.toFixed(d)} a ${b.toFixed(d)}`;
}

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(0) : '—';
}
