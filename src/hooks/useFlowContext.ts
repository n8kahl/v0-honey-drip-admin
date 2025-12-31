/**
 * useFlowContext Hook
 *
 * Provides real-time options flow context for a symbol.
 * Uses the FlowAnalysisEngine to compute sentiment, institutional score,
 * and trading recommendations based on database-persisted flow data.
 *
 * Features:
 * - Multi-window analysis (1h, 4h, 1d)
 * - Auto-refresh on interval
 * - Cached results for performance
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { FlowAnalysisEngine, FlowContext, FlowSentiment } from "../lib/engines/FlowAnalysisEngine";

// Singleton engine instance
const flowEngine = new FlowAnalysisEngine();

export interface FlowContextState {
  // Context for each window
  short: FlowContext | null; // 1 hour
  medium: FlowContext | null; // 4 hours
  long: FlowContext | null; // 24 hours

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Computed helpers
  primarySentiment: FlowSentiment;
  primaryStrength: number;
  sweepCount: number;
  blockCount: number;
  totalPremium: number;
  putCallRatio: number;
  institutionalScore: number;
  recommendation: string;

  // Refresh function
  refresh: () => Promise<void>;
}

export interface UseFlowContextOptions {
  /** Refresh interval in milliseconds (default: 30000 = 30s) */
  refreshInterval?: number;
  /** Whether to fetch automatically on mount (default: true) */
  autoFetch?: boolean;
  /** Which windows to fetch (default: all) */
  windows?: ("short" | "medium" | "long")[];
}

const DEFAULT_OPTIONS: Required<UseFlowContextOptions> = {
  refreshInterval: 30000,
  autoFetch: true,
  windows: ["short", "medium", "long"],
};

/**
 * Hook to get flow context for a symbol
 *
 * @param symbol - The underlying symbol (e.g., "SPY", "SPX")
 * @param options - Configuration options
 * @returns Flow context state with all windows and computed helpers
 *
 * @example
 * ```tsx
 * const { primarySentiment, sweepCount, refresh } = useFlowContext("SPY");
 *
 * // Show sentiment indicator
 * <Badge>{primarySentiment}</Badge>
 *
 * // Show sweep activity
 * <span>{sweepCount} sweeps in last hour</span>
 * ```
 */
export function useFlowContext(
  symbol: string | null | undefined,
  options?: UseFlowContextOptions
): FlowContextState {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [short, setShort] = useState<FlowContext | null>(null);
  const [medium, setMedium] = useState<FlowContext | null>(null);
  const [long, setLong] = useState<FlowContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track last refresh to avoid duplicate requests
  const lastRefreshRef = useRef<number>(0);
  const symbolRef = useRef<string | null | undefined>(symbol);

  // Reset when symbol changes
  useEffect(() => {
    if (symbol !== symbolRef.current) {
      symbolRef.current = symbol;
      setShort(null);
      setMedium(null);
      setLong(null);
      setError(null);
    }
  }, [symbol]);

  // Fetch flow context for all windows
  const refresh = useCallback(async () => {
    if (!symbol) {
      setError("No symbol provided");
      return;
    }

    // Debounce: prevent rapid refreshes
    const now = Date.now();
    if (now - lastRefreshRef.current < 5000) {
      return;
    }
    lastRefreshRef.current = now;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all requested windows in parallel
      const promises: Promise<void>[] = [];

      if (opts.windows.includes("short")) {
        promises.push(flowEngine.getFlowContext(symbol, "short").then((ctx) => setShort(ctx)));
      }

      if (opts.windows.includes("medium")) {
        promises.push(flowEngine.getFlowContext(symbol, "medium").then((ctx) => setMedium(ctx)));
      }

      if (opts.windows.includes("long")) {
        promises.push(flowEngine.getFlowContext(symbol, "long").then((ctx) => setLong(ctx)));
      }

      await Promise.all(promises);
    } catch (err) {
      console.error("[useFlowContext] Error fetching flow context:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch flow context");
    } finally {
      setIsLoading(false);
    }
  }, [symbol, opts.windows]);

  // Auto-fetch on mount and symbol change
  useEffect(() => {
    if (opts.autoFetch && symbol) {
      refresh();
    }
  }, [symbol, opts.autoFetch, refresh]);

  // Auto-refresh on interval
  useEffect(() => {
    if (!opts.refreshInterval || !symbol) return;

    const intervalId = setInterval(() => {
      refresh();
    }, opts.refreshInterval);

    return () => clearInterval(intervalId);
  }, [opts.refreshInterval, symbol, refresh]);

  // Compute primary sentiment (prefer medium window)
  const primaryContext = medium || short || long;
  const primarySentiment: FlowSentiment = primaryContext?.sentiment || "NEUTRAL";
  const primaryStrength = primaryContext?.sentimentStrength || 0;

  // Aggregate sweep/block counts from short window (most recent)
  const sweepCount = short?.sweepCount || 0;
  const blockCount = short?.blockCount || 0;

  // Use medium window for totals
  const totalPremium = medium?.totalPremium || 0;
  const putCallRatio = medium?.putCallVolumeRatio || 1;
  const institutionalScore = primaryContext?.institutionalScore || 0;
  const recommendation = primaryContext?.recommendation || "NEUTRAL";

  return {
    short,
    medium,
    long,
    isLoading,
    error,
    primarySentiment,
    primaryStrength,
    sweepCount,
    blockCount,
    totalPremium,
    putCallRatio,
    institutionalScore,
    recommendation,
    refresh,
  };
}

/**
 * Get color for sentiment display
 */
export function getSentimentColor(sentiment: FlowSentiment): string {
  switch (sentiment) {
    case "BULLISH":
      return "text-green-500";
    case "BEARISH":
      return "text-red-500";
    default:
      return "text-zinc-400";
  }
}

/**
 * Get background color for sentiment display
 */
export function getSentimentBgColor(sentiment: FlowSentiment): string {
  switch (sentiment) {
    case "BULLISH":
      return "bg-green-500/20 border-green-500/30";
    case "BEARISH":
      return "bg-red-500/20 border-red-500/30";
    default:
      return "bg-zinc-500/20 border-zinc-500/30";
  }
}

/**
 * Get icon for sentiment display
 */
export function getSentimentIcon(sentiment: FlowSentiment): string {
  switch (sentiment) {
    case "BULLISH":
      return "TrendingUp";
    case "BEARISH":
      return "TrendingDown";
    default:
      return "Minus";
  }
}

/**
 * Format premium for display
 */
export function formatPremium(premium: number): string {
  if (premium >= 1_000_000) {
    return `$${(premium / 1_000_000).toFixed(1)}M`;
  }
  if (premium >= 1_000) {
    return `$${(premium / 1_000).toFixed(0)}K`;
  }
  return `$${premium.toFixed(0)}`;
}

/**
 * Get recommendation label
 */
export function getRecommendationLabel(recommendation: string): string {
  const labels: Record<string, string> = {
    FOLLOW_FLOW: "Follow Flow",
    CONFIRM_FLOW: "Confirm Flow",
    NEUTRAL: "Neutral",
    FADE_FLOW: "Fade Flow",
    WAIT: "Wait",
  };
  return labels[recommendation] || recommendation;
}
