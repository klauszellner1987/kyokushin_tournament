import { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function toISO(de: string): string {
  const parts = de.split('.');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

function toDE(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
}

export function parseDateDE(input: string): string {
  return toISO(input) || input;
}

export function formatDateDE(iso: string): string {
  return toDE(iso);
}

export default function DateInput({ value, onChange, className = '' }: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    const digits = v.replace(/\D/g, '');
    if (digits.length >= 5) {
      v = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
    } else if (digits.length >= 3) {
      v = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    } else {
      v = digits;
    }
    onChange(v);
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChange(toDE(e.target.value));
    }
  };

  const isoValue = toISO(value);

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        placeholder="TT.MM.JJJJ"
        value={value}
        onChange={handleTextChange}
        maxLength={10}
        className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg pl-3 pr-10 py-2 text-white text-sm placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
      />
      <button
        type="button"
        onClick={() => pickerRef.current?.showPicker()}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-kyokushin-text-muted hover:text-kyokushin-red transition-colors"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={isoValue}
        onChange={handlePickerChange}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  );
}
