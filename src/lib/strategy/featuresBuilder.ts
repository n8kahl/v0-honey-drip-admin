import type { SymbolFeatures } from './engine.js';
import {
  isPatientCandle,
  computeORBLevels,
  getMinutesSinceOpen,
  computeSwingLevels,
  computeFibLevels,
  isNearFibLevel,
  computeConsolidationRange,
  isVolumeSpike,
  isConsolidation,
  isBreakout,
  computeAvgVolume,
  calculateRelativeVolume,
  detectRSIDivergence,
  detectMultiTimeframeDivergence,
  type Bar,
} from './patternDetection.js';
import type { AggregatedFlowMetrics } from '../massive/aggregate-flow.js';

export type TimeframeKey = '1m' | '5m' | '15m' | '60m' | '1d';

export interface MTFIndicatorSnapshot {
  price?: { current?: number; open?: number; high?: number; low?: number; prevClose?: number; prev?: number };
  vwap?: { value?: number; distancePct?: number; prev?: number };
  ema?: Record<string, number>;
  rsi?: Record<string, number>;
  atr?: number;
}

export interface RawMTFContext {
  // map timeframe to its latest indicator snapshot
  [tf: string]: MTFIndicatorSnapshot | undefined;
}

export interface BuildFeaturesOptions {
  symbol: string;
  timeISO: string;
  primaryTf?: TimeframeKey; // which timeframe mirrors top-level price/ema/rsi
  mtf: RawMTFContext;
  bars?: Bar[]; // Historical bars for pattern detection (sorted chronologically)
  timezone?: string; // For session time calculations (default "America/New_York")
  flow?: AggregatedFlowMetrics | null; // Aggregated flow metrics from options chain
}

/**
 * Build a SymbolFeatures object capturing multi-timeframe indicators.
 * - Mirrors the selected primary timeframe into top-level fields for convenience.
 * - Keeps all timeframes under `mtf[tf]` for MTF rule references.
 * - Optionally fills previous values to enable crosses ops (if provided in mtf snapshots).
 * - Computes pattern features (ORB, patient candle, consolidation, etc.) from bars.
 */
export function buildSymbolFeatures(opts: BuildFeaturesOptions): SymbolFeatures {
  const { symbol, timeISO, mtf, primaryTf = '5m', bars = [], timezone = 'America/New_York', flow = null } = opts;
  const primary = mtf[primaryTf] || {};

  const price = primary.price || {};
  const vwap = primary.vwap || {};
  const ema = primary.ema || {};
  const rsi = primary.rsi || {};
  const atr = primary.atr || 0;

  const timestamp = Math.floor(new Date(timeISO).getTime() / 1000);
  const currentBar: Bar | undefined = bars.length > 0 ? bars[bars.length - 1] : undefined;
  const prevBar: Bar | undefined = bars.length > 1 ? bars[bars.length - 2] : undefined;
  const previousBars = bars.length > 1 ? bars.slice(0, -1) : [];
  const recentBars = bars.slice(-20); // Last 20 bars for consolidation/swing
  const last10Bars = bars.slice(-10);

  // Session time
  const minutesSinceOpen = currentBar ? getMinutesSinceOpen(currentBar.time, timezone) : undefined;
  const isRegularHours = minutesSinceOpen !== undefined && minutesSinceOpen >= 0 && minutesSinceOpen < 390; // 9:30-16:00

  // ORB levels
  const marketOpenTime = currentBar ? Math.floor(new Date(currentBar.time * 1000).setHours(9, 30, 0, 0) / 1000) : 0;
  const orb = computeORBLevels(bars, marketOpenTime, 15);

  // Patient candle
  const patientCandle = currentBar && atr > 0 ? isPatientCandle(currentBar, atr) : false;

  // Swing levels & Fib
  const swing = computeSwingLevels(recentBars);
  const fib = computeFibLevels(swing.swingHigh, swing.swingLow);

  // Consolidation
  const consolidation = computeConsolidationRange(recentBars);
  const isConsol = atr > 0 ? isConsolidation(recentBars, atr) : false;

  // Breakout
  const breakout = currentBar ? isBreakout(currentBar, consolidation.high, consolidation.low) : { bullish: false, bearish: false };

  // Volume
  const avgVolume = computeAvgVolume(last10Bars);
  const volumeSpike = currentBar && avgVolume > 0 ? isVolumeSpike(currentBar.volume, avgVolume) : false;

  // Calculate RVOL (Relative Volume)
  const rvol = currentBar && avgVolume > 0
    ? calculateRelativeVolume(currentBar.volume, previousBars, false)
    : undefined;

  // Near Fib levels
  const currentPrice = price.current ?? 0;
  const nearFib618 = currentPrice > 0 ? isNearFibLevel(currentPrice, fib.fib618) : false;
  const nearFib500 = currentPrice > 0 ? isNearFibLevel(currentPrice, fib.fib500) : false;

  // RSI Divergence Detection (5m timeframe)
  // Requires at least 20 bars for reliable divergence detection
  const rsiDiv5m = bars.length >= 20
    ? detectRSIDivergence(bars.slice(-20), 14, 10)
    : { bullish: false, bearish: false };

  // Multi-Timeframe Divergence Detection
  // Checks if RSI trends across timeframes align (bullish or bearish convergence)
  const mtfRsiData: Record<string, { rsi: number; price: number }> = {};

  // Build MTF RSI data from available timeframes
  const timeframes = ['1m', '5m', '15m', '60m'] as const;
  for (const tf of timeframes) {
    const tfData = mtf[tf];
    if (tfData?.rsi?.['14'] !== undefined && tfData?.price?.current !== undefined) {
      mtfRsiData[tf] = {
        rsi: tfData.rsi['14'],
        price: tfData.price.current
      };
    }
  }

  // Only detect MTF divergence if we have data from at least 2 timeframes
  const mtfDiv = Object.keys(mtfRsiData).length >= 2
    ? detectMultiTimeframeDivergence(mtfRsiData)
    : { aligned: false, direction: null };

  // Build previous snapshot for cross operations
  const prevSnapshot = mtf[primaryTf]?.price?.prev !== undefined ? {
    price: {
      current: mtf[primaryTf]?.price?.prev,
    },
    vwap: {
      value: mtf[primaryTf]?.vwap?.prev,
    },
    ema: ema || {}, // Could extract previous EMAs if available
    rsi: rsi || {}, // Could extract previous RSIs if available
  } : (prevBar ? {
    price: {
      current: prevBar.close,
    },
    volume: {
      current: prevBar.volume,
    },
  } : {});

  return {
    symbol,
    time: timeISO,
    price: {
      current: price.current ?? 0,
      open: price.open,
      high: price.high,
      low: price.low,
      prevClose: price.prevClose,
      prev: price.prev,
    },
    volume: {
      current: currentBar?.volume,
      avg: avgVolume > 0 ? avgVolume : undefined,
      prev: previousBars.length > 0 ? previousBars[previousBars.length - 1].volume : undefined,
      relativeToAvg: rvol,
    },
    flow: flow ? {
      sweepCount: flow.sweepCount,
      blockCount: flow.blockCount,
      unusualActivity: flow.unusualActivity,
      flowScore: flow.flowScore,
      flowBias: flow.flowBias,
      buyPressure: flow.buyPressure,
    } : undefined,
    vwap: {
      value: vwap.value,
      distancePct: vwap.distancePct,
      prev: vwap.prev,
    },
    ema: ema || {},
    rsi: rsi || {},
    session: {
      minutesSinceOpen,
      isRegularHours,
    },
    mtf: mtf as any,
    pattern: {
      isPatientCandle: patientCandle,
      orbHigh: orb.orbHigh,
      orbLow: orb.orbLow,
      swingHigh: swing.swingHigh,
      swingLow: swing.swingLow,
      fib618: fib.fib618,
      fib500: fib.fib500,
      nearFib618,
      nearFib500,
      consolidationHigh: consolidation.high,
      consolidationLow: consolidation.low,
      isConsolidation: isConsol,
      breakoutBullish: breakout.bullish,
      breakoutBearish: breakout.bearish,
      volumeSpike,
      // Divergence Detection (Phase 1 - wired up existing functions)
      rsi_divergence_5m: rsiDiv5m.bullish || rsiDiv5m.bearish,
      mtf_divergence_aligned: mtfDiv.aligned,
    },
    prev: prevSnapshot,
  };
}

/**
 * Helper to compute VWAP distance percentage if not provided.
 * distancePct = (price.current - vwap.value) / vwap.value * 100
 */
export function computeVwapDistancePct(price?: number, vwap?: number): number | undefined {
  if (price == null || vwap == null || vwap === 0) return undefined;
  return ((price - vwap) / vwap) * 100;
}
