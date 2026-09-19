import type { Recommendation } from '../gait/drills';
import { Icon, type IconName } from './icons';

export function DrillsPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="empty center">
        <div className="ico">
          <Icon name="check" size={22} />
        </div>
        <strong className="ok">Todas las métricas evaluadas están en verde.</strong>
        <p className="muted">
          Mantén el trabajo actual. Repite el análisis a otros ritmos para ver si la técnica se
          sostiene cuando aceleras.
        </p>
      </div>
    );
  }

  return (
    <div className="recs">
      {recommendations.map((r) => (
        <article key={r.assessment.threshold.id} className={`rec rec-${r.assessment.light}`}>
          <header>
            <div className="m-ico">
              <Icon name={r.assessment.threshold.icon as IconName} size={16} />
            </div>
            <strong>{r.assessment.threshold.label}</strong>
            <span className={`pill pill-${r.assessment.light}`}>
              {r.assessment.light === 'red' ? 'Prioridad' : 'Mejorable'}
            </span>
            <span className="muted">
              {r.assessment.value.value.toFixed(r.assessment.threshold.decimals)}{' '}
              {r.assessment.threshold.unit}
            </span>
          </header>
          <p className="rec-finding">{r.finding}</p>
          {r.drills.length > 0 && (
            <ul className="drills">
              {r.drills.map((d) => (
                <li key={d.id}>
                  <strong>
                    <Icon name="play" size={13} /> {d.name}
                  </strong>
                  <p>{d.how}</p>
                  <small className="subtle">{d.dose}</small>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
