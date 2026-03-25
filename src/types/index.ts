export type TournamentType = 'kumite' | 'kata' | 'mixed';

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  kumite: 'Nur Kumite',
  kata: 'Nur Kata',
  mixed: 'Mixed (Kumite & Kata)',
};

export interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  status: 'draft' | 'running' | 'completed';
  type: TournamentType;
  matCount: number;
  createdAt: number;
  registrationConfirmed?: boolean;
}

export type ParticipantStatus = 'active' | 'withdrawn' | 'injured' | 'disqualified';

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  club: string;
  birthDate: string;
  weight: number;
  beltGrade: BeltGrade;
  gender: 'M' | 'W';
  discipline: Discipline[];
  categoryIds: string[];
  status?: ParticipantStatus;
}

export type Discipline = 'kumite' | 'kata';

export type BeltGrade =
  | '10. Kyu' | '9. Kyu' | '8. Kyu' | '7. Kyu' | '6. Kyu'
  | '5. Kyu' | '4. Kyu' | '3. Kyu' | '2. Kyu' | '1. Kyu'
  | '1. Dan' | '2. Dan' | '3. Dan' | '4. Dan' | '5. Dan'
  | '6. Dan' | '7. Dan' | '8. Dan' | '9. Dan' | '10. Dan';

export const BELT_GRADES: BeltGrade[] = [
  '10. Kyu', '9. Kyu', '8. Kyu', '7. Kyu', '6. Kyu',
  '5. Kyu', '4. Kyu', '3. Kyu', '2. Kyu', '1. Kyu',
  '1. Dan', '2. Dan', '3. Dan', '4. Dan', '5. Dan',
  '6. Dan', '7. Dan', '8. Dan', '9. Dan', '10. Dan',
];

export const BELT_COLORS: Record<string, string> = {
  '10. Kyu': '#FFFFFF',
  '9. Kyu': '#FFFFFF',
  '8. Kyu': '#4169E1',
  '7. Kyu': '#4169E1',
  '6. Kyu': '#FFD700',
  '5. Kyu': '#FFD700',
  '4. Kyu': '#22C55E',
  '3. Kyu': '#22C55E',
  '2. Kyu': '#8B4513',
  '1. Kyu': '#8B4513',
  '1. Dan': '#1a1a1a',
  '2. Dan': '#1a1a1a',
  '3. Dan': '#1a1a1a',
  '4. Dan': '#1a1a1a',
  '5. Dan': '#1a1a1a',
  '6. Dan': '#1a1a1a',
  '7. Dan': '#1a1a1a',
  '8. Dan': '#1a1a1a',
  '9. Dan': '#1a1a1a',
  '10. Dan': '#1a1a1a',
};

export type TournamentFormat = 'single_elimination' | 'round_robin';

export type KataSystem = 'flag' | 'points';

export interface Category {
  id: string;
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  weightMin: number | null;
  weightMax: number | null;
  beltMin: BeltGrade | null;
  beltMax: BeltGrade | null;
  gender: 'M' | 'W' | 'mixed';
  discipline: Discipline;
  tournamentFormat: TournamentFormat;
  fightDuration1?: number;
  fightDuration2?: number;
  boardBreaking?: boolean;
  enableWeightDecision?: boolean;
  weightDecisionThreshold?: number;
  fightDuration3?: number;
  roundsConfigured?: boolean;
  kataSystem?: KataSystem;
}

export interface FightGroup {
  id: string;
  categoryId: string;
  participantIds: string[];
  status: 'pending' | 'running' | 'completed';
}

export type MatchStatus = 'pending' | 'running' | 'completed' | 'bye' | 'walkover' | 'disqualification';

export interface Match {
  id: string;
  fightGroupId: string;
  round: number;
  position: number;
  fighter1Id: string | null;
  fighter2Id: string | null;
  winnerId: string | null;
  score1: number;
  score2: number;
  status: MatchStatus;
  matNumber: number;
  scheduledOrder: number;
  weightDifference?: number;
  timerEndsAt?: number;
  timerPausedRemaining?: number;
  isExtension?: boolean;
  fightRound?: number;
}

export function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getBeltIndex(belt: BeltGrade): number {
  return BELT_GRADES.indexOf(belt);
}

export function formatParticipantName(p: Participant): string {
  return `${p.lastName.toUpperCase()} ${p.firstName}`;
}
