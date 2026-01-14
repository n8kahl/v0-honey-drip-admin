/**
 * useEdgeStats - Hook for fetching live edge stats from composite signals
 *
 * Fetches win rates, profit factors, and sample sizes per setup type
 * from the performance API.
 */

import { useState, useEffect, useCallback } from "react";
import { buildApiUrl } from "../lib/env";

// ============================================================================
// Types
// ============================================================================

export interface EdgeStat {
  opportunityType: string;
  recommendedStyle: string;
  winRate: number;
  profitFactor: number;
  totalExited: number;
  avgRiskReward: number;
  totalWins: number;
  totalLosses: number;
  avgRMultiple: number;
  lastUpdated: string | null;
  confidence: "low" | "medium" | "high";
}

export interface TopSetup extends EdgeStat {
  expectancyScore: number;
  rank: number;
}

export interface EdgeSummaryResponse {
  stats: EdgeStat[];
  windowDays: number;
  totalSignals: number;
  totalExited: number;
  lastUpdated: string | null;
}

export interface TopSetupsResponse {
  setups: TopSetup[];
  windowDays: number;
  limit: number;
}

export interface UseEdgeStatsResult {
  summary: EdgeSummaryResponse | null;
  topSetups: TopSetupsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useEdgeStats(windowDays: number = 30): UseEdgeStatsResult {
  const [summary, setSummary] = useState<EdgeSummaryResponse | null>(null);
  const [topSetups, setTopSetups] = useState<TopSetupsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both endpoints in parallel
      const [summaryRes, topSetupsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/performance/edge-summary?windowDays=${windowDays}`)),
        fetch(buildApiUrl(`/api/performance/top-setups?windowDays=${windowDays}&limit=5`)),
      ]);

      if (!summaryRes.ok) {
        throw new Error(`Failed to fetch edge summary: ${summaryRes.status}`);
      }
      if (!topSetupsRes.ok) {
        throw new Error(`Failed to fetch top setups: ${topSetupsRes.status}`);
      }

      const [summaryData, topSetupsData] = await Promise.all([
        summaryRes.json() as Promise<EdgeSummaryResponse>,
        topSetupsRes.json() as Promise<TopSetupsResponse>,
      ]);

      setSummary(summaryData);
      setTopSetups(topSetupsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error fetching edge stats";
      setError(message);
      console.error("[useEdgeStats] Error:", message);
    } finally {
      setIsLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    summary,
    topSetups,
    isLoading,
    error,
    refetch: fetchStats,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format opportunity type for display
 */
export function formatOpportunityType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format style for display
 */
export function formatStyle(style: string): string {
  const styles: Record<string, string> = {
    scalp: "Scalp",
    day_trade: "Day Trade",
    swing: "Swing",
  };
  return styles[style] || style.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format win rate as percentage string (expects 0-100 scale)
 */
export function formatWinRate(winRate: number): string {
  return `${winRate.toFixed(1)}%`;
}

/**
 * Format profit factor with 2 decimal places
 */
export function formatProfitFactor(pf: number): string {
  if (pf === 0 || !isFinite(pf)) return "—";
  return pf.toFixed(2);
}

/**
 * Format R-multiple with sign
 */
export function formatRMultiple(r: number): string {
  if (!isFinite(r)) return "—";
  const sign = r >= 0 ? "+" : "";
  return `${sign}${r.toFixed(2)}R`;
}

/**
 * Get confidence color class
 */
export function getConfidenceColor(confidence: "low" | "medium" | "high"): string {
  switch (confidence) {
    case "high":
      return "text-[var(--accent-positive)]";
    case "medium":
      return "text-amber-400";
    case "low":
      return "text-[var(--text-muted)]";
  }
}

/**
 * Get confidence badge label
 */
export function getConfidenceBadge(confidence: "low" | "medium" | "high"): string {
  switch (confidence) {
    case "high":
      return "High Confidence";
    case "medium":
      return "Medium Confidence";
    case "low":
      return "Low Sample";
  }
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

/**
 * Check if setup is profitable (win rate > 50% and PF > 1)
 */
export function isProfitable(stat: EdgeStat): boolean {
  return stat.winRate > 50 && stat.profitFactor > 1;
}

/**
 * Check if setup is underperforming (win rate < 45% or PF < 0.9)
 */
export function isUnderperforming(stat: EdgeStat): boolean {
  return stat.winRate < 45 || stat.profitFactor < 0.9;
}

export default useEdgeStats;
