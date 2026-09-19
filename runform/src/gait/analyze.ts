import { calibrate, type Calibration } from './calibration';
import { diagnoseAll, type Contact, type SideDiagnostics } from './events';
import { computeMetrics, type GaitMetrics } from './metrics';
import { interpolateGaps, smoothFrames } from './smoothing';
import type { CameraPlane, FramePose } from './types';

export interface AnalysisInput {
  frames: FramePose[];
  width: number;
  height: number;
  fps: number;
  heightCm: number;
  /** Plano de cámara. Determina qué métricas angulares se calculan. */
  plane?: CameraPlane;
}

export interface Analysis {
  /** Frames tras rellenar huecos y suavizar. Son los que se guardan y dibujan. */
  frames: FramePose[];
  calibration: Calibration | null;
  contacts: Contact[];
  metrics: GaitMetrics;
  /** Valores intermedios de la detección de apoyos, por pie. */
  diagnostics: SideDiagnostics[];
}

/** Pipeline completo de la Fase 2: limpieza, calibración, eventos y métricas. */
export function analyze(input: AnalysisInput): Analysis {
  const { width, height, fps, heightCm, plane = 'lateral' } = input;
  const radius = fps >= 50 ? 3 : 2;
  const frames = smoothFrames(interpolateGaps(input.frames, Math.round(fps / 10)), radius);
  const calibration = calibrate(frames, width, height, heightCm);
  const diagnostics = diagnoseAll(frames, width, height, { fps });
  const contacts = diagnostics.flatMap((d) => d.contacts).sort((a, b) => a.strike - b.strike);
  const metrics = computeMetrics(frames, contacts, width, height, fps, calibration, plane);
  return { frames, calibration, contacts, metrics, diagnostics };
}
