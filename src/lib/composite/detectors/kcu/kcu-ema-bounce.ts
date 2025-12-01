/**
 * KCU EMA Bounce Detector
 *
 * Implements the KCU EMA Bounce strategy:
 * - Trend established (premarket high/low broken)
 * - Price pulling back to 8 EMA
 * - Patience candle forms at EMA
 * - Entry on break of patience candle in trend direction
 *
 * Timeframes: 2m (first 30 min), 5m (next 60 min), 10m (rest of day)
 * Minimum R:R: 1:2
 *
 * Expected Frequency: 3-5 signals/day
 */

import type { SymbolFeatures } from "../../../strategy/engine.js";
import {
  createDetector,
  type OpportunityDetector,
  type ScoreFactor,
} from "../../OpportunityDetector.js";
import { shouldRunDetector } from "../utils.js";
import type { KCUOpportunityType, LTPPatienceCandle, LTPTrend } from "./types.js";
import { detectLTPTrend, getTrendScore, isTrendTradeable } from "./utils/trend-detection.js";
import { detectLTPPatienceCandle, getPatienceCandleScore } from "./utils/patience-candle.js";
import {
  buildKCULevels,
  getLevelConfluenceScore,
  detectKingQueenConfluence,
} from "./utils/level-confluence.js";
import type { Bar } from "../../../strategy/patternDetection.js";

/**
 * Convert SymbolFeatures candles to Bar format
 */
function featuresToBars(features: SymbolFeatures): Bar[] {
  // Check if we have raw bars at top level (BacktestEngine) or in pattern data
  const rawBars = (features as any).rawBars || features.pattern?.rawBars;
  if (rawBars && Array.isArray(rawBars)) {
    return rawBars as Bar[];
  }

  // Otherwise construct from available data (limited)
  if (!features.price?.current) return [];

  const currentBar: Bar = {
    time: Date.now() / 1000,
    open: features.price.open ?? features.price.current,
    high: features.price.high ?? features.price.current,
    low: features.price.low ?? features.price.current,
    close: features.price.current,
    volume: features.volume?.current ?? 0,
  };

  return [currentBar];
}

/**
 * Get ATR from features or calculate fallback
 */
function getATR(features: SymbolFeatures): number {
  // Check if ATR is already computed
  if (features.pattern?.atr && typeof features.pattern.atr === "number") {
    return features.pattern.atr;
  }

  // Fallback: estimate from price (typical ATR is ~1-2% of price)
  const price = features.price?.current ?? 100;
  return price * 0.015; // 1.5% of price as default
}

/**
 * Get ORB levels from features
 */
function getORBLevels(features: SymbolFeatures): { high: number; low: number } {
  return {
    high: (features.pattern?.orbHigh as number) || 0,
    low: (features.pattern?.orbLow as number) || 0,
  };
}

/**
 * Get Premarket levels from features
 */
function getPremarketLevels(features: SymbolFeatures): { high: number; low: number } {
  return {
    high: (features.pattern?.preMarketHigh as number) || 0,
    low: (features.pattern?.preMarketLow as number) || 0,
  };
}

/**
 * Check if price is near 8 EMA (within tolerance)
 */
function isNear8EMA(
  currentPrice: number,
  ema8: number,
  tolerance: number = 0.003 // 0.3%
): boolean {
  if (!ema8 || ema8 <= 0) return false;
  const distancePct = Math.abs(currentPrice - ema8) / currentPrice;
  return distancePct <= tolerance;
}

/**
 * Check if price pulled back to 8 EMA from a higher/lower level
 */
function hasPulledBackToEMA(features: SymbolFeatures, direction: "LONG" | "SHORT"): boolean {
  const price = features.price?.current ?? 0;
  const ema8 = features.ema?.["8"] ?? 0;
  const high = features.price?.high ?? 0;
  const low = features.price?.low ?? 0;

  if (direction === "LONG") {
    // For long: price should have been above EMA and now touching it
    return high > ema8 && price <= ema8 * 1.003;
  } else {
    // For short: price should have been below EMA and now touching it
    return low < ema8 && price >= ema8 * 0.997;
  }
}

// ============================================================================
// Score Factors for L-T-P Weighted Scoring
// ============================================================================

const kcuEMABounceScoreFactors: ScoreFactor[] = [
  {
    name: "level_confluence",
    weight: 0.25, // L - Levels (reduced from 0.3 to add MTF weight)
    evaluate: (features) => {
      const currentPrice = features.price?.current ?? 0;
      const ema8 = features.ema?.["8"] ?? 0;
      const ema21 = features.ema?.["21"] ?? 0;
      const vwap = features.vwap?.value ?? 0;

      // Check level stacking at current price
      let score = 0;

      // Near 8 EMA
      if (isNear8EMA(currentPrice, ema8, 0.005)) {
        score += 40;
      }

      // 8 EMA and 21 EMA close together (strong trend zone)
      if (ema8 && ema21 && Math.abs(ema8 - ema21) / currentPrice < 0.005) {
        score += 20;
      }

      // Near VWAP as well (King & Queen)
      if (vwap && Math.abs(currentPrice - vwap) / currentPrice < 0.005) {
        score += 30;
      }

      // Near any other key level (ORB, premarket)
      const orbLevels = getORBLevels(features);
      if (
        (orbLevels.high && Math.abs(currentPrice - orbLevels.high) / currentPrice < 0.003) ||
        (orbLevels.low && Math.abs(currentPrice - orbLevels.low) / currentPrice < 0.003)
      ) {
        score += 15;
      }

      return Math.min(100, score);
    },
  },
  {
    name: "trend_strength",
    weight: 0.25, // T - Trends
    evaluate: (features) => {
      const bars = featuresToBars(features);
      const orbLevels = getORBLevels(features);
      const premarketLevels = getPremarketLevels(features);

      const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

      if (!isTrendTradeable(trend)) {
        return 0;
      }

      return getTrendScore(trend);
    },
  },
  {
    name: "patience_candle",
    weight: 0.25, // P - Patience
    evaluate: (features) => {
      const bars = featuresToBars(features);
      const atr = getATR(features);

      const patienceCandle = detectLTPPatienceCandle(bars, atr);

      if (!patienceCandle.detected) {
        // Check if at least pattern shows patient candle
        if (features.pattern?.patientCandle === true) {
          return 50; // Partial credit
        }
        return 0;
      }

      return getPatienceCandleScore(patienceCandle);
    },
  },
  {
    name: "volume_confirmation",
    weight: 0.1,
    evaluate: (features) => {
      const rvol = features.volume?.relativeToAvg ?? 1.0;

      // Ideal: volume should be moderate during pullback (not exhaustion)
      // Then spike on break
      if (rvol >= 0.8 && rvol <= 1.5) {
        return 80; // Healthy pullback volume
      }
      if (rvol > 1.5 && rvol < 2.5) {
        return 90; // Good volume
      }
      if (rvol >= 2.5) {
        return 70; // High volume might be climactic
      }

      return 50; // Low volume
    },
  },
  {
    name: "session_timing",
    weight: 0.05, // Reduced from 0.1 to balance weights (total=1.0)
    evaluate: (features) => {
      const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;

      // EMA bounces work best after trend is established (after first 30 min)
      if (minutesSinceOpen >= 30 && minutesSinceOpen <= 90) {
        return 100; // Prime time: 10:00 - 11:00 AM
      }
      if (minutesSinceOpen > 90 && minutesSinceOpen <= 210) {
        return 80; // Good: 11:00 AM - 1:00 PM
      }
      if (minutesSinceOpen > 210 && minutesSinceOpen <= 330) {
        return 70; // Afternoon
      }
      if (minutesSinceOpen > 330) {
        return 30; // Last hour - avoid
      }
      if (minutesSinceOpen < 30) {
        return 50; // Too early - trend not established
      }

      return 60;
    },
  },
  {
    name: "mtf_alignment",
    weight: 0.1, // Multi-timeframe trend alignment bonus
    evaluate: (features) => {
      // Check if EMAs are properly stacked (8 > 21 > 50 for uptrend)
      const ema8 = features.ema?.["8"] ?? 0;
      const ema21 = features.ema?.["21"] ?? 0;
      const ema50 = features.ema?.["50"] ?? 0;
      const price = features.price?.current ?? 0;

      if (!ema8 || !ema21) return 50;

      let score = 50; // Base

      // Check EMA stacking for uptrend (price > 8 EMA > 21 EMA > 50 EMA)
      if (price > ema8 && ema8 > ema21) {
        score += 25; // EMAs properly stacked for uptrend
        if (ema50 && ema21 > ema50) {
          score += 15; // Full 3-EMA stack
        }
      }

      // Check for downtrend stack (price < 8 EMA < 21 EMA < 50 EMA)
      if (price < ema8 && ema8 < ema21) {
        score += 25;
        if (ema50 && ema21 < ema50) {
          score += 15;
        }
      }

      // Check RSI alignment (not overbought/oversold in trend direction)
      const rsi = features.rsi?.["14"] ?? 50;
      if (rsi > 40 && rsi < 70) {
        score += 10; // RSI in healthy range for longs
      }

      return Math.min(100, score);
    },
  },
];

// ============================================================================
// Main Detector
// ============================================================================

/**
 * KCU EMA Bounce Detector
 *
 * Detection criteria:
 * 1. Trend established (premarket or ORB broken in direction)
 * 2. Price pulling back to 8 EMA
 * 3. Patience candle forming
 * 4. Entry on break of patience candle
 */
export const kcuEMABounceDetector: OpportunityDetector = createDetector({
  type: "kcu_ema_bounce_long" as any, // KCU type extends base OpportunityType
  direction: "LONG", // Default direction, actual determined by trend
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. Must have price and EMA data
    const price = features.price?.current;
    const ema8 = features.ema?.["8"];

    if (!price || !ema8) return false;

    // 2. Check if detector should run (market hours check)
    if (!shouldRunDetector(features)) return false;

    // 3. Check trend - must have established trend
    const bars = featuresToBars(features);
    const orbLevels = getORBLevels(features);
    const premarketLevels = getPremarketLevels(features);

    const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

    if (!isTrendTradeable(trend)) {
      return false;
    }

    // 4. Check if price is near 8 EMA (pullback zone)
    if (!isNear8EMA(price, ema8, 0.005)) {
      return false;
    }

    // 5. Check for pullback pattern (price was away from EMA, now touching)
    const direction = trend.direction === "UPTREND" ? "LONG" : "SHORT";
    if (!hasPulledBackToEMA(features, direction)) {
      // At minimum, check if we're at EMA with patient candle
      if (features.pattern?.patientCandle !== true) {
        return false;
      }
    }

    // 6. Check for patience candle (optional but improves quality)
    const atr = getATR(features);
    const patienceCandle = detectLTPPatienceCandle(bars, atr);

    // Allow detection even without perfect patience candle
    // (scoring will adjust based on patience quality)

    return true;
  },

  scoreFactors: kcuEMABounceScoreFactors,
});

/**
 * Bearish version of EMA Bounce
 */
export const kcuEMABounceBearishDetector: OpportunityDetector = createDetector({
  type: "kcu_ema_bounce_short" as any,
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // Same logic as bullish, but for downtrend
    const price = features.price?.current;
    const ema8 = features.ema?.["8"];

    if (!price || !ema8) return false;
    if (!shouldRunDetector(features)) return false;

    const bars = featuresToBars(features);
    const orbLevels = getORBLevels(features);
    const premarketLevels = getPremarketLevels(features);

    const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

    // Must be in downtrend for bearish bounce
    if (trend.direction !== "DOWNTREND" || !isTrendTradeable(trend)) {
      return false;
    }

    if (!isNear8EMA(price, ema8, 0.005)) {
      return false;
    }

    if (!hasPulledBackToEMA(features, "SHORT")) {
      if (features.pattern?.patientCandle !== true) {
        return false;
      }
    }

    return true;
  },

  scoreFactors: kcuEMABounceScoreFactors,
});

// Export both for registration
export const KCU_EMA_BOUNCE_DETECTORS = [kcuEMABounceDetector, kcuEMABounceBearishDetector];
