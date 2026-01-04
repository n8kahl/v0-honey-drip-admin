/**
 * Level-Aware Stop Loss
 * Phase 2.2: Key Level-Based Stop Placement
 *
 * Calculates stop losses based on actual support/resistance levels rather than
 * arbitrary percentages or fixed ATR multipliers. This ensures stops are placed
 * at technically meaningful levels where price has previously found support/resistance.
 *
 * Key concepts:
 * - Stops are placed beyond key levels, not at arbitrary distances
 * - Strong levels (high touch count, recent tests) take priority
 * - Buffer zones prevent stop hunting
 * - Fallback to ATR-based stops when no suitable levels exist
 */

import type { KeyLevels, TradeType } from "./types.js";

/**
 * Types of key levels that can be used for stop placement
 */
export type KeyLevelType =
  | "ORB"
  | "VWAP"
  | "PriorDayHL"
  | "WeekHL"
  | "MonthHL"
  | "Pivot"
  | "Fib"
  | "Bollinger"
  | "ATR"; // Fallback

/**
 * A key level with metadata for stop placement
 */
export interface KeyLevel {
  price: number;
  type: KeyLevelType;
  strength: "strong" | "moderate" | "weak";
  label: string; // Human-readable label
  touchCount?: number; // How many times price has tested this level
  lastTouchTime?: number; // Timestamp of last touch
}

/**
 * Result of level-aware stop calculation
 */
export interface LevelAwareStopResult {
  recommendedStop: number;
  levelType: KeyLevelType;
  levelLabel: string;
  levelStrength: "strong" | "moderate" | "weak";
  distanceFromEntry: number;
  distancePercent: number;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  alternativeStops: AlternativeStop[];
  warnings: string[];
}

/**
 * Alternative stop options
 */
export interface AlternativeStop {
  price: number;
  type: KeyLevelType;
  label: string;
  distancePercent: number;
  reasoning: string;
}

/**
 * Configuration for level-aware stop calculation
 */
export interface LevelAwareStopConfig {
  maxStopPercent: number; // Maximum distance as % of entry (default: 5%)
  minStopPercent: number; // Minimum distance as % of entry (default: 0.5%)
  bufferATRMultiplier: number; // Buffer beyond level as ATR multiple (default: 0.1)
  fallbackATRMultiplier: number; // ATR multiplier when no levels found (default: 1.0)
  preferenceWeights: {
    proximity: number; // Weight for closer levels (default: 0.4)
    strength: number; // Weight for stronger levels (default: 0.4)
    recency: number; // Weight for recently tested levels (default: 0.2)
  };
  tradeTypeOverrides?: Record<TradeType, Partial<LevelAwareStopConfig>>;
}

/**
 * Default configuration
 */
export const DEFAULT_LEVEL_AWARE_CONFIG: LevelAwareStopConfig = {
  maxStopPercent: 5.0,
  minStopPercent: 0.5,
  bufferATRMultiplier: 0.1,
  fallbackATRMultiplier: 1.0,
  preferenceWeights: {
    proximity: 0.4,
    strength: 0.4,
    recency: 0.2,
  },
  tradeTypeOverrides: {
    SCALP: {
      maxStopPercent: 2.0,
      minStopPercent: 0.25,
      bufferATRMultiplier: 0.05,
      fallbackATRMultiplier: 0.75,
    },
    DAY: {
      maxStopPercent: 3.5,
      minStopPercent: 0.5,
      bufferATRMultiplier: 0.1,
      fallbackATRMultiplier: 1.0,
    },
    SWING: {
      maxStopPercent: 8.0,
      minStopPercent: 1.0,
      bufferATRMultiplier: 0.15,
      fallbackATRMultiplier: 1.5,
    },
    LEAP: {
      maxStopPercent: 15.0,
      minStopPercent: 2.0,
      bufferATRMultiplier: 0.2,
      fallbackATRMultiplier: 2.0,
    },
  },
};

/**
 * Level strength priorities (higher = stronger)
 */
const LEVEL_STRENGTH_SCORES: Record<"strong" | "moderate" | "weak", number> = {
  strong: 3,
  moderate: 2,
  weak: 1,
};

/**
  Pivot: "moderate",
  Fib: "moderate",
  Bollinger: "weak",
  ATR: "weak",
};

/**
 * Extract key levels from KeyLevels interface and convert to KeyLevel array
 *
 * @param keyLevels - Raw key levels from risk engine
 * @param currentPrice - Current price for proximity calculation
 * @returns Array of KeyLevel objects
 */
export function extractKeyLevelsArray(keyLevels: KeyLevels, currentPrice: number): KeyLevel[] {
  const levels: KeyLevel[] = [];

  // Prior Day Levels
  if (keyLevels.priorDayHigh && keyLevels.priorDayHigh > 0) {
    levels.push({
      price: keyLevels.priorDayHigh,
      type: "PriorDayHL",
      strength: "strong",
      label: "Prior Day High",
    });
  }

  if (keyLevels.priorDayLow && keyLevels.priorDayLow > 0) {
    levels.push({
      price: keyLevels.priorDayLow,
      type: "PriorDayHL",
      strength: "strong",
      label: "Prior Day Low",
    });
  }

  // Weekly Levels
  if (keyLevels.weeklyHigh && keyLevels.weeklyHigh > 0) {
    levels.push({
      price: keyLevels.weeklyHigh,
      type: "WeekHL",
      strength: "strong",
      label: "Weekly High",
    });
  }

  if (keyLevels.weeklyLow && keyLevels.weeklyLow > 0) {
    levels.push({
      price: keyLevels.weeklyLow,
      type: "WeekHL",
      strength: "strong",
      label: "Weekly Low",
    });
  }

  // Monthly Levels
  if (keyLevels.monthlyHigh && keyLevels.monthlyHigh > 0) {
    levels.push({
      price: keyLevels.monthlyHigh,
      type: "MonthHL",
      strength: "strong",
      label: "Monthly High",
    });
  }

  if (keyLevels.monthlyLow && keyLevels.monthlyLow > 0) {
    levels.push({
      price: keyLevels.monthlyLow,
      type: "MonthHL",
      strength: "strong",
      label: "Monthly Low",
    });
  }

  // ORB Levels
  if (keyLevels.orbHigh && keyLevels.orbHigh > 0) {
    levels.push({
      price: keyLevels.orbHigh,
      type: "ORB",
      strength: "moderate",
      label: "ORB High",
    });
  }

  if (keyLevels.orbLow && keyLevels.orbLow > 0) {
    levels.push({
      price: keyLevels.orbLow,
      type: "ORB",
      strength: "moderate",
      label: "ORB Low",
    });
  }

  // VWAP Levels
  if (keyLevels.vwap && keyLevels.vwap > 0) {
    levels.push({
      price: keyLevels.vwap,
      type: "VWAP",
      strength: "moderate",
      label: "VWAP",
    });
  }

  if (keyLevels.vwapUpperBand && keyLevels.vwapUpperBand > 0) {
    levels.push({
      price: keyLevels.vwapUpperBand,
      type: "VWAP",
      strength: "weak",
      label: "VWAP +1σ",
    });
  }

  if (keyLevels.vwapLowerBand && keyLevels.vwapLowerBand > 0) {
    levels.push({
      price: keyLevels.vwapLowerBand,
      type: "VWAP",
      strength: "weak",
      label: "VWAP -1σ",
    });
  }

  // Bollinger Bands
  if (keyLevels.bollingerUpper && keyLevels.bollingerUpper > 0) {
    levels.push({
      price: keyLevels.bollingerUpper,
      type: "Bollinger",
      strength: "weak",
      label: "BB Upper",
    });
  }

  if (keyLevels.bollingerLower && keyLevels.bollingerLower > 0) {
    levels.push({
      price: keyLevels.bollingerLower,
      type: "Bollinger",
      strength: "weak",
      label: "BB Lower",
    });
  }

  // Pre-market Levels
  if (keyLevels.preMarketHigh && keyLevels.preMarketHigh > 0) {
    levels.push({
      price: keyLevels.preMarketHigh,
      type: "ORB", // Group with ORB
      strength: "moderate",
      label: "PM High",
    });
  }

  if (keyLevels.preMarketLow && keyLevels.preMarketLow > 0) {
    levels.push({
      price: keyLevels.preMarketLow,
      type: "ORB",
      strength: "moderate",
      label: "PM Low",
    });
  }

  return levels;
}

/**
 * Calculate level-aware stop loss
 *
 * @param entryPrice - Entry price for the trade
 * @param direction - Trade direction ('long' or 'short')
 * @param keyLevels - Key levels from risk engine
 * @param atr - Current ATR value
 * @param tradeType - Type of trade (affects max stop distance)
 * @param config - Configuration options
 * @returns Level-aware stop result
 */
export function calculateLevelAwareStop(
  entryPrice: number,
  direction: "long" | "short",
  keyLevels: KeyLevels | KeyLevel[],
  atr: number,
  tradeType: TradeType = "DAY",
  config: LevelAwareStopConfig = DEFAULT_LEVEL_AWARE_CONFIG,
  ivPercentile?: number
): LevelAwareStopResult {
  // Get effective config with trade type overrides
  const effectiveConfig = {
    ...config,
    ...(config.tradeTypeOverrides?.[tradeType] || {}),
  };

  // Convert KeyLevels to KeyLevel array if needed
  const levels = Array.isArray(keyLevels)
    ? keyLevels
    : extractKeyLevelsArray(keyLevels, entryPrice);

  const warnings: string[] = [];

  // Filter levels based on direction
  // For LONG: we need support levels (below entry)
  // For SHORT: we need resistance levels (above entry)
  const relevantLevels = levels
    .filter((level) => {
      if (direction === "long") {
        return level.price < entryPrice;
      } else {
        return level.price > entryPrice;
      }
    })
    .map((level) => ({
      ...level,
      distance: Math.abs(entryPrice - level.price),
      distancePercent: Math.abs((entryPrice - level.price) / entryPrice) * 100,
    }))
    .filter((level) => {
      // Filter by max stop distance
      return level.distancePercent <= effectiveConfig.maxStopPercent;
    });

  // If no relevant levels, fall back to ATR-based stop
  if (relevantLevels.length === 0) {
    const atrStop =
      direction === "long"
        ? entryPrice - atr * effectiveConfig.fallbackATRMultiplier
        : entryPrice + atr * effectiveConfig.fallbackATRMultiplier;

    const distance = Math.abs(entryPrice - atrStop);
    const distancePercent = (distance / entryPrice) * 100;

    warnings.push("No key levels found within range, using ATR-based stop");

    return {
      recommendedStop: atrStop,
      levelType: "ATR",
      levelLabel: `${effectiveConfig.fallbackATRMultiplier}x ATR`,
      levelStrength: "weak",
      distanceFromEntry: distance,
      distancePercent,
      reasoning: `No suitable key levels found. Using ${effectiveConfig.fallbackATRMultiplier}x ATR stop.`,
      confidence: "low",
      alternativeStops: [],
      warnings,
    };
  }

  // Score and rank levels
  const scoredLevels = relevantLevels.map((level) => {
    // Proximity score (closer = higher, normalized 0-100)
    const maxDistancePercent = effectiveConfig.maxStopPercent;
    const proximityScore = (1 - level.distancePercent / maxDistancePercent) * 100;

    // Strength score
    const strengthScore = LEVEL_STRENGTH_SCORES[level.strength] * 33.33; // 33-100

    // Recency score (use touchCount as proxy, more touches = more relevant)
    const touchCount = level.touchCount || 1;
    const recencyScore = Math.min(100, touchCount * 20); // 20-100

    // Weighted total score
    const totalScore =
      proximityScore * effectiveConfig.preferenceWeights.proximity +
      strengthScore * effectiveConfig.preferenceWeights.strength +
      recencyScore * effectiveConfig.preferenceWeights.recency;

    return {
      ...level,
      proximityScore,
      strengthScore,
      recencyScore,
      totalScore,
    };
  });

  // Sort by total score (descending)
  scoredLevels.sort((a, b) => b.totalScore - a.totalScore);

  // Select primary level
  const primaryLevel = scoredLevels[0];

  // Calculate stop with buffer
  // Apply IV-based volatility adjustment (Widen stops in high IV, tighten in low IV)
  let ivMultiplier = 1.0;
  let ivReasoning = "";

  if (ivPercentile !== undefined) {
    if (ivPercentile > 80) {
      ivMultiplier = 1.2; // 20% wider buffer in high IV
      ivReasoning = " (High IV: widened 20%)";
    } else if (ivPercentile < 20) {
      ivMultiplier = 0.9; // 10% tighter buffer in low IV
      ivReasoning = " (Low IV: tightened 10%)";
    }
  }

  const buffer = atr * effectiveConfig.bufferATRMultiplier * ivMultiplier;
  const recommendedStop =
    direction === "long" ? primaryLevel.price - buffer : primaryLevel.price + buffer;

  // Calculate final distance
  const distance = Math.abs(entryPrice - recommendedStop);
  const distancePercent = (distance / entryPrice) * 100;

  // Validate minimum distance
  if (distancePercent < effectiveConfig.minStopPercent) {
    warnings.push(`Stop too tight (${distancePercent.toFixed(2)}%), consider wider placement`);
  }

  // Build alternative stops from remaining levels
  const alternativeStops: AlternativeStop[] = scoredLevels.slice(1, 4).map((level) => {
    const altStop = direction === "long" ? level.price - buffer : level.price + buffer;
    const altDistance = (Math.abs(entryPrice - altStop) / entryPrice) * 100;

    return {
      price: altStop,
      type: level.type,
      label: level.label,
      distancePercent: altDistance,
      reasoning: `Below ${level.label} (${level.strength})`,
    };
  });

  // Determine confidence based on level strength and distance
  let confidence: "high" | "medium" | "low";
  if (primaryLevel.strength === "strong" && distancePercent <= 3) {
    confidence = "high";
  } else if (primaryLevel.strength !== "weak" || distancePercent <= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    recommendedStop,
    levelType: primaryLevel.type,
    levelLabel: primaryLevel.label,
    levelStrength: primaryLevel.strength,
    distanceFromEntry: distance,
    distancePercent,
    reasoning: `Stop placed ${buffer.toFixed(2)} below ${primaryLevel.label} (${primaryLevel.strength}) at ${primaryLevel.price.toFixed(2)}${ivReasoning}`,
    confidence,
    alternativeStops,
    warnings,
  };
}

/**
 * Calculate level-aware target prices (T1, T2, T3)
 *
 * @param entryPrice - Entry price
 * @param direction - Trade direction
 * @param keyLevels - Key levels
 * @param atr - ATR value
 * @param stopDistance - Distance to stop loss (for R:R calculation)
 * @returns Target prices
 */
export function calculateLevelAwareTargets(
  entryPrice: number,
  direction: "long" | "short",
  calculateRisk: (entryPrice: number, stopLoss: number, accountSize: number) => number,
  keyLevels: KeyLevels | KeyLevel[],
  atr: number,
  stopDistance: number
): {
  T1: number;
  T2: number;
  T3: number;
  reasoning: string[];
} {
  // Convert KeyLevels to KeyLevel array if needed
  const levels = Array.isArray(keyLevels)
    ? keyLevels
    : extractKeyLevelsArray(keyLevels, entryPrice);

  const reasoning: string[] = [];

  // Filter for target levels (opposite direction from stop)
  const targetLevels = levels
    .filter((level) => {
      if (direction === "long") {
        return level.price > entryPrice;
      } else {
        return level.price < entryPrice;
      }
    })
    .map((level) => ({
      ...level,
      distance: Math.abs(level.price - entryPrice),
      distancePercent: Math.abs((level.price - entryPrice) / entryPrice) * 100,
      rMultiple: Math.abs(level.price - entryPrice) / stopDistance,
    }))
    .sort((a, b) => a.distance - b.distance);

  // Find levels at approximately 1R, 2R, and 3R
  const findNearestLevel = (
    targetR: number,
    tolerance: number = 0.5
  ): (KeyLevel & { rMultiple: number }) | null => {
    return (
      targetLevels.find(
        (l) => l.rMultiple >= targetR - tolerance && l.rMultiple <= targetR + tolerance
      ) || null
    );
  };

  // T1: Around 1R (or first level past entry)
  let T1: number;
  const t1Level = findNearestLevel(1.0, 0.5);
  if (t1Level) {
    T1 = t1Level.price;
    reasoning.push(`T1 at ${t1Level.label} (${t1Level.rMultiple.toFixed(1)}R)`);
  } else if (targetLevels.length > 0) {
    T1 = targetLevels[0].price;
    reasoning.push(`T1 at first level: ${targetLevels[0].label}`);
  } else {
    T1 = direction === "long" ? entryPrice + stopDistance * 1.0 : entryPrice - stopDistance * 1.0;
    reasoning.push("T1 at 1R (no levels found)");
  }

  // T2: Around 2R
  let T2: number;
  const t2Level = findNearestLevel(2.0, 0.75);
  if (t2Level) {
    T2 = t2Level.price;
    reasoning.push(`T2 at ${t2Level.label} (${t2Level.rMultiple.toFixed(1)}R)`);
  } else {
    T2 = direction === "long" ? entryPrice + stopDistance * 2.0 : entryPrice - stopDistance * 2.0;
    reasoning.push("T2 at 2R (no suitable level)");
  }

  // T3: Around 3R
  let T3: number;
  const t3Level = findNearestLevel(3.0, 1.0);
  if (t3Level) {
    T3 = t3Level.price;
    reasoning.push(`T3 at ${t3Level.label} (${t3Level.rMultiple.toFixed(1)}R)`);
  } else {
    T3 = direction === "long" ? entryPrice + stopDistance * 3.0 : entryPrice - stopDistance * 3.0;
    reasoning.push("T3 at 3R (no suitable level)");
  }

  return { T1, T2, T3, reasoning };
}

/**
 * Validate that proposed stop is at a technically sound location
 *
 * @param proposedStop - Proposed stop price
 * @param entryPrice - Entry price
 * @param direction - Trade direction
 * @param keyLevels - Key levels
 * @param atr - ATR value
 * @returns Validation result
 */
export function validateStopPlacement(
  proposedStop: number,
  entryPrice: number,
  direction: "long" | "short",
  keyLevels: KeyLevels | KeyLevel[],
  atr: number
): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const levels = Array.isArray(keyLevels)
    ? keyLevels
    : extractKeyLevelsArray(keyLevels, entryPrice);

  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check stop is on correct side
  if (direction === "long" && proposedStop >= entryPrice) {
    issues.push("Stop must be below entry for long trades");
  }
  if (direction === "short" && proposedStop <= entryPrice) {
    issues.push("Stop must be above entry for short trades");
  }

  // Check distance
  const distancePercent = (Math.abs(proposedStop - entryPrice) / entryPrice) * 100;

  if (distancePercent < 0.25) {
    issues.push(`Stop too tight (${distancePercent.toFixed(2)}%)`);
    suggestions.push("Consider widening stop to avoid noise stop-outs");
  }

  if (distancePercent > 10) {
    issues.push(`Stop too wide (${distancePercent.toFixed(2)}%)`);
    suggestions.push("Consider tighter stop or different trade type");
  }

  // Check if stop is near a key level (good) or in no-man's land (bad)
  const nearbyLevels = levels.filter((level) => {
    const levelDistance = Math.abs(level.price - proposedStop);
    return levelDistance < atr * 0.5; // Within 0.5 ATR of a level
  });

  if (nearbyLevels.length === 0 && levels.length > 0) {
    suggestions.push("Stop is not near any key level - consider adjusting to a technical level");
  }

  // Check if stop is inside a level (bad - will likely get triggered)
  const stopCrossesLevel = levels.some((level) => {
    if (direction === "long") {
      // For longs, stop should be BELOW support levels
      return proposedStop > level.price && level.price < entryPrice;
    } else {
      // For shorts, stop should be ABOVE resistance levels
      return proposedStop < level.price && level.price > entryPrice;
    }
  });

  if (stopCrossesLevel) {
    issues.push("Stop is above a support level (long) or below resistance (short)");
    suggestions.push("Place stop BEYOND the key level, not above it");
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}

/**
 * Format level-aware stop result for display
 */
export function formatLevelAwareStop(result: LevelAwareStopResult): string {
  const lines = [
    `Level-Aware Stop Analysis`,
    `─────────────────────────`,
    `Stop: $${result.recommendedStop.toFixed(2)} (${result.distancePercent.toFixed(2)}% from entry)`,
    `Level: ${result.levelLabel} (${result.levelStrength})`,
    `Type: ${result.levelType}`,
    `Confidence: ${result.confidence}`,
    "",
    `Reasoning: ${result.reasoning}`,
  ];

  if (result.alternativeStops.length > 0) {
    lines.push("", "Alternatives:");
    result.alternativeStops.forEach((alt, i) => {
      lines.push(
        `  ${i + 1}. $${alt.price.toFixed(2)} at ${alt.label} (${alt.distancePercent.toFixed(2)}%)`
      );
    });
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    result.warnings.forEach((w) => lines.push(`  ⚠️ ${w}`));
  }

  return lines.join("\n");
}
