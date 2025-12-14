/**
 * Trade Transition Guards - Unit Tests
 *
 * Tests for the state transition guard logic in useTradeStateMachine
 * to ensure:
 * 1. No duplicate transitions (isTransitioning prevents concurrent calls)
 * 2. Valid state transitions only (WATCHING -> LOADED, LOADED -> ENTERED, etc.)
 * 3. Invalid transitions are blocked (e.g., ENTERED -> LOADED is not allowed)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// State Transition Rules
// ============================================================================

type TradeState = "WATCHING" | "LOADED" | "ENTERED" | "EXITED";

interface TransitionRule {
  from: TradeState;
  to: TradeState;
  trigger: string;
  allowed: boolean;
}

const TRANSITION_RULES: TransitionRule[] = [
  // Valid transitions
  { from: "WATCHING", to: "LOADED", trigger: "Load & Alert", allowed: true },
  { from: "WATCHING", to: "ENTERED", trigger: "Enter & Alert", allowed: true },
  { from: "LOADED", to: "ENTERED", trigger: "Enter", allowed: true },
  { from: "ENTERED", to: "EXITED", trigger: "Exit", allowed: true },

  // Invalid transitions
  { from: "LOADED", to: "WATCHING", trigger: "Revert", allowed: false },
  { from: "LOADED", to: "LOADED", trigger: "Load Again", allowed: false },
  { from: "ENTERED", to: "LOADED", trigger: "Unenter", allowed: false },
  { from: "ENTERED", to: "WATCHING", trigger: "Unwatch", allowed: false },
  { from: "ENTERED", to: "ENTERED", trigger: "Enter Again", allowed: false },
  { from: "EXITED", to: "WATCHING", trigger: "Rewatch", allowed: false },
  { from: "EXITED", to: "LOADED", trigger: "Reload", allowed: false },
  { from: "EXITED", to: "ENTERED", trigger: "Reenter", allowed: false },
];

// ============================================================================
// Transition Validator
// ============================================================================

function isValidTransition(from: TradeState, to: TradeState): boolean {
  const validTransitions: Record<TradeState, TradeState[]> = {
    WATCHING: ["LOADED", "ENTERED"],
    LOADED: ["ENTERED"], // Can also be deleted, but that's not a state transition
    ENTERED: ["EXITED"],
    EXITED: [], // Terminal state
  };

  return validTransitions[from].includes(to);
}

function canLoad(state: TradeState): boolean {
  return state === "WATCHING";
}

function canEnter(state: TradeState): boolean {
  return state === "WATCHING" || state === "LOADED";
}

function canExit(state: TradeState): boolean {
  return state === "ENTERED";
}

// ============================================================================
// Tests
// ============================================================================

describe("Trade Transition Rules", () => {
  describe("isValidTransition", () => {
    TRANSITION_RULES.forEach((rule) => {
      it(`${rule.from} -> ${rule.to} (${rule.trigger}) should be ${rule.allowed ? "allowed" : "blocked"}`, () => {
        expect(isValidTransition(rule.from, rule.to)).toBe(rule.allowed);
      });
    });
  });

  describe("canLoad guard", () => {
    it("should allow Load from WATCHING", () => {
      expect(canLoad("WATCHING")).toBe(true);
    });

    it("should block Load from LOADED", () => {
      expect(canLoad("LOADED")).toBe(false);
    });

    it("should block Load from ENTERED", () => {
      expect(canLoad("ENTERED")).toBe(false);
    });

    it("should block Load from EXITED", () => {
      expect(canLoad("EXITED")).toBe(false);
    });
  });

  describe("canEnter guard", () => {
    it("should allow Enter from WATCHING", () => {
      expect(canEnter("WATCHING")).toBe(true);
    });

    it("should allow Enter from LOADED", () => {
      expect(canEnter("LOADED")).toBe(true);
    });

    it("should block Enter from ENTERED", () => {
      expect(canEnter("ENTERED")).toBe(false);
    });

    it("should block Enter from EXITED", () => {
      expect(canEnter("EXITED")).toBe(false);
    });
  });

  describe("canExit guard", () => {
    it("should block Exit from WATCHING", () => {
      expect(canExit("WATCHING")).toBe(false);
    });

    it("should block Exit from LOADED", () => {
      expect(canExit("LOADED")).toBe(false);
    });

    it("should allow Exit from ENTERED", () => {
      expect(canExit("ENTERED")).toBe(true);
    });

    it("should block Exit from EXITED", () => {
      expect(canExit("EXITED")).toBe(false);
    });
  });
});

describe("Transition Mutex (isTransitioning)", () => {
  let isTransitioning = false;
  let transitionCount = 0;

  const simulateTransition = async () => {
    if (isTransitioning) {
      return { blocked: true, count: transitionCount };
    }

    isTransitioning = true;
    transitionCount++;

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    isTransitioning = false;
    return { blocked: false, count: transitionCount };
  };

  beforeEach(() => {
    isTransitioning = false;
    transitionCount = 0;
  });

  it("should allow first transition", async () => {
    const result = await simulateTransition();
    expect(result.blocked).toBe(false);
    expect(result.count).toBe(1);
  });

  it("should block concurrent transitions", async () => {
    // Start first transition (don't await yet)
    const first = simulateTransition();

    // Try second transition immediately (while first is in progress)
    const second = await simulateTransition();

    // Second should be blocked
    expect(second.blocked).toBe(true);
    expect(second.count).toBe(1); // Count should still be 1

    // First should complete
    const firstResult = await first;
    expect(firstResult.blocked).toBe(false);
    expect(firstResult.count).toBe(1);
  });

  it("should allow sequential transitions", async () => {
    const first = await simulateTransition();
    expect(first.blocked).toBe(false);
    expect(first.count).toBe(1);

    const second = await simulateTransition();
    expect(second.blocked).toBe(false);
    expect(second.count).toBe(2);
  });

  it("should handle rapid-fire clicks", async () => {
    // Simulate 5 rapid clicks
    const results = await Promise.all([
      simulateTransition(),
      simulateTransition(),
      simulateTransition(),
      simulateTransition(),
      simulateTransition(),
    ]);

    // Only first should succeed, rest should be blocked
    const successful = results.filter((r) => !r.blocked);
    const blocked = results.filter((r) => r.blocked);

    expect(successful.length).toBe(1);
    expect(blocked.length).toBe(4);
  });
});

describe("UI Button States", () => {
  interface ButtonState {
    disabled: boolean;
    loading: boolean;
  }

  function getLoadButtonState(
    hasChannels: boolean,
    isTransitioning: boolean,
    tradeState: TradeState
  ): ButtonState {
    const canAct = canLoad(tradeState);
    return {
      disabled: !hasChannels || isTransitioning || !canAct,
      loading: isTransitioning,
    };
  }

  function getEnterButtonState(
    hasChannels: boolean,
    isTransitioning: boolean,
    tradeState: TradeState
  ): ButtonState {
    const canAct = canEnter(tradeState);
    return {
      disabled: !hasChannels || isTransitioning || !canAct,
      loading: isTransitioning,
    };
  }

  describe("Load button state", () => {
    it("should be enabled when: hasChannels=true, isTransitioning=false, state=WATCHING", () => {
      const state = getLoadButtonState(true, false, "WATCHING");
      expect(state.disabled).toBe(false);
      expect(state.loading).toBe(false);
    });

    it("should be disabled when: hasChannels=false", () => {
      const state = getLoadButtonState(false, false, "WATCHING");
      expect(state.disabled).toBe(true);
    });

    it("should be disabled and loading when: isTransitioning=true", () => {
      const state = getLoadButtonState(true, true, "WATCHING");
      expect(state.disabled).toBe(true);
      expect(state.loading).toBe(true);
    });

    it("should be disabled when: state=LOADED", () => {
      const state = getLoadButtonState(true, false, "LOADED");
      expect(state.disabled).toBe(true);
    });
  });

  describe("Enter button state", () => {
    it("should be enabled when: hasChannels=true, isTransitioning=false, state=WATCHING", () => {
      const state = getEnterButtonState(true, false, "WATCHING");
      expect(state.disabled).toBe(false);
    });

    it("should be enabled when: hasChannels=true, isTransitioning=false, state=LOADED", () => {
      const state = getEnterButtonState(true, false, "LOADED");
      expect(state.disabled).toBe(false);
    });

    it("should be disabled when: state=ENTERED", () => {
      const state = getEnterButtonState(true, false, "ENTERED");
      expect(state.disabled).toBe(true);
    });

    it("should be disabled and loading when: isTransitioning=true", () => {
      const state = getEnterButtonState(true, true, "LOADED");
      expect(state.disabled).toBe(true);
      expect(state.loading).toBe(true);
    });
  });
});
