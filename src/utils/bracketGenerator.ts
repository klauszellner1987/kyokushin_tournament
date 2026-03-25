import type { Match } from '../types';

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function generateSingleElimination(
  fightGroupId: string,
  participantIds: string[],
): Omit<Match, 'id'>[] {
  const shuffled = shuffle(participantIds);
  const bracketSize = nextPowerOfTwo(shuffled.length);
  const totalRounds = Math.log2(bracketSize);
  const matches: Omit<Match, 'id'>[] = [];

  // Distribute fighters across slots so that each match has at most one bye.
  // Phase 1: one fighter per match (fills fighter1 of each match).
  // Phase 2: remaining fighters fill fighter2 slots from the top.
  // This guarantees no "double bye" (null vs null) matches.
  const firstRoundMatches = bracketSize / 2;
  const slots: (string | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < shuffled.length; i++) {
    if (i < firstRoundMatches) {
      slots[i * 2] = shuffled[i];
    } else {
      slots[(i - firstRoundMatches) * 2 + 1] = shuffled[i];
    }
  }

  for (let i = 0; i < firstRoundMatches; i++) {
    const f1 = slots[i * 2];
    const f2 = slots[i * 2 + 1];
    const isBye = f1 === null || f2 === null;

    matches.push({
      fightGroupId,
      round: 1,
      position: i,
      fighter1Id: f1,
      fighter2Id: f2,
      winnerId: isBye ? (f1 ?? f2) : null,
      score1: 0,
      score2: 0,
      status: isBye ? 'bye' : 'pending',
      matNumber: 0,
      scheduledOrder: 0,
    });
  }

  // Subsequent rounds (empty, filled as winners advance)
  for (let round = 2; round <= totalRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round);
    for (let pos = 0; pos < matchCount; pos++) {
      matches.push({
        fightGroupId,
        round,
        position: pos,
        fighter1Id: null,
        fighter2Id: null,
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 0,
        scheduledOrder: 0,
      });
    }
  }

  return matches;
}

export function generateRoundRobin(
  fightGroupId: string,
  participantIds: string[],
): Omit<Match, 'id'>[] {
  const matches: Omit<Match, 'id'>[] = [];
  const ids = [...participantIds];
  if (ids.length % 2 !== 0) ids.push('__BYE__');

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = ids[i];
      const away = ids[n - 1 - i];

      if (home === '__BYE__' || away === '__BYE__') continue;

      matches.push({
        fightGroupId,
        round: round + 1,
        position: i,
        fighter1Id: home,
        fighter2Id: away,
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending',
        matNumber: 0,
        scheduledOrder: 0,
      });
    }

    // Rotate: keep first element fixed, rotate rest
    const last = ids.pop()!;
    ids.splice(1, 0, last);
  }

  return matches;
}

export function advanceWinner(
  allMatches: Match[],
  completedMatch: Match,
): { matchId: string; updates: Partial<Match> } | null {
  if (!completedMatch.winnerId) return null;

  const nextRound = completedMatch.round + 1;
  const nextPosition = Math.floor(completedMatch.position / 2);

  const nextMatch = allMatches.find(
    (m) =>
      m.fightGroupId === completedMatch.fightGroupId &&
      m.round === nextRound &&
      m.position === nextPosition,
  );

  if (!nextMatch) return null;

  const isTopSlot = completedMatch.position % 2 === 0;
  const updates: Partial<Match> = isTopSlot
    ? { fighter1Id: completedMatch.winnerId }
    : { fighter2Id: completedMatch.winnerId };

  return { matchId: nextMatch.id, updates };
}

export function getRoundLabel(round: number, totalRounds: number): string {
  const roundsFromEnd = totalRounds - round;
  switch (roundsFromEnd) {
    case 0:
      return 'Finale';
    case 1:
      return 'Halbfinale';
    case 2:
      return 'Viertelfinale';
    default:
      return `Runde ${round}`;
  }
}
