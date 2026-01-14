/**
 * Optimized Parameters Loader
 * Phase 7: Database-based parameter loading for the scanner
 *
 * Loads activated optimization parameters from the strategy_definitions table
 * and aggregates them into a ParameterConfig for the scanner.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParameterConfig } from "../../../src/types/optimizedParameters.js";

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Default parameter values (fallback when no DB params available)
const DEFAULT_PARAMS: ParameterConfig = {
  minScores: {
    scalp: 40,
    day: 40,
    swing: 40,
  },
  ivBoosts: {
    lowIV: 0.15,
    highIV: -0.2,
  },
  gammaBoosts: {
    shortGamma: 0.15,
    longGamma: -0.1,
  },
  flowBoosts: {
    aligned: 0.2,
    opposed: -0.15,
  },
  mtfWeights: {
    weekly: 3.0,
    daily: 2.0,
    hourly: 1.0,
    fifteenMin: 0.5,
  },
  riskReward: {
    targetMultiple: 1.5,
    stopMultiple: 1.0,
    maxHoldBars: 20,
  },
};

// Cache entry
interface CacheEntry {
  params: ParameterConfig;
  timestamp: number;
}

// In-memory cache
let cachedParams: CacheEntry | null = null;

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cachedParams) return false;
  return Date.now() - cachedParams.timestamp < CACHE_TTL_MS;
}

/**
 * Load optimized parameters from database
 * Aggregates activated params from strategy_definitions table
 *
 * @param supabase - Supabase client
 * @param forceRefresh - Force refresh even if cache is valid
 * @returns ParameterConfig for the scanner
 */
export async function loadOptimizedParamsFromDB(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<ParameterConfig> {
  // Return cached params if valid
  if (!forceRefresh && isCacheValid()) {
    return cachedParams!.params;
  }

  try {
    // Query strategies with activated params
    const { data, error } = await supabase
      .from("strategy_definitions")
      .select("id, slug, active_params, conditions")
      .eq("enabled", true)
      .not("active_params", "is", null);

    if (error) {
      console.error("[ParamsLoader] Error fetching params from DB:", error);
      return cachedParams?.params || DEFAULT_PARAMS;
    }

    if (!data || data.length === 0) {
      console.log("[ParamsLoader] No activated params found in DB, using defaults");
      return DEFAULT_PARAMS;
    }

    // Aggregate params from all strategies
    // Use the most aggressive values across strategies
    const aggregated = aggregateParams(data);

    // Cache the result
    cachedParams = {
      params: aggregated,
      timestamp: Date.now(),
    };

    console.log(`[ParamsLoader] Loaded optimized params from ${data.length} strategies`);
    return aggregated;
  } catch (err) {
    console.error("[ParamsLoader] Exception loading params:", err);
    return cachedParams?.params || DEFAULT_PARAMS;
  }
}

/**
 * Aggregate params from multiple strategy definitions
 * Uses the best-performing values across strategies
 */
function aggregateParams(
  strategies: Array<{
    id: string;
    slug: string;
    active_params: any;
    conditions: any;
  }>
): ParameterConfig {
  // Start with defaults
  const result = { ...DEFAULT_PARAMS };

  // Collect all riskReward params
  const targetMultiples: number[] = [];
  const stopMultiples: number[] = [];
  const maxHoldBars: number[] = [];

  for (const strategy of strategies) {
    const params = strategy.active_params;
    if (!params) continue;

    // Collect riskReward values if present
    if (params.riskReward) {
      if (typeof params.riskReward.targetMultiple === "number") {
        targetMultiples.push(params.riskReward.targetMultiple);
      }
      if (typeof params.riskReward.stopMultiple === "number") {
        stopMultiples.push(params.riskReward.stopMultiple);
      }
      if (typeof params.riskReward.maxHoldBars === "number") {
        maxHoldBars.push(params.riskReward.maxHoldBars);
      }
    }

    // Collect other param overrides
    if (params.minScores) {
      if (typeof params.minScores.scalp === "number") {
        result.minScores.scalp = Math.max(result.minScores.scalp, params.minScores.scalp);
      }
      if (typeof params.minScores.day === "number") {
        result.minScores.day = Math.max(result.minScores.day, params.minScores.day);
      }
      if (typeof params.minScores.swing === "number") {
        result.minScores.swing = Math.max(result.minScores.swing, params.minScores.swing);
      }
    }

    if (params.ivBoosts) {
      if (typeof params.ivBoosts.lowIV === "number") {
        result.ivBoosts.lowIV = params.ivBoosts.lowIV;
      }
      if (typeof params.ivBoosts.highIV === "number") {
        result.ivBoosts.highIV = params.ivBoosts.highIV;
      }
    }

    if (params.gammaBoosts) {
      if (typeof params.gammaBoosts.shortGamma === "number") {
        result.gammaBoosts.shortGamma = params.gammaBoosts.shortGamma;
      }
      if (typeof params.gammaBoosts.longGamma === "number") {
        result.gammaBoosts.longGamma = params.gammaBoosts.longGamma;
      }
    }

    if (params.flowBoosts) {
      if (typeof params.flowBoosts.aligned === "number") {
        result.flowBoosts.aligned = params.flowBoosts.aligned;
      }
      if (typeof params.flowBoosts.opposed === "number") {
        result.flowBoosts.opposed = params.flowBoosts.opposed;
      }
    }

    if (params.mtfWeights) {
      if (typeof params.mtfWeights.weekly === "number") {
        result.mtfWeights.weekly = params.mtfWeights.weekly;
      }
      if (typeof params.mtfWeights.daily === "number") {
        result.mtfWeights.daily = params.mtfWeights.daily;
      }
      if (typeof params.mtfWeights.hourly === "number") {
        result.mtfWeights.hourly = params.mtfWeights.hourly;
      }
      if (typeof params.mtfWeights.fifteenMin === "number") {
        result.mtfWeights.fifteenMin = params.mtfWeights.fifteenMin;
      }
    }
  }

  // Aggregate riskReward using median values (more robust than mean)
  if (targetMultiples.length > 0) {
    result.riskReward.targetMultiple = median(targetMultiples);
  }
  if (stopMultiples.length > 0) {
    result.riskReward.stopMultiple = median(stopMultiples);
  }
  if (maxHoldBars.length > 0) {
    result.riskReward.maxHoldBars = Math.round(median(maxHoldBars));
  }

  return result;
}

/**
 * Calculate median of an array
 */
function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Clear the params cache (useful for testing or after activation)
 */
export function clearParamsCache(): void {
  cachedParams = null;
}

/**
 * Get cache status for monitoring
 */
export function getParamsCacheStatus(): {
  isCached: boolean;
  cacheAge: number | null;
  params: ParameterConfig | null;
} {
  if (!cachedParams) {
    return { isCached: false, cacheAge: null, params: null };
  }
  return {
    isCached: true,
    cacheAge: Date.now() - cachedParams.timestamp,
    params: cachedParams.params,
  };
}
