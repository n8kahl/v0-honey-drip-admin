/**
 * useAITradeCoach - React hook for AI Trade Coach ("Drip Coach")
 *
 * Provides real-time AI coaching for active trades with:
 * - Session lifecycle management
 * - Automatic updates based on market data changes
 * - Event-driven coaching (triggers, not polling)
 * - Voice output support (future)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useMarketDataStore } from "../stores/marketDataStore";
import { useTradeStore } from "../stores/tradeStore";
import type { Trade } from "../types";
import type { CoachSessionState, CoachingResponse, TradeType } from "../lib/ai/types";
import {
  startCoachSession,
  updateCoachSession,
  refreshCoachSession,
  askCoach,
  endCoachSession,
  getTradeCoachSession,
  getCoachingModeFromTradeType,
  type MarketData,
} from "../lib/ai/coachClient";

interface UseAITradeCoachOptions {
  /** Auto-start coaching when trade enters ENTERED state */
  autoStart?: boolean;
  /** Update interval in ms (default: 5000 for scalps, 30000 for swings) */
  updateInterval?: number;
  /** Enable voice output */
  enableVoice?: boolean;
  /** Maximum responses to keep in history */
  maxHistorySize?: number;
}

interface UseAITradeCoachReturn {
  /** Current session state */
  state: CoachSessionState;
  /** Start a coaching session for a trade */
  startSession: (trade: Trade) => Promise<void>;
  /** End the current session */
  endSession: () => Promise<void>;
  /** Force a refresh of coaching analysis */
  refresh: () => Promise<void>;
  /** Ask the coach a question */
  ask: (question: string) => Promise<void>;
  /** Check if a trade has an active session */
  hasActiveSession: (tradeId: string) => boolean;
  /** Latest coaching summary for display */
  latestSummary: string | null;
  /** Latest recommendations */
  latestRecommendations: CoachingResponse["recommendations"];
  /** Current risk flags */
  riskFlags: CoachingResponse["riskFlags"];
  /** Is the coach currently processing */
  isProcessing: boolean;
}

const DEFAULT_UPDATE_INTERVALS: Record<TradeType, number> = {
  scalp: 5000, // 5 seconds
  day: 15000, // 15 seconds
  swing: 60000, // 1 minute (mostly manual check-ins)
  leap: 300000, // 5 minutes (mostly manual)
};

const initialState: CoachSessionState = {
  sessionId: null,
  tradeId: null,
  coachingMode: null,
  isActive: false,
  isLoading: false,
  error: null,
  latestResponse: null,
  responseHistory: [],
  updateCount: 0,
  tokensUsed: 0,
  startTime: null,
};

export function useAITradeCoach(options: UseAITradeCoachOptions = {}): UseAITradeCoachReturn {
  const { autoStart = false, enableVoice = false, maxHistorySize = 50 } = options;

  const [state, setState] = useState<CoachSessionState>(initialState);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for stable references
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Use ref for isProcessing to avoid closure capturing stale state in setInterval
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  // Get market data for the trade's symbol
  const getMarketData = useCallback((symbol: string) => {
    return useMarketDataStore.getState().symbols[symbol];
  }, []);

  /**
   * Build MarketData object from marketDataStore for AI coaching
   */
  const buildMarketInput = useCallback((symbol: string): MarketData | null => {
    const symbolData = useMarketDataStore.getState().symbols[symbol];
    if (!symbolData) return null;

    const indicators = symbolData.indicators || {};
    const candles1m = symbolData.candles?.["1m"] || [];
    const candlesDaily = symbolData.candles?.["1D"] || [];

    // Get latest price from 1m candles
    const latestCandle = candles1m[candles1m.length - 1];
    const lastPrice = latestCandle?.close || 0;

    // Get prior day levels from daily candles
    const priorDayCandle = candlesDaily[candlesDaily.length - 2]; // Second to last is prior day
    const todayCandle = candlesDaily[candlesDaily.length - 1];

    // Estimate volume (current vs average)
    const currentVolume = latestCandle?.volume || 0;
    const avgVolume =
      candles1m.reduce((sum, c) => sum + (c.volume || 0), 0) / Math.max(candles1m.length, 1);

    return {
      lastPrice,
      bid: lastPrice * 0.9999, // Approximate - real bid/ask would come from quote stream
      ask: lastPrice * 1.0001,
      volume: currentVolume,
      avgVolume,
      vwap: indicators.vwap || lastPrice,
      atr: indicators.atr14 || 0,
      rsi: indicators.rsi14 || 50,
      ema9: indicators.ema9,
      ema20: indicators.ema20,
      ema50: indicators.ema50,
      priorDayHigh: priorDayCandle?.high || todayCandle?.high || lastPrice,
      priorDayLow: priorDayCandle?.low || todayCandle?.low || lastPrice,
      priorDayClose: priorDayCandle?.close || todayCandle?.open || lastPrice,
      // ORB levels would need to be calculated from first 15-30 min of trading
      orbHigh: undefined,
      orbLow: undefined,
      // Swing levels from recent price action
      swingHigh: Math.max(...candles1m.slice(-50).map((c) => c.high || 0)) || undefined,
      swingLow:
        Math.min(
          ...candles1m
            .slice(-50)
            .filter((c) => c.low > 0)
            .map((c) => c.low)
        ) || undefined,
      // MTF trend from store
      mtfTrend: symbolData.mtfTrend as Record<string, string>,
      // Confluence from store
      confluence: symbolData.confluence
        ? {
            overall: symbolData.confluence.overall,
            trend: symbolData.confluence.trend,
            momentum: symbolData.confluence.momentum,
            volatility: symbolData.confluence.volatility,
            volume: symbolData.confluence.volume,
          }
        : undefined,
    };
  }, []);

  // Get trade from store
  const getTrade = useCallback((tradeId: string) => {
    const store = useTradeStore.getState();
    return store.activeTrades.find((t) => t.id === tradeId) || store.currentTrade;
  }, []);

  /**
   * Start a new coaching session
   */
  const startSession = useCallback(
    async (trade: Trade) => {
      if (stateRef.current.isActive && stateRef.current.tradeId === trade.id) {
        console.log("[AICoach] Session already active for this trade");
        return;
      }

      setIsProcessing(true);
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const coachingMode = getCoachingModeFromTradeType(trade.tradeType);

        // Normalize tradeType to ensure it's a valid value for the backend
        // Backend expects: 'Scalp' | 'Day' | 'Swing' | 'LEAP' (case-sensitive)
        const normalizeTradeType = (
          type: string | undefined
        ): "Scalp" | "Day" | "Swing" | "LEAP" => {
          switch (type?.toLowerCase()) {
            case "scalp":
              return "Scalp";
            case "day":
              return "Day";
            case "swing":
              return "Swing";
            case "leap":
              return "LEAP";
            default:
              return "Day"; // Default to Day trade if not specified
          }
        };

        // Build trade data for the API
        const tradeData = {
          symbol: trade.contract?.id || trade.ticker,
          underlying: trade.ticker,
          direction: (trade.contract?.type === "P" ? "SHORT" : "LONG") as "LONG" | "SHORT",
          tradeType: normalizeTradeType(trade.tradeType),
          dte: trade.contract?.daysToExpiry || 0,
          strike: trade.contract?.strike,
          optionType: trade.contract?.type === "C" ? ("CALL" as const) : ("PUT" as const),
          contractSymbol: trade.contract?.id,
          entryPrice: trade.entryPrice || trade.contract?.mid || 0,
          stopPrice: trade.stopLoss || 0,
          targets: {
            t1: trade.targetPrice || 0,
            t2: undefined,
            t3: undefined,
          },
        };

        const { sessionId, initialAnalysis } = await startCoachSession(
          trade.id,
          coachingMode,
          tradeData
        );

        setState({
          sessionId,
          tradeId: trade.id,
          coachingMode,
          isActive: true,
          isLoading: false,
          error: null,
          latestResponse: initialAnalysis,
          responseHistory: [initialAnalysis],
          updateCount: 1,
          tokensUsed: initialAnalysis.tokensUsed || 0,
          startTime: Date.now(),
        });

        // Start update interval based on trade type
        const interval = options.updateInterval || DEFAULT_UPDATE_INTERVALS[coachingMode];
        startUpdateInterval(trade.id, interval);

        console.log(`[AICoach] Session started: ${sessionId} (${coachingMode} mode)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start session";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        console.error("[AICoach] Failed to start session:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [options.updateInterval]
  );

  /**
   * End the current coaching session
   */
  const endSession = useCallback(async () => {
    if (!stateRef.current.sessionId) {
      return;
    }

    setIsProcessing(true);

    try {
      // Stop update interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      await endCoachSession(stateRef.current.sessionId);
      console.log(`[AICoach] Session ended: ${stateRef.current.sessionId}`);

      setState(initialState);
    } catch (error) {
      console.error("[AICoach] Failed to end session:", error);
      // Still reset state even if API call fails
      setState(initialState);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Force a refresh of coaching analysis
   */
  const refresh = useCallback(async () => {
    if (!stateRef.current.sessionId || !stateRef.current.tradeId) {
      console.warn("[AICoach] No active session to refresh");
      return;
    }

    const trade = getTrade(stateRef.current.tradeId);
    if (!trade) {
      console.warn("[AICoach] Trade not found for refresh");
      return;
    }

    const market = buildMarketInput(trade.ticker);
    if (!market) {
      console.warn("[AICoach] Market data not available for refresh");
      return;
    }

    const symbolData = getMarketData(trade.ticker);

    setIsProcessing(true);
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await refreshCoachSession(
        stateRef.current.sessionId,
        trade,
        market,
        symbolData?.greeks
      );
      addResponse(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [getTrade, buildMarketInput, getMarketData]);

  /**
   * Ask the coach a question
   */
  const ask = useCallback(
    async (question: string) => {
      if (!stateRef.current.sessionId || !stateRef.current.tradeId) {
        console.warn("[AICoach] No active session to ask");
        return;
      }

      const trade = getTrade(stateRef.current.tradeId);
      if (!trade) {
        console.warn("[AICoach] Trade not found for ask");
        return;
      }

      const market = buildMarketInput(trade.ticker);
      if (!market) {
        console.warn("[AICoach] Market data not available for ask");
        return;
      }

      const symbolData = getMarketData(trade.ticker);

      setIsProcessing(true);
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const response = await askCoach(
          stateRef.current.sessionId,
          question,
          trade,
          market,
          symbolData?.greeks
        );
        addResponse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to ask";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      } finally {
        setIsProcessing(false);
      }
    },
    [getTrade, buildMarketInput, getMarketData]
  );

  /**
   * Check if a trade has an active session
   */
  const hasActiveSession = useCallback((tradeId: string) => {
    return stateRef.current.isActive && stateRef.current.tradeId === tradeId;
  }, []);

  /**
   * Add a response to history
   */
  const addResponse = useCallback(
    (response: CoachingResponse) => {
      setState((prev) => {
        const newHistory = [response, ...prev.responseHistory].slice(0, maxHistorySize);
        return {
          ...prev,
          isLoading: false,
          latestResponse: response,
          responseHistory: newHistory,
          updateCount: prev.updateCount + 1,
          tokensUsed: prev.tokensUsed + (response.tokensUsed || 0),
        };
      });

      // Voice output (future implementation)
      if (enableVoice && response.shouldSpeak) {
        // TODO: Integrate with TTS system
        console.log("[AICoach] Would speak:", response.summary);
      }
    },
    [maxHistorySize, enableVoice]
  );

  /**
   * Start the automatic update interval
   */
  const startUpdateInterval = useCallback(
    (tradeId: string, intervalMs: number) => {
      // Clear any existing interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      updateIntervalRef.current = setInterval(async () => {
        const currentState = stateRef.current;
        if (!currentState.isActive || !currentState.sessionId) {
          return;
        }

        // Skip if processing or recently updated
        // Use ref to avoid closure capturing stale isProcessing state
        if (isProcessingRef.current || Date.now() - lastUpdateRef.current < intervalMs / 2) {
          return;
        }

        const trade = getTrade(tradeId);
        if (!trade) {
          console.warn("[AICoach] Trade not found, stopping updates");
          return;
        }

        const marketData = getMarketData(trade.ticker);
        if (!marketData) {
          return;
        }

        try {
          lastUpdateRef.current = Date.now();
          const response = await updateCoachSession(
            currentState.sessionId,
            trade,
            marketData,
            marketData.greeks
          );

          if (response) {
            addResponse(response);
          }
        } catch (error) {
          console.error("[AICoach] Update failed:", error);
        }
      }, intervalMs);
    },
    [getTrade, getMarketData, addResponse]
  ); // Removed isProcessing - using isProcessingRef instead

  /**
   * Auto-start for entered trades (if enabled)
   */
  useEffect(() => {
    if (!autoStart) return;

    // Subscribe to trade state changes
    const unsubscribe = useTradeStore.subscribe((state) => {
      const currentTrade = state.currentTrade;
      if (currentTrade && currentTrade.state === "ENTERED" && !stateRef.current.isActive) {
        startSession(currentTrade);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [autoStart, startSession]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  // Derived values
  const latestSummary = state.latestResponse?.summary || null;
  const latestRecommendations = state.latestResponse?.recommendations || [];
  const riskFlags = state.latestResponse?.riskFlags || [];

  return {
    state,
    startSession,
    endSession,
    refresh,
    ask,
    hasActiveSession,
    latestSummary,
    latestRecommendations,
    riskFlags,
    isProcessing,
  };
}

export default useAITradeCoach;
