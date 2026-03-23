import { useState } from 'react';
import { useParams } from 'react-router';
import { useTournamentData } from '../hooks/useTournament';
import { getMatOverview } from '../utils/matScheduler';
import { useTimer } from '../hooks/useTimer';
import Kanku from '../components/Layout/Kanku';
import BracketTree from '../components/Bracket/BracketTree';
import type { Participant, Match, FightGroup, Category } from '../types';

function FighterCard({ fighter }: { fighter: Participant }) {
  return (
    <div className="flex-1 text-center">
      <div className="w-32 h-32 mx-auto mb-6 rounded-full border-4 border-kyokushin-red bg-kyokushin-card flex items-center justify-center">
        <span className="text-4xl font-black text-kyokushin-red">
          {fighter.firstName[0]}{fighter.lastName[0]}
        </span>
      </div>
      <h2 className="text-3xl font-black text-white tracking-wider">
        {fighter.lastName.toUpperCase()} {fighter.firstName}
      </h2>
      <p className="text-kyokushin-text-muted mt-2 text-lg">{fighter.club}</p>
      <div className="flex items-center justify-center gap-4 mt-4 text-sm text-kyokushin-text-muted">
        <span>Gürtelgrad: {fighter.beltGrade}</span>
        <span>|</span>
        <span>{fighter.weight} kg</span>
      </div>
    </div>
  );
}

function LiveTimer({ timerEndsAt, timerPausedRemaining }: { timerEndsAt?: number; timerPausedRemaining?: number }) {
  const { formatted, isRunning, isPaused, isExpired, isWarning } = useTimer(timerEndsAt, timerPausedRemaining);

  return (
    <div
      className={`font-mono font-black tabular-nums text-8xl transition-all ${
        isExpired
          ? 'text-kyokushin-red animate-pulse'
          : isWarning
            ? 'text-kyokushin-red'
            : isPaused
              ? 'text-amber-400'
              : isRunning
                ? 'text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]'
                : 'text-kyokushin-text-muted'
      }`}
    >
      {formatted}
      {isPaused && (
        <span className="block text-sm font-bold uppercase tracking-widest text-amber-400 mt-1">Pausiert</span>
      )}
    </div>
  );
}

function SingleMatView({
  matNumber,
  currentMatch,
  nextMatch,
  participantMap,
  tournamentName,
  tournamentDate,
  completedOnMat,
  totalOnMat,
  categoryName,
}: {
  matNumber: number;
  currentMatch: Match | null;
  nextMatch: Match | null;
  participantMap: Map<string, Participant>;
  tournamentName: string;
  tournamentDate: string;
  completedOnMat: number;
  totalOnMat: number;
  categoryName: string | null;
}) {
  const fighter1 = currentMatch?.fighter1Id ? participantMap.get(currentMatch.fighter1Id) : null;
  const fighter2 = currentMatch?.fighter2Id ? participantMap.get(currentMatch.fighter2Id) : null;
  const nextF1 = nextMatch?.fighter1Id ? participantMap.get(nextMatch.fighter1Id) : null;
  const nextF2 = nextMatch?.fighter2Id ? participantMap.get(nextMatch.fighter2Id) : null;

  const hasTimer = currentMatch?.status === 'running' &&
    (currentMatch.timerEndsAt != null || currentMatch.timerPausedRemaining != null);

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <Kanku size={600} />
      </div>

      <div className="flex items-center justify-between px-8 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <Kanku size={32} />
          <span className="text-lg font-bold text-white">{tournamentName}</span>
        </div>
        <div className="flex items-center gap-3">
          {categoryName && (
            <span className="bg-kyokushin-red text-white px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide">
              {categoryName}
            </span>
          )}
          {currentMatch?.isExtension && (
            <span className="bg-amber-500/20 text-amber-400 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide">
              Verlängerung
            </span>
          )}
          <span className="bg-kyokushin-gold/20 text-kyokushin-gold px-4 py-1.5 rounded-full text-sm font-bold">
            MATTE {matNumber}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-8 relative z-10">
        {currentMatch && fighter1 && fighter2 ? (
          <div className="flex items-center gap-12 w-full max-w-5xl">
            <FighterCard fighter={fighter1} />
            <div className="text-center">
              {hasTimer ? (
                <LiveTimer
                  timerEndsAt={currentMatch.timerEndsAt}
                  timerPausedRemaining={currentMatch.timerPausedRemaining}
                />
              ) : (
                <div className="text-6xl font-black text-kyokushin-red drop-shadow-[0_0_30px_rgba(230,57,70,0.5)]">
                  VS
                </div>
              )}
              <p className="text-kyokushin-text-muted mt-2 text-sm">
                KAMPF {completedOnMat + 1} von {totalOnMat}
              </p>
            </div>
            <FighterCard fighter={fighter2} />
          </div>
        ) : (
          <div className="text-center">
            <Kanku size={120} className="mx-auto mb-8 opacity-30" />
            <h2 className="text-3xl font-bold text-white mb-2">
              {completedOnMat === totalOnMat && totalOnMat > 0
                ? 'Alle Kämpfe auf dieser Matte beendet!'
                : 'Warte auf nächsten Kampf...'}
            </h2>
            <p className="text-kyokushin-text-muted text-lg">Matte {matNumber}</p>
          </div>
        )}
      </div>

      {nextMatch && nextF1 && nextF2 && (
        <div className="bg-kyokushin-gold/10 border-t border-b border-kyokushin-gold/30 px-8 py-4 relative z-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-kyokushin-gold animate-pulse" />
            <span className="text-sm font-bold text-kyokushin-gold uppercase tracking-widest">
              Bitte bereit machen
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-kyokushin-gold animate-pulse" />
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-right">
              <p className="text-xl font-bold text-white">
                {nextF1.lastName.toUpperCase()} {nextF1.firstName}
              </p>
              <p className="text-sm text-kyokushin-text-muted">{nextF1.club}</p>
            </div>
            <span className="text-lg font-black text-kyokushin-gold">VS</span>
            <div className="text-left">
              <p className="text-xl font-bold text-white">
                {nextF2.lastName.toUpperCase()} {nextF2.firstName}
              </p>
              <p className="text-sm text-kyokushin-text-muted">{nextF2.club}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-kyokushin-nav/80 backdrop-blur border-t border-kyokushin-border px-8 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-kyokushin-red animate-pulse" />
          <span className="text-sm text-white font-medium">MATTE {matNumber}</span>
        </div>
        <span className="text-sm text-kyokushin-text-muted">
          {tournamentName}
          {tournamentDate && ` · ${new Date(tournamentDate).toLocaleDateString('de-DE')}`}
        </span>
        <span className="text-sm text-kyokushin-text-muted">
          {completedOnMat}/{totalOnMat} Kämpfe
        </span>
      </div>
    </div>
  );
}

function OverviewMatTimer({ timerEndsAt, timerPausedRemaining }: { timerEndsAt?: number; timerPausedRemaining?: number }) {
  const { formatted, isWarning, isExpired, isPaused } = useTimer(timerEndsAt, timerPausedRemaining);
  return (
    <div className={`font-mono font-black tabular-nums text-2xl ${
      isExpired ? 'text-kyokushin-red animate-pulse' : isWarning ? 'text-kyokushin-red' : isPaused ? 'text-amber-400' : 'text-white'
    }`}>
      {formatted}
    </div>
  );
}

function OverviewView({
  matOverview,
  participantMap,
  tournamentName,
  tournamentDate,
  fightGroupsData,
  categoriesData,
  allMatches,
}: {
  matOverview: ReturnType<typeof getMatOverview>;
  participantMap: Map<string, Participant>;
  tournamentName: string;
  tournamentDate: string;
  fightGroupsData: FightGroup[];
  categoriesData: Category[];
  allMatches: Match[];
}) {
  const [bracketCategory, setBracketCategory] = useState<string | null>(null);

  const getCategoryForMatch = (m: Match | null) => {
    if (!m) return null;
    const group = fightGroupsData.find((g) => g.id === m.fightGroupId);
    if (!group) return null;
    return categoriesData.find((c) => c.id === group.categoryId)?.name ?? null;
  };

  const currentMatchIds = new Set(
    matOverview.map((mat) => mat.current?.id).filter(Boolean),
  );

  const categoriesWithMatches = categoriesData
    .filter((cat) => {
      const groups = fightGroupsData.filter((g) => g.categoryId === cat.id);
      return allMatches.some((m) => groups.some((g) => g.id === m.fightGroupId) && m.status !== 'bye');
    })
    .map((cat) => {
      const groups = fightGroupsData.filter((g) => g.categoryId === cat.id);
      const catMatches = allMatches.filter((m) => groups.some((g) => g.id === m.fightGroupId));
      const maxRound = Math.max(...catMatches.map((m) => m.round), 0);
      const isActive = catMatches.some((m) => currentMatchIds.has(m.id));
      return { ...cat, matches: catMatches, totalRounds: maxRound, isActive };
    });

  const activeBracketCat = bracketCategory
    ? categoriesWithMatches.find((c) => c.id === bracketCategory)
    : null;

  const getName = (id: string | null) => {
    if (!id) return 'Noch offen';
    const p = participantMap.get(id);
    return p ? `${p.lastName}, ${p.firstName}` : 'Noch offen';
  };
  const getClub = (id: string | null) => {
    if (!id) return '';
    return participantMap.get(id)?.club ?? '';
  };

  const activeCatCurrentMatchId = activeBracketCat
    ? activeBracketCat.matches.find((m) => currentMatchIds.has(m.id))?.id ?? null
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <Kanku size={600} />
      </div>

      <div className="flex items-center justify-between px-8 py-6 relative z-10">
        <div className="flex items-center gap-3">
          <Kanku size={40} />
          <div>
            <h1 className="text-2xl font-bold text-white">{tournamentName}</h1>
            {tournamentDate && (
              <p className="text-sm text-kyokushin-text-muted">
                {new Date(tournamentDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
        <span className="bg-kyokushin-red text-white px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wide">
          Live-Übersicht
        </span>
      </div>

      <div className="flex-1 px-8 pb-8 relative z-10">
        <div className={`grid gap-6 ${matOverview.length <= 2 ? 'grid-cols-2' : matOverview.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {matOverview.map((mat) => {
            const f1 = mat.current?.fighter1Id ? participantMap.get(mat.current.fighter1Id) : null;
            const f2 = mat.current?.fighter2Id ? participantMap.get(mat.current.fighter2Id) : null;
            const catName = getCategoryForMatch(mat.current);
            const nf1 = mat.next?.fighter1Id ? participantMap.get(mat.next.fighter1Id) : null;
            const nf2 = mat.next?.fighter2Id ? participantMap.get(mat.next.fighter2Id) : null;

            return (
              <div
                key={mat.matNumber}
                className="bg-kyokushin-card border border-kyokushin-border rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-kyokushin-red animate-pulse" />
                    <span className="text-lg font-bold text-white">Matte {mat.matNumber}</span>
                  </div>
                  <span className="text-sm text-kyokushin-text-muted">
                    {mat.completed}/{mat.total}
                  </span>
                </div>

                {catName && (
                  <span className="text-xs text-kyokushin-red font-medium mb-3 uppercase tracking-wide">
                    {catName}
                  </span>
                )}

                {f1 && f2 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className="text-center w-full">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-right flex-1">
                          <p className="text-xl font-bold text-white">
                            {f1.lastName.toUpperCase()}
                          </p>
                          <p className="text-sm text-kyokushin-text-muted">{f1.club}</p>
                        </div>
                        <span className="text-2xl font-black text-kyokushin-red">VS</span>
                        <div className="text-left flex-1">
                          <p className="text-xl font-bold text-white">
                            {f2.lastName.toUpperCase()}
                          </p>
                          <p className="text-sm text-kyokushin-text-muted">{f2.club}</p>
                        </div>
                      </div>
                    </div>
                    {mat.current?.status === 'running' && (mat.current.timerEndsAt || mat.current.timerPausedRemaining) && (
                      <OverviewMatTimer timerEndsAt={mat.current.timerEndsAt} timerPausedRemaining={mat.current.timerPausedRemaining} />
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-kyokushin-text-muted text-sm">
                      {mat.completed === mat.total && mat.total > 0 ? 'Abgeschlossen' : 'Wartet...'}
                    </p>
                  </div>
                )}

                {nf1 && nf2 && (
                  <div className="mt-4 pt-3 border-t border-kyokushin-gold/20 bg-kyokushin-gold/5 -mx-6 px-6 -mb-6 pb-4 rounded-b-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-kyokushin-gold animate-pulse" />
                      <span className="text-xs font-bold text-kyokushin-gold uppercase tracking-widest">
                        Bitte bereit machen
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{nf1.lastName.toUpperCase()} {nf1.firstName}</p>
                        <p className="text-xs text-kyokushin-text-muted">{nf1.club}</p>
                      </div>
                      <span className="text-xs font-black text-kyokushin-gold">VS</span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{nf2.lastName.toUpperCase()} {nf2.firstName}</p>
                        <p className="text-xs text-kyokushin-text-muted">{nf2.club}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <div className="w-full h-1.5 bg-kyokushin-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-kyokushin-red rounded-full transition-all duration-500"
                      style={{ width: mat.total > 0 ? `${(mat.completed / mat.total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {categoriesWithMatches.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="text-sm font-bold text-kyokushin-text-muted uppercase tracking-widest">Turnierbaum</span>
              {categoriesWithMatches.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setBracketCategory(bracketCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    bracketCategory === cat.id
                      ? 'bg-kyokushin-red text-white'
                      : cat.isActive
                        ? 'bg-kyokushin-red/20 text-kyokushin-red border border-kyokushin-red/40 hover:bg-kyokushin-red/30'
                        : 'bg-kyokushin-card text-kyokushin-text-muted border border-kyokushin-border hover:border-kyokushin-red/40'
                  }`}
                >
                  {cat.name}
                  {cat.isActive && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-kyokushin-red animate-pulse align-middle" />}
                </button>
              ))}
            </div>

            {activeBracketCat && (
              <div className="bg-kyokushin-card border border-kyokushin-border rounded-2xl p-6">
                <BracketTree
                  matches={activeBracketCat.matches}
                  totalRounds={activeBracketCat.totalRounds}
                  getName={getName}
                  getClub={getClub}
                  readonly
                  currentMatchId={activeCatCurrentMatchId}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveView() {
  const { id, matNr } = useParams<{ id: string; matNr?: string }>();
  const { tournament, participants, matches, categories, fightGroups } =
    useTournamentData(id);

  const participantMap = new Map(participants.data.map((p) => [p.id, p]));

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-kyokushin-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const matCount = tournament.matCount ?? 1;
  const overview = getMatOverview(matches.data, matCount);

  const getCategoryForMatch = (m: Match | null) => {
    if (!m) return null;
    const group = fightGroups.data.find((g) => g.id === m.fightGroupId);
    if (!group) return null;
    return categories.data.find((c) => c.id === group.categoryId)?.name ?? null;
  };

  // Per-mat view
  if (matNr) {
    const mat = parseInt(matNr);
    const matData = overview.find((o) => o.matNumber === mat);

    return (
      <SingleMatView
        matNumber={mat}
        currentMatch={matData?.current ?? null}
        nextMatch={matData?.next ?? null}
        participantMap={participantMap}
        tournamentName={tournament.name}
        tournamentDate={tournament.date}
        completedOnMat={matData?.completed ?? 0}
        totalOnMat={matData?.total ?? 0}
        categoryName={getCategoryForMatch(matData?.current ?? null)}
      />
    );
  }

  return (
    <OverviewView
      matOverview={overview}
      participantMap={participantMap}
      tournamentName={tournament.name}
      tournamentDate={tournament.date}
      fightGroupsData={fightGroups.data}
      categoriesData={categories.data}
      allMatches={matches.data}
    />
  );
}
