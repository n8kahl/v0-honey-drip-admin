/**
 * useCompositeSignals Hook
 * Phase 6: Database & Backend
 *
 * React hook for managing composite trade signals with realtime updates
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client.js";
import type { CompositeSignal } from "../lib/composite/CompositeSignal.js";
import {
  getActiveSignals,
  getSignals,
  insertCompositeSignal,
  updateCompositeSignal,
  dismissSignal,
  fillSignal,
  exitSignal,
  markSignalAlerted,
  expireOldSignals,
  type CompositeSignalRow,
} from "../lib/supabase/compositeSignals.js";
import { updatePerformanceMetricsForSignal } from "../lib/supabase/performanceAnalytics.js";

/**
 * Options for useCompositeSignals hook
 */
export interface UseCompositeSignalsOptions {
  userId: string;
  autoSubscribe?: boolean; // Auto-subscribe to realtime updates (default: true)
  autoExpire?: boolean; // Auto-expire old signals on load (default: true)
  filters?: {
    status?: string[];
    symbol?: string;
    opportunityType?: string;
    recommendedStyle?: string;
    fromDate?: Date; // Only fetch signals created after this date
    toDate?: Date; // Only fetch signals created before this date
  };
}

/**
 * Hook return type
 */
export interface UseCompositeSignalsReturn {
  // Data
  signals: CompositeSignal[];
  activeSignals: CompositeSignal[];
  loading: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  addSignal: (signal: CompositeSignal) => Promise<CompositeSignal>;
  dismiss: (id: string) => Promise<void>;
  fill: (id: string, fillPrice: number, contracts?: number) => Promise<void>;
  exit: (
    id: string,
    exitPrice: number,
    exitReason: "STOP" | "T1" | "T2" | "T3" | "MANUAL" | "EXPIRED"
  ) => Promise<void>;
  markAlerted: (id: string) => Promise<void>;
  expireOld: () => Promise<number>;
}

/**
 * Convert database row to CompositeSignal
 */
function rowToSignal(row: CompositeSignalRow): CompositeSignal {
  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    owner: row.owner,
    symbol: row.symbol,
    opportunityType: row.opportunity_type as any,
    direction: row.direction as "LONG" | "SHORT",
    assetClass: row.asset_class as any,
    baseScore: row.base_score,
    scalpScore: row.scalp_score,
    dayTradeScore: row.day_trade_score,
    swingScore: row.swing_score,
    recommendedStyle: row.recommended_style as "scalp" | "day_trade" | "swing",
    recommendedStyleScore: row.recommended_style_score,
    confluence: row.confluence,
    entryPrice: row.entry_price,
    stopPrice: row.stop_price,
    targets: {
      T1: row.target_t1,
      T2: row.target_t2,
      T3: row.target_t3,
    },
    riskReward: row.risk_reward,
    features: row.features,
    status: row.status as any,
    expiresAt: new Date(row.expires_at),
    alertedAt: row.alerted_at ? new Date(row.alerted_at) : undefined,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
    filledAt: row.filled_at ? new Date(row.filled_at) : undefined,
    exitedAt: row.exited_at ? new Date(row.exited_at) : undefined,
    fillPrice: row.fill_price,
    exitPrice: row.exit_price,
    exitReason: row.exit_reason as any,
    contractsTraded: row.contracts_traded,
    realizedPnl: row.realized_pnl,
    realizedPnlPct: row.realized_pnl_pct,
    holdTimeMinutes: row.hold_time_minutes,
    maxFavorableExcursion: row.max_favorable_excursion,
    maxAdverseExcursion: row.max_adverse_excursion,
    barTimeKey: row.bar_time_key,
    detectorVersion: row.detector_version,
    timestamp: new Date(row.created_at).getTime(),
  };
}

/**
 * Hook for managing composite signals
 *
 * @param options - Hook options
 * @returns Hook return object
 */
export function useCompositeSignals(
  options: UseCompositeSignalsOptions
): UseCompositeSignalsReturn {
  const { userId, autoSubscribe = true, autoExpire = true, filters } = options;

  const [signals, setSignals] = useState<CompositeSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  /**
   * Load signals from database
   */
  const loadSignals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getSignals(userId, {
        status: filters?.status,
        symbol: filters?.symbol,
        opportunityType: filters?.opportunityType,
        recommendedStyle: filters?.recommendedStyle,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        limit: 100,
      });

      setSignals(data);
    } catch (err) {
      setError(err as Error);
      console.error("[useCompositeSignals] Failed to load signals:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  /**
   * Refresh signals
   */
  const refresh = useCallback(async () => {
    await loadSignals();
  }, [loadSignals]);

  /**
   * Add a new signal
   */
  const addSignal = useCallback(async (signal: CompositeSignal): Promise<CompositeSignal> => {
    try {
      const inserted = await insertCompositeSignal(signal);
      setSignals((prev) => [inserted, ...prev]);
      return inserted;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  /**
   * Dismiss a signal
   */
  const dismiss = useCallback(async (id: string) => {
    try {
      await dismissSignal(id);
      setSignals((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "DISMISSED", dismissedAt: new Date() } : s))
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  /**
   * Fill a signal
   */
  const fill = useCallback(async (id: string, fillPrice: number, contracts: number = 1) => {
    try {
      await fillSignal(id, fillPrice, contracts);
      setSignals((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "FILLED",
                filledAt: new Date(),
                fillPrice,
                contractsTraded: contracts,
              }
            : s
        )
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  /**
   * Exit a signal
   */
  const exit = useCallback(
    async (
      id: string,
      exitPrice: number,
      exitReason: "STOP" | "T1" | "T2" | "T3" | "MANUAL" | "EXPIRED"
    ) => {
      try {
        const updated = await exitSignal(id, exitPrice, exitReason);
        setSignals((prev) => prev.map((s) => (s.id === id ? updated : s)));

        // Update performance metrics
        await updatePerformanceMetricsForSignal(id);
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    []
  );

  /**
   * Mark signal as alerted
   */
  const markAlerted = useCallback(async (id: string) => {
    try {
      await markSignalAlerted(id);
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, alertedAt: new Date() } : s)));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  /**
   * Expire old signals
   */
  const expireOld = useCallback(async (): Promise<number> => {
    try {
      const count = await expireOldSignals(userId);
      if (count > 0) {
        await refresh();
      }
      return count;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [userId, refresh]);

  // Load signals on mount
  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  // Auto-expire old signals on mount
  useEffect(() => {
    if (autoExpire) {
      expireOld();
    }
  }, [autoExpire, expireOld]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!autoSubscribe) return;

    const channel = supabase
      .channel("composite_signals_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "composite_signals",
          filter: `owner=eq.${userId}`,
        },
        (payload) => {
          console.log("[useCompositeSignals] Realtime update:", payload);

          if (payload.eventType === "INSERT") {
            const newSignal = rowToSignal(payload.new as CompositeSignalRow);
            setSignals((prev) => [newSignal, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedSignal = rowToSignal(payload.new as CompositeSignalRow);
            setSignals((prev) => prev.map((s) => (s.id === updatedSignal.id ? updatedSignal : s)));
          } else if (payload.eventType === "DELETE") {
            setSignals((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoSubscribe, userId, supabase]);

  // Filter for active signals
  const activeSignals = signals.filter((s) => s.status === "ACTIVE");

  return {
    signals,
    activeSignals,
    loading,
    error,
    refresh,
    addSignal,
    dismiss,
    fill,
    exit,
    markAlerted,
    expireOld,
  };
}
