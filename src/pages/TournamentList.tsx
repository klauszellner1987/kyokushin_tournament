import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Calendar, MapPin, Trash2, Play, CheckCircle, Swords, Grid3X3, Ticket } from 'lucide-react';
import { useTournaments } from '../hooks/useFirestore';
import { useTokens } from '../hooks/useTokens';
import type { Tournament, TournamentType } from '../types';
import { TOURNAMENT_TYPE_LABELS } from '../types';
import DateInput, { parseDateDE } from '../components/ui/DateInput';
import PricingCard from '../components/Payment/PricingCard';

const statusLabels: Record<Tournament['status'], string> = {
  draft: 'Entwurf',
  running: 'Laufend',
  completed: 'Abgeschlossen',
};

const statusColors: Record<Tournament['status'], string> = {
  draft: 'bg-kyokushin-text-muted',
  running: 'bg-kyokushin-red',
  completed: 'bg-green-600',
};

export default function TournamentList() {
  const { data: tournaments, loading, add, remove } = useTournaments();
  const { canCreateTournament, consumeToken, unusedTokenCount, canUseFree } = useTokens();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    type: 'mixed' as TournamentType,
    matCount: 2,
  });

  const handleNewTournament = () => {
    if (!canCreateTournament) {
      setShowPricing(true);
      return;
    }
    setShowForm(!showForm);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    const id = await add({
      name: formData.name,
      date: parseDateDE(formData.date),
      location: formData.location,
      type: formData.type,
      matCount: formData.matCount,
      status: 'draft',
      createdAt: Date.now(),
    } as Omit<Tournament, 'id'>);

    consumeToken(id);
    setFormData({ name: '', date: '', location: '', type: 'mixed', matCount: 2 });
    setShowForm(false);
    navigate(`/tournament/${id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-kyokushin-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Turniere</h1>
          <p className="text-kyokushin-text-muted mt-1">
            Verwalte deine Karate-Turniere
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPricing(true)}
            className="flex items-center gap-2 text-kyokushin-text-muted hover:text-kyokushin-gold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Ticket size={16} />
            {unusedTokenCount > 0
              ? `${unusedTokenCount} Token${unusedTokenCount !== 1 ? 's' : ''}`
              : canUseFree
                ? 'Gratis-Test verfügbar'
                : 'Tokens kaufen'}
          </button>
          <button
            onClick={handleNewTournament}
            className="flex items-center gap-2 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Neues Turnier
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Neues Turnier erstellen
            </h2>
            {canUseFree && (
              <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full">
                Gratis-Test
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Turniername"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-kyokushin-bg border border-kyokushin-border rounded-lg px-4 py-2.5 text-white placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
            />
            <DateInput
              value={formData.date}
              onChange={(v) => setFormData({ ...formData, date: v })}
            />
            <input
              type="text"
              placeholder="Ort / Halle"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="bg-kyokushin-bg border border-kyokushin-border rounded-lg px-4 py-2.5 text-white placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm text-kyokushin-text-muted mb-2">Turnier-Typ</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(TOURNAMENT_TYPE_LABELS) as [TournamentType, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: key })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                      formData.type === key
                        ? 'bg-kyokushin-red border-kyokushin-red text-white'
                        : 'bg-kyokushin-bg border-kyokushin-border text-kyokushin-text-muted hover:border-kyokushin-red hover:text-white'
                    }`}
                  >
                    <Swords size={16} />
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-kyokushin-text-muted mb-2">
              Anzahl Matten: <span className="text-white font-bold">{formData.matCount}</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="8"
                value={formData.matCount}
                onChange={(e) => setFormData({ ...formData, matCount: parseInt(e.target.value) })}
                className="flex-1 accent-kyokushin-red"
              />
              <div className="flex gap-1">
                {Array.from({ length: formData.matCount }, (_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded bg-kyokushin-red/20 border border-kyokushin-red/50 flex items-center justify-center text-xs text-kyokushin-red font-bold"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              className="bg-kyokushin-red hover:bg-kyokushin-red-dark text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Erstellen
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-kyokushin-border hover:bg-kyokushin-card-hover text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-kyokushin-text-muted text-6xl mb-4">🥋</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Noch keine Turniere
          </h2>
          <p className="text-kyokushin-text-muted">
            Erstelle dein erstes Turnier, um loszulegen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/tournament/${t.id}`)}
              className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 cursor-pointer hover:border-kyokushin-red transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-white group-hover:text-kyokushin-red transition-colors">
                  {t.name}
                </h3>
                <span
                  className={`${statusColors[t.status]} text-white text-xs px-2.5 py-1 rounded-full font-medium`}
                >
                  {statusLabels[t.status]}
                </span>
              </div>

              <div className="flex gap-2 mb-3">
                <span className="bg-kyokushin-red/15 text-kyokushin-red border border-kyokushin-red/30 text-xs px-2 py-0.5 rounded font-medium">
                  {TOURNAMENT_TYPE_LABELS[(t as Tournament).type] ?? 'Kumite'}
                </span>
                <span className="bg-kyokushin-gold/15 text-kyokushin-gold border border-kyokushin-gold/30 text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <Grid3X3 size={10} />
                  {(t as Tournament).matCount ?? 1} {((t as Tournament).matCount ?? 1) === 1 ? 'Matte' : 'Matten'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-kyokushin-text-muted">
                {t.date && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(t.date).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                )}
                {t.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    {t.location}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-kyokushin-border">
                <div className="flex gap-2">
                  {t.status === 'draft' && (
                    <span className="flex items-center gap-1 text-xs text-kyokushin-gold">
                      <Play size={12} /> Bereit zum Starten
                    </span>
                  )}
                  {t.status === 'completed' && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle size={12} /> Abgeschlossen
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Turnier wirklich löschen?')) remove(t.id);
                  }}
                  className="text-kyokushin-text-muted hover:text-kyokushin-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPricing && <PricingCard onClose={() => setShowPricing(false)} />}
    </div>
  );
}
