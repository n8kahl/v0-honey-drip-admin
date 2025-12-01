/**
 * KCU LTP Utility Functions Index
 *
 * Exports utility functions for LTP (Levels, Trends, Patience) analysis.
 */

// Trend Detection
export {
  detectLTPTrend,
  isTrendTradeable,
  getTrendScore,
  formatLTPTrend,
} from "./trend-detection.js";

// Patience Candle Detection
export {
  detectLTPPatienceCandle,
  getPatienceCandleScore,
  calculatePatienceCandleStopDistance,
  findBestPatienceCandle,
  formatPatienceCandle,
} from "./patience-candle.js";

// Level Confluence Detection
export {
  buildKCULevels,
  detectKingQueenConfluence,
  findLevelConfluences,
  getLevelConfluenceScore,
  findNearestLevels,
  formatLevelConfluence,
} from "./level-confluence.js";
