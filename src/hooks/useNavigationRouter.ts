import { useNavigate } from 'react-router-dom';

/**
 * Hook for navigating between pages using React Router.
 *
 * Provides domain-specific navigation methods that wrap React Router navigate.
 *
 * Usage:
 *   const nav = useNavigationRouter();
 *   nav.goToActiveTrades();
 *   nav.goToSettings();
 */
export function useNavigationRouter() {
  const navigate = useNavigate();

  return {
    // Dashboard / Home
    goHome: () => navigate('/'),
    goToWatchTab: () => navigate('/'),
    goToLive: () => navigate('/'),

    // Trades
    goToActiveTrades: () => navigate('/active'),
    goToTradeHistory: () => navigate('/history'),

    // Settings
    goToSettings: () => navigate('/settings'),

    // Navigation methods
    back: () => navigate(-1),
    forward: () => navigate(1),

    // Utilities
    replace: (path: string) => navigate(path, { replace: true }),
  };
}
