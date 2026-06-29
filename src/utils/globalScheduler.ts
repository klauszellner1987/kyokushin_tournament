import type { Match, Category, FightGroup } from '../types';
import { distributeCategoriesToMats } from './matScheduler';

/**
 * Recalculates the mat assignments and scheduled order for all matches in the tournament.
 * Completed, running, and special status fights (except pending) are kept at their current mats
 * and order to protect the current state of active matches.
 * All pending matches are rescheduled sequentially and given consecutive scheduledOrder numbers
 * starting after the locked matches on each mat.
 */
export function recalculateGlobalSchedule(
  allMatches: Match[],
  categories: Category[],
  fightGroups: FightGroup[],
  matCount: number,
): { matchId: string; matNumber: number; scheduledOrder: number }[] {
  // 1. Split matches into locked (completed, running, walkover, disqualification) and pending
  const lockedMatches = allMatches.filter(
    (m) => m.status !== 'pending' && m.status !== 'bye'
  );
  const pendingMatches = allMatches.filter((m) => m.status === 'pending');

  // 2. Map groups to categoryIds for fast lookup
  const groupCategoryMap = new Map<string, string>();
  for (const g of fightGroups) {
    groupCategoryMap.set(g.id, g.categoryId);
  }

  // 3. Compute mat assignments for all categories based on all matches
  const matAssignments = distributeCategoriesToMats(
    categories,
    fightGroups,
    allMatches,
    matCount,
  );

  const categoryMats = new Map<string, number[]>();
  for (const a of matAssignments) {
    const mats = categoryMats.get(a.categoryId) ?? [];
    if (!mats.includes(a.matNumber)) mats.push(a.matNumber);
    categoryMats.set(a.categoryId, mats);
  }

  // 4. Group pending matches by category
  const pendingByCat = new Map<string, Match[]>();
  for (const m of pendingMatches) {
    const catId = groupCategoryMap.get(m.fightGroupId);
    if (!catId) continue;
    const list = pendingByCat.get(catId) ?? [];
    list.push(m);
    pendingByCat.set(catId, list);
  }

  // 5. Distribute pending matches for each category across its assigned mats
  const matPendingQueues = new Map<number, Match[]>();
  for (const [catId, catPendingMatches] of pendingByCat.entries()) {
    const mats = categoryMats.get(catId) ?? [1];
    
    // Sort pending matches of this category by round and position to keep logical progression
    const sortedPending = [...catPendingMatches].sort(
      (a, b) => a.round - b.round || a.position - b.position
    );

    sortedPending.forEach((m, idx) => {
      const matNumber = mats[idx % mats.length];
      const q = matPendingQueues.get(matNumber) ?? [];
      q.push(m);
      matPendingQueues.set(matNumber, q);
    });
  }

  const scheduleUpdates: { matchId: string; matNumber: number; scheduledOrder: number }[] = [];

  // 6. For each mat, combine locked matches with pending matches and assign a clean scheduledOrder
  for (let matNum = 1; matNum <= matCount; matNum++) {
    // Keep already started or completed matches exactly where they are
    const matLocked = lockedMatches
      .filter((m) => m.matNumber === matNum)
      .sort((a, b) => (a.scheduledOrder ?? 0) - (b.scheduledOrder ?? 0));

    const matPending = matPendingQueues.get(matNum) ?? [];
    
    // Sort pending matches on this mat by:
    // 1. User priority (e.g. setNextMatch or manual prioritization)
    // 2. Round number (interleave rounds across categories so Vorrunden of all categories happen before Halbfinale, etc.)
    // 3. Category name/ID (keep logical group ordering within the same round)
    // 4. Position within that round
    matPending.sort((a, b) => {
      const aPriority = a.priority ?? a.scheduledOrder ?? 9999;
      const bPriority = b.priority ?? b.scheduledOrder ?? 9999;
      if (aPriority !== bPriority) return aPriority - bPriority;

      if (a.round !== b.round) return a.round - b.round;

      const catA = groupCategoryMap.get(a.fightGroupId) ?? '';
      const catB = groupCategoryMap.get(b.fightGroupId) ?? '';
      if (catA !== catB) return catA.localeCompare(catB);

      return a.position - b.position;
    });

    const allMatMatches = [...matLocked, ...matPending];
    allMatMatches.forEach((m, index) => {
      scheduleUpdates.push({
        matchId: m.id,
        matNumber: matNum,
        scheduledOrder: index + 1,
      });
    });
  }

  // 7. Fallback for any orphaned pending match
  const scheduledIds = new Set(scheduleUpdates.map((u) => u.matchId));
  for (const m of pendingMatches) {
    if (!scheduledIds.has(m.id)) {
      scheduleUpdates.push({
        matchId: m.id,
        matNumber: 1,
        scheduledOrder: 999,
      });
    }
  }

  return scheduleUpdates;
}
