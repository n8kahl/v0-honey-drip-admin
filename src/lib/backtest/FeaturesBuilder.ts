
import { Bar, Timeframe } from "./MultiTimeframeLoader.js";
import { SymbolFeatures } from "../strategy/engine.js";
import {
    calculateEMA,
    calculateRSI,
    calculateATR,
    calculateVWAP,
    calculateSMA,
    calculateStdDev
} from "./indicators.js";

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
        flowData?: any[] // Optional historical flow data (TODO: Define Flow type)
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
        const todaysBars = history1m.filter(b => b.timestamp >= startOfDay);
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
                const tfCloses = tfBars.map(b => b.close);

                // Calculate MTF RSI (most common requirement)
                const tfRsi14 = calculateRSI(tfCloses.slice(-lookback), 14) ?? 50;
                const tfEma21Arr = calculateEMA(tfCloses.slice(-lookback), 21);
                const tfEma21 = tfEma21Arr[tfEma21Arr.length - 1];

                mtfFeatures[tf] = {
                    price: {
                        current: tfCloses[tfCloses.length - 1],
                        prev: tfCloses[tfCloses.length - 2]
                    },
                    rsi: {
                        "14": tfRsi14
                    },
                    ema: {
                        "21": tfEma21
                    }
                };
            }
        }

        // 3. Flow Replay (Stub for now, enabling basic flow features)
        // Filter flowData for recent sweeps (last 30m)
        const recentSweeps = flowData ? flowData.filter(
            f => f.timestamp <= tick.timestamp && f.timestamp > tick.timestamp - 30 * 60 * 1000
        ).length : 0;

        const flowScore = recentSweeps > 5 ? 80 : recentSweeps > 2 ? 60 : 40;
        const flowBias = flowScore > 50 ? "bullish" : "neutral"; // Simplified

        return {
            symbol,
            time: new Date(tick.timestamp).toISOString(),
            price: {
                current: tick.close,
                open: tick.open,
                high: tick.high,
                low: tick.low,
                prevClose: closes[closes.length - 2] || tick.open,
            },
            volume: {
                current: tick.volume,
                avg: avgVol20,
                relativeToAvg: rvol
            },
            vwap: {
                value: vwapValue ?? undefined,
                distancePct: vwapDist
            },
            ema: {
                "8": ema8,
                "21": ema21,
                "50": ema50,
                "200": ema200
            },
            rsi: {
                "14": rsi14
            },
            pattern: {
                atr: atr14,
                // Day High / Low for Breakouts
                // Need to calculate distinct High/Low of *today* so far
                dayHigh: Math.max(...todaysBars.map(b => b.high)),
                dayLow: Math.min(...todaysBars.map(b => b.low)),
                // Stub ORB for now
                orbHigh: 0,
                orbLow: 0
            },
            flow: {
                sweepCount: recentSweeps,
                flowScore: flowScore,
                flowBias: flowBias as any
            },
            mtf: mtfFeatures
        };
    }
}
