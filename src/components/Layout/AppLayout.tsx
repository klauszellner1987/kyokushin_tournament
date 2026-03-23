import { Outlet } from 'react-router';
import Navbar from './Navbar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-kyokushin-bg">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
