/**
 * Market Regime Calculation Module
 * Analyzes VIX, breadth, correlation, and put/call ratios to classify market regime
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getIndicesSnapshot } from "../../massive/client.js";

export interface MarketRegimeResult {
  success: boolean;
  date: string;
  vixLevel: number | null;
  vixRegime: string | null;
  breadthRegime: string | null;
  marketRegime: string | null;
  error?: string;
}

interface MarketRegimeRecord {
  date: string;
  vix_level: number;
  vix_change: number | null;
  vix_change_pct: number | null;
  vix_regime: "EXTREMELY_LOW" | "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";
  vix_front_month: number | null;
  vix_back_month: number | null;
  vix_term_structure: "STEEP_CONTANGO" | "CONTANGO" | "FLAT" | "BACKWARDATION" | "STEEP_BACKWARDATION" | null;
  vix_term_spread: number | null;
  tick_index: number | null;
  tick_regime: "EXTREME_SELLING" | "WEAK" | "NEUTRAL" | "STRONG" | "EXTREME_BUYING" | null;
  advancers: number | null;
  decliners: number | null;
  unchanged: number | null;
  advance_decline_ratio: number | null;
  advance_decline_diff: number | null;
  new_highs: number | null;
  new_lows: number | null;
  high_low_ratio: number | null;
  breadth_regime: "EXTREMELY_BEARISH" | "BEARISH" | "NEUTRAL" | "BULLISH" | "EXTREMELY_BULLISH" | null;
  spy_ndx_correlation: number | null;
  spy_rut_correlation: number | null;
  correlation_regime: "DIVERGING" | "LOW" | "NORMAL" | "HIGH" | "EXTREMELY_HIGH" | null;
  leading_sector: string | null;
  lagging_sector: string | null;
  sector_rotation: "DEFENSIVE" | "CYCLICAL" | "GROWTH" | "VALUE" | "MIXED" | null;
  put_call_ratio_equity: number | null;
  put_call_ratio_index: number | null;
  put_call_ratio_total: number | null;
  pc_regime: "EXTREME_FEAR" | "FEAR" | "NEUTRAL" | "GREED" | "EXTREME_GREED" | null;
  spy_close: number | null;
  spy_change_pct: number | null;
  ndx_close: number | null;
  ndx_change_pct: number | null;
  rut_close: number | null;
  rut_change_pct: number | null;
  spy_volume: number | null;
  spy_volume_ratio: number | null;
  market_regime:
    | "STRONG_UPTREND"
    | "WEAK_UPTREND"
    | "CHOPPY_BULLISH"
    | "RANGE_BOUND"
    | "CHOPPY_BEARISH"
    | "WEAK_DOWNTREND"
    | "STRONG_DOWNTREND"
    | "BREAKOUT"
    | "BREAKDOWN"
    | "CAPITULATION"
    | "EUPHORIA";
  confidence_score: number;
}

/**
 * Classify VIX regime
 */
function classifyVIXRegime(vixLevel: number): MarketRegimeRecord["vix_regime"] {
  if (vixLevel < 12) return "EXTREMELY_LOW";
  if (vixLevel < 16) return "LOW";
  if (vixLevel < 20) return "NORMAL";
  if (vixLevel < 30) return "ELEVATED";
  if (vixLevel < 40) return "HIGH";
  return "EXTREME";
}

/**
 * Classify TICK regime
 */
function classifyTICKRegime(tick: number): MarketRegimeRecord["tick_regime"] {
  if (tick < -800) return "EXTREME_SELLING";
  if (tick < -300) return "WEAK";
  if (tick < 300) return "NEUTRAL";
  if (tick < 800) return "STRONG";
  return "EXTREME_BUYING";
}

/**
 * Classify breadth regime
 */
function classifyBreadthRegime(
  advanceDeclineRatio: number | null,
  highLowRatio: number | null
): MarketRegimeRecord["breadth_regime"] {
  if (!advanceDeclineRatio) return null;

  if (advanceDeclineRatio > 3 && (highLowRatio === null || highLowRatio > 2)) {
    return "EXTREMELY_BULLISH";
  }
  if (advanceDeclineRatio > 1.5) return "BULLISH";
  if (advanceDeclineRatio > 0.67) return "NEUTRAL";
  if (advanceDeclineRatio > 0.33) return "BEARISH";
  return "EXTREMELY_BEARISH";
}

/**
 * Classify put/call regime
 */
function classifyPCRegime(pcRatio: number | null): MarketRegimeRecord["pc_regime"] {
  if (!pcRatio) return null;

  if (pcRatio > 1.5) return "EXTREME_FEAR";
  if (pcRatio > 1.1) return "FEAR";
  if (pcRatio > 0.9) return "NEUTRAL";
  if (pcRatio > 0.7) return "GREED";
  return "EXTREME_GREED";
}

/**
 * Determine overall market regime
 */
function determineMarketRegime(
  spyChange: number | null,
  ndxChange: number | null,
  vixRegime: string,
  breadthRegime: string | null,
  pcRegime: string | null
): { regime: MarketRegimeRecord["market_regime"]; confidence: number } {
  let regime: MarketRegimeRecord["market_regime"] = "RANGE_BOUND";
  let confidence = 50;

  // Strong uptrend: SPY/NDX up, VIX low, breadth bullish
  if (
    spyChange !== null &&
    ndxChange !== null &&
    spyChange > 1 &&
    ndxChange > 1 &&
    (vixRegime === "LOW" || vixRegime === "EXTREMELY_LOW") &&
    breadthRegime === "EXTREMELY_BULLISH"
  ) {
    regime = "STRONG_UPTREND";
    confidence = 85;
  }
  // Weak uptrend: SPY/NDX up, but weak breadth
  else if (spyChange !== null && ndxChange !== null && spyChange > 0.5 && ndxChange > 0.5 && breadthRegime === "BULLISH") {
    regime = "WEAK_UPTREND";
    confidence = 70;
  }
  // Strong downtrend: SPY/NDX down, VIX spiking, breadth bearish
  else if (
    spyChange !== null &&
    ndxChange !== null &&
    spyChange < -1 &&
    ndxChange < -1 &&
    (vixRegime === "HIGH" || vixRegime === "EXTREME") &&
    breadthRegime === "EXTREMELY_BEARISH"
  ) {
    regime = "STRONG_DOWNTREND";
    confidence = 85;
  }
  // Weak downtrend
  else if (spyChange !== null && ndxChange !== null && spyChange < -0.5 && ndxChange < -0.5 && breadthRegime === "BEARISH") {
    regime = "WEAK_DOWNTREND";
    confidence = 70;
  }
  // Capitulation: Extreme fear, high VIX, extreme selling
  else if (vixRegime === "EXTREME" && pcRegime === "EXTREME_FEAR" && breadthRegime === "EXTREMELY_BEARISH") {
    regime = "CAPITULATION";
    confidence = 90;
  }
  // Euphoria: Extreme greed, low VIX, extreme buying
  else if (vixRegime === "EXTREMELY_LOW" && pcRegime === "EXTREME_GREED" && breadthRegime === "EXTREMELY_BULLISH") {
    regime = "EUPHORIA";
    confidence = 90;
  }
  // Breakout: Sharp move up with VIX calm
  else if (spyChange !== null && spyChange > 2 && vixRegime === "NORMAL") {
    regime = "BREAKOUT";
    confidence = 75;
  }
  // Breakdown: Sharp move down with VIX elevated
  else if (spyChange !== null && spyChange < -2 && vixRegime === "ELEVATED") {
    regime = "BREAKDOWN";
    confidence = 75;
  }
  // Choppy: Mixed signals
  else if (breadthRegime === "NEUTRAL" && vixRegime === "NORMAL") {
    regime = "RANGE_BOUND";
    confidence = 60;
  }

  return { regime, confidence };
}

/**
 * Calculate market regime
 */
export async function calculateMarketRegime(supabase: SupabaseClient): Promise<MarketRegimeResult> {
  const today = new Date().toISOString().split("T")[0];

  try {
    // Fetch indices snapshot
    const indices = await getIndicesSnapshot();

    if (!indices || indices.length === 0) {
      return {
        success: false,
        date: today,
        vixLevel: null,
        vixRegime: null,
        breadthRegime: null,
        marketRegime: null,
        error: "No indices data available",
      };
    }

    // Extract key indices
    const vix = indices.find((i: any) => i.ticker === "VIX" || i.ticker === "I:VIX");
    const spy = indices.find((i: any) => i.ticker === "SPY" || i.ticker === "I:SPY");
    const ndx = indices.find((i: any) => i.ticker === "NDX" || i.ticker === "I:NDX");
    const rut = indices.find((i: any) => i.ticker === "RUT" || i.ticker === "I:RUT");
    const tick = indices.find((i: any) => i.ticker === "TICK" || i.ticker === "I:TICK");

    if (!vix) {
      return {
        success: false,
        date: today,
        vixLevel: null,
        vixRegime: null,
        breadthRegime: null,
        marketRegime: null,
        error: "VIX data not available",
      };
    }

    const vixLevel = vix.value || vix.last || 0;
    const vixChange = vix.change || null;
    const vixChangePct = vix.change_percent || null;

    // Classify VIX regime
    const vixRegime = classifyVIXRegime(vixLevel);

    // TICK index
    const tickValue = tick?.value || tick?.last || null;
    const tickRegime = tickValue !== null ? classifyTICKRegime(tickValue) : null;

    // Get previous day's data for change calculations
    const { data: previousRegime } = await supabase
      .from("market_regime_history")
      .select("*")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    // Breadth data (would need separate API or calculation)
    // For now, use placeholders
    const advancers = null;
    const decliners = null;
    const advanceDeclineRatio = null;
    const newHighs = null;
    const newLows = null;
    const highLowRatio = null;

    const breadthRegime = classifyBreadthRegime(advanceDeclineRatio, highLowRatio);

    // Put/call ratios (would need options chain data)
    // For now, placeholders
    const putCallRatioEquity = null;
    const putCallRatioIndex = null;
    const putCallRatioTotal = null;

    const pcRegime = classifyPCRegime(putCallRatioTotal);

    // Index prices and changes
    const spyClose = spy?.value || spy?.last || null;
    const spyChangePct = spy?.change_percent || null;
    const ndxClose = ndx?.value || ndx?.last || null;
    const ndxChangePct = ndx?.change_percent || null;
    const rutClose = rut?.value || rut?.last || null;
    const rutChangePct = rut?.change_percent || null;

    // Determine overall market regime
    const { regime: marketRegime, confidence: confidenceScore } = determineMarketRegime(
      spyChangePct,
      ndxChangePct,
      vixRegime,
      breadthRegime,
      pcRegime
    );

    // Build record
    const record: MarketRegimeRecord = {
      date: today,
      vix_level: vixLevel,
      vix_change: vixChange,
      vix_change_pct: vixChangePct,
      vix_regime: vixRegime,
      vix_front_month: null, // TODO: Fetch VX futures
      vix_back_month: null,
      vix_term_structure: null,
      vix_term_spread: null,
      tick_index: tickValue,
      tick_regime: tickRegime,
      advancers,
      decliners,
      unchanged: null,
      advance_decline_ratio: advanceDeclineRatio,
      advance_decline_diff: advancers && decliners ? advancers - decliners : null,
      new_highs: newHighs,
      new_lows: newLows,
      high_low_ratio: highLowRatio,
      breadth_regime: breadthRegime,
      spy_ndx_correlation: null, // TODO: Calculate from historical data
      spy_rut_correlation: null,
      correlation_regime: null,
      leading_sector: null,
      lagging_sector: null,
      sector_rotation: null,
      put_call_ratio_equity: putCallRatioEquity,
      put_call_ratio_index: putCallRatioIndex,
      put_call_ratio_total: putCallRatioTotal,
      pc_regime: pcRegime,
      spy_close: spyClose,
      spy_change_pct: spyChangePct,
      ndx_close: ndxClose,
      ndx_change_pct: ndxChangePct,
      rut_close: rutClose,
      rut_change_pct: rutChangePct,
      spy_volume: null, // TODO: Fetch volume data
      spy_volume_ratio: null,
      market_regime: marketRegime,
      confidence_score: confidenceScore,
    };

    // Store in database
    const { error } = await supabase.from("market_regime_history").upsert(record as any, {
      onConflict: "date",
    });

    if (error) {
      console.error(`[MarketRegime] Database error:`, error);
      return {
        success: false,
        date: today,
        vixLevel,
        vixRegime,
        breadthRegime,
        marketRegime,
        error: error.message,
      };
    }

    return {
      success: true,
      date: today,
      vixLevel,
      vixRegime,
      breadthRegime,
      marketRegime,
    };
  } catch (error) {
    console.error(`[MarketRegime] Error:`, error);
    return {
      success: false,
      date: today,
      vixLevel: null,
      vixRegime: null,
      breadthRegime: null,
      marketRegime: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
