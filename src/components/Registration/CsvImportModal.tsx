import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, SkipForward, RefreshCw } from 'lucide-react';
import type { Participant, BeltGrade, Discipline } from '../../types';
import { BELT_COLORS } from '../../types';

export interface ParsedEntry {
  firstName: string;
  lastName: string;
  club: string;
  birthDate: string;
  weight: number;
  beltGrade: BeltGrade;
  gender: 'M' | 'W';
  discipline: Discipline[];
  categoryIds: string[];
}

export interface DuplicateEntry {
  parsed: ParsedEntry;
  existing: Participant;
  action: 'skip' | 'overwrite' | 'add';
}

interface Props {
  newEntries: ParsedEntry[];
  duplicates: DuplicateEntry[];
  onConfirm: (newEntries: ParsedEntry[], duplicates: DuplicateEntry[]) => void;
  onCancel: () => void;
}

export default function CsvImportModal({ newEntries, duplicates: initialDuplicates, onConfirm, onCancel }: Props) {
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>(initialDuplicates);

  const setAction = (index: number, action: DuplicateEntry['action']) => {
    setDuplicates((prev) => prev.map((d, i) => (i === index ? { ...d, action } : d)));
  };

  const setAllActions = (action: DuplicateEntry['action']) => {
    setDuplicates((prev) => prev.map((d) => ({ ...d, action })));
  };

  const actionCount = {
    skip: duplicates.filter((d) => d.action === 'skip').length,
    overwrite: duplicates.filter((d) => d.action === 'overwrite').length,
    add: duplicates.filter((d) => d.action === 'add').length,
  };

  const totalToImport = newEntries.length + actionCount.overwrite + actionCount.add;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kyokushin-border">
          <h3 className="text-lg font-semibold text-white">CSV Import Ergebnis</h3>
          <button onClick={onCancel} className="text-kyokushin-text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-4 px-6 py-4 border-b border-kyokushin-border">
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-sm text-green-400">{newEntries.length} neue Teilnehmer</span>
          </div>
          {duplicates.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertTriangle size={16} className="text-amber-400" />
              <span className="text-sm text-amber-400">{duplicates.length} Duplikate erkannt</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {duplicates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Duplikate bearbeiten</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAllActions('skip')}
                    className="text-xs bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Alle überspringen
                  </button>
                  <button
                    onClick={() => setAllActions('overwrite')}
                    className="text-xs bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Alle überschreiben
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {duplicates.map((dup, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-4 transition-colors ${
                      dup.action === 'skip'
                        ? 'border-kyokushin-border/50 opacity-60'
                        : dup.action === 'overwrite'
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-green-500/40 bg-green-500/5'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-kyokushin-text-muted mb-1">Bestehend</div>
                        <div className="text-sm text-white">
                          {dup.existing.lastName}, {dup.existing.firstName}
                        </div>
                        <div className="text-xs text-kyokushin-text-muted mt-1">
                          {dup.existing.club} &middot; {dup.existing.weight > 0 ? `${dup.existing.weight} kg` : '-'} &middot;{' '}
                          <span
                            className="inline-block px-1.5 py-0 rounded text-xs"
                            style={{
                              backgroundColor: BELT_COLORS[dup.existing.beltGrade] + '30',
                              color:
                                BELT_COLORS[dup.existing.beltGrade] === '#1a1a1a'
                                  ? '#fff'
                                  : BELT_COLORS[dup.existing.beltGrade],
                            }}
                          >
                            {dup.existing.beltGrade}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-kyokushin-text-muted mb-1">Aus CSV</div>
                        <div className="text-sm text-white">
                          {dup.parsed.lastName}, {dup.parsed.firstName}
                        </div>
                        <div className="text-xs text-kyokushin-text-muted mt-1">
                          {dup.parsed.club} &middot; {dup.parsed.weight > 0 ? `${dup.parsed.weight} kg` : '-'} &middot;{' '}
                          <span
                            className="inline-block px-1.5 py-0 rounded text-xs"
                            style={{
                              backgroundColor: BELT_COLORS[dup.parsed.beltGrade] + '30',
                              color:
                                BELT_COLORS[dup.parsed.beltGrade] === '#1a1a1a'
                                  ? '#fff'
                                  : BELT_COLORS[dup.parsed.beltGrade],
                            }}
                          >
                            {dup.parsed.beltGrade}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setAction(i, 'skip')}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          dup.action === 'skip'
                            ? 'bg-kyokushin-text-muted/20 text-white'
                            : 'bg-kyokushin-border text-kyokushin-text-muted hover:text-white'
                        }`}
                      >
                        <SkipForward size={12} />
                        Überspringen
                      </button>
                      <button
                        onClick={() => setAction(i, 'overwrite')}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          dup.action === 'overwrite'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-kyokushin-border text-kyokushin-text-muted hover:text-white'
                        }`}
                      >
                        <RefreshCw size={12} />
                        Überschreiben
                      </button>
                      <button
                        onClick={() => setAction(i, 'add')}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          dup.action === 'add'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-kyokushin-border text-kyokushin-text-muted hover:text-white'
                        }`}
                      >
                        <CheckCircle size={12} />
                        Trotzdem hinzufügen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newEntries.length > 0 && duplicates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-kyokushin-border">
              <h4 className="text-sm font-medium text-white mb-2">
                {newEntries.length} neue Einträge werden importiert
              </h4>
              <div className="text-xs text-kyokushin-text-muted space-y-1 max-h-32 overflow-y-auto">
                {newEntries.map((e, i) => (
                  <div key={i}>
                    {e.lastName}, {e.firstName} — {e.club}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-kyokushin-border">
          <span className="text-sm text-kyokushin-text-muted">
            {totalToImport} Teilnehmer werden importiert
            {actionCount.skip > 0 && `, ${actionCount.skip} übersprungen`}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onConfirm(newEntries, duplicates)}
              className="bg-kyokushin-red hover:bg-kyokushin-red-dark text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Importieren ({totalToImport})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
