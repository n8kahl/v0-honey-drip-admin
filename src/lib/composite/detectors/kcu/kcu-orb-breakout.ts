/**
 * KCU ORB Breakout Detector
 *
 * Implements the KCU Opening Range Breakout strategy:
 * - ORB = First 15 minutes high/low
 * - Trade breakout above/below ORB levels
 * - Patience candle forms after breakout
 * - Volume confirmation required
 *
 * Per KCU training:
 * - ORB breakout sets the trend direction for the day
 * - No ORB breakout = likely chop day
 * - Entry on patience candle break after ORB level break
 * - Stop inside ORB range
 *
 * Timeframe: 2-minute charts in first 30 minutes
 * Expected Frequency: 1-2 signals/day
 */

import type { SymbolFeatures } from "../../../strategy/engine.js";
import {
  createDetector,
  type OpportunityDetector,
  type ScoreFactor,
} from "../../OpportunityDetector.js";
import { shouldRunDetector } from "../utils.js";
import { detectLTPPatienceCandle, getPatienceCandleScore } from "./utils/patience-candle.js";
import type { Bar } from "../../../strategy/patternDetection.js";

/**
 * Convert SymbolFeatures to Bar array
 */
function featuresToBars(features: SymbolFeatures): Bar[] {
  if (features.pattern?.rawBars && Array.isArray(features.pattern.rawBars)) {
    return features.pattern.rawBars as Bar[];
  }

  if (!features.price?.current) return [];

  return [
    {
      time: Date.now() / 1000,
      open: features.price.open ?? features.price.current,
      high: features.price.high ?? features.price.current,
      low: features.price.low ?? features.price.current,
      close: features.price.current,
      volume: features.volume?.current ?? 0,
    },
  ];
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
 * Get ORB levels
 */
function getORBLevels(features: SymbolFeatures): { high: number; low: number } {
  return {
    high: (features.pattern?.orbHigh as number) || 0,
    low: (features.pattern?.orbLow as number) || 0,
  };
}

/**
 * Check if ORB high has been broken (bullish)
 */
function hasORBHighBreak(
  price: number,
  orbHigh: number,
  threshold: number = 0.001 // 0.1% buffer
): boolean {
  if (!orbHigh || orbHigh <= 0) return false;
  return price > orbHigh * (1 + threshold);
}

/**
 * Check if ORB low has been broken (bearish)
 */
function hasORBLowBreak(price: number, orbLow: number, threshold: number = 0.001): boolean {
  if (!orbLow || orbLow <= 0) return false;
  return price < orbLow * (1 - threshold);
}

/**
 * Check if ORB range is valid (not too wide or narrow)
 */
function isValidORBRange(orbHigh: number, orbLow: number, atr: number): boolean {
  if (!orbHigh || !orbLow || !atr) return false;

  const range = orbHigh - orbLow;
  const rangeToATR = range / atr;

  // Range should be 0.5x to 2.5x ATR
  return rangeToATR >= 0.5 && rangeToATR <= 2.5;
}

// ============================================================================
// Score Factors
// ============================================================================

const kcuORBBreakoutScoreFactors: ScoreFactor[] = [
  {
    name: "level_confluence",
    weight: 0.25,
    evaluate: (features) => {
      const price = features.price?.current ?? 0;
      const orbLevels = getORBLevels(features);
      const vwap = features.vwap?.value ?? 0;
      const ema8 = features.ema?.["8"] ?? 0;

      let score = 0;

      // Near ORB level (just broke through)
      const orbHigh = orbLevels.high;
      const orbLow = orbLevels.low;

      if (orbHigh && Math.abs(price - orbHigh) / price < 0.005) {
        score += 40;
      }
      if (orbLow && Math.abs(price - orbLow) / price < 0.005) {
        score += 40;
      }

      // VWAP confluence
      if (vwap && Math.abs(price - vwap) / price < 0.005) {
        score += 25;
      }

      // EMA confluence
      if (ema8 && Math.abs(price - ema8) / price < 0.005) {
        score += 20;
      }

      return Math.min(100, score);
    },
  },
  {
    name: "trend_strength",
    weight: 0.25,
    evaluate: (features) => {
      // For ORB breakout, the breakout itself IS the trend confirmation
      const price = features.price?.current ?? 0;
      const orbLevels = getORBLevels(features);

      let score = 50; // Base

      // Clear break above ORB high
      if (hasORBHighBreak(price, orbLevels.high, 0.002)) {
        score += 30;
      }

      // Clear break below ORB low
      if (hasORBLowBreak(price, orbLevels.low, 0.002)) {
        score += 30;
      }

      // Price action confirmation (close near high/low of bar)
      const barRange = (features.price?.high ?? price) - (features.price?.low ?? price);
      if (barRange > 0) {
        const closePosition = (price - (features.price?.low ?? price)) / barRange;
        // For bullish: close near high (>0.7)
        // For bearish: close near low (<0.3)
        if (closePosition > 0.7 || closePosition < 0.3) {
          score += 20;
        }
      }

      return Math.min(100, score);
    },
  },
  {
    name: "patience_candle",
    weight: 0.2,
    evaluate: (features) => {
      const bars = featuresToBars(features);
      const atr = getATR(features);

      const patienceCandle = detectLTPPatienceCandle(bars, atr);

      if (!patienceCandle.detected) {
        if (features.pattern?.patientCandle === true) {
          return 50;
        }
        // ORB breakout can work without patience candle if volume is strong
        return 30;
      }

      return getPatienceCandleScore(patienceCandle);
    },
  },
  {
    name: "volume_confirmation",
    weight: 0.2, // Higher weight for ORB - volume is critical
    evaluate: (features) => {
      const rvol = features.volume?.relativeToAvg ?? 1.0;

      // ORB breakouts need volume confirmation
      if (rvol >= 2.0) {
        return 100; // Strong volume
      }
      if (rvol >= 1.5) {
        return 85;
      }
      if (rvol >= 1.2) {
        return 70;
      }
      if (rvol >= 1.0) {
        return 55;
      }

      return 30; // Low volume breakout is suspect
    },
  },
  {
    name: "session_timing",
    weight: 0.1,
    evaluate: (features) => {
      const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;

      // ORB breakout is most relevant in first 60 minutes
      if (minutesSinceOpen >= 15 && minutesSinceOpen <= 30) {
        return 100; // Ideal: just after ORB formed (9:45-10:00)
      }
      if (minutesSinceOpen > 30 && minutesSinceOpen <= 60) {
        return 90; // Still good: 10:00-10:30
      }
      if (minutesSinceOpen > 60 && minutesSinceOpen <= 90) {
        return 70; // Acceptable: 10:30-11:00
      }
      if (minutesSinceOpen < 15) {
        return 0; // ORB not yet formed
      }

      return 40; // Late for ORB strategy
    },
  },
];

// ============================================================================
// Main Detector
// ============================================================================

/**
 * KCU ORB Breakout Detector (Bullish)
 */
export const kcuORBBreakoutBullishDetector: OpportunityDetector = createDetector({
  type: "kcu_orb_breakout" as any,
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    const price = features.price?.current;

    if (!price) return false;
    if (!shouldRunDetector(features)) return false;

    const orbLevels = getORBLevels(features);

    // Must have valid ORB levels
    if (!orbLevels.high || !orbLevels.low) return false;

    // ORB must be formed (after first 15 minutes)
    const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
    if (minutesSinceOpen < 15) return false;

    // Check for ORB high break
    if (!hasORBHighBreak(price, orbLevels.high, 0.001)) {
      return false;
    }

    // Validate ORB range
    const atr = getATR(features);
    if (!isValidORBRange(orbLevels.high, orbLevels.low, atr)) {
      return false;
    }

    // Volume should be present
    const rvol = features.volume?.relativeToAvg ?? 0;
    if (rvol < 0.8) {
      return false; // Too low volume
    }

    return true;
  },

  scoreFactors: kcuORBBreakoutScoreFactors,
});

/**
 * KCU ORB Breakout Detector (Bearish)
 */
export const kcuORBBreakoutBearishDetector: OpportunityDetector = createDetector({
  type: "kcu_orb_breakout" as any,
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    const price = features.price?.current;

    if (!price) return false;
    if (!shouldRunDetector(features)) return false;

    const orbLevels = getORBLevels(features);

    if (!orbLevels.high || !orbLevels.low) return false;

    const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
    if (minutesSinceOpen < 15) return false;

    // Check for ORB low break
    if (!hasORBLowBreak(price, orbLevels.low, 0.001)) {
      return false;
    }

    const atr = getATR(features);
    if (!isValidORBRange(orbLevels.high, orbLevels.low, atr)) {
      return false;
    }

    const rvol = features.volume?.relativeToAvg ?? 0;
    if (rvol < 0.8) {
      return false;
    }

    return true;
  },

  scoreFactors: kcuORBBreakoutScoreFactors,
});

export const KCU_ORB_BREAKOUT_DETECTORS = [
  kcuORBBreakoutBullishDetector,
  kcuORBBreakoutBearishDetector,
];
