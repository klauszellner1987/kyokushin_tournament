import { useState, useRef, useMemo } from 'react';
import { Plus, Upload, Pencil, Trash2, Search, X, AlertTriangle } from 'lucide-react';
import type { Participant, Category, Discipline, BeltGrade, TournamentType, Match, ParticipantStatus } from '../../types';
import { BELT_GRADES, BELT_COLORS } from '../../types';
import DateInput, { parseDateDE, formatDateDE } from '../ui/DateInput';
import { autoAssign } from '../../utils/groupAssignment';
import CsvImportModal, { type ParsedEntry, type DuplicateEntry } from './CsvImportModal';

interface Props {
  tournamentId: string;
  tournamentType: TournamentType;
  participants: {
    data: Participant[];
    add: (item: Omit<Participant, 'id'>) => Promise<string>;
    update: (id: string, updates: Partial<Participant>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  categories: Category[];
  matches: Match[];
  onWithdraw?: (participantId: string, status: ParticipantStatus) => Promise<void>;
}

function getDefaultDiscipline(type: TournamentType): Discipline[] {
  if (type === 'kata') return ['kata'];
  if (type === 'kumite') return ['kumite'];
  return ['kumite'];
}

export default function ParticipantManager({ tournamentType, participants, categories, matches, onWithdraw }: Props) {
  const emptyForm: Omit<Participant, 'id'> = {
    firstName: '',
    lastName: '',
    club: '',
    birthDate: '',
    weight: 0,
    beltGrade: '10. Kyu',
    gender: 'M',
    discipline: getDefaultDiscipline(tournamentType),
    categoryIds: [],
  };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterBelt, setFilterBelt] = useState<string>('');
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterClub, setFilterClub] = useState<string>('');
  const [filterDiscipline, setFilterDiscipline] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [importNew, setImportNew] = useState<ParsedEntry[]>([]);
  const [importDuplicates, setImportDuplicates] = useState<DuplicateEntry[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<Participant | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { assignments } = useMemo(
    () => autoAssign(participants.data, categories),
    [participants.data, categories],
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const cat = categories.find((c) => c.id === a.categoryId);
      if (!cat) continue;
      for (const pid of a.participantIds) {
        const existing = map.get(pid) ?? [];
        existing.push(cat.name);
        map.set(pid, existing);
      }
    }
    return map;
  }, [assignments, categories]);

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;

    const data = { ...form, birthDate: parseDateDE(form.birthDate) };

    if (editId) {
      await participants.update(editId, data);
      setEditId(null);
    } else {
      await participants.add(data);
    }

    setForm(emptyForm);
    setShowForm(false);
  };

  const handleEdit = (p: Participant) => {
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      club: p.club,
      birthDate: formatDateDE(p.birthDate),
      weight: p.weight,
      beltGrade: p.beltGrade,
      gender: p.gender,
      discipline: p.discipline,
      categoryIds: p.categoryIds,
    });
    setEditId(p.id);
    setShowForm(true);
  };

  function participantKey(firstName: string, lastName: string, birthDate: string, club: string): string {
    return `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${birthDate}|${club.toLowerCase()}`;
  }

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      const header = lines[0].toLowerCase();
      const hasHeader =
        header.includes('vorname') ||
        header.includes('nachname') ||
        header.includes('firstname');

      const dataLines = hasHeader ? lines.slice(1) : lines;

      const existingKeys = new Map<string, Participant>();
      for (const p of participants.data) {
        existingKeys.set(participantKey(p.firstName, p.lastName, p.birthDate, p.club), p);
      }

      const newEntries: ParsedEntry[] = [];
      const duplicates: DuplicateEntry[] = [];

      for (const line of dataLines) {
        const cols = line.split(';').map((c) => c.trim());
        if (cols.length < 4) continue;

        const parsed: ParsedEntry = {
          firstName: cols[0] || '',
          lastName: cols[1] || '',
          club: cols[2] || '',
          birthDate: parseDateDE(cols[3] || ''),
          weight: parseFloat(cols[4]) || 0,
          beltGrade: (cols[5] as BeltGrade) || '10. Kyu',
          gender: (cols[6] === 'W' ? 'W' : 'M') as 'M' | 'W',
          discipline: cols[7]?.includes('kata')
            ? cols[7].includes('kumite')
              ? ['kumite', 'kata']
              : ['kata']
            : ['kumite'],
          categoryIds: [],
        };

        const key = participantKey(parsed.firstName, parsed.lastName, parsed.birthDate, parsed.club);
        const existing = existingKeys.get(key);

        if (existing) {
          duplicates.push({ parsed, existing, action: 'skip' });
        } else {
          newEntries.push(parsed);
          existingKeys.set(key, { ...parsed, id: '__pending__' });
        }
      }

      if (duplicates.length > 0) {
        setImportNew(newEntries);
        setImportDuplicates(duplicates);
        setShowImportModal(true);
      } else {
        executeImport(newEntries, []);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeImport = async (newEntries: ParsedEntry[], duplicates: DuplicateEntry[]) => {
    for (const entry of newEntries) {
      await participants.add(entry);
    }
    for (const dup of duplicates) {
      if (dup.action === 'overwrite') {
        await participants.update(dup.existing.id, {
          firstName: dup.parsed.firstName,
          lastName: dup.parsed.lastName,
          club: dup.parsed.club,
          birthDate: dup.parsed.birthDate,
          weight: dup.parsed.weight,
          beltGrade: dup.parsed.beltGrade,
          gender: dup.parsed.gender,
          discipline: dup.parsed.discipline,
        });
      } else if (dup.action === 'add') {
        await participants.add(dup.parsed);
      }
    }
    setShowImportModal(false);
    setImportNew([]);
    setImportDuplicates([]);
  };

  const isInBracket = (participantId: string) =>
    matches.some((m) => m.fighter1Id === participantId || m.fighter2Id === participantId);

  const handleDelete = (p: Participant) => {
    if (isInBracket(p.id)) {
      setWithdrawTarget(p);
    } else {
      if (confirm(`${p.firstName} ${p.lastName} wirklich löschen?`))
        participants.remove(p.id);
    }
  };

  const handleWithdraw = async (status: ParticipantStatus) => {
    if (!withdrawTarget || !onWithdraw) return;
    await onWithdraw(withdrawTarget.id, status);
    setWithdrawTarget(null);
  };

  const toggleDiscipline = (d: Discipline) => {
    const current = form.discipline;
    if (current.includes(d)) {
      if (current.length > 1) {
        setForm({ ...form, discipline: current.filter((x) => x !== d) });
      }
    } else {
      setForm({ ...form, discipline: [...current, d] });
    }
  };

  const uniqueClubs = useMemo(
    () => [...new Set(participants.data.map((p) => p.club))].filter(Boolean).sort(),
    [participants.data],
  );

  const uniqueCategories = useMemo(() => {
    const names = new Set<string>();
    for (const catNames of categoryMap.values()) {
      for (const n of catNames) names.add(n);
    }
    return [...names].sort();
  }, [categoryMap]);

  const filtered = participants.data.filter((p) => {
    const matchesSearch =
      !search ||
      `${p.firstName} ${p.lastName} ${p.club}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesBelt = !filterBelt || p.beltGrade === filterBelt;
    const matchesGender = !filterGender || p.gender === filterGender;
    const matchesClub = !filterClub || p.club === filterClub;
    const matchesDiscipline = !filterDiscipline || p.discipline.includes(filterDiscipline as Discipline);
    const matchesCat = !filterCategory || (categoryMap.get(p.id) ?? []).includes(filterCategory);
    const pStatus = p.status ?? 'active';
    const matchesStatus = !filterStatus || pStatus === filterStatus;
    return matchesSearch && matchesBelt && matchesGender && matchesClub && matchesDiscipline && matchesCat && matchesStatus;
  });

  const getAge = (birthDate: string) => {
    if (!birthDate) return '-';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form */}
      <div className="lg:col-span-1">
        <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {editId ? 'Teilnehmer bearbeiten' : 'Neuer Teilnehmer'}
            </h3>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="text-kyokushin-red hover:text-kyokushin-gold transition-colors"
              >
                <Plus size={20} />
              </button>
            )}
          </div>

          {(showForm || editId) && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kyokushin-text-muted mb-1">
                    Vorname
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                  />
                </div>
                <div>
                  <label className="block text-xs text-kyokushin-text-muted mb-1">
                    Nachname
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-kyokushin-text-muted mb-1">
                  Verein / Dojo
                </label>
                <input
                  type="text"
                  value={form.club}
                  onChange={(e) => setForm({ ...form, club: e.target.value })}
                  className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kyokushin-text-muted mb-1">
                    Geburtsdatum
                  </label>
                  <DateInput
                    value={form.birthDate}
                    onChange={(v) => setForm({ ...form, birthDate: v })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-kyokushin-text-muted mb-1">
                    Gewicht (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.weight || ''}
                    onChange={(e) =>
                      setForm({ ...form, weight: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-kyokushin-text-muted mb-1">
                  Gürtelgrad
                </label>
                <select
                  value={form.beltGrade}
                  onChange={(e) =>
                    setForm({ ...form, beltGrade: e.target.value as BeltGrade })
                  }
                  className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                >
                  {BELT_GRADES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-kyokushin-text-muted mb-1">
                  Geschlecht
                </label>
                <div className="flex gap-4">
                  {(['M', 'W'] as const).map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={form.gender === g}
                        onChange={() => setForm({ ...form, gender: g })}
                        className="accent-kyokushin-red"
                      />
                      <span className="text-sm text-white">
                        {g === 'M' ? 'Männlich' : 'Weiblich'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {tournamentType === 'mixed' ? (
                <div>
                  <label className="block text-xs text-kyokushin-text-muted mb-1">
                    Disziplin
                  </label>
                  <div className="flex gap-4">
                    {(['kumite', 'kata'] as Discipline[]).map((d) => (
                      <label key={d} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.discipline.includes(d)}
                          onChange={() => toggleDiscipline(d)}
                          className="accent-kyokushin-red"
                        />
                        <span className="text-sm text-white capitalize">{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-kyokushin-text-muted mb-1">
                    Disziplin
                  </label>
                  <div className="bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-kyokushin-text-muted text-sm capitalize">
                    {tournamentType}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-2.5 rounded-lg font-medium transition-colors"
                >
                  {editId ? 'Speichern' : 'Anmelden'}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditId(null);
                    setForm(emptyForm);
                  }}
                  className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-4 py-2.5 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {!showForm && !editId && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-2.5 rounded-lg font-medium transition-colors"
            >
              Teilnehmer hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {filtered.length === participants.data.length
              ? `${participants.data.length} Teilnehmer registriert`
              : `${filtered.length} von ${participants.data.length} Teilnehmern`}
          </h3>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} accept=".csv" onChange={handleCsvImport} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-kyokushin-card border border-kyokushin-border hover:border-kyokushin-red text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Upload size={14} />
              CSV Import
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kyokushin-text-muted" />
            <input
              type="text"
              placeholder="Suche..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-kyokushin-card border border-kyokushin-border rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
            />
          </div>
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className="bg-kyokushin-card border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
          >
            <option value="">Alle</option>
            <option value="M">Männlich</option>
            <option value="W">Weiblich</option>
          </select>
          <select
            value={filterBelt}
            onChange={(e) => setFilterBelt(e.target.value)}
            className="bg-kyokushin-card border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
          >
            <option value="">Alle Gürtel</option>
            {BELT_GRADES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {uniqueClubs.length > 1 && (
            <select
              value={filterClub}
              onChange={(e) => setFilterClub(e.target.value)}
              className="bg-kyokushin-card border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
            >
              <option value="">Alle Dojos</option>
              {uniqueClubs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            className="bg-kyokushin-card border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
          >
            <option value="">Alle Disziplinen</option>
            <option value="kumite">Kumite</option>
            <option value="kata">Kata</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-kyokushin-card border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
          >
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="withdrawn">Zurückgezogen</option>
            <option value="injured">Verletzt</option>
          </select>
          {uniqueCategories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-kyokushin-card border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
            >
              <option value="">Alle Kategorien</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kyokushin-border text-kyokushin-text-muted">
                <th className="text-left px-4 py-3 font-medium">Nr</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Verein</th>
                <th className="text-left px-4 py-3 font-medium">Alter</th>
                <th className="text-left px-4 py-3 font-medium">Gewicht</th>
                <th className="text-left px-4 py-3 font-medium">Gürtel</th>
                <th className="text-left px-4 py-3 font-medium">Disziplin</th>
                <th className="text-left px-4 py-3 font-medium">Kategorie</th>
                <th className="text-right px-4 py-3 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-kyokushin-text-muted">
                    Keine Teilnehmer gefunden
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const pStatus = p.status ?? 'active';
                  const isInactive = pStatus !== 'active';
                  const rowClass = isInactive ? 'opacity-50' : '';
                  return (
                  <tr
                    key={p.id}
                    className={`border-b border-kyokushin-border/50 hover:bg-kyokushin-card-hover transition-colors ${rowClass}`}
                  >
                    <td className="px-4 py-3 text-kyokushin-text-muted">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      <span className={isInactive ? 'line-through' : ''}>
                        {p.lastName}, {p.firstName}
                      </span>
                      <span className="ml-2 text-xs text-kyokushin-text-muted">
                        {p.gender === 'M' ? '♂' : '♀'}
                      </span>
                      {pStatus === 'withdrawn' && (
                        <span className="ml-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          Zurückgezogen
                        </span>
                      )}
                      {pStatus === 'injured' && (
                        <span className="ml-2 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          Verletzt
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-kyokushin-text">{p.club}</td>
                    <td className="px-4 py-3 text-kyokushin-text">{getAge(p.birthDate)}</td>
                    <td className="px-4 py-3 text-kyokushin-text">
                      {p.weight > 0 ? `${p.weight} kg` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: BELT_COLORS[p.beltGrade] + '30',
                          color: BELT_COLORS[p.beltGrade] === '#1a1a1a' ? '#fff' : BELT_COLORS[p.beltGrade],
                          border: `1px solid ${BELT_COLORS[p.beltGrade]}`,
                        }}
                      >
                        {p.beltGrade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-kyokushin-text capitalize">
                      {p.discipline.join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      {(categoryMap.get(p.id) ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {categoryMap.get(p.id)!.map((name) => (
                            <span
                              key={name}
                              className="inline-block bg-kyokushin-red/15 text-kyokushin-red border border-kyokushin-red/30 text-xs px-1.5 py-0.5 rounded font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-kyokushin-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isInactive && (
                          <button
                            onClick={() => handleEdit(p)}
                            className="text-kyokushin-text-muted hover:text-kyokushin-gold transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(p)}
                          className="text-kyokushin-text-muted hover:text-kyokushin-red transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showImportModal && (
        <CsvImportModal
          newEntries={importNew}
          duplicates={importDuplicates}
          onConfirm={executeImport}
          onCancel={() => {
            setShowImportModal(false);
            setImportNew([]);
            setImportDuplicates([]);
          }}
        />
      )}

      {withdrawTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/15 rounded-lg">
                <AlertTriangle size={24} className="text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Teilnehmer im aktiven Turnierbaum
              </h3>
            </div>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-kyokushin-text">
                <span className="text-white font-medium">{withdrawTarget.firstName} {withdrawTarget.lastName}</span> hat offene Kämpfe im Turnierbaum.
                Der Teilnehmer kann nicht gelöscht werden, sondern nur zurückgezogen werden.
              </p>
              <p className="text-sm text-kyokushin-text-muted">
                Alle offenen Kämpfe werden als Walkover (kampfloser Sieg für den Gegner) gewertet.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setWithdrawTarget(null)}
                className="flex-1 bg-kyokushin-border hover:bg-kyokushin-card-hover text-white py-3 rounded-lg font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleWithdraw('withdrawn')}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold transition-colors"
              >
                Zurückziehen
              </button>
              <button
                onClick={() => handleWithdraw('injured')}
                className="flex-1 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-3 rounded-lg font-bold transition-colors"
              >
                Verletzt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
