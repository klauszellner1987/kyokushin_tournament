import { Link, useLocation } from 'react-router';
import { LayoutDashboard, LogOut, User, Download } from 'lucide-react';
import Kanku from './Kanku';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const isHome = location.pathname === '/';

  const displayName = user
    ? 'displayName' in user
      ? (user.displayName ?? (user as { email?: string }).email ?? '')
      : ''
    : '';

  return (
    <nav className="bg-kyokushin-nav border-b border-kyokushin-border px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <Kanku size={36} />
          <div>
            <h1 className="text-lg font-bold text-white leading-tight group-hover:text-kyokushin-red transition-colors">
              Kyokushin
            </h1>
            <p className="text-xs text-kyokushin-text-muted leading-tight">
              Tournament Manager
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all cursor-pointer mr-2 border border-amber-500/30"
              title="Als Desktop-App auf PC installieren"
            >
              <Download size={14} />
              <span>App Installieren</span>
            </button>
          )}

          <Link
            to="/"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isHome
                ? 'bg-kyokushin-red text-white'
                : 'text-kyokushin-text-muted hover:text-white hover:bg-kyokushin-card'
            }`}
          >
            <LayoutDashboard size={16} />
            Turniere
          </Link>

          {user && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-kyokushin-border">
              <span className="flex items-center gap-1.5 text-sm text-kyokushin-text-muted">
                <User size={14} />
                {displayName}
              </span>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-kyokushin-text-muted hover:text-white hover:bg-kyokushin-card transition-all"
                title="Abmelden"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
