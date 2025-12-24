/**
 * Alert Draft Domain Tests
 *
 * Tests for shared alert draft defaults across desktop and mobile.
 * Verifies field toggles, editable prices, and validation logic.
 */

import { describe, it, expect } from "vitest";
import {
  getDefaultFieldToggles,
  getDefaultEditablePrices,
  getDefaultComment,
  createAlertDraft,
  validatePrices,
  updateDraftPrice,
  updateDraftToggle,
  updateDraftChannels,
  updateDraftChallenges,
  updateDraftComment,
  updateDraftSendAlert,
  type AlertDraft,
  type AlertDraftFieldToggles,
  type AlertDraftEditablePrices,
} from "../alertDraft";
import type { Trade, TradeState } from "../../types";
import type { TradeActionIntent } from "../tradeActions";

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
      id: `O:${ticker}250117C00500000`,
      strike: 500,
      expiry: "2025-01-17",
      expiryDate: new Date("2025-01-17"),
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
// getDefaultFieldToggles Tests
// ============================================================================

describe("getDefaultFieldToggles", () => {
  it("returns correct toggles for LOAD intent", () => {
    const toggles = getDefaultFieldToggles("LOAD");

    expect(toggles.showEntry).toBe(false); // No entry for LOAD
    expect(toggles.showCurrent).toBe(true);
    expect(toggles.showTarget).toBe(true);
    expect(toggles.showStop).toBe(true);
    expect(toggles.showRiskReward).toBe(true);
    expect(toggles.showGreeks).toBe(true);
    expect(toggles.showUnderlying).toBe(true);
    expect(toggles.showSetupType).toBe(true);
    expect(toggles.showGainsImage).toBe(false);
  });

  it("returns correct toggles for ENTER intent", () => {
    const toggles = getDefaultFieldToggles("ENTER");

    expect(toggles.showEntry).toBe(true); // Entry shown for ENTER
    expect(toggles.showCurrent).toBe(true);
    expect(toggles.showTarget).toBe(true);
    expect(toggles.showStop).toBe(true);
    expect(toggles.showRiskReward).toBe(true);
    expect(toggles.showGreeks).toBe(true);
    expect(toggles.showUnderlying).toBe(true);
    expect(toggles.showSetupType).toBe(true);
  });

  it("returns correct toggles for UPDATE_SL intent", () => {
    const toggles = getDefaultFieldToggles("UPDATE_SL");

    expect(toggles.showStop).toBe(true); // Main field
    expect(toggles.showPnL).toBe(true);
    expect(toggles.showDTE).toBe(true);
    expect(toggles.showEntry).toBe(false);
    expect(toggles.showTarget).toBe(false);
  });

  it("returns correct toggles for TRIM intent", () => {
    const toggles = getDefaultFieldToggles("TRIM");

    expect(toggles.showCurrent).toBe(true);
    expect(toggles.showPnL).toBe(true);
    expect(toggles.showDTE).toBe(true);
  });

  it("returns correct toggles for ADD intent", () => {
    const toggles = getDefaultFieldToggles("ADD");

    expect(toggles.showCurrent).toBe(true);
    expect(toggles.showPnL).toBe(true);
    expect(toggles.showDTE).toBe(true);
  });

  it("returns correct toggles for TRAIL_STOP intent", () => {
    const toggles = getDefaultFieldToggles("TRAIL_STOP");

    expect(toggles.showStop).toBe(true);
    expect(toggles.showPnL).toBe(true);
    expect(toggles.showDTE).toBe(true);
  });

  it("returns correct toggles for EXIT intent", () => {
    const toggles = getDefaultFieldToggles("EXIT");

    expect(toggles.showEntry).toBe(true);
    expect(toggles.showCurrent).toBe(true);
    expect(toggles.showPnL).toBe(true);
    expect(toggles.showDTE).toBe(true);
    expect(toggles.showGainsImage).toBe(false); // Optional, user enables
  });

  it("returns correct toggles for SHARE_EXIT intent", () => {
    const toggles = getDefaultFieldToggles("SHARE_EXIT");

    expect(toggles.showEntry).toBe(true);
    expect(toggles.showCurrent).toBe(true);
    expect(toggles.showPnL).toBe(true);
    expect(toggles.showGainsImage).toBe(true); // More likely for sharing
  });

  it("returns minimal toggles for UNLOAD intent", () => {
    const toggles = getDefaultFieldToggles("UNLOAD");

    expect(toggles.showEntry).toBe(false);
    expect(toggles.showCurrent).toBe(false);
    expect(toggles.showTarget).toBe(false);
    expect(toggles.showStop).toBe(false);
    expect(toggles.showPnL).toBe(false);
    expect(toggles.showDTE).toBe(true); // DTE always shown by default
  });

  it("always includes showDTE by default", () => {
    const intents: TradeActionIntent[] = [
      "LOAD",
      "ENTER",
      "UPDATE_SL",
      "TRIM",
      "ADD",
      "TRAIL_STOP",
      "EXIT",
      "SHARE_EXIT",
      "UNLOAD",
    ];

    intents.forEach((intent) => {
      const toggles = getDefaultFieldToggles(intent);
      expect(toggles.showDTE).toBe(true);
    });
  });
});

// ============================================================================
// getDefaultEditablePrices Tests
// ============================================================================

describe("getDefaultEditablePrices", () => {
  it("returns correct prices for LOAD intent", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY", {
      targetPrice: 7.5,
      stopLoss: 2.5,
    });
    const prices = getDefaultEditablePrices("LOAD", trade, 5.0);

    expect(prices.current).toBe(5.0);
    expect(prices.target).toBe(7.5);
    expect(prices.stop).toBe(2.5);
    expect(prices.entry).toBeUndefined(); // No entry for LOAD
  });

  it("uses contract mid when no current price provided", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const prices = getDefaultEditablePrices("LOAD", trade);

    expect(prices.current).toBe(5.0); // contract.mid
  });

  it("calculates defaults when no target/stop set", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const prices = getDefaultEditablePrices("LOAD", trade, 10.0);

    expect(prices.current).toBe(10.0);
    expect(prices.target).toBe(15.0); // 1.5x current
    expect(prices.stop).toBe(5.0); // 0.5x current
  });

  it("returns correct prices for ENTER intent", () => {
    const trade = createMockTrade("id-1", "LOADED", "SPY", {
      entryPrice: 5.0,
      targetPrice: 7.5,
      stopLoss: 2.5,
    });
    const prices = getDefaultEditablePrices("ENTER", trade, 5.2);

    expect(prices.entry).toBe(5.0);
    expect(prices.current).toBe(5.2);
    expect(prices.target).toBe(7.5);
    expect(prices.stop).toBe(2.5);
  });

  it("returns only stop for UPDATE_SL intent", () => {
    const trade = createMockTrade("id-1", "ENTERED", "SPY", {
      stopLoss: 3.0,
    });
    const prices = getDefaultEditablePrices("UPDATE_SL", trade);

    expect(prices.stop).toBe(3.0);
    expect(prices.entry).toBeUndefined();
    expect(prices.target).toBeUndefined();
  });

  it("returns current for TRIM intent", () => {
    const trade = createMockTrade("id-1", "ENTERED", "SPY");
    const prices = getDefaultEditablePrices("TRIM", trade, 7.0);

    expect(prices.current).toBe(7.0);
    expect(prices.stop).toBeUndefined();
    expect(prices.target).toBeUndefined();
  });

  it("returns current for ADD intent", () => {
    const trade = createMockTrade("id-1", "ENTERED", "SPY");
    const prices = getDefaultEditablePrices("ADD", trade, 4.5);

    expect(prices.current).toBe(4.5);
  });

  it("returns stop for TRAIL_STOP intent", () => {
    const trade = createMockTrade("id-1", "ENTERED", "SPY", {
      stopLoss: 4.0,
      entryPrice: 5.0,
    });
    const prices = getDefaultEditablePrices("TRAIL_STOP", trade);

    expect(prices.stop).toBe(4.0);
  });

  it("returns entry and current for EXIT intent", () => {
    const trade = createMockTrade("id-1", "ENTERED", "SPY", {
      entryPrice: 5.0,
    });
    const prices = getDefaultEditablePrices("EXIT", trade, 8.0);

    expect(prices.entry).toBe(5.0);
    expect(prices.current).toBe(8.0);
  });

  it("uses exitPrice for SHARE_EXIT intent", () => {
    const trade = createMockTrade("id-1", "EXITED", "SPY", {
      entryPrice: 5.0,
      exitPrice: 9.0,
    });
    const prices = getDefaultEditablePrices("SHARE_EXIT", trade);

    expect(prices.entry).toBe(5.0);
    expect(prices.current).toBe(9.0); // exitPrice
  });

  it("returns empty for UNLOAD intent", () => {
    const trade = createMockTrade("id-1", "LOADED", "SPY");
    const prices = getDefaultEditablePrices("UNLOAD", trade);

    expect(Object.keys(prices).length).toBe(0);
  });
});

// ============================================================================
// getDefaultComment Tests
// ============================================================================

describe("getDefaultComment", () => {
  it("returns empty for LOAD", () => {
    expect(getDefaultComment("LOAD")).toBe("");
  });

  it("returns empty for ENTER", () => {
    expect(getDefaultComment("ENTER")).toBe("");
  });

  it("returns descriptive for UPDATE_SL", () => {
    expect(getDefaultComment("UPDATE_SL")).toBe("Stop loss adjusted");
  });

  it("returns descriptive for TRIM", () => {
    expect(getDefaultComment("TRIM")).toBe("Taking partial profits");
  });

  it("returns descriptive for ADD", () => {
    expect(getDefaultComment("ADD")).toBe("Adding to position");
  });

  it("returns descriptive for TRAIL_STOP", () => {
    expect(getDefaultComment("TRAIL_STOP")).toBe("Activating trailing stop");
  });

  it("returns empty for EXIT", () => {
    expect(getDefaultComment("EXIT")).toBe("");
  });
});

// ============================================================================
// createAlertDraft Tests
// ============================================================================

describe("createAlertDraft", () => {
  it("creates complete draft for LOAD intent", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({
      intent: "LOAD",
      trade,
      currentPrice: 5.0,
    });

    expect(draft.intent).toBe("LOAD");
    expect(draft.trade.id).toBe("id-1");
    expect(draft.editablePrices.current).toBe(5.0);
    expect(draft.fieldToggles.showTarget).toBe(true);
    expect(draft.channels).toEqual([]);
    expect(draft.challenges).toEqual([]);
    expect(draft.sendAlert).toBe(true);
  });

  it("preserves trade channels and challenges", () => {
    const trade = createMockTrade("id-1", "LOADED", "SPY", {
      discordChannels: ["channel-1", "channel-2"],
      challenges: ["challenge-1"],
    });
    const draft = createAlertDraft({
      intent: "ENTER",
      trade,
    });

    expect(draft.channels).toEqual(["channel-1", "channel-2"]);
    expect(draft.challenges).toEqual(["challenge-1"]);
  });

  it("uses initial channels/challenges when provided", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({
      intent: "LOAD",
      trade,
      initialChannels: ["new-channel"],
      initialChallenges: ["new-challenge"],
    });

    expect(draft.channels).toEqual(["new-channel"]);
    expect(draft.challenges).toEqual(["new-challenge"]);
  });

  it("sets default comment based on intent", () => {
    const trade = createMockTrade("id-1", "ENTERED", "SPY");
    const draft = createAlertDraft({
      intent: "TRIM",
      trade,
    });

    expect(draft.comment).toBe("Taking partial profits");
  });

  it("defaults sendAlert to true", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({
      intent: "LOAD",
      trade,
    });

    expect(draft.sendAlert).toBe(true);
  });
});

// ============================================================================
// validatePrices Tests
// ============================================================================

describe("validatePrices", () => {
  it("returns no errors for valid prices", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const prices: AlertDraftEditablePrices = {
      entry: 5.0,
      current: 5.0,
      target: 7.5,
      stop: 2.5,
    };
    const errors = validatePrices("ENTER", prices, trade);

    expect(errors).toHaveLength(0);
  });

  it("rejects negative prices", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const prices: AlertDraftEditablePrices = {
      entry: -1.0,
      target: -2.0,
      stop: -3.0,
    };
    const errors = validatePrices("ENTER", prices, trade);

    expect(errors).toContain("Entry price must be positive");
    expect(errors).toContain("Target price must be positive");
    expect(errors).toContain("Stop loss must be positive");
  });

  it("rejects zero prices", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const prices: AlertDraftEditablePrices = {
      current: 0,
    };
    const errors = validatePrices("LOAD", prices, trade);

    expect(errors).toContain("Current price must be positive");
  });

  it("validates stop below entry for calls", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY"); // Call option
    const prices: AlertDraftEditablePrices = {
      entry: 5.0,
      stop: 6.0, // Above entry - invalid for call
    };
    const errors = validatePrices("ENTER", prices, trade);

    expect(errors).toContain("Stop loss should be below entry for calls");
  });

  it("validates target above entry for calls", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY"); // Call option
    const prices: AlertDraftEditablePrices = {
      entry: 5.0,
      target: 4.0, // Below entry - invalid for call
    };
    const errors = validatePrices("ENTER", prices, trade);

    expect(errors).toContain("Target should be above entry for calls");
  });

  it("validates stop above entry for puts", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY", {
      contract: {
        id: "O:SPY250117P00500000",
        strike: 500,
        expiry: "2025-01-17",
        expiryDate: new Date("2025-01-17"),
        daysToExpiry: 30,
        type: "P", // Put option
        mid: 5.0,
        bid: 4.9,
        ask: 5.1,
        volume: 1000,
        openInterest: 5000,
      },
    });
    const prices: AlertDraftEditablePrices = {
      entry: 5.0,
      stop: 4.0, // Below entry - invalid for put
    };
    const errors = validatePrices("ENTER", prices, trade);

    expect(errors).toContain("Stop loss should be above entry for puts");
  });

  it("validates target below entry for puts", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY", {
      contract: {
        id: "O:SPY250117P00500000",
        strike: 500,
        expiry: "2025-01-17",
        expiryDate: new Date("2025-01-17"),
        daysToExpiry: 30,
        type: "P", // Put option
        mid: 5.0,
        bid: 4.9,
        ask: 5.1,
        volume: 1000,
        openInterest: 5000,
      },
    });
    const prices: AlertDraftEditablePrices = {
      entry: 5.0,
      target: 6.0, // Above entry - invalid for put
    };
    const errors = validatePrices("ENTER", prices, trade);

    expect(errors).toContain("Target should be below entry for puts");
  });
});

// ============================================================================
// Draft Helpers Tests
// ============================================================================

describe("updateDraftPrice", () => {
  it("updates price immutably", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({ intent: "LOAD", trade });

    const updated = updateDraftPrice(draft, "target", 10.0);

    expect(updated.editablePrices.target).toBe(10.0);
    expect(draft.editablePrices.target).not.toBe(10.0); // Original unchanged
  });
});

describe("updateDraftToggle", () => {
  it("updates toggle immutably", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({ intent: "LOAD", trade });

    const updated = updateDraftToggle(draft, "showGreeks", false);

    expect(updated.fieldToggles.showGreeks).toBe(false);
    expect(draft.fieldToggles.showGreeks).toBe(true); // Original unchanged
  });
});

describe("updateDraftChannels", () => {
  it("updates channels immutably", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({ intent: "LOAD", trade });

    const updated = updateDraftChannels(draft, ["channel-1", "channel-2"]);

    expect(updated.channels).toEqual(["channel-1", "channel-2"]);
    expect(draft.channels).toEqual([]); // Original unchanged
  });
});

describe("updateDraftChallenges", () => {
  it("updates challenges immutably", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({ intent: "LOAD", trade });

    const updated = updateDraftChallenges(draft, ["challenge-1"]);

    expect(updated.challenges).toEqual(["challenge-1"]);
    expect(draft.challenges).toEqual([]); // Original unchanged
  });
});

describe("updateDraftComment", () => {
  it("updates comment immutably", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({ intent: "LOAD", trade });

    const updated = updateDraftComment(draft, "Custom comment");

    expect(updated.comment).toBe("Custom comment");
    expect(draft.comment).toBe(""); // Original unchanged
  });
});

describe("updateDraftSendAlert", () => {
  it("updates sendAlert immutably", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = createAlertDraft({ intent: "LOAD", trade });

    const updated = updateDraftSendAlert(draft, false);

    expect(updated.sendAlert).toBe(false);
    expect(draft.sendAlert).toBe(true); // Original unchanged
  });
});
