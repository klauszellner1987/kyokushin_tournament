import { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Square, ChevronDown, ChevronUp, Timer, ShieldBan, Plus } from 'lucide-react';
import type { Match, Category, FightGroup, Participant } from '../../types';
import { advanceWinner } from '../../utils/bracketGenerator';
import { useTimer } from '../../hooks/useTimer';
import FightTimer from './FightTimer';
import BracketTree from '../Bracket/BracketTree';

interface Props {
  matNumber: number;
  currentMatch: Match | null;
  nextMatch: Match | null;
  completed: number;
  total: number;
  categories: Category[];
  fightGroups: FightGroup[];
  allMatches: Match[];
  participantMap: Map<string, Participant>;
  onUpdateMatch: (id: string, updates: Partial<Match>) => Promise<void>;
  onDisqualify: (participantId: string) => Promise<void>;
}

export default function MatPanel({
  matNumber,
  currentMatch,
  nextMatch,
  completed,
  total,
  categories,
  fightGroups,
  allMatches,
  participantMap,
  onUpdateMatch,
  onDisqualify,
}: Props) {
  const [showBracket, setShowBracket] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showDqModal, setShowDqModal] = useState(false);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [timerExpiredHandled, setTimerExpiredHandled] = useState<string | null>(null);

  const group = currentMatch
    ? fightGroups.find((g) => g.id === currentMatch.fightGroupId)
    : null;
  const category = group
    ? categories.find((c) => c.id === group.categoryId)
    : null;

  const { isExpired } = useTimer(currentMatch?.timerEndsAt, currentMatch?.timerPausedRemaining);

  const isRunning = currentMatch?.status === 'running';
  const isPaused = isRunning && currentMatch?.timerPausedRemaining != null;
  const isTimerActive = isRunning && currentMatch?.timerEndsAt != null && !isPaused;

  useEffect(() => {
    if (isExpired && currentMatch && timerExpiredHandled !== currentMatch.id) {
      setTimerExpiredHandled(currentMatch.id);
      setShowDecisionModal(true);
    }
  }, [isExpired, currentMatch, timerExpiredHandled]);

  const getName = (id: string | null) => {
    if (!id) return 'Noch offen';
    const p = participantMap.get(id);
    return p ? `${p.lastName}, ${p.firstName}` : 'Noch offen';
  };

  const getClub = (id: string | null) => {
    if (!id) return '';
    return participantMap.get(id)?.club ?? '';
  };

  const handleStartFight = async () => {
    if (!currentMatch || !category) return;
    const duration = currentMatch.isExtension
      ? (category.fightDuration2 ?? 120)
      : (category.fightDuration1 ?? 120);
    await onUpdateMatch(currentMatch.id, {
      status: 'running',
      timerEndsAt: Date.now() + duration * 1000,
      timerPausedRemaining: undefined,
    });
    setTimerExpiredHandled(null);
  };

  const handlePause = async () => {
    if (!currentMatch || !currentMatch.timerEndsAt) return;
    const remaining = Math.max(0, (currentMatch.timerEndsAt - Date.now()) / 1000);
    await onUpdateMatch(currentMatch.id, {
      timerPausedRemaining: remaining,
      timerEndsAt: undefined,
    });
  };

  const handleResume = async () => {
    if (!currentMatch || currentMatch.timerPausedRemaining == null) return;
    await onUpdateMatch(currentMatch.id, {
      timerEndsAt: Date.now() + currentMatch.timerPausedRemaining * 1000,
      timerPausedRemaining: undefined,
    });
  };

  const handleStop = () => {
    setShowDecisionModal(true);
  };

  const handleAddTime = async (seconds: number) => {
    if (!currentMatch || currentMatch.timerPausedRemaining == null) return;
    await onUpdateMatch(currentMatch.id, {
      timerPausedRemaining: currentMatch.timerPausedRemaining + seconds,
    });
  };

  const handleDisqualify = async (participantId: string) => {
    if (!currentMatch) return;
    const winnerId = participantId === currentMatch.fighter1Id
      ? currentMatch.fighter2Id
      : currentMatch.fighter1Id;

    await onUpdateMatch(currentMatch.id, {
      winnerId,
      score1: 0,
      score2: 0,
      status: 'disqualification',
      timerEndsAt: undefined,
      timerPausedRemaining: undefined,
    });

    const updatedMatch = { ...currentMatch, winnerId, score1: 0, score2: 0, status: 'disqualification' as const };
    const categoryMatches = allMatches.filter((m) =>
      fightGroups
        .filter((g) => g.categoryId === group?.categoryId)
        .some((g) => g.id === m.fightGroupId),
    );
    const advance = advanceWinner(categoryMatches, updatedMatch);
    if (advance) {
      await onUpdateMatch(advance.matchId, advance.updates);
    }

    await onDisqualify(participantId);

    setShowDqModal(false);
    setShowDecisionModal(false);
    setTimerExpiredHandled(null);
  };

  const handleStartExtension = async () => {
    if (!currentMatch || !category) return;
    setShowDecisionModal(false);
    setShowResultModal(false);
    await onUpdateMatch(currentMatch.id, {
      isExtension: true,
      status: 'pending',
      timerEndsAt: undefined,
      timerPausedRemaining: undefined,
    });
    setTimerExpiredHandled(null);
  };

  const handleOpenResult = () => {
    setShowDecisionModal(false);
    setScore1(0);
    setScore2(0);
    setShowResultModal(true);
  };

  const handleSubmitResult = async () => {
    if (!currentMatch) return;
    const winnerId = score1 > score2 ? currentMatch.fighter1Id : currentMatch.fighter2Id;

    await onUpdateMatch(currentMatch.id, {
      winnerId,
      score1,
      score2,
      status: 'completed',
      timerEndsAt: undefined,
      timerPausedRemaining: undefined,
    });

    const updatedMatch = { ...currentMatch, winnerId, score1, score2, status: 'completed' as const };
    const categoryMatches = allMatches.filter((m) =>
      fightGroups
        .filter((g) => g.categoryId === group?.categoryId)
        .some((g) => g.id === m.fightGroupId),
    );
    const advance = advanceWinner(categoryMatches, updatedMatch);
    if (advance) {
      await onUpdateMatch(advance.matchId, advance.updates);
    }

    setShowResultModal(false);
    setTimerExpiredHandled(null);
  };

  const handleFlagResult = async (winnerId: string) => {
    if (!currentMatch) return;
    const s1 = winnerId === currentMatch.fighter1Id ? 1 : 0;
    const s2 = winnerId === currentMatch.fighter2Id ? 1 : 0;

    await onUpdateMatch(currentMatch.id, {
      winnerId,
      score1: s1,
      score2: s2,
      status: 'completed',
      timerEndsAt: undefined,
      timerPausedRemaining: undefined,
    });

    const updatedMatch = { ...currentMatch, winnerId, score1: s1, score2: s2, status: 'completed' as const };
    const categoryMatches = allMatches.filter((m) =>
      fightGroups
        .filter((g) => g.categoryId === group?.categoryId)
        .some((g) => g.id === m.fightGroupId),
    );
    const advance = advanceWinner(categoryMatches, updatedMatch);
    if (advance) {
      await onUpdateMatch(advance.matchId, advance.updates);
    }

    setShowResultModal(false);
    setTimerExpiredHandled(null);
  };

  const categoryMatches = useMemo(() => {
    if (!group) return [];
    const groups = fightGroups.filter((g) => g.categoryId === group.categoryId);
    return allMatches.filter((m) => groups.some((g) => g.id === m.fightGroupId));
  }, [group, fightGroups, allMatches]);

  const totalRounds = useMemo(() => {
    if (categoryMatches.length === 0) return 0;
    return Math.max(...categoryMatches.map((m) => m.round), 0);
  }, [categoryMatches]);

  const fighter1 = currentMatch?.fighter1Id ? participantMap.get(currentMatch.fighter1Id) : null;
  const fighter2 = currentMatch?.fighter2Id ? participantMap.get(currentMatch.fighter2Id) : null;
  const nextF1 = nextMatch?.fighter1Id ? participantMap.get(nextMatch.fighter1Id) : null;
  const nextF2 = nextMatch?.fighter2Id ? participantMap.get(nextMatch.fighter2Id) : null;

  const isFlagSystem = category?.kataSystem === 'flag';
  const canExtend = !currentMatch?.isExtension && !!category?.fightDuration2;
  const isDraw = score1 === score2;

  const showInlinePanel = showDecisionModal || showResultModal || showDqModal;

  return (
    <div className="bg-kyokushin-card border border-kyokushin-border rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-kyokushin-border bg-kyokushin-nav/50">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-kyokushin-text-muted'}`} />
          <span className="text-lg font-bold text-white">Matte {matNumber}</span>
          {category && (
            <span className="bg-kyokushin-red/15 text-kyokushin-red text-xs px-2.5 py-1 rounded-full font-medium">
              {category.name}
            </span>
          )}
          {currentMatch?.isExtension && (
            <span className="bg-amber-500/15 text-amber-400 text-xs px-2.5 py-1 rounded-full font-medium">
              Verlängerung
            </span>
          )}
        </div>
        <span className="text-sm text-kyokushin-text-muted">
          {completed}/{total} Kämpfe
        </span>
      </div>

      {/* Fight Area */}
      <div className="flex-1 p-5">
        {showInlinePanel && currentMatch ? (
          /* Inline decision / result / DQ panel (replaces fight display) */
          showDqModal ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <ShieldBan size={20} className="text-kyokushin-red" />
                <h3 className="text-base font-bold text-white">Disqualifizieren</h3>
              </div>
              <p className="text-xs text-kyokushin-text-muted text-center">
                Wer wird disqualifiziert? Der Gegner gewinnt automatisch.
              </p>
              <div className="flex gap-3">
                {[currentMatch.fighter1Id, currentMatch.fighter2Id].map((fId, i) => (
                  <button
                    key={fId}
                    onClick={() => fId && handleDisqualify(fId)}
                    className={`flex-1 rounded-xl p-3 text-center border-2 transition-all ${
                      i === 0
                        ? 'border-red-500/50 hover:border-red-500 hover:bg-red-500/10'
                        : 'border-blue-500/50 hover:border-blue-500 hover:bg-blue-500/10'
                    }`}
                  >
                    <ShieldBan size={18} className="mx-auto mb-1.5 text-kyokushin-text-muted" />
                    <p className="text-xs font-bold text-white">{getName(fId)}</p>
                    <p className="text-[10px] text-kyokushin-text-muted">{getClub(fId)}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowDqModal(false)}
                className="w-full bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Abbrechen
              </button>
            </div>
          ) : showResultModal ? (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white text-center">
                Ergebnis eintragen
              </h3>

              {isFlagSystem ? (
                <>
                  <p className="text-xs text-kyokushin-text-muted text-center">Flaggensystem: Wähle den Gewinner</p>
                  <div className="flex gap-3">
                    {[currentMatch.fighter1Id, currentMatch.fighter2Id].map((fId, i) => (
                      <button
                        key={fId}
                        onClick={() => fId && handleFlagResult(fId)}
                        className={`flex-1 rounded-xl p-3 text-center border-2 transition-all ${
                          i === 0
                            ? 'border-red-500/50 hover:border-red-500 hover:bg-red-500/10'
                            : 'border-blue-500/50 hover:border-blue-500 hover:bg-blue-500/10'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full mx-auto mb-1.5 ${i === 0 ? 'bg-red-500' : 'bg-white'}`} />
                        <p className="text-xs font-bold text-white">{getName(fId)}</p>
                        <p className="text-[10px] text-kyokushin-text-muted">{getClub(fId)}</p>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowResultModal(false)}
                    className="w-full bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-center flex-1">
                      <p className="text-sm font-bold text-white">{getName(currentMatch.fighter1Id)}</p>
                      <p className="text-[10px] text-kyokushin-text-muted">{getClub(currentMatch.fighter1Id)}</p>
                      <input
                        type="number"
                        min="0"
                        value={score1}
                        onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                        className="w-16 mt-2 mx-auto block bg-kyokushin-bg border border-kyokushin-border rounded-lg px-2 py-1.5 text-white text-center text-xl font-bold focus:outline-none focus:border-kyokushin-red"
                      />
                    </div>
                    <span className="text-xl font-black text-kyokushin-red shrink-0">VS</span>
                    <div className="text-center flex-1">
                      <p className="text-sm font-bold text-white">{getName(currentMatch.fighter2Id)}</p>
                      <p className="text-[10px] text-kyokushin-text-muted">{getClub(currentMatch.fighter2Id)}</p>
                      <input
                        type="number"
                        min="0"
                        value={score2}
                        onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                        className="w-16 mt-2 mx-auto block bg-kyokushin-bg border border-kyokushin-border rounded-lg px-2 py-1.5 text-white text-center text-xl font-bold focus:outline-none focus:border-kyokushin-red"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {isDraw && canExtend ? (
                      <button
                        onClick={handleStartExtension}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
                      >
                        Unentschieden — Verlängerung starten
                      </button>
                    ) : isDraw ? (
                      <div className="space-y-2">
                        <p className="text-xs text-kyokushin-text-muted text-center">Unentschieden — Richterentscheid</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setScore1(1); setScore2(0); }}
                            className="flex-1 bg-red-600/80 hover:bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
                          >
                            {getName(currentMatch.fighter1Id)?.split(',')[0]}
                          </button>
                          <button
                            onClick={() => { setScore1(0); setScore2(1); }}
                            className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
                          >
                            {getName(currentMatch.fighter2Id)?.split(',')[0]}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleSubmitResult}
                        className="w-full bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
                      >
                        Bestätigen
                      </button>
                    )}
                    <button
                      onClick={() => setShowResultModal(false)}
                      className="w-full bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-4 py-2.5 rounded-lg text-sm transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-kyokushin-text-muted text-center">
                {getName(currentMatch.fighter1Id)} vs {getName(currentMatch.fighter2Id)}
              </p>

              <button
                onClick={handleOpenResult}
                className="w-full flex items-center justify-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-xl font-bold text-sm transition-colors"
              >
                Ergebnis eintragen
              </button>

              {canExtend && (
                <button
                  onClick={handleStartExtension}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  Verlängerung starten
                  <span className="text-xs font-normal opacity-80">
                    ({Math.floor((category!.fightDuration2!) / 60)}:{String((category!.fightDuration2!) % 60).padStart(2, '0')})
                  </span>
                </button>
              )}

              <button
                onClick={() => { setShowDecisionModal(false); setShowDqModal(true); }}
                className="w-full flex items-center justify-center gap-2 bg-kyokushin-bg border border-kyokushin-border hover:border-kyokushin-red text-kyokushin-text-muted hover:text-kyokushin-red py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <ShieldBan size={14} />
                Disqualifizieren
              </button>

              <button
                onClick={() => setShowDecisionModal(false)}
                className="w-full text-kyokushin-text-muted hover:text-white py-2 text-sm transition-colors"
              >
                Abbrechen
              </button>
            </div>
          )
        ) : currentMatch && fighter1 && fighter2 ? (
          <div className="space-y-5">
            {/* Fighters */}
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full border-3 border-red-500 bg-kyokushin-bg flex items-center justify-center">
                  <span className="text-lg font-black text-red-400">
                    {fighter1.firstName[0]}{fighter1.lastName[0]}
                  </span>
                </div>
                <p className="text-base font-bold text-white">{fighter1.lastName.toUpperCase()}</p>
                <p className="text-sm text-white/80">{fighter1.firstName}</p>
                <p className="text-xs text-kyokushin-text-muted mt-0.5">{fighter1.club}</p>
                <p className="text-[10px] text-kyokushin-text-muted">{fighter1.weight} kg</p>
              </div>

              <div className="text-center shrink-0">
                <span className="text-2xl font-black text-kyokushin-red">VS</span>
              </div>

              <div className="flex-1 text-center">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full border-3 border-blue-500 bg-kyokushin-bg flex items-center justify-center">
                  <span className="text-lg font-black text-blue-400">
                    {fighter2.firstName[0]}{fighter2.lastName[0]}
                  </span>
                </div>
                <p className="text-base font-bold text-white">{fighter2.lastName.toUpperCase()}</p>
                <p className="text-sm text-white/80">{fighter2.firstName}</p>
                <p className="text-xs text-kyokushin-text-muted mt-0.5">{fighter2.club}</p>
                <p className="text-[10px] text-kyokushin-text-muted">{fighter2.weight} kg</p>
              </div>
            </div>

            {/* Timer */}
            {isRunning && (
              <div>
                <FightTimer
                  timerEndsAt={currentMatch.timerEndsAt}
                  timerPausedRemaining={currentMatch.timerPausedRemaining}
                />
                {isPaused && (
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => handleAddTime(10)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 text-amber-400 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Plus size={12} />
                      10 Sek
                    </button>
                    <button
                      onClick={() => handleAddTime(20)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 text-amber-400 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Plus size={12} />
                      20 Sek
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {currentMatch.status === 'pending' && (
                <button
                  onClick={handleStartFight}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  <Play size={18} />
                  Kampf starten
                </button>
              )}

              {isTimerActive && (
                <>
                  <button
                    onClick={handlePause}
                    className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    <Pause size={18} />
                    Pause
                  </button>
                  <button
                    onClick={handleStop}
                    className="flex-1 flex items-center justify-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    <Square size={18} />
                    Stopp / Ergebnis
                  </button>
                </>
              )}

              {isPaused && (
                <>
                  <button
                    onClick={handleResume}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    <Play size={18} />
                    Weiter
                  </button>
                  <button
                    onClick={handleStop}
                    className="flex-1 flex items-center justify-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    <Square size={18} />
                    Stopp / Ergebnis
                  </button>
                </>
              )}
            </div>

            {/* Duration info when not yet started */}
            {currentMatch.status === 'pending' && category && (
              <div className="flex items-center justify-center gap-2 text-xs text-kyokushin-text-muted">
                <Timer size={12} />
                <span>
                  {Math.floor((category.fightDuration1 ?? 120) / 60)}:{String((category.fightDuration1 ?? 120) % 60).padStart(2, '0')} Kampfzeit
                  {category.fightDuration2 && (
                    <> · {Math.floor(category.fightDuration2 / 60)}:{String(category.fightDuration2 % 60).padStart(2, '0')} Verlängerung</>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kyokushin-bg flex items-center justify-center">
              <span className="text-2xl font-bold text-kyokushin-text-muted">{matNumber}</span>
            </div>
            <p className="text-white font-semibold">
              {completed === total && total > 0
                ? 'Alle Kämpfe beendet!'
                : total === 0
                  ? 'Keine Kämpfe zugewiesen'
                  : 'Warte auf nächsten Kampf...'}
            </p>
            <p className="text-xs text-kyokushin-text-muted mt-1">Matte {matNumber}</p>
          </div>
        )}
      </div>

      {/* Next Match Preview */}
      {!showInlinePanel && nextF1 && nextF2 && (
        <div className="bg-kyokushin-gold/5 border-t border-kyokushin-gold/20 px-5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-kyokushin-gold animate-pulse" />
            <span className="text-[10px] font-bold text-kyokushin-gold uppercase tracking-widest">
              Nächster Kampf
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <div>
              <span className="font-bold text-white">{nextF1.lastName.toUpperCase()}</span>
              <span className="text-kyokushin-text-muted ml-1.5 text-xs">{nextF1.club}</span>
            </div>
            <span className="text-xs font-black text-kyokushin-gold">VS</span>
            <div className="text-right">
              <span className="font-bold text-white">{nextF2.lastName.toUpperCase()}</span>
              <span className="text-kyokushin-text-muted ml-1.5 text-xs">{nextF2.club}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Bracket */}
      {!showInlinePanel && category && categoryMatches.length > 0 && category.tournamentFormat !== 'round_robin' && (
        <div className="border-t border-kyokushin-border">
          <button
            onClick={() => setShowBracket(!showBracket)}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium text-kyokushin-text-muted hover:text-white transition-colors"
          >
            {showBracket ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Turnierbaum {showBracket ? 'verbergen' : 'anzeigen'}
          </button>
          {showBracket && (
            <div className="px-4 pb-4 overflow-x-auto">
              <BracketTree
                matches={categoryMatches}
                totalRounds={totalRounds}
                getName={getName}
                getClub={getClub}
                readonly
                currentMatchId={currentMatch?.id}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
