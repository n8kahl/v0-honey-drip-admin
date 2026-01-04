/**
 * useChallengeStats - Real-time Challenge Statistics Hook
 *
 * Provides live P&L aggregation for challenges by combining:
 * - Static stats from getFullChallengeStats() (EXITED trades)
 * - Live P&L updates from useActiveTradeLiveModel (ENTERED trades)
 *
 * Usage:
 * const { stats, registerLivePnL, activeTradesWithLivePnL } = useChallengeStats(challengeId, allTrades);
 */

import { useState, useMemo, useCallback } from "react";
import type { Trade } from "../types";
import { getFullChallengeStats, FullChallengeStats } from "../lib/challengeHelpers";

export interface LivePnLEntry {
  tradeId: string;
  pnlPercent: number;
  pnlDollars: number;
  effectiveMid: number;
}

export interface LiveChallengeStats extends FullChallengeStats {
  // Real-time aggregated stats
  liveTotalPnL: number; // Sum of live ENTERED + static EXITED P&L
  liveAvgPnL: number; // Average P&L across all trades
  liveDollarPnL: number; // Dollar P&L including live trades
  liveBestTrade: { ticker: string; pnl: number } | null;
  liveWorstTrade: { ticker: string; pnl: number } | null;

  // Callback to register live P&L from child components
  registerLivePnL: (entry: LivePnLEntry) => void;

  // Map of live P&L values by trade ID
  livePnLMap: Map<string, LivePnLEntry>;
}

export function useChallengeStats(challengeId: string, allTrades: Trade[]): LiveChallengeStats {
  // Track live P&L values from child components
  const [livePnLMap, setLivePnLMap] = useState<Map<string, LivePnLEntry>>(new Map());

  // Get base stats (static calculation)
  const baseStats = useMemo(
    () => getFullChallengeStats(challengeId, allTrades),
    [challengeId, allTrades]
  );

  // Callback for child components to register their live P&L
  const registerLivePnL = useCallback((entry: LivePnLEntry) => {
    setLivePnLMap((prev) => {
      const newMap = new Map(prev);
      // Only update if value actually changed (prevents infinite loops)
      const existing = newMap.get(entry.tradeId);
      if (
        !existing ||
        existing.pnlPercent !== entry.pnlPercent ||
        existing.pnlDollars !== entry.pnlDollars
      ) {
        newMap.set(entry.tradeId, entry);
        return newMap;
      }
      return prev;
    });
  }, []);

  // Calculate live aggregated stats
  const liveStats = useMemo(() => {
    // Start with EXITED trades P&L (static, already calculated)
    let totalPnL = baseStats.totalPnL;
    let totalDollarPnL = baseStats.dollarPnL;

    // Add live P&L from ENTERED trades
    for (const trade of baseStats.active) {
      const liveEntry = livePnLMap.get(trade.id);
      if (liveEntry) {
        totalPnL += liveEntry.pnlPercent;
        totalDollarPnL += liveEntry.pnlDollars;
      }
    }

    // Calculate average across all trades
    const totalTradeCount = baseStats.active.length + baseStats.completed.length;
    const avgPnL = totalTradeCount > 0 ? totalPnL / totalTradeCount : 0;

    // Find best/worst trade considering live data
    let bestTrade = baseStats.bestTrade;
    let worstTrade = baseStats.worstTrade;

    for (const trade of baseStats.active) {
      const liveEntry = livePnLMap.get(trade.id);
      const pnl = liveEntry?.pnlPercent ?? 0;

      if (!bestTrade || pnl > bestTrade.pnl) {
        bestTrade = { ticker: trade.ticker, pnl };
      }
      if (!worstTrade || pnl < worstTrade.pnl) {
        worstTrade = { ticker: trade.ticker, pnl };
      }
    }

    return {
      liveTotalPnL: totalPnL,
      liveAvgPnL: avgPnL,
      liveDollarPnL: totalDollarPnL,
      liveBestTrade: bestTrade,
      liveWorstTrade: worstTrade,
    };
  }, [baseStats, livePnLMap]);

  return {
    // Base stats
    ...baseStats,

    // Live stats
    liveTotalPnL: liveStats.liveTotalPnL,
    liveAvgPnL: liveStats.liveAvgPnL,
    liveDollarPnL: liveStats.liveDollarPnL,
    liveBestTrade: liveStats.liveBestTrade,
    liveWorstTrade: liveStats.liveWorstTrade,

    // Registration callback
    registerLivePnL,

    // Live P&L map for direct access
    livePnLMap,
  };
}

export default useChallengeStats;
