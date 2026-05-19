import { useCallback, useEffect } from 'react';
import { useCollection } from './useFirestore';
import { useAuth } from '../contexts/AuthContext';

const TOKEN_PATH = '_tokens';
const FREE_TRIAL_PATH = '_freetrial';
const FREE_TRIAL_LIMIT = 0; // Disabled free trials for general users

interface TournamentToken {
  id: string;
  userId: string;
  tournamentId: string | null;
  purchasedAt: number;
  stripeSessionId?: string;
}

interface FreeTrialRecord {
  id: string;
  userId: string;
  tournamentId: string;
  usedAt: number;
}

export function useTokens() {
  const { user } = useAuth();
  const uid = user ? ('uid' in user ? user.uid : '') : '';

  const { data: allTokens, add: addTokenOnline, update: updateTokenOnline, loading: loadingTokens } = useCollection<TournamentToken>(TOKEN_PATH);
  const { data: trialRecords, add: addTrialOnline } = useCollection<FreeTrialRecord>(FREE_TRIAL_PATH);

  const myTokens = allTokens.filter((t) => t.userId === uid);
  const unusedTokens = myTokens.filter((t) => t.tournamentId === null);
  const usedCount = myTokens.filter((t) => t.tournamentId !== null).length;

  const myTrials = trialRecords.filter((t) => t.userId === uid);
  const freeTrialsUsed = myTrials.length;
  const canUseFree = freeTrialsUsed < FREE_TRIAL_LIMIT;

  const canCreateTournament = true; // Always allow creating draft tournaments for free

  const addToken = useCallback(
    async (stripeSessionId?: string, assignedTournamentId?: string | null) => {
      await addTokenOnline({
        userId: uid,
        tournamentId: assignedTournamentId ?? null,
        purchasedAt: Date.now(),
        stripeSessionId: stripeSessionId ?? undefined,
      });
    },
    [uid, addTokenOnline],
  );

  // Stripe Redirect Claimer
  useEffect(() => {
    if (!uid || loadingTokens) return;

    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    const plan = params.get('plan');

    if (payment === 'success' && sessionId) {
      const processedKey = `claimed_session_${sessionId}`;
      const localClaimed = localStorage.getItem(processedKey);
      const dbClaimed = allTokens.some(t => t.stripeSessionId === sessionId);

      if (!localClaimed && !dbClaimed) {
        // Mark as claimed locally instantly
        localStorage.setItem(processedKey, 'true');

        const tokenCount = plan === 'annual' ? 100 : 1;
        const pendingUnlockTournamentId = localStorage.getItem('pending_unlock_tournament_id');
        
        // Grant tokens
        const grantTokens = async () => {
          // For single purchase, directly tie the token to the pending tournament if there is one
          if (tokenCount === 1 && pendingUnlockTournamentId) {
            await addToken(sessionId, pendingUnlockTournamentId);
            localStorage.removeItem('pending_unlock_tournament_id');
          } else {
            // For annual or general, add tokens and if we have a pending tournament, tie the first one
            for (let i = 0; i < tokenCount; i++) {
              const assignId = (i === 0 && pendingUnlockTournamentId) ? pendingUnlockTournamentId : null;
              await addToken(sessionId, assignId);
            }
            if (pendingUnlockTournamentId) {
              localStorage.removeItem('pending_unlock_tournament_id');
            }
          }
          
          // Redirect the user back to the pending tournament if there was one, otherwise clear query
          const targetUrl = pendingUnlockTournamentId
            ? `${window.location.origin}/tournament/${pendingUnlockTournamentId}`
            : `${window.location.origin}${window.location.pathname}`;

          window.history.replaceState({}, document.title, targetUrl);
          // If we redirected back to a tournament details page, trigger a reload to update UI state
          if (pendingUnlockTournamentId) {
            window.location.assign(targetUrl);
          }

          alert(
            tokenCount > 1
              ? `Vielen Dank für deinen Kauf! Deine Jahreslizenz wurde erfolgreich aktiviert (100 Turnier-Freischaltungen gutgeschrieben).`
              : `Vielen Dank für deinen Kauf! Dein Turnier-Ticket wurde erfolgreich freigeschaltet.`
          );
        };

        grantTokens();
      } else {
        // Clean URL if already processed
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [uid, loadingTokens, allTokens, addToken]);

  const consumeToken = useCallback(
    async (tournamentId: string): Promise<boolean> => {
      if (canUseFree) {
        await addTrialOnline({
          userId: uid,
          tournamentId,
          usedAt: Date.now(),
        });
        return true;
      }

      const token = unusedTokens[0];
      if (token) {
        await updateTokenOnline(token.id, { tournamentId });
        return true;
      }

      return false;
    },
    [uid, canUseFree, unusedTokens, addTrialOnline, updateTokenOnline],
  );

  const isTournamentUnlocked = useCallback(
    (tournamentId: string): boolean => {
      const isAdmin = user && 'email' in user && user.email === import.meta.env.VITE_ADMIN_EMAIL;
      if (isAdmin) return true;
      return allTokens.some((t) => t.tournamentId === tournamentId);
    },
    [allTokens, user],
  );

  const unlockTournament = useCallback(
    async (tournamentId: string): Promise<boolean> => {
      const token = unusedTokens[0];
      if (token) {
        await updateTokenOnline(token.id, { tournamentId });
        return true;
      }
      return false;
    },
    [unusedTokens, updateTokenOnline],
  );

  const isAdmin = user && 'email' in user && user.email === import.meta.env.VITE_ADMIN_EMAIL;

  if (isAdmin) {
    return {
      canCreateTournament: true,
      unusedTokenCount: 999,
      usedCount: 0,
      freeTrialsUsed: 0,
      freeTrialLimit: 999,
      canUseFree: true,
      consumeToken: () => true,
      addToken: () => {},
      isTournamentUnlocked: () => true,
      unlockTournament: async () => true,
    };
  }

  return {
    canCreateTournament,
    unusedTokenCount: unusedTokens.length,
    usedCount,
    freeTrialsUsed,
    freeTrialLimit: FREE_TRIAL_LIMIT,
    canUseFree,
    consumeToken,
    addToken,
    isTournamentUnlocked,
    unlockTournament,
  };
}
