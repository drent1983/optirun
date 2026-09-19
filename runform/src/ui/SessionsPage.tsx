import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { assess, type Light } from '../gait/rules';
import { formatPace } from '../gait/types';
import { db, deleteSession, exportSessions, importSessions, type Session } from '../store/db';
import { Icon } from './icons';
import { MetricsPanel } from './MetricsPanel';

export function SessionsPage({ onNavigate }: { onNavigate?: (p: 'analyze') => void }) {
  const sessions = useLiveQuery(() => db.sessions.orderBy('createdAt').reverse().toArray(), []);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = sessions?.find((s) => s.id === selectedId) ?? null;

  async function onExport() {
    const blob = await exportSessions();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optirun-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onDelete(s: Session) {
    if (!confirm(`¿Borrar la sesión "${s.name}"?`)) return;
    await deleteSession(s.id!);
    if (selectedId === s.id) setSelectedId(null);
  }

  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function onImport(file: File | undefined) {
    if (!file) return;
    try {
      const r = await importSessions(file);
      setImportMsg(`Importadas ${r.added} sesiones${r.skipped ? `, ${r.skipped} omitidas` : ''}.`);
    } catch (err) {
      setImportMsg(`No se pudo importar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sesiones</h1>
          <p>Análisis guardados en este navegador. Solo se conservan esqueleto y métricas.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            <Icon name="upload" size={16} /> Importar JSON
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                void onImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button className="btn btn-ghost" onClick={onExport} disabled={!sessions?.length}>
            <Icon name="download" size={16} /> Exportar JSON
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="status" role="status">
          <Icon name="info" size={16} /> {importMsg}
          <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setImportMsg(null)} aria-label="Cerrar">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {!sessions ? null : sessions.length === 0 ? (
        <div className="card">
          <div className="empty center">
            <div className="ico">
              <Icon name="list" size={22} />
            </div>
            <strong>Aún no hay sesiones</strong>
            <p className="muted">Procesa un video en Analizar y pulsa Guardar sesión.</p>
            {onNavigate && (
              <button className="btn btn-primary" onClick={() => onNavigate('analyze')}>
                <Icon name="video" size={16} /> Ir a Analizar
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="session-grid">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                s={s}
                selected={s.id === selectedId}
                onSelect={() => setSelectedId(s.id === selectedId ? null : s.id!)}
                onDelete={() => onDelete(s)}
              />
            ))}
          </div>

          {selected && (
            <section className="card">
              <div className="card-head">
                <div className="card-title">
                  <div className="ico">
                    <Icon name="chart" />
                  </div>
                  <div>
                    <h2>{selected.name}</h2>
                    <small className="muted">
                      {new Date(selected.createdAt).toLocaleString()} · {selected.plane} ·{' '}
                      {formatPace(selected.paceSecPerKm)} min/km
                    </small>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setSelectedId(null)} aria-label="Cerrar">
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div className="kv">
                <div>
                  <small>Duración</small>
                  <strong>{selected.durationSec.toFixed(1)} s</strong>
                </div>
                <div>
                  <small>FPS</small>
                  <strong>{selected.fps}</strong>
                </div>
                <div>
                  <small>Frames</small>
                  <strong>{selected.frameCount}</strong>
                </div>
                <div>
                  <small>Detección</small>
                  <strong>{Math.round(selected.detectionRate * 100)}%</strong>
                </div>
                <div>
                  <small>Estatura</small>
                  <strong>{selected.heightCm} cm</strong>
                </div>
              </div>

              {selected.analysis ? (
                <MetricsPanel
                  metrics={selected.analysis.metrics}
                  contacts={selected.analysis.contacts}
                  calibration={selected.analysis.calibration}
                  plane={selected.plane}
                />
              ) : (
                <p className="muted">Esta sesión se guardó sin análisis de zancada.</p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function SessionCard({
  s,
  selected,
  onSelect,
  onDelete,
}: {
  s: Session;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const lights: Light[] = s.analysis ? assess(s.analysis.metrics, s.plane).map((a) => a.light) : [];
  const count = (l: Light) => lights.filter((x) => x === l).length;
  const cadence = s.analysis?.metrics.cadence.value;

  return (
    <div className={`session ${selected ? 'selected' : ''}`} onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}>
      <div className="top">
        <div>
          <div className="name">{s.name}</div>
          <small className="subtle">{new Date(s.createdAt).toLocaleDateString()}</small>
        </div>
        <button
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Borrar sesión"
          title="Borrar"
        >
          <Icon name="trash" size={15} />
        </button>
      </div>

      <div className="meta">
        <span className="pill">
          <Icon name={s.plane === 'lateral' ? 'eye' : 'frontal'} size={12} /> {s.plane}
        </span>
        <span className="pill">
          <Icon name="timer" size={12} /> {formatPace(s.paceSecPerKm)} /km
        </span>
        {cadence !== undefined && Number.isFinite(cadence) && (
          <span className="pill">
            <Icon name="activity" size={12} /> {cadence.toFixed(0)} ppm
          </span>
        )}
      </div>

      {lights.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="lights">
            {lights.map((l, i) => (
              <span key={i} className={`dot-${l}`} title={l} />
            ))}
          </div>
          <small className="subtle">
            {count('green')} bien · {count('yellow')} mejorable · {count('red')} atención
          </small>
        </div>
      )}
    </div>
  );
}
