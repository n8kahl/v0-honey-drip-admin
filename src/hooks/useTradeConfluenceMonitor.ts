/**
 * useTradeConfluenceMonitor - Real-time confluence monitoring for active trades
 *
 * This hook:
 * 1. Monitors LOADED and ENTERED trades
 * 2. Runs context engines every 60s to get fresh confluence data
 * 3. Updates trade confluence in the store
 * 4. Triggers alerts when confluence changes significantly
 * 5. Manages flash animations for watchlist items
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useTradeStore } from "../stores/tradeStore";
import { useAlertEscalationStore } from "../stores/alertEscalationStore";
import {
  contextEngines,
  type IVContext,
  type MTFContext,
  type FlowContext,
  type GammaContext,
  type RegimeContext,
} from "../lib/engines/index";
import type { Trade, TradeConfluence, ConfluenceFactor } from "../types";

// Configuration
const CONFLUENCE_UPDATE_INTERVAL = 60_000; // 60 seconds
const SIGNIFICANT_CHANGE_THRESHOLD = 15; // Points to trigger alert
const COLLAPSE_THRESHOLD = 25; // Points for "collapse" alert

export interface ConfluenceMonitorState {
  isMonitoring: boolean;
  lastUpdate: Date | null;
  tradesMonitored: number;
  flashingTickers: Set<string>;
}

export interface UseTradeConfluenceMonitorReturn {
  state: ConfluenceMonitorState;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  refreshNow: () => Promise<void>;
  isTickerFlashing: (ticker: string) => boolean;
  clearFlash: (ticker: string) => void;
}

/**
 * Convert context engine results to confluence factors
 */
function buildConfluenceFromContext(
  direction: "LONG" | "SHORT",
  ivContext: IVContext | null,
  mtfContext: MTFContext | null,
  flowContext: FlowContext | null,
  gammaContext: GammaContext | null,
  regimeContext: RegimeContext | null
): TradeConfluence {
  const factors: TradeConfluence["factors"] = {};
  let totalScore = 50; // Start at neutral
  let factorCount = 0;

  // IV Percentile Factor
  if (ivContext) {
    const ivPct = ivContext.ivPercentile;
    // For LONG: lower IV is better (cheap options), for SHORT: higher IV better
    const isGood = direction === "LONG" ? ivPct < 50 : ivPct > 50;
    const isBad = direction === "LONG" ? ivPct > 70 : ivPct < 30;

    factors.ivPercentile = {
      value: ivPct,
      status: isGood ? "bullish" : isBad ? "bearish" : "neutral",
      label: `IV ${ivPct.toFixed(0)}%`,
      weight: 0.15,
    };

    totalScore += isGood ? 10 : isBad ? -10 : 0;
    factorCount++;
  }

  // MTF Alignment Factor
  if (mtfContext) {
    const trend = mtfContext.dominantTrend;
    const isUpTrend = trend === "STRONG_UP" || trend === "UP";
    const isDownTrend = trend === "STRONG_DOWN" || trend === "DOWN";
    const isAligned = (direction === "LONG" && isUpTrend) || (direction === "SHORT" && isDownTrend);
    const isAgainst = (direction === "LONG" && isDownTrend) || (direction === "SHORT" && isUpTrend);

    factors.mtfAlignment = {
      value: mtfContext.alignmentScore,
      status: isAligned ? "bullish" : isAgainst ? "bearish" : "neutral",
      label: `MTF ${mtfContext.alignment.replace(/_/g, " ")}`,
      weight: 0.25,
    };

    totalScore += isAligned ? 15 : isAgainst ? -15 : 0;
    factorCount++;
  }

  // Flow Pressure Factor
  if (flowContext) {
    const flowBullish = flowContext.sentiment === "BULLISH";
    const flowBearish = flowContext.sentiment === "BEARISH";
    const isSupporting =
      (direction === "LONG" && flowBullish) || (direction === "SHORT" && flowBearish);
    const isOpposing =
      (direction === "LONG" && flowBearish) || (direction === "SHORT" && flowBullish);

    factors.flowPressure = {
      value: flowContext.sentimentStrength || 50,
      status: isSupporting ? "bullish" : isOpposing ? "bearish" : "neutral",
      label: `Flow ${flowContext.sentiment}`,
      weight: 0.2,
    };

    totalScore += isSupporting ? 12 : isOpposing ? -12 : 0;
    factorCount++;
  }

  // Gamma Exposure Factor
  if (gammaContext) {
    // Dealers LONG_GAMMA = price dampened/pinning, dealers SHORT_GAMMA = volatility
    const dealersLong = gammaContext.dealerPositioning === "LONG_GAMMA";
    const dealersShort = gammaContext.dealerPositioning === "SHORT_GAMMA";

    // Format gamma notional for display
    const gammaNotional = gammaContext.totalGammaNotional || 0;
    const gammaLabel =
      gammaNotional > 0
        ? `GEX +${(gammaNotional / 1e9).toFixed(1)}B`
        : `GEX ${(gammaNotional / 1e9).toFixed(1)}B`;

    factors.gammaExposure = {
      value: gammaNotional,
      status: dealersLong ? "neutral" : dealersShort ? "bearish" : "neutral",
      label: gammaLabel,
      weight: 0.15,
    };

    // Short gamma = volatility (can be good or bad), Long gamma = pinning
    totalScore += dealersLong ? 5 : dealersShort ? -5 : 0;
    factorCount++;
  }

  // Market Regime Factor
  if (regimeContext) {
    const regime = regimeContext.marketRegime;
    // Trending regimes favor directional trades
    const isBullishRegime =
      regime === "STRONG_UPTREND" || regime === "WEAK_UPTREND" || regime === "BREAKOUT";
    const isBearishRegime =
      regime === "STRONG_DOWNTREND" || regime === "WEAK_DOWNTREND" || regime === "BREAKDOWN";
    const trendMatchesDirection =
      (direction === "LONG" && isBullishRegime) || (direction === "SHORT" && isBearishRegime);
    const trendAgainstDirection =
      (direction === "LONG" && isBearishRegime) || (direction === "SHORT" && isBullishRegime);

    factors.regime = {
      value: regimeContext.confidenceScore || 50,
      status: trendMatchesDirection ? "bullish" : trendAgainstDirection ? "bearish" : "neutral",
      label: regime.replace(/_/g, " "),
      weight: 0.25,
    };

    totalScore += trendMatchesDirection ? 15 : trendAgainstDirection ? -10 : 0;
    factorCount++;
  }

  // Normalize score to 0-100
  const normalizedScore = Math.max(0, Math.min(100, totalScore));

  return {
    score: normalizedScore,
    direction,
    factors,
    updatedAt: new Date(),
    isStale: false,
  };
}

/**
 * Calculate confluence for a single trade
 */
async function calculateTradeConfluence(trade: Trade): Promise<TradeConfluence | null> {
  try {
    const symbol = trade.ticker;
    const direction: "LONG" | "SHORT" = trade.contract?.type === "C" ? "LONG" : "SHORT";

    // Fetch all context data in parallel
    const [ivContext, mtfContext, flowContext, gammaContext, regimeContext] = await Promise.all([
      contextEngines.ivPercentile.getIVContext(symbol).catch(() => null),
      contextEngines.mtfAlignment.getMTFContext(symbol).catch(() => null),
      contextEngines.flowAnalysis.getFlowContext(symbol, "medium").catch(() => null),
      contextEngines.gammaExposure.getGammaContext(symbol).catch(() => null),
      contextEngines.regimeDetection.getRegimeContext().catch(() => null),
    ]);

    return buildConfluenceFromContext(
      direction,
      ivContext,
      mtfContext,
      flowContext,
      gammaContext,
      regimeContext
    );
  } catch (error) {
    console.error("[ConfluenceMonitor] Failed to calculate confluence:", error);
    return null;
  }
}

/**
 * Main hook for monitoring trade confluence
 */
export function useTradeConfluenceMonitor(): UseTradeConfluenceMonitorReturn {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<ConfluenceMonitorState>({
    isMonitoring: false,
    lastUpdate: null,
    tradesMonitored: 0,
    flashingTickers: new Set(),
  });

  // Get active trades from store
  const activeTrades = useTradeStore((s) => s.activeTrades);
  const updateTrade = useTradeStore((s) => s.updateTrade);

  // Get alert functions
  const addAlert = useAlertEscalationStore((s) => s.addAlert);

  // Filter to only LOADED and ENTERED trades
  const monitoredTrades = activeTrades.filter((t) => t.state === "LOADED" || t.state === "ENTERED");

  /**
   * Add flash effect to a ticker
   */
  const addFlash = useCallback((ticker: string) => {
    setState((prev) => ({
      ...prev,
      flashingTickers: new Set([...prev.flashingTickers, ticker]),
    }));

    // Auto-clear flash after 3 seconds
    setTimeout(() => {
      setState((prev) => {
        const next = new Set(prev.flashingTickers);
        next.delete(ticker);
        return { ...prev, flashingTickers: next };
      });
    }, 3000);
  }, []);

  /**
   * Clear flash for a ticker
   */
  const clearFlash = useCallback((ticker: string) => {
    setState((prev) => {
      const next = new Set(prev.flashingTickers);
      next.delete(ticker);
      return { ...prev, flashingTickers: next };
    });
  }, []);

  /**
   * Check if ticker is flashing
   */
  const isTickerFlashing = useCallback(
    (ticker: string) => {
      return state.flashingTickers.has(ticker);
    },
    [state.flashingTickers]
  );

  /**
   * Refresh confluence for all monitored trades
   */
  const refreshNow = useCallback(async () => {
    if (monitoredTrades.length === 0) return;

    console.log(`[ConfluenceMonitor] Refreshing ${monitoredTrades.length} trades...`);

    for (const trade of monitoredTrades) {
      try {
        const newConfluence = await calculateTradeConfluence(trade);
        if (!newConfluence) continue;

        const prevScore = trade.confluence?.score ?? 50;
        const scoreDelta = prevScore - newConfluence.score;

        // Check for significant changes
        if (Math.abs(scoreDelta) >= SIGNIFICANT_CHANGE_THRESHOLD) {
          // Add flash effect
          addFlash(trade.ticker);

          // Determine alert severity
          if (scoreDelta >= COLLAPSE_THRESHOLD) {
            // Confluence collapsed - URGENT alert
            addAlert({
              tradeId: trade.id,
              ticker: trade.ticker,
              severity: "URGENT",
              category: "confluence",
              title: "Confluence Collapse",
              message: `Confluence dropped ${scoreDelta.toFixed(0)} points from ${prevScore.toFixed(0)} to ${newConfluence.score.toFixed(0)} - Major setup change`,
              isActionable: true,
              actionLabel: "Trim 50%",
              actionType: "trim",
              actionPayload: { trimPercent: 50 },
              metadata: {
                confluence: newConfluence.score,
                confluencePrev: prevScore,
              },
            });
          } else if (scoreDelta >= SIGNIFICANT_CHANGE_THRESHOLD) {
            // Significant drop - WARNING alert
            addAlert({
              tradeId: trade.id,
              ticker: trade.ticker,
              severity: "WARNING",
              category: "confluence",
              title: "Confluence Weakening",
              message: `Confluence dropped ${scoreDelta.toFixed(0)} points to ${newConfluence.score.toFixed(0)} - Setup deteriorating`,
              isActionable: false,
              metadata: {
                confluence: newConfluence.score,
                confluencePrev: prevScore,
              },
            });
          } else if (scoreDelta <= -SIGNIFICANT_CHANGE_THRESHOLD) {
            // Significant improvement - INFO alert
            addAlert({
              tradeId: trade.id,
              ticker: trade.ticker,
              severity: "INFO",
              category: "confluence",
              title: "Confluence Improving",
              message: `Confluence improved ${Math.abs(scoreDelta).toFixed(0)} points to ${newConfluence.score.toFixed(0)} - Setup strengthening`,
              isActionable: false,
              metadata: {
                confluence: newConfluence.score,
                confluencePrev: prevScore,
              },
            });
          }
        }

        // Update trade in store
        updateTrade(trade.id, {
          confluence: newConfluence,
          confluenceUpdatedAt: new Date(),
        });
      } catch (error) {
        console.error(`[ConfluenceMonitor] Error updating ${trade.ticker}:`, error);
      }
    }

    setState((prev) => ({
      ...prev,
      lastUpdate: new Date(),
      tradesMonitored: monitoredTrades.length,
    }));
  }, [monitoredTrades, updateTrade, addAlert, addFlash]);

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return;

    console.log("[ConfluenceMonitor] Starting monitoring...");
    setState((prev) => ({ ...prev, isMonitoring: true }));

    // Initial refresh
    refreshNow();

    // Set up interval
    intervalRef.current = setInterval(refreshNow, CONFLUENCE_UPDATE_INTERVAL);
  }, [refreshNow]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isMonitoring: false }));
    console.log("[ConfluenceMonitor] Stopped monitoring");
  }, []);

  // Auto-start when there are trades to monitor
  useEffect(() => {
    if (monitoredTrades.length > 0 && !state.isMonitoring) {
      startMonitoring();
    } else if (monitoredTrades.length === 0 && state.isMonitoring) {
      stopMonitoring();
    }
  }, [monitoredTrades.length, state.isMonitoring, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    state,
    startMonitoring,
    stopMonitoring,
    refreshNow,
    isTickerFlashing,
    clearFlash,
  };
}

/**
 * Get initial confluence when loading a trade
 * Used in handleSendAlert to capture confluence at load time
 */
export async function getInitialConfluence(
  ticker: string,
  direction: "LONG" | "SHORT"
): Promise<TradeConfluence | null> {
  try {
    const [ivContext, mtfContext, flowContext, gammaContext, regimeContext] = await Promise.all([
      contextEngines.ivPercentile.getIVContext(ticker).catch(() => null),
      contextEngines.mtfAlignment.getMTFContext(ticker).catch(() => null),
      contextEngines.flowAnalysis.getFlowContext(ticker, "medium").catch(() => null),
      contextEngines.gammaExposure.getGammaContext(ticker).catch(() => null),
      contextEngines.regimeDetection.getRegimeContext().catch(() => null),
    ]);

    return buildConfluenceFromContext(
      direction,
      ivContext,
      mtfContext,
      flowContext,
      gammaContext,
      regimeContext
    );
  } catch (error) {
    console.error("[getInitialConfluence] Failed:", error);
    return null;
  }
}
