/**
 * Utility to detect and determine chart display mode based on trade state
 * Optimizes data loading and UI rendering for day trading workflows
 */

import type { Trade, TradeState } from "../../types";

export type ChartMode = "BROWSE" | "LOADED" | "ENTERED";

export interface ChartModeConfig {
  mode: ChartMode;
  timeframes: ("1" | "5" | "15" | "60" | "1D")[];
  defaultTimeframe: "1" | "5" | "15" | "60" | "1D";
  indicators: {
    ema: number[];
    vwap: boolean;
  };
  historicalBarCount: number;
  showKeyLevels: boolean;
  showTradeMetrics: boolean;
  dualTimeframeView: boolean;
  cacheKey: string;
  cacheTTL: number; // seconds
}

/**
 * Determine chart mode based on trade state and availability
 */
export function detectChartMode(
  tradeState: TradeState,
  currentTrade: Trade | null,
  hasLoadedContract: boolean
): ChartMode {
  if (tradeState === "ENTERED" && currentTrade) {
    return "ENTERED";
  }
  if (tradeState === "LOADED" && hasLoadedContract) {
    return "LOADED";
  }
  return "BROWSE";
}

/**
 * Get optimized configuration for a chart mode
 * Reduces data loading and visual clutter for focused trading
 */
export function getChartModeConfig(mode: ChartMode, symbol: string): ChartModeConfig {
  switch (mode) {
    case "BROWSE":
      // Lightweight mode: just 5m for scanning setups
      return {
        mode: "BROWSE",
        timeframes: ["5"],
        defaultTimeframe: "5",
        indicators: {
          ema: [9, 21], // Momentum + trend
          vwap: false,
        },
        historicalBarCount: 20,
        showKeyLevels: false,
        showTradeMetrics: false,
        dualTimeframeView: false,
        cacheKey: `chart:${symbol}:browse`,
        cacheTTL: 60, // 60 seconds
      };

    case "LOADED":
      // Setup mode: 1m (primary) + 5m (secondary) for entry precision, add key levels
      return {
        mode: "LOADED",
        timeframes: ["1", "5"], // Only 1m and 5m for focused entry
        defaultTimeframe: "1", // 1m is primary for entry precision
        indicators: {
          ema: [9, 21], // Momentum + trend
          vwap: true, // Order flow context
        },
        historicalBarCount: 400, // ~1 day of 1m bars + 5m bars
        showKeyLevels: true,
        showTradeMetrics: false,
        dualTimeframeView: true, // Show 1m + 5m side-by-side
        cacheKey: `chart:${symbol}:loaded`,
        cacheTTL: 120, // 120 seconds
      };

    case "ENTERED":
      // Trade mode: focus on 1m, show P&L and levels
      return {
        mode: "ENTERED",
        timeframes: ["1"], // 1m only - real-time trade management
        defaultTimeframe: "1",
        indicators: {
          ema: [9], // Minimal - focus on price action
          vwap: true,
        },
        historicalBarCount: 30,
        showKeyLevels: true,
        showTradeMetrics: true,
        dualTimeframeView: false,
        cacheKey: `chart:${symbol}:entered`,
        cacheTTL: 300, // 300 seconds - won't change during trade
      };
  }
}

/**
 * Get safe timeframe defaults based on mode
 * Prevents loading unnecessary data
 */
export function getSafeTimeframe(
  requestedTf: string | undefined,
  _mode: ChartMode,
  config: ChartModeConfig
): ChartModeConfig["timeframes"][number] {
  if (!requestedTf) {
    return config.defaultTimeframe;
  }

  const tf = requestedTf as ChartModeConfig["timeframes"][number];
  if (config.timeframes.includes(tf)) {
    return tf;
  }

  return config.defaultTimeframe;
}
