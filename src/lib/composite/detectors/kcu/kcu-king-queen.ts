/**
 * KCU King & Queen Detector
 *
 * Implements the KCU King & Queen strategy:
 * - King = VWAP (always)
 * - Queen = Any other level (8 EMA, 21 EMA, ORB, hourly level)
 * - Entry when price reaches confluence of King + Queen
 * - Active after 9:40 AM EST
 *
 * Per KCU training:
 * - "VWAP (King) + Any Level (Queen) confluence"
 * - Highest probability when multiple levels stack
 * - Patience candle at confluence = ideal entry
 *
 * Expected Frequency: 2-3 signals/day
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
import {
  buildKCULevels,
  detectKingQueenConfluence,
  getLevelConfluenceScore,
} from "./utils/level-confluence.js";
import type { KeyLevels } from "../../../riskEngine/types.js";
import type { Bar } from "../../../strategy/patternDetection.js";

/**
 * Convert SymbolFeatures to Bar array
 */
function featuresToBars(features: SymbolFeatures): Bar[] {
  // Check if we have raw bars at top level (BacktestEngine) or in pattern data
  const rawBars = (features as any).rawBars || features.pattern?.rawBars;
  if (rawBars && Array.isArray(rawBars)) {
    return rawBars as Bar[];
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
 * Build KeyLevels from features
 */
function buildKeyLevels(features: SymbolFeatures): KeyLevels {
  const orbLevels = getORBLevels(features);
  const premarketLevels = getPremarketLevels(features);

  return {
    preMarketHigh: premarketLevels.high,
    preMarketLow: premarketLevels.low,
    orbHigh: orbLevels.high,
    orbLow: orbLevels.low,
    priorDayHigh: (features.pattern?.priorDayHigh as number) || 0,
    priorDayLow: (features.pattern?.priorDayLow as number) || 0,
    vwap: features.vwap?.value || 0,
    vwapUpperBand: 0,
    vwapLowerBand: 0,
    bollingerUpper: 0,
    bollingerLower: 0,
    weeklyHigh: 0,
    weeklyLow: 0,
    monthlyHigh: 0,
    monthlyLow: 0,
    quarterlyHigh: 0,
    quarterlyLow: 0,
    yearlyHigh: 0,
    yearlyLow: 0,
  };
}

/**
 * Check for King & Queen confluence near current price
 */
function hasKingQueenConfluence(features: SymbolFeatures, proximityPercent: number = 0.3): boolean {
  const price = features.price?.current ?? 0;
  const vwap = features.vwap?.value ?? 0;

  if (!vwap || vwap <= 0) return false;

  // VWAP must be near current price
  const vwapDistance = (Math.abs(price - vwap) / price) * 100;
  if (vwapDistance > proximityPercent) return false;

  // Check for at least one Queen level nearby
  const ema8 = features.ema?.["8"] ?? 0;
  const ema21 = features.ema?.["21"] ?? 0;
  const orbLevels = getORBLevels(features);

  let queensNearby = 0;

  if (ema8 && (Math.abs(price - ema8) / price) * 100 <= proximityPercent) {
    queensNearby++;
  }
  if (ema21 && (Math.abs(price - ema21) / price) * 100 <= proximityPercent) {
    queensNearby++;
  }
  if (orbLevels.high && (Math.abs(price - orbLevels.high) / price) * 100 <= proximityPercent) {
    queensNearby++;
  }
  if (orbLevels.low && (Math.abs(price - orbLevels.low) / price) * 100 <= proximityPercent) {
    queensNearby++;
  }

  return queensNearby >= 1;
}

// ============================================================================
// Score Factors
// ============================================================================

const kcuKingQueenScoreFactors: ScoreFactor[] = [
  {
    name: "level_confluence",
    weight: 0.35, // Higher weight for K&Q strategy
    evaluate: (features) => {
      const price = features.price?.current ?? 0;
      const keyLevels = buildKeyLevels(features);

      const indicators = {
        ema8: features.ema?.["8"],
        ema21: features.ema?.["21"],
        sma200: features.ema?.["200"],
        vwap: features.vwap?.value,
      };

      const levels = buildKCULevels(keyLevels, indicators, price);
      const kingQueen = detectKingQueenConfluence(levels, price);

      if (!kingQueen.detected) {
        return 0;
      }

      // Score based on number of queens
      let score = 50; // Base for K&Q detected
      score += Math.min(40, kingQueen.queens.length * 15);
      score += kingQueen.confluenceStrength * 0.1;

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

      // K&Q works in both micro and macro trends
      if (trend.direction === "CHOP") {
        return 20; // Minimal score in chop
      }

      return getTrendScore(trend);
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
        return 20; // K&Q can work without perfect patience candle
      }

      return getPatienceCandleScore(patienceCandle);
    },
  },
  {
    name: "volume_confirmation",
    weight: 0.1,
    evaluate: (features) => {
      const rvol = features.volume?.relativeToAvg ?? 1.0;

      if (rvol >= 1.0 && rvol <= 2.5) {
        return 90;
      }
      if (rvol > 2.5) {
        return 75;
      }

      return 60;
    },
  },
  {
    name: "session_timing",
    weight: 0.1,
    evaluate: (features) => {
      const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;

      // K&Q active after 9:40 AM (10 min after open)
      if (minutesSinceOpen < 10) {
        return 30;
      }
      if (minutesSinceOpen >= 10 && minutesSinceOpen <= 90) {
        return 90; // Morning session
      }
      if (minutesSinceOpen > 90 && minutesSinceOpen <= 270) {
        return 100; // Midday - best for K&Q
      }
      if (minutesSinceOpen > 270 && minutesSinceOpen <= 330) {
        return 70; // Afternoon
      }

      return 30; // Last hour
    },
  },
];

// ============================================================================
// Main Detector
// ============================================================================

/**
 * KCU King & Queen Detector (Long)
 */
export const kcuKingQueenDetector: OpportunityDetector = createDetector({
  type: "kcu_king_queen_long" as any,
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,
  idealTimeframe: "15m",

  detect: (features: SymbolFeatures) => {
    const price = features.price?.current;
    const vwap = features.vwap?.value;

    if (!price || !vwap) return false;
    if (!shouldRunDetector(features)) return false;

    // Active after 9:40 AM
    const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
    if (minutesSinceOpen < 10) return false;

    // Check for King & Queen confluence
    if (!hasKingQueenConfluence(features, 0.5)) {
      return false;
    }

    // Check trend (at least micro or macro trend)
    const bars = featuresToBars(features);
    const orbLevels = getORBLevels(features);
    const premarketLevels = getPremarketLevels(features);

    const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

    // For long, prefer uptrend but allow micro trend
    if (trend.direction === "DOWNTREND" && !trend.isMicroTrend) {
      return false;
    }

    // Price should be at or approaching VWAP from below for long
    if (price > vwap * 1.005) {
      // Allow if we're in a strong uptrend pulling back to VWAP
      if (trend.direction !== "UPTREND") {
        return false;
      }
    }

    return true;
  },

  scoreFactors: kcuKingQueenScoreFactors,
});

/**
 * KCU King & Queen Detector (Short)
 */
export const kcuKingQueenBearishDetector: OpportunityDetector = createDetector({
  type: "kcu_king_queen_short" as any,
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,
  idealTimeframe: "15m",

  detect: (features: SymbolFeatures) => {
    const price = features.price?.current;
    const vwap = features.vwap?.value;

    if (!price || !vwap) return false;
    if (!shouldRunDetector(features)) return false;

    const minutesSinceOpen = features.session?.minutesSinceOpen ?? 0;
    if (minutesSinceOpen < 10) return false;

    if (!hasKingQueenConfluence(features, 0.5)) {
      return false;
    }

    const bars = featuresToBars(features);
    const orbLevels = getORBLevels(features);
    const premarketLevels = getPremarketLevels(features);

    const trend = detectLTPTrend(bars, orbLevels, premarketLevels, features);

    // For short, prefer downtrend
    if (trend.direction === "UPTREND" && !trend.isMicroTrend) {
      return false;
    }

    // Price should be at or approaching VWAP from above for short
    if (price < vwap * 0.995) {
      if (trend.direction !== "DOWNTREND") {
        return false;
      }
    }

    return true;
  },

  scoreFactors: kcuKingQueenScoreFactors,
});

export const KCU_KING_QUEEN_DETECTORS = [kcuKingQueenDetector, kcuKingQueenBearishDetector];
