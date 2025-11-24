/**
 * IV Percentile Calculation Module
 * Calculates 52-week IV percentile from historical Greeks data
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface IVPercentileResult {
  success: boolean;
  symbol: string;
  date: string;
  currentIV: number | null;
  ivRank: number | null;
  ivPercentile: number | null;
  ivRegime: string | null;
  error?: string;
}

interface IVRecord {
  symbol: string;
  date: string;
  current_iv: number;
  current_iv_call: number | null;
  current_iv_put: number | null;
  iv_52w_high: number;
  iv_52w_low: number;
  iv_52w_mean: number;
  iv_52w_median: number;
  iv_52w_stddev: number | null;
  iv_rank: number;
  iv_percentile: number;
  iv_zscore: number | null;
  iv_regime: "EXTREMELY_LOW" | "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "EXTREMELY_HIGH";
  iv_change_5d: number | null;
  iv_change_20d: number | null;
  iv_trend: "EXPANDING" | "STABLE" | "CONTRACTING" | null;
  iv_skew: number | null;
  skew_percentile: number | null;
  data_points_52w: number;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate median
 */
function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Classify IV regime
 */
function classifyIVRegime(ivPercentile: number): IVRecord["iv_regime"] {
  if (ivPercentile < 0.1) return "EXTREMELY_LOW";
  if (ivPercentile < 0.3) return "LOW";
  if (ivPercentile < 0.7) return "NORMAL";
  if (ivPercentile < 0.85) return "ELEVATED";
  if (ivPercentile < 0.95) return "HIGH";
  return "EXTREMELY_HIGH";
}

/**
 * Detect IV trend
 */
function detectIVTrend(
  current: number,
  change5d: number | null,
  change20d: number | null
): "EXPANDING" | "STABLE" | "CONTRACTING" | null {
  if (change20d === null) return null;

  const change20dPct = (change20d / current) * 100;

  if (change20dPct > 10) return "EXPANDING"; // IV increased >10%
  if (change20dPct < -10) return "CONTRACTING"; // IV decreased >10%
  return "STABLE";
}

/**
 * Calculate IV percentile for a symbol
 */
export async function calculateIVPercentile(
  supabase: SupabaseClient,
  symbol: string
): Promise<IVPercentileResult> {
  const today = new Date().toISOString().split("T")[0];

  try {
    // Fetch last 52 weeks of Greeks data
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

    const { data: greeksData, error: greeksError } = await supabase
      .from("historical_greeks")
      .select("implied_volatility, option_type, timestamp, dte")
      .eq("symbol", symbol)
      .gte("timestamp", oneYearAgo)
      .not("implied_volatility", "is", null)
      .order("timestamp", { ascending: true });

    if (greeksError) {
      return {
        success: false,
        symbol,
        date: today,
        currentIV: null,
        ivRank: null,
        ivPercentile: null,
        ivRegime: null,
        error: greeksError.message,
      };
    }

    if (!greeksData || greeksData.length < 50) {
      return {
        success: false,
        symbol,
        date: today,
        currentIV: null,
        ivRank: null,
        ivPercentile: null,
        ivRegime: null,
        error: "Insufficient historical data (need at least 50 data points)",
      };
    }

    // Get current IV (use ATM options, typically 30-45 DTE for indices)
    const recentGreeks = greeksData.filter((g) => g.dte >= 30 && g.dte <= 45);
    const currentCallIV =
      recentGreeks
        .filter((g) => g.option_type === "call")
        .slice(-10)
        .reduce((sum, g) => sum + (g.implied_volatility || 0), 0) / 10;

    const currentPutIV =
      recentGreeks
        .filter((g) => g.option_type === "put")
        .slice(-10)
        .reduce((sum, g) => sum + (g.implied_volatility || 0), 0) / 10;

    const currentIV = (currentCallIV + currentPutIV) / 2;

    if (!currentIV || currentIV === 0) {
      return {
        success: false,
        symbol,
        date: today,
        currentIV: null,
        ivRank: null,
        ivPercentile: null,
        ivRegime: null,
        error: "Unable to calculate current IV",
      };
    }

    // Calculate 52-week statistics
    const ivValues = greeksData.map((g) => g.implied_volatility || 0).filter((iv) => iv > 0);

    const ivHigh = Math.max(...ivValues);
    const ivLow = Math.min(...ivValues);
    const ivMean = ivValues.reduce((sum, val) => sum + val, 0) / ivValues.length;
    const ivMedian = calculateMedian(ivValues);
    const ivStdDev = calculateStdDev(ivValues, ivMean);

    // Calculate IV rank and percentile
    const ivRank = (currentIV - ivLow) / (ivHigh - ivLow);
    const ivPercentile = ivValues.filter((v) => v < currentIV).length / ivValues.length;
    const ivZScore = (currentIV - ivMean) / ivStdDev;

    // Calculate IV changes
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const twentyDaysAgo = Date.now() - 20 * 24 * 60 * 60 * 1000;

    const ivFiveDaysAgo =
      greeksData
        .filter((g) => g.timestamp >= fiveDaysAgo - 86400000 && g.timestamp <= fiveDaysAgo)
        .reduce((sum, g) => sum + (g.implied_volatility || 0), 0) /
      Math.max(
        1,
        greeksData.filter((g) => g.timestamp >= fiveDaysAgo - 86400000 && g.timestamp <= fiveDaysAgo).length
      );

    const ivTwentyDaysAgo =
      greeksData
        .filter((g) => g.timestamp >= twentyDaysAgo - 86400000 && g.timestamp <= twentyDaysAgo)
        .reduce((sum, g) => sum + (g.implied_volatility || 0), 0) /
      Math.max(
        1,
        greeksData.filter((g) => g.timestamp >= twentyDaysAgo - 86400000 && g.timestamp <= twentyDaysAgo).length
      );

    const ivChange5d = ivFiveDaysAgo > 0 ? currentIV - ivFiveDaysAgo : null;
    const ivChange20d = ivTwentyDaysAgo > 0 ? currentIV - ivTwentyDaysAgo : null;

    const ivTrend = detectIVTrend(currentIV, ivChange5d, ivChange20d);

    // Calculate call/put skew
    const ivSkew = currentCallIV - currentPutIV;

    // Classify regime
    const ivRegime = classifyIVRegime(ivPercentile);

    // Build record
    const record: IVRecord = {
      symbol,
      date: today,
      current_iv: currentIV,
      current_iv_call: currentCallIV,
      current_iv_put: currentPutIV,
      iv_52w_high: ivHigh,
      iv_52w_low: ivLow,
      iv_52w_mean: ivMean,
      iv_52w_median: ivMedian,
      iv_52w_stddev: ivStdDev,
      iv_rank: ivRank,
      iv_percentile: ivPercentile,
      iv_zscore: ivZScore,
      iv_regime: ivRegime,
      iv_change_5d: ivChange5d,
      iv_change_20d: ivChange20d,
      iv_trend: ivTrend,
      iv_skew: ivSkew,
      skew_percentile: null, // TODO: Calculate from historical skews
      data_points_52w: ivValues.length,
    };

    // Store in database
    const { error } = await supabase.from("iv_percentile_cache").upsert(record as any, {
      onConflict: "symbol,date",
    });

    if (error) {
      console.error(`[IVPercentile] Database error for ${symbol}:`, error);
      return {
        success: false,
        symbol,
        date: today,
        currentIV,
        ivRank,
        ivPercentile,
        ivRegime,
        error: error.message,
      };
    }

    return {
      success: true,
      symbol,
      date: today,
      currentIV,
      ivRank,
      ivPercentile,
      ivRegime,
    };
  } catch (error) {
    console.error(`[IVPercentile] Error for ${symbol}:`, error);
    return {
      success: false,
      symbol,
      date: today,
      currentIV: null,
      ivRank: null,
      ivPercentile: null,
      ivRegime: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
