/**
 * viewRouter.test.ts - Tests for centralized view routing logic
 *
 * These tests ensure that the view routing behaves consistently:
 * - deriveFocus correctly determines focus target from state
 * - deriveViewState correctly maps focus to view
 * - deriveAlertMode correctly determines available alert options
 */

import { describe, it, expect } from "vitest";
import {
  deriveFocus,
  deriveViewState,
  deriveAlertMode,
  getViewRouting,
  isSymbolFocus,
  isTradeFocus,
  canPerformTradeActions,
  canLoadTrade,
  canEnterTrade,
  type FocusTarget,
  type ViewState,
} from "../viewRouter";
import type { Trade, Ticker, TradeState } from "../../types";

// ============================================================================
// Test Fixtures
// ============================================================================

const mockTicker: Ticker = {
  id: "ticker-1",
  symbol: "SPY",
  last: 595.5,
  changePercent: 0.5,
};

const mockWatchingTrade: Trade = {
  id: "trade-watching",
  ticker: "SPY",
  state: "WATCHING",
  contract: {
    id: "contract-1",
    strike: 600,
    type: "C",
    expiry: "2025-01-20",
    expiryDate: "2025-01-20",
    daysToExpiry: 5,
    mid: 2.5,
    bid: 2.4,
    ask: 2.6,
    volume: 1000,
    openInterest: 5000,
    delta: 0.45,
  },
  tradeType: "Day",
  targetPrice: 3.75,
  stopLoss: 1.25,
  currentPrice: 2.5,
  discordChannels: [],
  challenges: [],
  updates: [],
};

const mockLoadedTrade: Trade = {
  ...mockWatchingTrade,
  id: "trade-loaded",
  state: "LOADED",
};

const mockEnteredTrade: Trade = {
  ...mockWatchingTrade,
  id: "trade-entered",
  state: "ENTERED",
  entryPrice: 2.5,
  entryTime: new Date().toISOString(),
};

const mockExitedTrade: Trade = {
  ...mockWatchingTrade,
  id: "trade-exited",
  state: "EXITED",
  entryPrice: 2.5,
  exitPrice: 3.5,
  exitTime: new Date().toISOString(),
};

// ============================================================================
// deriveFocus Tests
// ============================================================================

describe("deriveFocus", () => {
  it("returns null when no trade and no ticker", () => {
    const focus = deriveFocus(null, null, null);
    expect(focus).toBeNull();
  });

  it("returns symbol focus when currentTradeId is null and ticker exists", () => {
    const focus = deriveFocus(null, null, mockTicker);
    expect(focus).toEqual({ kind: "symbol", symbol: "SPY" });
  });

  it("returns trade focus when currentTrade exists with WATCHING state", () => {
    const focus = deriveFocus(mockWatchingTrade.id, mockWatchingTrade, mockTicker);
    expect(focus).toEqual({ kind: "trade", tradeId: mockWatchingTrade.id });
  });

  it("returns trade focus when currentTrade exists with LOADED state", () => {
    const focus = deriveFocus(mockLoadedTrade.id, mockLoadedTrade, mockTicker);
    expect(focus).toEqual({ kind: "trade", tradeId: mockLoadedTrade.id });
  });

  it("returns trade focus when currentTrade exists with ENTERED state", () => {
    const focus = deriveFocus(mockEnteredTrade.id, mockEnteredTrade, mockTicker);
    expect(focus).toEqual({ kind: "trade", tradeId: mockEnteredTrade.id });
  });

  it("returns trade focus when currentTrade exists with EXITED state", () => {
    const focus = deriveFocus(mockExitedTrade.id, mockExitedTrade, mockTicker);
    expect(focus).toEqual({ kind: "trade", tradeId: mockExitedTrade.id });
  });

  it("falls back to symbol focus when currentTradeId is set but trade is null", () => {
    const focus = deriveFocus("unknown-id", null, mockTicker);
    expect(focus).toEqual({ kind: "symbol", symbol: "SPY" });
  });

  it("returns null when currentTradeId is set but no trade and no ticker", () => {
    const focus = deriveFocus("unknown-id", null, null);
    expect(focus).toBeNull();
  });
});

// ============================================================================
// deriveViewState Tests
// ============================================================================

describe("deriveViewState", () => {
  it("returns 'empty' when focus is null", () => {
    const viewState = deriveViewState(null, null, [], "WATCHING");
    expect(viewState).toBe("empty");
  });

  it("returns 'symbol' when focus is symbol kind", () => {
    const focus: FocusTarget = { kind: "symbol", symbol: "SPY" };
    const viewState = deriveViewState(focus, null, [], "WATCHING");
    expect(viewState).toBe("symbol");
  });

  it("returns 'plan' for WATCHING trade focus (preview, not yet persisted)", () => {
    const focus: FocusTarget = { kind: "trade", tradeId: mockWatchingTrade.id };
    const viewState = deriveViewState(focus, mockWatchingTrade, [], "WATCHING");
    expect(viewState).toBe("plan");
  });

  it("returns 'loaded' for LOADED trade focus", () => {
    const focus: FocusTarget = { kind: "trade", tradeId: mockLoadedTrade.id };
    const viewState = deriveViewState(focus, mockLoadedTrade, [mockLoadedTrade], "LOADED");
    expect(viewState).toBe("loaded");
  });

  it("returns 'entered' for ENTERED trade focus", () => {
    const focus: FocusTarget = { kind: "trade", tradeId: mockEnteredTrade.id };
    const viewState = deriveViewState(focus, mockEnteredTrade, [mockEnteredTrade], "ENTERED");
    expect(viewState).toBe("entered");
  });

  it("returns 'exited' for EXITED trade focus", () => {
    const focus: FocusTarget = { kind: "trade", tradeId: mockExitedTrade.id };
    const viewState = deriveViewState(focus, mockExitedTrade, [], "EXITED");
    expect(viewState).toBe("exited");
  });

  it("returns 'empty' when trade focus but trade not found", () => {
    const focus: FocusTarget = { kind: "trade", tradeId: "unknown" };
    const viewState = deriveViewState(focus, null, [], "WATCHING");
    expect(viewState).toBe("empty");
  });

  it("finds trade from activeTrades when currentTrade is null", () => {
    const focus: FocusTarget = { kind: "trade", tradeId: mockEnteredTrade.id };
    const viewState = deriveViewState(focus, null, [mockEnteredTrade], "ENTERED");
    expect(viewState).toBe("entered");
  });
});

// ============================================================================
// deriveAlertMode Tests
// ============================================================================

describe("deriveAlertMode", () => {
  it("returns 'update' for entered view state", () => {
    const alertMode = deriveAlertMode("entered", mockEnteredTrade);
    expect(alertMode).toBe("update");
  });

  it("returns 'exit' for exited view state", () => {
    const alertMode = deriveAlertMode("exited", mockExitedTrade);
    expect(alertMode).toBe("exit");
  });

  it("returns 'entry' for loaded view state with LOADED trade", () => {
    const alertMode = deriveAlertMode("loaded", mockLoadedTrade);
    expect(alertMode).toBe("entry");
  });

  it("returns 'load' for plan view state (WATCHING trade - not yet persisted)", () => {
    const alertMode = deriveAlertMode("plan", mockWatchingTrade);
    expect(alertMode).toBe("load");
  });

  it("returns 'load' for symbol view state", () => {
    const alertMode = deriveAlertMode("symbol", null);
    expect(alertMode).toBe("load");
  });

  it("returns 'load' for empty view state", () => {
    const alertMode = deriveAlertMode("empty", null);
    expect(alertMode).toBe("load");
  });
});

// ============================================================================
// getViewRouting Integration Tests
// ============================================================================

describe("getViewRouting", () => {
  it("returns correct routing for empty state (no selection)", () => {
    const result = getViewRouting(null, null, [], null, "WATCHING");
    expect(result).toEqual({
      focus: null,
      viewState: "empty",
      alertMode: "load",
    });
  });

  it("returns correct routing for symbol selection", () => {
    const result = getViewRouting(null, null, [], mockTicker, "WATCHING");
    expect(result).toEqual({
      focus: { kind: "symbol", symbol: "SPY" },
      viewState: "symbol",
      alertMode: "load",
    });
  });

  it("returns correct routing for WATCHING trade (preview before Load and Alert)", () => {
    const result = getViewRouting(
      mockWatchingTrade.id,
      mockWatchingTrade,
      [],
      mockTicker,
      "WATCHING"
    );
    expect(result).toEqual({
      focus: { kind: "trade", tradeId: mockWatchingTrade.id },
      viewState: "plan",
      alertMode: "load",
    });
  });

  it("returns correct routing for LOADED trade", () => {
    const result = getViewRouting(
      mockLoadedTrade.id,
      mockLoadedTrade,
      [mockLoadedTrade],
      mockTicker,
      "LOADED"
    );
    expect(result).toEqual({
      focus: { kind: "trade", tradeId: mockLoadedTrade.id },
      viewState: "loaded",
      alertMode: "entry",
    });
  });

  it("returns correct routing for ENTERED trade", () => {
    const result = getViewRouting(
      mockEnteredTrade.id,
      mockEnteredTrade,
      [mockEnteredTrade],
      mockTicker,
      "ENTERED"
    );
    expect(result).toEqual({
      focus: { kind: "trade", tradeId: mockEnteredTrade.id },
      viewState: "entered",
      alertMode: "update",
    });
  });

  it("returns correct routing for EXITED trade", () => {
    const result = getViewRouting(
      mockExitedTrade.id,
      mockExitedTrade,
      [],
      mockTicker,
      "EXITED"
    );
    expect(result).toEqual({
      focus: { kind: "trade", tradeId: mockExitedTrade.id },
      viewState: "exited",
      alertMode: "exit",
    });
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe("isSymbolFocus", () => {
  it("returns true for symbol focus", () => {
    expect(isSymbolFocus({ kind: "symbol", symbol: "SPY" })).toBe(true);
  });

  it("returns false for trade focus", () => {
    expect(isSymbolFocus({ kind: "trade", tradeId: "123" })).toBe(false);
  });

  it("returns false for null focus", () => {
    expect(isSymbolFocus(null)).toBe(false);
  });
});

describe("isTradeFocus", () => {
  it("returns true for trade focus", () => {
    expect(isTradeFocus({ kind: "trade", tradeId: "123" })).toBe(true);
  });

  it("returns false for symbol focus", () => {
    expect(isTradeFocus({ kind: "symbol", symbol: "SPY" })).toBe(false);
  });

  it("returns false for null focus", () => {
    expect(isTradeFocus(null)).toBe(false);
  });
});

// ============================================================================
// Permission Check Tests
// ============================================================================

describe("canPerformTradeActions", () => {
  it("returns true for entered state", () => {
    expect(canPerformTradeActions("entered")).toBe(true);
  });

  it("returns false for other states", () => {
    expect(canPerformTradeActions("empty")).toBe(false);
    expect(canPerformTradeActions("symbol")).toBe(false);
    expect(canPerformTradeActions("plan")).toBe(false);
    expect(canPerformTradeActions("loaded")).toBe(false);
    expect(canPerformTradeActions("exited")).toBe(false);
  });
});

describe("canLoadTrade", () => {
  it("returns true for symbol state", () => {
    expect(canLoadTrade("symbol")).toBe(true);
  });

  it("returns false for other states", () => {
    expect(canLoadTrade("empty")).toBe(false);
    expect(canLoadTrade("plan")).toBe(false);
    expect(canLoadTrade("loaded")).toBe(false);
    expect(canLoadTrade("entered")).toBe(false);
    expect(canLoadTrade("exited")).toBe(false);
  });
});

describe("canEnterTrade", () => {
  it("returns true for plan state with WATCHING trade state", () => {
    expect(canEnterTrade("plan", "WATCHING")).toBe(true);
  });

  it("returns true for loaded state with LOADED trade state", () => {
    expect(canEnterTrade("loaded", "LOADED")).toBe(true);
  });

  it("returns true for plan state with LOADED trade state", () => {
    expect(canEnterTrade("plan", "LOADED")).toBe(true);
  });

  it("returns false for plan state with ENTERED trade state", () => {
    expect(canEnterTrade("plan", "ENTERED")).toBe(false);
  });

  it("returns false for loaded state with ENTERED trade state", () => {
    expect(canEnterTrade("loaded", "ENTERED")).toBe(false);
  });

  it("returns false for symbol state", () => {
    expect(canEnterTrade("symbol", "WATCHING")).toBe(false);
  });
});
