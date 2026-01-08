import { Bar, Timeframe } from "./MultiTimeframeLoader.js";
import { SymbolFeatures } from "../strategy/engine.js";
import { OptionsFlowRecord } from "../../types/flow.js";
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateVWAP,
  calculateSMA,
} from "./indicators.js";
import { RegimeManager } from "../strategy/RegimeManager.js";
import { flowAnalysisEngine, FlowContext } from "../engines/FlowAnalysisEngine.js";
import { gammaExposureEngine, GammaContext } from "../engines/GammaExposureEngine.js";

/**
 * Pre-fetched context for live trading scenarios
 * Use this to inject flow/gamma context into the build() method
 */
export interface LiveContext {
  flowContext?: FlowContext | null;
  gammaContext?: GammaContext | null;
}

/**
 * Features Builder
 *
 * Responsible for reconstructing the full SymbolFeatures object
 * from raw historical bars, including:
 * 1. Technical Indicators (RSI, EMA, VWAP, etc.)
 * 2. Multi-Timeframe (MTF) Context
 * 3. Historical Flow Replay (simulated)
 * 4. Live Flow/Gamma Context (optional, for real-time trading)
 */
export class FeaturesBuilder {
  /**
   * Build features with live context engines
   * Use this for real-time trading scenarios where you want
   * to fetch the latest flow and gamma context from the database.
   *
   * @param symbol - Symbol to analyze
   * @param tick - Current 1m bar
   * @param history1m - 1m history up to this point
   * @param mtfContext - Relevant history for other timeframes
   * @param flowData - Historical flow data (for backtesting)
   * @returns Promise<SymbolFeatures> with live context integrated
   */
  static async buildWithContext(
    symbol: string,
    tick: Bar,
    history1m: Bar[],
    mtfContext: Record<Timeframe, Bar[]>,
    flowData?: OptionsFlowRecord[]
  ): Promise<SymbolFeatures> {
    // Fetch live context from engines (with graceful error handling)
    let flowContext: FlowContext | null = null;
    let gammaContext: GammaContext | null = null;

    try {
      flowContext = await flowAnalysisEngine.getFlowContext(symbol, "medium");
    } catch (err) {
      console.warn(`[FeaturesBuilder] Failed to fetch flow context for ${symbol}:`, err);
    }

    try {
      gammaContext = await gammaExposureEngine.getGammaContext(symbol);
    } catch (err) {
      console.warn(`[FeaturesBuilder] Failed to fetch gamma context for ${symbol}:`, err);
    }

    // Build features with injected context
    return FeaturesBuilder.build(symbol, tick, history1m, mtfContext, flowData, {
      flowContext,
      gammaContext,
    });
  }

  /**
   * Build features for a specific point in time
   *
   * @param symbol - Symbol to analyze
   * @param tick - Current 1m bar
   * @param history1m - 1m history up to this point
   * @param mtfContext - Relevant history for other timeframes
   * @param flowData - Historical flow data (for backtesting)
   * @param liveContext - Optional pre-fetched live context (flow/gamma)
   */
  static build(
    symbol: string,
    tick: Bar, // Current 1m bar
    history1m: Bar[], // 1m history up to this point
    mtfContext: Record<Timeframe, Bar[]>, // Relevant history for other timeframes
    flowData?: OptionsFlowRecord[], // Historical flow data structured as records
    liveContext?: LiveContext // Optional live flow/gamma context
  ): SymbolFeatures {
    const closes = history1m.map((b) => b.close);
    const highs = history1m.map((b) => b.high);
    const lows = history1m.map((b) => b.low);
    const volumes = history1m.map((b) => b.volume);

    // 1. Calculate Core Indicators (1m)
    // Note: In a highly optimized engine, these would be incremental.
    // For now, full calculation on slice is safer for correctness.
    const lookback = 200; // Max period needed
    const recentCloses = closes.slice(-lookback);

    // EMA
    // We only need the last value for the feature snapshot
    const ema8Series = calculateEMA(recentCloses, 8);
    const ema21Series = calculateEMA(recentCloses, 21);
    const ema50Series = calculateEMA(recentCloses, 50);
    const ema200Series = calculateEMA(recentCloses, 200);

    const ema8 = ema8Series[ema8Series.length - 1];
    const ema21 = ema21Series[ema21Series.length - 1];
    const ema50 = ema50Series[ema50Series.length - 1];
    const ema200 = ema200Series[ema200Series.length - 1];

    // RSI
    // Need enough data for wilder smoothing warmup, ideally 200 bars
    // optimize by only calculating last if we had state, but here we recalculate
    const rsi14 = calculateRSI(recentCloses, 14) ?? 50;

    // ATR
    const atr14 = calculateATR(
      highs.slice(-lookback),
      lows.slice(-lookback),
      closes.slice(-lookback),
      14
    );

    // VWAP (Intraday)
    // Filter history for ONLY today (since midnight)
    const startOfDay = new Date(tick.timestamp).setHours(0, 0, 0, 0);
    const todaysBars = history1m.filter((b) => b.timestamp >= startOfDay);
    const vwapValue = calculateVWAP(todaysBars);
    const vwapDist = vwapValue ? ((tick.close - vwapValue) / vwapValue) * 100 : 0;

    // Volume
    const avgVol20 = calculateSMA(volumes, 20);
    const rvol = avgVol20 > 0 ? tick.volume / avgVol20 : 1.0;

    // 2. Build MTF Context
    const mtfFeatures: any = {};
    const relevantTFs: Timeframe[] = ["5m", "15m", "60m"];

    for (const tf of relevantTFs) {
      if (mtfContext[tf] && mtfContext[tf].length > 0) {
        const tfBars = mtfContext[tf];
        const tfCloses = tfBars.map((b) => b.close);

        // Calculate MTF RSI (most common requirement)
        const tfRsi14 = calculateRSI(tfCloses.slice(-lookback), 14) ?? 50;
        const tfEma21Arr = calculateEMA(tfCloses.slice(-lookback), 21);
        const tfEma21 = tfEma21Arr[tfEma21Arr.length - 1];

        mtfFeatures[tf] = {
          price: {
            current: tfCloses[tfCloses.length - 1],
            prev: tfCloses[tfCloses.length - 2],
          },
          rsi: {
            "14": tfRsi14,
          },
          ema: {
            "21": tfEma21,
          },
        };
      }
    }

    // 3. Flow Analysis
    // Prefer live context if available, otherwise use historical flow replay
    const flowResult = FeaturesBuilder.buildFlowFeatures(tick, flowData, liveContext?.flowContext);

    // 4. Greeks/Gamma Context
    // Build from live gamma context if available
    const greeksResult = FeaturesBuilder.buildGreeksFeatures(liveContext?.gammaContext);

    // 5. Market Regime
    // We build a partial features object first to pass to RegimeManager
    const baseFeatures: any = {
      price: { current: tick.close },
      ema: { "8": ema8, "21": ema21, "50": ema50, "200": ema200 },
      rsi: { "14": rsi14 },
      atr: atr14,
      vwap: { value: vwapValue },
    };
    const regime = RegimeManager.classify(baseFeatures as any);

    // ATR (15m ATR is better for targets even on 1m execution)
    const atr15mBars = mtfContext["15m"] || [];
    let strategyAtr = atr14;
    if (atr15mBars.length > 20) {
      const h15 = atr15mBars.map((b) => b.high);
      const l15 = atr15mBars.map((b) => b.low);
      const c15 = atr15mBars.map((b) => b.close);
      strategyAtr = calculateATR(h15, l15, c15, 14);
    }

    const patternAtr = strategyAtr;

    return {
      symbol,
      time: new Date(tick.timestamp).toISOString(),
      price: {
        current: tick.close,
        open: tick.open,
        high: tick.high,
        low: tick.low,
        prevClose: closes[closes.length - 2] || tick.open,
        prev: closes[closes.length - 2] || tick.open, // Alias for older detectors
      },
      volume: {
        current: tick.volume,
        avg: avgVol20,
        relativeToAvg: rvol,
        relative_to_avg: rvol, // Alias
      },
      vwap: {
        value: vwapValue ?? undefined,
        distancePct: vwapDist,
      },
      ema: {
        "8": ema8,
        "21": ema21,
        "50": ema50,
        "200": ema200,
      },
      rsi: {
        "14": rsi14,
      },
      atr: patternAtr, // Top-level alias
      pattern: {
        atr: patternAtr,
        dayHigh: Math.max(...todaysBars.map((b) => b.high)),
        dayLow: Math.min(...todaysBars.map((b) => b.low)),
        market_regime: regime, // Snake case alias

        // --- Multi-Timeframe Pattern Detection ---
        // We use 15m context for core patterns if available, otherwise 1m
        ...(() => {
          const ctx15m = mtfContext["15m"] || [];
          const use15m = ctx15m.length > 2;
          const refBars = use15m ? ctx15m : history1m;
          const refHighs = refBars.map((b) => b.high);
          const refLows = refBars.map((b) => b.low);

          // RSI and EMA for patterns (re-calculate on ref timeframe if needed)
          // For now we use the 1m versions as they are sensitive enough
          const pRsi = rsi14;
          const pEma8 = ema8;
          const pEma21 = ema21;
          const pEma50 = ema50;

          const pflags = {
            // Balanced: 10-bar rolling breakout on 15m
            breakoutBullish:
              refHighs.length > 10 && tick.close > Math.max(...refHighs.slice(-11, -1)),
            breakoutBearish:
              refLows.length > 10 && tick.close < Math.min(...refLows.slice(-11, -1)),

            // Balanced Mean Reversion: RSI 35/65
            meanReversionLong: pRsi < 35,
            meanReversionShort: pRsi > 65,

            // Balanced Trend: EMA Stack (8 > 21 > 50)
            trendContinuationLong: pEma8 > pEma21 && pEma21 > pEma50,
            trendContinuationShort: pEma8 < pEma21 && pEma21 < pEma50,
          };

          return {
            ...pflags,
            // Snake case aliases
            breakout_bullish: pflags.breakoutBullish,
            breakout_bearish: pflags.breakoutBearish,
            mean_reversion_long: pflags.meanReversionLong,
            mean_reversion_short: pflags.meanReversionShort,
            trend_continuation_long: pflags.trendContinuationLong,
            trend_continuation_short: pflags.trendContinuationShort,
          };
        })(),

        // 15m ORB: Opening Range (9:30-9:45 EST / 14:30-14:45 UTC)
        orbHigh:
          todaysBars.length >= 15 ? Math.max(...todaysBars.slice(0, 15).map((b) => b.high)) : 0,
        orbLow:
          todaysBars.length >= 15 ? Math.min(...todaysBars.slice(0, 15).map((b) => b.low)) : 0,
      },
      flow: flowResult.flow,
      greeks: greeksResult.greeks,
      regime: regime,
      marketRegime: regime, // camelCase alias
      market_regime: regime, // snake_case alias (top-level)
      mtf: mtfFeatures,
      session: (() => {
        const date = new Date(tick.timestamp);
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        const min = date.getUTCMinutes();
        const timeNum = hour * 100 + min;

        // Typical US Market Hours (14:30 - 21:00 UTC)
        const isRTH = day >= 1 && day <= 5 && timeNum >= 1430 && timeNum < 2100;
        const minutesSinceOpen = isRTH ? (hour - 14) * 60 + (min - 30) : 0;

        return {
          isRegularHours: isRTH,
          minutesSinceOpen: minutesSinceOpen,
        };
      })(),
      divergence: { type: "none", confidence: 0 }, // Stub for now

      // === TOP-LEVEL ALIASES FOR DETECTOR COMPATIBILITY ===
      // Some detectors access features.rsi directly instead of features.rsi["14"]
      rsi_14: rsi14,
      atr_14: patternAtr,
      ema_8: ema8,
      ema_21: ema21,
      ema_50: ema50,
      ema_200: ema200,
      vwap_distance_pct: vwapDist,
      relative_volume: rvol,
      flow_score: flowResult.flow.flowScore ?? 50,
      flow_bias: flowResult.flow.flowBias ?? "neutral",
      institutional_score: flowResult.flow.institutionalConviction ?? 20,
      gamma_risk: greeksResult.greeks?.gammaRisk ?? "medium",
      dealer_positioning: greeksResult.dealerPositioning ?? "NEUTRAL",
      dealer_net_delta: greeksResult.dealerNetDelta ?? 0,
    };
  }

  /**
   * Build flow features from historical data or live context
   * @private
   */
  private static buildFlowFeatures(
    tick: Bar,
    flowData?: OptionsFlowRecord[],
    liveFlowContext?: FlowContext | null
  ): { flow: SymbolFeatures["flow"] } {
    // Default fallback values
    const defaultFlow: SymbolFeatures["flow"] = {
      sweepCount: 0,
      blockCount: 0,
      totalPremium: 0,
      flowScore: 50, // Neutral baseline
      flowBias: "neutral",
      institutionalConviction: 20, // Low baseline
      aggressiveness: "NORMAL",
      putCallRatio: 1.0,
      largeTradePercentage: 0,
      avgTradeSize: 0,
      unusualActivity: false,
    };

    // PRIORITY 1: Live context from FlowAnalysisEngine
    if (liveFlowContext) {
      return {
        flow: {
          sweepCount: liveFlowContext.sweepCount ?? 0,
          blockCount: liveFlowContext.blockCount ?? 0,
          splitCount: liveFlowContext.splitCount ?? 0,
          totalPremium: liveFlowContext.totalPremium ?? 0,
          flowScore: liveFlowContext.sentimentStrength ?? 50,
          flowBias: FeaturesBuilder.mapSentimentToBias(liveFlowContext.sentiment),
          institutionalConviction: liveFlowContext.institutionalScore ?? 20,
          aggressiveness: liveFlowContext.aggressiveness ?? "NORMAL",
          putCallRatio: liveFlowContext.putCallVolumeRatio ?? 1.0,
          largeTradePercentage: liveFlowContext.largeTradePercentage ?? 0,
          avgTradeSize: liveFlowContext.avgTradeSize ?? 0,
          callVolume: liveFlowContext.callVolume ?? 0,
          putVolume: liveFlowContext.putVolume ?? 0,
          buyPressure:
            liveFlowContext.totalPremium > 0
              ? (liveFlowContext.buyPremium / liveFlowContext.totalPremium) * 100
              : 50,
          unusualActivity:
            liveFlowContext.aggressiveness === "AGGRESSIVE" ||
            liveFlowContext.aggressiveness === "VERY_AGGRESSIVE",
        },
      };
    }

    // PRIORITY 2: Historical flow replay (for backtesting)
    if (flowData && flowData.length > 0) {
      // Filter flowData for recent activity (last 60m for conviction)
      const recentFlow = flowData.filter(
        (f) => f.timestamp <= tick.timestamp && f.timestamp > tick.timestamp - 60 * 60 * 1000
      );

      if (recentFlow.length === 0) {
        return { flow: defaultFlow };
      }

      const bullishFlow = recentFlow.filter((f) => f.side === "BULLISH");
      const bearishFlow = recentFlow.filter((f) => f.side === "BEARISH");

      const bullishPremium = bullishFlow.reduce((sum, f) => sum + f.premium, 0);
      const bearishPremium = bearishFlow.reduce((sum, f) => sum + f.premium, 0);
      const totalPremium = bullishPremium + bearishPremium;

      const sweeps = recentFlow.filter((f) => f.classification === "SWEEP");
      const blocks = recentFlow.filter((f) => f.classification === "BLOCK");

      // Calculate flow score based on bias ratio
      let flowScore = 50; // Neutral baseline
      if (totalPremium > 0) {
        const biasRatio = bullishPremium / totalPremium;
        if (biasRatio > 0.7) flowScore = 85;
        else if (biasRatio > 0.6) flowScore = 70;
        else if (biasRatio < 0.3) flowScore = 15;
        else if (biasRatio < 0.4) flowScore = 30;
      }

      // Calculate institutional conviction
      const conviction = Math.min(100, sweeps.length * 5 + totalPremium / 100000);

      // Determine flow bias
      const flowBias: "bullish" | "bearish" | "neutral" =
        flowScore > 65 ? "bullish" : flowScore < 35 ? "bearish" : "neutral";

      return {
        flow: {
          sweepCount: sweeps.length,
          blockCount: blocks.length,
          totalPremium: totalPremium,
          flowScore: flowScore,
          flowBias: flowBias,
          institutionalConviction: conviction,
          optionsFlowConviction: conviction, // Alias
          aggressiveness: sweeps.length > 5 ? "AGGRESSIVE" : "NORMAL",
          putCallRatio: 1.0, // Would need call/put data to calculate
          largeTradePercentage:
            recentFlow.length > 0 ? ((sweeps.length + blocks.length) / recentFlow.length) * 100 : 0,
          avgTradeSize: recentFlow.length > 0 ? totalPremium / recentFlow.length : 0,
          unusualActivity: sweeps.length > 3 || blocks.length > 2,
        },
      };
    }

    // FALLBACK: Return defaults
    return { flow: defaultFlow };
  }

  /**
   * Build greeks features from live gamma context
   * @private
   */
  private static buildGreeksFeatures(gammaContext?: GammaContext | null): {
    greeks: SymbolFeatures["greeks"];
    dealerPositioning: string;
    dealerNetDelta: number;
  } {
    // Default fallback values
    const defaultGreeks: SymbolFeatures["greeks"] = {
      gammaRisk: "medium",
      thetaDecayRate: "moderate",
    };

    if (!gammaContext) {
      return {
        greeks: defaultGreeks,
        dealerPositioning: "NEUTRAL",
        dealerNetDelta: 0,
      };
    }

    // Map gamma context to greeks features
    const gammaRisk = FeaturesBuilder.mapGammaRisk(
      gammaContext.dealerPositioning,
      gammaContext.positioningStrength
    );

    return {
      greeks: {
        gamma: gammaContext.totalGamma ?? undefined,
        gammaRisk: gammaRisk,
        // Note: delta, theta, vega would need options chain data
        // These are symbol-level gamma context, not option-specific greeks
      },
      dealerPositioning: gammaContext.dealerPositioning ?? "NEUTRAL",
      dealerNetDelta: gammaContext.dealerNetGamma ?? 0,
    };
  }

  /**
   * Map FlowSentiment to flowBias
   * @private
   */
  private static mapSentimentToBias(
    sentiment?: "BULLISH" | "BEARISH" | "NEUTRAL"
  ): "bullish" | "bearish" | "neutral" {
    if (sentiment === "BULLISH") return "bullish";
    if (sentiment === "BEARISH") return "bearish";
    return "neutral";
  }

  /**
   * Map gamma positioning to risk level
   * @private
   */
  private static mapGammaRisk(positioning?: string, strength?: string): "high" | "medium" | "low" {
    // SHORT_GAMMA = dealers need to buy dips/sell rips = amplified moves = HIGH risk
    // LONG_GAMMA = dealers sell dips/buy rips = dampened moves = LOW risk
    if (positioning === "SHORT_GAMMA") {
      if (strength === "EXTREME" || strength === "STRONG") return "high";
      return "medium";
    }
    if (positioning === "LONG_GAMMA") {
      if (strength === "EXTREME" || strength === "STRONG") return "low";
      return "medium";
    }
    return "medium";
  }
}
