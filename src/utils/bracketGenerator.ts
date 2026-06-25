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
  if (!participantIds || participantIds.length < 2) {
    console.warn(`[BracketGenerator] generateSingleElimination called with less than 2 participants for group ${fightGroupId}. Returning empty bracket.`);
    return [];
  }

  const shuffled = shuffle(participantIds);
  const bracketSize = nextPowerOfTwo(shuffled.length);
  const totalRounds = Math.log2(bracketSize);
  const matches: Omit<Match, 'id'>[] = [];
  
  console.info(`[BracketGenerator] Generating Single Elimination for ${shuffled.length} participants (bracket size: ${bracketSize}, rounds: ${totalRounds}) in group ${fightGroupId}`);

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
  if (!participantIds || participantIds.length < 2) {
    console.warn(`[BracketGenerator] generateRoundRobin called with less than 2 participants for group ${fightGroupId}. Returning empty bracket.`);
    return [];
  }

  const matches: Omit<Match, 'id'>[] = [];
  
  console.info(`[BracketGenerator] Generating Round Robin for ${participantIds.length} participants in group ${fightGroupId}`);
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

const FINISHED_STATUSES: Match['status'][] = ['completed', 'walkover', 'disqualification'];

export function collectCascadeResets(
  allMatches: Match[],
  changedMatch: Match,
): { matchId: string; updates: Partial<Match> }[] {
  const results: { matchId: string; updates: Partial<Match> }[] = [];

  const nextRound = changedMatch.round + 1;
  const nextPosition = Math.floor(changedMatch.position / 2);

  const nextMatch = allMatches.find(
    (m) =>
      m.fightGroupId === changedMatch.fightGroupId &&
      m.round === nextRound &&
      m.position === nextPosition,
  );

  if (!nextMatch) return results;

  const isTopSlot = changedMatch.position % 2 === 0;
  const slotClear: Partial<Match> = isTopSlot
    ? { fighter1Id: null }
    : { fighter2Id: null };

  if (FINISHED_STATUSES.includes(nextMatch.status)) {
    // Depth-first: cascade from the next match before resetting it
    results.push(...collectCascadeResets(allMatches, nextMatch));

    results.push({
      matchId: nextMatch.id,
      updates: {
        ...slotClear,
        winnerId: null,
        score1: 0,
        score2: 0,
        status: 'pending' as const,
        timerEndsAt: undefined,
        timerPausedRemaining: undefined,
        fightRound: undefined,
        isExtension: undefined,
      },
    });
  } else {
    // Next match not yet finished — just clear the fighter slot
    results.push({ matchId: nextMatch.id, updates: slotClear });
  }

  return results;
}

export function countDownstreamResets(
  allMatches: Match[],
  match: Match,
): number {
  const nextRound = match.round + 1;
  const nextPosition = Math.floor(match.position / 2);
  const nextMatch = allMatches.find(
    (m) =>
      m.fightGroupId === match.fightGroupId &&
      m.round === nextRound &&
      m.position === nextPosition,
  );
  if (!nextMatch || !FINISHED_STATUSES.includes(nextMatch.status)) return 0;
  return 1 + countDownstreamResets(allMatches, nextMatch);
}

export function hasRunningDownstream(
  allMatches: Match[],
  match: Match,
): boolean {
  const nextRound = match.round + 1;
  const nextPosition = Math.floor(match.position / 2);
  const nextMatch = allMatches.find(
    (m) =>
      m.fightGroupId === match.fightGroupId &&
      m.round === nextRound &&
      m.position === nextPosition,
  );
  if (!nextMatch) return false;
  if (nextMatch.status === 'running') return true;
  return hasRunningDownstream(allMatches, nextMatch);
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

export function generatePoolSystem(
  fightGroupId: string,
  participantIds: string[],
): Omit<Match, 'id'>[] {
  if (!participantIds || participantIds.length < 2) {
    console.warn(`[BracketGenerator] generatePoolSystem called with less than 2 participants for group ${fightGroupId}. Returning empty.`);
    return [];
  }

  const shuffled = shuffle(participantIds);
  const n = shuffled.length;
  const half = Math.ceil(n / 2);

  const poolAIds = shuffled.slice(0, half);
  const poolBIds = shuffled.slice(half);

  // Generate round robin for Pool A
  const poolAMatches = generateRoundRobin(fightGroupId, poolAIds).map(m => ({
    ...m,
    poolName: 'Pool A',
  }));

  // Generate round robin for Pool B
  const poolBMatches = generateRoundRobin(fightGroupId, poolBIds).map(m => ({
    ...m,
    poolName: 'Pool B',
  }));

  // Semifinals (Round 10, positions 0 and 1)
  const sfMatches: Omit<Match, 'id'>[] = [
    {
      fightGroupId,
      round: 10,
      position: 0,
      fighter1Id: null,
      fighter2Id: null,
      winnerId: null,
      score1: 0,
      score2: 0,
      status: 'pending',
      matNumber: 0,
      scheduledOrder: 0,
      poolName: 'Halbfinale',
    },
    {
      fightGroupId,
      round: 10,
      position: 1,
      fighter1Id: null,
      fighter2Id: null,
      winnerId: null,
      score1: 0,
      score2: 0,
      status: 'pending',
      matNumber: 0,
      scheduledOrder: 0,
      poolName: 'Halbfinale',
    },
  ];

  // Final (Round 11, position 0)
  const finalMatch: Omit<Match, 'id'>[] = [
    {
      fightGroupId,
      round: 11,
      position: 0,
      fighter1Id: null,
      fighter2Id: null,
      winnerId: null,
      score1: 0,
      score2: 0,
      status: 'pending',
      matNumber: 0,
      scheduledOrder: 0,
      poolName: 'Finale',
    },
  ];

  return [...poolAMatches, ...poolBMatches, ...sfMatches, ...finalMatch];
}

export function calculatePoolRankings(poolMatches: Match[]): string[] {
  const statsMap = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }>();

  // Collect all unique participant IDs from the matches
  for (const m of poolMatches) {
    if (m.fighter1Id) statsMap.set(m.fighter1Id, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
    if (m.fighter2Id) statsMap.set(m.fighter2Id, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  for (const m of poolMatches) {
    if (m.status !== 'completed' && m.status !== 'walkover' && m.status !== 'disqualification') continue;

    if (m.fighter1Id && m.fighter2Id) {
      const s1 = statsMap.get(m.fighter1Id)!;
      const s2 = statsMap.get(m.fighter2Id)!;

      s1.pointsFor += m.score1;
      s1.pointsAgainst += m.score2;
      s2.pointsFor += m.score2;
      s2.pointsAgainst += m.score1;

      if (m.winnerId === m.fighter1Id) {
        s1.wins++;
        s2.losses++;
      } else if (m.winnerId === m.fighter2Id) {
        s2.wins++;
        s1.losses++;
      }
    }
  }

  return Array.from(statsMap.entries())
    .map(([id, stats]) => ({
      id,
      wins: stats.wins,
      diff: stats.pointsFor - stats.pointsAgainst,
      pointsFor: stats.pointsFor,
    }))
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor)
    .map(x => x.id);
}

export function getPoolAdvancementUpdates(allMatches: Match[]): { matchId: string; updates: Partial<Match> }[] {
  const poolAMatches = allMatches.filter(m => m.poolName === 'Pool A');
  const poolBMatches = allMatches.filter(m => m.poolName === 'Pool B');
  const sf1 = allMatches.find(m => m.poolName === 'Halbfinale' && m.position === 0);
  const sf2 = allMatches.find(m => m.poolName === 'Halbfinale' && m.position === 1);

  if (!sf1 || !sf2) return [];

  const finishedA = poolAMatches.length > 0 && poolAMatches.every(m => m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification');
  const finishedB = poolBMatches.length > 0 && poolBMatches.every(m => m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification');

  const rankA = finishedA ? calculatePoolRankings(poolAMatches) : [];
  const rankB = finishedB ? calculatePoolRankings(poolBMatches) : [];

  const targetSF1_f1 = rankA[0] || null; // 1st A
  const targetSF1_f2 = rankB[1] || null; // 2nd B

  const targetSF2_f1 = rankB[0] || null; // 1st B
  const targetSF2_f2 = rankA[1] || null; // 2nd A

  const updates: { matchId: string; updates: Partial<Match> }[] = [];

  // SF1
  if (sf1.fighter1Id !== targetSF1_f1 || sf1.fighter2Id !== targetSF1_f2) {
    const sf1Updates: Partial<Match> = {
      fighter1Id: targetSF1_f1,
      fighter2Id: targetSF1_f2,
    };
    if (sf1.status !== 'pending' || sf1.winnerId || sf1.score1 || sf1.score2) {
      sf1Updates.status = 'pending';
      sf1Updates.winnerId = null;
      sf1Updates.score1 = 0;
      sf1Updates.score2 = 0;
      sf1Updates.timerEndsAt = undefined;
      sf1Updates.timerPausedRemaining = undefined;
      sf1Updates.fightRound = undefined;
      sf1Updates.isExtension = undefined;
    }
    updates.push({ matchId: sf1.id, updates: sf1Updates });

    const sf1Clone = { ...sf1, ...sf1Updates };
    const cascades = collectCascadeResets(allMatches, sf1Clone);
    updates.push(...cascades);
  }

  // SF2
  if (sf2.fighter1Id !== targetSF2_f1 || sf2.fighter2Id !== targetSF2_f2) {
    const sf2Updates: Partial<Match> = {
      fighter1Id: targetSF2_f1,
      fighter2Id: targetSF2_f2,
    };
    if (sf2.status !== 'pending' || sf2.winnerId || sf2.score1 || sf2.score2) {
      sf2Updates.status = 'pending';
      sf2Updates.winnerId = null;
      sf2Updates.score1 = 0;
      sf2Updates.score2 = 0;
      sf2Updates.timerEndsAt = undefined;
      sf2Updates.timerPausedRemaining = undefined;
      sf2Updates.fightRound = undefined;
      sf2Updates.isExtension = undefined;
    }
    updates.push({ matchId: sf2.id, updates: sf2Updates });

    const sf2Clone = { ...sf2, ...sf2Updates };
    const cascades = collectCascadeResets(allMatches, sf2Clone);
    updates.push(...cascades);
  }

  return updates;
}
