/**
 * Structure Levels Detection - Smart Money Concepts (SMC)
 *
 * Detects:
 * - Swing Highs/Lows (Market Structure)
 * - Liquidity Pools (Equal highs/lows)
 * - Order Blocks (Last candle before impulse)
 * - Fair Value Gaps (Imbalances)
 * - Break of Structure / Change of Character (BOS/CHoCH)
 */

import type { Bar } from "../indicators";

// ============================================================================
// Types
// ============================================================================

export type StructureLevelType =
  | "swing-high"
  | "swing-low"
  | "liquidity-high"
  | "liquidity-low"
  | "order-block-bull"
  | "order-block-bear"
  | "fvg-bull"
  | "fvg-bear"
  | "bos-bull"
  | "bos-bear"
  | "choch-bull"
  | "choch-bear";

export interface StructureLevel {
  type: StructureLevelType;
  price: number;
  priceEnd?: number; // For zones (OB, FVG)
  label: string;
  strength: "critical" | "major" | "minor";
  barIndex: number; // Which bar this was detected at
  timestamp: number;
  touches?: number; // How many times price has tested this level
}

export interface StructureDetectionOptions {
  swingLookback?: number; // Default 5
  liquidityThreshold?: number; // Default 0.001 (0.1%)
  minImpulsePercent?: number; // Default 0.5% for OB detection
  maxLevels?: number; // Default 50
}

const DEFAULT_OPTIONS: Required<StructureDetectionOptions> = {
  swingLookback: 5,
  liquidityThreshold: 0.001,
  minImpulsePercent: 0.5,
  maxLevels: 50,
};

// ============================================================================
// Swing High/Low Detection
// ============================================================================

/**
 * Detect swing highs - price higher than N bars on each side
 */
export function detectSwingHighs(bars: Bar[], lookback: number = 5): StructureLevel[] {
  const levels: StructureLevel[] = [];

  for (let i = lookback; i < bars.length - lookback; i++) {
    const current = bars[i];
    let isSwingHigh = true;

    // Check left side
    for (let j = i - lookback; j < i; j++) {
      if (bars[j].high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }

    // Check right side
    if (isSwingHigh) {
      for (let j = i + 1; j <= i + lookback; j++) {
        if (bars[j].high >= current.high) {
          isSwingHigh = false;
          break;
        }
      }
    }

    if (isSwingHigh) {
      levels.push({
        type: "swing-high",
        price: current.high,
        label: `SwH ${current.high.toFixed(2)}`,
        strength: "major",
        barIndex: i,
        timestamp: current.time,
      });
    }
  }

  return levels;
}

/**
 * Detect swing lows - price lower than N bars on each side
 */
export function detectSwingLows(bars: Bar[], lookback: number = 5): StructureLevel[] {
  const levels: StructureLevel[] = [];

  for (let i = lookback; i < bars.length - lookback; i++) {
    const current = bars[i];
    let isSwingLow = true;

    // Check left side
    for (let j = i - lookback; j < i; j++) {
      if (bars[j].low <= current.low) {
        isSwingLow = false;
        break;
      }
    }

    // Check right side
    if (isSwingLow) {
      for (let j = i + 1; j <= i + lookback; j++) {
        if (bars[j].low <= current.low) {
          isSwingLow = false;
          break;
        }
      }
    }

    if (isSwingLow) {
      levels.push({
        type: "swing-low",
        price: current.low,
        label: `SwL ${current.low.toFixed(2)}`,
        strength: "major",
        barIndex: i,
        timestamp: current.time,
      });
    }
  }

  return levels;
}

// ============================================================================
// Liquidity Pool Detection (Equal Highs/Lows)
// ============================================================================

/**
 * Detect liquidity pools - clusters of equal highs/lows where stops accumulate
 */
export function detectLiquidityPools(
  bars: Bar[],
  threshold: number = 0.001 // 0.1% tolerance
): StructureLevel[] {
  const levels: StructureLevel[] = [];
  const highClusters: Map<number, { price: number; count: number; indices: number[] }> = new Map();
  const lowClusters: Map<number, { price: number; count: number; indices: number[] }> = new Map();

  // Group highs and lows by rounded price
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const avgPrice = (bar.high + bar.low) / 2;
    const tolerance = avgPrice * threshold;

    // Check highs
    const roundedHigh = Math.round(bar.high / tolerance) * tolerance;
    const highKey = roundedHigh;
    if (!highClusters.has(highKey)) {
      highClusters.set(highKey, { price: bar.high, count: 0, indices: [] });
    }
    const hc = highClusters.get(highKey)!;
    hc.count++;
    hc.indices.push(i);
    hc.price = (hc.price * (hc.count - 1) + bar.high) / hc.count; // Running average

    // Check lows
    const roundedLow = Math.round(bar.low / tolerance) * tolerance;
    const lowKey = roundedLow;
    if (!lowClusters.has(lowKey)) {
      lowClusters.set(lowKey, { price: bar.low, count: 0, indices: [] });
    }
    const lc = lowClusters.get(lowKey)!;
    lc.count++;
    lc.indices.push(i);
    lc.price = (lc.price * (lc.count - 1) + bar.low) / lc.count;
  }

  // Find clusters with 3+ equal highs (liquidity above)
  for (const [, cluster] of highClusters) {
    if (cluster.count >= 3) {
      levels.push({
        type: "liquidity-high",
        price: cluster.price,
        label: `LIQ ${cluster.price.toFixed(2)} (${cluster.count}x)`,
        strength: cluster.count >= 5 ? "critical" : "major",
        barIndex: cluster.indices[cluster.indices.length - 1],
        timestamp: bars[cluster.indices[cluster.indices.length - 1]].time,
        touches: cluster.count,
      });
    }
  }

  // Find clusters with 3+ equal lows (liquidity below)
  for (const [, cluster] of lowClusters) {
    if (cluster.count >= 3) {
      levels.push({
        type: "liquidity-low",
        price: cluster.price,
        label: `LIQ ${cluster.price.toFixed(2)} (${cluster.count}x)`,
        strength: cluster.count >= 5 ? "critical" : "major",
        barIndex: cluster.indices[cluster.indices.length - 1],
        timestamp: bars[cluster.indices[cluster.indices.length - 1]].time,
        touches: cluster.count,
      });
    }
  }

  return levels;
}

// ============================================================================
// Order Block Detection
// ============================================================================

/**
 * Detect order blocks - last opposite-color candle before impulse move
 */
export function detectOrderBlocks(bars: Bar[], minImpulsePercent: number = 0.5): StructureLevel[] {
  const levels: StructureLevel[] = [];

  for (let i = 2; i < bars.length; i++) {
    const prev2 = bars[i - 2];
    const prev1 = bars[i - 1];
    const current = bars[i];

    // Calculate impulse move (3-bar move percentage)
    const impulseUp = ((current.close - prev2.open) / prev2.open) * 100;
    const impulseDown = ((prev2.open - current.close) / prev2.open) * 100;

    // Bullish OB: Bearish candle before bullish impulse
    if (impulseUp >= minImpulsePercent) {
      // Find last bearish candle
      let obBar = prev1;
      let obIndex = i - 1;
      if (prev1.close > prev1.open && prev2.close < prev2.open) {
        obBar = prev2;
        obIndex = i - 2;
      }

      if (obBar.close < obBar.open) {
        // Must be bearish
        levels.push({
          type: "order-block-bull",
          price: obBar.low,
          priceEnd: obBar.high,
          label: `OB+ ${obBar.low.toFixed(2)}-${obBar.high.toFixed(2)}`,
          strength: impulseUp >= 1 ? "critical" : "major",
          barIndex: obIndex,
          timestamp: obBar.time,
        });
      }
    }

    // Bearish OB: Bullish candle before bearish impulse
    if (impulseDown >= minImpulsePercent) {
      let obBar = prev1;
      let obIndex = i - 1;
      if (prev1.close < prev1.open && prev2.close > prev2.open) {
        obBar = prev2;
        obIndex = i - 2;
      }

      if (obBar.close > obBar.open) {
        // Must be bullish
        levels.push({
          type: "order-block-bear",
          price: obBar.high,
          priceEnd: obBar.low,
          label: `OB- ${obBar.low.toFixed(2)}-${obBar.high.toFixed(2)}`,
          strength: impulseDown >= 1 ? "critical" : "major",
          barIndex: obIndex,
          timestamp: obBar.time,
        });
      }
    }
  }

  return levels;
}

// ============================================================================
// Fair Value Gap Detection
// ============================================================================

/**
 * Detect fair value gaps - imbalance zones between wicks
 */
export function detectFairValueGaps(bars: Bar[]): StructureLevel[] {
  const levels: StructureLevel[] = [];

  for (let i = 2; i < bars.length; i++) {
    const bar1 = bars[i - 2];
    const bar3 = bars[i];

    // Bullish FVG: Gap between bar1's high and bar3's low
    if (bar3.low > bar1.high) {
      const gapSize = ((bar3.low - bar1.high) / bar1.high) * 100;
      if (gapSize >= 0.1) {
        // At least 0.1% gap
        levels.push({
          type: "fvg-bull",
          price: bar1.high,
          priceEnd: bar3.low,
          label: `FVG+ ${bar1.high.toFixed(2)}-${bar3.low.toFixed(2)}`,
          strength: gapSize >= 0.5 ? "major" : "minor",
          barIndex: i - 1,
          timestamp: bars[i - 1].time,
        });
      }
    }

    // Bearish FVG: Gap between bar3's high and bar1's low
    if (bar1.low > bar3.high) {
      const gapSize = ((bar1.low - bar3.high) / bar3.high) * 100;
      if (gapSize >= 0.1) {
        levels.push({
          type: "fvg-bear",
          price: bar3.high,
          priceEnd: bar1.low,
          label: `FVG- ${bar3.high.toFixed(2)}-${bar1.low.toFixed(2)}`,
          strength: gapSize >= 0.5 ? "major" : "minor",
          barIndex: i - 1,
          timestamp: bars[i - 1].time,
        });
      }
    }
  }

  return levels;
}

// ============================================================================
// Break of Structure / Change of Character
// ============================================================================

/**
 * Detect BOS (Break of Structure) and CHoCH (Change of Character)
 * Requires swing highs/lows as input
 */
export function detectStructureBreaks(
  bars: Bar[],
  swingHighs: StructureLevel[],
  swingLows: StructureLevel[]
): StructureLevel[] {
  const levels: StructureLevel[] = [];

  // Track last swing high/low
  let lastSwingHigh: StructureLevel | null = null;
  let lastSwingLow: StructureLevel | null = null;
  let trendDirection: "bullish" | "bearish" | "neutral" = "neutral";

  // Sort swings by bar index
  const allSwings = [...swingHighs, ...swingLows].sort((a, b) => a.barIndex - b.barIndex);

  for (const swing of allSwings) {
    if (swing.type === "swing-high") {
      // Check for BOS/CHoCH on break above previous swing high
      if (lastSwingHigh && swing.price > lastSwingHigh.price) {
        if (trendDirection === "bearish") {
          // CHoCH - Change of Character (trend reversal)
          levels.push({
            type: "choch-bull",
            price: lastSwingHigh.price,
            label: `CHoCH ${lastSwingHigh.price.toFixed(2)}`,
            strength: "critical",
            barIndex: swing.barIndex,
            timestamp: swing.timestamp,
          });
          trendDirection = "bullish";
        } else {
          // BOS - Break of Structure (trend continuation)
          levels.push({
            type: "bos-bull",
            price: lastSwingHigh.price,
            label: `BOS ${lastSwingHigh.price.toFixed(2)}`,
            strength: "major",
            barIndex: swing.barIndex,
            timestamp: swing.timestamp,
          });
          trendDirection = "bullish";
        }
      }
      lastSwingHigh = swing;
    } else if (swing.type === "swing-low") {
      // Check for BOS/CHoCH on break below previous swing low
      if (lastSwingLow && swing.price < lastSwingLow.price) {
        if (trendDirection === "bullish") {
          // CHoCH - Change of Character (trend reversal)
          levels.push({
            type: "choch-bear",
            price: lastSwingLow.price,
            label: `CHoCH ${lastSwingLow.price.toFixed(2)}`,
            strength: "critical",
            barIndex: swing.barIndex,
            timestamp: swing.timestamp,
          });
          trendDirection = "bearish";
        } else {
          // BOS - Break of Structure (trend continuation)
          levels.push({
            type: "bos-bear",
            price: lastSwingLow.price,
            label: `BOS ${lastSwingLow.price.toFixed(2)}`,
            strength: "major",
            barIndex: swing.barIndex,
            timestamp: swing.timestamp,
          });
          trendDirection = "bearish";
        }
      }
      lastSwingLow = swing;
    }
  }

  return levels;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect all structure levels from bar data
 */
export function detectAllStructureLevels(
  bars: Bar[],
  options?: StructureDetectionOptions
): StructureLevel[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (bars.length < opts.swingLookback * 2 + 1) {
    return [];
  }

  // Detect all structure types
  const swingHighs = detectSwingHighs(bars, opts.swingLookback);
  const swingLows = detectSwingLows(bars, opts.swingLookback);
  const liquidityPools = detectLiquidityPools(bars, opts.liquidityThreshold);
  const orderBlocks = detectOrderBlocks(bars, opts.minImpulsePercent);
  const fairValueGaps = detectFairValueGaps(bars);
  const structureBreaks = detectStructureBreaks(bars, swingHighs, swingLows);

  // Combine all levels
  const allLevels = [
    ...swingHighs,
    ...swingLows,
    ...liquidityPools,
    ...orderBlocks,
    ...fairValueGaps,
    ...structureBreaks,
  ];

  // Sort by price descending and limit
  return allLevels.sort((a, b) => b.price - a.price).slice(0, opts.maxLevels);
}

/**
 * Filter structure levels to those near current price
 */
export function filterNearbyLevels(
  levels: StructureLevel[],
  currentPrice: number,
  maxDistancePercent: number = 3
): StructureLevel[] {
  return levels.filter((level) => {
    const distance = (Math.abs(level.price - currentPrice) / currentPrice) * 100;
    return distance <= maxDistancePercent;
  });
}

/**
 * Find confluence zones where multiple levels cluster
 */
export function findConfluenceZones(
  levels: StructureLevel[],
  clusterThreshold: number = 0.003 // 0.3%
): { price: number; levels: StructureLevel[]; strength: "critical" | "major" }[] {
  const zones: { price: number; levels: StructureLevel[]; strength: "critical" | "major" }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < levels.length; i++) {
    if (used.has(i)) continue;

    const cluster: StructureLevel[] = [levels[i]];
    used.add(i);

    for (let j = i + 1; j < levels.length; j++) {
      if (used.has(j)) continue;

      const priceDiff = Math.abs(levels[i].price - levels[j].price) / levels[i].price;
      if (priceDiff <= clusterThreshold) {
        cluster.push(levels[j]);
        used.add(j);
      }
    }

    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((sum, l) => sum + l.price, 0) / cluster.length;
      zones.push({
        price: avgPrice,
        levels: cluster,
        strength: cluster.length >= 3 ? "critical" : "major",
      });
    }
  }

  return zones;
}
