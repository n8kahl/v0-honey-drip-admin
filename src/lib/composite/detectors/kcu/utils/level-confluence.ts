/**
 * LTP Level Confluence Detection Utility
 *
 * Implements the KCU "King & Queen" level confluence methodology:
 * - King = VWAP (always)
 * - Queen = Any other level that aligns with VWAP (8 EMA, 21 EMA, ORB, hourly level)
 *
 * Key principles from KCU training:
 * - "Use confluence (multiple levels at same price point) for high-probability entries"
 * - Levels act as profit targets AND entry confluence zones
 * - More levels stacking = higher probability setup
 */

import type { KCULevel, KCULevelType, KingQueenConfluence, LevelConfluence } from "../types.js";
import type { KeyLevels } from "../../../../riskEngine/types.js";

/**
 * Configuration for level confluence detection
 */
export interface LevelConfluenceConfig {
  /** Proximity threshold for level confluence (percent of price) */
  proximityPercent: number;

  /** Minimum levels required for confluence */
  minLevelsForConfluence: number;

  /** Weight multipliers for different level types */
  levelWeights: Record<KCULevelType, number>;
}

const DEFAULT_CONFIG: LevelConfluenceConfig = {
  proximityPercent: 0.3, // 0.3% = within 30 cents on $100 stock
  minLevelsForConfluence: 2,
  levelWeights: {
    VWAP: 1.5, // King gets premium weight
    EMA_8: 1.2,
    EMA_21: 1.2,
    SMA_200: 1.3,
    ORB_HIGH: 1.1,
    ORB_LOW: 1.1,
    PREMARKET_HIGH: 1.0,
    PREMARKET_LOW: 1.0,
    PRIOR_DAY_HIGH: 1.1,
    PRIOR_DAY_LOW: 1.1,
    PRIOR_DAY_CLOSE: 0.9,
    HOURLY_LEVEL: 1.0,
    FIB_236: 0.8,
    FIB_382: 0.9,
    FIB_500: 0.9,
    FIB_618: 0.9,
    REACTION_LEVEL: 0.7,
    OPEN_PRICE: 0.8,
  },
};

/**
 * Calculate distance between price and level
 */
function calculateDistance(price: number, level: number): number {
  if (price === 0) return Infinity;
  return Math.abs(price - level);
}

/**
 * Calculate distance as percentage
 */
function calculateDistancePercent(price: number, level: number): number {
  if (price === 0) return Infinity;
  return (Math.abs(price - level) / price) * 100;
}

/**
 * Create KCULevel from raw level data
 */
function createKCULevel(
  type: KCULevelType,
  price: number,
  currentPrice: number,
  reactionCount: number = 0
): KCULevel {
  const distancePercent = calculateDistancePercent(currentPrice, price);

  // Determine strength based on type and reaction count
  let strength = 50; // Base strength
  strength += Math.min(30, reactionCount * 10); // Up to 30 for reactions

  // Type-based strength bonus
  if (type === "VWAP") strength += 20;
  if (type === "EMA_8" || type === "EMA_21") strength += 10;
  if (type === "SMA_200") strength += 15;
  if (type.startsWith("PRIOR_DAY")) strength += 10;

  return {
    type,
    price,
    label: formatLevelLabel(type, price),
    strength: Math.min(100, strength),
    reactionCount,
    distancePercent,
    isQueen: false, // Will be set by confluence detection
  };
}

/**
 * Format level label for display
 */
function formatLevelLabel(type: KCULevelType, price: number): string {
  const priceStr = price.toFixed(2);
  const labels: Record<KCULevelType, string> = {
    VWAP: `VWAP ${priceStr}`,
    EMA_8: `8 EMA ${priceStr}`,
    EMA_21: `21 EMA ${priceStr}`,
    SMA_200: `200 SMA ${priceStr}`,
    ORB_HIGH: `ORB H ${priceStr}`,
    ORB_LOW: `ORB L ${priceStr}`,
    PREMARKET_HIGH: `PM H ${priceStr}`,
    PREMARKET_LOW: `PM L ${priceStr}`,
    PRIOR_DAY_HIGH: `PDH ${priceStr}`,
    PRIOR_DAY_LOW: `PDL ${priceStr}`,
    PRIOR_DAY_CLOSE: `PDC ${priceStr}`,
    HOURLY_LEVEL: `60m ${priceStr}`,
    FIB_236: `Fib 23.6 ${priceStr}`,
    FIB_382: `Fib 38.2 ${priceStr}`,
    FIB_500: `Fib 50 ${priceStr}`,
    FIB_618: `Fib 61.8 ${priceStr}`,
    REACTION_LEVEL: `React ${priceStr}`,
    OPEN_PRICE: `Open ${priceStr}`,
  };
  return labels[type] || `${type} ${priceStr}`;
}

/**
 * Check if two levels are within proximity threshold
 */
function areInProximity(
  level1: KCULevel,
  level2: KCULevel,
  currentPrice: number,
  proximityPercent: number
): boolean {
  const distance = calculateDistance(level1.price, level2.price);
  const threshold = (currentPrice * proximityPercent) / 100;
  return distance <= threshold;
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Build KCU levels from key levels and indicator data
 *
 * @param keyLevels Key levels from computeKeyLevels
 * @param indicators Indicator values (EMAs, VWAP, etc.)
 * @param currentPrice Current price
 * @param options Optional level detection configuration
 * @returns Array of KCU levels
 */
export function buildKCULevels(
  keyLevels: KeyLevels,
  indicators: {
    ema8?: number;
    ema21?: number;
    sma200?: number;
    vwap?: number;
    openPrice?: number;
    fib236?: number;
    fib382?: number;
    fib500?: number;
    fib618?: number;
  },
  currentPrice: number
): KCULevel[] {
  const levels: KCULevel[] = [];

  // Add VWAP (The King)
  if (indicators.vwap && indicators.vwap > 0) {
    levels.push(createKCULevel("VWAP", indicators.vwap, currentPrice, 3));
  } else if (keyLevels.vwap && keyLevels.vwap > 0) {
    levels.push(createKCULevel("VWAP", keyLevels.vwap, currentPrice, 3));
  }

  // Add EMAs
  if (indicators.ema8 && indicators.ema8 > 0) {
    levels.push(createKCULevel("EMA_8", indicators.ema8, currentPrice, 2));
  }
  if (indicators.ema21 && indicators.ema21 > 0) {
    levels.push(createKCULevel("EMA_21", indicators.ema21, currentPrice, 2));
  }
  if (indicators.sma200 && indicators.sma200 > 0) {
    levels.push(createKCULevel("SMA_200", indicators.sma200, currentPrice, 3));
  }

  // Add ORB levels
  if (keyLevels.orbHigh && keyLevels.orbHigh > 0) {
    levels.push(createKCULevel("ORB_HIGH", keyLevels.orbHigh, currentPrice, 1));
  }
  if (keyLevels.orbLow && keyLevels.orbLow > 0) {
    levels.push(createKCULevel("ORB_LOW", keyLevels.orbLow, currentPrice, 1));
  }

  // Add Premarket levels
  if (keyLevels.preMarketHigh && keyLevels.preMarketHigh > 0) {
    levels.push(createKCULevel("PREMARKET_HIGH", keyLevels.preMarketHigh, currentPrice, 1));
  }
  if (keyLevels.preMarketLow && keyLevels.preMarketLow > 0) {
    levels.push(createKCULevel("PREMARKET_LOW", keyLevels.preMarketLow, currentPrice, 1));
  }

  // Add Prior Day levels
  if (keyLevels.priorDayHigh && keyLevels.priorDayHigh > 0) {
    levels.push(createKCULevel("PRIOR_DAY_HIGH", keyLevels.priorDayHigh, currentPrice, 2));
  }
  if (keyLevels.priorDayLow && keyLevels.priorDayLow > 0) {
    levels.push(createKCULevel("PRIOR_DAY_LOW", keyLevels.priorDayLow, currentPrice, 2));
  }

  // Add Open Price
  if (indicators.openPrice && indicators.openPrice > 0) {
    levels.push(createKCULevel("OPEN_PRICE", indicators.openPrice, currentPrice, 1));
  }

  // Add Fibonacci levels
  if (indicators.fib236 && indicators.fib236 > 0) {
    levels.push(createKCULevel("FIB_236", indicators.fib236, currentPrice, 0));
  }
  if (indicators.fib382 && indicators.fib382 > 0) {
    levels.push(createKCULevel("FIB_382", indicators.fib382, currentPrice, 0));
  }
  if (indicators.fib500 && indicators.fib500 > 0) {
    levels.push(createKCULevel("FIB_500", indicators.fib500, currentPrice, 0));
  }
  if (indicators.fib618 && indicators.fib618 > 0) {
    levels.push(createKCULevel("FIB_618", indicators.fib618, currentPrice, 0));
  }

  // Sort by distance from current price
  levels.sort((a, b) => a.distancePercent - b.distancePercent);

  return levels;
}

/**
 * Detect King & Queen confluence
 * King = VWAP, Queen = any other level aligning with VWAP
 *
 * @param levels Array of KCU levels
 * @param currentPrice Current price
 * @param config Optional configuration
 * @returns King & Queen confluence result
 */
export function detectKingQueenConfluence(
  levels: KCULevel[],
  currentPrice: number,
  config: Partial<LevelConfluenceConfig> = {}
): KingQueenConfluence {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Find the King (VWAP)
  const king = levels.find((l) => l.type === "VWAP");

  if (!king) {
    return {
      detected: false,
      king: createKCULevel("VWAP", 0, currentPrice, 0),
      queens: [],
      confluenceStrength: 0,
      proximityThreshold: cfg.proximityPercent,
    };
  }

  // Find Queens (levels aligning with VWAP)
  const queens: KCULevel[] = [];

  for (const level of levels) {
    if (level.type === "VWAP") continue;

    if (areInProximity(king, level, currentPrice, cfg.proximityPercent)) {
      queens.push({
        ...level,
        isQueen: true,
      });
    }
  }

  // Calculate confluence strength
  let confluenceStrength = 0;
  if (queens.length > 0) {
    // Base strength from King
    confluenceStrength = king.strength * cfg.levelWeights.VWAP;

    // Add Queen strengths with weights
    for (const queen of queens) {
      confluenceStrength += queen.strength * (cfg.levelWeights[queen.type] || 1.0);
    }

    // Normalize to 0-100
    const maxPossibleStrength = 100 * (1 + queens.length);
    confluenceStrength = Math.min(100, (confluenceStrength / maxPossibleStrength) * 100);
  }

  return {
    detected: queens.length >= 1,
    king,
    queens,
    confluenceStrength,
    proximityThreshold: cfg.proximityPercent,
  };
}

/**
 * Find all level confluences (multiple levels stacking at same price)
 *
 * @param levels Array of KCU levels
 * @param currentPrice Current price
 * @param config Optional configuration
 * @returns Array of level confluences
 */
export function findLevelConfluences(
  levels: KCULevel[],
  currentPrice: number,
  config: Partial<LevelConfluenceConfig> = {}
): LevelConfluence[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const confluences: LevelConfluence[] = [];
  const usedLevels = new Set<KCULevel>();

  // Group nearby levels
  for (const level of levels) {
    if (usedLevels.has(level)) continue;

    const stackedLevels: KCULevel[] = [level];
    usedLevels.add(level);

    // Find other levels within proximity
    for (const otherLevel of levels) {
      if (usedLevels.has(otherLevel)) continue;
      if (level === otherLevel) continue;

      if (areInProximity(level, otherLevel, currentPrice, cfg.proximityPercent)) {
        stackedLevels.push(otherLevel);
        usedLevels.add(otherLevel);
      }
    }

    // Only record if minimum levels met
    if (stackedLevels.length >= cfg.minLevelsForConfluence) {
      // Calculate price zone center
      const priceSum = stackedLevels.reduce((sum, l) => sum + l.price, 0);
      const priceZone = priceSum / stackedLevels.length;

      // Calculate combined strength
      let combinedStrength = 0;
      for (const l of stackedLevels) {
        combinedStrength += l.strength * (cfg.levelWeights[l.type] || 1.0);
      }
      combinedStrength = Math.min(100, combinedStrength / stackedLevels.length);

      // Check if this is a King & Queen confluence
      const hasVWAP = stackedLevels.some((l) => l.type === "VWAP");
      const isKingQueen = hasVWAP && stackedLevels.length >= 2;

      confluences.push({
        priceZone,
        stackedLevels,
        levelCount: stackedLevels.length,
        combinedStrength,
        isKingQueen,
      });
    }
  }

  // Sort by combined strength (highest first)
  confluences.sort((a, b) => b.combinedStrength - a.combinedStrength);

  return confluences;
}

/**
 * Get level confluence score for overall setup scoring (0-100)
 */
export function getLevelConfluenceScore(
  levels: KCULevel[],
  currentPrice: number,
  config: Partial<LevelConfluenceConfig> = {}
): number {
  const kingQueen = detectKingQueenConfluence(levels, currentPrice, config);
  const confluences = findLevelConfluences(levels, currentPrice, config);

  let score = 0;

  // King & Queen bonus
  if (kingQueen.detected) {
    score += 40;
    score += Math.min(20, kingQueen.queens.length * 10);
  }

  // General confluence bonus
  if (confluences.length > 0) {
    const bestConfluence = confluences[0];
    score += Math.min(30, bestConfluence.levelCount * 10);
  }

  // Nearby level bonus (levels within 0.5% of price)
  const nearbyLevels = levels.filter((l) => l.distancePercent < 0.5);
  score += Math.min(10, nearbyLevels.length * 3);

  return Math.min(100, score);
}

/**
 * Find nearest support and resistance levels
 */
export function findNearestLevels(
  levels: KCULevel[],
  currentPrice: number
): { support: KCULevel | null; resistance: KCULevel | null } {
  let nearestSupport: KCULevel | null = null;
  let nearestResistance: KCULevel | null = null;
  let supportDistance = Infinity;
  let resistanceDistance = Infinity;

  for (const level of levels) {
    if (level.price < currentPrice) {
      // Support level
      const distance = currentPrice - level.price;
      if (distance < supportDistance) {
        supportDistance = distance;
        nearestSupport = level;
      }
    } else if (level.price > currentPrice) {
      // Resistance level
      const distance = level.price - currentPrice;
      if (distance < resistanceDistance) {
        resistanceDistance = distance;
        nearestResistance = level;
      }
    }
  }

  return { support: nearestSupport, resistance: nearestResistance };
}

/**
 * Format level confluence for display
 */
export function formatLevelConfluence(confluence: LevelConfluence): string {
  const levelTypes = confluence.stackedLevels.map((l) => l.type).join(", ");
  const kcMarker = confluence.isKingQueen ? " [King & Queen]" : "";
  return `${confluence.levelCount} levels at ${confluence.priceZone.toFixed(2)}${kcMarker}: ${levelTypes}`;
}
