import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { lazy, Suspense } from "react";

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
    <div className="text-[var(--text-muted)]">Loading...</div>
  </div>
);

// Lazy load secondary pages
const TradeDetailPage = lazy(() => import("./pages/TradeDetailPage"));
const RadarPage = lazy(() => import("./pages/RadarPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);

/**
 * Router Configuration for Vite App
 *
 * This router handles all client-side navigation.
 * React Router is the single source of truth for routing.
 * The App component derives its active tab from the current location.
 *
 * Routes:
 * - / → Live view (default)
 * - /active → Active Trades view
 * - /history → Trade History view
 * - /settings → Settings page
 * - /monitoring → Monitoring view
 * - /profile → User profile page
 * - /radar → Composite Signal Radar (legacy)
 * - /plan → Plan tab (Mission Playbook)
 * - /trades/:id → Trade detail page
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/active",
    element: <App />,
  },
  {
    path: "/history",
    element: <App />,
  },
  {
    path: "/settings",
    element: <App />,
  },
  {
    path: "/monitoring",
    element: <App />,
  },
  {
    path: "/public",
    element: <App />,
  },
  {
    path: "/profile",
    element: (
      <Suspense fallback={<PageLoader />}>
        <ProfilePage />
      </Suspense>
    ),
  },
  {
    path: "/radar",
    element: (
      <Suspense fallback={<PageLoader />}>
        <RadarPage />
      </Suspense>
    ),
  },
  {
    path: "/plan",
    element: (
      <Suspense fallback={<PageLoader />}>
        <PlanPage />
      </Suspense>
    ),
  },
  {
    path: "/trades/:id",
    element: (
      <Suspense fallback={<PageLoader />}>
        <TradeDetailPage />
      </Suspense>
    ),
  },
]);

export default router;
