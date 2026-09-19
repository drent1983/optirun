import Dexie, { type EntityTable } from 'dexie';
import type { Calibration } from '../gait/calibration';
import type { Contact } from '../gait/events';
import type { GaitMetrics } from '../gait/metrics';
import type { CameraPlane, FramePose, PaceBand } from '../gait/types';

/** Una sesión de análisis: un video procesado. El video nunca se guarda. */
export interface Session {
  id?: number;
  createdAt: number;
  name: string;
  plane: CameraPlane;
  /** Ritmo en segundos por km. */
  paceSecPerKm: number;
  paceBand: PaceBand;
  /** Estatura del corredor en cm, para calibrar píxel a metro. */
  heightCm: number;
  fps: number;
  durationSec: number;
  videoWidth: number;
  videoHeight: number;
  frameCount: number;
  /** Fracción de frames con pose detectada. */
  detectionRate: number;
  frames: FramePose[];
  /** Resultado del análisis de zancada (Fase 2). Ausente en sesiones antiguas. */
  analysis?: {
    calibration: Calibration | null;
    contacts: Contact[];
    metrics: GaitMetrics;
  };
}

class OptiRunDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;

  constructor() {
    // Nombre interno de la base de datos. Se mantiene para conservar las sesiones ya guardadas.
    super('runform');
    this.version(1).stores({
      sessions: '++id, createdAt, plane, paceBand',
    });
  }
}

export const db = new OptiRunDB();

export async function saveSession(session: Session): Promise<number> {
  const id = await db.sessions.add(session);
  return id as number;
}

export async function deleteSession(id: number): Promise<void> {
  await db.sessions.delete(id);
}

export async function exportSessions(): Promise<Blob> {
  const all = await db.sessions.toArray();
  return new Blob([JSON.stringify({ version: 1, sessions: all })], { type: 'application/json' });
}

/**
 * Importa un JSON exportado por la app. Omite sesiones ya presentes (misma fecha
 * de creación y nombre). Devuelve cuántas se añadieron.
 */
export async function importSessions(file: File): Promise<{ added: number; skipped: number }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { version?: number; sessions?: unknown[] };
  if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('El archivo no tiene el formato esperado');

  const existing = await db.sessions.toArray();
  const seen = new Set(existing.map((s) => `${s.createdAt}|${s.name}`));
  let added = 0;
  let skipped = 0;
  const toAdd: Session[] = [];
  for (const raw of parsed.sessions) {
    const s = raw as Session;
    if (!s || typeof s.createdAt !== 'number' || !Array.isArray(s.frames)) {
      skipped++;
      continue;
    }
    const key = `${s.createdAt}|${s.name}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const { id: _id, ...rest } = s;
    void _id;
    toAdd.push(rest as Session);
    added++;
  }
  if (toAdd.length) await db.sessions.bulkAdd(toAdd);
  return { added, skipped };
}
