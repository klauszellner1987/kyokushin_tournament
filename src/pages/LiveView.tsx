import { useParams } from 'react-router';
import { useTournamentData } from '../hooks/useTournament';
import { getMatOverview } from '../utils/matScheduler';
import Kanku from '../components/Layout/Kanku';
import type { Participant, Match } from '../types';

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
              <div className="text-6xl font-black text-kyokushin-red drop-shadow-[0_0_30px_rgba(230,57,70,0.5)]">
                VS
              </div>
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

      <div className="bg-kyokushin-nav/80 backdrop-blur border-t border-kyokushin-border px-8 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-kyokushin-red animate-pulse" />
          <span className="text-sm text-white font-medium">MATTE {matNumber}</span>
        </div>
        <span className="text-sm text-kyokushin-text-muted">
          {tournamentName}
          {tournamentDate && ` · ${new Date(tournamentDate).toLocaleDateString('de-DE')}`}
        </span>
        {nextMatch && nextF1 && nextF2 && (
          <span className="text-sm text-kyokushin-text-muted">
            Nächster Kampf:{' '}
            <span className="text-white font-medium">
              {nextF1.lastName} vs. {nextF2.lastName}
            </span>
          </span>
        )}
      </div>
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
}: {
  matOverview: ReturnType<typeof getMatOverview>;
  participantMap: Map<string, Participant>;
  tournamentName: string;
  tournamentDate: string;
  fightGroupsData: { id: string; categoryId: string }[];
  categoriesData: { id: string; name: string }[];
}) {
  const getCategoryForMatch = (m: Match | null) => {
    if (!m) return null;
    const group = fightGroupsData.find((g) => g.id === m.fightGroupId);
    if (!group) return null;
    return categoriesData.find((c) => c.id === group.categoryId)?.name ?? null;
  };

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
        <div className={`grid gap-6 h-full ${matOverview.length <= 2 ? 'grid-cols-2' : matOverview.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
                  <div className="flex-1 flex items-center justify-center">
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
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-kyokushin-text-muted text-sm">
                      {mat.completed === mat.total && mat.total > 0 ? 'Abgeschlossen' : 'Wartet...'}
                    </p>
                  </div>
                )}

                {nf1 && nf2 && (
                  <div className="mt-4 pt-3 border-t border-kyokushin-border">
                    <p className="text-xs text-kyokushin-text-muted">
                      Nächster Kampf:{' '}
                      <span className="text-white">{nf1.lastName} vs. {nf2.lastName}</span>
                    </p>
                  </div>
                )}

                {/* Progress bar */}
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

  // Overview of all mats
  return (
    <OverviewView
      matOverview={overview}
      participantMap={participantMap}
      tournamentName={tournament.name}
      tournamentDate={tournament.date}
      fightGroupsData={fightGroups.data}
      categoriesData={categories.data}
    />
  );
}
