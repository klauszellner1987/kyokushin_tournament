import { useCallback, useSyncExternalStore } from 'react';
import { localStore } from './useFirestore';
import { useAuth } from '../contexts/AuthContext';

const TOKEN_PATH = '_tokens';
const FREE_TRIAL_PATH = '_freetrial';
const FREE_TRIAL_LIMIT = 1;

interface TournamentToken {
  id: string;
  userId: string;
  tournamentId: string | null;
  purchasedAt: number;
  stripeSessionId?: string;
}

export function useTokens() {
  const { user } = useAuth();
  const uid = user ? ('uid' in user ? user.uid : '') : '';

  if (import.meta.env.DEV) {
    return {
      canCreateTournament: true,
      unusedTokenCount: 999,
      usedCount: 0,
      freeTrialsUsed: 0,
      freeTrialLimit: 999,
      canUseFree: true,
      consumeToken: () => true,
      addToken: () => {},
    };
  }

  const subscribeFn = useCallback(
    (cb: () => void) => localStore.subscribe(TOKEN_PATH, cb),
    [],
  );
  const snapshotFn = useCallback(
    () => localStore.getSnapshot(TOKEN_PATH),
    [],
  );
  const allTokens = useSyncExternalStore(subscribeFn, snapshotFn) as unknown as TournamentToken[];

  const subscribeTrialFn = useCallback(
    (cb: () => void) => localStore.subscribe(FREE_TRIAL_PATH, cb),
    [],
  );
  const snapshotTrialFn = useCallback(
    () => localStore.getSnapshot(FREE_TRIAL_PATH),
    [],
  );
  const trialRecords = useSyncExternalStore(subscribeTrialFn, snapshotTrialFn);

  const myTokens = allTokens.filter((t) => t.userId === uid);
  const unusedTokens = myTokens.filter((t) => t.tournamentId === null);
  const usedCount = myTokens.filter((t) => t.tournamentId !== null).length;

  const myTrials = trialRecords.filter((t) => t.userId === uid);
  const freeTrialsUsed = myTrials.length;
  const canUseFree = freeTrialsUsed < FREE_TRIAL_LIMIT;

  const canCreateTournament = canUseFree || unusedTokens.length > 0;

  const consumeToken = useCallback(
    (tournamentId: string): boolean => {
      if (canUseFree) {
        localStore.add(FREE_TRIAL_PATH, {
          userId: uid,
          tournamentId,
          usedAt: Date.now(),
        });
        return true;
      }

      const token = unusedTokens[0];
      if (token) {
        localStore.update(TOKEN_PATH, token.id, { tournamentId });
        return true;
      }

      return false;
    },
    [uid, canUseFree, unusedTokens],
  );

  const addToken = useCallback(
    (stripeSessionId?: string) => {
      localStore.add(TOKEN_PATH, {
        userId: uid,
        tournamentId: null,
        purchasedAt: Date.now(),
        stripeSessionId: stripeSessionId ?? null,
      });
    },
    [uid],
  );

  return {
    canCreateTournament,
    unusedTokenCount: unusedTokens.length,
    usedCount,
    freeTrialsUsed,
    freeTrialLimit: FREE_TRIAL_LIMIT,
    canUseFree,
    consumeToken,
    addToken,
  };
}
