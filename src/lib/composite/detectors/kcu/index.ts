/**
 * KCU LTP Strategy Detectors Index
 *
 * Exports all KCU (Mr. K Capital University) LTP (Levels, Trends, Patience) detectors.
 * These implement the KCU trading methodology for systematic day trading.
 *
 * Strategies included:
 * - EMA Bounce: Pullback to 8 EMA in trend
 * - VWAP Standard: VWAP bounce after 10:00 AM
 * - King & Queen: VWAP + level confluence
 * - ORB Breakout: Opening Range Breakout
 *
 * Usage:
 * - Import ALL_KCU_DETECTORS for full KCU strategy suite
 * - Import individual detector arrays for specific strategies
 * - Use isKCUOpportunityType() to check if a signal is from KCU
 */

// Types
export * from "./types.js";

// Utilities
export {
  detectLTPTrend,
  isTrendTradeable,
  getTrendScore,
  formatLTPTrend,
} from "./utils/trend-detection.js";
export {
  detectLTPPatienceCandle,
  getPatienceCandleScore,
  findBestPatienceCandle,
  formatPatienceCandle,
} from "./utils/patience-candle.js";
export {
  buildKCULevels,
  detectKingQueenConfluence,
  findLevelConfluences,
  getLevelConfluenceScore,
  findNearestLevels,
  formatLevelConfluence,
} from "./utils/level-confluence.js";

// Individual Detector Arrays
export { KCU_EMA_BOUNCE_DETECTORS } from "./kcu-ema-bounce.js";
export { KCU_VWAP_STANDARD_DETECTORS } from "./kcu-vwap-standard.js";
export { KCU_KING_QUEEN_DETECTORS } from "./kcu-king-queen.js";
export { KCU_ORB_BREAKOUT_DETECTORS } from "./kcu-orb-breakout.js";

// Import for combined export
import { KCU_EMA_BOUNCE_DETECTORS } from "./kcu-ema-bounce.js";
import { KCU_VWAP_STANDARD_DETECTORS } from "./kcu-vwap-standard.js";
import { KCU_KING_QUEEN_DETECTORS } from "./kcu-king-queen.js";
import { KCU_ORB_BREAKOUT_DETECTORS } from "./kcu-orb-breakout.js";
import type { OpportunityDetector } from "../../OpportunityDetector.js";

/**
 * All KCU LTP Strategy Detectors
 * Total: 8 detectors (4 strategies × 2 directions)
 */
export const ALL_KCU_DETECTORS: OpportunityDetector[] = [
  ...KCU_EMA_BOUNCE_DETECTORS,
  ...KCU_VWAP_STANDARD_DETECTORS,
  ...KCU_KING_QUEEN_DETECTORS,
  ...KCU_ORB_BREAKOUT_DETECTORS,
];

/**
 * KCU Detector count
 */
export const KCU_DETECTOR_COUNT = ALL_KCU_DETECTORS.length;

/**
 * KCU Strategy names for UI display
 */
export const KCU_STRATEGY_NAMES = {
  kcu_ema_bounce: "EMA Bounce",
  kcu_vwap_standard: "VWAP Standard",
  kcu_vwap_advanced: "VWAP Reclaim",
  kcu_king_queen: "King & Queen",
  kcu_orb_breakout: "ORB Breakout",
  kcu_cloud_bounce: "Cloud Bounce",
} as const;

/**
 * KCU Strategy descriptions
 */
export const KCU_STRATEGY_DESCRIPTIONS = {
  kcu_ema_bounce: "Pullback to 8 EMA with patience candle in established trend",
  kcu_vwap_standard: "VWAP bounce in trend direction (active after 10:00 AM)",
  kcu_vwap_advanced: "VWAP reclaim from below - long only strategy",
  kcu_king_queen: "VWAP (King) + additional level (Queen) confluence",
  kcu_orb_breakout: "Opening Range Breakout with volume confirmation",
  kcu_cloud_bounce: "Ripster Cloud bounce in afternoon session",
} as const;

/**
 * KCU Strategy time windows
 */
export const KCU_STRATEGY_TIME_WINDOWS = {
  kcu_ema_bounce: { start: "10:00", end: "15:00", note: "After trend established" },
  kcu_vwap_standard: { start: "10:00", end: "14:30", note: "After first 30 min" },
  kcu_vwap_advanced: { start: "10:15", end: "14:00", note: "After VWAP test" },
  kcu_king_queen: { start: "09:40", end: "15:00", note: "All day" },
  kcu_orb_breakout: { start: "09:45", end: "11:00", note: "First hour only" },
  kcu_cloud_bounce: { start: "13:00", end: "15:00", note: "Afternoon only" },
} as const;

/**
 * Check if a detector type is a KCU strategy
 */
export function isKCUDetector(type: string): boolean {
  return type.startsWith("kcu_");
}

/**
 * Get recommended timeframe for a KCU strategy
 */
export function getKCUTimeframe(
  type: string,
  minutesSinceOpen: number
): "2m" | "5m" | "10m" | "15m" {
  // Per KCU methodology:
  // First 30 min: 2m charts
  // Next 60 min: 5m charts
  // Rest of day: 10m charts
  if (minutesSinceOpen <= 30) {
    return "2m";
  }
  if (minutesSinceOpen <= 90) {
    return "5m";
  }
  return "10m";
}
