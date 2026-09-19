import { useLiveQuery } from 'dexie-react-hooks';
import { recommend } from '../gait/drills';
import { assess, THRESHOLDS, type Light } from '../gait/rules';
import { compareSessions, type SessionLike } from '../gait/series';
import { formatPace } from '../gait/types';
import { db, type Session } from '../store/db';
import { Icon, type IconName } from './icons';

export type NavTarget = 'analyze' | 'sessions' | 'evolution' | 'guide';

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

const KEY_METRICS = ['cadence', 'contactTimeMs', 'verticalOscillationCm'] as const;

export function HomePage({ onNavigate }: { onNavigate: (p: NavTarget) => void }) {
  const sessions = useLiveQuery(() => db.sessions.orderBy('createdAt').toArray(), []);
  if (!sessions) return null;

  const analyzed = sessions.filter((s) => s.analysis);
  const last = analyzed[analyzed.length - 1] ?? null;
  const previous = last
    ? [...analyzed]
        .reverse()
        .find((s) => s.id !== last.id && s.plane === last.plane && s.paceBand === last.paceBand) ?? null
    : null;

  const items = last ? assess(last.analysis!.metrics, last.plane) : [];
  const recs = last ? recommend(items) : [];
  const count = (l: Light) => items.filter((a) => a.light === l).length;

  const deltas = last && previous ? compareSessions(toLike(previous), toLike(last), THRESHOLDS) : [];
  const improved = deltas.filter((d) => d.improved === true);
  const worse = deltas.filter((d) => d.improved === false);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inicio</h1>
          <p>{greeting()}. Resumen de tu técnica y accesos rápidos.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('analyze')}>
          <Icon name="video" size={16} /> Nuevo análisis
        </button>
      </div>

      {!last ? (
        <section className="card anim-up">
          <div className="empty center">
            <div className="ico">
              <Icon name="upload" size={22} />
            </div>
            <strong>Empieza con tu primer video</strong>
            <p className="muted">
              Graba 15 a 20 segundos de carrera de lado, súbelo y obtén métricas, semáforo y ejercicios.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn btn-primary" onClick={() => onNavigate('analyze')}>
                <Icon name="play" size={16} /> Analizar un video
              </button>
              <button className="btn btn-ghost" onClick={() => onNavigate('guide')}>
                <Icon name="book" size={16} /> Cómo grabar
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="home-grid">
            <section className="card anim-up">
              <div className="card-head">
                <div className="card-title">
                  <div className="ico">
                    <Icon name="activity" />
                  </div>
                  <div>
                    <h2>Última sesión</h2>
                    <small className="muted">
                      {last.name} · {new Date(last.createdAt).toLocaleDateString()} · {last.plane} ·{' '}
                      {formatPace(last.paceSecPerKm)} min/km
                    </small>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => onNavigate('sessions')}>
                  Ver todas
                </button>
              </div>

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
              </div>

              <div className="metrics-grid">
                {KEY_METRICS.map((id, i) => {
                  const a = items.find((x) => x.threshold.id === id);
                  if (!a) return null;
                  const t = a.threshold;
                  return (
                    <article key={id} className={`metric metric-${a.light} anim-up`} style={{ animationDelay: `${i * 60}ms` }}>
                      <header>
                        <div className="m-ico">
                          <Icon name={t.icon as IconName} size={16} />
                        </div>
                        <span className="metric-label">{t.label}</span>
                      </header>
                      <div className="metric-value">
                        {Number.isFinite(a.value.value) ? a.value.value.toFixed(t.decimals) : '—'}
                        <span className="metric-unit">{t.unit}</span>
                      </div>
                      <div className="metric-sub">
                        objetivo {t.band.green[0]} a {t.band.green[1] >= 900 ? '∞' : t.band.green[1]}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="card anim-up" style={{ animationDelay: '80ms' }}>
              <div className="card-head">
                <div className="card-title">
                  <div className="ico">
                    <Icon name="trend" />
                  </div>
                  <div>
                    <h2>Respecto a la anterior</h2>
                    <small className="muted">
                      {previous
                        ? `Comparado con ${previous.name} (${new Date(previous.createdAt).toLocaleDateString()}), mismo plano y ritmo`
                        : 'Aún no hay otra sesión del mismo plano y banda de ritmo'}
                    </small>
                  </div>
                </div>
                {previous && (
                  <button className="btn btn-ghost" onClick={() => onNavigate('evolution')}>
                    Evolución
                  </button>
                )}
              </div>

              {previous ? (
                <ul className="delta-list">
                  {[...improved.slice(0, 3), ...worse.slice(0, 2)].map((d) => (
                    <li key={d.threshold.id} className={d.improved ? 'ok' : 'error'}>
                      <Icon name={d.threshold.icon as IconName} size={15} />
                      <span className="delta-label">{d.threshold.label}</span>
                      <span className="delta-value">
                        {d.diff > 0 ? '+' : ''}
                        {d.diff.toFixed(d.threshold.decimals)} {d.threshold.unit}
                      </span>
                      <span className={`pill pill-${d.improved ? 'green' : 'red'}`}>
                        {d.improved ? 'mejora' : 'empeora'}
                      </span>
                    </li>
                  ))}
                  {improved.length === 0 && worse.length === 0 && (
                    <li className="subtle">Sin cambios relevantes entre las dos sesiones.</li>
                  )}
                </ul>
              ) : (
                <div className="empty">
                  <p className="muted">
                    Graba otro tramo a un ritmo parecido y guárdalo para ver qué ha cambiado.
                  </p>
                  <button className="btn btn-ghost" onClick={() => onNavigate('analyze')} style={{ width: 'fit-content' }}>
                    <Icon name="video" size={16} /> Analizar otro video
                  </button>
                </div>
              )}
            </section>
          </div>

          <section className="card anim-up" style={{ animationDelay: '140ms' }}>
            <div className="card-head">
              <div className="card-title">
                <div className="ico">
                  <Icon name="play" />
                </div>
                <div>
                  <h2>Trabajo para esta semana</h2>
                  <small className="muted">Los hallazgos con más prioridad de la última sesión y su ejercicio principal.</small>
                </div>
              </div>
            </div>
            {recs.length === 0 ? (
              <p className="ok">Todo en verde. Mantén el trabajo y prueba a otro ritmo.</p>
            ) : (
              <div className="focus-grid">
                {recs.slice(0, 3).map((r) => (
                  <article key={r.assessment.threshold.id} className={`rec rec-${r.assessment.light}`}>
                    <header>
                      <div className="m-ico">
                        <Icon name={r.assessment.threshold.icon as IconName} size={16} />
                      </div>
                      <strong>{r.assessment.threshold.label}</strong>
                    </header>
                    <p className="rec-finding">{r.finding}</p>
                    {r.drills[0] && (
                      <div className="drills">
                        <div style={{ display: 'grid', gap: 4, padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 10, fontSize: '0.88rem' }}>
                          <strong>{r.drills[0].name}</strong>
                          <span className="muted">{r.drills[0].dose}</span>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
