/* eslint-disable react-refresh/only-export-components */
import { useParams, Link } from 'react-router';
import { Users, FolderTree, Swords, Monitor, ArrowLeft, Grid3X3, Radio, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTournamentData } from '../hooks/useTournament';
import { useTokens } from '../hooks/useTokens';
import { useAuth } from '../contexts/AuthContext';
import { TOURNAMENT_TYPE_LABELS } from '../types';
import type { ParticipantStatus, Category, Match } from '../types';
import ParticipantManager from '../components/Registration/ParticipantManager';
import CategoryManager from '../components/Categories/CategoryManager';
import BracketView from '../components/Bracket/BracketView';
import FightControl from '../components/FightControl/FightControl';
import { computeWalkoverUpdates } from '../utils/walkover';
import { countFinishedScheduledFights } from '../utils/matchProgress';
import { useState, useCallback, useMemo } from 'react';

type Tab = 'participants' | 'categories' | 'bracket' | 'control' | 'live';
type StepState = 'completed' | 'next' | 'upcoming';

const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'participants', label: 'Teilnehmer', icon: Users },
  { key: 'categories', label: 'Kategorien', icon: FolderTree },
  { key: 'bracket', label: 'Turnierbaum', icon: Swords },
  { key: 'control', label: 'Kampfleitung', icon: Radio },
  { key: 'live', label: 'Live', icon: Monitor },
];

const WORKFLOW_TABS: Tab[] = ['participants', 'categories', 'bracket', 'control'];

export function getStepStates(
  participantCount: number,
  categoriesData: Category[],
  registrationConfirmed: boolean,
  matchesData: Match[],
  registrationClosed: boolean,
): Record<Tab, { state: StepState; hint?: string }> {
  const hasEnoughParticipants = participantCount >= 2;
  const participantsComplete = hasEnoughParticipants && registrationClosed;

  const hasCategories = categoriesData.length > 0;
  const kumiteCategories = categoriesData.filter((c) => c.discipline === 'kumite');
  const allRoundsConfigured = kumiteCategories.length === 0 || kumiteCategories.every((c) => c.roundsConfigured);
  const categoriesComplete = hasCategories && allRoundsConfigured && registrationConfirmed;

  const realMatches = matchesData.filter((m) => m.status !== 'bye');
  const hasBrackets = realMatches.length > 0;
  const allDone = hasBrackets && realMatches.every((m) =>
    m.status === 'completed' || m.status === 'walkover' || m.status === 'disqualification',
  );

  const participantHint = !hasEnoughParticipants ? 'Mind. 2 Teilnehmer eintragen' : 'Anmeldung abschließen';

  const steps: [boolean, string][] = [
    [participantsComplete, participantHint],
    [categoriesComplete, !hasCategories ? 'Kategorien erstellen' : !allRoundsConfigured ? 'Rundenablauf konfigurieren' : 'Sichtkontrolle durchführen'],
    [hasBrackets, 'Turnierbäume generieren'],
    [allDone, 'Kämpfe austragen'],
  ];

  let nextFound = false;
  const result: Record<string, { state: StepState; hint?: string }> = {};

  for (let i = 0; i < WORKFLOW_TABS.length; i++) {
    if (steps[i][0]) {
      result[WORKFLOW_TABS[i]] = { state: 'completed' };
    } else if (!nextFound) {
      nextFound = true;
      result[WORKFLOW_TABS[i]] = { state: 'next', hint: steps[i][1] };
    } else {
      result[WORKFLOW_TABS[i]] = { state: 'upcoming' };
    }
  }

  result['live'] = { state: 'upcoming' };

  return result as Record<Tab, { state: StepState; hint?: string }>;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user ? ('uid' in user ? user.uid : '') : '';
  const { isTournamentUnlocked, unlockTournament, unusedTokenCount } = useTokens();
  const unlocked = isTournamentUnlocked(id ?? '');

  const { tournament, tournamentLoading, updateTournament, participants, categories, fightGroups, matches } =
    useTournamentData(id);
  const [activeTab, setActiveTab] = useState<Tab>('participants');

  const confirmRegistration = useCallback(async () => {
    await updateTournament({ registrationConfirmed: true });
  }, [updateTournament]);

  const closeRegistration = useCallback(async () => {
    await updateTournament({ registrationClosed: true });
  }, [updateTournament]);

  const reopenRegistration = useCallback(async () => {
    await updateTournament({ registrationClosed: false, registrationConfirmed: false });
  }, [updateTournament]);

  const withdrawParticipant = useCallback(async (participantId: string, status: ParticipantStatus) => {
    await participants.update(participantId, { status });

    const walkoverUpdates = computeWalkoverUpdates(
      participantId,
      matches.data,
    );
    for (const u of walkoverUpdates) {
      await matches.update(u.matchId, u.updates);
    }
  }, [participants, matches]);

  const stepStates = useMemo(
    () => getStepStates(
      participants.data.length,
      categories.data,
      tournament?.registrationConfirmed ?? false,
      matches.data,
      tournament?.registrationClosed ?? false,
    ),
    [participants.data, categories.data, tournament?.registrationConfirmed, matches.data, tournament?.registrationClosed],
  );

  let nextStep = null;
  for (const tab of WORKFLOW_TABS) {
    const s = stepStates[tab];
    if (s.state === 'next') {
      nextStep = { tab, hint: s.hint! };
      break;
    }
  }

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
      value: countFinishedScheduledFights(matches.data),
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

      {unlocked ? (
        <>
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

          <div className="flex gap-1 border-b border-kyokushin-border">
            {tabs.map(({ key, label, icon: Icon }) => {
              const step = stepStates[key];
              const isActive = activeTab === key;
              const isLocked = key !== 'participants' && key !== 'live' && stepStates.participants.state !== 'completed';

              return (
                <button
                  key={key}
                  onClick={() => { if (!isLocked) setActiveTab(key); }}
                  disabled={isLocked}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isLocked
                      ? 'border-transparent text-kyokushin-text-muted/40 cursor-not-allowed'
                      : isActive
                        ? 'border-kyokushin-red text-white'
                        : step.state === 'next'
                          ? 'border-transparent text-white/70 hover:text-white'
                          : 'border-transparent text-kyokushin-text-muted hover:text-white'
                  }`}
                >
                  <span className="relative">
                    <Icon size={16} />
                    {step.state === 'completed' && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-green-500" />
                    )}
                    {step.state === 'next' && !isActive && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-kyokushin-red" />
                    )}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>

          {nextStep && (
            <div
              role="status"
              onClick={() => setActiveTab(nextStep.tab)}
              className="flex items-center gap-2 w-full px-4 py-2 my-6 text-sm text-kyokushin-text-muted bg-kyokushin-card/50 border border-kyokushin-border/50 rounded-lg hover:bg-kyokushin-card hover:text-white transition-colors cursor-pointer"
            >
              <ArrowRight size={14} className="text-kyokushin-red shrink-0" />
              <span>
                Nächster Schritt: <span className="text-white font-medium">{nextStep.hint}</span>
              </span>
            </div>
          )}

          {!nextStep && matches.data.some((m) => m.status !== 'bye') && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full px-5 py-4 my-6 bg-green-500/5 border border-green-500/20 rounded-xl">
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle2 size={20} className="shrink-0" />
                <div>
                  <p className="font-bold text-sm">Turnier beendet!</p>
                  <p className="text-xs opacity-80">Alle Kämpfe wurden erfolgreich ausgetragen.</p>
                </div>
              </div>
              
              <button
                onClick={async () => {
                  if (!window.confirm('Achtung: Dies überschreibt Namen, Vereine und Geburtsdaten aller Teilnehmer unwiderruflich mit Platzhaltern aus Datenschutzgründen. Fortfahren?')) return;
                  await Promise.all(
                    participants.data.map((p, index) => {
                      if (p.isAnonymized) return Promise.resolve();
                      return participants.update(p.id, {
                        firstName: `Kämpfer`,
                        lastName: `${index + 1}`,
                        club: 'Anonymisiert',
                        birthDate: '2000-01-01',
                        isAnonymized: true,
                      });
                    })
                  );
                  alert('Alle Teilnehmer wurden erfolgreich anonymisiert.');
                }}
                disabled={participants.data.every(p => p.isAnonymized)}
                className="flex items-center gap-2 bg-kyokushin-card border border-kyokushin-border hover:border-kyokushin-red disabled:opacity-50 disabled:cursor-not-allowed text-kyokushin-text-muted hover:text-white px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
              >
                {participants.data.every(p => p.isAnonymized) ? 'Daten anonymisiert' : 'DSGVO: Teilnehmer anonymisieren'}
              </button>
            </div>
          )}

          <div className="mt-6">
            {activeTab === 'participants' && (
              <ParticipantManager
                tournamentId={id!}
                tournamentType={tournament.type}
                participants={participants}
                categories={categories.data}
                matches={matches.data}
                onWithdraw={withdrawParticipant}
                registrationConfirmed={tournament.registrationConfirmed ?? false}
                registrationClosed={tournament.registrationClosed ?? false}
                onCloseRegistration={closeRegistration}
                onReopenRegistration={reopenRegistration}
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
                registrationConfirmed={tournament.registrationConfirmed ?? false}
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
                    href={`${import.meta.env.BASE_URL}live/${id}`}
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
                      href={`${import.meta.env.BASE_URL}live/${id}/mat/${i + 1}`}
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
        </>
      ) : (
        <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-8 text-center max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 bg-kyokushin-red/10 border border-kyokushin-red/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Swords size={32} className="text-kyokushin-red" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Dieses Turnier befindet sich im Entwurf</h3>
          <p className="text-kyokushin-text-muted text-sm mb-6 max-w-md mx-auto">
            Um Teilnehmer hinzuzufügen, Kategorien zu verwalten, Runden einzurichten und den Turnierbaum zu generieren, muss dieses Turnier einmalig freigeschaltet werden.
          </p>

          {unusedTokenCount > 0 ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
              <p className="text-sm text-green-400 font-medium mb-3">
                Du besitzt bereits ungenutzte Freischaltungen! ({unusedTokenCount} {unusedTokenCount === 1 ? 'Lizenz' : 'Lizenzen'} verfügbar)
              </p>
              <button
                onClick={async () => {
                  const success = await unlockTournament(id ?? '');
                  if (success) {
                    window.location.reload();
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Turnier jetzt freischalten
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-kyokushin-text-muted mb-6">
                Wähle ein Ticket oder eine Lizenz aus, um sofort fortzufahren:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
                <div className="bg-kyokushin-bg border border-kyokushin-border rounded-xl p-6 text-left flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-white text-base">Einzelticket</h4>
                    <p className="text-xs text-kyokushin-text-muted mt-1 font-light">Schalte dieses einzelne Turnier dauerhaft frei.</p>
                    <div className="text-2xl font-bold text-white mt-4">24 € <span className="text-xs font-normal text-kyokushin-text-muted">/ Turnier</span></div>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.setItem('pending_unlock_tournament_id', id ?? '');
                      window.location.assign('https://buy.stripe.com/test_8x26oI3jigsL8Xq5FJcfK00' + (uid ? '?client_reference_id=' + uid : ''));
                    }}
                    className="w-full mt-6 bg-kyokushin-red hover:bg-kyokushin-red-dark text-white py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-center"
                  >
                    Ticket Kaufen
                  </button>
                </div>
                <div className="bg-kyokushin-bg border-2 border-kyokushin-gold rounded-xl p-6 text-left flex flex-col justify-between relative overflow-hidden">
                  <span className="absolute top-2 right-2 bg-kyokushin-gold text-black text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Bester Wert
                  </span>
                  <div>
                    <h4 className="font-bold text-kyokushin-gold text-base">Jahreslizenz</h4>
                    <p className="text-xs text-kyokushin-text-muted mt-1 font-light">Schalte 1 Jahr lang unbegrenzt viele Turniere frei.</p>
                    <div className="text-2xl font-bold text-white mt-4">99 € <span className="text-xs font-normal text-kyokushin-text-muted">/ Jahr</span></div>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.setItem('pending_unlock_tournament_id', id ?? '');
                      window.location.assign('https://buy.stripe.com/test_aFacN68DCgsL6Pi5FJcfK01' + (uid ? '?client_reference_id=' + uid : ''));
                    }}
                    className="w-full mt-6 bg-kyokushin-gold hover:bg-yellow-600 text-black py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-center"
                  >
                    Lizenz Kaufen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
