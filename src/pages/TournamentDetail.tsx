import { useParams, Link } from 'react-router';
import { Users, FolderTree, Swords, Monitor, ArrowLeft, Grid3X3, Radio } from 'lucide-react';
import { useTournamentData } from '../hooks/useTournament';
import { TOURNAMENT_TYPE_LABELS } from '../types';
import type { ParticipantStatus } from '../types';
import ParticipantManager from '../components/Registration/ParticipantManager';
import CategoryManager from '../components/Categories/CategoryManager';
import BracketView from '../components/Bracket/BracketView';
import FightControl from '../components/FightControl/FightControl';
import { computeWalkoverUpdates } from '../utils/walkover';
import { useState, useCallback } from 'react';

type Tab = 'participants' | 'categories' | 'bracket' | 'control' | 'live';

const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'participants', label: 'Teilnehmer', icon: Users },
  { key: 'categories', label: 'Kategorien', icon: FolderTree },
  { key: 'bracket', label: 'Turnierbaum', icon: Swords },
  { key: 'control', label: 'Kampfleitung', icon: Radio },
  { key: 'live', label: 'Live', icon: Monitor },
];

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { tournament, tournamentLoading, updateTournament, participants, categories, fightGroups, matches } =
    useTournamentData(id);
  const [activeTab, setActiveTab] = useState<Tab>('participants');

  const confirmRegistration = useCallback(async () => {
    await updateTournament({ registrationConfirmed: true });
  }, [updateTournament]);

  const withdrawParticipant = useCallback(async (participantId: string, status: ParticipantStatus) => {
    await participants.update(participantId, { status });

    const walkoverUpdates = computeWalkoverUpdates(
      participantId,
      matches.data,
      fightGroups.data,
    );
    for (const u of walkoverUpdates) {
      await matches.update(u.matchId, u.updates);
    }
  }, [participants, matches, fightGroups.data]);

  if (tournamentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-kyokushin-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-white mb-2">
          Turnier nicht gefunden
        </h2>
        <Link to="/" className="text-kyokushin-red hover:underline">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const stats = [
    { label: 'Teilnehmer', value: participants.data.length, color: 'border-kyokushin-red' },
    { label: 'Kategorien', value: categories.data.length, color: 'border-kyokushin-gold' },
    { label: 'Kämpfe', value: matches.data.length, color: 'border-kyokushin-red' },
    {
      label: 'Abgeschlossen',
      value: matches.data.filter((m) => m.status === 'completed').length,
      color: 'border-green-500',
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="text-kyokushin-text-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-kyokushin-text-muted text-sm">
              {tournament.date &&
                new Date(tournament.date).toLocaleDateString('de-DE')}
              {tournament.location && ` · ${tournament.location}`}
            </p>
            <span className="bg-kyokushin-red/15 text-kyokushin-red border border-kyokushin-red/30 text-xs px-2 py-0.5 rounded font-medium">
              {TOURNAMENT_TYPE_LABELS[tournament.type] ?? 'Kumite'}
            </span>
            <span className="bg-kyokushin-gold/15 text-kyokushin-gold border border-kyokushin-gold/30 text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <Grid3X3 size={10} />
              {tournament.matCount ?? 1} Matten
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`bg-kyokushin-card border-l-4 ${s.color} rounded-lg p-4`}
          >
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-sm text-kyokushin-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-kyokushin-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-kyokushin-red text-white'
                : 'border-transparent text-kyokushin-text-muted hover:text-white'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'participants' && (
        <ParticipantManager
          tournamentId={id!}
          tournamentType={tournament.type}
          participants={participants}
          categories={categories.data}
          matches={matches.data}
          onWithdraw={withdrawParticipant}
        />
      )}
      {activeTab === 'categories' && (
        <CategoryManager
          tournamentId={id!}
          tournamentType={tournament.type}
          categories={categories}
          participants={participants.data}
          onUpdateParticipant={participants.update}
          onConfirmRegistration={confirmRegistration}
        />
      )}
      {activeTab === 'bracket' && (
        <BracketView
          tournamentId={id!}
          categories={categories.data}
          fightGroups={fightGroups}
          matches={matches}
          participants={participants.data}
          matCount={tournament.matCount}
          registrationConfirmed={tournament.registrationConfirmed ?? false}
        />
      )}
      {activeTab === 'control' && (
        <FightControl
          categories={categories.data}
          fightGroups={fightGroups}
          matches={matches}
          participants={participants.data}
          matCount={tournament.matCount ?? 1}
          onDisqualify={(participantId) => withdrawParticipant(participantId, 'disqualified')}
        />
      )}
      {activeTab === 'live' && (
        <div className="py-8">
          <div className="text-center mb-8">
            <Monitor size={48} className="mx-auto text-kyokushin-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Live-Ansichten</h3>
            <p className="text-kyokushin-text-muted">
              Öffne die Ansichten in separaten Fenstern für Beamer und Monitore.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Gesamt-Übersicht */}
            <a
              href={`/live/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 hover:border-kyokushin-red transition-all group block"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-kyokushin-red/20 flex items-center justify-center">
                  <Grid3X3 size={20} className="text-kyokushin-red" />
                </div>
                <div>
                  <h4 className="font-semibold text-white group-hover:text-kyokushin-red transition-colors">
                    Gesamtübersicht
                  </h4>
                  <p className="text-xs text-kyokushin-text-muted">
                    Alle Matten auf einen Blick
                  </p>
                </div>
              </div>
              <p className="text-sm text-kyokushin-text-muted">
                Ideal für Info-Bildschirm im Eingangsbereich
              </p>
            </a>

            {/* Pro Matte */}
            {Array.from({ length: tournament.matCount ?? 1 }, (_, i) => (
              <a
                key={i}
                href={`/live/${id}/mat/${i + 1}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6 hover:border-kyokushin-gold transition-all group block"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-kyokushin-gold/20 flex items-center justify-center">
                    <span className="text-kyokushin-gold font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white group-hover:text-kyokushin-gold transition-colors">
                      Matte {i + 1}
                    </h4>
                    <p className="text-xs text-kyokushin-text-muted">
                      Live-Ansicht für Bildschirm an Matte {i + 1}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
