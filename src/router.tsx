import { createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Pages - lazy load for code splitting
const TradeDetailPage = lazy(() => import('./pages/TradeDetailPage'));
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
    <div className="text-[var(--text-muted)]">Loading...</div>
  </div>
);

/**
 * Router Configuration (Client-Side)
 *
 * This router handles client-side navigation for:
 * - /trades/active → Active Trades view
 * - /trades/history → Trade History view
 * - /trades/:id → Individual Trade Detail view
 * - /settings → Settings page
 *
 * Note: Top-level routes (/, /radar) are handled by Next.js App Router.
 * This router manages internal tab-based navigation and detail pages.
 *
 * The App component is the entry point and handles conditional rendering
 * based on the current route.
 */
export const routes = [
  {
    path: '/trades/:tradeId',
    element: (
      <Suspense fallback={<PageLoader />}>
        <TradeDetailPage />
      </Suspense>
    ),
  },
];

/**
 * Create router instance.
 * Note: This router is created but may not be used if Next.js routing takes precedence.
 * Alternative: Use URL state management library (useLocation) instead.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    children: routes,
  },
]);

export default router;
