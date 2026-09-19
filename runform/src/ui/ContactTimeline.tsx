import type { Contact } from '../gait/events';

/**
 * Barra de tiempo con los apoyos izquierdo y derecho. Clic para saltar al
 * contacto. Muestra la posición actual del video.
 */
export function ContactTimeline({
  contacts,
  duration,
  currentTime,
  fps,
  onSeek,
}: {
  contacts: Contact[];
  duration: number;
  currentTime: number;
  fps: number;
  onSeek: (t: number) => void;
}) {
  if (!duration || contacts.length === 0) return null;
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / duration) * 100))}%`;

  return (
    <div className="timeline" aria-label="Apoyos detectados">
      <div className="timeline-track" onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - r.left) / r.width) * duration);
      }}>
        {contacts.map((c, i) => {
          const start = c.strike / fps;
          const end = c.toeOff / fps;
          return (
            <button
              key={i}
              type="button"
              className={`timeline-contact side-${c.side}`}
              style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
              title={`${c.side === 'left' ? 'Izquierdo' : 'Derecho'} · ${start.toFixed(2)} s · ${Math.round(((c.toeOff - c.strike) / fps) * 1000)} ms`}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(start + 0.5 / fps);
              }}
              aria-label={`Contacto ${c.side === 'left' ? 'izquierdo' : 'derecho'} en ${start.toFixed(2)} segundos`}
            />
          );
        })}
        <div className="timeline-cursor" style={{ left: pct(currentTime) }} />
      </div>
      <div className="timeline-legend subtle">
        <span>
          <i className="dot side-left" /> Izquierdo
        </span>
        <span>
          <i className="dot side-right" /> Derecho
        </span>
        <span className="timeline-keys">
          <kbd>←</kbd>
          <kbd>→</kbd> frame · <kbd>Shift</kbd>+flechas 5 frames · <kbd>[</kbd>
          <kbd>]</kbd> apoyo anterior / siguiente · <kbd>espacio</kbd> pausa
        </span>
      </div>
    </div>
  );
}
