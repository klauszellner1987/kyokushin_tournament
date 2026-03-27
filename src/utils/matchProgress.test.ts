import { describe, it, expect } from 'vitest';
import type { Match } from '../types';
import { getMatOverview } from './matScheduler';
import { countFinishedScheduledFights, countScheduledFights } from './matchProgress';

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    fightGroupId: 'fg',
    round: 1,
    position: 1,
    fighter1Id: 'a',
    fighter2Id: 'b',
    winnerId: null,
    score1: 0,
    score2: 0,
    status: 'pending',
    matNumber: 1,
    scheduledOrder: 1,
    ...overrides,
  };
}

describe('matchProgress vs getMatOverview', () => {
  it('summiert pro Matte zum gleichen Gesamtzähler, wenn alle Kämpfe Matten zugewiesen sind', () => {
    const matches: Match[] = [
      baseMatch({ id: 'a', matNumber: 1, scheduledOrder: 1, status: 'completed', winnerId: 'a' }),
      baseMatch({ id: 'b', matNumber: 1, scheduledOrder: 2, status: 'walkover', winnerId: 'a' }),
      baseMatch({ id: 'c', matNumber: 2, scheduledOrder: 1, status: 'disqualification', winnerId: 'b' }),
      baseMatch({ id: 'd', matNumber: 2, scheduledOrder: 2, status: 'pending' }),
      baseMatch({ id: 'bye', matNumber: 1, scheduledOrder: 99, status: 'bye', fighter2Id: null, winnerId: 'a' }),
    ];

    const matCount = 2;
    const overview = getMatOverview(matches, matCount);

    const sumCompleted = overview.reduce((s, m) => s + m.completed, 0);
    const sumTotal = overview.reduce((s, m) => s + m.total, 0);

    expect(countFinishedScheduledFights(matches)).toBe(3);
    expect(countScheduledFights(matches)).toBe(4);
    expect(sumCompleted).toBe(countFinishedScheduledFights(matches));
    expect(sumTotal).toBe(countScheduledFights(matches));
  });

  it('nach Abschluss aller ausstehenden Kämpfe: 100 % deckungsgleich', () => {
    const matches: Match[] = [
      baseMatch({ id: 'm1', matNumber: 1, scheduledOrder: 1, status: 'completed', winnerId: 'a' }),
      baseMatch({ id: 'm2', matNumber: 2, scheduledOrder: 1, status: 'completed', winnerId: 'b' }),
      baseMatch({ id: 'm3', matNumber: 2, scheduledOrder: 2, status: 'completed', winnerId: 'a' }),
    ];
    const overview = getMatOverview(matches, 2);

    expect(countFinishedScheduledFights(matches)).toBe(3);
    overview.forEach((row) => {
      if (row.total > 0) {
        expect(row.completed).toBe(row.total);
      }
    });
    expect(overview.reduce((s, r) => s + r.completed, 0)).toBe(3);
  });
});
