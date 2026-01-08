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

/**
 * Features Builder
 *
 * Responsible for reconstructing the full SymbolFeatures object
 * from raw historical bars, including:
 * 1. Technical Indicators (RSI, EMA, VWAP, etc.)
 * 2. Multi-Timeframe (MTF) Context
 * 3. Historical Flow Replay (simulated)
 */
export class FeaturesBuilder {
  /**
   * Build features for a specific point in time
   */
  static build(
    symbol: string,
    tick: Bar, // Current 1m bar
    history1m: Bar[], // 1m history up to this point
    mtfContext: Record<Timeframe, Bar[]>, // Relevant history for other timeframes
    flowData?: OptionsFlowRecord[] // Historical flow data structured as records
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

    // 3. Flow Replay (Structured analysis)
    // Filter flowData for recent activity (last 60m for conviction)
    const recentFlow = flowData
      ? flowData.filter(
          (f) => f.timestamp <= tick.timestamp && f.timestamp > tick.timestamp - 60 * 60 * 1000
        )
      : [];

    // Heuristic Flow Score (0-100)
    let flowScore = 50; // Baseline
    let conviction = 20; // Lower baseline conviction
    let sweeps: OptionsFlowRecord[] = [];
    let blocks: OptionsFlowRecord[] = [];
    let totalPremium = 0;

    if (recentFlow.length > 0) {
      const bullishFlow = recentFlow.filter((f) => f.side === "BULLISH");
      const bearishFlow = recentFlow.filter((f) => f.side === "BEARISH");

      const bullishPremium = bullishFlow.reduce((sum, f) => sum + f.premium, 0);
      const bearishPremium = bearishFlow.reduce((sum, f) => sum + f.premium, 0);
      totalPremium = bullishPremium + bearishPremium;

      sweeps = recentFlow.filter((f) => f.classification === "SWEEP");
      blocks = recentFlow.filter((f) => f.classification === "BLOCK");

      if (totalPremium > 0) {
        const biasRatio = bullishPremium / totalPremium;
        if (biasRatio > 0.7) flowScore = 85;
        else if (biasRatio > 0.6) flowScore = 70;
        else if (biasRatio < 0.3) flowScore = 15;
        else if (biasRatio < 0.4) flowScore = 30;
      }
      conviction = Math.min(100, sweeps.length * 5 + totalPremium / 100000);
    }

    const flowBias: "bullish" | "bearish" | "neutral" =
      flowScore > 65 ? "bullish" : flowScore < 35 ? "bearish" : "neutral";

    // 4. Market Regime
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
      flow: {
        sweepCount: sweeps.length,
        blockCount: blocks.length,
        totalPremium: totalPremium,
        flowScore: flowScore,
        flowBias: flowBias,
        institutionalConviction: conviction,
        optionsFlowConviction: conviction, // Alias
      },
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
      flow_score: flowScore,
      flow_bias: flowBias,
    };
  }
}
