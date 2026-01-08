import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Trade } from "../types";

type ChartViewportMode = "AUTO" | "MANUAL";
type WatchlistViewMode = "clean" | "power";
type WatchlistSortMode = "score" | "change" | "alphabetical";
export type Tab = "active" | "history" | "radar" | "settings";

interface LogicalRange {
  from: number;
  to: number;
}

/**
 * UIStore manages UI-specific state (modals, dialogs, chart viewport).
 * Navigation is handled by React Router - this store does NOT manage routing.
 */
interface UIStore {
  // State
  mainCockpitSymbol: string | null; // When set, shows full cockpit for this symbol
  showDiscordDialog: boolean;
  showAddTickerDialog: boolean;
  showAddChallengeDialog: boolean;
  focusedTrade: Trade | null;
  flashTradeTab: boolean;

  // Navigation state (legacy - prefer React Router)
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  focusTradeInLive: (tradeId: string) => void;
  navigateToActive: () => void;
  navigateToHistory: () => void;
  navigateToLive: () => void;

  // Chart viewport management
  chartViewportMode: ChartViewportMode;
  savedRanges: Record<string, LogicalRange>; // key: "symbol:timeframe"

  // Chart navigation callbacks
  chartScrollToBar: ((barTimeKey: string) => void) | null;

  // Watchlist preferences
  watchlistViewMode: WatchlistViewMode;
  watchlistSortMode: WatchlistSortMode;
  expandedWatchlistRow: string | null; // symbol of expanded row (only one at a time)

  // Actions
  setMainCockpitSymbol: (symbol: string | null) => void;
  registerChartScrollCallback: (callback: (barTimeKey: string) => void) => void;
  unregisterChartScrollCallback: () => void;
  scrollChartToBar: (barTimeKey: string) => void;
  setShowDiscordDialog: (show: boolean) => void;
  setShowAddTickerDialog: (show: boolean) => void;
  setShowAddChallengeDialog: (show: boolean) => void;
  setFocusedTrade: (trade: Trade | null) => void;
  setFlashTradeTab: (flash: boolean) => void;

  // Compound actions
  openDiscordSettings: () => void;
  closeDiscordSettings: () => void;
  openAddTicker: () => void;
  closeAddTicker: () => void;
  openAddChallenge: () => void;
  closeAddChallenge: () => void;
  closeAllDialogs: () => void;

  // Chart viewport management
  setChartViewportMode: (mode: ChartViewportMode) => void;
  saveChartRange: (key: string, range: LogicalRange) => void;
  getChartRange: (key: string) => LogicalRange | undefined;
  clearChartRange: (key: string) => void;

  // Watchlist preferences
  setWatchlistViewMode: (mode: WatchlistViewMode) => void;
  setWatchlistSortMode: (mode: WatchlistSortMode) => void;
  setExpandedWatchlistRow: (symbol: string | null) => void;

  // Reset
  reset: () => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      mainCockpitSymbol: null,
      showDiscordDialog: false,
      showAddTickerDialog: false,
      showAddChallengeDialog: false,
      focusedTrade: null,
      flashTradeTab: false,
      chartViewportMode: "AUTO",
      savedRanges: {},
      chartScrollToBar: null,

      // Navigation state (legacy)
      activeTab: "active" as Tab,

      // Watchlist preferences
      watchlistViewMode: "clean",
      watchlistSortMode: "score",
      expandedWatchlistRow: null,

      // Simple setters
      setMainCockpitSymbol: (symbol) => set({ mainCockpitSymbol: symbol }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      focusTradeInLive: (_tradeId) => {
        // Legacy - navigation now handled by React Router
        set({ activeTab: "active" });
      },
      navigateToActive: () => set({ activeTab: "active" }),
      navigateToHistory: () => set({ activeTab: "history" }),
      navigateToLive: () => set({ activeTab: "active" }),
      registerChartScrollCallback: (callback) => set({ chartScrollToBar: callback }),
      unregisterChartScrollCallback: () => set({ chartScrollToBar: null }),
      scrollChartToBar: (barTimeKey) => {
        const { chartScrollToBar } = get();
        if (chartScrollToBar) {
          console.log("[v0] uiStore: Scrolling chart to bar:", barTimeKey);
          chartScrollToBar(barTimeKey);
        } else {
          console.warn("[v0] uiStore: No chart scroll callback registered");
        }
      },
      setShowDiscordDialog: (show) => set({ showDiscordDialog: show }),
      setShowAddTickerDialog: (show) => set({ showAddTickerDialog: show }),
      setShowAddChallengeDialog: (show) => set({ showAddChallengeDialog: show }),
      setFocusedTrade: (trade) => set({ focusedTrade: trade }),
      setFlashTradeTab: (flash) => set({ flashTradeTab: flash }),

      // Compound actions
      openDiscordSettings: () => set({ showDiscordDialog: true }),
      closeDiscordSettings: () => set({ showDiscordDialog: false }),

      openAddTicker: () => set({ showAddTickerDialog: true }),
      closeAddTicker: () => set({ showAddTickerDialog: false }),

      openAddChallenge: () => set({ showAddChallengeDialog: true }),
      closeAddChallenge: () => set({ showAddChallengeDialog: false }),

      closeAllDialogs: () =>
        set({
          showDiscordDialog: false,
          showAddTickerDialog: false,
          showAddChallengeDialog: false,
        }),

      // Chart viewport management
      setChartViewportMode: (mode) => set({ chartViewportMode: mode }),

      saveChartRange: (key, range) =>
        set((state) => ({
          savedRanges: { ...state.savedRanges, [key]: range },
        })),

      getChartRange: (key) => get().savedRanges[key],

      clearChartRange: (key) => {
        const { savedRanges } = get();
        const { [key]: _, ...rest } = savedRanges;
        set({ savedRanges: rest });
      },

      // Watchlist preferences
      setWatchlistViewMode: (mode) => set({ watchlistViewMode: mode }),
      setWatchlistSortMode: (mode) => set({ watchlistSortMode: mode }),
      setExpandedWatchlistRow: (symbol) => set({ expandedWatchlistRow: symbol }),

      // Reset
      reset: () =>
        set({
          mainCockpitSymbol: null,
          showDiscordDialog: false,
          showAddTickerDialog: false,
          showAddChallengeDialog: false,
          focusedTrade: null,
          flashTradeTab: false,
          chartViewportMode: "AUTO",
          savedRanges: {},
          watchlistViewMode: "clean",
          watchlistSortMode: "score",
          expandedWatchlistRow: null,
          activeTab: "active" as Tab,
        }),
    }),
    { name: "UIStore" }
  )
);
