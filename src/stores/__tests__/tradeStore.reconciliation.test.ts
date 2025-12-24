/**
 * Trade Store Reconciliation Tests
 *
 * Tests for applyTradePatch and list reconciliation logic.
 * Verifies trades always end up in the correct list based on state.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useTradeStore } from "../tradeStore";
import type { Trade, TradeState, Contract, OptionType, TradeType } from "../../types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal mock trade for testing
 */
function createMockTrade(
  id: string,
  state: TradeState,
  ticker: string = "SPY",
  overrides: Partial<Trade> = {}
): Trade {
  const contract: Contract = {
    id: `O:${ticker}250117C00500000`,
    strike: 500,
    expiry: "2025-01-17",
    expiryDate: new Date("2025-01-17"),
    daysToExpiry: 30,
    type: "C" as OptionType,
    mid: 5.0,
    bid: 4.9,
    ask: 5.1,
    volume: 1000,
    openInterest: 5000,
  };

  return {
    id,
    ticker,
    state,
    tradeType: "Day" as TradeType,
    contract,
    updates: [],
    discordChannels: [],
    challenges: [],
    ...overrides,
  };
}

/**
 * Reset the store to a known state before each test
 */
function resetStore() {
  useTradeStore.getState().reset();
}

/**
 * Initialize store with specific trades in each list
 */
function initializeStore(options: {
  activeTrades?: Trade[];
  historyTrades?: Trade[];
  previewTrade?: Trade | null;
}) {
  const store = useTradeStore.getState();
  if (options.activeTrades) {
    store.setActiveTrades(options.activeTrades);
  }
  if (options.historyTrades) {
    store.setHistoryTrades(options.historyTrades);
  }
  if (options.previewTrade !== undefined) {
    store.setPreviewTrade(options.previewTrade);
  }
}

// ============================================================================
// applyTradePatch Tests
// ============================================================================

describe("applyTradePatch", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("Finding trades", () => {
    it("returns null if trade not found", () => {
      const result = useTradeStore.getState().applyTradePatch("nonexistent-id", {
        stopLoss: 3.0,
      });
      expect(result).toBeNull();
    });

    it("finds trade in activeTrades", () => {
      const trade = createMockTrade("active-1", "LOADED");
      initializeStore({ activeTrades: [trade] });

      const result = useTradeStore.getState().applyTradePatch("active-1", {
        stopLoss: 3.0,
      });

      expect(result).not.toBeNull();
      expect(result?.stopLoss).toBe(3.0);
    });

    it("finds trade in historyTrades", () => {
      const trade = createMockTrade("history-1", "EXITED");
      initializeStore({ historyTrades: [trade] });

      const result = useTradeStore.getState().applyTradePatch("history-1", {
        movePercent: 25,
      });

      expect(result).not.toBeNull();
      expect(result?.movePercent).toBe(25);
    });

    it("finds trade in previewTrade", () => {
      const trade = createMockTrade("preview-1", "WATCHING");
      initializeStore({ previewTrade: trade });

      const result = useTradeStore.getState().applyTradePatch("preview-1", {
        targetPrice: 10.0,
      });

      expect(result).not.toBeNull();
      expect(result?.targetPrice).toBe(10.0);
    });
  });

  describe("State transitions with list movement", () => {
    it("moves trade from preview to active on WATCHING → LOADED", () => {
      const trade = createMockTrade("trade-1", "WATCHING");
      initializeStore({ previewTrade: trade });

      const store = useTradeStore.getState();
      const result = store.applyTradePatch("trade-1", {
        state: "LOADED",
        targetPrice: 7.5,
        stopLoss: 2.5,
      });

      // Verify trade was updated
      expect(result?.state).toBe("LOADED");
      expect(result?.targetPrice).toBe(7.5);

      // Verify lists are correct
      const newState = useTradeStore.getState();
      expect(newState.previewTrade).toBeNull();
      expect(newState.activeTrades).toHaveLength(1);
      expect(newState.activeTrades[0].id).toBe("trade-1");
      expect(newState.activeTrades[0].state).toBe("LOADED");
    });

    it("moves trade from preview to active on WATCHING → ENTERED", () => {
      const trade = createMockTrade("trade-1", "WATCHING");
      initializeStore({ previewTrade: trade });

      useTradeStore.getState().applyTradePatch("trade-1", {
        state: "ENTERED",
        entryPrice: 5.0,
        entryTime: new Date(),
      });

      const newState = useTradeStore.getState();
      expect(newState.previewTrade).toBeNull();
      expect(newState.activeTrades).toHaveLength(1);
      expect(newState.activeTrades[0].state).toBe("ENTERED");
    });

    it("keeps trade in active on LOADED → ENTERED", () => {
      const trade = createMockTrade("trade-1", "LOADED");
      initializeStore({ activeTrades: [trade] });

      useTradeStore.getState().applyTradePatch("trade-1", {
        state: "ENTERED",
        entryPrice: 5.0,
      });

      const newState = useTradeStore.getState();
      expect(newState.activeTrades).toHaveLength(1);
      expect(newState.activeTrades[0].state).toBe("ENTERED");
      expect(newState.historyTrades).toHaveLength(0);
    });

    it("moves trade from active to history on ENTERED → EXITED", () => {
      const trade = createMockTrade("trade-1", "ENTERED", "SPY", {
        entryPrice: 5.0,
      });
      initializeStore({ activeTrades: [trade] });

      useTradeStore.getState().applyTradePatch("trade-1", {
        state: "EXITED",
        exitPrice: 8.0,
        exitTime: new Date(),
        movePercent: 60,
      });

      const newState = useTradeStore.getState();
      expect(newState.activeTrades).toHaveLength(0);
      expect(newState.historyTrades).toHaveLength(1);
      expect(newState.historyTrades[0].id).toBe("trade-1");
      expect(newState.historyTrades[0].state).toBe("EXITED");
      expect(newState.historyTrades[0].exitPrice).toBe(8.0);
      expect(newState.historyTrades[0].movePercent).toBe(60);
    });

    it("keeps trade in active on ENTERED → ENTERED (update)", () => {
      const trade = createMockTrade("trade-1", "ENTERED");
      initializeStore({ activeTrades: [trade] });

      useTradeStore.getState().applyTradePatch("trade-1", {
        stopLoss: 3.5,
        currentPrice: 5.5,
      });

      const newState = useTradeStore.getState();
      expect(newState.activeTrades).toHaveLength(1);
      expect(newState.activeTrades[0].state).toBe("ENTERED");
      expect(newState.activeTrades[0].stopLoss).toBe(3.5);
      expect(newState.historyTrades).toHaveLength(0);
    });
  });

  describe("No duplicate IDs across lists", () => {
    it("ensures no duplicates after LOADED → EXITED (shouldn't happen, but defensive)", () => {
      // Start with trade in active
      const trade = createMockTrade("trade-1", "LOADED");
      initializeStore({ activeTrades: [trade] });

      // Transition to EXITED
      useTradeStore.getState().applyTradePatch("trade-1", {
        state: "EXITED",
        exitPrice: 10.0,
      });

      const state = useTradeStore.getState();

      // Count occurrences of trade-1 across all lists
      const allIds = [
        ...state.activeTrades.map((t) => t.id),
        ...state.historyTrades.map((t) => t.id),
        state.previewTrade?.id,
      ].filter(Boolean);

      const trade1Count = allIds.filter((id) => id === "trade-1").length;
      expect(trade1Count).toBe(1);
    });

    it("handles multiple trades without creating duplicates", () => {
      const trade1 = createMockTrade("trade-1", "LOADED");
      const trade2 = createMockTrade("trade-2", "ENTERED");
      const trade3 = createMockTrade("trade-3", "EXITED");
      initializeStore({
        activeTrades: [trade1, trade2],
        historyTrades: [trade3],
      });

      // Exit trade-2
      useTradeStore.getState().applyTradePatch("trade-2", {
        state: "EXITED",
        exitPrice: 7.0,
      });

      const state = useTradeStore.getState();

      // trade-1 should still be in active
      expect(state.activeTrades.find((t) => t.id === "trade-1")).toBeDefined();

      // trade-2 should now be in history
      expect(state.activeTrades.find((t) => t.id === "trade-2")).toBeUndefined();
      expect(state.historyTrades.find((t) => t.id === "trade-2")).toBeDefined();

      // trade-3 should still be in history
      expect(state.historyTrades.find((t) => t.id === "trade-3")).toBeDefined();

      // No duplicates
      const allIds = [
        ...state.activeTrades.map((t) => t.id),
        ...state.historyTrades.map((t) => t.id),
      ];
      expect(new Set(allIds).size).toBe(allIds.length);
    });
  });

  describe("Edge cases", () => {
    it("preserves other trade properties when patching", () => {
      const trade = createMockTrade("trade-1", "ENTERED", "SPY", {
        entryPrice: 5.0,
        targetPrice: 7.5,
        stopLoss: 2.5,
        discordChannels: ["channel-1"],
        challenges: ["challenge-1"],
      });
      initializeStore({ activeTrades: [trade] });

      useTradeStore.getState().applyTradePatch("trade-1", {
        currentPrice: 6.0,
      });

      const updated = useTradeStore.getState().activeTrades[0];
      expect(updated.entryPrice).toBe(5.0);
      expect(updated.targetPrice).toBe(7.5);
      expect(updated.stopLoss).toBe(2.5);
      expect(updated.discordChannels).toEqual(["channel-1"]);
      expect(updated.challenges).toEqual(["challenge-1"]);
      expect(updated.currentPrice).toBe(6.0);
    });

    it("handles empty patch gracefully", () => {
      const trade = createMockTrade("trade-1", "LOADED");
      initializeStore({ activeTrades: [trade] });

      const result = useTradeStore.getState().applyTradePatch("trade-1", {});

      expect(result).not.toBeNull();
      expect(result?.state).toBe("LOADED");
      expect(useTradeStore.getState().activeTrades).toHaveLength(1);
    });
  });
});

// ============================================================================
// getCurrentTrade Selector Tests
// ============================================================================

describe("getCurrentTrade selector", () => {
  beforeEach(() => {
    resetStore();
  });

  it("returns null when no trade focused", () => {
    expect(useTradeStore.getState().getCurrentTrade()).toBeNull();
  });

  it("returns previewTrade when currentTradeId matches", () => {
    const trade = createMockTrade("preview-1", "WATCHING");
    initializeStore({ previewTrade: trade });
    useTradeStore.getState().setCurrentTradeId("preview-1");

    const result = useTradeStore.getState().getCurrentTrade();
    expect(result?.id).toBe("preview-1");
    expect(result?.state).toBe("WATCHING");
  });

  it("prioritizes activeTrade over previewTrade with same ID", () => {
    // This simulates the race condition where preview exists
    // but trade has been promoted to active
    const preview = createMockTrade("trade-1", "WATCHING");
    const active = createMockTrade("trade-1", "LOADED");
    initializeStore({
      previewTrade: preview,
      activeTrades: [active],
    });
    useTradeStore.getState().setCurrentTradeId("trade-1");

    const result = useTradeStore.getState().getCurrentTrade();
    // Should return the LOADED trade, not the WATCHING preview
    expect(result?.state).toBe("LOADED");
  });

  it("returns historyTrade when currentTradeId matches", () => {
    const trade = createMockTrade("history-1", "EXITED");
    initializeStore({ historyTrades: [trade] });
    useTradeStore.getState().setCurrentTradeId("history-1");

    const result = useTradeStore.getState().getCurrentTrade();
    expect(result?.id).toBe("history-1");
    expect(result?.state).toBe("EXITED");
  });
});

// ============================================================================
// getTradeState Selector Tests
// ============================================================================

describe("getTradeState selector", () => {
  beforeEach(() => {
    resetStore();
  });

  it("returns state from activeTrade", () => {
    const trade = createMockTrade("trade-1", "ENTERED");
    initializeStore({ activeTrades: [trade] });
    useTradeStore.getState().setCurrentTradeId("trade-1");

    expect(useTradeStore.getState().getTradeState()).toBe("ENTERED");
  });

  it("returns state from historyTrade", () => {
    const trade = createMockTrade("trade-1", "EXITED");
    initializeStore({ historyTrades: [trade] });
    useTradeStore.getState().setCurrentTradeId("trade-1");

    expect(useTradeStore.getState().getTradeState()).toBe("EXITED");
  });

  it("returns WATCHING when previewTrade is focused", () => {
    const trade = createMockTrade("preview-1", "WATCHING");
    initializeStore({ previewTrade: trade });
    useTradeStore.getState().setCurrentTradeId("preview-1");

    expect(useTradeStore.getState().getTradeState()).toBe("WATCHING");
  });

  it("prioritizes persisted trade state over preview", () => {
    // Active trade should take priority
    const active = createMockTrade("trade-1", "LOADED");
    const preview = createMockTrade("other", "WATCHING");
    initializeStore({
      activeTrades: [active],
      previewTrade: preview,
    });
    useTradeStore.getState().setCurrentTradeId("trade-1");

    expect(useTradeStore.getState().getTradeState()).toBe("LOADED");
  });
});

// ============================================================================
// Derived Selectors Tests
// ============================================================================

describe("getLoadedTrades and getEnteredTrades", () => {
  beforeEach(() => {
    resetStore();
  });

  it("getLoadedTrades returns only LOADED trades", () => {
    const loaded1 = createMockTrade("loaded-1", "LOADED");
    const loaded2 = createMockTrade("loaded-2", "LOADED");
    const entered = createMockTrade("entered-1", "ENTERED");
    initializeStore({ activeTrades: [loaded1, loaded2, entered] });

    const loadedTrades = useTradeStore.getState().getLoadedTrades();
    expect(loadedTrades).toHaveLength(2);
    expect(loadedTrades.every((t) => t.state === "LOADED")).toBe(true);
  });

  it("getEnteredTrades returns only ENTERED trades", () => {
    const loaded = createMockTrade("loaded-1", "LOADED");
    const entered1 = createMockTrade("entered-1", "ENTERED");
    const entered2 = createMockTrade("entered-2", "ENTERED");
    initializeStore({ activeTrades: [loaded, entered1, entered2] });

    const enteredTrades = useTradeStore.getState().getEnteredTrades();
    expect(enteredTrades).toHaveLength(2);
    expect(enteredTrades.every((t) => t.state === "ENTERED")).toBe(true);
  });
});
