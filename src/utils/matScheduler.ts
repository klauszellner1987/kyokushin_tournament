import type { Match, Category, FightGroup } from '../types';

export interface MatAssignment {
  categoryId: string;
  matNumber: number;
}

/**
 * Distributes categories evenly across mats based on expected match count.
 * Categories with the most matches get spread across different mats first.
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
  });

  // Sort by most matches first for better distribution
  catMatchCounts.sort((a, b) => b.matchCount - a.matchCount);

  const matLoads = Array.from({ length: matCount }, () => 0);
  const assignments: MatAssignment[] = [];

  for (const { categoryId, matchCount } of catMatchCounts) {
    // Assign to the mat with the least load
    const minLoadIdx = matLoads.indexOf(Math.min(...matLoads));
    const matNumber = minLoadIdx + 1;
    assignments.push({ categoryId, matNumber });
    matLoads[minLoadIdx] += matchCount;
  }

  return assignments;
}

/**
 * Assigns mat numbers and scheduled order to matches based on category→mat mapping.
 */
export function scheduleMatchesToMats(
  matches: Match[],
  fightGroups: FightGroup[],
  matAssignments: MatAssignment[],
): { matchId: string; matNumber: number; scheduledOrder: number }[] {
  const assignmentMap = new Map(
    matAssignments.map((a) => [a.categoryId, a.matNumber]),
  );

  const matQueues = new Map<number, { matchId: string; round: number; position: number }[]>();

  for (const match of matches) {
    const group = fightGroups.find((g) => g.id === match.fightGroupId);
    if (!group) continue;

    const matNumber = assignmentMap.get(group.categoryId) ?? 1;
    const queue = matQueues.get(matNumber) ?? [];
    queue.push({ matchId: match.id, round: match.round, position: match.position });
    matQueues.set(matNumber, queue);
  }

  const result: { matchId: string; matNumber: number; scheduledOrder: number }[] = [];

  for (const [matNumber, queue] of matQueues.entries()) {
    // Sort by round first (earlier rounds first), then position
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
): { matNumber: number; current: Match | null; next: Match | null; completed: number; total: number }[] {
  return Array.from({ length: matCount }, (_, i) => {
    const matNumber = i + 1;
    const matMatches = matches.filter((m) => m.matNumber === matNumber);

    const runningMatch = matMatches.find(
      (m) => m.status === 'running' && m.fighter1Id && m.fighter2Id,
    );
    const pendingReady = matMatches
      .filter((m) => m.status === 'pending' && m.fighter1Id && m.fighter2Id)
      .sort((a, b) => a.scheduledOrder - b.scheduledOrder);

    const current = runningMatch ?? pendingReady[0] ?? null;
    const next = runningMatch ? pendingReady[0] : pendingReady[1];

    return {
      matNumber,
      current,
      next: next ?? null,
      completed: matMatches.filter((m) => m.status === 'completed' || m.status === 'bye' || m.status === 'walkover' || m.status === 'disqualification').length,
      total: matMatches.length,
    };
  });
}
