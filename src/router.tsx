import { createBrowserRouter } from 'react-router-dom';
import App from './App';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
    <div className="text-[var(--text-muted)]">Loading...</div>
  </div>
);

/**
 * Router Configuration for Vite App
 *
 * This router handles all client-side navigation:
 * - / → Live view (default)
 * - /active → Active Trades view
 * - /history → Trade History view
 * - /settings → Settings page
 *
 * The App component handles tab-based rendering based on the current route.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App initialTab="live" />,
  },
  {
    path: '/active',
    element: <App initialTab="active" />,
  },
  {
    path: '/history',
    element: <App initialTab="history" />,
  },
  {
    path: '/settings',
    element: <App initialTab="settings" />,
  },
]);

export default router;
