import { useState, useMemo } from 'react';
import { Play, AlertTriangle, Trophy, ArrowLeft, Users, CheckCircle, Clock, Circle, Medal, Scale } from 'lucide-react';
import type { Category, FightGroup, Match, Participant } from '../../types';
import { autoAssign } from '../../utils/groupAssignment';
import { generateSingleElimination, generateRoundRobin, advanceWinner, collectCascadeResets, countDownstreamResets, hasRunningDownstream } from '../../utils/bracketGenerator';
import { distributeCategoriesToMats, scheduleMatchesToMats } from '../../utils/matScheduler';
import BracketTree from './BracketTree';

interface Props {
  tournamentId: string;
  categories: Category[];
  fightGroups: {
    data: FightGroup[];
    add: (item: Omit<FightGroup, 'id'>) => Promise<string>;
    update: (id: string, updates: Partial<FightGroup>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  matches: {
    data: Match[];
    add: (item: Omit<Match, 'id'>) => Promise<string>;
    update: (id: string, updates: Partial<Match>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  participants: Participant[];
  matCount: number;
  registrationConfirmed: boolean;
}

function getFormatLabel(cat: Category): string {
  if (cat.discipline === 'kata') {
    return (cat.kataSystem ?? 'points') === 'flag' ? 'K.O. (Flagge)' : 'Round Robin (Punkte)';
  }
  return 'Single Elimination (K.O.)';
}

interface CategoryStats {
  participantCount: number;
  totalMatches: number;
  completedMatches: number;
  hasResults: boolean;
  status: 'empty' | 'running' | 'completed';
  championName: string | null;
}

export default function BracketView({
  categories,
  fightGroups,
  matches,
  participants,
  matCount,
  registrationConfirmed,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<Match | null>(null);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [weightEditMatch, setWeightEditMatch] = useState<string | null>(null);
  const [weightValue, setWeightValue] = useState('');
  const [correctionModal, setCorrectionModal] = useState<Match | null>(null);
  const [corrScore1, setCorrScore1] = useState(0);
  const [corrScore2, setCorrScore2] = useState(0);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const { assignments } = useMemo(
    () => autoAssign(participants, categories, registrationConfirmed),
    [participants, categories, registrationConfirmed],
  );

  const getName = (id: string | null) => {
    if (!id) return 'Noch offen';
    const p = participantMap.get(id);
    return p ? `${p.lastName}, ${p.firstName}` : 'Noch offen';
  };

  const getClub = (id: string | null) => {
    if (!id) return '';
    const p = participantMap.get(id);
    return p?.club ?? '';
  };

  const isWithdrawn = (id: string | null) => {
    if (!id) return false;
    const p = participantMap.get(id);
    const s = p?.status ?? 'active';
    return s === 'withdrawn' || s === 'injured' || s === 'disqualified';
  };

  const getMatchesForCategory = (categoryId: string) => {
    const groups = fightGroups.data.filter((g) => g.categoryId === categoryId);
    return matches.data.filter((m) => groups.some((g) => g.id === m.fightGroupId));
  };

  const categoryStats = useMemo(() => {
    const stats = new Map<string, CategoryStats>();
    for (const cat of categories) {
      const assignment = assignments.find((a) => a.categoryId === cat.id);
      const catMatches = getMatchesForCategory(cat.id);
      const realMatches = catMatches.filter((m) => m.status !== 'bye');
      const completed = realMatches.filter((m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification');
      const hasResults = completed.length > 0;

      let status: CategoryStats['status'] = 'empty';
      let championName: string | null = null;

      if (catMatches.length > 0) {
        const allDone = realMatches.length > 0 && realMatches.every((m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification');
        if (allDone) {
          status = 'completed';
          if (cat.tournamentFormat === 'round_robin' && (cat.kataSystem ?? 'points') !== 'flag') {
            const winsMap = new Map<string, { wins: number; diff: number }>();
            for (const m of realMatches) {
              for (const fId of [m.fighter1Id, m.fighter2Id]) {
                if (fId && !winsMap.has(fId)) winsMap.set(fId, { wins: 0, diff: 0 });
              }
              if (m.winnerId) {
                const w = winsMap.get(m.winnerId);
                if (w) w.wins++;
              }
              if (m.fighter1Id) { const s = winsMap.get(m.fighter1Id); if (s) s.diff += m.score1 - m.score2; }
              if (m.fighter2Id) { const s = winsMap.get(m.fighter2Id); if (s) s.diff += m.score2 - m.score1; }
            }
            const sorted = Array.from(winsMap.entries()).sort((a, b) => b[1].wins - a[1].wins || b[1].diff - a[1].diff);
            if (sorted.length > 0) championName = getName(sorted[0][0]);
          } else {
            const maxRound = Math.max(...catMatches.map((m) => m.round), 0);
            const finalMatch = catMatches.find((m) => m.round === maxRound);
            if (finalMatch?.winnerId) {
              championName = getName(finalMatch.winnerId);
            }
          }
        } else {
          status = 'running';
        }
      }

      stats.set(cat.id, {
        participantCount: assignment?.participantIds.length ?? 0,
        totalMatches: realMatches.length,
        completedMatches: completed.length,
        hasResults,
        status,
        championName,
      });
    }
    return stats;
  }, [categories, assignments, fightGroups.data, matches.data]);

  // --- Detail view data ---
  const category = activeCategory ? categories.find((c) => c.id === activeCategory) : null;
  const groupsForCategory = activeCategory
    ? fightGroups.data.filter((g) => g.categoryId === activeCategory)
    : [];
  const matchesForCategory = activeCategory
    ? matches.data.filter((m) => groupsForCategory.some((g) => g.id === m.fightGroupId))
    : [];

  const rounds = new Map<number, Match[]>();
  for (const m of matchesForCategory) {
    const existing = rounds.get(m.round) ?? [];
    existing.push(m);
    rounds.set(m.round, existing);
  }
  const totalRounds = Math.max(...Array.from(rounds.keys()), 0);

  const roundRobinRanking = useMemo(() => {
    if (category?.tournamentFormat !== 'round_robin' || matchesForCategory.length === 0) return [];

    const statsMap = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }>();

    for (const m of matchesForCategory) {
      if (m.status !== 'completed' && m.status !== 'walkover' && m.status !== 'disqualification') continue;

      for (const fId of [m.fighter1Id, m.fighter2Id]) {
        if (fId && !statsMap.has(fId)) {
          statsMap.set(fId, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
        }
      }

      if (m.fighter1Id) {
        const s = statsMap.get(m.fighter1Id)!;
        s.pointsFor += m.score1;
        s.pointsAgainst += m.score2;
        if (m.winnerId === m.fighter1Id) s.wins++;
        else s.losses++;
      }
      if (m.fighter2Id) {
        const s = statsMap.get(m.fighter2Id)!;
        s.pointsFor += m.score2;
        s.pointsAgainst += m.score1;
        if (m.winnerId === m.fighter2Id) s.wins++;
        else s.losses++;
      }
    }

    return Array.from(statsMap.entries())
      .map(([id, s]) => ({
        participantId: id,
        name: getName(id),
        club: getClub(id),
        wins: s.wins,
        losses: s.losses,
        pointsFor: s.pointsFor,
        pointsAgainst: s.pointsAgainst,
        diff: s.pointsFor - s.pointsAgainst,
      }))
      .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor);
  }, [matchesForCategory, category]);

  const handleGenerateRequest = () => {
    if (!category) return;
    setGenerateError(null);
    if (matchesForCategory.length > 0) {
      setShowRegenerateConfirm(true);
    } else {
      executeGenerate();
    }
  };

  const executeGenerate = async () => {
    if (!category || !activeCategory) return;
    setShowRegenerateConfirm(false);

    for (const g of groupsForCategory) {
      const groupMatches = matches.data.filter((m) => m.fightGroupId === g.id);
      for (const m of groupMatches) await matches.remove(m.id);
      await fightGroups.remove(g.id);
    }

    const { assignments: catAssignments } = autoAssign(participants, [category], registrationConfirmed);
    const assignment = catAssignments[0];
    if (!assignment || assignment.participantIds.length < 2) {
      const count = assignment?.participantIds.length ?? 0;
      setGenerateError(
        count === 0
          ? `Keine Teilnehmer passen in die Kategorie "${category.name}". Prüfe Disziplin, Alter, Gewicht und Geschlecht der Teilnehmer.`
          : `Nur ${count} Teilnehmer in "${category.name}". Mindestens 2 werden benötigt.`,
      );
      return;
    }

    const groupId = await fightGroups.add({
      categoryId: category.id,
      participantIds: assignment.participantIds,
      status: 'pending',
    });

    let generatedMatches: Omit<Match, 'id'>[];
    const useRoundRobin = category.tournamentFormat === 'round_robin' && (category.kataSystem ?? 'points') !== 'flag';
    if (useRoundRobin) {
      generatedMatches = generateRoundRobin(groupId, assignment.participantIds);
    } else {
      generatedMatches = generateSingleElimination(groupId, assignment.participantIds);
    }

    const addedMatches: Match[] = [];
    for (const m of generatedMatches) {
      const id = await matches.add(m);
      addedMatches.push({ ...m, id } as Match);
    }

    for (const m of addedMatches) {
      if (m.status === 'bye' && m.winnerId) {
        const advance = advanceWinner(addedMatches, m);
        if (advance) {
          await matches.update(advance.matchId, advance.updates);
          const target = addedMatches.find((x) => x.id === advance.matchId);
          if (target) Object.assign(target, advance.updates);
        }
      }
    }

    const allGroups = [
      ...fightGroups.data.filter((g) => g.categoryId !== category.id),
      { id: groupId, categoryId: category.id, participantIds: assignment.participantIds, status: 'running' as const },
    ];
    const allMatches = [
      ...matches.data.filter((m) => !addedMatches.some((a) => a.id === m.id)),
      ...addedMatches,
    ];
    const matAssignments = distributeCategoriesToMats(categories, allGroups, allMatches, matCount);
    const schedule = scheduleMatchesToMats(addedMatches, allGroups, matAssignments);

    for (const s of schedule) {
      await matches.update(s.matchId, { matNumber: s.matNumber, scheduledOrder: s.scheduledOrder });
    }

    await fightGroups.update(groupId, { status: 'running' });
  };

  const handleResult = async () => {
    if (!resultModal) return;

    const winnerId =
      score1 > score2 ? resultModal.fighter1Id : resultModal.fighter2Id;

    await matches.update(resultModal.id, {
      winnerId,
      score1,
      score2,
      status: 'completed',
    });

    const updatedMatch = { ...resultModal, winnerId, score1, score2, status: 'completed' as const };
    const advance = advanceWinner(matchesForCategory, updatedMatch);
    if (advance) {
      await matches.update(advance.matchId, advance.updates);
    }

    setResultModal(null);
    setScore1(0);
    setScore2(0);
  };

  const handleOpenCorrection = (match: Match) => {
    const catMatches = getMatchesForCategory(activeCategory!);
    if (hasRunningDownstream(catMatches, match)) {
      setCorrectionError('Korrektur nicht möglich, solange ein Folgekampf läuft.');
      return;
    }
    setCorrectionError(null);
    setCorrectionModal(match);
    setCorrScore1(match.score1);
    setCorrScore2(match.score2);
  };

  const handleCorrectResult = async () => {
    if (!correctionModal) return;

    const newWinnerId =
      corrScore1 > corrScore2 ? correctionModal.fighter1Id : correctionModal.fighter2Id;
    const oldWinnerId = correctionModal.winnerId;
    const winnerChanged = newWinnerId !== oldWinnerId;

    await matches.update(correctionModal.id, {
      winnerId: newWinnerId,
      score1: corrScore1,
      score2: corrScore2,
      status: 'completed',
    });

    if (winnerChanged) {
      const catMatches = getMatchesForCategory(activeCategory!);
      const updatedMatch: Match = {
        ...correctionModal,
        winnerId: newWinnerId,
        score1: corrScore1,
        score2: corrScore2,
        status: 'completed',
      };

      const resets = collectCascadeResets(catMatches, correctionModal);
      for (const reset of resets) {
        await matches.update(reset.matchId, reset.updates);
      }

      const advance = advanceWinner(catMatches, updatedMatch);
      if (advance) {
        await matches.update(advance.matchId, advance.updates);
      }
    }

    setCorrectionModal(null);
    setCorrScore1(0);
    setCorrScore2(0);
  };

  const handleWeightSave = async (matchId: string) => {
    const val = parseFloat(weightValue);
    if (!isNaN(val) && val > 0) {
      await matches.update(matchId, { weightDifference: val });
    } else {
      await matches.update(matchId, { weightDifference: undefined });
    }
    setWeightEditMatch(null);
    setWeightValue('');
  };

  // ===================== OVERVIEW =====================
  if (activeCategory === null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Turnierbaum</h3>
            <p className="text-sm text-kyokushin-text-muted">
              {categories.length} Kategorien
            </p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle size={48} className="mx-auto text-kyokushin-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Keine Kategorien vorhanden</h3>
            <p className="text-kyokushin-text-muted">
              Erstelle zuerst Kategorien im Kategorien-Tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const stats = categoryStats.get(cat.id);
              if (!stats) return null;

              const statusColor =
                stats.status === 'completed'
                  ? 'border-green-500/50 hover:border-green-500'
                  : stats.status === 'running'
                    ? 'border-amber-500/50 hover:border-amber-500'
                    : 'border-kyokushin-border hover:border-kyokushin-red';

              const StatusIcon =
                stats.status === 'completed'
                  ? CheckCircle
                  : stats.status === 'running'
                    ? Clock
                    : Circle;

              const statusIconColor =
                stats.status === 'completed'
                  ? 'text-green-400'
                  : stats.status === 'running'
                    ? 'text-amber-400'
                    : 'text-kyokushin-text-muted';

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`bg-kyokushin-card border rounded-xl p-5 text-left transition-all cursor-pointer ${statusColor}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-white text-sm">{cat.name}</h4>
                    <StatusIcon size={18} className={statusIconColor} />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-kyokushin-bg px-2 py-0.5 rounded text-xs text-kyokushin-text-muted">
                      {getFormatLabel(cat)}
                    </span>
                    <span className="flex items-center gap-1 bg-kyokushin-bg px-2 py-0.5 rounded text-xs text-kyokushin-text-muted">
                      <Users size={10} />
                      {stats.participantCount}
                    </span>
                  </div>

                  {stats.status === 'empty' && (
                    <p className="text-xs text-kyokushin-text-muted">
                      {stats.participantCount === 0 && registrationConfirmed
                        ? 'Kein Kampf – keine Teilnehmer'
                        : cat.discipline === 'kumite' && !cat.roundsConfigured
                          ? 'Runden nicht konfiguriert'
                          : 'Noch kein Turnierbaum generiert'}
                    </p>
                  )}
                  {cat.discipline === 'kumite' && !cat.roundsConfigured && stats.status === 'empty' && (
                    <p className="text-xs text-orange-400 flex items-center gap-1 mt-1">
                      <AlertTriangle size={10} />
                      Einstellungen fehlen
                    </p>
                  )}

                  {stats.status === 'running' && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-amber-400">
                          {stats.completedMatches} von {stats.totalMatches} Kämpfen
                        </span>
                      </div>
                      <div className="w-full bg-kyokushin-bg rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${stats.totalMatches > 0 ? (stats.completedMatches / stats.totalMatches) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {stats.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <Trophy size={14} className="text-kyokushin-gold" />
                      <span className="text-sm font-medium text-kyokushin-gold">
                        {stats.championName ?? 'Abgeschlossen'}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===================== DETAIL VIEW =====================
  const detailStats = categoryStats.get(activeCategory);
  const detailParticipantCount = detailStats?.participantCount ?? 0;
  const categoryRoundsConfigured = category?.discipline === 'kata' || !!category?.roundsConfigured;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setActiveCategory(null);
              setResultModal(null);
              setGenerateError(null);
            }}
            className="flex items-center gap-2 text-kyokushin-text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Übersicht</span>
          </button>
          <div className="h-6 w-px bg-kyokushin-border" />
          <h3 className="text-lg font-semibold text-white">
            {category?.name ?? ''}
          </h3>
          {category && (
            <>
              <span className="bg-kyokushin-bg border border-kyokushin-border px-3 py-1 rounded-full text-xs text-kyokushin-text-muted">
                {getFormatLabel(category)}
              </span>
              {category.discipline === 'kumite' && category.fightDuration1 && (
                <span className="bg-kyokushin-bg border border-kyokushin-border px-3 py-1 rounded-full text-xs text-kyokushin-text-muted">
                  R1: {Math.floor(category.fightDuration1 / 60)}:{String(category.fightDuration1 % 60).padStart(2, '0')}
                  {category.fightDuration2 && <> / R2: {Math.floor(category.fightDuration2 / 60)}:{String(category.fightDuration2 % 60).padStart(2, '0')}</>}
                </span>
              )}
              {category.enableWeightDecision && (
                <span className="bg-blue-500/15 border border-blue-500/30 px-3 py-1 rounded-full text-xs text-blue-400">
                  R3: Gewicht ({category.weightDecisionThreshold ?? 3} kg)
                </span>
              )}
              {category.fightDuration3 && (
                <span className="bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full text-xs text-amber-400">
                  R3: Pflichtentscheid
                </span>
              )}
              {category.boardBreaking && (
                <span className="bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full text-xs text-amber-400">
                  Bruchtest
                </span>
              )}
              {category.discipline === 'kata' && (
                <span className="bg-kyokushin-bg border border-kyokushin-border px-3 py-1 rounded-full text-xs text-kyokushin-text-muted">
                  {(category.kataSystem ?? 'points') === 'flag' ? 'Flaggensystem' : 'Punktesystem'}
                </span>
              )}
            </>
          )}
        </div>

        <button
          onClick={handleGenerateRequest}
          disabled={!category || detailParticipantCount < 2 || !registrationConfirmed || !categoryRoundsConfigured}
          className="flex items-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Play size={16} />
          Turnierbaum generieren
        </button>
      </div>

      {!registrationConfirmed && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">Registrierung noch nicht abgeschlossen</p>
            <p className="text-sm text-kyokushin-text-muted mt-1">
              Bitte zuerst im Kategorien-Tab die Sichtkontrolle durchführen und bestätigen, bevor Turnierbäume generiert werden können.
            </p>
          </div>
        </div>
      )}

      {registrationConfirmed && !categoryRoundsConfigured && (
        <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-orange-400 font-medium">Rundenablauf nicht konfiguriert</p>
            <p className="text-sm text-kyokushin-text-muted mt-1">
              Bitte zuerst im Kategorien-Tab die Kampfzeiten und Rundeneinstellungen für diese Kategorie konfigurieren, bevor der Turnierbaum generiert werden kann.
            </p>
          </div>
        </div>
      )}

      {generateError && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">Generierung nicht möglich</p>
            <p className="text-sm text-kyokushin-text-muted mt-1">{generateError}</p>
          </div>
          <button onClick={() => setGenerateError(null)} className="ml-auto text-kyokushin-text-muted hover:text-white shrink-0">
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
      )}

      {matchesForCategory.length === 0 ? (
        <div className="text-center py-16">
          <Play size={48} className="mx-auto text-kyokushin-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Kein Turnierbaum vorhanden
          </h3>
          <p className="text-kyokushin-text-muted mb-6">
            {!registrationConfirmed
              ? 'Bitte zuerst die Sichtkontrolle im Kategorien-Tab abschließen.'
              : !categoryRoundsConfigured
                ? 'Bitte zuerst im Kategorien-Tab den Rundenablauf konfigurieren.'
                : detailParticipantCount === 0
                  ? 'Kein Kampf – keine Teilnehmer in dieser Kategorie zugewiesen.'
                  : detailParticipantCount < 2
                    ? `Nur ${detailParticipantCount} Teilnehmer in dieser Kategorie. Mindestens 2 benötigt.`
                    : `${detailParticipantCount} Teilnehmer bereit. Klicke auf "Turnierbaum generieren".`}
          </p>
          {detailParticipantCount >= 2 && registrationConfirmed && categoryRoundsConfigured && (
            <button
              onClick={handleGenerateRequest}
              className="inline-flex items-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Play size={18} />
              Turnierbaum generieren
            </button>
          )}
        </div>
      ) : category?.tournamentFormat === 'round_robin' && (category?.kataSystem ?? 'points') !== 'flag' ? (
        <div className="space-y-6">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kyokushin-border">
                  <th className="text-left px-4 py-3 text-kyokushin-text-muted font-medium">Runde</th>
                  <th className="text-left px-4 py-3 text-kyokushin-text-muted font-medium">Kämpfer 1</th>
                  <th className="text-center px-4 py-3 text-kyokushin-text-muted font-medium">vs</th>
                  <th className="text-left px-4 py-3 text-kyokushin-text-muted font-medium">Kämpfer 2</th>
                  <th className="text-center px-4 py-3 text-kyokushin-text-muted font-medium">Ergebnis</th>
                  <th className="text-right px-4 py-3 text-kyokushin-text-muted font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {matchesForCategory
                  .sort((a, b) => a.round - b.round || a.position - b.position)
                  .map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b border-kyokushin-border/50 hover:bg-kyokushin-card-hover ${m.status === 'walkover' ? 'bg-amber-500/5' : m.status === 'disqualification' ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="px-4 py-3 text-kyokushin-text-muted">{m.round}</td>
                      <td className={`px-4 py-3 ${m.winnerId === m.fighter1Id ? 'text-kyokushin-gold font-bold' : 'text-white'}`}>
                        <span className={isWithdrawn(m.fighter1Id) ? 'line-through opacity-60' : ''}>
                          {getName(m.fighter1Id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-kyokushin-red font-bold">VS</td>
                      <td className={`px-4 py-3 ${m.winnerId === m.fighter2Id ? 'text-kyokushin-gold font-bold' : 'text-white'}`}>
                        <span className={isWithdrawn(m.fighter2Id) ? 'line-through opacity-60' : ''}>
                          {getName(m.fighter2Id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-white">
                        {m.status === 'walkover'
                          ? <span className="text-amber-400 font-medium">W.O.</span>
                          : m.status === 'disqualification'
                            ? <span className="text-red-400 font-medium">DSQ</span>
                            : m.status === 'completed' ? `${m.score1} : ${m.score2}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {m.weightDifference && (
                            <span className="text-[10px] bg-kyokushin-bg px-1.5 py-0.5 rounded text-kyokushin-text-muted">
                              +{m.weightDifference} kg
                            </span>
                          )}
                          {m.fighter1Id && m.fighter2Id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setWeightEditMatch(weightEditMatch === m.id ? null : m.id); setWeightValue(m.weightDifference?.toString() ?? ''); }}
                              className="text-kyokushin-text-muted hover:text-white transition-colors"
                              title="Gewichtsunterschied"
                            >
                              <Scale size={12} />
                            </button>
                          )}
                          {m.status !== 'completed' && m.status !== 'walkover' && m.status !== 'disqualification' && m.fighter1Id && m.fighter2Id && (
                            <button
                              onClick={() => { setResultModal(m); setScore1(0); setScore2(0); }}
                              className="text-kyokushin-red hover:text-kyokushin-gold text-xs font-medium transition-colors"
                            >
                              Ergebnis
                            </button>
                          )}
                          {(m.status === 'completed') && (
                            <button
                              onClick={() => { setCorrectionModal(m); setCorrScore1(m.score1); setCorrScore2(m.score2); }}
                              className="text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors"
                            >
                              Korrigieren
                            </button>
                          )}
                        </div>
                        {weightEditMatch === m.id && (
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={weightValue}
                              onChange={(e) => setWeightValue(e.target.value)}
                              placeholder="kg"
                              className="w-16 bg-kyokushin-bg border border-kyokushin-border rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-kyokushin-red"
                            />
                            <button onClick={() => handleWeightSave(m.id)} className="text-green-400 hover:text-green-300 text-xs font-medium">OK</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {roundRobinRanking.length > 0 && (() => {
            const realMatches = matchesForCategory.filter((m) => m.status !== 'bye');
            const allDone = realMatches.length > 0 && realMatches.every((m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification');
            const podium = roundRobinRanking.slice(0, 3);
            const podiumColors = [
              { border: 'border-kyokushin-gold', bg: 'bg-kyokushin-gold/10', text: 'text-kyokushin-gold', label: '1. Platz' },
              { border: 'border-gray-400', bg: 'bg-gray-400/10', text: 'text-gray-300', label: '2. Platz' },
              { border: 'border-amber-700', bg: 'bg-amber-700/10', text: 'text-amber-600', label: '3. Platz' },
            ];

            return (
              <>
                {allDone && podium.length >= 2 && (
                  <div>
                    <h4 className="text-sm font-medium text-kyokushin-text-muted mb-4">Podium</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {podium.map((entry, i) => (
                        <div
                          key={entry.participantId}
                          className={`bg-kyokushin-card border-2 ${podiumColors[i].border} rounded-xl p-5 text-center`}
                        >
                          {i === 0 ? (
                            <Trophy size={28} className={`mx-auto mb-2 ${podiumColors[i].text}`} />
                          ) : (
                            <Medal size={28} className={`mx-auto mb-2 ${podiumColors[i].text}`} />
                          )}
                          <p className={`text-xs font-medium mb-1 ${podiumColors[i].text}`}>
                            {podiumColors[i].label}
                          </p>
                          <p className="text-lg font-bold text-white">{entry.name}</p>
                          <p className="text-xs text-kyokushin-text-muted mb-2">{entry.club}</p>
                          <div className="flex items-center justify-center gap-3 text-xs text-kyokushin-text-muted">
                            <span>{entry.wins} Siege</span>
                            <span className="text-kyokushin-border">|</span>
                            <span>{entry.pointsFor}:{entry.pointsAgainst} Punkte</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-kyokushin-text-muted mb-4">Rangliste</h4>
                  <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-kyokushin-border">
                          <th className="text-left px-4 py-3 text-kyokushin-text-muted font-medium w-16">Platz</th>
                          <th className="text-left px-4 py-3 text-kyokushin-text-muted font-medium">Name</th>
                          <th className="text-left px-4 py-3 text-kyokushin-text-muted font-medium">Dojo</th>
                          <th className="text-center px-4 py-3 text-kyokushin-text-muted font-medium">Siege</th>
                          <th className="text-center px-4 py-3 text-kyokushin-text-muted font-medium">Niederl.</th>
                          <th className="text-center px-4 py-3 text-kyokushin-text-muted font-medium">Punkte</th>
                          <th className="text-center px-4 py-3 text-kyokushin-text-muted font-medium">Differenz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundRobinRanking.map((entry, i) => {
                          const placeColor =
                            i === 0 ? 'text-kyokushin-gold' :
                            i === 1 ? 'text-gray-300' :
                            i === 2 ? 'text-amber-600' :
                            'text-kyokushin-text-muted';
                          const rowAccent =
                            i === 0 ? 'border-l-2 border-l-kyokushin-gold' :
                            i === 1 ? 'border-l-2 border-l-gray-400' :
                            i === 2 ? 'border-l-2 border-l-amber-700' :
                            '';
                          return (
                            <tr
                              key={entry.participantId}
                              className={`border-b border-kyokushin-border/50 hover:bg-kyokushin-card-hover ${rowAccent}`}
                            >
                              <td className={`px-4 py-3 font-bold ${placeColor}`}>{i + 1}</td>
                              <td className="px-4 py-3 text-white font-medium">{entry.name}</td>
                              <td className="px-4 py-3 text-kyokushin-text">{entry.club}</td>
                              <td className="px-4 py-3 text-center text-green-400 font-medium">{entry.wins}</td>
                              <td className="px-4 py-3 text-center text-kyokushin-text-muted">{entry.losses}</td>
                              <td className="px-4 py-3 text-center text-white">{entry.pointsFor}:{entry.pointsAgainst}</td>
                              <td className={`px-4 py-3 text-center font-medium ${entry.diff > 0 ? 'text-green-400' : entry.diff < 0 ? 'text-red-400' : 'text-kyokushin-text-muted'}`}>
                                {entry.diff > 0 ? '+' : ''}{entry.diff}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <>
          {correctionError && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-400">{correctionError}</p>
              <button onClick={() => setCorrectionError(null)} className="ml-auto text-kyokushin-text-muted hover:text-white shrink-0">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
          )}

          <BracketTree
            matches={matchesForCategory}
            totalRounds={totalRounds}
            getName={getName}
            getClub={getClub}
            isWithdrawn={isWithdrawn}
            onMatchClick={(m) => {
              setResultModal(m);
              setScore1(0);
              setScore2(0);
            }}
            onCorrectMatch={handleOpenCorrection}
          />
        </>
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-white text-center mb-6">
              Ergebnis eintragen
            </h3>

            {category?.kataSystem === 'flag' ? (
              <>
                <p className="text-sm text-kyokushin-text-muted text-center mb-6">Flaggensystem: Wähle den Gewinner</p>
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => { setScore1(1); setScore2(0); }}
                    className={`flex-1 rounded-xl p-4 text-center border-2 transition-all ${score1 > score2 ? 'border-kyokushin-red bg-kyokushin-red/20' : 'border-kyokushin-border hover:border-kyokushin-red/50'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-red-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">{getName(resultModal.fighter1Id)}</p>
                    <p className="text-xs text-kyokushin-text-muted">{getClub(resultModal.fighter1Id)}</p>
                  </button>
                  <button
                    onClick={() => { setScore1(0); setScore2(1); }}
                    className={`flex-1 rounded-xl p-4 text-center border-2 transition-all ${score2 > score1 ? 'border-blue-500 bg-blue-500/20' : 'border-kyokushin-border hover:border-blue-500/50'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">{getName(resultModal.fighter2Id)}</p>
                    <p className="text-xs text-kyokushin-text-muted">{getClub(resultModal.fighter2Id)}</p>
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleResult}
                    disabled={score1 === score2}
                    className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark disabled:opacity-50 text-white py-3 rounded-lg font-bold transition-colors"
                  >
                    Bestätigen
                  </button>
                  <button
                    onClick={() => setResultModal(null)}
                    className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 mb-8">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-white">{getName(resultModal.fighter1Id)}</p>
                    <p className="text-xs text-kyokushin-text-muted">{getClub(resultModal.fighter1Id)}</p>
                    <input
                      type="number"
                      min="0"
                      value={score1}
                      onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                      className="w-20 mt-3 mx-auto block bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-center text-2xl font-bold focus:outline-none focus:border-kyokushin-red"
                    />
                  </div>
                  <span className="text-2xl font-black text-kyokushin-red">VS</span>
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-white">{getName(resultModal.fighter2Id)}</p>
                    <p className="text-xs text-kyokushin-text-muted">{getClub(resultModal.fighter2Id)}</p>
                    <input
                      type="number"
                      min="0"
                      value={score2}
                      onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                      className="w-20 mt-3 mx-auto block bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-center text-2xl font-bold focus:outline-none focus:border-kyokushin-red"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleResult}
                    disabled={score1 === score2}
                    className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark disabled:opacity-50 text-white py-3 rounded-lg font-bold transition-colors"
                  >
                    Bestätigen
                  </button>
                  <button
                    onClick={() => setResultModal(null)}
                    className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {correctionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Ergebnis korrigieren
            </h3>

            {(() => {
              const catMatches = getMatchesForCategory(activeCategory!);
              const newWinner = corrScore1 > corrScore2 ? correctionModal.fighter1Id : corrScore2 > corrScore1 ? correctionModal.fighter2Id : null;
              const winnerChanges = newWinner !== null && newWinner !== correctionModal.winnerId;
              const resetCount = winnerChanges ? countDownstreamResets(catMatches, correctionModal) : 0;

              return (
                <>
                  {winnerChanges && resetCount > 0 && (
                    <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        Der Gewinner ändert sich. {resetCount} Folgekampf{resetCount > 1 ? 'e werden' : ' wird'} zurückgesetzt und muss neu ausgetragen werden.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold text-white">{getName(correctionModal.fighter1Id)}</p>
                      <p className="text-xs text-kyokushin-text-muted">{getClub(correctionModal.fighter1Id)}</p>
                      <input
                        type="number"
                        min="0"
                        value={corrScore1}
                        onChange={(e) => setCorrScore1(parseInt(e.target.value) || 0)}
                        className="w-20 mt-3 mx-auto block bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-center text-2xl font-bold focus:outline-none focus:border-kyokushin-red"
                      />
                    </div>
                    <span className="text-2xl font-black text-kyokushin-red">VS</span>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold text-white">{getName(correctionModal.fighter2Id)}</p>
                      <p className="text-xs text-kyokushin-text-muted">{getClub(correctionModal.fighter2Id)}</p>
                      <input
                        type="number"
                        min="0"
                        value={corrScore2}
                        onChange={(e) => setCorrScore2(parseInt(e.target.value) || 0)}
                        className="w-20 mt-3 mx-auto block bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-center text-2xl font-bold focus:outline-none focus:border-kyokushin-red"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCorrectResult}
                      disabled={corrScore1 === corrScore2}
                      className={`flex-1 ${winnerChanges && resetCount > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-kyokushin-red hover:bg-kyokushin-red-dark'} disabled:opacity-50 text-white py-3 rounded-lg font-bold transition-colors`}
                    >
                      {winnerChanges && resetCount > 0 ? 'Korrigieren & Zurücksetzen' : 'Korrigieren'}
                    </button>
                    <button
                      onClick={() => setCorrectionModal(null)}
                      className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-6 py-3 rounded-lg transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      {showRegenerateConfirm && category && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/15 rounded-lg">
                <AlertTriangle size={24} className="text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Turnierbaum neu generieren?
              </h3>
            </div>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-kyokushin-text">
                Es existieren bereits <span className="text-white font-medium">{matchesForCategory.filter((m) => m.status !== 'bye').length} Kämpfe</span> für "{category.name}".
              </p>
              {matchesForCategory.filter((m) => m.status === 'completed').length > 0 && (
                <p className="text-sm text-amber-400">
                  {matchesForCategory.filter((m) => m.status === 'completed').length} Ergebnisse wurden bereits eingetragen.
                </p>
              )}
              <p className="text-sm text-kyokushin-text-muted">
                Beim Neugenerieren gehen alle bisherigen Daten verloren.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="flex-1 bg-kyokushin-border hover:bg-kyokushin-card-hover text-white py-3 rounded-lg font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={executeGenerate}
                className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-lg font-bold transition-colors"
              >
                Neu generieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
