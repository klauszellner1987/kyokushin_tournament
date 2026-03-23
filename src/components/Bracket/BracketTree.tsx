import { Trophy } from 'lucide-react';
import type { Match } from '../../types';
import { getRoundLabel } from '../../utils/bracketGenerator';

interface Props {
  matches: Match[];
  totalRounds: number;
  getName: (id: string | null) => string;
  getClub: (id: string | null) => string;
  onMatchClick?: (match: Match) => void;
  isWithdrawn?: (id: string | null) => boolean;
  readonly?: boolean;
  currentMatchId?: string | null;
}

function FighterSlot({
  fighterId,
  isWinner,
  isBye,
  score,
  getName,
  getClub,
  isWithdrawn,
  showScore,
  isCurrent,
}: {
  fighterId: string | null;
  isWinner: boolean;
  isBye: boolean;
  score: number;
  getName: (id: string | null) => string;
  getClub: (id: string | null) => string;
  isWithdrawn?: (id: string | null) => boolean;
  showScore: boolean;
  isCurrent: boolean;
}) {
  const withdrawn = isWithdrawn?.(fighterId) ?? false;
  const name = getName(fighterId);
  const club = getClub(fighterId);

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 min-w-0 transition-colors ${
        isWinner
          ? 'bg-kyokushin-gold/15'
          : isCurrent
            ? 'bg-kyokushin-red/10'
            : ''
      }`}
    >
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isWinner
            ? 'bg-kyokushin-gold shadow-[0_0_6px_rgba(212,175,55,0.5)]'
            : isBye
              ? 'bg-kyokushin-border'
              : fighterId
                ? 'bg-white/70'
                : 'bg-kyokushin-border/50'
        }`}
      />
      <span
        className={`text-sm font-medium truncate flex-1 ${
          isWinner
            ? 'text-kyokushin-gold font-bold'
            : withdrawn
              ? 'line-through opacity-40 text-kyokushin-text-muted'
              : isBye
                ? 'text-kyokushin-text-muted italic'
                : fighterId
                  ? 'text-white'
                  : 'text-kyokushin-text-muted/50'
        }`}
      >
        {isBye ? 'BYE' : name}
      </span>
      {club && !isBye && !isWinner && (
        <span className="text-[10px] text-kyokushin-text-muted truncate max-w-[80px] hidden lg:inline">
          {club}
        </span>
      )}
      {showScore && (
        <span className={`text-xs font-bold shrink-0 ${isWinner ? 'text-kyokushin-gold' : 'text-kyokushin-text-muted'}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function MatchNode({
  match,
  getName,
  getClub,
  onMatchClick,
  isWithdrawn,
  readonly,
  isCurrent,
}: {
  match: Match;
  getName: (id: string | null) => string;
  getClub: (id: string | null) => string;
  onMatchClick?: (match: Match) => void;
  isWithdrawn?: (id: string | null) => boolean;
  readonly?: boolean;
  isCurrent: boolean;
}) {
  const isBye = match.status === 'bye';
  const isWalkover = match.status === 'walkover';
  const isDq = match.status === 'disqualification';
  const isCompleted = match.status === 'completed';
  const showScore = isCompleted && !isBye;
  const canClick = !readonly && !isCompleted && !isWalkover && !isDq && !isBye && match.fighter1Id && match.fighter2Id;

  return (
    <div
      className={`w-56 rounded-lg overflow-hidden border transition-all ${
        isCurrent
          ? 'border-kyokushin-red shadow-lg shadow-kyokushin-red/20 ring-1 ring-kyokushin-red/30'
          : isCompleted || isWalkover || isDq
            ? isDq ? 'border-red-500/40' : 'border-kyokushin-border/60'
            : match.fighter1Id && match.fighter2Id
              ? 'border-kyokushin-red/60 shadow-md shadow-kyokushin-red/10'
              : 'border-kyokushin-border/30'
      } ${canClick ? 'cursor-pointer hover:border-kyokushin-red hover:shadow-lg hover:shadow-kyokushin-red/20' : ''}`}
      onClick={() => canClick && onMatchClick?.(match)}
    >
      <FighterSlot
        fighterId={match.fighter1Id}
        isWinner={match.winnerId === match.fighter1Id && match.winnerId !== null}
        isBye={isBye && !match.fighter1Id}
        score={match.score1}
        getName={getName}
        getClub={getClub}
        isWithdrawn={isWithdrawn}
        showScore={showScore}
        isCurrent={isCurrent}
      />
      <div className="h-px bg-kyokushin-border/30" />
      <FighterSlot
        fighterId={match.fighter2Id}
        isWinner={match.winnerId === match.fighter2Id && match.winnerId !== null}
        isBye={isBye && !match.fighter2Id}
        score={match.score2}
        getName={getName}
        getClub={getClub}
        isWithdrawn={isWithdrawn}
        showScore={showScore}
        isCurrent={isCurrent}
      />
      {isWalkover && (
        <div className="bg-amber-500/10 px-3 py-0.5 text-center">
          <span className="text-[10px] text-amber-400 font-medium">W.O.</span>
        </div>
      )}
      {isDq && (
        <div className="bg-red-500/10 px-3 py-0.5 text-center">
          <span className="text-[10px] text-red-400 font-medium">DSQ</span>
        </div>
      )}
    </div>
  );
}

export default function BracketTree({
  matches,
  totalRounds,
  getName,
  getClub,
  onMatchClick,
  isWithdrawn,
  readonly,
  currentMatchId,
}: Props) {
  if (totalRounds === 0 || matches.length === 0) return null;

  const rounds = new Map<number, Match[]>();
  for (const m of matches) {
    const existing = rounds.get(m.round) ?? [];
    existing.push(m);
    rounds.set(m.round, existing);
  }

  const sortedRounds = Array.from(rounds.entries()).sort(([a], [b]) => a - b);

  const finalMatch = matches.find((m) => m.round === totalRounds);
  const champion = finalMatch?.winnerId ? getName(finalMatch.winnerId) : null;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-stretch min-w-max">
        {sortedRounds.map(([round, roundMatches]) => {
          const sorted = roundMatches.sort((a, b) => a.position - b.position);
          const isLastRound = round === totalRounds;

          return (
            <div key={round} className="flex flex-col shrink-0">
              <h4 className="text-xs font-bold text-kyokushin-text-muted uppercase tracking-widest mb-4 text-center px-4">
                {getRoundLabel(round, totalRounds)}
              </h4>
              <div className="flex flex-col justify-around flex-1 relative">
                {sorted.map((m, matchIdx) => (
                  <div key={m.id} className="flex items-center">
                    <div className="px-3 py-2">
                      <MatchNode
                        match={m}
                        getName={getName}
                        getClub={getClub}
                        onMatchClick={onMatchClick}
                        isWithdrawn={isWithdrawn}
                        readonly={readonly}
                        isCurrent={m.id === currentMatchId}
                      />
                    </div>
                    {!isLastRound && (
                      <div className="flex flex-col items-stretch w-8 self-stretch">
                        <div
                          className={`flex-1 ${
                            matchIdx % 2 === 0
                              ? 'border-b-2 border-r-2 border-kyokushin-red/40'
                              : 'border-t-2 border-r-2 border-kyokushin-red/40'
                          } ${
                            m.winnerId
                              ? matchIdx % 2 === 0
                                ? 'border-b-kyokushin-gold/60 border-r-kyokushin-gold/60'
                                : 'border-t-kyokushin-gold/60 border-r-kyokushin-gold/60'
                              : ''
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex flex-col justify-center shrink-0 pl-2">
          <div className="mt-8">
            <div className="bg-gradient-to-r from-kyokushin-gold/20 to-kyokushin-gold/5 border-2 border-kyokushin-gold/60 rounded-xl w-48 p-5 text-center">
              <Trophy size={28} className="mx-auto text-kyokushin-gold mb-2 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              <p className="text-[10px] text-kyokushin-gold/70 uppercase tracking-widest font-bold mb-1">Champion</p>
              <p className={`text-lg font-black ${champion ? 'text-kyokushin-gold' : 'text-kyokushin-text-muted'}`}>
                {champion ?? 'Noch offen'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
