import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import TournamentList from './pages/TournamentList';
import TournamentDetail from './pages/TournamentDetail';
import LiveView from './pages/LiveView';
import AuthPage from './pages/AuthPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-kyokushin-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-kyokushin-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      {/* Live views have their own fullscreen layout */}
      <Route path="/live/:id" element={<LiveView />} />
      <Route path="/live/:id/mat/:matNr" element={<LiveView />} />

      {/* Main app layout */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<TournamentList />} />
        <Route path="/tournament/:id" element={<TournamentDetail />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
