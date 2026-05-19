import { useCallback, useEffect } from 'react';
import { useCollection } from './useFirestore';
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

  const canCreateTournament = canUseFree || unusedTokens.length > 0;

  const addToken = useCallback(
    async (stripeSessionId?: string) => {
      await addTokenOnline({
        userId: uid,
        tournamentId: null,
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
        
        // Grant tokens
        const grantTokens = async () => {
          for (let i = 0; i < tokenCount; i++) {
            await addToken(sessionId);
          }
          
          // Clear query params from the browser address bar
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);

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
  };
}
