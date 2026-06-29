import { useMemo, useState } from 'react';
import { Radio, Search, Swords, X } from 'lucide-react';
import type { Category, FightGroup, Match, Participant } from '../../types';
import { getMatOverview } from '../../utils/matScheduler';
import { countFinishedScheduledFights, countScheduledFights } from '../../utils/matchProgress';
import { advanceWinner } from '../../utils/bracketGenerator';
import MatPanel from './MatPanel';
import TouchScorePicker from '../ui/TouchScorePicker';

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
  }

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

      {/* Mats Grid */}
      <div className={`grid gap-6 ${
        filteredOverview.length === 1
          ? 'grid-cols-1 max-w-4xl mx-auto'
          : filteredOverview.length === 2
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
    </div>
  );
}
