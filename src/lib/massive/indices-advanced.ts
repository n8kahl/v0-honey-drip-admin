// INDICES ADVANCED - Real-time index data with technical indicators
// Supports SPX, NDX, VIX, and other major indices

import { massive } from ".";
import { fetchIndicators, IndicatorRequest, IndicatorResponse } from "./indicators-api";
import { streamingManager } from "./streaming-manager";

export interface IndexQuote {
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: number;
  asOf: string;
}

export interface IndexIndicators {
  ema8: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  vwap: number;
  macd: { value: number; signal: number; histogram: number };
  updatedAt: number;
}

export interface MacroContext {
  spx: {
    value: number;
    trend: "bullish" | "bearish" | "neutral";
    trendStrength: "strong" | "moderate" | "weak";
    vwapRelation: "above" | "below" | "at";
    emaAlignment: boolean; // True if 8>21>50>200
    rsiState: "overbought" | "oversold" | "neutral";
    atrRegime: "normal" | "elevated" | "low";
  };
  ndx: {
    value: number;
    trend: "bullish" | "bearish" | "neutral";
  };
  vix: {
    value: number;
    trend: "rising" | "falling" | "stable";
    level: "low" | "mid" | "high"; // <15, 15-22, >22
    signal: string; // "VIX: Elevated (23) — tighten SL"
  };
  // Optional upgrades
  putCall?: {
    ratio: number; // puts/calls using OI (fallback volume)
    level: "calls" | "balanced" | "puts";
    signal: string;
    sample: number; // number of contracts considered
    stale: boolean; // grey out when sample too small or zero
  };
  breadth?: {
    status: "positive" | "neutral" | "negative";
  };
  tick?: {
    value: number | null;
    bias: "up" | "flat" | "down";
  };
  correlation?: {
    spyQqqCorrelation: "aligned" | "diverging" | "opposite";
    signal: string;
    spyChange: number;
    qqqChange: number;
    strength: "strong" | "moderate" | "weak";
  };
  sectorRotation?: {
    leadership: "tech" | "value" | "defensive" | "mixed";
    signal: string;
  };
  marketRegime: "trending" | "choppy" | "volatile";
  riskBias: "bullish" | "bearish" | "neutral";
  timestamp: number;
}

/**
 * Fetch index quote
 */
export async function fetchIndexQuote(symbol: string): Promise<IndexQuote> {
  console.log(`[IndicesAdvanced] Fetching quote for ${symbol}`);

  try {
    const data = await massive.getIndex(symbol);

    const updated = (data as any)?.updated ?? (data as any)?.timestamp ?? Date.now();
    return {
      symbol,
      value: data.value || 0,
      change: data.change || 0,
      changePercent: data.change_percent || 0,
      timestamp: updated,
      asOf: new Date(updated).toLocaleTimeString(),
    };
  } catch (error) {
    console.error(`[IndicesAdvanced] Failed to fetch ${symbol}:`, error);
    return {
      symbol,
      value: 0,
      change: 0,
      changePercent: 0,
      timestamp: Date.now(),
      asOf: "N/A",
    };
  }
}

/**
 * Fetch index indicators
 */
export async function fetchIndexIndicators(symbol: string): Promise<IndexIndicators> {
  console.log(`[IndicesAdvanced] Fetching indicators for ${symbol}`);

  const request: IndicatorRequest = {
    ema: [8, 21, 50, 200],
    rsi: [14],
    atr: [14],
  };

  const indicators = await fetchIndicators(symbol, request, "1", 250);

  // Get latest values
  const ema8 = indicators.ema?.[8]?.slice(-1)[0] || 0;
  const ema21 = indicators.ema?.[21]?.slice(-1)[0] || 0;
  const ema50 = indicators.ema?.[50]?.slice(-1)[0] || 0;
  const ema200 = indicators.ema?.[200]?.slice(-1)[0] || 0;
  const rsi14 = indicators.rsi?.[14]?.slice(-1)[0] || 50;
  const atr14 = indicators.atr?.[14]?.slice(-1)[0] || 0;

  // Calculate VWAP (simplified - would need volume data from aggregates)
  const vwap = ema21; // Use EMA21 as proxy for now

  return {
    ema8,
    ema21,
    ema50,
    ema200,
    rsi14,
    atr14,
    vwap,
    macd: { value: 0, signal: 0, histogram: 0 }, // TODO: Add MACD calculation
    updatedAt: Date.now(),
  };
}

/**
 * Gather complete macro context
 */
export async function gatherMacroContext(): Promise<MacroContext> {
  console.log("[IndicesAdvanced] Gathering macro context (SPX, NDX, VIX, SPY, QQQ)");

  const [spxQuote, ndxQuote, vixQuote, spxIndicators] = await Promise.all([
    fetchIndexQuote("SPX"),
    fetchIndexQuote("NDX"),
    fetchIndexQuote("VIX"),
    fetchIndexIndicators("SPX"),
  ]);

  // Note: SPY/QQQ correlation skipped since we don't subscribe to Massive stocks endpoint
  // Stock data is available via /api/quotes endpoint if needed in the future

  // Analyze SPX
  const spxTrend = analyzeTrend(spxQuote.value, spxIndicators);
  const spxTrendStrength = analyzeTrendStrength(spxIndicators);
  const spxVwapRelation =
    spxQuote.value > spxIndicators.vwap
      ? "above"
      : spxQuote.value < spxIndicators.vwap
        ? "below"
        : "at";
  const emaAlignment =
    spxIndicators.ema8 > spxIndicators.ema21 &&
    spxIndicators.ema21 > spxIndicators.ema50 &&
    spxIndicators.ema50 > spxIndicators.ema200;
  const rsiState =
    spxIndicators.rsi14 > 70 ? "overbought" : spxIndicators.rsi14 < 30 ? "oversold" : "neutral";

  // Compare ATR to recent average (simplified)
  const atrRegime =
    spxIndicators.atr14 > spxQuote.value * 0.015
      ? "elevated"
      : spxIndicators.atr14 < spxQuote.value * 0.008
        ? "low"
        : "normal";

  // Analyze NDX
  const ndxTrend =
    ndxQuote.changePercent > 0.5
      ? "bullish"
      : ndxQuote.changePercent < -0.5
        ? "bearish"
        : "neutral";

  // Analyze VIX
  const vixTrend =
    vixQuote.changePercent > 3 ? "rising" : vixQuote.changePercent < -3 ? "falling" : "stable";
  const vixLevel = vixQuote.value < 15 ? "low" : vixQuote.value > 22 ? "high" : "mid";
  const vixSignal =
    vixLevel === "high"
      ? `VIX: Elevated (${vixQuote.value.toFixed(1)}) — tighten SL`
      : vixLevel === "low"
        ? `VIX: Low (${vixQuote.value.toFixed(1)}) — normal volatility`
        : `VIX: Moderate (${vixQuote.value.toFixed(1)})`;

  // Determine market regime
  const marketRegime =
    emaAlignment && atrRegime !== "elevated"
      ? "trending"
      : atrRegime === "elevated"
        ? "volatile"
        : "choppy";

  // Determine risk bias
  const riskBias =
    spxTrend === "bullish" && ndxTrend === "bullish" && vixLevel !== "high"
      ? "bullish"
      : spxTrend === "bearish" && ndxTrend === "bearish" && vixLevel === "high"
        ? "bearish"
        : "neutral";

  // Optional: Put/Call from options chain (SPX)
  let putCall: MacroContext["putCall"] | undefined = undefined;
  try {
    const chain = await massive.getOptionsChain("SPX");
    const contracts: any[] = (chain as any)?.results || [];
    if (contracts.length > 0) {
      // Aggregate OI by type (fallback to volume)
      let callSum = 0;
      let putSum = 0;
      for (const c of contracts) {
        const oi = c.open_interest ?? c.day?.open_interest ?? 0;
        const vol = c.volume ?? c.day?.volume ?? 0;
        const weight = oi || vol || 0;
        if ((c.contract_type || c.type || "").toLowerCase().startsWith("call")) callSum += weight;
        else if ((c.contract_type || c.type || "").toLowerCase().startsWith("put"))
          putSum += weight;
      }
      const ratio = callSum > 0 ? putSum / callSum : 0;
      const level: "calls" | "balanced" | "puts" =
        ratio < 0.8 ? "calls" : ratio > 1.2 ? "puts" : "balanced";
      const signal =
        level === "puts"
          ? `Put/Call ${ratio.toFixed(2)} — risk-off`
          : level === "calls"
            ? `Put/Call ${ratio.toFixed(2)} — risk-on`
            : `Put/Call ${ratio.toFixed(2)} — balanced`;
      const sample = contracts.length;
      const stale = callSum + putSum === 0 || sample < 50; // heuristic: not enough sample/weights
      putCall = { ratio, level, signal, sample, stale };
    }
  } catch (err) {
    console.warn("[IndicesAdvanced] Put/Call computation failed:", err);
  }

  // Optional: Breadth (heuristic using SPX/NDX moves + VIX trend)
  let breadth: MacroContext["breadth"] | undefined = undefined;
  try {
    const pos =
      spxQuote.changePercent > 0.3 && ndxQuote.changePercent > 0.3 && vixTrend !== "rising";
    const neg =
      spxQuote.changePercent < -0.3 && ndxQuote.changePercent < -0.3 && vixTrend === "rising";
    breadth = { status: pos ? "positive" : neg ? "negative" : "neutral" };
  } catch {
    // ignore
  }

  // Optional: TICK index (best effort)
  let tick: MacroContext["tick"] | undefined = undefined;
  try {
    const tickQuote = await fetchIndexQuote("TICK");
    if (tickQuote && typeof tickQuote.value === "number") {
      const val = tickQuote.value;
      const bias: "up" | "flat" | "down" = val > 200 ? "up" : val < -200 ? "down" : "flat";
      tick = { value: val, bias };
    }
  } catch {
    // If not available on provider, silently ignore
  }

  // SPY/QQQ Correlation Analysis (disabled - no Massive stocks subscription)
  // Correlation analysis skipped since we don't fetch individual stock snapshots
  // from Massive (no stocks endpoint subscription). Stock data flows via /api/quotes
  // but correlation analysis requires historical change data not available there yet.
  const correlation: MacroContext["correlation"] | undefined = undefined;

  // Sector Rotation Analysis (heuristic based on SPY vs QQQ)
  let sectorRotation: MacroContext["sectorRotation"] | undefined = undefined;
  try {
    if (correlation) {
      const { spyChange, qqqChange } = correlation;
      const qqqLeading = qqqChange > spyChange + 0.5; // QQQ outperforming by >0.5%
      const spyLeading = spyChange > qqqChange + 0.5; // SPY outperforming (value/defensive)

      let leadership: "tech" | "value" | "defensive" | "mixed";
      let signal: string;

      if (qqqLeading) {
        leadership = "tech";
        signal = "Tech leadership (QQQ outperforming)";
      } else if (spyLeading) {
        leadership = vixQuote.value > 20 ? "defensive" : "value";
        signal =
          vixQuote.value > 20
            ? "Defensive rotation (SPY over QQQ)"
            : "Value rotation (SPY over QQQ)";
      } else {
        leadership = "mixed";
        signal = "Balanced sector performance";
      }

      sectorRotation = { leadership, signal };
    }
  } catch (err) {
    console.warn("[IndicesAdvanced] Sector rotation failed:", err);
  }

  return {
    spx: {
      value: spxQuote.value,
      trend: spxTrend,
      trendStrength: spxTrendStrength,
      vwapRelation: spxVwapRelation,
      emaAlignment,
      rsiState,
      atrRegime,
    },
    ndx: {
      value: ndxQuote.value,
      trend: ndxTrend,
    },
    vix: {
      value: vixQuote.value,
      trend: vixTrend,
      level: vixLevel,
      signal: vixSignal,
    },
    putCall,
    breadth,
    tick,
    correlation,
    sectorRotation,
    marketRegime,
    riskBias,
    timestamp: Date.now(),
  };
}

/**
 * Analyze trend from indicators
 */
function analyzeTrend(
  currentPrice: number,
  indicators: IndexIndicators
): "bullish" | "bearish" | "neutral" {
  // Price above EMA21 and EMA8 > EMA21 = bullish
  if (currentPrice > indicators.ema21 && indicators.ema8 > indicators.ema21) {
    return "bullish";
  }
  // Price below EMA21 and EMA8 < EMA21 = bearish
  if (currentPrice < indicators.ema21 && indicators.ema8 < indicators.ema21) {
    return "bearish";
  }
  return "neutral";
}

/**
 * Analyze trend strength
 */
function analyzeTrendStrength(indicators: IndexIndicators): "strong" | "moderate" | "weak" {
  // Strong: All EMAs aligned in order
  const bullishAlignment =
    indicators.ema8 > indicators.ema21 &&
    indicators.ema21 > indicators.ema50 &&
    indicators.ema50 > indicators.ema200;
  const bearishAlignment =
    indicators.ema8 < indicators.ema21 &&
    indicators.ema21 < indicators.ema50 &&
    indicators.ema50 < indicators.ema200;

  if (bullishAlignment || bearishAlignment) return "strong";

  // Moderate: Some alignment
  const someAlignment = indicators.ema8 > indicators.ema21 || indicators.ema21 > indicators.ema50;
  if (someAlignment) return "moderate";

  return "weak";
}

/**
 * Format macro context as UI pills
 */
export function formatMacroContextPills(macro: MacroContext): Array<{
  label: string;
  variant: "positive" | "negative" | "neutral" | "warning";
}> {
  const pills: Array<{ label: string; variant: "positive" | "negative" | "neutral" | "warning" }> =
    [];

  // SPX VWAP
  if (macro.spx.vwapRelation === "above") {
    pills.push({ label: "SPX: Above VWAP", variant: "positive" });
  } else if (macro.spx.vwapRelation === "below") {
    pills.push({ label: "SPX: Below VWAP", variant: "negative" });
  }

  // Note: We intentionally omit VIX and overall trend strength pills here to avoid duplicating
  // information already displayed in the top SPX/VIX/Regime headers.

  // Put/Call
  if (macro.putCall) {
    // grey out when stale by using neutral variant
    const v = macro.putCall.stale
      ? "neutral"
      : macro.putCall.level === "puts"
        ? "negative"
        : macro.putCall.level === "calls"
          ? "positive"
          : "neutral";
    pills.push({ label: macro.putCall.signal, variant: v });
  }

  // Breadth
  if (macro.breadth) {
    const map = { positive: "positive", neutral: "neutral", negative: "negative" } as const;
    pills.push({ label: `Breadth: ${macro.breadth.status}`, variant: map[macro.breadth.status] });
  }

  // TICK
  // Only show TICK when signal is meaningful
  if (macro.tick && typeof macro.tick.value === "number" && Math.abs(macro.tick.value) >= 100) {
    const v =
      macro.tick.bias === "up" ? "positive" : macro.tick.bias === "down" ? "negative" : "neutral";
    pills.push({ label: `TICK ${macro.tick.value}`, variant: v });
  }

  return pills;
}
