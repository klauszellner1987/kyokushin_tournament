import { useCallback, useMemo } from 'react';
import type { Match } from '../types';

/**
 * Hook to manage pending matches for a specific mat / fight group.
 * It provides sorted pending matches, and helpers to reprioritize them.
 */
export function useMatchQueue(
  allMatches: Match[],
  groupId: string,
  onUpdateMatch: (id: string, updates: Partial<Match>) => Promise<void>,
) {
  // Filter pending matches belonging to the given group
  const pendingMatches = useMemo(() => {
    return allMatches
      .filter((m) => m.fightGroupId === groupId && m.status === 'pending')
      .sort((a, b) => {
        const aKey = a.priority ?? a.scheduledOrder ?? 0;
        const bKey = b.priority ?? b.scheduledOrder ?? 0;
        return aKey - bKey;
      });
  }, [allMatches, groupId]);

  // Set a specific match as the next one (priority -1 to force first)
  const setNextMatch = useCallback(
    async (matchId: string) => {
      // Reset priority for all pending matches
      const updates = pendingMatches.map((m) => ({
        id: m.id,
        priority: m.id === matchId ? -1 : (m.priority ?? m.scheduledOrder ?? 0) + 1,
      }));
      // Apply updates sequentially
      for (const { id, priority } of updates) {
        await onUpdateMatch(id, { priority });
      }
    },
    [pendingMatches, onUpdateMatch],
  );

  // Skip current match – push it to the end of the queue
  const skipCurrentMatch = useCallback(
    async (currentId: string) => {
      const maxPriority = Math.max(...pendingMatches.map((m) => m.priority ?? m.scheduledOrder ?? 0), 0);
      await onUpdateMatch(currentId, { priority: maxPriority + 1000 }); // large number pushes to end
    },
    [pendingMatches, onUpdateMatch],
  );

  // Reorder matches after drag‑and‑drop
  const reorderMatches = useCallback(
    async (newOrder: Match[]) => {
      for (let i = 0; i < newOrder.length; i++) {
        const m = newOrder[i];
        await onUpdateMatch(m.id, { priority: i });
      }
    },
    [onUpdateMatch],
  );

  return {
    pendingMatches,
    setNextMatch,
    skipCurrentMatch,
    reorderMatches,
  } as const;
}
