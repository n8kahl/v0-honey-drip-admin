import { useUIStore } from '../stores/uiStore';
import { useTradeStore } from '../stores/tradeStore';
import { Trade } from '../types';

/**
 * Hook for navigation-related actions within the app.
 *
 * Replaces prop drilling by allowing components to directly access navigation
 * functions from Zustand stores.
 *
 * Usage:
 *   const nav = useAppNavigation();
 *   nav.setActiveTab('active');
 *   nav.focusTrade(trade);
 */
export function useAppNavigation() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const focusedTrade = useUIStore((s) => s.focusedTrade);
  const focusTradeInLive = useUIStore((s) => s.focusTradeInLive);
  const navigateToActive = useUIStore((s) => s.navigateToActive);
  const navigateToHistory = useUIStore((s) => s.navigateToHistory);
  const navigateToLive = useUIStore((s) => s.navigateToLive);
  const activeTrades = useTradeStore((s) => s.activeTrades);

  return {
    // Current state
    activeTab,
    focusedTrade,
    activeTrades,

    // Tab navigation
    setActiveTab,
    navigateToLive,
    navigateToActive,
    navigateToHistory,

    // Trade focus
    focusTrade: (trade: Trade) => focusTradeInLive(trade),
    clearFocus: () => {
      // The focusTradeInLive hook already clears after 100ms,
      // but provide explicit method for clarity
      useUIStore.getState().setFocusedTrade(null);
    },

    // Trade event handlers (common patterns)
    handleOpenActiveTrade: (tradeId: string) => {
      const trade = activeTrades.find((t) => t.id === tradeId);
      if (trade) focusTradeInLive(trade);
    },

    handleTradeExit: () => {
      console.log('Trade exited');
      setTimeout(() => navigateToHistory(), 100);
    },
  };
}
