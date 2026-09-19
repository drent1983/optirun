import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from './rules';
import { buildSeries, compareSessions, distanceToGreen, type SessionLike } from './series';

const cadence = THRESHOLDS.find((t) => t.id === 'cadence')!;

function session(over: Partial<SessionLike> & { cadence?: number }): SessionLike {
  const { cadence: c, ...rest } = over;
  return {
    id: 1,
    name: 's',
    createdAt: 0,
    plane: 'lateral',
    paceBand: '4:45-5:30',
    paceSecPerKm: 300,
    metrics: c === undefined ? null : { cadence: { value: c, sd: 1, n: 20 } },
    ...rest,
  };
}

describe('buildSeries', () => {
  it('ordena por fecha, filtra por plano y banda y omite sesiones sin valor', () => {
    const sessions = [
      session({ id: 2, createdAt: 200, cadence: 172 }),
      session({ id: 1, createdAt: 100, cadence: 165 }),
      session({ id: 3, createdAt: 300, plane: 'frontal', cadence: 180 }),
      session({ id: 4, createdAt: 400, paceBand: '<4:00', cadence: 185 }),
      session({ id: 5, createdAt: 500 }),
    ];
    const series = buildSeries(sessions, [cadence], 'lateral', '4:45-5:30');
    expect(series).toHaveLength(1);
    expect(series[0].points.map((p) => p.sessionId)).toEqual([1, 2]);
    expect(series[0].points[0].light).toBe('yellow');
    expect(series[0].points[1].light).toBe('green');

    const all = buildSeries(sessions, [cadence], 'lateral', 'all');
    expect(all[0].points.map((p) => p.sessionId)).toEqual([1, 2, 4]);
  });
});

describe('compareSessions', () => {
  it('calcula la diferencia y si mejora respecto a la banda verde', () => {
    const a = session({ id: 1, cadence: 160 });
    const b = session({ id: 2, cadence: 172 });
    const d = compareSessions(a, b, [cadence])[0];
    expect(d.diff).toBe(12);
    expect(d.improved).toBe(true);
    expect(d.lightA).toBe('yellow');
    expect(d.lightB).toBe('green');

    const worse = compareSessions(b, a, [cadence])[0];
    expect(worse.improved).toBe(false);

    const same = compareSessions(b, session({ id: 3, cadence: 180 }), [cadence])[0];
    expect(same.improved).toBeNull();
  });

  it('distanceToGreen es 0 dentro de la banda', () => {
    expect(distanceToGreen(175, cadence)).toBe(0);
    expect(distanceToGreen(160, cadence)).toBe(10);
    expect(distanceToGreen(195, cadence)).toBe(5);
  });
});
