/**
 * useSymbolContext Hook
 * Fetches the latest composite signal and flow context for a specific symbol.
 * Used by SmartContextStrip to display real institutional data.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client.js";
import type { CompositeSignal } from "../lib/composite/CompositeSignal.js";

export interface SymbolContext {
  // Latest signal (if any)
  signal: CompositeSignal | null;

  // Extracted flow data (from signal.features.flow)
  flowBias: "bullish" | "bearish" | "neutral" | null;
  flowScore: number | null;
  sweepCount: number | null;

  // Signal score
  baseScore: number | null;
  direction: "LONG" | "SHORT" | null;
  opportunityType: string | null;

  // State
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseSymbolContextOptions {
  /** Refresh interval in milliseconds (default: 30000 = 30s) */
  refreshInterval?: number;
  /** Whether to auto-refresh (default: true) */
  autoRefresh?: boolean;
}

/**
 * Hook to get the latest composite signal context for a symbol
 */
export function useSymbolContext(
  symbol: string | null,
  options: UseSymbolContextOptions = {}
): SymbolContext & { refresh: () => Promise<void> } {
  const { refreshInterval = 30000, autoRefresh = true } = options;

  const [context, setContext] = useState<SymbolContext>({
    signal: null,
    flowBias: null,
    flowScore: null,
    sweepCount: null,
    baseScore: null,
    direction: null,
    opportunityType: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchContext = useCallback(async () => {
    if (!symbol) {
      setContext((prev) => ({
        ...prev,
        loading: false,
        signal: null,
        flowBias: null,
        flowScore: null,
        sweepCount: null,
        baseScore: null,
        direction: null,
        opportunityType: null,
      }));
      return;
    }

    try {
      setContext((prev) => ({ ...prev, loading: true, error: null }));

      const supabase = createClient();

      // Query the latest ACTIVE signal for this symbol
      const { data, error } = await supabase
        .from("composite_signals")
        .select("*")
        .eq("symbol", symbol.toUpperCase())
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned, which is fine
        throw error;
      }

      if (data) {
        // Extract flow data from features
        const features = data.features || {};
        const flow = features.flow || {};

        setContext({
          signal: {
            id: data.id,
            createdAt: new Date(data.created_at),
            owner: data.owner,
            symbol: data.symbol,
            opportunityType: data.opportunity_type,
            direction: data.direction,
            assetClass: data.asset_class,
            baseScore: data.base_score,
            scalpScore: data.scalp_score,
            dayTradeScore: data.day_trade_score,
            swingScore: data.swing_score,
            recommendedStyle: data.recommended_style,
            recommendedStyleScore: data.recommended_style_score,
            confluence: data.confluence,
            entryPrice: data.entry_price,
            stopPrice: data.stop_price,
            targets: {
              T1: data.target_t1,
              T2: data.target_t2,
              T3: data.target_t3,
            },
            riskReward: data.risk_reward,
            features: data.features,
            status: data.status,
            expiresAt: new Date(data.expires_at),
            timestamp: new Date(data.created_at).getTime(),
          } as CompositeSignal,
          flowBias: flow.flowBias || null,
          flowScore: flow.flowScore ?? null,
          sweepCount: flow.sweepCount ?? null,
          baseScore: data.base_score,
          direction: data.direction,
          opportunityType: data.opportunity_type,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        });
      } else {
        // No active signal for this symbol
        setContext({
          signal: null,
          flowBias: null,
          flowScore: null,
          sweepCount: null,
          baseScore: null,
          direction: null,
          opportunityType: null,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        });
      }
    } catch (err) {
      console.error("[useSymbolContext] Error fetching context:", err);
      setContext((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch context",
      }));
    }
  }, [symbol]);

  // Initial fetch
  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !symbol) return;

    const interval = setInterval(fetchContext, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchContext, symbol]);

  return {
    ...context,
    refresh: fetchContext,
  };
}

export default useSymbolContext;
