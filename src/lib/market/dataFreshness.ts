/**
 * dataFreshness.ts - Centralized Data Freshness Utilities
 *
 * Provides consistent staleness detection and formatting across the app.
 */

// Staleness thresholds in milliseconds
export const THRESHOLDS = {
  OPTION: 10_000, // 10 seconds - options data
  UNDERLYING: 5_000, // 5 seconds - stock quotes
  GREEKS: 60_000, // 60 seconds - Greeks (they update less frequently)
  BARS: 120_000, // 2 minutes - candle data
} as const;

export type DataHealth = "healthy" | "degraded" | "stale";
export type DataSource = "websocket" | "rest" | "static" | "none";

export interface FreshnessInfo {
  isStale: boolean;
  ageMs: number;
  ageFormatted: string;
  source: DataSource;
  health: DataHealth;
}

/**
 * Calculate freshness info for a data point
 */
export function getFreshnessInfo(
  timestamp: number,
  source: DataSource,
  thresholdMs: number
): FreshnessInfo {
  const ageMs = Date.now() - timestamp;
  const isStale = ageMs > thresholdMs;

  let health: DataHealth = "healthy";
  if (source === "static" || source === "none") {
    health = "stale";
  } else if (isStale) {
    health = "stale";
  } else if (ageMs > thresholdMs * 0.7) {
    health = "degraded";
  }

  return {
    isStale,
    ageMs,
    ageFormatted: formatAge(ageMs),
    source,
    health,
  };
}

/**
 * Format age in human-readable form
 */
export function formatAge(ms: number): string {
  if (ms < 1000) return "now";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

/**
 * Get source badge style
 */
export function getSourceBadgeStyle(source: DataSource): string {
  switch (source) {
    case "websocket":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "rest":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "static":
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    case "none":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

/**
 * Get health indicator style
 */
export function getHealthStyle(health: DataHealth): {
  className: string;
  icon: "check" | "warning" | "error";
  label: string;
} {
  switch (health) {
    case "healthy":
      return {
        className: "text-green-400",
        icon: "check",
        label: "Live",
      };
    case "degraded":
      return {
        className: "text-yellow-400",
        icon: "warning",
        label: "Delayed",
      };
    case "stale":
      return {
        className: "text-red-400",
        icon: "error",
        label: "Stale",
      };
  }
}

/**
 * Get combined health from multiple data sources
 */
export function getCombinedHealth(...healths: DataHealth[]): DataHealth {
  if (healths.includes("stale")) return "stale";
  if (healths.includes("degraded")) return "degraded";
  return "healthy";
}

/**
 * Should execution actions be disabled based on data health?
 */
export function shouldDisableExecution(health: DataHealth): boolean {
  return health === "stale";
}

export default {
  THRESHOLDS,
  getFreshnessInfo,
  formatAge,
  getSourceBadgeStyle,
  getHealthStyle,
  getCombinedHealth,
  shouldDisableExecution,
};
