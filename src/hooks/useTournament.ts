import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { useCollection, localStore } from './useFirestore';
import type { Tournament, Participant, Category, FightGroup, Match } from '../types';

export function useTournamentData(tournamentId: string | undefined) {
  const { user } = useAuth();
  const subscribeFn = useCallback(
    (cb: () => void) => localStore.subscribe('tournaments', cb),
    [],
  );
  const snapshotFn = useCallback(
    () => localStore.getSnapshot('tournaments'),
    [],
  );
  const localTournaments = useSyncExternalStore(subscribeFn, snapshotFn);

  const [tournament, setTournament] = useState<Tournament | null>(() => {
    if (!tournamentId) return null;
    if (!isFirebaseConfigured) {
      const found = localTournaments.find((t) => t.id === tournamentId && (!user || t.ownerId === user.uid));
      return found ? (found as unknown as Tournament) : null;
    }
    return null;
  });
  
  const [tournamentLoading, setTournamentLoading] = useState<boolean>(() => {
    return !!tournamentId && isFirebaseConfigured;
  });
  
  const [prevDeps, setPrevDeps] = useState({ tournamentId, localTournaments, user });

  if (
    tournamentId !== prevDeps.tournamentId ||
    localTournaments !== prevDeps.localTournaments ||
    user !== prevDeps.user
  ) {
    setPrevDeps({ tournamentId, localTournaments, user });
    if (!tournamentId) {
      setTournament(null);
      setTournamentLoading(false);
    } else if (!isFirebaseConfigured) {
      const found = localTournaments.find((t) => t.id === tournamentId && (!user || t.ownerId === user.uid));
      setTournament(found ? (found as unknown as Tournament) : null);
      setTournamentLoading(false);
    } else if (tournamentId !== prevDeps.tournamentId) {
      setTournament(null);
      setTournamentLoading(true);
    }
  }

  useEffect(() => {
    if (!tournamentId || !isFirebaseConfigured) {
      return;
    }

    const docRef = doc(db, 'tournaments', tournamentId);
    const unsubscribe = onSnapshot(docRef, 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (!user || data.ownerId === user.uid) {
            setTournament({ id: snap.id, ...data } as Tournament);
          } else {
            setTournament(null); // Not owner
          }
        } else {
          setTournament(null);
        }
        setTournamentLoading(false);
      },
      (err) => {
        console.error("Error fetching tournament (might be blocked by security rules):", err);
        setTournament(null);
        setTournamentLoading(false);
      }
    );

    return unsubscribe;
  }, [tournamentId, user]);

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

  const updateTournament = useCallback(
    async (updates: Partial<Omit<Tournament, 'id'>>) => {
      if (!tournamentId) return;
      if (isFirebaseConfigured) {
        const docRef = doc(db, 'tournaments', tournamentId);
        await updateDoc(docRef, updates);
      } else {
        localStore.update('tournaments', tournamentId, updates as Record<string, unknown>);
      }
    },
    [tournamentId],
  );

  return {
    tournament,
    tournamentLoading,
    updateTournament,
    participants,
    categories,
    fightGroups,
    matches,
  };
}
