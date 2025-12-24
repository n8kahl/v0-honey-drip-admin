/**
 * Trade Actions Domain Tests
 *
 * Tests for the canonical orchestration layer.
 * Verifies transition validation, intent mapping, and action flow.
 */

import { describe, it, expect } from "vitest";
import {
  validateTransition,
  getTargetState,
  getTransitionError,
  intentToAlertType,
  intentToUpdateKind,
  intentToUpdateType,
  startTradeAction,
  TRANSITION_RULES,
  type TradeActionIntent,
} from "../tradeActions";
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
// Transition Validation Tests
// ============================================================================

describe("validateTransition", () => {
  describe("LOAD intent", () => {
    it("allows WATCHING → LOADED", () => {
      expect(validateTransition("WATCHING", "LOAD")).toBe(true);
    });

    it("rejects LOADED → LOADED (already loaded)", () => {
      expect(validateTransition("LOADED", "LOAD")).toBe(false);
    });

    it("rejects ENTERED → LOADED (can't go back)", () => {
      expect(validateTransition("ENTERED", "LOAD")).toBe(false);
    });

    it("rejects EXITED → LOADED (can't go back)", () => {
      expect(validateTransition("EXITED", "LOAD")).toBe(false);
    });
  });

  describe("ENTER intent", () => {
    it("allows WATCHING → ENTERED (skip load)", () => {
      expect(validateTransition("WATCHING", "ENTER")).toBe(true);
    });

    it("allows LOADED → ENTERED", () => {
      expect(validateTransition("LOADED", "ENTER")).toBe(true);
    });

    it("rejects ENTERED → ENTERED (already entered)", () => {
      expect(validateTransition("ENTERED", "ENTER")).toBe(false);
    });

    it("rejects EXITED → ENTERED (can't re-enter)", () => {
      expect(validateTransition("EXITED", "ENTER")).toBe(false);
    });
  });

  describe("UPDATE_SL intent", () => {
    it("allows ENTERED → ENTERED (update in progress)", () => {
      expect(validateTransition("ENTERED", "UPDATE_SL")).toBe(true);
    });

    it("rejects LOADED → update (not in position)", () => {
      expect(validateTransition("LOADED", "UPDATE_SL")).toBe(false);
    });

    it("rejects EXITED → update (position closed)", () => {
      expect(validateTransition("EXITED", "UPDATE_SL")).toBe(false);
    });
  });

  describe("TRIM intent", () => {
    it("allows ENTERED → ENTERED", () => {
      expect(validateTransition("ENTERED", "TRIM")).toBe(true);
    });

    it("rejects non-ENTERED states", () => {
      expect(validateTransition("WATCHING", "TRIM")).toBe(false);
      expect(validateTransition("LOADED", "TRIM")).toBe(false);
      expect(validateTransition("EXITED", "TRIM")).toBe(false);
    });
  });

  describe("EXIT intent", () => {
    it("allows ENTERED → EXITED", () => {
      expect(validateTransition("ENTERED", "EXIT")).toBe(true);
    });

    it("rejects LOADED → EXITED (must enter first)", () => {
      expect(validateTransition("LOADED", "EXIT")).toBe(false);
    });

    it("rejects EXITED → EXITED (already exited)", () => {
      expect(validateTransition("EXITED", "EXIT")).toBe(false);
    });
  });

  describe("UNLOAD intent", () => {
    it("allows LOADED → delete", () => {
      expect(validateTransition("LOADED", "UNLOAD")).toBe(true);
    });

    it("rejects WATCHING → delete (not persisted yet)", () => {
      expect(validateTransition("WATCHING", "UNLOAD")).toBe(false);
    });

    it("rejects ENTERED → delete (must exit first)", () => {
      expect(validateTransition("ENTERED", "UNLOAD")).toBe(false);
    });
  });

  describe("SHARE_EXIT intent", () => {
    it("allows EXITED → EXITED (share recap)", () => {
      expect(validateTransition("EXITED", "SHARE_EXIT")).toBe(true);
    });

    it("rejects non-EXITED states", () => {
      expect(validateTransition("WATCHING", "SHARE_EXIT")).toBe(false);
      expect(validateTransition("LOADED", "SHARE_EXIT")).toBe(false);
      expect(validateTransition("ENTERED", "SHARE_EXIT")).toBe(false);
    });
  });
});

// ============================================================================
// Transition Matrix Table-Driven Tests
// ============================================================================

describe("Transition Matrix (table-driven)", () => {
  // Define all expected transitions as a table
  const transitionTable: {
    intent: TradeActionIntent;
    validFrom: TradeState[];
    invalidFrom: TradeState[];
    targetState: TradeState | null;
  }[] = [
    {
      intent: "LOAD",
      validFrom: ["WATCHING"],
      invalidFrom: ["LOADED", "ENTERED", "EXITED"],
      targetState: "LOADED",
    },
    {
      intent: "ENTER",
      validFrom: ["WATCHING", "LOADED"],
      invalidFrom: ["ENTERED", "EXITED"],
      targetState: "ENTERED",
    },
    {
      intent: "UPDATE_SL",
      validFrom: ["ENTERED"],
      invalidFrom: ["WATCHING", "LOADED", "EXITED"],
      targetState: "ENTERED",
    },
    {
      intent: "TRIM",
      validFrom: ["ENTERED"],
      invalidFrom: ["WATCHING", "LOADED", "EXITED"],
      targetState: "ENTERED",
    },
    {
      intent: "ADD",
      validFrom: ["ENTERED"],
      invalidFrom: ["WATCHING", "LOADED", "EXITED"],
      targetState: "ENTERED",
    },
    {
      intent: "TRAIL_STOP",
      validFrom: ["ENTERED"],
      invalidFrom: ["WATCHING", "LOADED", "EXITED"],
      targetState: "ENTERED",
    },
    {
      intent: "EXIT",
      validFrom: ["ENTERED"],
      invalidFrom: ["WATCHING", "LOADED", "EXITED"],
      targetState: "EXITED",
    },
    {
      intent: "UNLOAD",
      validFrom: ["LOADED"],
      invalidFrom: ["WATCHING", "ENTERED", "EXITED"],
      targetState: null,
    },
    {
      intent: "SHARE_EXIT",
      validFrom: ["EXITED"],
      invalidFrom: ["WATCHING", "LOADED", "ENTERED"],
      targetState: "EXITED",
    },
  ];

  transitionTable.forEach(({ intent, validFrom, invalidFrom, targetState }) => {
    describe(`${intent}`, () => {
      validFrom.forEach((state) => {
        it(`allows ${state} → ${intent}`, () => {
          expect(validateTransition(state, intent)).toBe(true);
        });
      });

      invalidFrom.forEach((state) => {
        it(`rejects ${state} → ${intent}`, () => {
          expect(validateTransition(state, intent)).toBe(false);
        });
      });

      it(`has target state: ${targetState}`, () => {
        expect(getTargetState(intent)).toBe(targetState);
      });
    });
  });
});

// ============================================================================
// getTargetState Tests
// ============================================================================

describe("getTargetState", () => {
  it("returns LOADED for LOAD", () => {
    expect(getTargetState("LOAD")).toBe("LOADED");
  });

  it("returns ENTERED for ENTER", () => {
    expect(getTargetState("ENTER")).toBe("ENTERED");
  });

  it("returns EXITED for EXIT", () => {
    expect(getTargetState("EXIT")).toBe("EXITED");
  });

  it("returns null for UNLOAD (delete)", () => {
    expect(getTargetState("UNLOAD")).toBeNull();
  });

  it("returns same state for in-position updates", () => {
    expect(getTargetState("UPDATE_SL")).toBe("ENTERED");
    expect(getTargetState("TRIM")).toBe("ENTERED");
    expect(getTargetState("ADD")).toBe("ENTERED");
    expect(getTargetState("TRAIL_STOP")).toBe("ENTERED");
  });
});

// ============================================================================
// getTransitionError Tests
// ============================================================================

describe("getTransitionError", () => {
  it("returns descriptive error for invalid transition", () => {
    const error = getTransitionError("EXITED", "ENTER");
    expect(error).toContain("Cannot ENTER from EXITED");
    expect(error).toContain("Allowed from:");
  });

  it("includes allowed states in error message", () => {
    const error = getTransitionError("WATCHING", "EXIT");
    expect(error).toContain("ENTERED");
  });
});

// ============================================================================
// Intent Mapping Tests
// ============================================================================

describe("intentToAlertType", () => {
  it("maps LOAD to load", () => {
    expect(intentToAlertType("LOAD")).toBe("load");
  });

  it("maps ENTER to enter", () => {
    expect(intentToAlertType("ENTER")).toBe("enter");
  });

  it("maps UPDATE_SL to update", () => {
    expect(intentToAlertType("UPDATE_SL")).toBe("update");
  });

  it("maps TRIM to update", () => {
    expect(intentToAlertType("TRIM")).toBe("update");
  });

  it("maps EXIT to exit", () => {
    expect(intentToAlertType("EXIT")).toBe("exit");
  });

  it("maps ADD to add", () => {
    expect(intentToAlertType("ADD")).toBe("add");
  });

  it("maps TRAIL_STOP to trail-stop", () => {
    expect(intentToAlertType("TRAIL_STOP")).toBe("trail-stop");
  });
});

describe("intentToUpdateKind", () => {
  it("maps TRIM to trim", () => {
    expect(intentToUpdateKind("TRIM")).toBe("trim");
  });

  it("maps UPDATE_SL to sl", () => {
    expect(intentToUpdateKind("UPDATE_SL")).toBe("sl");
  });

  it("returns undefined for non-update intents", () => {
    expect(intentToUpdateKind("LOAD")).toBeUndefined();
    expect(intentToUpdateKind("ENTER")).toBeUndefined();
    expect(intentToUpdateKind("EXIT")).toBeUndefined();
  });
});

describe("intentToUpdateType", () => {
  it("maps to correct TradeUpdate types", () => {
    expect(intentToUpdateType("ENTER")).toBe("enter");
    expect(intentToUpdateType("UPDATE_SL")).toBe("update-sl");
    expect(intentToUpdateType("TRIM")).toBe("trim");
    expect(intentToUpdateType("ADD")).toBe("add");
    expect(intentToUpdateType("TRAIL_STOP")).toBe("trail-stop");
    expect(intentToUpdateType("EXIT")).toBe("exit");
  });

  it("returns null for intents without audit trail", () => {
    expect(intentToUpdateType("LOAD")).toBeNull();
    expect(intentToUpdateType("UNLOAD")).toBeNull();
  });
});

// ============================================================================
// startTradeAction Tests
// ============================================================================

describe("startTradeAction", () => {
  it("returns AlertDraft for valid transition", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = startTradeAction("LOAD", { trade });

    expect(draft).not.toBeNull();
    expect(draft?.intent).toBe("LOAD");
    expect(draft?.trade.id).toBe("id-1");
  });

  it("returns null for invalid transition", () => {
    const trade = createMockTrade("id-1", "EXITED", "SPY");
    const draft = startTradeAction("ENTER", { trade });

    expect(draft).toBeNull();
  });

  it("includes editable prices with defaults", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = startTradeAction("LOAD", { trade });

    expect(draft?.editablePrices.target).toBeDefined();
    expect(draft?.editablePrices.stop).toBeDefined();
    expect(draft?.editablePrices.current).toBeDefined();
  });

  it("includes field toggles based on intent", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const loadDraft = startTradeAction("LOAD", { trade });

    expect(loadDraft?.fieldToggles.showTarget).toBe(true);
    expect(loadDraft?.fieldToggles.showStop).toBe(true);
    expect(loadDraft?.fieldToggles.showEntry).toBe(false); // Not shown for LOAD
  });

  it("initializes empty channels and challenges", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = startTradeAction("LOAD", { trade });

    expect(draft?.channels).toEqual([]);
    expect(draft?.challenges).toEqual([]);
  });

  it("preserves existing trade channels and challenges", () => {
    const trade = createMockTrade("id-1", "LOADED", "SPY", {
      discordChannels: ["channel-1"],
      challenges: ["challenge-1"],
    });
    const draft = startTradeAction("ENTER", { trade });

    expect(draft?.channels).toEqual(["channel-1"]);
    expect(draft?.challenges).toEqual(["challenge-1"]);
  });

  it("sets sendAlert to true by default", () => {
    const trade = createMockTrade("id-1", "WATCHING", "SPY");
    const draft = startTradeAction("LOAD", { trade });

    expect(draft?.sendAlert).toBe(true);
  });
});

// ============================================================================
// TRANSITION_RULES Tests
// ============================================================================

describe("TRANSITION_RULES", () => {
  it("covers all TradeActionIntent values", () => {
    const expectedIntents: TradeActionIntent[] = [
      "LOAD",
      "ENTER",
      "UPDATE_SL",
      "TRIM",
      "ADD",
      "TRAIL_STOP",
      "EXIT",
      "UNLOAD",
      "SHARE_EXIT",
    ];

    expectedIntents.forEach((intent) => {
      expect(TRANSITION_RULES[intent]).toBeDefined();
    });
  });

  it("each rule has valid from states and to state", () => {
    Object.entries(TRANSITION_RULES).forEach(([intent, rule]) => {
      expect(Array.isArray(rule.from)).toBe(true);
      expect(rule.from.length).toBeGreaterThan(0);
      // to can be null (for UNLOAD) or a valid state
      expect(
        rule.to === null || ["WATCHING", "LOADED", "ENTERED", "EXITED"].includes(rule.to!)
      ).toBe(true);
    });
  });
});
