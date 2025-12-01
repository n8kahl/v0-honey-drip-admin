/**
 * LTP Patience Candle Detection Utility
 *
 * Implements the KCU Patience Candle methodology:
 * - Patience Candle = Small consolidation candle that signals optimal entry
 * - Inside Bar Pattern: High < Previous High, Low > Previous Low
 * - Entry: Break of patience candle high (long) or low (short)
 * - Stop Loss: Other side of patience candle
 *
 * Key principles from KCU training:
 * - "Wait for the trade to come to you (patience)"
 * - Small body relative to previous candle = reduced risk
 * - Contained within previous range = coiled energy
 */

import type { Bar } from "../../../../strategy/patternDetection.js";
import type { LTPPatienceCandle, KCUSetupQuality } from "../types.js";

/**
 * Configuration for patience candle detection
 */
export interface PatienceCandleConfig {
  /** Maximum body size relative to ATR (default 0.3 = 30% of ATR) */
  maxBodyRatio: number;

  /** Maximum body size relative to previous candle body (default 0.5) */
  maxBodyVsPrevious: number;

  /** Minimum inside bar requirement (true = strict inside bar) */
  requireInsideBar: boolean;

  /** Look for consecutive patience candles */
  maxConsecutiveCount: number;
}

const DEFAULT_CONFIG: PatienceCandleConfig = {
  maxBodyRatio: 0.4,
  maxBodyVsPrevious: 0.6,
  requireInsideBar: false,
  maxConsecutiveCount: 3,
};

/**
 * Calculate candle body size
 */
function getBodySize(bar: Bar): number {
  return Math.abs(bar.close - bar.open);
}

/**
 * Calculate candle range (wick to wick)
 */
function getCandleRange(bar: Bar): number {
  return bar.high - bar.low;
}

/**
 * Check if bar is an inside bar relative to previous
 */
function isInsideBar(current: Bar, previous: Bar): boolean {
  return current.high < previous.high && current.low > previous.low;
}

/**
 * Determine close position within candle range
 */
function getClosePosition(bar: Bar): LTPPatienceCandle["closePosition"] {
  const range = getCandleRange(bar);
  if (range === 0) return "mid_range";

  const closeFromLow = bar.close - bar.low;
  const ratio = closeFromLow / range;

  // Near open check (doji-like)
  const bodySize = getBodySize(bar);
  if (bodySize < range * 0.1) {
    return "near_open";
  }

  if (ratio > 0.7) return "near_high";
  if (ratio < 0.3) return "near_low";
  return "mid_range";
}

/**
 * Calculate quality grade for patience candle setup
 */
function calculateQuality(
  isInside: boolean,
  bodyRatio: number,
  containedCount: number,
  volumeDecreasing: boolean
): KCUSetupQuality {
  let score = 0;

  // Inside bar is ideal
  if (isInside) score += 30;

  // Smaller body = better
  if (bodyRatio < 0.2) score += 25;
  else if (bodyRatio < 0.3) score += 20;
  else if (bodyRatio < 0.4) score += 15;
  else score += 5;

  // Multiple contained bars = coiled energy
  if (containedCount >= 3) score += 25;
  else if (containedCount >= 2) score += 15;
  else if (containedCount >= 1) score += 10;

  // Volume declining into consolidation is bullish
  if (volumeDecreasing) score += 20;

  // Determine grade
  if (score >= 80) return "A+";
  if (score >= 60) return "A";
  if (score >= 40) return "B";
  return "Avoid";
}

/**
 * Count consecutive contained/consolidation bars leading up to current
 */
function countContainedBars(bars: Bar[], currentIndex: number, maxLookback: number = 5): number {
  if (currentIndex < 1) return 0;

  let count = 0;
  const anchorBar = bars[currentIndex - 1]; // Previous bar as anchor
  const anchorRange = getCandleRange(anchorBar);

  for (let i = currentIndex; i > Math.max(0, currentIndex - maxLookback); i--) {
    const bar = bars[i];
    // Check if bar is contained within anchor range (allowing some tolerance)
    const tolerance = anchorRange * 0.1;
    if (bar.high <= anchorBar.high + tolerance && bar.low >= anchorBar.low - tolerance) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Check if volume is decreasing into consolidation
 */
function isVolumeDecreasing(bars: Bar[], currentIndex: number, lookback: number = 3): boolean {
  if (currentIndex < lookback) return false;

  const currentVolume = bars[currentIndex].volume;
  const avgPriorVolume =
    bars
      .slice(Math.max(0, currentIndex - lookback), currentIndex)
      .reduce((sum, b) => sum + b.volume, 0) / lookback;

  return currentVolume < avgPriorVolume * 0.8; // 20% less volume
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Detect LTP Patience Candle
 *
 * @param bars Price bars (sorted chronologically, oldest first)
 * @param atr Average True Range for body ratio calculation
 * @param config Optional configuration
 * @returns LTPPatienceCandle detection result
 */
export function detectLTPPatienceCandle(
  bars: Bar[],
  atr: number,
  config: Partial<PatienceCandleConfig> = {}
): LTPPatienceCandle {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Default result for no detection
  const noDetection: LTPPatienceCandle = {
    detected: false,
    quality: "Avoid",
    barIndex: -1,
    entryTrigger: { longBreak: 0, shortBreak: 0 },
    stopLevel: 0,
    isInsideBar: false,
    bodyRatio: 0,
    containedCount: 0,
    closePosition: "mid_range",
    timestamp: 0,
  };

  if (!bars || bars.length < 3 || !atr || atr <= 0) {
    return noDetection;
  }

  // Check the most recent bar as potential patience candle
  const currentIndex = bars.length - 1;
  const currentBar = bars[currentIndex];
  const previousBar = bars[currentIndex - 1];

  // Calculate body size ratio to ATR
  const bodySize = getBodySize(currentBar);
  const bodyRatio = bodySize / atr;

  // Check if body is small enough
  if (bodyRatio > cfg.maxBodyRatio) {
    return noDetection;
  }

  // Check body size relative to previous candle
  const prevBodySize = getBodySize(previousBar);
  if (prevBodySize > 0 && bodySize / prevBodySize > cfg.maxBodyVsPrevious) {
    return noDetection;
  }

  // Check for inside bar
  const isInside = isInsideBar(currentBar, previousBar);

  // If strict inside bar required but not met
  if (cfg.requireInsideBar && !isInside) {
    return noDetection;
  }

  // Count contained bars
  const containedCount = countContainedBars(bars, currentIndex, cfg.maxConsecutiveCount);

  // Check volume pattern
  const volumeDecreasing = isVolumeDecreasing(bars, currentIndex);

  // Calculate quality
  const quality = calculateQuality(isInside, bodyRatio, containedCount, volumeDecreasing);

  // Get close position
  const closePosition = getClosePosition(currentBar);

  // Determine entry trigger levels
  const entryTrigger = {
    longBreak: currentBar.high + 0.01, // Slight buffer above high
    shortBreak: currentBar.low - 0.01, // Slight buffer below low
  };

  // Stop level is other side of patience candle
  // For longs, stop is below PC low; for shorts, stop is above PC high
  // We'll return the low as default (caller determines based on direction)
  const stopLevel = currentBar.low;

  return {
    detected: true,
    quality,
    barIndex: 0, // Most recent bar
    entryTrigger,
    stopLevel,
    isInsideBar: isInside,
    bodyRatio,
    containedCount,
    closePosition,
    timestamp: currentBar.time,
  };
}

/**
 * Get patience candle score for confluence calculation (0-100)
 */
export function getPatienceCandleScore(patienceCandle: LTPPatienceCandle): number {
  if (!patienceCandle.detected) return 0;

  let score = 0;

  // Quality-based base score
  switch (patienceCandle.quality) {
    case "A+":
      score = 85;
      break;
    case "A":
      score = 70;
      break;
    case "B":
      score = 50;
      break;
    default:
      score = 0;
  }

  // Bonus for inside bar
  if (patienceCandle.isInsideBar) {
    score += 10;
  }

  // Bonus for multiple contained bars
  if (patienceCandle.containedCount >= 2) {
    score += 5;
  }

  // Very small body is ideal
  if (patienceCandle.bodyRatio < 0.2) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * Calculate stop distance from patience candle
 *
 * @param patienceCandle Patience candle detection
 * @param direction Trade direction
 * @param currentBar Current price bar
 * @returns Stop distance in price units
 */
export function calculatePatienceCandleStopDistance(
  patienceCandle: LTPPatienceCandle,
  direction: "LONG" | "SHORT",
  currentBar: Bar
): number {
  if (!patienceCandle.detected) return 0;

  if (direction === "LONG") {
    // Stop below patience candle low
    return patienceCandle.entryTrigger.longBreak - patienceCandle.stopLevel;
  } else {
    // Stop above patience candle high
    return currentBar.high - patienceCandle.entryTrigger.shortBreak;
  }
}

/**
 * Find the best patience candle in recent bars
 * Useful when looking for setups within a window
 *
 * @param bars Price bars
 * @param atr ATR value
 * @param lookback How many bars to check
 * @returns Best patience candle found, or null
 */
export function findBestPatienceCandle(
  bars: Bar[],
  atr: number,
  lookback: number = 5
): LTPPatienceCandle | null {
  if (!bars || bars.length < 3) return null;

  let bestCandle: LTPPatienceCandle | null = null;
  let bestScore = 0;

  for (let i = bars.length - 1; i >= Math.max(0, bars.length - lookback); i--) {
    // Create a slice ending at this bar
    const slice = bars.slice(0, i + 1);
    const result = detectLTPPatienceCandle(slice, atr);

    if (result.detected) {
      const score = getPatienceCandleScore(result);
      if (score > bestScore) {
        bestScore = score;
        bestCandle = {
          ...result,
          barIndex: bars.length - 1 - i, // Adjust index relative to full array
        };
      }
    }
  }

  return bestCandle;
}

/**
 * Format patience candle for display
 */
export function formatPatienceCandle(pc: LTPPatienceCandle): string {
  if (!pc.detected) {
    return "No Patience Candle";
  }

  const insideMarker = pc.isInsideBar ? " (Inside Bar)" : "";
  return `${pc.quality} Setup${insideMarker} - Entry: ${pc.entryTrigger.longBreak.toFixed(2)} / ${pc.entryTrigger.shortBreak.toFixed(2)}`;
}
