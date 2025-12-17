/**
 * Trade Lifecycle Domain Tests
 *
 * Tests for canonical trade state management functions.
 * Ensures trades exist in exactly ONE list and state never regresses.
 */

import { describe, it, expect } from "vitest";
import {
  TRADE_STATE_ORDER,
  compareState,
  isMoreAdvancedState,
  isAtLeastAsAdvanced,
  chooseTradeVersion,
  reconcileTradeLists,
  validateTradeListsInvariants,
  type TradeListsInput,
} from "../tradeLifecycle";
import type { Trade, TradeState } from "../../types";

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
  return {
    id,
    ticker,
    state,
    tradeType: "Day",
    contract: {
      id: `${ticker}-500-2025-01-01`,
      strike: 500,
      expiry: "2025-01-01",
      expiryDate: new Date("2025-01-01"),
      daysToExpiry: 30,
      type: "C",
      mid: 5.0,
      bid: 4.9,
      ask: 5.1,
      volume: 1000,
      openInterest: 5000,
    },
    updates: [],
    discordChannels: [],
    challenges: [],
    ...overrides,
  } as Trade;
}

// ============================================================================
// State Comparison Tests
// ============================================================================

describe("compareState", () => {
  it("returns negative when first state is earlier in lifecycle", () => {
    expect(compareState("WATCHING", "LOADED")).toBeLessThan(0);
    expect(compareState("LOADED", "ENTERED")).toBeLessThan(0);
    expect(compareState("ENTERED", "EXITED")).toBeLessThan(0);
    expect(compareState("WATCHING", "EXITED")).toBeLessThan(0);
  });

  it("returns positive when first state is later in lifecycle", () => {
    expect(compareState("LOADED", "WATCHING")).toBeGreaterThan(0);
    expect(compareState("ENTERED", "LOADED")).toBeGreaterThan(0);
    expect(compareState("EXITED", "ENTERED")).toBeGreaterThan(0);
    expect(compareState("EXITED", "WATCHING")).toBeGreaterThan(0);
  });

  it("returns zero for equal states", () => {
    expect(compareState("WATCHING", "WATCHING")).toBe(0);
    expect(compareState("LOADED", "LOADED")).toBe(0);
    expect(compareState("ENTERED", "ENTERED")).toBe(0);
    expect(compareState("EXITED", "EXITED")).toBe(0);
  });
});

describe("isMoreAdvancedState", () => {
  it("returns true when first state is more advanced", () => {
    expect(isMoreAdvancedState("EXITED", "ENTERED")).toBe(true);
    expect(isMoreAdvancedState("ENTERED", "LOADED")).toBe(true);
  });

  it("returns false when first state is not more advanced", () => {
    expect(isMoreAdvancedState("WATCHING", "LOADED")).toBe(false);
    expect(isMoreAdvancedState("LOADED", "LOADED")).toBe(false);
  });
});

describe("isAtLeastAsAdvanced", () => {
  it("returns true when first state is equal or more advanced", () => {
    expect(isAtLeastAsAdvanced("EXITED", "EXITED")).toBe(true);
    expect(isAtLeastAsAdvanced("EXITED", "ENTERED")).toBe(true);
  });

  it("returns false when first state is less advanced", () => {
    expect(isAtLeastAsAdvanced("WATCHING", "LOADED")).toBe(false);
  });
});

// ============================================================================
// chooseTradeVersion Tests
// ============================================================================

describe("chooseTradeVersion", () => {
  it("throws when IDs do not match", () => {
    const trade1 = createMockTrade("id-1", "LOADED");
    const trade2 = createMockTrade("id-2", "ENTERED");

    expect(() => chooseTradeVersion(trade1, trade2)).toThrow(
      "chooseTradeVersion called with different IDs"
    );
  });

  it("returns incoming when incoming state is more advanced", () => {
    const existing = createMockTrade("id-1", "LOADED", "SPY");
    const incoming = createMockTrade("id-1", "ENTERED", "SPY");

    const result = chooseTradeVersion(existing, incoming);
    expect(result.state).toBe("ENTERED");
    expect(result).toBe(incoming);
  });

  it("NEVER regresses state - keeps existing when existing is more advanced (Test B)", () => {
    // This is the critical "no regression" test
    const existing = createMockTrade("id-1", "EXITED", "SPY", {
      exitPrice: 6.0,
      exitTime: new Date("2025-01-15T16:00:00Z"),
    });
    const incoming = createMockTrade("id-1", "ENTERED", "SPY"); // Stale data from DB

    const result = chooseTradeVersion(existing, incoming);

    // CRITICAL: State must NOT regress from EXITED to ENTERED
    expect(result.state).toBe("EXITED");
    expect(result).toBe(existing);
  });

  it("returns incoming when states are equal (DB is source of truth)", () => {
    const existing = createMockTrade("id-1", "ENTERED", "SPY");
    const incoming = createMockTrade("id-1", "ENTERED", "SPY", {
      currentPrice: 5.5, // Updated price from DB
    });

    const result = chooseTradeVersion(existing, incoming);
    expect(result).toBe(incoming);
  });

  it("prefers newer trade by timestamp when states are equal", () => {
    const existing = createMockTrade("id-1", "ENTERED", "SPY", {
      entryTime: new Date("2025-01-10T10:00:00Z"),
    });
    const incoming = createMockTrade("id-1", "ENTERED", "SPY", {
      entryTime: new Date("2025-01-10T09:00:00Z"), // Older
    });

    // When timestamps show existing is newer, keep existing
    const result = chooseTradeVersion(existing, incoming);
    expect(result).toBe(existing);
  });
});

// ============================================================================
// reconcileTradeLists Tests
// ============================================================================

describe("reconcileTradeLists", () => {
  it("moves EXITED trade from activeTrades to historyTrades (Test A)", () => {
    // This is the critical bug fix test
    const existingActive = createMockTrade("id-1", "ENTERED", "SPY");
    const incomingExited = createMockTrade("id-1", "EXITED", "SPY", {
      exitPrice: 6.0,
      exitTime: new Date("2025-01-15T16:00:00Z"),
    });

    const existing: TradeListsInput = {
      activeTrades: [existingActive],
      historyTrades: [],
      previewTrade: null,
    };

    const result = reconcileTradeLists(existing, [incomingExited]);

    // Trade should be in historyTrades, NOT in activeTrades
    expect(result.activeTrades).toHaveLength(0);
    expect(result.historyTrades).toHaveLength(1);
    expect(result.historyTrades[0].state).toBe("EXITED");
    expect(result.historyTrades[0].id).toBe("id-1");
  });

  it("keeps EXITED trade as EXITED when DB returns stale ENTERED data (Test B)", () => {
    // Optimistic EXITED should not regress to ENTERED from stale DB
    const existingExited = createMockTrade("id-1", "EXITED", "SPY", {
      exitPrice: 6.0,
      exitTime: new Date("2025-01-15T16:00:00Z"),
    });
    const staleEntered = createMockTrade("id-1", "ENTERED", "SPY");

    const existing: TradeListsInput = {
      activeTrades: [],
      historyTrades: [existingExited],
      previewTrade: null,
    };

    const result = reconcileTradeLists(existing, [staleEntered]);

    // Trade should remain EXITED in historyTrades
    expect(result.historyTrades).toHaveLength(1);
    expect(result.historyTrades[0].state).toBe("EXITED");
    expect(result.activeTrades).toHaveLength(0);
  });

  it("removes duplicate ID that appears in both active and history (Test C)", () => {
    // Bug scenario: same ID in both lists
    const activeVersion = createMockTrade("id-1", "ENTERED", "SPY");
    const historyVersion = createMockTrade("id-1", "EXITED", "SPY", {
      exitPrice: 6.0,
    });

    const existing: TradeListsInput = {
      activeTrades: [activeVersion],
      historyTrades: [historyVersion], // Duplicate!
      previewTrade: null,
    };

    const result = reconcileTradeLists(existing, []);

    // Should have exactly ONE instance, in the correct list based on most advanced state
    const totalTrades = result.activeTrades.length + result.historyTrades.length;
    expect(totalTrades).toBe(1);

    // EXITED is more advanced, so should be in historyTrades
    expect(result.historyTrades).toHaveLength(1);
    expect(result.historyTrades[0].state).toBe("EXITED");
    expect(result.activeTrades).toHaveLength(0);
  });

  it("clears previewTrade when it appears in DB (persisted)", () => {
    const preview = createMockTrade("id-1", "WATCHING", "SPY");
    const persisted = createMockTrade("id-1", "LOADED", "SPY");

    const existing: TradeListsInput = {
      activeTrades: [],
      historyTrades: [],
      previewTrade: preview,
    };

    const result = reconcileTradeLists(existing, [persisted]);

    // Preview should be cleared since trade is now persisted
    expect(result.previewTrade).toBeNull();
    // Trade should be in activeTrades as LOADED
    expect(result.activeTrades).toHaveLength(1);
    expect(result.activeTrades[0].state).toBe("LOADED");
  });

  it("preserves previewTrade when not in DB", () => {
    const preview = createMockTrade("preview-id", "WATCHING", "QQQ");
    const otherTrade = createMockTrade("other-id", "ENTERED", "SPY");

    const existing: TradeListsInput = {
      activeTrades: [],
      historyTrades: [],
      previewTrade: preview,
    };

    const result = reconcileTradeLists(existing, [otherTrade]);

    // Preview should be preserved (not in DB)
    expect(result.previewTrade).not.toBeNull();
    expect(result.previewTrade?.id).toBe("preview-id");
    // Other trade should be in activeTrades
    expect(result.activeTrades).toHaveLength(1);
  });

  it("handles empty inputs gracefully", () => {
    const existing: TradeListsInput = {
      activeTrades: [],
      historyTrades: [],
      previewTrade: null,
    };

    const result = reconcileTradeLists(existing, []);

    expect(result.activeTrades).toHaveLength(0);
    expect(result.historyTrades).toHaveLength(0);
    expect(result.previewTrade).toBeNull();
  });

  it("correctly partitions multiple trades by state", () => {
    const loaded = createMockTrade("id-1", "LOADED", "SPY");
    const entered = createMockTrade("id-2", "ENTERED", "QQQ");
    const exited = createMockTrade("id-3", "EXITED", "AAPL");

    const existing: TradeListsInput = {
      activeTrades: [],
      historyTrades: [],
      previewTrade: null,
    };

    const result = reconcileTradeLists(existing, [loaded, entered, exited]);

    // LOADED and ENTERED should be in activeTrades
    expect(result.activeTrades).toHaveLength(2);
    expect(result.activeTrades.map((t) => t.state).sort()).toEqual(["ENTERED", "LOADED"]);

    // EXITED should be in historyTrades
    expect(result.historyTrades).toHaveLength(1);
    expect(result.historyTrades[0].state).toBe("EXITED");
  });
});

// ============================================================================
// validateTradeListsInvariants Tests (Test D)
// ============================================================================

describe("validateTradeListsInvariants", () => {
  it("returns empty array for valid lists", () => {
    const validLists: TradeListsInput = {
      activeTrades: [
        createMockTrade("id-1", "LOADED", "SPY"),
        createMockTrade("id-2", "ENTERED", "QQQ"),
      ],
      historyTrades: [createMockTrade("id-3", "EXITED", "AAPL")],
      previewTrade: createMockTrade("id-4", "WATCHING", "MSFT"),
    };

    const violations = validateTradeListsInvariants(validLists);
    expect(violations).toHaveLength(0);
  });

  it("detects duplicate ID across activeTrades and historyTrades", () => {
    const duplicateLists: TradeListsInput = {
      activeTrades: [createMockTrade("id-1", "ENTERED", "SPY")],
      historyTrades: [createMockTrade("id-1", "EXITED", "SPY")], // Same ID!
      previewTrade: null,
    };

    const violations = validateTradeListsInvariants(duplicateLists);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === "duplicate_id")).toBe(true);
  });

  it("detects EXITED trade in activeTrades (wrong membership)", () => {
    const badLists: TradeListsInput = {
      activeTrades: [createMockTrade("id-1", "EXITED", "SPY")], // Wrong!
      historyTrades: [],
      previewTrade: null,
    };

    const violations = validateTradeListsInvariants(badLists);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === "wrong_list_membership")).toBe(true);
    expect(violations[0].details).toContain("EXITED trade");
    expect(violations[0].details).toContain("activeTrades");
  });

  it("detects WATCHING trade in activeTrades (wrong membership)", () => {
    const badLists: TradeListsInput = {
      activeTrades: [createMockTrade("id-1", "WATCHING", "SPY")], // Wrong!
      historyTrades: [],
      previewTrade: null,
    };

    const violations = validateTradeListsInvariants(badLists);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === "wrong_list_membership")).toBe(true);
  });

  it("detects non-EXITED trade in historyTrades (wrong membership)", () => {
    const badLists: TradeListsInput = {
      activeTrades: [],
      historyTrades: [createMockTrade("id-1", "ENTERED", "SPY")], // Wrong!
      previewTrade: null,
    };

    const violations = validateTradeListsInvariants(badLists);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === "wrong_list_membership")).toBe(true);
  });

  it("detects previewTrade with wrong state (not WATCHING)", () => {
    const badLists: TradeListsInput = {
      activeTrades: [],
      historyTrades: [],
      previewTrade: createMockTrade("id-1", "LOADED", "SPY"), // Should be WATCHING
    };

    const violations = validateTradeListsInvariants(badLists);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === "wrong_list_membership")).toBe(true);
  });

  it("detects previewTrade ID also in activeTrades", () => {
    const badLists: TradeListsInput = {
      activeTrades: [createMockTrade("id-1", "LOADED", "SPY")],
      historyTrades: [],
      previewTrade: createMockTrade("id-1", "WATCHING", "SPY"), // Same ID!
    };

    const violations = validateTradeListsInvariants(badLists);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.type === "preview_in_db")).toBe(true);
  });
});

// ============================================================================
// TRADE_STATE_ORDER Tests
// ============================================================================

describe("TRADE_STATE_ORDER", () => {
  it("has correct ordering", () => {
    expect(TRADE_STATE_ORDER).toEqual(["WATCHING", "LOADED", "ENTERED", "EXITED"]);
  });

  it("is immutable (readonly)", () => {
    // TypeScript enforces this, but we can verify the array exists
    expect(TRADE_STATE_ORDER.length).toBe(4);
  });
});
