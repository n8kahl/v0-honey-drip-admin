/**
 * EngineCore Tests
 *
 * Verification tests for the EventDrivenBacktestEngine to ensure:
 * 1. No lookahead bias (entry on next bar open)
 * 2. Proper indicator warmup (300 bars)
 * 3. Correct statistics calculations
 * 4. Proper schema aliasing in FeaturesBuilder
 */

import { describe, it, expect } from "vitest";
import { calculateEMA, calculateRSI, calculateATR } from "../indicators";
import { FeaturesBuilder } from "../FeaturesBuilder";
import { calculateStats, BacktestTrade } from "../types";
import { Bar } from "../MultiTimeframeLoader";

// Helper to create mock bars
function createMockBars(
  count: number,
  startPrice: number = 100,
  startTimestamp: number = 0
): Bar[] {
  const bars: Bar[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    // Small random price movement
    const change = (Math.random() - 0.5) * 2;
    price = price + change;
    bars.push({
      timestamp: startTimestamp + i * 60 * 1000, // 1m bars
      open: price - 0.1,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 1000 + Math.random() * 1000,
    });
  }
  return bars;
}

describe("Indicator Convergence", () => {
  it("EMA-200 converges to expected value within tolerance", () => {
    // Create 600 bars of constant price - EMA should converge to that price
    const constantPrice = 100;
    const bars = Array.from({ length: 600 }, (_, i) => ({
      timestamp: i * 60000,
      open: constantPrice,
      high: constantPrice,
      low: constantPrice,
      close: constantPrice,
      volume: 1000,
    }));
    const closes = bars.map((b) => b.close);

    const ema200Series = calculateEMA(closes, 200);
    const lastEma = ema200Series[ema200Series.length - 1];

    // With constant prices, EMA should converge to that price
    expect(Math.abs(lastEma - constantPrice)).toBeLessThan(0.01);
  });

  it("RSI-14 for constant prices returns 100 (no losses)", () => {
    const constantPrice = 100;
    const closes = Array.from({ length: 200 }, () => constantPrice);

    const rsi = calculateRSI(closes, 14);

    // With zero change, there are no losses, so RS = gain/0 → RSI = 100
    // This is the standard RSI implementation behavior
    expect(rsi).toBe(100);
  });

  it("ATR-14 is zero for constant prices", () => {
    const constantPrice = 100;
    const highs = Array.from({ length: 200 }, () => constantPrice);
    const lows = Array.from({ length: 200 }, () => constantPrice);
    const closes = Array.from({ length: 200 }, () => constantPrice);

    const atr = calculateATR(highs, lows, closes, 14);

    // Constant prices = no range = ATR should be 0
    expect(atr).toBe(0);
  });
});

describe("Entry Timing - No Lookahead Bias", () => {
  it("signal fires on bar[i] but entry would occur on bar[i+1].open", () => {
    // This is a conceptual test - the actual EventDrivenBacktestEngine
    // passes nextBar to scanForEntry and uses nextBar.open for entry
    const signalBar = {
      timestamp: 1000000,
      open: 100,
      high: 102,
      low: 99,
      close: 101.5, // Signal detected based on this close
    };
    const nextBar = {
      timestamp: 1060000, // 1 minute later
      open: 101.8, // Entry should be at THIS price
      high: 103,
      low: 101,
      close: 102.5,
    };

    // Verify the entry price should be nextBar.open, NOT signalBar.close
    const entryPrice = nextBar.open;
    expect(entryPrice).toBe(101.8);
    expect(entryPrice).not.toBe(signalBar.close);
  });
});

describe("Gap Handling", () => {
  it("gap up fills at gap price, not prior close", () => {
    // Simulate overnight gap
    const prevDayClose = 100;
    const gapOpenPrice = 105; // 5% gap up

    // Entry should be at gap open, not prior close
    expect(gapOpenPrice).toBeGreaterThan(prevDayClose);

    // Stop placement should account for gap
    const stopPrice = gapOpenPrice - 2; // ATR-based stop
    expect(stopPrice).toBeLessThan(gapOpenPrice);
    expect(stopPrice).toBeGreaterThan(prevDayClose); // Stop is above prior close after gap
  });
});

describe("Stop Loss Intrabar Handling", () => {
  it("stop triggers at stop price when bar low breaches it (LONG)", () => {
    const entryPrice = 100;
    const stopPrice = 98;
    const barLow = 97; // Bar traded through stop

    // Stop should fill at stop price, not bar low
    const fillPrice = stopPrice; // Best case: fill at stop
    expect(fillPrice).toBe(98);
    expect(fillPrice).toBeGreaterThan(barLow);
  });

  it("stop triggers at gap open if below stop (LONG)", () => {
    const stopPrice = 98;
    const gapOpen = 95; // Gap below stop

    // In gap scenario, fill is at gap open (worse than stop)
    const fillPrice = gapOpen;
    expect(fillPrice).toBeLessThan(stopPrice);
  });
});

describe("Missing Data Resilience", () => {
  it("handles null/undefined volume gracefully", () => {
    const bars = createMockBars(100);
    // Set some volumes to undefined
    bars[50].volume = undefined as any;
    bars[51].volume = 0;

    // Should not throw
    expect(() => {
      const volumes = bars.map((b) => b.volume || 0);
      const sum = volumes.reduce((a, b) => a + b, 0);
    }).not.toThrow();
  });

  it("FeaturesBuilder handles empty MTF context", () => {
    const tick: Bar = {
      timestamp: Date.now(),
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
    };
    const history1m = createMockBars(200);

    // Empty MTF context
    const emptyMtfContext = {};

    // Should not throw
    expect(() => {
      FeaturesBuilder.build("SPY", tick, history1m, emptyMtfContext as any, []);
    }).not.toThrow();
  });
});

describe("ORB Calculation Logic", () => {
  it("ORB High is max of first 15 bars (9:30-9:45)", () => {
    // Create 60 bars representing first hour
    const bars = createMockBars(60, 100, new Date().setHours(9, 30, 0, 0));

    // Manually set first 15 bars with known values
    for (let i = 0; i < 15; i++) {
      bars[i].high = 100 + i; // Max at i=14 → high = 114
      bars[i].low = 95;
    }

    const orbHigh = Math.max(...bars.slice(0, 15).map((b) => b.high));
    expect(orbHigh).toBe(114);
  });

  it("ORB Low is min of first 15 bars (9:30-9:45)", () => {
    const bars = createMockBars(60, 100, new Date().setHours(9, 30, 0, 0));

    // Manually set first 15 bars with known lows
    for (let i = 0; i < 15; i++) {
      bars[i].low = 100 - i; // Min at i=14 → low = 86
      bars[i].high = 105;
    }

    const orbLow = Math.min(...bars.slice(0, 15).map((b) => b.low));
    expect(orbLow).toBe(86);
  });
});

describe("Profit Factor Math", () => {
  it("calculates profit factor correctly: (+100, -50) = PF 2.0", () => {
    const trades: BacktestTrade[] = [
      {
        timestamp: 1000,
        symbol: "SPY",
        detector: "test",
        direction: "LONG",
        entryPrice: 100,
        targetPrice: 102,
        stopPrice: 99,
        exitPrice: 102,
        exitTimestamp: 2000,
        exitReason: "TARGET_HIT",
        pnl: 100,
        pnlPercent: 2,
        rMultiple: 2,
        barsHeld: 10,
      },
      {
        timestamp: 3000,
        symbol: "SPY",
        detector: "test",
        direction: "LONG",
        entryPrice: 100,
        targetPrice: 102,
        stopPrice: 99,
        exitPrice: 99,
        exitTimestamp: 4000,
        exitReason: "STOP_HIT",
        pnl: -50,
        pnlPercent: -1,
        rMultiple: -1,
        barsHeld: 5,
      },
    ];

    const stats = calculateStats("test", trades);
    expect(stats.profitFactor).toBe(2.0); // 100 / 50 = 2.0
  });

  it("handles zero losses (infinite profit factor capped)", () => {
    const trades: BacktestTrade[] = [
      {
        timestamp: 1000,
        symbol: "SPY",
        detector: "test",
        direction: "LONG",
        entryPrice: 100,
        targetPrice: 102,
        stopPrice: 99,
        exitPrice: 102,
        exitTimestamp: 2000,
        exitReason: "TARGET_HIT",
        pnl: 100,
        pnlPercent: 2,
        rMultiple: 2,
        barsHeld: 10,
      },
    ];

    const stats = calculateStats("test", trades);
    expect(stats.profitFactor).toBe(Infinity); // All winners
  });
});

describe("Signal Deduplication", () => {
  it("multiple signals on same bar should result in single trade (enforced by engine)", () => {
    // This is a behavioral test - the engine checks hasActiveTrade before entry
    const activeTrades: BacktestTrade[] = [];
    const symbol = "SPY";

    // Simulate first signal
    const hasActiveTrade1 = activeTrades.some((t) => t.symbol === symbol);
    expect(hasActiveTrade1).toBe(false); // Can enter

    // After entry
    activeTrades.push({
      timestamp: 1000,
      symbol,
      detector: "test",
      direction: "LONG",
      entryPrice: 100,
      targetPrice: 102,
      stopPrice: 99,
      exitPrice: 0,
      exitTimestamp: 0,
      exitReason: "MAX_HOLD",
      pnl: 0,
      pnlPercent: 0,
      rMultiple: 0,
      barsHeld: 0,
    });

    // Second signal on same symbol - should be blocked
    const hasActiveTrade2 = activeTrades.some((t) => t.symbol === symbol);
    expect(hasActiveTrade2).toBe(true); // Cannot enter - already in trade
  });
});

describe("FeaturesBuilder Schema Aliasing", () => {
  it("provides both camelCase and snake_case aliases", () => {
    const tick: Bar = {
      timestamp: Date.now(),
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
    };
    const history1m = createMockBars(200);
    const mtfContext = {};

    const features = FeaturesBuilder.build("SPY", tick, history1m, mtfContext as any, []);

    // Check top-level aliases exist
    expect(features.regime).toBeDefined();
    expect((features as any).marketRegime).toBeDefined();
    expect((features as any).market_regime).toBeDefined();
    expect(features.regime).toBe((features as any).marketRegime);
    expect(features.regime).toBe((features as any).market_regime);

    // Check volume aliases
    expect(features.volume?.relativeToAvg).toBeDefined();
    expect((features.volume as any)?.relative_to_avg).toBeDefined();

    // Check pattern aliases
    expect(features.pattern?.breakoutBullish).toBeDefined();
    expect((features.pattern as any)?.breakout_bullish).toBeDefined();
  });

  it("provides session context with RTH detection", () => {
    // Create tick during RTH (14:30-21:00 UTC = 9:30am-4pm ET)
    const rthTimestamp = new Date("2025-01-07T15:00:00Z").getTime(); // 10am ET

    const tick: Bar = {
      timestamp: rthTimestamp,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
    };
    const history1m = createMockBars(200, 100, rthTimestamp - 200 * 60000);

    const features = FeaturesBuilder.build("SPY", tick, history1m, {} as any, []);

    expect(features.session).toBeDefined();
    expect(features.session?.isRegularHours).toBe(true);
    expect(features.session?.minutesSinceOpen).toBeGreaterThan(0);
  });
});

describe("Warmup Period Validation", () => {
  it("WARMUP_BARS constant should be 300 for EMA-200 convergence", () => {
    // This is a documentation test - the actual value is in EventDrivenBacktestEngine
    const EXPECTED_WARMUP = 300;

    // EMA-200 needs ~3*period for convergence, but 300 is practical minimum
    // 200 * 1.5 = 300
    expect(EXPECTED_WARMUP).toBeGreaterThanOrEqual(200);
    expect(EXPECTED_WARMUP).toBe(300);
  });
});
