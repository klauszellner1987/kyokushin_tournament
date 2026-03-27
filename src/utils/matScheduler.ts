import type { Match, Category, FightGroup } from '../types';
import { isFightFinished, isScheduledFightForProgress } from './matchProgress';

export interface MatAssignment {
  categoryId: string;
  matNumber: number;
}

/**
 * Distributes categories evenly across mats based on expected match count.
 * When there are more mats than categories, a single category's matches
 * get spread across multiple mats so no mat sits idle.
 */
export function distributeCategoriesToMats(
  categories: Category[],
  fightGroups: FightGroup[],
  matches: Match[],
  matCount: number,
): MatAssignment[] {
  const catMatchCounts = categories.map((c) => {
    const groups = fightGroups.filter((g) => g.categoryId === c.id);
    const matchCount = matches.filter((m) =>
      groups.some((g) => g.id === m.fightGroupId),
    ).length;
    return { categoryId: c.id, matchCount };
  }).filter((c) => c.matchCount > 0);

  if (catMatchCounts.length === 0) return [];

  catMatchCounts.sort((a, b) => b.matchCount - a.matchCount);

  const matLoads = Array.from({ length: matCount }, () => 0);
  const assignments: MatAssignment[] = [];
  let remainingCats = catMatchCounts.length;

  for (const { categoryId, matchCount } of catMatchCounts) {
    const emptyMats = matLoads.filter((l) => l === 0).length;
    remainingCats--;

    const spareMats = emptyMats - remainingCats;
    if (spareMats > 1 && matchCount >= 2) {
      const matsForCat = Math.min(spareMats, matchCount);
      const perMat = Math.ceil(matchCount / matsForCat);
      for (let i = 0; i < matsForCat; i++) {
        const minIdx = matLoads.indexOf(Math.min(...matLoads));
        assignments.push({ categoryId, matNumber: minIdx + 1 });
        matLoads[minIdx] += perMat;
      }
    } else {
      const minIdx = matLoads.indexOf(Math.min(...matLoads));
      assignments.push({ categoryId, matNumber: minIdx + 1 });
      matLoads[minIdx] += matchCount;
    }
  }

  return assignments;
}

/**
 * Assigns mat numbers and scheduled order to matches based on category→mat mapping.
 * Supports a category being assigned to multiple mats, distributing its matches
 * round-robin across them within each round.
 */
export function scheduleMatchesToMats(
  matches: Match[],
  fightGroups: FightGroup[],
  matAssignments: MatAssignment[],
): { matchId: string; matNumber: number; scheduledOrder: number }[] {
  const categoryMats = new Map<string, number[]>();
  for (const a of matAssignments) {
    const mats = categoryMats.get(a.categoryId) ?? [];
    if (!mats.includes(a.matNumber)) mats.push(a.matNumber);
    categoryMats.set(a.categoryId, mats);
  }

  const matQueues = new Map<number, { matchId: string; round: number; position: number }[]>();

  const matchesByCat = new Map<string, Match[]>();
  for (const match of matches) {
    const group = fightGroups.find((g) => g.id === match.fightGroupId);
    if (!group) continue;
    const list = matchesByCat.get(group.categoryId) ?? [];
    list.push(match);
    matchesByCat.set(group.categoryId, list);
  }

  for (const [categoryId, catMatches] of matchesByCat.entries()) {
    const mats = categoryMats.get(categoryId) ?? [1];

    if (mats.length === 1) {
      const queue = matQueues.get(mats[0]) ?? [];
      for (const m of catMatches) {
        queue.push({ matchId: m.id, round: m.round, position: m.position });
      }
      matQueues.set(mats[0], queue);
    } else {
      const sorted = [...catMatches].sort((a, b) => a.round - b.round || a.position - b.position);
      sorted.forEach((m, i) => {
        const matNumber = mats[i % mats.length];
        const queue = matQueues.get(matNumber) ?? [];
        queue.push({ matchId: m.id, round: m.round, position: m.position });
        matQueues.set(matNumber, queue);
      });
    }
  }

  const result: { matchId: string; matNumber: number; scheduledOrder: number }[] = [];

  for (const [matNumber, queue] of matQueues.entries()) {
    queue.sort((a, b) => a.round - b.round || a.position - b.position);
    queue.forEach((item, idx) => {
      result.push({
        matchId: item.matchId,
        matNumber,
        scheduledOrder: idx + 1,
      });
    });
  }

  return result;
}

/**
 * Gets the next pending match for a specific mat.
 */
export function getNextMatchForMat(
  matches: Match[],
  matNumber: number,
): Match | null {
  const matMatches = matches.filter(
    (m) => m.matNumber === matNumber && m.fighter1Id && m.fighter2Id,
  );
  const running = matMatches.find((m) => m.status === 'running');
  if (running) {
    return matMatches
      .filter((m) => m.status === 'pending')
      .sort((a, b) => a.scheduledOrder - b.scheduledOrder)[0] ?? null;
  }
  const pending = matMatches
    .filter((m) => m.status === 'pending')
    .sort((a, b) => a.scheduledOrder - b.scheduledOrder);
  return pending[0] ?? null;
}

/**
 * Gets current + next match for all mats.
 * Running matches take priority over pending ones as "current".
 */
export function getMatOverview(
  matches: Match[],
  matCount: number,
): { matNumber: number; current: Match | null; next: Match | null; lastCompleted: Match | null; recentCompleted: Match[]; completed: number; total: number }[] {
  return Array.from({ length: matCount }, (_, i) => {
    const matNumber = i + 1;
    const matMatches = matches.filter((m) => m.matNumber === matNumber);
    const matScheduled = matMatches.filter(isScheduledFightForProgress);

    const runningMatch = matMatches.find(
      (m) => m.status === 'running' && m.fighter1Id && m.fighter2Id,
    );
    const pendingReady = matMatches
      .filter((m) => m.status === 'pending' && m.fighter1Id && m.fighter2Id)
      .sort((a, b) => a.scheduledOrder - b.scheduledOrder);

    const current = runningMatch ?? pendingReady[0] ?? null;
    const next = runningMatch ? pendingReady[0] : pendingReady[1];

    const completedMatches = matMatches
      .filter((m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification')
      .sort((a, b) => b.scheduledOrder - a.scheduledOrder);

    return {
      matNumber,
      current,
      next: next ?? null,
      lastCompleted: completedMatches[0] ?? null,
      recentCompleted: completedMatches.slice(0, 3),
      completed: matScheduled.filter((m) => isFightFinished(m)).length,
      total: matScheduled.length,
    };
  });
}
