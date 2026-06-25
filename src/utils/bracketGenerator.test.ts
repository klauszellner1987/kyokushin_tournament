import { describe, it, expect } from 'vitest';
import {
  generateSingleElimination,
  generateRoundRobin,
  advanceWinner,
  generatePoolSystem,
  calculatePoolRankings,
  getPoolAdvancementUpdates,
} from './bracketGenerator';
import type { Match } from '../types';

describe('bracketGenerator', () => {
  describe('generateSingleElimination', () => {
    it('should return empty array if less than 2 participants', () => {
      expect(generateSingleElimination('g1', [])).toEqual([]);
      expect(generateSingleElimination('g1', ['p1'])).toEqual([]);
    });

    it('should generate a correct bracket for 2 participants (1 round, 1 match)', () => {
      const matches = generateSingleElimination('g1', ['p1', 'p2']);
      expect(matches).toHaveLength(1);
      expect(matches[0].round).toBe(1);
      expect(matches[0].position).toBe(0);
      expect(matches[0].status).toBe('pending');
      expect([matches[0].fighter1Id, matches[0].fighter2Id].sort()).toEqual(['p1', 'p2'].sort());
    });

    it('should generate a correct bracket for 3 participants (2 rounds, 3 total matches, 1 bye)', () => {
      const matches = generateSingleElimination('g1', ['p1', 'p2', 'p3']);
      // Next power of 2 is 4 -> bracket size 4.
      // Round 1: 2 matches. Round 2: 1 match. Total = 3 matches.
      expect(matches).toHaveLength(3);
      
      const round1 = matches.filter(m => m.round === 1);
      expect(round1).toHaveLength(2);
      
      // One match should be a bye, one should be pending
      const byes = round1.filter(m => m.status === 'bye');
      const pending = round1.filter(m => m.status === 'pending');
      
      expect(byes).toHaveLength(1);
      expect(pending).toHaveLength(1);
      expect(byes[0].winnerId).toBeDefined(); // The bye slot automatically advances

      const round2 = matches.filter(m => m.round === 2);
      expect(round2).toHaveLength(1);
      expect(round2[0].fighter1Id).toBeNull();
      expect(round2[0].fighter2Id).toBeNull();
    });

    it('should generate a correct bracket for 4 participants (2 rounds, 3 matches total)', () => {
      const matches = generateSingleElimination('g1', ['p1', 'p2', 'p3', 'p4']);
      expect(matches).toHaveLength(3); // 2 in first round, 1 in second round
      
      const round1 = matches.filter(m => m.round === 1);
      expect(round1).toHaveLength(2);
      expect(round1.every(m => m.status === 'pending')).toBe(true);

      const round2 = matches.filter(m => m.round === 2);
      expect(round2).toHaveLength(1);
    });
  });

  describe('generateRoundRobin', () => {
    it('should return empty array if less than 2 participants', () => {
      expect(generateRoundRobin('g1', [])).toEqual([]);
      expect(generateRoundRobin('g1', ['p1'])).toEqual([]);
    });

    it('should generate correct matches for 3 participants (3 rounds, 1 match per round)', () => {
      const matches = generateRoundRobin('g1', ['p1', 'p2', 'p3']);
      // For 3 participants -> 4 with BYE.
      // 3 rounds, each round has 2 matches but 1 is against BYE (ignored).
      // So 1 valid match per round -> 3 matches total.
      expect(matches).toHaveLength(3);
      
      const rounds = [...new Set(matches.map(m => m.round))];
      expect(rounds).toEqual([1, 2, 3]);

      // Every participant should play exactly 2 matches
      const p1Matches = matches.filter(m => m.fighter1Id === 'p1' || m.fighter2Id === 'p1');
      const p2Matches = matches.filter(m => m.fighter1Id === 'p2' || m.fighter2Id === 'p2');
      const p3Matches = matches.filter(m => m.fighter1Id === 'p3' || m.fighter2Id === 'p3');

      expect(p1Matches).toHaveLength(2);
      expect(p2Matches).toHaveLength(2);
      expect(p3Matches).toHaveLength(2);
    });

    it('should generate correct matches for 4 participants (3 rounds, 2 matches per round)', () => {
      const matches = generateRoundRobin('g1', ['p1', 'p2', 'p3', 'p4']);
      expect(matches).toHaveLength(6); // 4 participants -> 6 matches total
      
      const round1 = matches.filter(m => m.round === 1);
      expect(round1).toHaveLength(2);
    });
  });

  describe('advanceWinner', () => {
    it('should return null if completed match has no winner', () => {
      const completedMatch = { id: 'm1', round: 1, position: 0, fightGroupId: 'g1', winnerId: null } as Match;
      expect(advanceWinner([], completedMatch)).toBeNull();
    });

    it('should advance winner to the next round at correct position (top slot)', () => {
      const allMatches = [
        { id: 'm1', round: 1, position: 0, fightGroupId: 'g1' }, // current match
        { id: 'm2', round: 2, position: 0, fightGroupId: 'g1', fighter1Id: null, fighter2Id: null } // next match
      ] as Match[];

      const completedMatch = { id: 'm1', round: 1, position: 0, fightGroupId: 'g1', winnerId: 'p1' } as Match;
      
      const result = advanceWinner(allMatches, completedMatch);
      expect(result).not.toBeNull();
      expect(result?.matchId).toBe('m2');
      expect(result?.updates).toEqual({ fighter1Id: 'p1' });
    });

    it('should advance winner to the next round at correct position (bottom slot)', () => {
      const allMatches = [
        { id: 'm3', round: 1, position: 1, fightGroupId: 'g1' }, // current match
        { id: 'm4', round: 2, position: 0, fightGroupId: 'g1', fighter1Id: null, fighter2Id: null } // next match
      ] as Match[];

      const completedMatch = { id: 'm3', round: 1, position: 1, fightGroupId: 'g1', winnerId: 'p2' } as Match;
      
      const result = advanceWinner(allMatches, completedMatch);
      expect(result).not.toBeNull();
      expect(result?.matchId).toBe('m4');
      expect(result?.updates).toEqual({ fighter2Id: 'p2' });
    });
  });

  describe('Pool System Logic', () => {
    const participants = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

    it('should generate correct pool matches and KO matches', () => {
      const matches = generatePoolSystem('g1', participants);
      // Pool A: 3 participants -> 3 matches
      // Pool B: 3 participants -> 3 matches
      // SF: 2 matches
      // Final: 1 match
      // Total: 9 matches
      expect(matches).toHaveLength(9);

      const poolA = matches.filter(m => m.poolName === 'Pool A');
      const poolB = matches.filter(m => m.poolName === 'Pool B');
      const sf = matches.filter(m => m.poolName === 'Halbfinale');
      const finalMatch = matches.filter(m => m.poolName === 'Finale');

      expect(poolA).toHaveLength(3);
      expect(poolB).toHaveLength(3);
      expect(sf).toHaveLength(2);
      expect(finalMatch).toHaveLength(1);

      expect(sf[0].round).toBe(10);
      expect(sf[0].position).toBe(0);
      expect(finalMatch[0].round).toBe(11);
      expect(finalMatch[0].position).toBe(0);
    });

    it('should calculate pool rankings correctly based on wins and points', () => {
      const poolMatches = [
        { fighter1Id: 'p1', fighter2Id: 'p2', winnerId: 'p1', score1: 3, score2: 1, status: 'completed' },
        { fighter1Id: 'p2', fighter2Id: 'p3', winnerId: 'p2', score1: 2, score2: 0, status: 'completed' },
        { fighter1Id: 'p3', fighter2Id: 'p1', winnerId: 'p1', score1: 0, score2: 4, status: 'completed' },
      ] as Match[];

      const rankings = calculatePoolRankings(poolMatches);
      expect(rankings[0]).toBe('p1'); // 2 wins
      expect(rankings[1]).toBe('p2'); // 1 win
      expect(rankings[2]).toBe('p3'); // 0 wins
    });

    it('should calculate advancements correctly when all pool matches are completed', () => {
      const allMatches = ([
        // Pool A (completed)
        { id: 'a1', fightGroupId: 'g1', poolName: 'Pool A', fighter1Id: 'p1', fighter2Id: 'p2', winnerId: 'p1', score1: 3, score2: 0, status: 'completed' },
        { id: 'a2', fightGroupId: 'g1', poolName: 'Pool A', fighter1Id: 'p2', fighter2Id: 'p3', winnerId: 'p2', score1: 2, score2: 0, status: 'completed' },
        { id: 'a3', fightGroupId: 'g1', poolName: 'Pool A', fighter1Id: 'p3', fighter2Id: 'p1', winnerId: 'p1', score1: 0, score2: 4, status: 'completed' },

        // Pool B (completed)
        { id: 'b1', fightGroupId: 'g1', poolName: 'Pool B', fighter1Id: 'p4', fighter2Id: 'p5', winnerId: 'p4', score1: 2, score2: 1, status: 'completed' },
        { id: 'b2', fightGroupId: 'g1', poolName: 'Pool B', fighter1Id: 'p5', fighter2Id: 'p6', winnerId: 'p5', score1: 3, score2: 0, status: 'completed' },
        { id: 'b3', fightGroupId: 'g1', poolName: 'Pool B', fighter1Id: 'p6', fighter2Id: 'p4', winnerId: 'p4', score1: 0, score2: 5, status: 'completed' },

        // SFs (empty)
        { id: 'sf1', fightGroupId: 'g1', poolName: 'Halbfinale', position: 0, round: 10, fighter1Id: null, fighter2Id: null, status: 'pending' },
        { id: 'sf2', fightGroupId: 'g1', poolName: 'Halbfinale', position: 1, round: 10, fighter1Id: null, fighter2Id: null, status: 'pending' },
        { id: 'final', fightGroupId: 'g1', poolName: 'Finale', position: 0, round: 11, fighter1Id: null, fighter2Id: null, status: 'pending' }
      ] as unknown) as Match[];

      const updates = getPoolAdvancementUpdates(allMatches);
      expect(updates).toHaveLength(4);

      const sf1Update = updates.find(u => u.matchId === 'sf1');
      const sf2Update = updates.find(u => u.matchId === 'sf2');

      expect(sf1Update?.updates).toEqual({ fighter1Id: 'p1', fighter2Id: 'p5' }); // 1st A vs 2nd B
      expect(sf2Update?.updates).toEqual({ fighter1Id: 'p4', fighter2Id: 'p2' }); // 1st B vs 2nd A
    });
  });
});
