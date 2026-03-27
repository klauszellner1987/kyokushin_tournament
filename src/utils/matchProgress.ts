import type { Match } from '../types';

/** Auszutragende Kämpfe für Fortschrittsanzeigen (Freilos-Zeilen nicht mitzählen). */
export function isScheduledFightForProgress(m: Match): boolean {
  return m.status !== 'bye';
}

/** Finaler Ausgang (normal, W.O. oder DSQ). */
export function isFightFinished(m: Match): boolean {
  return (
    m.status === 'completed' ||
    m.status === 'walkover' ||
    m.status === 'disqualification'
  );
}

export function countFinishedScheduledFights(matches: Match[]): number {
  return matches.filter((m) => isScheduledFightForProgress(m) && isFightFinished(m)).length;
}

export function countScheduledFights(matches: Match[]): number {
  return matches.filter(isScheduledFightForProgress).length;
}
