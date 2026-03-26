import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Wand2, ChevronDown, ChevronRight, AlertTriangle, Users, Eye } from 'lucide-react';
import type { Category, Participant, TournamentType, BeltGrade, KataSystem } from '../../types';
import { BELT_GRADES, getAge } from '../../types';
import { autoAssign } from '../../utils/groupAssignment';
import CategoryReview from './CategoryReview';
import ConfirmDialog from '../ui/ConfirmDialog';

interface Props {
  tournamentId: string;
  tournamentType: TournamentType;
  categories: {
    data: Category[];
    add: (item: Omit<Category, 'id'>) => Promise<string>;
    update: (id: string, updates: Partial<Category>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  participants: Participant[];
  onUpdateParticipant: (id: string, updates: Partial<Participant>) => Promise<void>;
  onConfirmRegistration: () => Promise<void>;
  registrationConfirmed?: boolean;
}

function getFormatLabel(discipline: string, kataSystem?: string): string {
  if (discipline === 'kata') {
    return (kataSystem ?? 'points') === 'flag' ? 'K.O. (Flaggensystem)' : 'Round Robin (Punktesystem)';
  }
  return 'Single Elimination (K.O.)';
}

const emptyCategory: Omit<Category, 'id'> = {
  name: '',
  ageMin: null,
  ageMax: null,
  weightMin: null,
  weightMax: null,
  beltMin: null,
  beltMax: null,
  gender: 'mixed',
  discipline: 'kumite',
  tournamentFormat: 'single_elimination',
  fightDuration1: undefined,
  fightDuration2: undefined,
  boardBreaking: false,
  enableWeightDecision: false,
  weightDecisionThreshold: 3,
  fightDuration3: undefined,
  roundsConfigured: false,
  kataSystem: 'points',
};

const TEMPLATES: { label: string; categories: Omit<Category, 'id'>[] }[] = [
  {
    label: 'Kyokushin Kinder (U10/U12/U14)',
    categories: [
      { ...emptyCategory, name: 'Kumite Kinder U10 M', ageMin: 0, ageMax: 9, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Kinder U10 W', ageMin: 0, ageMax: 9, gender: 'W', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Kinder U12 M', ageMin: 10, ageMax: 11, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Kinder U12 W', ageMin: 10, ageMax: 11, gender: 'W', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Jugend U14 M', ageMin: 12, ageMax: 13, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Jugend U14 W', ageMin: 12, ageMax: 13, gender: 'W', discipline: 'kumite' },
    ],
  },
  {
    label: 'Kyokushin Jugend (U16/U18)',
    categories: [
      { ...emptyCategory, name: 'Kumite Jugend U16 M', ageMin: 14, ageMax: 15, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Jugend U16 W', ageMin: 14, ageMax: 15, gender: 'W', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Jugend U18 M', ageMin: 16, ageMax: 17, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Jugend U18 W', ageMin: 16, ageMax: 17, gender: 'W', discipline: 'kumite' },
    ],
  },
  {
    label: 'Kyokushin Erwachsene (Gewichtsklassen)',
    categories: [
      { ...emptyCategory, name: 'Kumite Herren -70kg', ageMin: 18, ageMax: 39, weightMin: 0, weightMax: 70, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Herren -80kg', ageMin: 18, ageMax: 39, weightMin: 70.1, weightMax: 80, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Herren +80kg', ageMin: 18, ageMax: 39, weightMin: 80.1, weightMax: 999, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Damen -60kg', ageMin: 18, ageMax: 39, weightMin: 0, weightMax: 60, gender: 'W', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Damen +60kg', ageMin: 18, ageMax: 39, weightMin: 60.1, weightMax: 999, gender: 'W', discipline: 'kumite' },
    ],
  },
  {
    label: 'Kyokushin Senioren 40+',
    categories: [
      { ...emptyCategory, name: 'Kumite Senioren Herren -80kg', ageMin: 40, ageMax: 99, weightMin: 0, weightMax: 80, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Senioren Herren +80kg', ageMin: 40, ageMax: 99, weightMin: 80.1, weightMax: 999, gender: 'M', discipline: 'kumite' },
      { ...emptyCategory, name: 'Kumite Senioren Damen', ageMin: 40, ageMax: 99, gender: 'W', discipline: 'kumite' },
    ],
  },
  {
    label: 'Kata (Alle Altersklassen)',
    categories: [
      { ...emptyCategory, name: 'Kata Kinder', ageMin: 0, ageMax: 13, gender: 'mixed', discipline: 'kata', tournamentFormat: 'round_robin', kataSystem: 'points' },
      { ...emptyCategory, name: 'Kata Jugend', ageMin: 14, ageMax: 17, gender: 'mixed', discipline: 'kata', tournamentFormat: 'round_robin', kataSystem: 'points' },
      { ...emptyCategory, name: 'Kata Erwachsene', ageMin: 18, ageMax: 39, gender: 'mixed', discipline: 'kata', tournamentFormat: 'round_robin', kataSystem: 'points' },
      { ...emptyCategory, name: 'Kata Senioren', ageMin: 40, ageMax: 99, gender: 'mixed', discipline: 'kata', tournamentFormat: 'round_robin', kataSystem: 'points' },
    ],
  },
];

export default function CategoryManager({ tournamentType, categories, participants, onUpdateParticipant, onConfirmRegistration, registrationConfirmed }: Props) {
  const defaultDiscipline = tournamentType === 'kata' ? 'kata' : 'kumite';
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyCategory, discipline: defaultDiscipline as 'kumite' | 'kata' });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [reviewMode, setReviewMode] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<{ id: string; name: string } | null>(null);

  const filteredTemplates = TEMPLATES.filter((t) => {
    if (tournamentType === 'mixed') return true;
    return t.categories.some((c) => c.discipline === tournamentType);
  }).map((t) => {
    if (tournamentType === 'mixed') return t;
    return { ...t, categories: t.categories.filter((c) => c.discipline === tournamentType) };
  });

  // Live auto-assignment: compute which participants belong to which category
  const { assignments, warnings } = useMemo(
    () => autoAssign(participants, categories.data, registrationConfirmed),
    [participants, categories.data, registrationConfirmed],
  );

  const assignmentMap = useMemo(() => {
    const map = new Map<string, Participant[]>();
    for (const a of assignments) {
      const matched = a.participantIds
        .map((pid) => participants.find((p) => p.id === pid))
        .filter((p): p is Participant => !!p);
      map.set(a.categoryId, matched);
    }
    return map;
  }, [assignments, participants]);

  const unassignedParticipants = useMemo(() => {
    const assignedIds = new Set(assignments.flatMap((a) => a.participantIds));
    return participants.filter((p) => !assignedIds.has(p.id));
  }, [assignments, participants]);

  const toggleExpand = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const data = { ...form };
    if (data.discipline === 'kumite') {
      data.tournamentFormat = 'single_elimination';
      data.roundsConfigured = !!(data.fightDuration1 && data.fightDuration2);
    } else {
      data.tournamentFormat = (data.kataSystem ?? 'points') === 'flag' ? 'single_elimination' : 'round_robin';
      data.roundsConfigured = true;
    }
    if (editId) {
      await categories.update(editId, data);
      setEditId(null);
    } else {
      await categories.add(data);
    }
    setForm(emptyCategory);
    setShowForm(false);
  };

  const handleEdit = (c: Category) => {
    setForm({
      name: c.name, ageMin: c.ageMin, ageMax: c.ageMax,
      weightMin: c.weightMin, weightMax: c.weightMax,
      beltMin: c.beltMin, beltMax: c.beltMax,
      gender: c.gender, discipline: c.discipline, tournamentFormat: c.tournamentFormat,
      fightDuration1: c.fightDuration1,
      fightDuration2: c.fightDuration2,
      boardBreaking: c.boardBreaking ?? false,
      enableWeightDecision: c.enableWeightDecision ?? false,
      weightDecisionThreshold: c.weightDecisionThreshold ?? 3,
      fightDuration3: c.fightDuration3,
      roundsConfigured: c.roundsConfigured ?? false,
      kataSystem: c.kataSystem ?? 'points',
    });
    setEditId(c.id);
    setShowForm(true);
  };

  // Auto-generate: gather all relevant templates, simulate assignment, only create categories with 2+ participants
  const handleAutoGenerate = async () => {
    const allTemplateCats = filteredTemplates.flatMap((t) => t.categories);

    // Give each a temp id for simulation
    const tempCats: Category[] = allTemplateCats.map((c, i) => ({ ...c, id: `__temp_${i}` }));
    const { assignments: simAssignments } = autoAssign(participants, tempCats);

    let added = 0;
    for (let i = 0; i < tempCats.length; i++) {
      const count = simAssignments[i].participantIds.length;
      if (count >= 1) {
        // Check if an identical category already exists
        const existing = categories.data.find((e) => e.name === tempCats[i].name);
        if (!existing) {
          await categories.add(allTemplateCats[i]);
          added++;
        }
      }
    }

    if (added === 0) {
      alert('Keine neuen Kategorien hinzugefügt. Entweder existieren sie bereits oder es gibt nicht genug Teilnehmer.');
    }
  };

  const handleReviewSave = async (updates: Map<string, string[]>) => {
    for (const [participantId, categoryIds] of updates) {
      await onUpdateParticipant(participantId, { categoryIds });
    }
    await onConfirmRegistration();
  };

  const renderCategoryForm = () => (
    <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 mb-6">
      <h4 className="font-semibold text-white mb-4">
        {editId ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-xs text-kyokushin-text-muted mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Kumite Herren -75kg"
            className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-kyokushin-text-muted mb-1">Alter min</label>
            <input type="number" value={form.ageMin ?? ''} onChange={(e) => setForm({ ...form, ageMin: e.target.value ? parseInt(e.target.value) : null })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red" />
          </div>
          <div>
            <label className="block text-xs text-kyokushin-text-muted mb-1">Alter max</label>
            <input type="number" value={form.ageMax ?? ''} onChange={(e) => setForm({ ...form, ageMax: e.target.value ? parseInt(e.target.value) : null })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-kyokushin-text-muted mb-1">Gewicht min (kg)</label>
            <input type="number" step="0.1" value={form.weightMin ?? ''} onChange={(e) => setForm({ ...form, weightMin: e.target.value ? parseFloat(e.target.value) : null })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red" />
          </div>
          <div>
            <label className="block text-xs text-kyokushin-text-muted mb-1">Gewicht max (kg)</label>
            <input type="number" step="0.1" value={form.weightMax ?? ''} onChange={(e) => setForm({ ...form, weightMax: e.target.value ? parseFloat(e.target.value) : null })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-kyokushin-text-muted mb-1">Gürtel min</label>
            <select value={form.beltMin ?? ''} onChange={(e) => setForm({ ...form, beltMin: (e.target.value || null) as BeltGrade | null })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red">
              <option value="">Egal</option>
              {BELT_GRADES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-kyokushin-text-muted mb-1">Gürtel max</label>
            <select value={form.beltMax ?? ''} onChange={(e) => setForm({ ...form, beltMax: (e.target.value || null) as BeltGrade | null })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red">
              <option value="">Egal</option>
              {BELT_GRADES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-kyokushin-text-muted mb-1">Geschlecht</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'M' | 'W' | 'mixed' })} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red">
            <option value="mixed">Gemischt</option>
            <option value="M">Männlich</option>
            <option value="W">Weiblich</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-kyokushin-text-muted mb-1">Disziplin</label>
          {tournamentType === 'mixed' ? (
            <select value={form.discipline} onChange={(e) => {
              const disc = e.target.value as 'kumite' | 'kata';
              const updates: Partial<Omit<Category, 'id'>> = { discipline: disc };
              if (disc === 'kata') {
                updates.kataSystem = form.kataSystem ?? 'points';
                updates.tournamentFormat = (form.kataSystem ?? 'points') === 'flag' ? 'single_elimination' : 'round_robin';
              }
              setForm({ ...form, ...updates });
            }} className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red">
              <option value="kumite">Kumite</option>
              <option value="kata">Kata</option>
            </select>
          ) : (
            <div className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-kyokushin-text-muted text-sm capitalize">{tournamentType}</div>
          )}
        </div>
      </div>

      <div className="border-t border-kyokushin-border mt-4 pt-4">
        <h5 className="text-sm font-medium text-kyokushin-text-muted mb-3">Regeln</h5>
        {form.discipline === 'kumite' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-kyokushin-text-muted mb-1">1. Runde — Kampfzeit (Sekunden)</label>
                <input
                  type="number"
                  min="30"
                  step="10"
                  value={form.fightDuration1 ?? ''}
                  placeholder="z.B. 120"
                  onChange={(e) => setForm({ ...form, fightDuration1: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                />
              </div>
              <div>
                <label className="block text-xs text-kyokushin-text-muted mb-1">2. Runde — Verlängerung (Sekunden)</label>
                <input
                  type="number"
                  min="30"
                  step="10"
                  value={form.fightDuration2 ?? ''}
                  placeholder="z.B. 120"
                  onChange={(e) => setForm({ ...form, fightDuration2: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.boardBreaking ?? false}
                    onChange={(e) => setForm({ ...form, boardBreaking: e.target.checked })}
                    className="accent-kyokushin-red"
                  />
                  <span className="text-sm text-white">Bruchtest</span>
                </label>
              </div>
            </div>

            <div className="border-t border-kyokushin-border/50 pt-4">
              <p className="text-xs text-kyokushin-text-muted mb-3">Bei Unentschieden nach Runde 2</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`rounded-lg border p-3 transition-colors ${form.enableWeightDecision ? 'border-blue-500/40 bg-blue-500/5' : 'border-kyokushin-border'}`}>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={form.enableWeightDecision ?? false}
                      onChange={(e) => setForm({ ...form, enableWeightDecision: e.target.checked })}
                      className="accent-kyokushin-red"
                    />
                    <span className="text-sm text-white font-medium">Gewichtsentscheid</span>
                  </label>
                  {form.enableWeightDecision && (
                    <div className="ml-6">
                      <label className="block text-xs text-kyokushin-text-muted mb-1">Kilogramm-Unterschied (Schwelle)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={form.weightDecisionThreshold ?? 3}
                        onChange={(e) => setForm({ ...form, weightDecisionThreshold: parseFloat(e.target.value) || 3 })}
                        className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                      />
                      <p className="text-[10px] text-kyokushin-text-muted mt-1">
                        Leichterer Kämpfer gewinnt, wenn Gewichtsdifferenz &ge; Schwelle
                      </p>
                    </div>
                  )}
                </div>

                <div className={`rounded-lg border p-3 transition-colors ${form.fightDuration3 ? 'border-amber-500/40 bg-amber-500/5' : 'border-kyokushin-border'}`}>
                  <span className="text-sm text-white font-medium block mb-2">3. Runde — Pflichtentscheid</span>
                  <div>
                    <label className="block text-xs text-kyokushin-text-muted mb-1">Kampfzeit (Sekunden)</label>
                    <input
                      type="number"
                      min="30"
                      step="10"
                      value={form.fightDuration3 ?? ''}
                      placeholder="z.B. 120"
                      onChange={(e) => setForm({ ...form, fightDuration3: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
                    />
                    <p className="text-[10px] text-kyokushin-text-muted mt-1">
                      Nach Ablauf: Pflichtentscheid — Kampfrichter müssen 1:0 vergeben
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-kyokushin-text-muted mb-1">Bewertungssystem</label>
              <select
                value={form.kataSystem ?? 'points'}
                onChange={(e) => {
                  const sys = e.target.value as KataSystem;
                  setForm({
                    ...form,
                    kataSystem: sys,
                    tournamentFormat: sys === 'flag' ? 'single_elimination' : 'round_robin',
                  });
                }}
                className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kyokushin-red"
              >
                <option value="points">Punktesystem</option>
                <option value="flag">Flaggensystem</option>
              </select>
            </div>
            {(form.kataSystem ?? 'points') === 'flag' && (
              <div className="flex items-end">
                <p className="text-xs text-kyokushin-text-muted pb-2">
                  Flaggensystem verwendet automatisch Single Elimination (K.O.-System)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={handleSubmit} className="bg-kyokushin-red hover:bg-kyokushin-red-dark text-white px-6 py-2 rounded-lg font-medium transition-colors">
          {editId ? 'Speichern' : 'Erstellen'}
        </button>
        <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyCategory); }} className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-4 py-2 rounded-lg transition-colors">
          Abbrechen
        </button>
      </div>
    </div>
  );

  if (reviewMode) {
    return (
      <CategoryReview
        categories={categories.data}
        participants={participants}
        onSave={handleReviewSave}
        onClose={() => setReviewMode(false)}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Kategorien</h3>
          <p className="text-sm text-kyokushin-text-muted">
            {categories.data.length} Kategorien · {participants.length} Teilnehmer
          </p>
        </div>
        <div className="flex gap-2">
          {categories.data.length > 0 && participants.length > 0 && (
            <button
              onClick={() => setReviewMode(true)}
              className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Eye size={16} />
              Sichtkontrolle
            </button>
          )}
          {participants.length > 0 && (
            <button
              onClick={handleAutoGenerate}
              className="flex items-center gap-2 bg-kyokushin-gold/15 border border-kyokushin-gold/40 hover:bg-kyokushin-gold/25 text-kyokushin-gold px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Wand2 size={16} />
              Auto-Kategorien
            </button>
          )}
          {participants.length > 0 && (
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditId(null);
                setForm(emptyCategory);
              }}
              className="flex items-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Neue Kategorie
            </button>
          )}
        </div>
      </div>

      {/* Form (only at top for new categories) */}
      {showForm && !editId && renderCategoryForm()}

      {/* Category cards with participant assignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.data.map((c) => {
          const assigned = assignmentMap.get(c.id) ?? [];
          const isExpanded = expandedCategories.has(c.id);
          const isEditing = editId === c.id && showForm;
          const isReadyForBracket = assigned.length >= 2 && (c.roundsConfigured || c.discipline === 'kata');
          const countColor = assigned.length === 0
            ? 'text-kyokushin-text-muted'
            : isReadyForBracket
              ? 'text-green-400'
              : 'text-red-400';

          return (
            <React.Fragment key={c.id}>
            <div
              className={`bg-kyokushin-card border rounded-xl overflow-hidden transition-colors ${
                isEditing
                  ? 'border-kyokushin-red'
                  : isReadyForBracket
                    ? 'border-green-500/30 hover:border-green-500/50'
                    : 'border-kyokushin-border hover:border-kyokushin-red/50'
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-white">{c.name}</h4>
                    <span className={`flex items-center gap-1 text-sm font-medium ${countColor}`}>
                      <Users size={14} />
                      {assigned.length}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(c)} className="text-kyokushin-text-muted hover:text-kyokushin-gold p-1 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteCategoryId({ id: c.id, name: c.name })} className="text-kyokushin-text-muted hover:text-kyokushin-red p-1 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted">
                    {getFormatLabel(c.discipline, c.kataSystem)}
                  </span>
                  <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted capitalize">
                    {c.discipline}
                  </span>
                  {c.gender !== 'mixed' && (
                    <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted">
                      {c.gender === 'M' ? 'Männlich' : 'Weiblich'}
                    </span>
                  )}
                  {(c.ageMin != null || c.ageMax != null) && (
                    <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted">
                      Alter: {c.ageMin ?? '?'} - {c.ageMax ?? '?'}
                    </span>
                  )}
                  {(c.weightMin != null || c.weightMax != null) && (
                    <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted">
                      {c.weightMin ?? '?'} - {c.weightMax ?? '?'} kg
                    </span>
                  )}
                  {c.discipline === 'kumite' && (c.fightDuration1 || c.fightDuration2) && (
                    <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted">
                      R1: {Math.floor((c.fightDuration1 ?? 0) / 60)}:{String((c.fightDuration1 ?? 0) % 60).padStart(2, '0')} / R2: {Math.floor((c.fightDuration2 ?? 0) / 60)}:{String((c.fightDuration2 ?? 0) % 60).padStart(2, '0')}
                    </span>
                  )}
                  {c.boardBreaking && (
                    <span className="bg-amber-500/15 px-2 py-1 rounded text-amber-400">
                      Bruchtest
                    </span>
                  )}
                  {c.enableWeightDecision && (
                    <span className="bg-blue-500/15 px-2 py-1 rounded text-blue-400">
                      Gewichtsentscheid ({c.weightDecisionThreshold ?? 3} kg)
                    </span>
                  )}
                  {c.fightDuration3 && (
                    <span className="bg-amber-500/15 px-2 py-1 rounded text-amber-400">
                      R3: Pflichtentscheid ({Math.floor(c.fightDuration3 / 60)}:{String(c.fightDuration3 % 60).padStart(2, '0')})
                    </span>
                  )}
                  {c.discipline === 'kumite' && !c.roundsConfigured && (
                    <span className="bg-orange-500/15 px-2 py-1 rounded text-orange-400 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Runden nicht konfiguriert
                    </span>
                  )}
                  {c.discipline === 'kata' && (
                    <span className="bg-kyokushin-bg px-2 py-1 rounded text-kyokushin-text-muted">
                      {(c.kataSystem ?? 'points') === 'flag' ? 'Flaggensystem' : 'Punktesystem'}
                    </span>
                  )}
                </div>

                {assigned.length > 0 && (
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="flex items-center gap-1 text-xs text-kyokushin-text-muted hover:text-white transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {assigned.length} Teilnehmer anzeigen
                  </button>
                )}

                {assigned.length === 0 && registrationConfirmed && (
                  <p className="text-xs text-kyokushin-text-muted mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Kein Kampf – keine Teilnehmer zugewiesen
                  </p>
                )}
                {assigned.length === 1 && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Nur 1 Teilnehmer - kein Kampf möglich
                  </p>
                )}
              </div>

              {isExpanded && assigned.length > 0 && (
                <div className="border-t border-kyokushin-border bg-kyokushin-bg/50 px-5 py-3">
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {assigned
                      .sort((a, b) => a.lastName.localeCompare(b.lastName))
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-white">
                            {p.lastName}, {p.firstName}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-kyokushin-text-muted">
                            <span>{p.club}</span>
                            <span>{getAge(p.birthDate)} J.</span>
                            <span>{p.weight > 0 ? `${p.weight} kg` : ''}</span>
                            <span>{p.gender === 'M' ? '♂' : '♀'}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
            {isEditing && (
              <div className="md:col-span-2">
                {renderCategoryForm()}
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Empty state */}
      {categories.data.length === 0 && (
        <div className="text-center py-12">
          {participants.length > 0 ? (
            <div>
              <Wand2 size={48} className="mx-auto text-kyokushin-gold mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {participants.length} Teilnehmer warten auf Kategorien
              </h3>
              <p className="text-kyokushin-text-muted mb-4">
                Klicke auf "Auto-Kategorien" um passende Kategorien automatisch zu erstellen.
              </p>
              <button
                onClick={handleAutoGenerate}
                className="inline-flex items-center gap-2 bg-kyokushin-gold/15 border border-kyokushin-gold/40 hover:bg-kyokushin-gold/25 text-kyokushin-gold px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Wand2 size={18} />
                Auto-Kategorien generieren
              </button>
            </div>
          ) : (
            <p className="text-kyokushin-text-muted">
              Noch keine Kategorien definiert. Füge zuerst Teilnehmer hinzu, dann nutze Auto-Kategorien.
            </p>
          )}
        </div>
      )}

      {/* Warnings: unassigned participants */}
      {categories.data.length > 0 && unassignedParticipants.length > 0 && (
        <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <h4 className="font-semibold text-amber-400">
              {unassignedParticipants.length} Teilnehmer ohne Kategorie
            </h4>
          </div>
          <p className="text-sm text-kyokushin-text-muted mb-3">
            Diese Teilnehmer passen in keine der definierten Kategorien. Prüfe die Kategorie-Kriterien oder erstelle passende Kategorien.
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {unassignedParticipants.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-white">{p.lastName}, {p.firstName}</span>
                <div className="flex items-center gap-3 text-xs text-kyokushin-text-muted">
                  <span>{p.club}</span>
                  <span>{getAge(p.birthDate)} J.</span>
                  <span>{p.weight > 0 ? `${p.weight} kg` : ''}</span>
                  <span>{p.gender === 'M' ? '♂' : '♀'}</span>
                  <span className="capitalize">{p.discipline.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning: categories with too few participants */}
      {warnings.filter((w) => w.type === 'too_few').length > 0 && (
        <div className="mt-4 bg-kyokushin-card border border-kyokushin-border rounded-xl p-4">
          <p className="text-sm text-kyokushin-text-muted flex items-center gap-2">
            <AlertTriangle size={14} className="text-kyokushin-text-muted" />
            {warnings.filter((w) => w.type === 'too_few' || w.type === 'single_participant').map((w) => w.message).join(' · ')}
          </p>
        </div>
      )}

      {deleteCategoryId && (
        <ConfirmDialog
          title="Kategorie löschen"
          message={`"${deleteCategoryId.name}" wirklich löschen?`}
          onConfirm={() => {
            categories.remove(deleteCategoryId.id);
            setDeleteCategoryId(null);
          }}
          onCancel={() => setDeleteCategoryId(null)}
        />
      )}
    </div>
  );
}
