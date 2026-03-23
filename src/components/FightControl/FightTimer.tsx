import { useTimer } from '../../hooks/useTimer';

interface Props {
  timerEndsAt?: number;
  timerPausedRemaining?: number;
  size?: 'normal' | 'large';
}

export default function FightTimer({ timerEndsAt, timerPausedRemaining, size = 'normal' }: Props) {
  const { formatted, isRunning, isPaused, isExpired, isWarning } = useTimer(timerEndsAt, timerPausedRemaining);

  const isLarge = size === 'large';

  return (
    <div
      className={`rounded-xl font-mono font-black tabular-nums text-center transition-all ${
        isLarge ? 'text-6xl py-6 px-10' : 'text-4xl py-4 px-8'
      } ${
        isExpired
          ? 'bg-kyokushin-red/20 text-kyokushin-red border-2 border-kyokushin-red animate-pulse'
          : isWarning
            ? 'bg-kyokushin-red/15 text-kyokushin-red border-2 border-kyokushin-red/60'
            : isPaused
              ? 'bg-amber-500/10 text-amber-400 border-2 border-amber-500/40'
              : isRunning
                ? 'bg-kyokushin-card border-2 border-kyokushin-border text-white'
                : 'bg-kyokushin-card border-2 border-kyokushin-border text-kyokushin-text-muted'
      }`}
    >
      {formatted}
      {isPaused && (
        <span className={`block font-sans font-bold uppercase tracking-widest text-amber-400 ${isLarge ? 'text-sm mt-2' : 'text-xs mt-1'}`}>
          Pausiert
        </span>
      )}
      {isExpired && (
        <span className={`block font-sans font-bold uppercase tracking-widest text-kyokushin-red ${isLarge ? 'text-sm mt-2' : 'text-xs mt-1'}`}>
          Zeit abgelaufen
        </span>
      )}
    </div>
  );
}
