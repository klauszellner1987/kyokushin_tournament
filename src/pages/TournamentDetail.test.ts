import { describe, it, expect } from 'vitest';
import { getStepStates } from './TournamentDetail';
import type { Category, Match } from '../types';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Test Kategorie',
    ageMin: null,
    ageMax: null,
    weightMin: null,
    weightMax: null,
    beltMin: null,
    beltMax: null,
    gender: 'mixed',
    discipline: 'kumite',
    tournamentFormat: 'single_elimination',
    ...overrides,
  };
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    fightGroupId: 'fg-1',
    round: 1,
    position: 1,
    fighter1Id: 'f1',
    fighter2Id: 'f2',
    winnerId: null,
    score1: 0,
    score2: 0,
    status: 'pending',
    matNumber: 1,
    scheduledOrder: 1,
    ...overrides,
  };
}

describe('getStepStates', () => {
  it('shows participants as next step when tournament is empty', () => {
    const result = getStepStates(0, [], false, [], false);

    expect(result.participants.state).toBe('next');
    expect(result.participants.hint).toBe('Mind. 2 Teilnehmer eintragen');
    expect(result.categories.state).toBe('upcoming');
    expect(result.bracket.state).toBe('upcoming');
    expect(result.control.state).toBe('upcoming');
  });

  it('does not mark participants complete when >= 2 exist but registration open', () => {
    const result = getStepStates(2, [], false, [], false);

    expect(result.participants.state).toBe('next');
    expect(result.participants.hint).toBe('Anmeldung abschließen');
  });

  it('marks participants complete when >= 2 exist and registration closed', () => {
    const result = getStepStates(2, [], false, [], true);

    expect(result.participants.state).toBe('completed');
    expect(result.categories.state).toBe('next');
  });

  it('shows "Mind. 2 Teilnehmer eintragen" when < 2 even if registration closed', () => {
    const result = getStepStates(1, [], false, [], true);

    expect(result.participants.state).toBe('next');
    expect(result.participants.hint).toBe('Mind. 2 Teilnehmer eintragen');
  });

  it('shows "Kategorien erstellen" when no categories exist', () => {
    const result = getStepStates(5, [], false, [], true);

    expect(result.categories.state).toBe('next');
    expect(result.categories.hint).toBe('Kategorien erstellen');
  });

  it('shows "Rundenablauf konfigurieren" when kumite rounds not configured', () => {
    const cat = makeCategory({ discipline: 'kumite', roundsConfigured: false });
    const result = getStepStates(5, [cat], false, [], true);

    expect(result.categories.state).toBe('next');
    expect(result.categories.hint).toBe('Rundenablauf konfigurieren');
  });

  it('shows "Sichtkontrolle durchführen" when categories configured but not confirmed', () => {
    const cat = makeCategory({ discipline: 'kumite', roundsConfigured: true });
    const result = getStepStates(5, [cat], false, [], true);

    expect(result.categories.state).toBe('next');
    expect(result.categories.hint).toBe('Sichtkontrolle durchführen');
  });

  it('marks categories complete when all conditions met', () => {
    const cat = makeCategory({ discipline: 'kumite', roundsConfigured: true });
    const result = getStepStates(5, [cat], true, [], true);

    expect(result.categories.state).toBe('completed');
    expect(result.bracket.state).toBe('next');
    expect(result.bracket.hint).toBe('Turnierbäume generieren');
  });

  it('treats kata categories as always rounds-configured', () => {
    const cat = makeCategory({ discipline: 'kata', roundsConfigured: false });
    const result = getStepStates(5, [cat], false, [], true);

    expect(result.categories.state).toBe('next');
    expect(result.categories.hint).toBe('Sichtkontrolle durchführen');
  });

  it('requires all kumite categories to have rounds configured', () => {
    const cats = [
      makeCategory({ id: 'c1', discipline: 'kumite', roundsConfigured: true }),
      makeCategory({ id: 'c2', discipline: 'kumite', roundsConfigured: false }),
    ];
    const result = getStepStates(5, cats, true, [], true);

    expect(result.categories.state).toBe('next');
    expect(result.categories.hint).toBe('Rundenablauf konfigurieren');
  });

  it('ignores bye matches when checking bracket completion', () => {
    const matches = [
      makeMatch({ id: 'm1', status: 'bye' }),
    ];
    const result = getStepStates(5, [makeCategory({ roundsConfigured: true })], true, matches, true);

    expect(result.bracket.state).toBe('next');
    expect(result.bracket.hint).toBe('Turnierbäume generieren');
  });

  it('marks bracket complete when real matches exist', () => {
    const matches = [
      makeMatch({ id: 'm1', status: 'pending' }),
    ];
    const result = getStepStates(5, [makeCategory({ roundsConfigured: true })], true, matches, true);

    expect(result.bracket.state).toBe('completed');
    expect(result.control.state).toBe('next');
    expect(result.control.hint).toBe('Kämpfe austragen');
  });

  it('marks control complete when all real matches are finished', () => {
    const matches = [
      makeMatch({ id: 'm1', status: 'completed', winnerId: 'f1', score1: 3, score2: 1 }),
      makeMatch({ id: 'm2', status: 'walkover', winnerId: 'f2' }),
      makeMatch({ id: 'm3', status: 'bye' }),
    ];
    const cat = makeCategory({ roundsConfigured: true });
    const result = getStepStates(5, [cat], true, matches, true);

    expect(result.participants.state).toBe('completed');
    expect(result.categories.state).toBe('completed');
    expect(result.bracket.state).toBe('completed');
    expect(result.control.state).toBe('completed');
  });

  it('does not mark control complete if any real match still pending', () => {
    const matches = [
      makeMatch({ id: 'm1', status: 'completed', winnerId: 'f1' }),
      makeMatch({ id: 'm2', status: 'pending' }),
    ];
    const cat = makeCategory({ roundsConfigured: true });
    const result = getStepStates(5, [cat], true, matches, true);

    expect(result.bracket.state).toBe('completed');
    expect(result.control.state).toBe('next');
  });

  it('always sets live to upcoming', () => {
    const result = getStepStates(0, [], false, [], false);
    expect(result.live.state).toBe('upcoming');

    const result2 = getStepStates(5, [makeCategory({ roundsConfigured: true })], true, [
      makeMatch({ status: 'completed', winnerId: 'f1' }),
    ], true);
    expect(result2.live.state).toBe('upcoming');
  });

  it('handles mixed kumite/kata categories correctly', () => {
    const cats = [
      makeCategory({ id: 'c1', discipline: 'kumite', roundsConfigured: true }),
      makeCategory({ id: 'c2', discipline: 'kata', roundsConfigured: false }),
    ];
    const result = getStepStates(5, cats, true, [], true);

    expect(result.categories.state).toBe('completed');
  });

  it('handles disqualification as finished match', () => {
    const matches = [
      makeMatch({ id: 'm1', status: 'disqualification', winnerId: 'f1' }),
    ];
    const cat = makeCategory({ roundsConfigured: true });
    const result = getStepStates(5, [cat], true, matches, true);

    expect(result.control.state).toBe('completed');
  });
});
