import { useMemo, useState } from 'react';
import { Radio, Search, Swords, X, AlertTriangle } from 'lucide-react';
import type { Category, FightGroup, Match, Participant } from '../../types';
import { getMatOverview } from '../../utils/matScheduler';
import { countFinishedScheduledFights, countScheduledFights, isFightFinished } from '../../utils/matchProgress';
import { advanceWinner } from '../../utils/bracketGenerator';
import MatPanel from './MatPanel';
import TouchScorePicker from '../ui/TouchScorePicker';
import BracketTree from '../Bracket/BracketTree';

interface Props {
  categories: Category[];
  fightGroups: {
    data: FightGroup[];
  };
  matches: {
    data: Match[];
    update: (id: string, updates: Partial<Match>) => Promise<void>;
  };
  participants: Participant[];
  matCount: number;
  onDisqualify: (participantId: string) => Promise<void>;
}

export default function FightControl({
  categories,
  fightGroups,
  matches,
  participants,
  matCount,
  onDisqualify,
}: Props) {
  const [selectedMat, setSelectedMat] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Quick Entry Modal State
  const [resultModalMatch, setResultModalMatch] = useState<Match | null>(null);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);

  // Interactive Planner States
  const [plannerCategoryId, setPlannerCategoryId] = useState<string | null>(null);
  const [planningActionMatch, setPlanningActionMatch] = useState<Match | null>(null);

  // Manual Fighter Correction States
  const [editingFightersMatch, setEditingFightersMatch] = useState<Match | null>(null);
  const [editFighter1Id, setEditFighter1Id] = useState<string | null>(null);
  const [editFighter2Id, setEditFighter2Id] = useState<string | null>(null);
  const [showAllTournamentParticipants, setShowAllTournamentParticipants] = useState(false);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  const getName = (id: string | null) => {
    if (!id) return 'Noch offen';
    const p = participantMap.get(id);
    return p ? `${p.lastName}, ${p.firstName}` : 'Noch offen';
  };

  const getClub = (id: string | null) => {
    if (!id) return '';
    return participantMap.get(id)?.club ?? '';
  };

  const overview = useMemo(
    () => getMatOverview(matches.data, matCount),
    [matches.data, matCount],
  );

  const hasAnyMatches = matches.data.length > 0;

  // Filter overview based on selected mat
  const filteredOverview = useMemo(() => {
    if (selectedMat === 'all') return overview;
    return overview.filter((m) => m.matNumber === selectedMat);
  }, [overview, selectedMat]);

  // Search pending matches by participant name, club, or category name
  const searchedMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    return matches.data.filter((m) => {
      if (m.status !== 'pending') return false;
      const f1 = m.fighter1Id ? participantMap.get(m.fighter1Id) : null;
      const f2 = m.fighter2Id ? participantMap.get(m.fighter2Id) : null;
      if (!f1 || !f2) return false; // only search fights with both fighters ready

      const f1Name = `${f1.firstName} ${f1.lastName}`.toLowerCase();
      const f2Name = `${f2.firstName} ${f2.lastName}`.toLowerCase();
      const f1Club = f1.club.toLowerCase();
      const f2Club = f2.club.toLowerCase();

      const group = fightGroups.data.find((g) => g.id === m.fightGroupId);
      const cat = group ? categories.find((c) => c.id === group.categoryId) : null;
      const catName = cat ? cat.name.toLowerCase() : '';

      return (
        f1Name.includes(query) ||
        f2Name.includes(query) ||
        f1Club.includes(query) ||
        f2Club.includes(query) ||
        catName.includes(query)
      );
    });
  }, [searchQuery, matches.data, participantMap, fightGroups.data, categories]);

  const handleResultSubmit = async () => {
    if (!resultModalMatch) return;
    const winnerId = score1 > score2 ? resultModalMatch.fighter1Id : resultModalMatch.fighter2Id;

    await matches.update(resultModalMatch.id, {
      winnerId,
      score1,
      score2,
      status: 'completed',
    });

    const updatedMatch = { ...resultModalMatch, winnerId, score1, score2, status: 'completed' as const };
    
    // Get all matches for this match's category
    const group = fightGroups.data.find((g) => g.id === resultModalMatch.fightGroupId);
    const categoryMatches = matches.data.filter((m) =>
      fightGroups.data
        .filter((g) => g.categoryId === group?.categoryId)
        .some((g) => g.id === m.fightGroupId),
    );

    const advance = advanceWinner(categoryMatches, updatedMatch);
    if (advance) {
      await matches.update(advance.matchId, advance.updates);
    }

    setResultModalMatch(null);
    setSearchQuery('');
  };

  // Interactive Planner logic
  const matCategories = useMemo(() => {
    if (selectedMat === 'all') return categories;
    const categoryIdsOnMat = new Set(
      matches.data
        .filter((m) => m.matNumber === selectedMat)
        .map((m) => fightGroups.data.find((g) => g.id === m.fightGroupId)?.categoryId)
        .filter(Boolean)
    );
    return categories.filter((c) => categoryIdsOnMat.has(c.id));
  }, [selectedMat, categories, matches.data, fightGroups.data]);

  const activePlannerCatId = plannerCategoryId ?? matCategories[0]?.id ?? null;

  const currentPlannerCategory = useMemo(() => {
    return matCategories.find((c) => c.id === activePlannerCatId) ?? matCategories[0] ?? null;
  }, [matCategories, activePlannerCatId]);

  const selectedPlannerCategoryMatches = useMemo(() => {
    if (!currentPlannerCategory) return [];
    const groups = fightGroups.data.filter((g) => g.categoryId === currentPlannerCategory.id);
    return matches.data.filter((m) => groups.some((g) => g.id === m.fightGroupId));
  }, [currentPlannerCategory, fightGroups.data, matches.data]);

  const selectedPlannerTotalRounds = useMemo(() => {
    if (selectedPlannerCategoryMatches.length === 0) return 0;
    return Math.max(...selectedPlannerCategoryMatches.map((m) => m.round), 0);
  }, [selectedPlannerCategoryMatches]);

  const handleSetNextMatch = async (match: Match) => {
    // Get all pending matches on this mat
    const matPendingMatches = matches.data.filter(
      (m) => m.matNumber === match.matNumber && m.status === 'pending' && m.id !== match.id
    );

    if (matPendingMatches.length === 0) {
      await matches.update(match.id, { priority: 0 });
      return;
    }

    const minPriority = Math.min(
      ...matPendingMatches.map((m) => m.priority ?? m.scheduledOrder ?? 9999)
    );

    await matches.update(match.id, { priority: minPriority - 1 });
  };

  const handleStartMatchNow = async (match: Match) => {
    const matNum = match.matNumber;

    // Find running match on this mat
    const runningMatch = matches.data.find(
      (m) => m.matNumber === matNum && m.status === 'running'
    );

    if (runningMatch) {
      await matches.update(runningMatch.id, {
        status: 'pending',
        timerEndsAt: null,
        timerPausedRemaining: null,
      });
    }

    const matPendingMatches = matches.data.filter(
      (m) => m.matNumber === matNum && m.status === 'pending' && m.id !== match.id
    );
    const minPriority = matPendingMatches.length > 0
      ? Math.min(...matPendingMatches.map((m) => m.priority ?? m.scheduledOrder ?? 9999))
      : 0;

    await matches.update(match.id, {
      status: 'running',
      priority: minPriority - 1,
      timerEndsAt: null,
      timerPausedRemaining: null,
    });
  };

  const handleOpenFighterEdit = (match: Match) => {
    setEditingFightersMatch(match);
    setEditFighter1Id(match.fighter1Id);
    setEditFighter2Id(match.fighter2Id);
    setShowAllTournamentParticipants(false);
  };

  const handleSaveFighters = async () => {
    if (!editingFightersMatch) return;
    await matches.update(editingFightersMatch.id, {
      fighter1Id: editFighter1Id || null,
      fighter2Id: editFighter2Id || null,
    });
    setEditingFightersMatch(null);
  };

  if (!hasAnyMatches) {
    return (
      <div className="text-center py-16">
        <Radio size={48} className="mx-auto text-kyokushin-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Keine Kämpfe vorhanden</h3>
        <p className="text-kyokushin-text-muted">
          Generiere zuerst Turnierbäume im Turnierbaum-Tab, damit Kämpfe auf die Matten verteilt werden.
        </p>
      </div>
    );
  };

  const renderRoundRobinMini = () => {
    const roundsMap = new Map<number, Match[]>();
    for (const m of selectedPlannerCategoryMatches) {
      const list = roundsMap.get(m.round) ?? [];
      list.push(m);
      roundsMap.set(m.round, list);
    }
    const sortedRounds = Array.from(roundsMap.entries()).sort(([a], [b]) => a - b);

    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-4 min-w-max">
          {sortedRounds.map(([round, roundMatches]) => (
            <div key={round} className="w-52 shrink-0 flex flex-col">
              <h5 className="text-[10px] font-bold text-kyokushin-text-muted uppercase tracking-widest mb-2 text-center bg-kyokushin-bg py-1 rounded border border-kyokushin-border/30">
                Runde {round}
              </h5>
              <div className="flex flex-col gap-2 flex-grow">
                {roundMatches.map((m) => {
                  const isCompleted = m.status === 'completed';
                  const isWalkover = m.status === 'walkover';
                  const isDq = m.status === 'disqualification';
                  const isFinished = isCompleted || isWalkover || isDq;
                  const canClick = !isFinished && m.status !== 'bye' && m.fighter1Id && m.fighter2Id;
                  const isCurrent = matches.data.find(cm => cm.status === 'running' && cm.matNumber === m.matNumber)?.id === m.id;

                  return (
                    <div
                      key={m.id}
                      onClick={() => { if (canClick) setPlanningActionMatch(m); }}
                      className={`rounded-lg overflow-hidden border bg-kyokushin-bg/40 text-xs transition-all ${
                        isCurrent
                          ? 'border-kyokushin-red shadow-lg shadow-kyokushin-red/20 ring-1 ring-kyokushin-red/30'
                          : isFinished
                            ? 'border-kyokushin-border/40 opacity-70'
                            : m.fighter1Id && m.fighter2Id
                              ? 'border-kyokushin-red/40 hover:border-kyokushin-red hover:shadow-md cursor-pointer'
                              : 'border-kyokushin-border/20'
                      }`}
                    >
                      {/* Fighter 1 */}
                      <div className="px-2.5 py-1.5 flex justify-between items-center">
                        <span className="font-medium truncate">{getName(m.fighter1Id)}</span>
                        {isCompleted && <span className="font-bold text-kyokushin-text-muted">{m.score1}</span>}
                      </div>
                      <div className="h-px bg-kyokushin-border/20" />
                      {/* Fighter 2 */}
                      <div className="px-2.5 py-1.5 flex justify-between items-center">
                        <span className="font-medium truncate">{getName(m.fighter2Id)}</span>
                        {isCompleted && <span className="font-bold text-kyokushin-text-muted">{m.score2}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInteractivePlanner = () => {
    if (matCategories.length === 0) return null;

    return (
      <div className="bg-kyokushin-card border border-kyokushin-border rounded-2xl p-5 flex flex-col space-y-5">
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-kyokushin-text-muted uppercase tracking-widest">
            Kategorie-Auswahl {selectedMat !== 'all' && `(Matte ${selectedMat})`}
          </h4>
          <div className="flex flex-wrap gap-2">
            {matCategories.map((cat) => {
              const catMatches = matches.data.filter((m) =>
                fightGroups.data
                  .filter((g) => g.categoryId === cat.id)
                  .some((g) => g.id === m.fightGroupId)
              );
              const finishedCount = catMatches.filter(isFightFinished).length;
              const totalCount = catMatches.length;
              const isActive = currentPlannerCategory?.id === cat.id;
              
              // Find which mat this category is scheduled on
              const mats = Array.from(new Set(catMatches.map(m => m.matNumber).filter(Boolean)));
              const matLabel = mats.length > 0 ? `Matte ${mats.join(', ')}` : 'Keine Matte';

              return (
                <button
                  key={cat.id}
                  onClick={() => setPlannerCategoryId(cat.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer min-w-[140px] max-w-[200px] flex-1 ${
                    isActive
                      ? 'bg-kyokushin-red/15 border-kyokushin-red shadow-lg shadow-kyokushin-red/10'
                      : 'bg-kyokushin-bg/40 border-kyokushin-border hover:border-kyokushin-text-muted/50 hover:bg-kyokushin-bg/60'
                  }`}
                >
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-kyokushin-red' : 'text-white'}`}>
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-kyokushin-text-muted mt-1">
                    {matLabel} · {finishedCount}/{totalCount} Kämpfe
                  </span>
                  <div className="w-full bg-kyokushin-border/50 h-1 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full ${isActive ? 'bg-kyokushin-red' : 'bg-kyokushin-gold'}`}
                      style={{ width: `${totalCount > 0 ? (finishedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {currentPlannerCategory && (
          <div className="bg-kyokushin-bg/30 border border-kyokushin-border/80 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white">
                  {currentPlannerCategory.name}
                </h4>
                <p className="text-[10px] text-kyokushin-text-muted mt-0.5">
                  Format: {currentPlannerCategory.tournamentFormat === 'round_robin' ? 'Jeder gegen Jeden (Round Robin)' : 'K.O.-System'}
                </p>
              </div>
              <span className="text-[10px] text-kyokushin-gold bg-kyokushin-gold/15 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide text-center">
                Kampf anklicken zum Aufrufen / Einreihen
              </span>
            </div>

            {currentPlannerCategory.tournamentFormat === 'round_robin' ? (
              renderRoundRobinMini()
            ) : (
              <div className="overflow-x-auto pb-2">
                <BracketTree
                  matches={selectedPlannerCategoryMatches}
                  totalRounds={selectedPlannerTotalRounds}
                  getName={getName}
                  getClub={getClub}
                  readonly={false}
                  onMatchClick={(m) => setPlanningActionMatch(m)}
                  currentMatchId={
                    matches.data.find(m => m.status === 'running' && m.matNumber === selectedPlannerCategoryMatches[0]?.matNumber)?.id
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-kyokushin-card/40 p-4 rounded-xl border border-kyokushin-border/50">
        <div>
          <h3 className="text-lg font-semibold text-white">Kampfleitung</h3>
          <p className="text-sm text-kyokushin-text-muted">
            {matCount} {matCount === 1 ? 'Matte' : 'Matten'} · {countFinishedScheduledFights(matches.data)}/{countScheduledFights(matches.data)} Kämpfe abgeschlossen
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search size={16} className="absolute left-3 top-2.5 text-kyokushin-text-muted" />
            <input
              type="text"
              placeholder="Schnellsuche Kämpfer / Dojo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg pl-9 pr-8 py-2 text-white text-xs placeholder:text-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-kyokushin-text-muted hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Mat Selector */}
          {matCount > 1 && (
            <div className="flex bg-kyokushin-bg p-1 rounded-lg border border-kyokushin-border/80">
              <button
                onClick={() => setSelectedMat('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  selectedMat === 'all'
                    ? 'bg-kyokushin-red text-white shadow-lg shadow-kyokushin-red/20'
                    : 'text-kyokushin-text-muted hover:text-white'
                }`}
              >
                Alle Matten
              </button>
              {Array.from({ length: matCount }, (_, i) => {
                const matNum = i + 1;
                return (
                  <button
                    key={matNum}
                    onClick={() => setSelectedMat(matNum)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      selectedMat === matNum
                        ? 'bg-kyokushin-red text-white shadow-lg shadow-kyokushin-red/20'
                        : 'text-kyokushin-text-muted hover:text-white'
                    }`}
                  >
                    Matte {matNum}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Search Results Overlay / Panel */}
      {searchQuery.trim() !== '' && (
        <div className="bg-kyokushin-card border-2 border-kyokushin-gold/40 rounded-xl p-5 shadow-2xl shadow-black/85">
          <div className="flex items-center gap-2 mb-3">
            <Swords size={16} className="text-kyokushin-gold" />
            <h4 className="font-semibold text-white text-sm">
              Schnellergebnisse (ausstehende Kämpfe)
            </h4>
            <span className="bg-kyokushin-gold/15 text-kyokushin-gold text-xs px-2 py-0.5 rounded-full font-medium">
              {searchedMatches.length} gefunden
            </span>
          </div>

          {searchedMatches.length === 0 ? (
            <p className="text-xs text-kyokushin-text-muted py-2">
              Keine passenden ausstehenden Kämpfe gefunden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-kyokushin-border/50 text-kyokushin-text-muted">
                    <th className="py-2 font-medium">Kategorie</th>
                    <th className="py-2 font-medium">Matte</th>
                    <th className="py-2 font-medium">Runde / Pos</th>
                    <th className="py-2 font-medium">Kämpfer 1 (Rot)</th>
                    <th className="py-2 font-medium">Kämpfer 2 (Weiß)</th>
                    <th className="py-2 font-medium text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedMatches.map((m) => {
                    const group = fightGroups.data.find((g) => g.id === m.fightGroupId);
                    const cat = group ? categories.find((c) => c.id === group.categoryId) : null;
                    return (
                      <tr key={m.id} className="border-b border-kyokushin-border/30 hover:bg-kyokushin-bg/40">
                        <td className="py-2.5 text-white font-medium">{cat?.name ?? 'Unbekannt'}</td>
                        <td className="py-2.5 text-kyokushin-gold font-bold">Matte {m.matNumber}</td>
                        <td className="py-2.5 text-kyokushin-text-muted">Runde {m.round} / Kampf {m.position}</td>
                        <td className="py-2.5 text-red-400 font-medium">
                          {getName(m.fighter1Id)} <span className="text-[10px] text-kyokushin-text-muted">({getClub(m.fighter1Id)})</span>
                        </td>
                        <td className="py-2.5 text-blue-300 font-medium">
                          {getName(m.fighter2Id)} <span className="text-[10px] text-kyokushin-text-muted">({getClub(m.fighter2Id)})</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setResultModalMatch(m);
                              setScore1(0);
                              setScore2(0);
                            }}
                            className="bg-kyokushin-gold hover:bg-yellow-600 text-black text-[10px] font-extrabold px-3 py-1.5 rounded transition-all cursor-pointer"
                          >
                            Ergebnis eintragen
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedMat === 'all' ? (
        <div className="space-y-6">
          {/* Mats Grid */}
          <div className={`grid gap-6 ${
            filteredOverview.length === 2
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
          }`}>
            {filteredOverview.map((mat) => (
              <MatPanel
                key={mat.matNumber}
                matNumber={mat.matNumber}
                currentMatch={mat.current}
                nextMatch={mat.next}
                completed={mat.completed}
                total={mat.total}
                categories={categories}
                fightGroups={fightGroups.data}
                allMatches={matches.data}
                participantMap={participantMap}
                onUpdateMatch={matches.update}
                onDisqualify={onDisqualify}
              />
            ))}
          </div>

          {/* Interactive Planner (Full Width below mats) */}
          {renderInteractivePlanner()}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Fight Control Panel (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            {filteredOverview.map((mat) => (
              <MatPanel
                key={mat.matNumber}
                matNumber={mat.matNumber}
                currentMatch={mat.current}
                nextMatch={mat.next}
                completed={mat.completed}
                total={mat.total}
                categories={categories}
                fightGroups={fightGroups.data}
                allMatches={matches.data}
                participantMap={participantMap}
                onUpdateMatch={matches.update}
                onDisqualify={onDisqualify}
              />
            ))}
          </div>

          {/* Right Side: Interactive Planner (7 cols on lg) */}
          <div className="lg:col-span-7">
            {renderInteractivePlanner()}
          </div>
        </div>
      )}

      {/* Quick Entry Modal */}
      {resultModalMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 w-full max-w-lg mx-4">
            <h4 className="text-base font-bold text-white text-center mb-6">
              Ergebnis direkt eintragen
            </h4>

            <div className="flex items-start justify-between gap-4 mb-8">
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{getName(resultModalMatch.fighter1Id)}</p>
                <p className="text-xs text-kyokushin-text-muted truncate">{getClub(resultModalMatch.fighter1Id)}</p>
                <div className="mt-3">
                  <TouchScorePicker value={score1} onChange={setScore1} accent="red" size="compact" />
                </div>
              </div>
              <span className="text-xl font-black text-kyokushin-red shrink-0 self-center">VS</span>
              <div className="text-center flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{getName(resultModalMatch.fighter2Id)}</p>
                <p className="text-xs text-kyokushin-text-muted truncate">{getClub(resultModalMatch.fighter2Id)}</p>
                <div className="mt-3">
                  <TouchScorePicker value={score2} onChange={setScore2} accent="blue" size="compact" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResultSubmit}
                disabled={score1 === score2}
                className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark disabled:opacity-50 text-white py-2.5 rounded-lg font-bold transition-all text-sm cursor-pointer"
              >
                Bestätigen
              </button>
              <button
                onClick={() => setResultModalMatch(null)}
                className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-5 py-2.5 rounded-lg text-sm transition-all cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Planning Action Modal */}
      {planningActionMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h4 className="text-base font-bold text-white text-center mb-4">
              Kampf steuern (Matte {planningActionMatch.matNumber})
            </h4>
            <p className="text-xs text-kyokushin-text-muted text-center mb-6">
              Wähle die Aktion für diesen Kampf aus der Kategorie <strong>{currentPlannerCategory?.name}</strong>.
            </p>

            {/* Fighter Info Card */}
            <div className="bg-kyokushin-bg/60 rounded-xl p-4 border border-kyokushin-border/40 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="text-center flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{getName(planningActionMatch.fighter1Id)}</p>
                  <p className="text-[10px] text-kyokushin-text-muted truncate">{getClub(planningActionMatch.fighter1Id)}</p>
                </div>
                <span className="text-lg font-black text-kyokushin-red shrink-0">VS</span>
                <div className="text-center flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{getName(planningActionMatch.fighter2Id)}</p>
                  <p className="text-[10px] text-kyokushin-text-muted truncate">{getClub(planningActionMatch.fighter2Id)}</p>
                </div>
              </div>
            </div>

            {/* Actions List */}
            <div className="space-y-3">
              <button
                onClick={async () => {
                  await handleSetNextMatch(planningActionMatch);
                  setPlanningActionMatch(null);
                }}
                className="w-full flex items-center justify-center bg-kyokushin-gold hover:bg-yellow-600 text-black py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Als nächsten Kampf auf Matte {planningActionMatch.matNumber} einreihen
              </button>

              <button
                onClick={async () => {
                  await handleStartMatchNow(planningActionMatch);
                  setPlanningActionMatch(null);
                }}
                className="w-full flex items-center justify-center bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Diesen Kampf JETZT starten (Laufenden Kampf unterbrechen)
              </button>

              <button
                onClick={() => {
                  handleOpenFighterEdit(planningActionMatch);
                  setPlanningActionMatch(null);
                }}
                className="w-full flex items-center justify-center bg-kyokushin-bg border border-kyokushin-border hover:border-kyokushin-red text-white py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Kämpfer bearbeiten
              </button>

              <button
                onClick={() => setPlanningActionMatch(null)}
                className="w-full bg-kyokushin-border hover:bg-kyokushin-card-hover text-white py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fighter Editor Modal */}
      {editingFightersMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white text-center mb-4">
              Kämpfer bearbeiten
            </h3>
            <p className="text-xs text-kyokushin-text-muted text-center mb-6">
              Passe die Kämpfer für diesen Kampf manuell an.
            </p>

            {/* Fighter 1 Selection */}
            <div className="space-y-2 mb-4">
              <label className="block text-xs font-bold text-red-400 uppercase tracking-wide">
                Kämpfer 1 (Rot)
              </label>
              <select
                value={editFighter1Id || ''}
                onChange={(e) => setEditFighter1Id(e.target.value || null)}
                className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
              >
                <option value="">-- Noch offen / Kein Kämpfer --</option>
                {(() => {
                  const candidates = showAllTournamentParticipants
                    ? participants
                    : participants.filter((p) => p.categoryIds.includes(currentPlannerCategory?.id || ''));

                  return candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName} ({p.club})
                    </option>
                  ));
                })()}
              </select>
            </div>

            {/* Fighter 2 Selection */}
            <div className="space-y-2 mb-6">
              <label className="block text-xs font-bold text-blue-300 uppercase tracking-wide">
                Kämpfer 2 (Weiß)
              </label>
              <select
                value={editFighter2Id || ''}
                onChange={(e) => setEditFighter2Id(e.target.value || null)}
                className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
              >
                <option value="">-- Noch offen / Kein Kämpfer --</option>
                {(() => {
                  const candidates = showAllTournamentParticipants
                    ? participants
                    : participants.filter((p) => p.categoryIds.includes(currentPlannerCategory?.id || ''));

                  return candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName} ({p.club})
                    </option>
                  ));
                })()}
              </select>
            </div>

            {/* Same Fighter Warning */}
            {editFighter1Id && editFighter2Id && editFighter1Id === editFighter2Id && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  Ein Kämpfer kann nicht gegen sich selbst antreten!
                </p>
              </div>
            )}

            {/* Show All Checkbox */}
            <div className="flex items-center gap-2 mb-6">
              <input
                type="checkbox"
                id="show_all_participants_control"
                checked={showAllTournamentParticipants}
                onChange={(e) => setShowAllTournamentParticipants(e.target.checked)}
                className="rounded border-kyokushin-border bg-kyokushin-bg text-kyokushin-red focus:ring-0"
              />
              <label htmlFor="show_all_participants_control" className="text-xs text-kyokushin-text-muted hover:text-white cursor-pointer select-none">
                Alle Turnier-Teilnehmer anzeigen (nicht nur aus dieser Kategorie)
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveFighters}
                disabled={!!(editFighter1Id && editFighter2Id && editFighter1Id === editFighter2Id)}
                className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark disabled:opacity-50 text-white py-3 rounded-lg font-bold transition-colors cursor-pointer"
              >
                Speichern
              </button>
              <button
                onClick={() => setEditingFightersMatch(null)}
                className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-6 py-3 rounded-lg transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
