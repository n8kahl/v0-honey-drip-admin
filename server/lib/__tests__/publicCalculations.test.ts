/**
 * Public Calculations Tests
 *
 * Critical tests for handling 0 as a valid value in P&L and progress calculations.
 * These tests ensure we don't treat 0 as missing/falsy.
 */

import { describe, it, expect } from "vitest";
import {
  calculatePnlPercent,
  calculateProgressToTarget,
  getTimeElapsed,
  getBestPrice,
  ACTIVE_TRADE_STATES,
  EXITED_TRADE_STATES,
} from "../publicCalculations";

// ============================================================================
// calculatePnlPercent Tests
// ============================================================================

describe("calculatePnlPercent", () => {
  describe("Critical: handles 0 as valid current price", () => {
    it("Case A: entry=100, current=0 → returns -100 (total loss)", () => {
      // This is the BUG we're fixing: 0 should not be treated as missing
      const result = calculatePnlPercent(100, 0);
      expect(result).toBe(-100);
    });

    it("entry=50, current=0 → returns -100", () => {
      const result = calculatePnlPercent(50, 0);
      expect(result).toBe(-100);
    });

    it("entry=1.25, current=0 → returns -100", () => {
      const result = calculatePnlPercent(1.25, 0);
      expect(result).toBe(-100);
    });
  });

  describe("Critical: entry of 0 is invalid (divide by zero)", () => {
    it("Case B: entry=0, current=10 → returns null (can't divide by 0)", () => {
      const result = calculatePnlPercent(0, 10);
      expect(result).toBeNull();
    });

    it("entry=0, current=0 → returns null", () => {
      const result = calculatePnlPercent(0, 0);
      expect(result).toBeNull();
    });
  });

  describe("Null handling", () => {
    it("entry=null, current=50 → returns null", () => {
      expect(calculatePnlPercent(null, 50)).toBeNull();
    });

    it("entry=100, current=null → returns null", () => {
      expect(calculatePnlPercent(100, null)).toBeNull();
    });

    it("entry=null, current=null → returns null", () => {
      expect(calculatePnlPercent(null, null)).toBeNull();
    });

    it("entry=undefined, current=50 → returns null", () => {
      expect(calculatePnlPercent(undefined, 50)).toBeNull();
    });

    it("entry=100, current=undefined → returns null", () => {
      expect(calculatePnlPercent(100, undefined)).toBeNull();
    });
  });

  describe("Standard P&L calculations", () => {
    it("entry=100, current=150 → 50% gain", () => {
      expect(calculatePnlPercent(100, 150)).toBe(50);
    });

    it("entry=100, current=80 → -20% loss", () => {
      expect(calculatePnlPercent(100, 80)).toBe(-20);
    });

    it("entry=100, current=100 → 0% (breakeven)", () => {
      expect(calculatePnlPercent(100, 100)).toBe(0);
    });

    it("entry=5, current=10 → 100% gain", () => {
      expect(calculatePnlPercent(5, 10)).toBe(100);
    });

    it("entry=10, current=5 → -50% loss", () => {
      expect(calculatePnlPercent(10, 5)).toBe(-50);
    });
  });
});

// ============================================================================
// calculateProgressToTarget Tests
// ============================================================================

describe("calculateProgressToTarget", () => {
  describe("Critical: handles 0 as valid current price", () => {
    it("Case C: current=0 behaves deterministically (not null)", () => {
      // entry=100, current=0, target=200 → should calculate, not return null
      const result = calculateProgressToTarget(100, 0, 200);
      // Progress = (0 - 100) / (200 - 100) * 100 = -100%
      // Clamped to 0
      expect(result).toBe(0);
    });

    it("current=0 with target below entry → clamped to 0", () => {
      // entry=100, current=0, target=50 → moving wrong direction
      const result = calculateProgressToTarget(100, 0, 50);
      // Progress = (0 - 100) / (50 - 100) * 100 = 200%
      // Clamped to 100
      expect(result).toBe(100);
    });
  });

  describe("Entry of 0 is invalid", () => {
    it("entry=0 returns null", () => {
      expect(calculateProgressToTarget(0, 50, 100)).toBeNull();
    });
  });

  describe("Null handling", () => {
    it("entry=null → null", () => {
      expect(calculateProgressToTarget(null, 50, 100)).toBeNull();
    });

    it("current=null → null", () => {
      expect(calculateProgressToTarget(100, null, 200)).toBeNull();
    });

    it("target=null → null", () => {
      expect(calculateProgressToTarget(100, 150, null)).toBeNull();
    });
  });

  describe("Edge case: target equals entry", () => {
    it("current >= target → 100", () => {
      expect(calculateProgressToTarget(100, 100, 100)).toBe(100);
      expect(calculateProgressToTarget(100, 150, 100)).toBe(100);
    });

    it("current < target → 0", () => {
      expect(calculateProgressToTarget(100, 50, 100)).toBe(0);
    });
  });

  describe("Standard progress calculations", () => {
    it("halfway to target → 50%", () => {
      // entry=100, current=150, target=200
      const result = calculateProgressToTarget(100, 150, 200);
      expect(result).toBe(50);
    });

    it("at target → 100%", () => {
      const result = calculateProgressToTarget(100, 200, 200);
      expect(result).toBe(100);
    });

    it("beyond target → clamped to 100%", () => {
      const result = calculateProgressToTarget(100, 250, 200);
      expect(result).toBe(100);
    });

    it("below entry → clamped to 0%", () => {
      const result = calculateProgressToTarget(100, 50, 200);
      expect(result).toBe(0);
    });
  });
});

// ============================================================================
// getTimeElapsed Tests
// ============================================================================

describe("getTimeElapsed", () => {
  describe("Case D: uses injected nowMs for stable output", () => {
    it("10 minutes ago", () => {
      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
      const result = getTimeElapsed(tenMinutesAgo, now);
      expect(result).toBe("10m");
    });

    it("2 hours and 30 minutes ago", () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - (2 * 60 + 30) * 60 * 1000).toISOString();
      const result = getTimeElapsed(twoHoursAgo, now);
      expect(result).toBe("2h 30m");
    });

    it("3 days ago", () => {
      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = getTimeElapsed(threeDaysAgo, now);
      expect(result).toBe("3d");
    });
  });

  describe("Null handling", () => {
    it("null timestamp → null", () => {
      expect(getTimeElapsed(null)).toBeNull();
    });

    it("undefined timestamp → null", () => {
      expect(getTimeElapsed(undefined)).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("0 minutes ago", () => {
      const now = Date.now();
      const justNow = new Date(now).toISOString();
      const result = getTimeElapsed(justNow, now);
      expect(result).toBe("0m");
    });

    it("future timestamp → 0m", () => {
      const now = Date.now();
      const future = new Date(now + 60 * 60 * 1000).toISOString();
      const result = getTimeElapsed(future, now);
      expect(result).toBe("0m");
    });
  });
});

// ============================================================================
// getBestPrice Tests
// ============================================================================

describe("getBestPrice", () => {
  describe("Critical: preserves 0 as valid price", () => {
    it("primary=0, fallback=100 → returns 0 (not 100)", () => {
      // This is the BUG we're fixing: 0 should not trigger fallback
      const result = getBestPrice(0, 100);
      expect(result).toBe(0);
    });

    it("primary=0, fallback=null → returns 0", () => {
      const result = getBestPrice(0, null);
      expect(result).toBe(0);
    });
  });

  describe("Null handling with fallback", () => {
    it("primary=null, fallback=100 → returns 100", () => {
      expect(getBestPrice(null, 100)).toBe(100);
    });

    it("primary=undefined, fallback=50 → returns 50", () => {
      expect(getBestPrice(undefined, 50)).toBe(50);
    });

    it("primary=null, fallback=null → returns null", () => {
      expect(getBestPrice(null, null)).toBeNull();
    });

    it("primary=undefined, fallback=undefined → returns null", () => {
      expect(getBestPrice(undefined, undefined)).toBeNull();
    });
  });

  describe("Standard price selection", () => {
    it("primary=100, fallback=50 → returns 100", () => {
      expect(getBestPrice(100, 50)).toBe(100);
    });

    it("primary=100, fallback=null → returns 100", () => {
      expect(getBestPrice(100, null)).toBe(100);
    });
  });
});

// ============================================================================
// State Constants Tests
// ============================================================================

describe("State filter constants", () => {
  describe("ACTIVE_TRADE_STATES", () => {
    it("includes uppercase LOADED and ENTERED", () => {
      expect(ACTIVE_TRADE_STATES).toContain("LOADED");
      expect(ACTIVE_TRADE_STATES).toContain("ENTERED");
    });

    it("includes lowercase loaded and entered", () => {
      expect(ACTIVE_TRADE_STATES).toContain("loaded");
      expect(ACTIVE_TRADE_STATES).toContain("entered");
    });

    it("has exactly 4 entries", () => {
      expect(ACTIVE_TRADE_STATES).toHaveLength(4);
    });
  });

  describe("EXITED_TRADE_STATES", () => {
    it("includes uppercase EXITED", () => {
      expect(EXITED_TRADE_STATES).toContain("EXITED");
    });

    it("includes lowercase exited", () => {
      expect(EXITED_TRADE_STATES).toContain("exited");
    });

    it("has exactly 2 entries", () => {
      expect(EXITED_TRADE_STATES).toHaveLength(2);
    });
  });
});
