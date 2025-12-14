import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Trade } from "../types";

type VoiceState = "idle" | "listening" | "processing";
type ChartViewportMode = "AUTO" | "MANUAL";
type WatchlistViewMode = "clean" | "power";
type WatchlistSortMode = "score" | "change" | "alphabetical";

interface LogicalRange {
  from: number;
  to: number;
}

/**
 * UIStore manages UI-specific state (modals, dialogs, voice, chart viewport).
 * Navigation is handled by React Router - this store does NOT manage routing.
 */
interface UIStore {
  // State
  mainCockpitSymbol: string | null; // When set, shows full cockpit for this symbol
  showDiscordDialog: boolean;
  showAddTickerDialog: boolean;
  showAddChallengeDialog: boolean;
  voiceActive: boolean;
  voiceState: VoiceState;
  focusedTrade: Trade | null;
  flashTradeTab: boolean;

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
  setVoiceActive: (active: boolean) => void;
  setVoiceState: (state: VoiceState) => void;
  setFocusedTrade: (trade: Trade | null) => void;
  setFlashTradeTab: (flash: boolean) => void;

  // Compound actions
  toggleVoice: () => void;
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
      voiceActive: false,
      voiceState: "idle",
      focusedTrade: null,
      flashTradeTab: false,
      chartViewportMode: "AUTO",
      savedRanges: {},
      chartScrollToBar: null,

      // Watchlist preferences
      watchlistViewMode: "clean",
      watchlistSortMode: "score",
      expandedWatchlistRow: null,

      // Simple setters
      setMainCockpitSymbol: (symbol) => set({ mainCockpitSymbol: symbol }),
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
      setVoiceActive: (active) => set({ voiceActive: active }),
      setVoiceState: (state) => set({ voiceState: state }),
      setFocusedTrade: (trade) => set({ focusedTrade: trade }),
      setFlashTradeTab: (flash) => set({ flashTradeTab: flash }),

      // Compound actions
      toggleVoice: () => {
        const { voiceActive } = get();
        set({
          voiceActive: !voiceActive,
          voiceState: !voiceActive ? "listening" : "idle",
        });
      },

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
          voiceActive: false,
          voiceState: "idle",
          focusedTrade: null,
          flashTradeTab: false,
          chartViewportMode: "AUTO",
          savedRanges: {},
          watchlistViewMode: "clean",
          watchlistSortMode: "score",
          expandedWatchlistRow: null,
        }),
    }),
    { name: "UIStore" }
  )
);
