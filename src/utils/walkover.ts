import type { Match, FightGroup } from '../types';
import { advanceWinner } from './bracketGenerator';

export interface MatchUpdate {
  matchId: string;
  updates: Partial<Match>;
}

/**
 * Computes all match updates needed when a participant is withdrawn.
 * Pending matches become walkovers (opponent wins automatically).
 * For single elimination, winners cascade into the next round.
 * Already completed matches are left untouched.
 */
export function computeWalkoverUpdates(
  participantId: string,
  allMatches: Match[],
  _fightGroups: FightGroup[],
): MatchUpdate[] {
  const updates: MatchUpdate[] = [];

  const affectedMatches = allMatches.filter(
    (m) =>
      (m.fighter1Id === participantId || m.fighter2Id === participantId) &&
      m.status !== 'completed' &&
      m.status !== 'bye' &&
      m.status !== 'walkover' &&
      m.status !== 'disqualification',
  );

  const updatedMatchesMap = new Map<string, Match>();
  for (const m of allMatches) {
    updatedMatchesMap.set(m.id, { ...m });
  }

  for (const m of affectedMatches) {
    const opponentId =
      m.fighter1Id === participantId ? m.fighter2Id : m.fighter1Id;

    const matchUpdate: Partial<Match> = {
      winnerId: opponentId,
      status: 'walkover',
      score1: 0,
      score2: 0,
    };

    updates.push({ matchId: m.id, updates: matchUpdate });

    const updatedMatch: Match = { ...m, ...matchUpdate };
    updatedMatchesMap.set(m.id, updatedMatch);

    if (opponentId) {
      const allUpdated = Array.from(updatedMatchesMap.values());
      const advance = advanceWinner(allUpdated, updatedMatch);
      if (advance) {
        updates.push(advance);
        const target = updatedMatchesMap.get(advance.matchId);
        if (target) {
          updatedMatchesMap.set(advance.matchId, { ...target, ...advance.updates });
        }
      }
    }
  }

  return updates;
}

/**
 * Checks whether a participant is referenced in any match
 * (i.e., has an active bracket).
 */
export function isParticipantInBracket(
  participantId: string,
  allMatches: Match[],
): boolean {
  return allMatches.some(
    (m) => m.fighter1Id === participantId || m.fighter2Id === participantId,
  );
}
