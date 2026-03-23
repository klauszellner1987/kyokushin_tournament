import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Kanku from '../components/Layout/Kanku';
import idb from '../db';

export default function AuthPage() {
  const { signIn, signUp, isLocalMode } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Default to register tab if no accounts exist yet
  useEffect(() => {
    idb.documents
      .where({ _collection: '_auth' })
      .count()
      .then((count) => { if (count === 0) setIsLogin(false); })
      .catch(() => setIsLogin(false));
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) {
          setError('Bitte gib einen Namen ein');
          setLoading(false);
          return;
        }
        await signUp(email, password, displayName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kyokushin-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Kanku size={64} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Kyokushin Tournament Manager
          </h1>
          <p className="text-kyokushin-text-muted">
            {isLogin ? 'Melde dich an, um fortzufahren' : 'Erstelle ein neues Konto'}
          </p>
          {isLocalMode && (
            <p className="text-xs text-kyokushin-gold mt-2 bg-kyokushin-gold/10 border border-kyokushin-gold/20 rounded-lg px-3 py-1.5 inline-block">
              Offline-Modus -- Daten werden lokal gespeichert
            </p>
          )}
        </div>

        <div className="bg-kyokushin-card border border-kyokushin-border rounded-xl p-6">
          <div className="flex mb-6 bg-kyokushin-bg rounded-lg p-1">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                isLogin
                  ? 'bg-kyokushin-red text-white'
                  : 'text-kyokushin-text-muted hover:text-white'
              }`}
            >
              Anmelden
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                !isLogin
                  ? 'bg-kyokushin-red text-white'
                  : 'text-kyokushin-text-muted hover:text-white'
              }`}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs text-kyokushin-text-muted mb-1">Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dein Name oder Vereinsname"
                  className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-kyokushin-text-muted mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@verein.de"
                required
                className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
              />
            </div>
            <div>
              <label className="block text-xs text-kyokushin-text-muted mb-1">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                required
                minLength={6}
                className="w-full bg-kyokushin-bg border border-kyokushin-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-kyokushin-text-muted focus:outline-none focus:border-kyokushin-red"
              />
            </div>

            {error && (
              <p className="text-sm text-kyokushin-red bg-kyokushin-red/10 border border-kyokushin-red/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kyokushin-red hover:bg-kyokushin-red-dark disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Laden...' : isLogin ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
