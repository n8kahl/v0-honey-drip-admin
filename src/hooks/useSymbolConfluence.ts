/**
 * useSymbolConfluence.ts - Real-time confluence factor calculation for a single symbol
 *
 * Calculates individual factor levels (RVOL, Flow, RSI, VWAP, MTF, etc.)
 * and their progress toward trade entry thresholds.
 *
 * Each factor has:
 * - Current value
 * - Threshold for "ready" state
 * - Percentage complete (0-100)
 * - Status (strong/good/building/weak/missing)
 * - Weight contribution to overall score
 */

import { useMemo } from "react";
import {
  useMarketDataStore,
  type SymbolData,
  type Indicators,
  type MTFTrend,
  type Timeframe,
} from "../stores/marketDataStore";

// ============================================================================
// Types
// ============================================================================

export type FactorStatus = "strong" | "good" | "building" | "weak" | "missing";

export interface FactorData {
  name: string;
  label: string;
  value: number | string;
  displayValue: string;
  threshold: string;
  percentComplete: number; // 0-100
  status: FactorStatus;
  weight: number; // Factor weight in overall score (0-1)
  contribution: number; // weight × percentComplete
  direction?: "bullish" | "bearish" | "neutral";
  tooltip?: string;
  /** Evidence string explaining WHY this factor matters - derived from computed values */
  evidence?: string;
}

export interface MTFData {
  timeframe: string;
  direction: "up" | "down" | "neutral";
  label: string;
  /** Timestamp of last bar update for this timeframe */
  lastBarAt: number | null;
  /** Whether this timeframe's data is stale (>60s since last bar) */
  isStale: boolean;
}

export type TradingStyle = "scalp" | "day" | "swing";

export interface SymbolConfluence {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  factors: FactorData[];
  mtf: MTFData[];
  mtfAligned: number; // Count of aligned timeframes (e.g., 3/4)
  mtfTotal: number; // Total timeframes considered
  /** Most recent MTF bar update across all timeframes */
  mtfLastUpdated: number | null;
  /** Whether any MTF timeframe data is stale */
  mtfHasStale: boolean;
  overallScore: number; // 0-100
  threshold: number; // Score needed for "hot" status
  isHot: boolean; // score >= 90% of threshold
  isReady: boolean; // score >= threshold
  bestStyle: TradingStyle;
  styleScores: Record<TradingStyle, number>;
  lastUpdated: number;
}

// ============================================================================
// Factor Definitions & Thresholds
// ============================================================================

interface FactorThreshold {
  bullish: { min: number; max?: number };
  bearish?: { min: number; max?: number };
  ideal?: number;
  weight: number;
}

const FACTOR_THRESHOLDS: Record<string, FactorThreshold> = {
  rvol: {
    bullish: { min: 1.5 }, // ≥1.5x is good, ≥2.0x is strong
    ideal: 2.0,
    weight: 0.15,
  },
  flow: {
    bullish: { min: 40, max: 100 }, // +40 to +100 for bullish
    bearish: { min: -100, max: -40 }, // -100 to -40 for bearish
    ideal: 60,
    weight: 0.15,
  },
  rsi: {
    bullish: { min: 30, max: 45 }, // Oversold but turning up
    bearish: { min: 55, max: 70 }, // Overbought but turning down
    weight: 0.1,
  },
  vwapDistance: {
    bullish: { min: -0.3, max: 0.3 }, // Within 0.3% of VWAP
    weight: 0.1,
  },
  mtfAlignment: {
    bullish: { min: 3 }, // 3/4 or 4/4 aligned
    weight: 0.15,
  },
  keyLevels: {
    bullish: { min: 0, max: 0.5 }, // Within 0.5% of key level
    weight: 0.1,
  },
  regime: {
    bullish: { min: 1 }, // Trending = 1, Ranging = 0
    weight: 0.1,
  },
  emaStack: {
    bullish: { min: 1 }, // All EMAs stacked in direction
    weight: 0.1,
  },
  ivPercentile: {
    bullish: { min: 20, max: 50 }, // Optimal for buying
    weight: 0.05,
  },
};

// Style-specific score adjustments
const STYLE_WEIGHTS: Record<TradingStyle, Record<string, number>> = {
  scalp: {
    rvol: 1.3, // More important for scalps
    flow: 1.2,
    rsi: 0.8,
    vwapDistance: 1.0,
    mtfAlignment: 0.7,
    keyLevels: 1.2,
    regime: 0.8,
    emaStack: 0.6,
    ivPercentile: 1.0,
  },
  day: {
    rvol: 1.0,
    flow: 1.0,
    rsi: 1.0,
    vwapDistance: 1.0,
    mtfAlignment: 1.0,
    keyLevels: 1.0,
    regime: 1.0,
    emaStack: 1.0,
    ivPercentile: 1.0,
  },
  swing: {
    rvol: 0.7, // Less important for swings
    flow: 0.8,
    rsi: 1.2,
    vwapDistance: 0.6,
    mtfAlignment: 1.3,
    keyLevels: 0.8,
    regime: 1.2,
    emaStack: 1.3,
    ivPercentile: 1.1,
  },
};

// Threshold for "ready" status (varies by asset type)
const READY_THRESHOLDS = {
  default: 75,
  indices: 80, // SPX, NDX require higher score
};

// ============================================================================
// Helper Functions
// ============================================================================

function getFactorStatus(percentComplete: number): FactorStatus {
  if (percentComplete >= 90) return "strong";
  if (percentComplete >= 70) return "good";
  if (percentComplete >= 50) return "building";
  if (percentComplete >= 30) return "weak";
  return "missing";
}

function calculateRVOL(symbolData: SymbolData): {
  value: number;
  displayValue: string;
  percentComplete: number;
  evidence: string;
} {
  // RVOL = current volume / average volume
  // For now, we use the volume from the last candle vs previous candles
  const candles1m = symbolData.candles["1m"];
  if (candles1m.length < 20) {
    return { value: 0, displayValue: "N/A", percentComplete: 0, evidence: "Insufficient data" };
  }

  const recentCandles = candles1m.slice(-20);
  const avgVolume =
    recentCandles.slice(0, -1).reduce((sum, c) => sum + c.volume, 0) / (recentCandles.length - 1);
  const currentVolume = recentCandles[recentCandles.length - 1]?.volume || 0;

  const rvol = avgVolume > 0 ? currentVolume / avgVolume : 0;

  // Calculate percent complete toward 2.0x (strong threshold)
  const target = FACTOR_THRESHOLDS.rvol.ideal || 2.0;
  const percentComplete = Math.min(100, (rvol / target) * 100);

  // Generate evidence string based on computed values
  let evidence: string;
  if (rvol >= 2.0) {
    evidence = `${rvol.toFixed(1)}x avg volume → strong institutional interest`;
  } else if (rvol >= 1.5) {
    evidence = `${rvol.toFixed(1)}x avg volume → elevated activity`;
  } else if (rvol >= 1.0) {
    evidence = `${rvol.toFixed(1)}x avg volume → normal activity`;
  } else {
    evidence = `${rvol.toFixed(1)}x avg volume → below average interest`;
  }

  return {
    value: rvol,
    displayValue: `${rvol.toFixed(1)}x`,
    percentComplete,
    evidence,
  };
}

function calculateFlowBias(symbolData: SymbolData): {
  value: number;
  displayValue: string;
  percentComplete: number;
  direction: "bullish" | "bearish" | "neutral";
  evidence: string;
} {
  // Flow bias is calculated from buy/sell pressure
  // For now, we derive it from price action and volume
  const candles1m = symbolData.candles["1m"];
  if (candles1m.length < 10) {
    return {
      value: 0,
      displayValue: "N/A",
      percentComplete: 0,
      direction: "neutral",
      evidence: "Insufficient data",
    };
  }

  const recent = candles1m.slice(-10);
  let buyPressure = 0;
  let sellPressure = 0;

  recent.forEach((candle) => {
    const range = candle.high - candle.low;
    if (range > 0) {
      const closePosition = (candle.close - candle.low) / range;
      buyPressure += closePosition * candle.volume;
      sellPressure += (1 - closePosition) * candle.volume;
    }
  });

  const totalPressure = buyPressure + sellPressure;
  const flowBias = totalPressure > 0 ? ((buyPressure - sellPressure) / totalPressure) * 100 : 0;

  const direction: "bullish" | "bearish" | "neutral" =
    flowBias >= 40 ? "bullish" : flowBias <= -40 ? "bearish" : "neutral";

  // Percent complete toward ±60 (ideal)
  const target = FACTOR_THRESHOLDS.flow.ideal || 60;
  const percentComplete = Math.min(100, (Math.abs(flowBias) / target) * 100);

  // Generate evidence string based on computed values
  let evidence: string;
  const absFlow = Math.abs(flowBias);
  if (flowBias >= 60) {
    evidence = `+${flowBias.toFixed(0)} buy pressure → strong accumulation`;
  } else if (flowBias >= 40) {
    evidence = `+${flowBias.toFixed(0)} buy pressure → buyers in control`;
  } else if (flowBias <= -60) {
    evidence = `${flowBias.toFixed(0)} sell pressure → heavy distribution`;
  } else if (flowBias <= -40) {
    evidence = `${flowBias.toFixed(0)} sell pressure → sellers in control`;
  } else if (absFlow < 20) {
    evidence = `${flowBias >= 0 ? "+" : ""}${flowBias.toFixed(0)} → balanced, no clear bias`;
  } else {
    evidence = `${flowBias >= 0 ? "+" : ""}${flowBias.toFixed(0)} → slight ${flowBias > 0 ? "buying" : "selling"} pressure`;
  }

  return {
    value: flowBias,
    displayValue: flowBias >= 0 ? `+${flowBias.toFixed(0)}` : flowBias.toFixed(0),
    percentComplete,
    direction,
    evidence,
  };
}

function calculateRSI(indicators: Indicators): {
  value: number;
  displayValue: string;
  percentComplete: number;
  direction: "bullish" | "bearish" | "neutral";
  evidence: string;
} {
  const rsi = indicators.rsi14;
  if (rsi === undefined) {
    return {
      value: 0,
      displayValue: "N/A",
      percentComplete: 0,
      direction: "neutral",
      evidence: "RSI data unavailable",
    };
  }

  // RSI 30-45 is bullish (oversold reversal zone)
  // RSI 55-70 is bearish (overbought reversal zone)
  // RSI 45-55 is neutral
  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let percentComplete = 0;
  let evidence: string;

  if (rsi >= 30 && rsi <= 45) {
    direction = "bullish";
    // Closer to 38 is ideal for bullish (middle of zone)
    percentComplete = 100 - Math.abs(rsi - 38) * 6;
    evidence = `RSI ${rsi.toFixed(0)} → oversold reversal zone, bounce likely`;
  } else if (rsi >= 55 && rsi <= 70) {
    direction = "bearish";
    // Closer to 62 is ideal for bearish
    percentComplete = 100 - Math.abs(rsi - 62) * 6;
    evidence = `RSI ${rsi.toFixed(0)} → overbought, pullback likely`;
  } else if (rsi < 30) {
    // Extremely oversold - potentially bullish but risky
    direction = "bullish";
    percentComplete = 60;
    evidence = `RSI ${rsi.toFixed(0)} → deeply oversold, watch for reversal`;
  } else if (rsi > 70) {
    // Extremely overbought - potentially bearish but risky
    direction = "bearish";
    percentComplete = 60;
    evidence = `RSI ${rsi.toFixed(0)} → deeply overbought, extended`;
  } else {
    // Neutral zone (45-55)
    percentComplete = 30;
    evidence = `RSI ${rsi.toFixed(0)} → neutral zone, no edge`;
  }

  return {
    value: rsi,
    displayValue: rsi.toFixed(0),
    percentComplete: Math.max(0, Math.min(100, percentComplete)),
    direction,
    evidence,
  };
}

function calculateVWAPDistance(
  symbolData: SymbolData,
  indicators: Indicators
): { value: number; displayValue: string; percentComplete: number; evidence: string } {
  const vwap = indicators.vwap;
  const candles1m = symbolData.candles["1m"];
  const lastCandle = candles1m[candles1m.length - 1];

  if (!vwap || !lastCandle) {
    return { value: 0, displayValue: "N/A", percentComplete: 0, evidence: "VWAP data unavailable" };
  }

  const price = lastCandle.close;
  const distance = ((price - vwap) / vwap) * 100;

  // Within ±0.3% is ideal
  const absDistance = Math.abs(distance);
  const percentComplete = absDistance <= 0.3 ? 100 : Math.max(0, 100 - (absDistance - 0.3) * 100);

  // Generate evidence string
  let evidence: string;
  const sign = distance >= 0 ? "+" : "";
  if (absDistance <= 0.1) {
    evidence = `${sign}${distance.toFixed(2)}% from VWAP → at fair value`;
  } else if (absDistance <= 0.3) {
    evidence = `${sign}${distance.toFixed(2)}% from VWAP → near equilibrium`;
  } else if (distance > 0.5) {
    evidence = `${sign}${distance.toFixed(2)}% above VWAP → premium, may revert`;
  } else if (distance < -0.5) {
    evidence = `${sign}${distance.toFixed(2)}% below VWAP → discount, may bounce`;
  } else {
    evidence = `${sign}${distance.toFixed(2)}% from VWAP → ${distance > 0 ? "slight premium" : "slight discount"}`;
  }

  return {
    value: distance,
    displayValue: `${distance >= 0 ? "+" : ""}${distance.toFixed(2)}%`,
    percentComplete,
    evidence,
  };
}

/** Stale threshold for MTF data (60 seconds) */
const MTF_STALE_THRESHOLD_MS = 60_000;

function calculateMTFAlignment(
  mtfTrend: Record<Timeframe, MTFTrend>,
  lastBarAt?: Record<Timeframe, number>
): {
  aligned: number;
  total: number;
  percentComplete: number;
  data: MTFData[];
  lastUpdated: number | null;
  hasStale: boolean;
  evidence: string;
} {
  const timeframes: Timeframe[] = ["1m", "5m", "15m", "60m"];
  const data: MTFData[] = [];
  let bullCount = 0;
  let bearCount = 0;
  let mostRecentUpdate: number | null = null;
  let hasStale = false;
  const now = Date.now();

  timeframes.forEach((tf) => {
    const trend = mtfTrend[tf];
    const direction: "up" | "down" | "neutral" =
      trend === "bull" ? "up" : trend === "bear" ? "down" : "neutral";

    if (trend === "bull") bullCount++;
    if (trend === "bear") bearCount++;

    // Get per-timeframe last bar timestamp
    const tfLastBarAt = lastBarAt?.[tf] ?? null;
    const tfIsStale = tfLastBarAt ? now - tfLastBarAt > MTF_STALE_THRESHOLD_MS : true;

    if (tfIsStale) hasStale = true;
    if (tfLastBarAt && (mostRecentUpdate === null || tfLastBarAt > mostRecentUpdate)) {
      mostRecentUpdate = tfLastBarAt;
    }

    data.push({
      timeframe: tf,
      direction,
      label: tf,
      lastBarAt: tfLastBarAt,
      isStale: tfIsStale,
    });
  });

  const maxAligned = Math.max(bullCount, bearCount);
  const percentComplete = (maxAligned / timeframes.length) * 100;
  const dominantBias = bullCount >= bearCount ? "bullish" : "bearish";

  // Generate evidence string
  let evidence: string;
  if (maxAligned === 4) {
    evidence = `4/4 TFs ${dominantBias} → perfect alignment, high conviction`;
  } else if (maxAligned === 3) {
    evidence = `3/4 TFs ${dominantBias} → strong alignment`;
  } else if (maxAligned === 2) {
    evidence = `2/4 TFs aligned → mixed signals, lower conviction`;
  } else {
    evidence = `Conflicting TFs → no clear trend, wait for alignment`;
  }

  return {
    aligned: maxAligned,
    total: timeframes.length,
    percentComplete,
    data,
    lastUpdated: mostRecentUpdate,
    hasStale,
    evidence,
  };
}

function calculateEMAStack(
  indicators: Indicators,
  symbolData: SymbolData
): {
  value: number;
  displayValue: string;
  percentComplete: number;
  direction: "bullish" | "bearish" | "neutral";
  evidence: string;
} {
  const { ema9, ema20, ema50 } = indicators;
  const lastCandle = symbolData.candles["1m"][symbolData.candles["1m"].length - 1];

  if (!ema9 || !ema20 || !lastCandle) {
    return {
      value: 0,
      displayValue: "N/A",
      percentComplete: 0,
      direction: "neutral",
      evidence: "EMA data unavailable",
    };
  }

  const price = lastCandle.close;

  // Bullish stack: price > ema9 > ema20 > ema50
  // Bearish stack: price < ema9 < ema20 < ema50
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (price > ema9) bullishPoints++;
  else bearishPoints++;
  if (ema9 > ema20) bullishPoints++;
  else bearishPoints++;
  if (ema50 && ema20 > ema50) bullishPoints++;
  else if (ema50) bearishPoints++;

  const maxPoints = ema50 ? 3 : 2;
  const direction: "bullish" | "bearish" | "neutral" =
    bullishPoints >= 2 ? "bullish" : bearishPoints >= 2 ? "bearish" : "neutral";

  const alignedCount = Math.max(bullishPoints, bearishPoints);
  const percentComplete = (alignedCount / maxPoints) * 100;

  // Generate evidence string
  let evidence: string;
  if (alignedCount === maxPoints && direction === "bullish") {
    evidence = `Price > EMA9 > EMA20${ema50 ? " > EMA50" : ""} → bullish structure`;
  } else if (alignedCount === maxPoints && direction === "bearish") {
    evidence = `Price < EMA9 < EMA20${ema50 ? " < EMA50" : ""} → bearish structure`;
  } else if (alignedCount >= 2) {
    evidence = `${alignedCount}/${maxPoints} EMAs aligned → ${direction} bias forming`;
  } else {
    evidence = `EMAs mixed → no clear trend structure`;
  }

  return {
    value: alignedCount,
    displayValue: `${alignedCount}/${maxPoints}`,
    percentComplete,
    direction,
    evidence,
  };
}

function calculateMarketRegime(
  symbolData: SymbolData,
  indicators: Indicators
): { value: number; displayValue: string; percentComplete: number; evidence: string } {
  // Simplified regime detection based on ATR and trend
  const atr = indicators.atr14;
  const candles = symbolData.candles["15m"];

  if (!atr || candles.length < 20) {
    return {
      value: 0,
      displayValue: "N/A",
      percentComplete: 0,
      evidence: "Regime data unavailable",
    };
  }

  // Check for trending vs ranging
  const recent = candles.slice(-20);
  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);

  const highTrend = highs[highs.length - 1] - highs[0];
  const lowTrend = lows[lows.length - 1] - lows[0];

  // If both highs and lows are trending in same direction = trending
  const isTrending = (highTrend > 0 && lowTrend > 0) || (highTrend < 0 && lowTrend < 0);
  const trendDirection = highTrend > 0 ? "up" : "down";

  // Generate evidence string
  let evidence: string;
  if (isTrending && trendDirection === "up") {
    evidence = `Higher highs & higher lows → uptrend, momentum strategies favor`;
  } else if (isTrending && trendDirection === "down") {
    evidence = `Lower highs & lower lows → downtrend, momentum strategies favor`;
  } else {
    evidence = `No clear HH/HL or LH/LL → range-bound, mean reversion favor`;
  }

  return {
    value: isTrending ? 1 : 0,
    displayValue: isTrending ? "TRENDING" : "RANGING",
    percentComplete: isTrending ? 100 : 40,
    evidence,
  };
}

function calculateKeyLevels(symbolData: SymbolData): {
  value: number;
  displayValue: string;
  percentComplete: number;
  evidence: string;
} {
  // Check proximity to key levels (ORB, swing highs/lows)
  // For now, use a simplified version based on recent range
  const candles1m = symbolData.candles["1m"];

  if (candles1m.length < 60) {
    return {
      value: 0,
      displayValue: "N/A",
      percentComplete: 0,
      evidence: "Key levels data unavailable",
    };
  }

  // Get first 30 minutes for ORB (assuming market open data)
  const orbCandles = candles1m.slice(0, 30);
  const orbHigh = Math.max(...orbCandles.map((c) => c.high));
  const orbLow = Math.min(...orbCandles.map((c) => c.low));

  const currentPrice = candles1m[candles1m.length - 1].close;
  const distToHigh = Math.abs((currentPrice - orbHigh) / orbHigh) * 100;
  const distToLow = Math.abs((currentPrice - orbLow) / orbLow) * 100;
  const minDist = Math.min(distToHigh, distToLow);

  // Within 0.5% of ORB = strong
  const percentComplete = minDist <= 0.5 ? 100 : Math.max(0, 100 - minDist * 50);
  const nearLevel = distToHigh < distToLow ? "ORB Hi" : "ORB Lo";
  const isAboveOrb = currentPrice > orbHigh;
  const isBelowOrb = currentPrice < orbLow;

  // Generate evidence string
  let evidence: string;
  if (minDist <= 0.2) {
    evidence = `${minDist.toFixed(1)}% from ${nearLevel} → at key level, watch for reaction`;
  } else if (minDist <= 0.5) {
    evidence = `${minDist.toFixed(1)}% from ${nearLevel} → near decision point`;
  } else if (isAboveOrb) {
    evidence = `${distToHigh.toFixed(1)}% above ORB high → breakout territory`;
  } else if (isBelowOrb) {
    evidence = `${distToLow.toFixed(1)}% below ORB low → breakdown territory`;
  } else {
    evidence = `${minDist.toFixed(1)}% from ${nearLevel} → inside ORB range`;
  }

  return {
    value: minDist,
    displayValue: `${nearLevel} (${minDist.toFixed(1)}%)`,
    percentComplete,
    evidence,
  };
}

function calculateIVPercentile(symbolData: SymbolData): {
  value: number;
  displayValue: string;
  percentComplete: number;
  evidence: string;
} {
  // IV percentile from Greeks if available
  const greeks = symbolData.greeks;

  if (!greeks?.iv) {
    return { value: 0, displayValue: "N/A", percentComplete: 50, evidence: "IV data unavailable" }; // Neutral when missing
  }

  // Assuming IV is a decimal (0.30 = 30%)
  const ivPercent = greeks.iv * 100;

  // Optimal for buying: 20-50%
  // Below 20%: IV cheap but maybe too quiet
  // Above 50%: IV elevated, premium expensive
  let percentComplete = 0;
  let evidence: string;

  if (ivPercent >= 20 && ivPercent <= 50) {
    percentComplete = 100;
    evidence = `IV ${ivPercent.toFixed(0)}% → optimal for debit strategies`;
  } else if (ivPercent < 20) {
    percentComplete = 50 + (ivPercent / 20) * 50;
    evidence = `IV ${ivPercent.toFixed(0)}% → low IV, cheap premium but quiet`;
  } else if (ivPercent <= 70) {
    percentComplete = Math.max(0, 100 - (ivPercent - 50) * 2);
    evidence = `IV ${ivPercent.toFixed(0)}% → elevated, consider credit strategies`;
  } else {
    percentComplete = Math.max(0, 100 - (ivPercent - 50) * 2);
    evidence = `IV ${ivPercent.toFixed(0)}% → high IV, premium expensive`;
  }

  return {
    value: ivPercent,
    displayValue: `${ivPercent.toFixed(0)}%`,
    percentComplete,
    evidence,
  };
}

// ============================================================================
// Helper: Create placeholder factors when data is unavailable
// ============================================================================

function createPlaceholderFactors(): FactorData[] {
  return [
    {
      name: "rvol",
      label: "RVOL",
      value: 0,
      displayValue: "N/A",
      threshold: "≥2.0x",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.rvol.weight,
      contribution: 0,
      tooltip: "Relative Volume - data unavailable (market closed)",
      evidence: "Volume data unavailable",
    },
    {
      name: "flow",
      label: "Flow",
      value: 0,
      displayValue: "N/A",
      threshold: "≥±40",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.flow.weight,
      contribution: 0,
      direction: "neutral" as const,
      tooltip: "Buy/Sell pressure - data unavailable (market closed)",
      evidence: "Flow data unavailable",
    },
    {
      name: "rsi",
      label: "RSI",
      value: 0,
      displayValue: "N/A",
      threshold: "30-45 / 55-70",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.rsi.weight,
      contribution: 0,
      direction: "neutral" as const,
      tooltip: "RSI - data unavailable (market closed)",
      evidence: "RSI data unavailable",
    },
    {
      name: "vwap",
      label: "VWAP",
      value: 0,
      displayValue: "N/A",
      threshold: "±0.3%",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.vwapDistance.weight,
      contribution: 0,
      tooltip: "VWAP distance - data unavailable (market closed)",
      evidence: "VWAP data unavailable",
    },
    {
      name: "mtf",
      label: "MTF",
      value: 0,
      displayValue: "0/4",
      threshold: "≥3/4",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.mtfAlignment.weight,
      contribution: 0,
      tooltip: "MTF alignment - data unavailable (market closed)",
      evidence: "MTF data unavailable",
    },
    {
      name: "ema",
      label: "EMA Stack",
      value: 0,
      displayValue: "N/A",
      threshold: "All aligned",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.emaStack.weight,
      contribution: 0,
      direction: "neutral" as const,
      tooltip: "EMA stack - data unavailable (market closed)",
      evidence: "EMA data unavailable",
    },
    {
      name: "regime",
      label: "Regime",
      value: 0,
      displayValue: "N/A",
      threshold: "Trending",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.regime.weight,
      contribution: 0,
      tooltip: "Market regime - data unavailable (market closed)",
      evidence: "Regime data unavailable",
    },
    {
      name: "levels",
      label: "Key Levels",
      value: 0,
      displayValue: "N/A",
      threshold: "≤0.5%",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.keyLevels.weight,
      contribution: 0,
      tooltip: "Key levels - data unavailable (market closed)",
      evidence: "Key levels data unavailable",
    },
    {
      name: "iv",
      label: "IV%",
      value: 0,
      displayValue: "N/A",
      threshold: "20-50%",
      percentComplete: 0,
      status: "missing" as FactorStatus,
      weight: FACTOR_THRESHOLDS.ivPercentile.weight,
      contribution: 0,
      tooltip: "IV percentile - data unavailable (market closed)",
      evidence: "IV data unavailable",
    },
  ];
}

// ============================================================================
// Main Hook
// ============================================================================

export function useSymbolConfluence(symbol: string): SymbolConfluence | null {
  const symbolData = useMarketDataStore((state) => state.symbols[symbol?.toUpperCase()]);

  return useMemo(() => {
    if (!symbol) {
      return null;
    }

    const normalized = symbol.toUpperCase();

    // If no symbol data or no candle data, return placeholder factors
    // This allows the UI to show "data unavailable" instead of infinite loading
    if (!symbolData) {
      const isIndex = ["SPX", "NDX", "VIX"].includes(normalized);
      const threshold = isIndex ? READY_THRESHOLDS.indices : READY_THRESHOLDS.default;

      return {
        symbol: normalized,
        price: 0,
        change: 0,
        changePercent: 0,
        factors: createPlaceholderFactors(),
        mtf: [
          {
            timeframe: "1m",
            direction: "neutral" as const,
            label: "1m",
            lastBarAt: null,
            isStale: true,
          },
          {
            timeframe: "5m",
            direction: "neutral" as const,
            label: "5m",
            lastBarAt: null,
            isStale: true,
          },
          {
            timeframe: "15m",
            direction: "neutral" as const,
            label: "15m",
            lastBarAt: null,
            isStale: true,
          },
          {
            timeframe: "60m",
            direction: "neutral" as const,
            label: "60m",
            lastBarAt: null,
            isStale: true,
          },
        ],
        mtfAligned: 0,
        mtfTotal: 4,
        mtfLastUpdated: null,
        mtfHasStale: true,
        overallScore: 0,
        threshold,
        isHot: false,
        isReady: false,
        bestStyle: "day" as TradingStyle,
        styleScores: { scalp: 0, day: 0, swing: 0 },
        lastUpdated: Date.now(),
      };
    }

    const candles1m = symbolData.candles["1m"] || [];
    const lastCandle = candles1m[candles1m.length - 1];
    const prevCandle = candles1m.length > 1 ? candles1m[candles1m.length - 2] : null;

    // If no candle data, return placeholder with whatever data we have
    if (!lastCandle) {
      const isIndex = ["SPX", "NDX", "VIX"].includes(normalized);
      const threshold = isIndex ? READY_THRESHOLDS.indices : READY_THRESHOLDS.default;
      const mtfTrend = symbolData.mtfTrend || {
        "1m": "neutral",
        "5m": "neutral",
        "15m": "neutral",
        "60m": "neutral",
      };

      // Use calculateMTFAlignment to get proper staleness info even without candles
      const mtfResult = calculateMTFAlignment(
        mtfTrend as Record<Timeframe, MTFTrend>,
        symbolData.lastBarAt
      );

      return {
        symbol: normalized,
        price: 0,
        change: 0,
        changePercent: 0,
        factors: createPlaceholderFactors(),
        mtf: mtfResult.data,
        mtfAligned: 0,
        mtfTotal: 4,
        mtfLastUpdated: mtfResult.lastUpdated,
        mtfHasStale: mtfResult.hasStale,
        overallScore: symbolData.confluence?.overall || 0,
        threshold,
        isHot: false,
        isReady: false,
        bestStyle: "day" as TradingStyle,
        styleScores: { scalp: 0, day: 0, swing: 0 },
        lastUpdated: symbolData.lastUpdated || Date.now(),
      };
    }

    const price = lastCandle.close;
    const prevPrice = prevCandle?.close || price;
    const change = price - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    // Calculate each factor
    const rvolData = calculateRVOL(symbolData);
    const flowData = calculateFlowBias(symbolData);
    const rsiData = calculateRSI(symbolData.indicators);
    const vwapData = calculateVWAPDistance(symbolData, symbolData.indicators);
    const mtfData = calculateMTFAlignment(symbolData.mtfTrend, symbolData.lastBarAt);
    const emaData = calculateEMAStack(symbolData.indicators, symbolData);
    const regimeData = calculateMarketRegime(symbolData, symbolData.indicators);
    const levelsData = calculateKeyLevels(symbolData);
    const ivData = calculateIVPercentile(symbolData);

    // Build factors array
    const factors: FactorData[] = [
      {
        name: "rvol",
        label: "RVOL",
        value: rvolData.value,
        displayValue: rvolData.displayValue,
        threshold: "≥2.0x",
        percentComplete: rvolData.percentComplete,
        status: getFactorStatus(rvolData.percentComplete),
        weight: FACTOR_THRESHOLDS.rvol.weight,
        contribution: FACTOR_THRESHOLDS.rvol.weight * rvolData.percentComplete,
        tooltip: "Relative Volume - current vs 20-bar average",
        evidence: rvolData.evidence,
      },
      {
        name: "flow",
        label: "Flow",
        value: flowData.value,
        displayValue: flowData.displayValue,
        threshold: "≥±40",
        percentComplete: flowData.percentComplete,
        status: getFactorStatus(flowData.percentComplete),
        weight: FACTOR_THRESHOLDS.flow.weight,
        contribution: FACTOR_THRESHOLDS.flow.weight * flowData.percentComplete,
        direction: flowData.direction,
        tooltip: "Buy/Sell pressure indicator (-100 to +100)",
        evidence: flowData.evidence,
      },
      {
        name: "rsi",
        label: "RSI",
        value: rsiData.value,
        displayValue: rsiData.displayValue,
        threshold: "30-45 / 55-70",
        percentComplete: rsiData.percentComplete,
        status: getFactorStatus(rsiData.percentComplete),
        weight: FACTOR_THRESHOLDS.rsi.weight,
        contribution: FACTOR_THRESHOLDS.rsi.weight * rsiData.percentComplete,
        direction: rsiData.direction,
        tooltip: "Relative Strength Index - momentum oscillator",
        evidence: rsiData.evidence,
      },
      {
        name: "vwap",
        label: "VWAP",
        value: vwapData.value,
        displayValue: vwapData.displayValue,
        threshold: "±0.3%",
        percentComplete: vwapData.percentComplete,
        status: getFactorStatus(vwapData.percentComplete),
        weight: FACTOR_THRESHOLDS.vwapDistance.weight,
        contribution: FACTOR_THRESHOLDS.vwapDistance.weight * vwapData.percentComplete,
        tooltip: "Distance from Volume Weighted Average Price",
        evidence: vwapData.evidence,
      },
      {
        name: "mtf",
        label: "MTF",
        value: mtfData.aligned,
        displayValue: `${mtfData.aligned}/${mtfData.total}`,
        threshold: "≥3/4",
        percentComplete: mtfData.percentComplete,
        status: getFactorStatus(mtfData.percentComplete),
        weight: FACTOR_THRESHOLDS.mtfAlignment.weight,
        contribution: FACTOR_THRESHOLDS.mtfAlignment.weight * mtfData.percentComplete,
        tooltip: "Multi-timeframe trend alignment",
        evidence: mtfData.evidence,
      },
      {
        name: "ema",
        label: "EMA Stack",
        value: emaData.value,
        displayValue: emaData.displayValue,
        threshold: "All aligned",
        percentComplete: emaData.percentComplete,
        status: getFactorStatus(emaData.percentComplete),
        weight: FACTOR_THRESHOLDS.emaStack.weight,
        contribution: FACTOR_THRESHOLDS.emaStack.weight * emaData.percentComplete,
        direction: emaData.direction,
        tooltip: "9/21/50 EMA alignment in price direction",
        evidence: emaData.evidence,
      },
      {
        name: "regime",
        label: "Regime",
        value: regimeData.value,
        displayValue: regimeData.displayValue,
        threshold: "Trending",
        percentComplete: regimeData.percentComplete,
        status: getFactorStatus(regimeData.percentComplete),
        weight: FACTOR_THRESHOLDS.regime.weight,
        contribution: FACTOR_THRESHOLDS.regime.weight * regimeData.percentComplete,
        tooltip: "Market regime - trending vs ranging",
        evidence: regimeData.evidence,
      },
      {
        name: "levels",
        label: "Key Levels",
        value: levelsData.value,
        displayValue: levelsData.displayValue,
        threshold: "≤0.5%",
        percentComplete: levelsData.percentComplete,
        status: getFactorStatus(levelsData.percentComplete),
        weight: FACTOR_THRESHOLDS.keyLevels.weight,
        contribution: FACTOR_THRESHOLDS.keyLevels.weight * levelsData.percentComplete,
        tooltip: "Proximity to ORB, swing highs/lows",
        evidence: levelsData.evidence,
      },
      {
        name: "iv",
        label: "IV%",
        value: ivData.value,
        displayValue: ivData.displayValue,
        threshold: "20-50%",
        percentComplete: ivData.percentComplete,
        status: getFactorStatus(ivData.percentComplete),
        weight: FACTOR_THRESHOLDS.ivPercentile.weight,
        contribution: FACTOR_THRESHOLDS.ivPercentile.weight * ivData.percentComplete,
        tooltip: "IV percentile - optimal for buying premium",
        evidence: ivData.evidence,
      },
    ];

    // Calculate overall score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + f.contribution, 0);
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Calculate style-specific scores
    const styleScores: Record<TradingStyle, number> = {
      scalp: 0,
      day: 0,
      swing: 0,
    };

    (["scalp", "day", "swing"] as TradingStyle[]).forEach((style) => {
      const styleWeights = STYLE_WEIGHTS[style];
      let weightedStyleSum = 0;
      let totalStyleWeight = 0;

      factors.forEach((factor) => {
        const multiplier = styleWeights[factor.name] || 1;
        const adjustedWeight = factor.weight * multiplier;
        weightedStyleSum += factor.percentComplete * adjustedWeight;
        totalStyleWeight += adjustedWeight;
      });

      styleScores[style] = totalStyleWeight > 0 ? weightedStyleSum / totalStyleWeight : 0;
    });

    // Determine best style
    const bestStyle = Object.entries(styleScores).reduce(
      (best, [style, score]) => (score > (styleScores[best] || 0) ? (style as TradingStyle) : best),
      "day" as TradingStyle
    );

    // Determine threshold based on symbol type
    const isIndex = ["SPX", "NDX", "VIX"].includes(normalized);
    const threshold = isIndex ? READY_THRESHOLDS.indices : READY_THRESHOLDS.default;

    const isHot = overallScore >= threshold * 0.9;
    const isReady = overallScore >= threshold;

    return {
      symbol: normalized,
      price,
      change,
      changePercent,
      factors,
      mtf: mtfData.data,
      mtfAligned: mtfData.aligned,
      mtfTotal: mtfData.total,
      mtfLastUpdated: mtfData.lastUpdated,
      mtfHasStale: mtfData.hasStale,
      overallScore,
      threshold,
      isHot,
      isReady,
      bestStyle,
      styleScores,
      lastUpdated: symbolData.lastUpdated,
    };
  }, [symbol, symbolData]);
}

export default useSymbolConfluence;
