import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import type { Category, FightGroup, Match, Participant } from '../../types';
import { getMatOverview } from '../../utils/matScheduler';
import { countFinishedScheduledFights, countScheduledFights } from '../../utils/matchProgress';
import MatPanel from './MatPanel';

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
  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  const overview = useMemo(
    () => getMatOverview(matches.data, matCount),
    [matches.data, matCount],
  );

  const hasAnyMatches = matches.data.length > 0;

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Kampfleitung</h3>
          <p className="text-sm text-kyokushin-text-muted">
            {matCount} {matCount === 1 ? 'Matte' : 'Matten'} · {countFinishedScheduledFights(matches.data)}/{countScheduledFights(matches.data)} Kämpfe abgeschlossen
          </p>
        </div>
      </div>

      <div className={`grid gap-6 ${
        matCount === 1
          ? 'grid-cols-1 max-w-2xl mx-auto'
          : matCount === 2
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
      }`}>
        {overview.map((mat) => (
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
    </div>
  );
}
