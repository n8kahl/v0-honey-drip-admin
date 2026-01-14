/**
 * Edge Stats Cache
 * Phase 7: Performance-Based Signal Ranking
 *
 * Fetches and caches historical performance metrics to compute edge multipliers
 * for composite signals. Uses rolling 30-day window by default.
 *
 * Features:
 * - Aggregates win rate, profit factor, sample size by opportunity_type and style
 * - 10-minute cache TTL for efficiency
 * - Edge multiplier calculation based on historical edge
 * - Hard filter for low-edge setups with high confidence
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// Cache configuration
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_LOOKBACK_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

export interface EdgeStats {
  winRate: number; // 0-100
  profitFactor: number; // > 1 = profitable
  avgRiskReward: number;
  sampleSize: number; // Total signals with exited_at
}

export interface EdgeMultiplierResult {
  multiplier: number; // 0.7 - 1.3 typically
  confidence: "low" | "medium" | "high";
  reason: string;
}

export interface EdgeMetadata {
  winRate: number;
  profitFactor: number;
  sampleSize: number;
  edgeMultiplier: number;
  adjustedScore: number;
  confidence: "low" | "medium" | "high";
  isLowEdge: boolean;
  filterReason?: string;
}

interface CacheEntry {
  stats: Map<string, EdgeStats>;
  timestamp: number;
}

// ============================================================================
// Cache Implementation
// ============================================================================

const cache = new Map<string, CacheEntry>();

/**
 * Generate cache key for owner
 */
function getCacheKey(owner: string): string {
  return `edge_stats_${owner}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Generate stats key for opportunity type + style combination
 */
export function getStatsKey(opportunityType: string, style: string): string {
  return `${opportunityType}:${style}`;
}

// ============================================================================
// Edge Stats Fetching
// ============================================================================

/**
 * Fetch aggregated edge stats for an owner over a rolling window
 *
 * @param owner - User ID
 * @param supabase - Supabase client
 * @param lookbackDays - Number of days to look back (default: 30)
 * @returns Map of stats keyed by opportunity_type:style
 */
export async function fetchEdgeStats(
  owner: string,
  supabase: SupabaseClient,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<Map<string, EdgeStats>> {
  const cacheKey = getCacheKey(owner);
  const cached = cache.get(cacheKey);

  if (isCacheValid(cached)) {
    return cached!.stats;
  }

  console.log(`[EdgeStats] Fetching edge stats for owner ${owner.slice(0, 8)}...`);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - lookbackDays);

  // Query exited signals grouped by opportunity_type and recommended_style
  const { data, error } = await supabase
    .from("composite_signals")
    .select(
      "opportunity_type, recommended_style, realized_pnl, risk_reward, exit_reason, exited_at"
    )
    .eq("owner", owner)
    .not("exited_at", "is", null)
    .gte("created_at", fromDate.toISOString());

  if (error) {
    console.error("[EdgeStats] Error fetching stats:", error);
    return new Map();
  }

  if (!data || data.length === 0) {
    console.log("[EdgeStats] No exited signals found for owner");
    return new Map();
  }

  // Aggregate by opportunity_type + style
  const statsMap = new Map<string, EdgeStats>();
  const groups = new Map<
    string,
    {
      wins: number;
      losses: number;
      totalWinPnl: number;
      totalLossPnl: number;
      totalRR: number;
      count: number;
    }
  >();

  for (const signal of data) {
    const key = getStatsKey(signal.opportunity_type, signal.recommended_style);

    let group = groups.get(key);
    if (!group) {
      group = { wins: 0, losses: 0, totalWinPnl: 0, totalLossPnl: 0, totalRR: 0, count: 0 };
      groups.set(key, group);
    }

    const pnl = signal.realized_pnl || 0;
    const isWin =
      pnl > 0 || (signal.exit_reason && ["T1", "T2", "T3"].includes(signal.exit_reason));

    if (isWin) {
      group.wins++;
      group.totalWinPnl += Math.abs(pnl);
    } else {
      group.losses++;
      group.totalLossPnl += Math.abs(pnl);
    }

    group.totalRR += signal.risk_reward || 0;
    group.count++;
  }

  // Convert to EdgeStats
  for (const [key, group] of groups.entries()) {
    const winRate = group.count > 0 ? (group.wins / group.count) * 100 : 0;
    const profitFactor = group.totalLossPnl > 0 ? group.totalWinPnl / group.totalLossPnl : 0;
    const avgRR = group.count > 0 ? group.totalRR / group.count : 0;

    statsMap.set(key, {
      winRate,
      profitFactor,
      avgRiskReward: avgRR,
      sampleSize: group.count,
    });
  }

  // Update cache
  cache.set(cacheKey, {
    stats: statsMap,
    timestamp: Date.now(),
  });

  console.log(`[EdgeStats] Cached ${statsMap.size} stat entries for owner ${owner.slice(0, 8)}`);

  return statsMap;
}

/**
 * Get edge stats for a specific opportunity type and style
 */
export async function getEdgeStatsForSetup(
  owner: string,
  opportunityType: string,
  style: string,
  supabase: SupabaseClient
): Promise<EdgeStats | null> {
  const allStats = await fetchEdgeStats(owner, supabase);
  const key = getStatsKey(opportunityType, style);
  return allStats.get(key) || null;
}

// ============================================================================
// Edge Multiplier Calculation
// ============================================================================

/**
 * Calculate edge multiplier based on historical performance
 *
 * Rules:
 * - sample_size < 20 → multiplier ~ 1.0 (low confidence, use base score)
 * - win_rate >= 55% AND profit_factor >= 1.2 → multiplier 1.1 - 1.3
 * - win_rate <= 45% OR profit_factor < 0.9 AND sample_size >= 30 → multiplier 0.7 - 0.9
 * - Otherwise → multiplier 0.95 - 1.05 (slight adjustment)
 *
 * @param stats - Historical edge stats (can be null for new setups)
 * @returns Edge multiplier result with reasoning
 */
export function calculateEdgeMultiplier(stats: EdgeStats | null): EdgeMultiplierResult {
  // No historical data - neutral multiplier
  if (!stats || stats.sampleSize < 5) {
    return {
      multiplier: 1.0,
      confidence: "low",
      reason: "Insufficient historical data (< 5 samples)",
    };
  }

  const { winRate, profitFactor, sampleSize } = stats;

  // Low sample size - slight adjustment only
  if (sampleSize < 20) {
    // Preliminary data - small adjustment
    if (winRate >= 60 && profitFactor >= 1.3) {
      return {
        multiplier: 1.05,
        confidence: "low",
        reason: `Early positive edge (${sampleSize} samples)`,
      };
    }
    if (winRate <= 35 || profitFactor < 0.7) {
      return {
        multiplier: 0.95,
        confidence: "low",
        reason: `Early negative edge (${sampleSize} samples)`,
      };
    }
    return {
      multiplier: 1.0,
      confidence: "low",
      reason: `Building sample size (${sampleSize}/20)`,
    };
  }

  // Medium sample size (20-39)
  if (sampleSize < 40) {
    if (winRate >= 55 && profitFactor >= 1.2) {
      const boost = Math.min(1.15, 1.0 + (winRate - 50) * 0.005 + (profitFactor - 1) * 0.05);
      return {
        multiplier: boost,
        confidence: "medium",
        reason: `Positive edge: ${winRate.toFixed(0)}% WR, ${profitFactor.toFixed(2)} PF`,
      };
    }
    if (winRate <= 45 || profitFactor < 0.9) {
      const penalty = Math.max(0.85, 1.0 - (50 - winRate) * 0.005 - (1 - profitFactor) * 0.1);
      return {
        multiplier: penalty,
        confidence: "medium",
        reason: `Negative edge: ${winRate.toFixed(0)}% WR, ${profitFactor.toFixed(2)} PF`,
      };
    }
    return {
      multiplier: 1.0,
      confidence: "medium",
      reason: `Neutral edge: ${winRate.toFixed(0)}% WR`,
    };
  }

  // High sample size (40+) - high confidence adjustments
  if (winRate >= 55 && profitFactor >= 1.2) {
    // Strong positive edge - boost 10-30%
    const boost = Math.min(1.3, 1.0 + (winRate - 50) * 0.01 + (profitFactor - 1) * 0.1);
    return {
      multiplier: boost,
      confidence: "high",
      reason: `Strong positive edge: ${winRate.toFixed(0)}% WR, ${profitFactor.toFixed(2)} PF (${sampleSize} samples)`,
    };
  }

  if (winRate <= 45 || profitFactor < 0.9) {
    // Negative edge - penalize 10-30%
    const penalty = Math.max(0.7, 1.0 - (50 - winRate) * 0.01 - (1 - profitFactor) * 0.15);
    return {
      multiplier: penalty,
      confidence: "high",
      reason: `Negative edge: ${winRate.toFixed(0)}% WR, ${profitFactor.toFixed(2)} PF (${sampleSize} samples)`,
    };
  }

  // Neutral - slight adjustment based on win rate
  const adjustment = (winRate - 50) * 0.002; // +/- 0.05 for 25% deviation
  return {
    multiplier: 1.0 + adjustment,
    confidence: "high",
    reason: `Neutral edge: ${winRate.toFixed(0)}% WR (${sampleSize} samples)`,
  };
}

// ============================================================================
// Hard Filter Logic
// ============================================================================

/**
 * Determine if a signal should be hard-filtered based on historical edge
 *
 * Hard filter criteria (only when sample_size >= 40):
 * - profit_factor < 0.9 → LOW_EDGE
 * - win_rate < 45% → LOW_EDGE
 *
 * @param stats - Historical edge stats
 * @returns Whether to filter and reason
 */
export function shouldHardFilter(stats: EdgeStats | null): { filter: boolean; reason?: string } {
  if (!stats || stats.sampleSize < 40) {
    return { filter: false };
  }

  if (stats.profitFactor < 0.9) {
    return {
      filter: true,
      reason: `LOW_EDGE: Profit factor ${stats.profitFactor.toFixed(2)} < 0.9 (${stats.sampleSize} samples)`,
    };
  }

  if (stats.winRate < 45) {
    return {
      filter: true,
      reason: `LOW_EDGE: Win rate ${stats.winRate.toFixed(1)}% < 45% (${stats.sampleSize} samples)`,
    };
  }

  return { filter: false };
}

// ============================================================================
// Apply Edge to Signal
// ============================================================================

/**
 * Apply edge stats to a signal's score and generate metadata
 *
 * @param baseScore - Original base score (0-100)
 * @param stats - Historical edge stats
 * @returns Edge metadata to include in features
 */
export function applyEdgeToScore(baseScore: number, stats: EdgeStats | null): EdgeMetadata {
  const { multiplier, confidence, reason } = calculateEdgeMultiplier(stats);
  const { filter, reason: filterReason } = shouldHardFilter(stats);

  const adjustedScore = Math.min(100, Math.max(0, baseScore * multiplier));

  return {
    winRate: stats?.winRate || 0,
    profitFactor: stats?.profitFactor || 0,
    sampleSize: stats?.sampleSize || 0,
    edgeMultiplier: Math.round(multiplier * 100) / 100,
    adjustedScore: Math.round(adjustedScore * 100) / 100,
    confidence,
    isLowEdge: filter,
    filterReason: filter ? filterReason : undefined,
  };
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear cache for a specific owner
 */
export function clearCacheForOwner(owner: string): void {
  cache.delete(getCacheKey(owner));
}

/**
 * Clear entire cache
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats(): { entries: number; owners: string[] } {
  const owners = Array.from(cache.keys()).map((key) => key.replace("edge_stats_", ""));
  return {
    entries: cache.size,
    owners,
  };
}
