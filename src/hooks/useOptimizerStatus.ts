/**
 * useOptimizerStatus - Hook for fetching optimizer status
 *
 * Fetches current optimization parameters, performance report,
 * and detector rankings from the server.
 */

import { useState, useEffect, useCallback } from "react";
import { buildApiUrl } from "../lib/env";

// ============================================================================
// Types
// ============================================================================

interface OptimizedParams {
  parameters: {
    minScores: { scalp: number; day: number; swing: number };
    ivBoosts: { lowIV: number; highIV: number };
    gammaBoosts: { shortGamma: number; longGamma: number };
    flowBoosts: { aligned: number; opposed: number };
    mtfWeights: { weekly: number; daily: number; hourly: number; fifteenMin: number };
    riskReward: { targetMultiple: number; stopMultiple: number; maxHoldBars: number };
  };
  performance: {
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  timestamp: string;
  phase: number;
}

export interface DetectorStats {
  detector: string;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgHoldBars?: number;
  expectancy?: number;
  wins?: number;
  losses?: number;
  /** Composite score for ranking: (winRate * 0.6) + (normalizedPF * 0.4) */
  compositeScore?: number;
  /** Whether this detector has sufficient sample size */
  hasSufficientSample?: boolean;
  /** Recommended trading style */
  recommendedStyle?: "scalp" | "day_trade" | "swing" | "unknown";
}

export interface ThresholdsUsed {
  minTrades: number;
  windowDays: number;
}

export interface OptimizedReport {
  timestamp: string;
  parametersSummary: {
    targetMultiple: number;
    stopMultiple: number;
    maxHoldBars: number;
  };
  /** Thresholds used for filtering */
  thresholdsUsed?: ThresholdsUsed;
  /** All detectors regardless of sample size */
  allDetectors?: DetectorStats[];
  /** Top detectors with sufficient sample size, sorted by composite score */
  topDetectors?: DetectorStats[];
  /** Detectors with insufficient sample size */
  lowSampleDetectors?: DetectorStats[];
  /** Legacy field for backward compatibility */
  perDetectorStats: DetectorStats[];
  ranking: string[];
  testedSymbols: string[];
  windowStartDate: string;
  windowEndDate: string;
  totalTrades: number;
  avgWinRate: number;
  avgProfitFactor?: number;
}

export interface OptimizerStatusResponse {
  paramsConfig: OptimizedParams | null;
  performanceSummary: OptimizedParams["performance"] | null;
  report: OptimizedReport | null;
  missingFiles: string[];
  lastUpdated: string | null;
}

export interface UseOptimizerStatusResult {
  data: OptimizerStatusResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useOptimizerStatus(): UseOptimizerStatusResult {
  const [data, setData] = useState<OptimizerStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl("/api/optimizer/status"));

      if (!response.ok) {
        throw new Error(`Failed to fetch optimizer status: ${response.status}`);
      }

      const result: OptimizerStatusResponse = await response.json();
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error fetching optimizer status";
      setError(message);
      console.error("[useOptimizerStatus] Error:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get top detectors from report.
 * Uses new topDetectors array if available, falls back to legacy perDetectorStats.
 */
export function getTopDetectors(
  report: OptimizedReport | null,
  limit: number = 10
): DetectorStats[] {
  if (!report) return [];

  // Use new topDetectors array if available (already filtered and sorted)
  if (report.topDetectors && report.topDetectors.length > 0) {
    return report.topDetectors.slice(0, limit);
  }

  // Fall back to legacy behavior for backward compatibility
  if (!report.perDetectorStats) return [];

  return [...report.perDetectorStats]
    .filter((d) => d.totalTrades >= 3)
    .sort((a, b) => {
      // Sort by composite score if available, otherwise by win rate
      if (a.compositeScore !== undefined && b.compositeScore !== undefined) {
        return b.compositeScore - a.compositeScore;
      }
      return b.winRate - a.winRate;
    })
    .slice(0, limit);
}

/**
 * Get low sample detectors from report.
 */
export function getLowSampleDetectors(
  report: OptimizedReport | null,
  limit: number = 10
): DetectorStats[] {
  if (!report?.lowSampleDetectors) return [];
  return report.lowSampleDetectors.slice(0, limit);
}

/**
 * Get the minimum trades threshold used for filtering.
 */
export function getMinTradesThreshold(report: OptimizedReport | null): number {
  return report?.thresholdsUsed?.minTrades ?? 30;
}

/**
 * Format win rate as percentage string
 */
export function formatWinRate(winRate: number): string {
  return `${(winRate * 100).toFixed(1)}%`;
}

/**
 * Format profit factor with 2 decimal places
 */
export function formatProfitFactor(pf: number): string {
  if (pf === 0 || !isFinite(pf)) return "—";
  return pf.toFixed(2);
}

/**
 * Format composite score as percentage
 */
export function formatCompositeScore(score: number | undefined): string {
  if (score === undefined || !isFinite(score)) return "—";
  return `${(score * 100).toFixed(1)}`;
}

/**
 * Format timestamp to relative time string
 */
export function formatLastUpdated(timestamp: string | null): string {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins > 0) {
    return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  }

  return "Just now";
}

export default useOptimizerStatus;
