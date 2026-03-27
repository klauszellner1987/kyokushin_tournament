import { Minus, Plus } from 'lucide-react';

export type TouchScoreAccent = 'red' | 'blue';

interface TouchScorePickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  accent?: TouchScoreAccent;
  /** Kompaktere Abstände (z. B. Mat-Modal) */
  size?: 'default' | 'compact';
}

export default function TouchScorePicker({
  value,
  onChange,
  min = 0,
  accent = 'red',
  size = 'default',
}: TouchScorePickerProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(value + 1);

  const border =
    accent === 'red'
      ? 'border-red-500/35 focus-visible:ring-red-500/40'
      : 'border-blue-500/35 focus-visible:ring-blue-500/40';

  const sideBtn =
    accent === 'red'
      ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-300'
      : 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-300';

  const padY = size === 'compact' ? 'py-2.5' : 'py-3.5';
  const padX = size === 'compact' ? 'px-3' : 'px-4';
  const midText = size === 'compact' ? 'text-xl' : 'text-2xl';

  return (
    <div className="w-full flex items-stretch gap-2">
      <button
        type="button"
        onClick={dec}
        aria-label="Ein Punkt weniger"
        className={`shrink-0 flex items-center justify-center rounded-xl border-2 font-bold transition-colors touch-manipulation ${sideBtn} ${padX} ${padY} disabled:opacity-40 disabled:pointer-events-none`}
        disabled={value <= min}
      >
        <Minus className={size === 'compact' ? 'size-5' : 'size-6'} strokeWidth={2.5} />
      </button>
      <div
        className={`flex-1 flex items-center justify-center rounded-xl border-2 bg-kyokushin-bg/80 min-h-[3rem] sm:min-h-[3.25rem] ${border}`}
      >
        <span className={`font-black tabular-nums text-white ${midText}`}>{value}</span>
      </div>
      <button
        type="button"
        onClick={inc}
        aria-label="Ein Punkt mehr"
        className={`shrink-0 flex items-center justify-center rounded-xl border-2 font-bold transition-colors touch-manipulation ${sideBtn} ${padX} ${padY}`}
      >
        <Plus className={size === 'compact' ? 'size-5' : 'size-6'} strokeWidth={2.5} />
      </button>
    </div>
  );
}
