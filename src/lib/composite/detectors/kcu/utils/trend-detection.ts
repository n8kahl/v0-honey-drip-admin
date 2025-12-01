/**
 * LTP Trend Detection Utility
 *
 * Implements the KCU trend confirmation methodology:
 * - Uptrend: Higher Highs + Higher Lows
 * - Downtrend: Lower Highs + Lower Lows
 * - Chop: Mixed structure, no clear direction
 *
 * Key principles from KCU training:
 * - "Potential higher high/low only CONFIRMED when previous structure breaks"
 * - Track "micro trends" (short-term reversals within larger trends)
 * - ORB breakout direction often sets the day's trend
 */

import type { Bar } from "../../../../strategy/patternDetection.js";
import type { LTPTrend, LTPTrendDirection, ORBBreakStatus } from "../types.js";

/**
 * Swing point for trend structure analysis
 */
interface SwingPoint {
  type: "high" | "low";
  price: number;
  barIndex: number;
  timestamp: number;
}

/**
 * Find swing highs and lows in a bar series
 * Uses simple 3-bar reversal pattern (center bar higher/lower than neighbors)
 *
 * @param bars Price bars
 * @param lookback Number of bars on each side to confirm swing
 */
function findSwingPoints(bars: Bar[], lookback: number = 2): SwingPoint[] {
  const swingPoints: SwingPoint[] = [];

  if (bars.length < lookback * 2 + 1) {
    return swingPoints;
  }

  for (let i = lookback; i < bars.length - lookback; i++) {
    const current = bars[i];

    // Check for swing high
    let isSwingHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i - j].high >= current.high || bars[i + j].high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }

    // Check for swing low
    let isSwingLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i - j].low <= current.low || bars[i + j].low <= current.low) {
        isSwingLow = false;
        break;
      }
    }

    if (isSwingHigh) {
      swingPoints.push({
        type: "high",
        price: current.high,
        barIndex: i,
        timestamp: current.time,
      });
    }

    if (isSwingLow) {
      swingPoints.push({
        type: "low",
        price: current.low,
        barIndex: i,
        timestamp: current.time,
      });
    }
  }

  return swingPoints.sort((a, b) => a.barIndex - b.barIndex);
}

/**
 * Count higher highs/lows and lower highs/lows from swing points
 */
function countSwingStructure(swingPoints: SwingPoint[]): {
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
} {
  let higherHighs = 0;
  let higherLows = 0;
  let lowerHighs = 0;
  let lowerLows = 0;

  const highs = swingPoints.filter((p) => p.type === "high");
  const lows = swingPoints.filter((p) => p.type === "low");

  // Count consecutive higher highs
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) {
      higherHighs++;
    } else if (highs[i].price < highs[i - 1].price) {
      lowerHighs++;
    }
  }

  // Count consecutive higher lows
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) {
      higherLows++;
    } else if (lows[i].price < lows[i - 1].price) {
      lowerLows++;
    }
  }

  return { higherHighs, higherLows, lowerHighs, lowerLows };
}

/**
 * Determine trend direction from swing structure
 */
function determineTrendDirection(
  structure: ReturnType<typeof countSwingStructure>
): LTPTrendDirection {
  const { higherHighs, higherLows, lowerHighs, lowerLows } = structure;

  // Uptrend: More higher highs AND higher lows than lower
  const bullishScore = higherHighs + higherLows;
  const bearishScore = lowerHighs + lowerLows;

  // Clear uptrend
  if (bullishScore >= 2 && bullishScore > bearishScore * 2) {
    return "UPTREND";
  }

  // Clear downtrend
  if (bearishScore >= 2 && bearishScore > bullishScore * 2) {
    return "DOWNTREND";
  }

  // Mixed or insufficient structure = chop
  return "CHOP";
}

/**
 * Calculate trend strength (0-100)
 */
function calculateTrendStrength(
  direction: LTPTrendDirection,
  structure: ReturnType<typeof countSwingStructure>,
  orbStatus: ORBBreakStatus,
  premarketStatus: ORBBreakStatus
): number {
  if (direction === "CHOP") {
    return 0;
  }

  let strength = 50; // Base strength

  const { higherHighs, higherLows, lowerHighs, lowerLows } = structure;

  if (direction === "UPTREND") {
    // Add points for swing structure
    strength += Math.min(20, higherHighs * 5);
    strength += Math.min(15, higherLows * 5);

    // ORB confirmation
    if (orbStatus === "HIGH") strength += 10;
    if (premarketStatus === "HIGH") strength += 5;

    // Deduct for opposing structure
    strength -= lowerHighs * 3;
    strength -= lowerLows * 3;
  } else {
    // Downtrend
    strength += Math.min(20, lowerHighs * 5);
    strength += Math.min(15, lowerLows * 5);

    // ORB confirmation
    if (orbStatus === "LOW") strength += 10;
    if (premarketStatus === "LOW") strength += 5;

    // Deduct for opposing structure
    strength -= higherHighs * 3;
    strength -= higherLows * 3;
  }

  return Math.max(0, Math.min(100, strength));
}

/**
 * Check ORB/Premarket level break status
 */
function checkLevelBreakStatus(currentPrice: number, high: number, low: number): ORBBreakStatus {
  if (currentPrice > high && currentPrice > low) {
    if (currentPrice > high) return "HIGH";
  }
  if (currentPrice < low && currentPrice < high) {
    if (currentPrice < low) return "LOW";
  }
  // Check if both were broken during session
  // This is a simplified version - full implementation would track historical breaks
  return "NONE";
}

/**
 * Detect if this is a micro trend (short-term reversal within larger trend)
 */
function detectMicroTrend(
  shortTermDirection: LTPTrendDirection,
  recentBars: Bar[],
  lookbackBars: number = 10
): boolean {
  if (recentBars.length < lookbackBars * 2) return false;

  // Look at longer-term trend
  const longerTermBars = recentBars.slice(0, -lookbackBars);
  const longerSwings = findSwingPoints(longerTermBars, 3);
  const longerStructure = countSwingStructure(longerSwings);
  const longerDirection = determineTrendDirection(longerStructure);

  // Micro trend if short-term direction differs from longer-term
  return (
    shortTermDirection !== "CHOP" &&
    longerDirection !== "CHOP" &&
    shortTermDirection !== longerDirection
  );
}

/**
 * Get MTF alignment from pre-calculated RSI/trend data
 * This is a placeholder - actual implementation would use marketDataStore data
 */
function getMTFAlignment(features: {
  mtf?: Record<string, { rsi?: Record<string, number> }>;
}): LTPTrend["mtfAlignment"] {
  const defaultAlignment: LTPTrend["mtfAlignment"] = {
    "1m": "CHOP",
    "5m": "CHOP",
    "15m": "CHOP",
    "60m": "CHOP",
  };

  if (!features.mtf) return defaultAlignment;

  // Determine direction based on RSI levels
  const timeframes = ["1m", "5m", "15m", "60m"] as const;

  for (const tf of timeframes) {
    const tfData = features.mtf[tf];
    if (tfData?.rsi?.["14"]) {
      const rsi = tfData.rsi["14"];
      if (rsi > 60) {
        defaultAlignment[tf] = "UPTREND";
      } else if (rsi < 40) {
        defaultAlignment[tf] = "DOWNTREND";
      }
    }
  }

  return defaultAlignment;
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Detect LTP Trend from price bars
 *
 * @param bars Price bars (sorted chronologically, oldest first)
 * @param orbLevels ORB high/low levels
 * @param premarketLevels Premarket high/low levels
 * @param features Optional symbol features for MTF alignment
 * @returns LTPTrend detection result
 */
export function detectLTPTrend(
  bars: Bar[],
  orbLevels: { high: number; low: number },
  premarketLevels: { high: number; low: number },
  features?: { mtf?: Record<string, { rsi?: Record<string, number> }> }
): LTPTrend {
  // Default result for insufficient data
  const defaultResult: LTPTrend = {
    direction: "CHOP",
    strength: 0,
    confirmedAt: Date.now(),
    higherHighs: 0,
    higherLows: 0,
    lowerHighs: 0,
    lowerLows: 0,
    orbBroken: "NONE",
    premarketBroken: "NONE",
    durationMinutes: 0,
    isMicroTrend: false,
    mtfAlignment: {
      "1m": "CHOP",
      "5m": "CHOP",
      "15m": "CHOP",
      "60m": "CHOP",
    },
  };

  if (!bars || bars.length < 10) {
    return defaultResult;
  }

  // Get current price
  const currentBar = bars[bars.length - 1];
  const currentPrice = currentBar.close;

  // Find swing points
  const swingPoints = findSwingPoints(bars, 2);
  const structure = countSwingStructure(swingPoints);

  // Determine direction
  const direction = determineTrendDirection(structure);

  // Check level breaks
  const orbBroken = checkLevelBreakStatus(currentPrice, orbLevels.high, orbLevels.low);
  const premarketBroken = checkLevelBreakStatus(
    currentPrice,
    premarketLevels.high,
    premarketLevels.low
  );

  // Calculate strength
  const strength = calculateTrendStrength(direction, structure, orbBroken, premarketBroken);

  // Find when trend was confirmed (first swing that established direction)
  let confirmedAt = Date.now();
  if (swingPoints.length > 0) {
    confirmedAt = swingPoints[0].timestamp * 1000;
  }

  // Calculate duration
  const durationMinutes = Math.floor((Date.now() - confirmedAt) / 60000);

  // Check for micro trend
  const isMicroTrend = detectMicroTrend(direction, bars);

  // Get MTF alignment
  const mtfAlignment = getMTFAlignment(features || {});

  return {
    direction,
    strength,
    confirmedAt,
    higherHighs: structure.higherHighs,
    higherLows: structure.higherLows,
    lowerHighs: structure.lowerHighs,
    lowerLows: structure.lowerLows,
    orbBroken,
    premarketBroken,
    durationMinutes,
    isMicroTrend,
    mtfAlignment,
  };
}

/**
 * Check if trend is tradeable per KCU methodology
 * "No trend = No trade"
 */
export function isTrendTradeable(trend: LTPTrend): boolean {
  // Must have established trend
  if (trend.direction === "CHOP") return false;

  // Must have minimum strength
  if (trend.strength < 40) return false;

  // Must have confirmed structure
  if (trend.direction === "UPTREND") {
    return trend.higherHighs >= 1 && trend.higherLows >= 1;
  } else {
    return trend.lowerHighs >= 1 && trend.lowerLows >= 1;
  }
}

/**
 * Get trend score for confluence calculation (0-100)
 */
export function getTrendScore(trend: LTPTrend): number {
  if (trend.direction === "CHOP") return 0;

  let score = trend.strength;

  // Bonus for ORB confirmation
  if (
    (trend.direction === "UPTREND" && trend.orbBroken === "HIGH") ||
    (trend.direction === "DOWNTREND" && trend.orbBroken === "LOW")
  ) {
    score += 10;
  }

  // Bonus for MTF alignment
  const alignedCount = Object.values(trend.mtfAlignment).filter(
    (dir) => dir === trend.direction
  ).length;
  score += alignedCount * 5;

  // Penalty for micro trend (counter-trend)
  if (trend.isMicroTrend) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Format trend for display
 */
export function formatLTPTrend(trend: LTPTrend): string {
  if (trend.direction === "CHOP") {
    return "No Clear Trend (Chop)";
  }

  const emoji = trend.direction === "UPTREND" ? "📈" : "📉";
  const strength = trend.strength >= 70 ? "Strong" : trend.strength >= 50 ? "Moderate" : "Weak";

  return `${emoji} ${strength} ${trend.direction}`;
}
