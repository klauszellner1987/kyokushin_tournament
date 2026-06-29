import { describe, it, expect } from 'vitest';
import { generateRoundRobin, generatePoolSystem } from '../bracketGenerator';
import type { Match } from '../../types';

// Helper to check for self‑matches
const hasSelfMatch = (matches: Match[]) =>
  matches.some(m => m.fighter1Id === m.fighter2Id && m.fighter1Id !== null);

// Helper to check for back‑to‑back matches of the same participant
const hasConsecutiveSameFighter = (matches: Match[]) => {
  let lastIds: (string | null)[] = [];
  for (const m of matches) {
    const ids = [m.fighter1Id, m.fighter2Id].filter(Boolean) as string[];
    if (ids.some(id => lastIds.includes(id))) return true;
    lastIds = ids;
  }
  return false;
};

describe('Bracket Generator – safety checks', () => {
  it('generateRoundRobin must never create a self‑match', () => {
    const participants = ['A', 'B', 'C'];
    const matches = generateRoundRobin('group1', participants);
    expect(hasSelfMatch(matches as Match[])).toBe(false);
  });

  it('generatePoolSystem must not produce self‑matches and must avoid back‑to‑back fights', () => {
    const participants = ['A', 'B', 'C', 'D', 'E', 'F', 'G']; // 7 participants (odd)
    const matches = generatePoolSystem('group1', participants);
    // No self‑matches
    expect(hasSelfMatch(matches as Match[])).toBe(false);
    // No consecutive fights for the same participant
    expect(hasConsecutiveSameFighter(matches as Match[])).toBe(false);
  });
});
