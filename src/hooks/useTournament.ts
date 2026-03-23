import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { useCollection, localStore } from './useFirestore';
import type { Tournament, Participant, Category, FightGroup, Match } from '../types';

export function useTournamentData(tournamentId: string | undefined) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentLoading, setTournamentLoading] = useState(true);

  const subscribeFn = useCallback(
    (cb: () => void) => localStore.subscribe('tournaments', cb),
    [],
  );
  const snapshotFn = useCallback(
    () => localStore.getSnapshot('tournaments'),
    [],
  );
  const localTournaments = useSyncExternalStore(subscribeFn, snapshotFn);

  useEffect(() => {
    if (!tournamentId) {
      setTournament(null);
      setTournamentLoading(false);
      return;
    }

    if (!isFirebaseConfigured) {
      const found = localTournaments.find((t) => t.id === tournamentId);
      setTournament(found ? (found as unknown as Tournament) : null);
      setTournamentLoading(false);
      return;
    }

    const docRef = doc(db, 'tournaments', tournamentId);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setTournament({ id: snap.id, ...snap.data() } as Tournament);
      } else {
        setTournament(null);
      }
      setTournamentLoading(false);
    });

    return unsubscribe;
  }, [tournamentId, localTournaments]);

  const basePath = tournamentId ? `tournaments/${tournamentId}` : '';

  const participants = useCollection<Participant>(
    basePath ? `${basePath}/participants` : '',
  );
  const categories = useCollection<Category>(
    basePath ? `${basePath}/categories` : '',
  );
  const fightGroups = useCollection<FightGroup>(
    basePath ? `${basePath}/fightGroups` : '',
  );
  const matches = useCollection<Match>(
    basePath ? `${basePath}/matches` : '',
  );

  return {
    tournament,
    tournamentLoading,
    participants,
    categories,
    fightGroups,
    matches,
  };
}
