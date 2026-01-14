/**
 * Signal Outcome Worker Tests
 *
 * Tests for bar-walk exit resolution and R-multiple calculation
 */

import { describe, it, expect } from "vitest";
import { resolveExitFromBars, type SignalPrices, type ExitResult } from "../signalOutcomeWorker.js";
import type { RawBar } from "../lib/barProvider.js";

// Helper to create bars
function makeBar(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number
): RawBar {
  return { t: timestamp, o: open, h: high, l: low, c: close, v: 1000 };
}

describe("resolveExitFromBars", () => {
  describe("LONG positions", () => {
    const longPrices: SignalPrices = {
      entryPrice: 100,
      stopPrice: 95, // Stop at 95 (5% below entry)
      targetT1: 105, // T1 at 105 (5% above entry)
      targetT2: 110, // T2 at 110 (10% above entry)
      targetT3: 115, // T3 at 115 (15% above entry)
      direction: "LONG",
    };

    const startTime = new Date("2025-01-01T09:30:00Z").getTime();
    const endTime = new Date("2025-01-01T16:00:00Z").getTime();

    it("should detect STOP hit when low <= stopPrice", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 101, 99, 100), // Bar 1: No trigger
        makeBar(startTime + 120000, 100, 100, 94, 97), // Bar 2: Low of 94 hits stop
        makeBar(startTime + 180000, 97, 102, 96, 101), // Bar 3: Would have hit T1
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("STOPPED");
      expect(result.exitReason).toBe("STOP");
      expect(result.exitPrice).toBe(95);
      expect(result.realizedPnl).toBe(-1); // -1R (lost full risk)
    });

    it("should detect T1 hit when high >= targetT1", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 102, 99, 101), // Bar 1: No trigger
        makeBar(startTime + 120000, 101, 106, 100, 105), // Bar 2: High of 106 hits T1
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T1");
      expect(result.exitPrice).toBe(105);
      expect(result.realizedPnl).toBe(1); // +1R
    });

    it("should detect T2 hit when high >= targetT2", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 104, 99, 103), // Bar 1: Just under T1
        makeBar(startTime + 120000, 103, 111, 102, 110), // Bar 2: High of 111 hits T2
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T2");
      expect(result.exitPrice).toBe(110);
      expect(result.realizedPnl).toBe(2); // +2R
    });

    it("should detect T3 hit when high >= targetT3", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 104, 99, 103), // Bar 1
        makeBar(startTime + 120000, 103, 116, 102, 115), // Bar 2: High of 116 hits T3
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T3");
      expect(result.exitPrice).toBe(115);
      expect(result.realizedPnl).toBe(3); // +3R
    });

    it("should prefer T3 over T2 over T1 when multiple hit in same bar", () => {
      const bars: RawBar[] = [
        // Single bar hits all targets
        makeBar(startTime + 60000, 100, 120, 99, 115), // High of 120 hits all targets
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T3");
      expect(result.exitPrice).toBe(115);
    });

    it("should check stop before target (conservative)", () => {
      const bars: RawBar[] = [
        // Bar that hits both stop and target
        makeBar(startTime + 60000, 100, 106, 94, 105), // Low 94 hits stop, High 106 hits T1
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      // Stop checked first
      expect(result.status).toBe("STOPPED");
      expect(result.exitReason).toBe("STOP");
    });

    it("should return EXPIRED when no exit triggered", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 103, 97, 101), // No triggers
        makeBar(startTime + 120000, 101, 104, 96, 102), // No triggers
        makeBar(startTime + 180000, 102, 103, 98, 100), // No triggers
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("EXPIRED");
      expect(result.exitReason).toBe("EXPIRED");
      expect(result.exitPrice).toBe(100); // Last bar close
    });

    it("should return EXPIRED when no bars in range", () => {
      const bars: RawBar[] = [];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.status).toBe("EXPIRED");
      expect(result.exitReason).toBe("EXPIRED");
      expect(result.realizedPnl).toBe(0);
    });

    it("should track MFE (max favorable excursion) correctly", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 108, 99, 107), // High of 108 (MFE = 8 before T1 hit)
        makeBar(startTime + 120000, 107, 112, 106, 111), // High of 112 hits T2, but T1 already hit in bar 1
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      // T1 hit at bar 1 (high 108 >= 105)
      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T1");
      expect(result.maxFavorableExcursion).toBe(8); // 108 - 100 = 8 (at point of exit)
    });

    it("should track MAE (max adverse excursion) correctly", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 102, 97, 101), // Low of 97 (MAE = 3)
        makeBar(startTime + 120000, 101, 110, 99, 109), // T1 hit
      ];

      const result = resolveExitFromBars(bars, longPrices, startTime, endTime);

      expect(result.maxAdverseExcursion).toBe(3); // 100 - 97 = 3
    });
  });

  describe("SHORT positions", () => {
    const shortPrices: SignalPrices = {
      entryPrice: 100,
      stopPrice: 105, // Stop at 105 (5% above entry)
      targetT1: 95, // T1 at 95 (5% below entry)
      targetT2: 90, // T2 at 90 (10% below entry)
      targetT3: 85, // T3 at 85 (15% below entry)
      direction: "SHORT",
    };

    const startTime = new Date("2025-01-01T09:30:00Z").getTime();
    const endTime = new Date("2025-01-01T16:00:00Z").getTime();

    it("should detect STOP hit when high >= stopPrice for shorts", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 103, 98, 99), // No trigger
        makeBar(startTime + 120000, 99, 106, 97, 100), // High of 106 hits stop
      ];

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      expect(result.status).toBe("STOPPED");
      expect(result.exitReason).toBe("STOP");
      expect(result.exitPrice).toBe(105);
      expect(result.realizedPnl).toBe(-1); // -1R
    });

    it("should detect T1 hit when low <= targetT1 for shorts", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 102, 96, 97), // No trigger
        makeBar(startTime + 120000, 97, 98, 94, 95), // Low of 94 hits T1
      ];

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T1");
      expect(result.exitPrice).toBe(95);
      expect(result.realizedPnl).toBe(1); // +1R
    });

    it("should detect T3 hit when low <= targetT3 for shorts", () => {
      // For SHORT: T1=95, T2=90, T3=85
      // To hit T3, we need a bar that drops to 85 or below without first hitting T2 (90)
      // Since we check T3 first in same bar, a single bar hitting all targets exits at T3
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 101, 84, 85), // Low of 84 hits T3 directly (also hits T1, T2 but T3 checked first)
      ];

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T3");
      expect(result.exitPrice).toBe(85);
      expect(result.realizedPnl).toBe(3); // +3R
    });

    it("should check stop before target for shorts (conservative)", () => {
      const bars: RawBar[] = [
        // Bar that hits both stop and target
        makeBar(startTime + 60000, 100, 106, 94, 98), // High 106 hits stop, Low 94 hits T1
      ];

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      // Stop checked first
      expect(result.status).toBe("STOPPED");
      expect(result.exitReason).toBe("STOP");
    });

    it("should track MFE correctly for shorts (price moving down)", () => {
      // For SHORT: T1=95, T2=90, T3=85
      // To properly track MFE across bars, bars must not hit T1 until the final bar
      // Bar 1 low must be > 95 to avoid hitting T1
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 101, 96, 97), // Low of 96 (doesn't hit T1, MFE = 4)
        makeBar(startTime + 120000, 97, 98, 88, 89), // Low of 88 hits T2 (MFE = 12 at exit)
      ];

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      // T2 hit at bar 2
      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T2");
      expect(result.maxFavorableExcursion).toBe(12); // 100 - 88 = 12
    });

    it("should track MAE correctly for shorts (price moving up)", () => {
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 104, 98, 99), // High of 104 (MAE = 4)
        makeBar(startTime + 120000, 99, 100, 94, 95), // T1 hit
      ];

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      expect(result.maxAdverseExcursion).toBe(4); // 104 - 100 = 4
    });
  });

  describe("R-multiple calculation", () => {
    const prices: SignalPrices = {
      entryPrice: 100,
      stopPrice: 95, // Risk = $5
      targetT1: 105,
      targetT2: 110,
      targetT3: 115,
      direction: "LONG",
    };

    const startTime = new Date("2025-01-01T09:30:00Z").getTime();
    const endTime = new Date("2025-01-01T16:00:00Z").getTime();

    it("should calculate -1R for stop loss hit", () => {
      const bars: RawBar[] = [makeBar(startTime + 60000, 100, 101, 94, 96)];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.realizedPnl).toBe(-1);
      expect(result.realizedPnlPct).toBe(-5); // -5%
    });

    it("should calculate +1R for T1 hit", () => {
      const bars: RawBar[] = [makeBar(startTime + 60000, 100, 106, 98, 105)];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.realizedPnl).toBe(1);
      expect(result.realizedPnlPct).toBe(5); // +5%
    });

    it("should calculate +2R for T2 hit", () => {
      const bars: RawBar[] = [makeBar(startTime + 60000, 100, 111, 98, 110)];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.realizedPnl).toBe(2);
      expect(result.realizedPnlPct).toBe(10); // +10%
    });

    it("should calculate +3R for T3 hit", () => {
      const bars: RawBar[] = [makeBar(startTime + 60000, 100, 116, 98, 115)];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.realizedPnl).toBe(3);
      expect(result.realizedPnlPct).toBe(15); // +15%
    });

    it("should handle fractional R-multiples for expired positions", () => {
      // Exit at last bar close of 102 (halfway to T1)
      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 103, 97, 101),
        makeBar(startTime + 120000, 101, 104, 96, 102), // Close at 102
      ];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.status).toBe("EXPIRED");
      expect(result.exitPrice).toBe(102);
      expect(result.realizedPnl).toBe(0.4); // 2/5 = 0.4R
      expect(result.realizedPnlPct).toBe(2); // +2%
    });

    it("should calculate correct R-multiple for SHORT positions", () => {
      const shortPrices: SignalPrices = {
        entryPrice: 100,
        stopPrice: 105, // Risk = $5
        targetT1: 95,
        targetT2: 90,
        targetT3: 85,
        direction: "SHORT",
      };

      const bars: RawBar[] = [makeBar(startTime + 60000, 100, 101, 94, 95)]; // T1 hit

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      expect(result.realizedPnl).toBe(1); // +1R (profit for short)
      expect(result.realizedPnlPct).toBe(5); // +5%
    });

    it("should calculate negative R-multiple for SHORT stop loss", () => {
      const shortPrices: SignalPrices = {
        entryPrice: 100,
        stopPrice: 105,
        targetT1: 95,
        targetT2: 90,
        targetT3: 85,
        direction: "SHORT",
      };

      const bars: RawBar[] = [makeBar(startTime + 60000, 100, 106, 99, 104)]; // Stop hit

      const result = resolveExitFromBars(bars, shortPrices, startTime, endTime);

      expect(result.realizedPnl).toBe(-1); // -1R (loss for short)
      expect(result.realizedPnlPct).toBe(-5); // -5%
    });
  });

  describe("Hold time calculation", () => {
    const prices: SignalPrices = {
      entryPrice: 100,
      stopPrice: 95,
      targetT1: 105,
      targetT2: 110,
      targetT3: 115,
      direction: "LONG",
    };

    it("should calculate hold time correctly", () => {
      const startTime = new Date("2025-01-01T09:30:00Z").getTime();
      const endTime = new Date("2025-01-01T16:00:00Z").getTime();

      // Exit 30 minutes after start
      const exitBar = makeBar(startTime + 30 * 60000, 100, 106, 99, 105);
      const bars: RawBar[] = [exitBar];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.holdTimeMinutes).toBe(30);
    });

    it("should handle expired signals with full duration", () => {
      const startTime = new Date("2025-01-01T09:30:00Z").getTime();
      const endTime = new Date("2025-01-01T10:30:00Z").getTime(); // 60 minute window

      const bars: RawBar[] = [
        makeBar(startTime + 30 * 60000, 100, 103, 97, 101),
        makeBar(startTime + 50 * 60000, 101, 104, 96, 102),
      ];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.status).toBe("EXPIRED");
      expect(result.holdTimeMinutes).toBe(60); // Full 60 minute duration
    });
  });

  describe("Bar filtering", () => {
    const prices: SignalPrices = {
      entryPrice: 100,
      stopPrice: 95,
      targetT1: 105,
      targetT2: 110,
      targetT3: 115,
      direction: "LONG",
    };

    it("should ignore bars before startTime", () => {
      const startTime = new Date("2025-01-01T09:30:00Z").getTime();
      const endTime = new Date("2025-01-01T16:00:00Z").getTime();

      const bars: RawBar[] = [
        makeBar(startTime - 60000, 100, 94, 93, 94), // Before start - would hit stop
        makeBar(startTime + 60000, 100, 106, 99, 105), // After start - T1 hit
      ];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      // Should ignore first bar and find T1 hit
      expect(result.status).toBe("TARGET_HIT");
      expect(result.exitReason).toBe("T1");
    });

    it("should ignore bars after endTime", () => {
      const startTime = new Date("2025-01-01T09:30:00Z").getTime();
      const endTime = new Date("2025-01-01T10:00:00Z").getTime();

      const bars: RawBar[] = [
        makeBar(startTime + 60000, 100, 103, 97, 101), // No trigger
        makeBar(endTime + 60000, 101, 120, 100, 115), // After end - would hit T3
      ];

      const result = resolveExitFromBars(bars, prices, startTime, endTime);

      expect(result.status).toBe("EXPIRED");
    });
  });
});
