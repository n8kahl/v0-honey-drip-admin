'use client';

import { useRouter } from 'next/navigation';

/**
 * Hook for navigating between pages using Next.js router.
 *
 * Provides domain-specific navigation methods that wrap Next.js router.
 *
 * Usage:
 *   const nav = useNavigationRouter();
 *   nav.goToActiveTrades();
 *   nav.goToTradeDetail(trade.id);
 *   nav.goToRadar();
 */
export function useNavigationRouter() {
  const router = useRouter();

  return {
    // Dashboard / Home
    goHome: () => router.push('/'),
    goToWatchTab: () => router.push('/'),

    // Trades
    goToActiveTrades: () => router.push('/trades/active'),
    goToTradeHistory: () => router.push('/trades/history'),
    goToTradeDetail: (tradeId: string) => router.push(`/trades/${tradeId}`),

    // Radar
    goToRadar: () => router.push('/radar'),

    // Settings
    goToSettings: () => router.push('/settings'),

    // Navigation methods
    back: () => router.back(),
    forward: () => router.forward(),

    // Utilities
    replace: (path: string) => router.replace(path),
  };
}
