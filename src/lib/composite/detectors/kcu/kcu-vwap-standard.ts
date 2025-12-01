/**
 * KCU VWAP Standard Detector
 *
 * Implements the KCU VWAP Bounce strategy:
 * - Active after 10:00 AM EST
 * - Trend established
 * - Price approaching VWAP zone (within 10-15 cents)
 * - Patience candle forms at VWAP
 *
 * Per KCU training:
 * - VWAP is "The King" - primary level
 * - Wait for price to come to VWAP, don't chase
 * - Entry on patience candle break
 * - Stop below VWAP zone
 *
 * Expected Frequency: 2-4 signals/day
 */

import type { SymbolFeatures } from "../../../strategy/engine.js";
import {
  createDetector,
  type OpportunityDetector,
  type ScoreFactor,
} from "../../OpportunityDetector.js";
import { shouldRunDetector } from "../utils.js";
import { detectLTPTrend, getTrendScore, isTrendTradeable } from "./utils/trend-detection.js";
import { detectLTPPatienceCandle, getPatienceCandleScore } from "./utils/patience-candle.js";
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
 * Get ATR from features
 */
function getATR(features: SymbolFeatures): number {
  if (features.pattern?.atr && typeof features.pattern.atr === "number") {
    return features.pattern.atr;
  }
  const price = features.price?.current ?? 100;
  return price * 0.015;
}

/**
 * Get ORB and Premarket levels
 */
function getORBLevels(features: SymbolFeatures): { high: number; low: number } {
  return {
    high: (features.pattern?.orbHigh as number) || 0,
    low: (features.pattern?.orbLow as number) || 0,
  };
}

function getPremarketLevels(features: SymbolFeatures): { high: number; low: number } {
  return {
    high: (features.pattern?.preMarketHigh as number) || 0,
    low: (features.pattern?.preMarketLow as number) || 0,
  };
}

/**
 * Check if price is in VWAP zone (within threshold)
 * OPTIMIZED: Widened from 0.3% to 0.5% default for more signal generation
 */
function isInVWAPZone(
  currentPrice: number,
  vwap: number,
  thresholdPercent: number = 0.5 // 0.5% = ~25 cents on $50 stock (widened from 0.3%)
): boolean {
  if (!vwap || vwap <= 0) return false;
  const distancePct = (Math.abs(currentPrice - vwap) / currentPrice) * 100;
  return distancePct <= thresholdPercent;
}

/**
 * Check if price is approaching VWAP (coming from away)
 */
function isApproachingVWAP(features: SymbolFeatures, direction: "LONG" | "SHORT"): boolean {
  const price = features.price?.current ?? 0;
  const vwap = features.vwap?.value ?? 0;
  const high = features.price?.high ?? 0;
  const low = features.price?.low ?? 0;

  if (!vwap || vwap <= 0) return false;

  if (direction === "LONG") {
    // For long: price should be approaching from below
    return low < vwap && price >= vwap * 0.997;
  } else {
    // For short: price should be approaching from above
    return high > vwap && price <= vwap * 1.003;
  }
}

// ============================================================================
// Score Factors
// ============================================================================

const kcuVWAPScoreFactors: ScoreFactor[] = [
  {
    name: "level_confluence",
    weight: 0.3,
    evaluate: (features) => {
      const price = features.price?.current ?? 0;
      const vwap = features.vwap?.value ?? 0;
      const ema8 = features.ema?.["8"] ?? 0;
      const ema21 = features.ema?.["21"] ?? 0;

      let score = 0;

      // At VWAP (The King) - OPTIMIZED: widened zone, tiered scoring
      if (isInVWAPZone(price, vwap, 0.2)) {
        score += 60; // Tight zone = higher score
      } else if (isInVWAPZone(price, vwap, 0.5)) {
        score += 45; // Medium zone
      } else if (isInVWAPZone(price, vwap, 0.7)) {
        score += 30; // Wide zone = still counts
      }

      // Additional levels nearby (Queens)
      if (ema8 && Math.abs(price - ema8) / price < 0.005) {
        score += 20;
      }
      if (ema21 && Math.abs(price - ema21) / price < 0.005) {
        score += 15;
      }

      // ORB level confluence
      const orbLevels = getORBLevels(features);
      if (orbLevels.high && Math.abs(price - orbLevels.high) / price < 0.003) {
        score += 15;
      }
      if (orbLevels.low && Math.abs(price - orbLevels.low) / price < 0.003) {
        score += 15;
      }

      return Math.min(100, score);
    },
  },
  {
    name: "trend_strength",
    weight: 0.25,
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
    weight: 0.25,
    evaluate: (features) => {
      const bars = featuresToBars(features);
      const atr = getATR(features);

      const patienceCandle = detectLTPPatienceCandle(bars, atr);

      if (!patienceCandle.detected) {
        if (features.pattern?.patientCandle === true) {
          return 50;
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

      // VWAP plays work with moderate volume
      if (rvol >= 0.8 && rvol <= 2.0) {
        return 85;
      }
      if (rvol > 2.0) {
        return 70; // High volume ok but not ideal
      }

      return 50;
    },
  },
  {
    name: "session_timing",
    weight: 0.1,
    evaluate: (features) => {
      const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;

      // VWAP strategy active after 10:00 AM (30 min after open)
      if (minutesSinceOpen < 30) {
        return 20; // Too early
      }
      if (minutesSinceOpen >= 30 && minutesSinceOpen <= 180) {
        return 100; // 10:00 AM - 12:30 PM: Prime time
      }
      if (minutesSinceOpen > 180 && minutesSinceOpen <= 300) {
        return 80; // 12:30 PM - 2:30 PM
      }
      if (minutesSinceOpen > 300) {
        return 40; // Late day
      }

      return 60;
    },
  },
];

// ============================================================================
// Main Detector
// ============================================================================

/**
 * KCU VWAP Standard Detector (Long)
 */
export const kcuVWAPStandardDetector: OpportunityDetector = createDetector({
  type: "kcu_vwap_standard_long" as any,
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    const price = features.price?.current;
    const vwap = features.vwap?.value;

    if (!price || !vwap) return false;
    if (!shouldRunDetector(features)) return false;

    // Must be after 10:00 AM
    const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
    if (minutesSinceOpen < 30) return false;

    // Check trend
    const bars = featuresToBars(features);
    const orbLevels = getORBLevels(features);
    const premarketLevels = getPremarketLevels(features);

    const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

    // For VWAP long, trend should be UPTREND or at least not DOWNTREND
    // OPTIMIZED: Allow trades in CHOP/ranging markets if other conditions are strong
    if (trend.direction === "DOWNTREND" && !trend.isMicroTrend) {
      return false;
    }

    // Price must be in VWAP zone - OPTIMIZED: widened to 0.7%
    if (!isInVWAPZone(price, vwap, 0.7)) {
      return false;
    }

    // Check for approaching pattern OR price holding above VWAP
    // OPTIMIZED: Relaxed - don't require both approach AND patience candle
    const isApproaching = isApproachingVWAP(features, "LONG");
    const hasPatienceCandle = features.pattern?.patientCandle === true;
    const isHoldingAboveVWAP = price >= vwap * 0.998;

    // Need at least one confirming signal
    if (!isApproaching && !hasPatienceCandle && !isHoldingAboveVWAP) {
      return false;
    }

    return true;
  },

  scoreFactors: kcuVWAPScoreFactors,
});

/**
 * KCU VWAP Standard Detector (Short)
 */
export const kcuVWAPStandardBearishDetector: OpportunityDetector = createDetector({
  type: "kcu_vwap_standard_short" as any,
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    const price = features.price?.current;
    const vwap = features.vwap?.value;

    if (!price || !vwap) return false;
    if (!shouldRunDetector(features)) return false;

    const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
    if (minutesSinceOpen < 30) return false;

    const bars = featuresToBars(features);
    const orbLevels = getORBLevels(features);
    const premarketLevels = getPremarketLevels(features);

    const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

    // For VWAP short, trend should be DOWNTREND
    if (trend.direction !== "DOWNTREND" || !isTrendTradeable(trend)) {
      return false;
    }

    if (!isInVWAPZone(price, vwap, 0.5)) {
      return false;
    }

    if (!isApproachingVWAP(features, "SHORT")) {
      if (features.pattern?.patientCandle !== true) {
        return false;
      }
    }

    return true;
  },

  scoreFactors: kcuVWAPScoreFactors,
});

export const KCU_VWAP_STANDARD_DETECTORS = [
  kcuVWAPStandardDetector,
  kcuVWAPStandardBearishDetector,
];
