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

function formatDigits(digits: string): string {
  if (digits.length >= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
  }
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  return digits;
}

function digitPosition(formatted: string, digitIndex: number): number {
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== '.') {
      if (count === digitIndex) return i;
      count++;
    }
  }
  return formatted.length;
}

export default function DateInput({ value, onChange, className = '' }: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    onChange(formatDigits(digits));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;

    const input = e.currentTarget;
    const pos = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? pos;
    const digits = value.replace(/\D/g, '');

    if (selEnd > pos) {
      e.preventDefault();
      const startDigit = value.slice(0, pos).replace(/\D/g, '').length;
      const endDigit = value.slice(0, selEnd).replace(/\D/g, '').length;
      const remaining = digits.slice(0, startDigit) + digits.slice(endDigit);
      const formatted = formatDigits(remaining);
      onChange(formatted);
      requestAnimationFrame(() => {
        const newPos = digitPosition(formatted, startDigit);
        input.setSelectionRange(newPos, newPos);
      });
      return;
    }

    if (e.key === 'Backspace') {
      if (pos === 0) return;
      e.preventDefault();

      let charPos = pos - 1;
      if (value[charPos] === '.') charPos--;
      if (charPos < 0) return;

      const digitIdx = value.slice(0, charPos + 1).replace(/\D/g, '').length - 1;
      const remaining = digits.slice(0, digitIdx) + digits.slice(digitIdx + 1);
      const formatted = formatDigits(remaining);
      onChange(formatted);

      requestAnimationFrame(() => {
        const newPos = digitPosition(formatted, digitIdx);
        input.setSelectionRange(newPos, newPos);
      });
    } else {
      if (pos >= value.length) return;
      e.preventDefault();

      let charPos = pos;
      if (value[charPos] === '.') charPos++;
      if (charPos >= value.length) return;

      const digitIdx = value.slice(0, charPos + 1).replace(/\D/g, '').length - 1;
      const remaining = digits.slice(0, digitIdx) + digits.slice(digitIdx + 1);
      const formatted = formatDigits(remaining);
      onChange(formatted);

      requestAnimationFrame(() => {
        const newPos = digitPosition(formatted, digitIdx);
        input.setSelectionRange(newPos, newPos);
      });
    }
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
        ref={inputRef}
        type="text"
        placeholder="TT.MM.JJJJ"
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
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
