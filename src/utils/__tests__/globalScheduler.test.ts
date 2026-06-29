import { describe, it, expect } from 'vitest';
import { recalculateGlobalSchedule } from '../globalScheduler';
import type { Match, Category, FightGroup } from '../../types';

describe('Global Scheduler Tests', () => {
  const dummyCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Category A',
      ageMin: null,
      ageMax: null,
      weightMin: null,
      weightMax: null,
      beltMin: null,
      beltMax: null,
      gender: 'mixed',
      discipline: 'kumite',
      tournamentFormat: 'single_elimination',
    },
    {
      id: 'cat-2',
      name: 'Category B',
      ageMin: null,
      ageMax: null,
      weightMin: null,
      weightMax: null,
      beltMin: null,
      beltMax: null,
      gender: 'mixed',
      discipline: 'kumite',
      tournamentFormat: 'single_elimination',
    },
  ];

  const dummyFightGroups: FightGroup[] = [
    { id: 'group-1', categoryId: 'cat-1', participantIds: ['p1', 'p2'], status: 'running' },
    { id: 'group-2', categoryId: 'cat-2', participantIds: ['p3', 'p4'], status: 'pending' },
  ];

  it('should assign pending matches sequentially after completed or running ones', () => {
    // 1. Setup matches
    // Mat 1 has a running match and two pending matches.
    const allMatches: Match[] = [
      {
        id: 'match-locked-1',
        fightGroupId: 'group-1',
        round: 1,
        position: 1,
        fighter1Id: 'p1',
        fighter2Id: 'p2',
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'running',
        matNumber: 1,
        scheduledOrder: 1,
      },
      {
        id: 'match-pending-1',
        fightGroupId: 'group-1',
        round: 2,
        position: 1,
        fighter1Id: 'p1',
        fighter2Id: 'p2',
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 1,
        scheduledOrder: 2,
      },
      {
        id: 'match-pending-2',
        fightGroupId: 'group-2',
        round: 1,
        position: 1,
        fighter1Id: 'p3',
        fighter2Id: 'p4',
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 2,
        scheduledOrder: 1,
      },
    ];

    const updates = recalculateGlobalSchedule(allMatches, dummyCategories, dummyFightGroups, 2);

    // Verify match-locked-1 is still order 1
    const lockedUpdate = updates.find((u) => u.matchId === 'match-locked-1');
    expect(lockedUpdate).toBeDefined();
    expect(lockedUpdate?.scheduledOrder).toBe(1);
    expect(lockedUpdate?.matNumber).toBe(1);

    // Verify match-pending-1 is ordered after match-locked-1
    const pendingUpdate1 = updates.find((u) => u.matchId === 'match-pending-1');
    expect(pendingUpdate1).toBeDefined();
    expect(pendingUpdate1?.scheduledOrder).toBe(2);
    expect(pendingUpdate1?.matNumber).toBe(1);
  });

  it('should interleave pending matches of different categories by round number', () => {
    const allMatches: Match[] = [
      {
        id: 'match-pending-a2',
        fightGroupId: 'group-1',
        round: 2,
        position: 1,
        fighter1Id: 'p1',
        fighter2Id: 'p2',
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 1,
        scheduledOrder: 0,
      },
      {
        id: 'match-pending-b1',
        fightGroupId: 'group-2',
        round: 1,
        position: 1,
        fighter1Id: 'p3',
        fighter2Id: 'p4',
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 1,
        scheduledOrder: 0,
      },
      {
        id: 'match-pending-a1',
        fightGroupId: 'group-1',
        round: 1,
        position: 2,
        fighter1Id: 'p1',
        fighter2Id: 'p2',
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 1,
        scheduledOrder: 0,
      },
    ];

    const categories: Category[] = [
      { ...dummyCategories[0], name: 'Category A' },
      { ...dummyCategories[1], name: 'Category B' },
    ];
    const updates = recalculateGlobalSchedule(allMatches, categories, dummyFightGroups, 1);

    const a1Update = updates.find((u) => u.matchId === 'match-pending-a1');
    const b1Update = updates.find((u) => u.matchId === 'match-pending-b1');
    const a2Update = updates.find((u) => u.matchId === 'match-pending-a2');

    expect(a1Update?.matNumber).toBe(1);
    expect(b1Update?.matNumber).toBe(1);
    expect(a2Update?.matNumber).toBe(1);

    expect(a1Update?.scheduledOrder).toBe(1);
    expect(b1Update?.scheduledOrder).toBe(2);
    expect(a2Update?.scheduledOrder).toBe(3);
  });
});
