/**
 * Historical Data Backfill Script
 *
 * Backfills 90 days of historical Greeks, options flow, and gamma snapshots
 * Run with: tsx scripts/backfill-historical-data.ts
 */

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[v0] ❌ Missing Supabase credentials");
  process.exit(1);
}

if (!MASSIVE_API_KEY) {
  console.error("[v0] ❌ Missing MASSIVE_API_KEY");
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MASSIVE_BASE_URL = "https://api.massive.com";
const BACKFILL_DAYS = 90;
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch options snapshot from Massive API
 */
async function fetchOptionsSnapshot(symbol: string, date?: string) {
  const url = `${MASSIVE_BASE_URL}/v2/options/snapshots/${symbol}`;
  const params = new URLSearchParams();
  if (date) params.append("date", date);

  console.log(`[v0] Fetching options snapshot: ${symbol}${date ? ` date=${date}` : ""}`);

  const response = await fetch(`${url}?${params}`, {
    headers: {
      Authorization: `Bearer ${MASSIVE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`[v0] ⚠️ Rate limited, waiting 5 seconds...`);
      await delay(5000);
      return fetchOptionsSnapshot(symbol, date); // Retry
    }
    throw new Error(`Massive API error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

/**
 * Calculate gamma exposure from options chain
 */
function calculateGammaExposure(contracts: any[], underlyingPrice: number) {
  const gammaByStrike: Record<string, number> = {};
  const oiByStrike: Record<string, number> = {};
  const volumeByStrike: Record<string, number> = {};

  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallVolume = 0;
  let totalPutVolume = 0;
  let totalCallGamma = 0;
  let totalPutGamma = 0;

  for (const contract of contracts) {
    const strike = contract.details?.strike_price || 0;
    const gamma = contract.greeks?.gamma || 0;
    const oi = contract.open_interest || 0;
    const volume = contract.day?.volume || 0;
    const isCall = contract.details?.contract_type === "call";

    const strikeKey = strike.toString();

    // Aggregate by strike
    gammaByStrike[strikeKey] = (gammaByStrike[strikeKey] || 0) + gamma * oi * 100;
    oiByStrike[strikeKey] = (oiByStrike[strikeKey] || 0) + oi;
    volumeByStrike[strikeKey] = (volumeByStrike[strikeKey] || 0) + volume;

    // Aggregate totals
    if (isCall) {
      totalCallOI += oi;
      totalCallVolume += volume;
      totalCallGamma += gamma * oi * 100;
    } else {
      totalPutOI += oi;
      totalPutVolume += volume;
      totalPutGamma += gamma * oi * 100;
    }
  }

  // Find gamma walls (largest gamma concentrations above/below price)
  let maxGammaAbove = 0;
  let maxGammaBelow = 0;
  let resistanceStrike = null;
  let supportStrike = null;

  for (const [strikeStr, gamma] of Object.entries(gammaByStrike)) {
    const strike = parseFloat(strikeStr);
    if (strike > underlyingPrice && Math.abs(gamma) > maxGammaAbove) {
      maxGammaAbove = Math.abs(gamma);
      resistanceStrike = strike;
    }
    if (strike < underlyingPrice && Math.abs(gamma) > maxGammaBelow) {
      maxGammaBelow = Math.abs(gamma);
      supportStrike = strike;
    }
  }

  const dealerNetGamma = totalCallGamma - totalPutGamma;
  let dealerPositioning: "LONG_GAMMA" | "SHORT_GAMMA" | "NEUTRAL";
  if (dealerNetGamma < -50000) dealerPositioning = "SHORT_GAMMA";
  else if (dealerNetGamma > 50000) dealerPositioning = "LONG_GAMMA";
  else dealerPositioning = "NEUTRAL";

  return {
    totalGamma: totalCallGamma + totalPutGamma,
    callGamma: totalCallGamma,
    putGamma: totalPutGamma,
    totalCallOI,
    totalPutOI,
    totalCallVolume,
    totalPutVolume,
    gammaByStrike,
    oiByStrike,
    volumeByStrike,
    dealerNetGamma,
    dealerPositioning,
    gammaWallResistance: resistanceStrike,
    gammaWallSupport: supportStrike,
    gammaWallResistanceStrength: maxGammaAbove,
    gammaWallSupportStrength: maxGammaBelow,
  };
}

/**
 * Insert Greeks data into database
 */
async function insertGreeks(symbol: string, contracts: any[], timestamp: number) {
  const rows = contracts
    .filter((c) => c.greeks && c.implied_volatility) // Only insert if we have Greeks and IV
    .map((contract) => ({
      symbol,
      contract_ticker: contract.details?.ticker,
      strike: contract.details?.strike_price,
      expiration: contract.details?.expiration_date,
      timestamp,
      delta: contract.greeks?.delta,
      gamma: contract.greeks?.gamma,
      theta: contract.greeks?.theta,
      vega: contract.greeks?.vega,
      rho: contract.greeks?.rho,
      implied_volatility: contract.implied_volatility,
      underlying_price: contract.underlying_asset?.price || contract.underlying_asset?.value,
      dte: contract.day_to_expiration || 0,
      option_type: contract.details?.contract_type === "call" ? "call" : "put",
      bid: contract.day?.close_bid,
      ask: contract.day?.close_ask,
      last: contract.last?.price,
      mid_price: (contract.day?.close_bid + contract.day?.close_ask) / 2,
      volume: contract.day?.volume,
      open_interest: contract.open_interest,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("historical_greeks").insert(rows);

  if (error) {
    console.error(`[v0] ❌ Failed to insert Greeks for ${symbol}:`, error.message);
    return 0;
  }

  console.log(`[v0] ✅ Inserted ${rows.length} Greeks records for ${symbol}`);
  return rows.length;
}

/**
 * Insert gamma exposure snapshot
 */
async function insertGammaSnapshot(
  symbol: string,
  underlyingPrice: number,
  gammaData: any,
  timestamp: number,
  expirations: string[]
) {
  const { error } = await supabase.from("gamma_exposure_snapshots").insert({
    symbol,
    timestamp,
    underlying_price: underlyingPrice,
    total_gamma: gammaData.totalGamma,
    call_gamma: gammaData.callGamma,
    put_gamma: gammaData.putGamma,
    gamma_skew: gammaData.putGamma !== 0 ? gammaData.callGamma / gammaData.putGamma : 0,
    total_call_oi: gammaData.totalCallOI,
    total_put_oi: gammaData.totalPutOI,
    put_call_oi_ratio:
      gammaData.totalCallOI !== 0 ? gammaData.totalPutOI / gammaData.totalCallOI : 0,
    total_call_volume: gammaData.totalCallVolume,
    total_put_volume: gammaData.totalPutVolume,
    put_call_volume_ratio:
      gammaData.totalCallVolume !== 0 ? gammaData.totalPutVolume / gammaData.totalCallVolume : 0,
    gamma_by_strike: gammaData.gammaByStrike,
    oi_by_strike: gammaData.oiByStrike,
    volume_by_strike: gammaData.volumeByStrike,
    gamma_wall_resistance: gammaData.gammaWallResistance,
    gamma_wall_support: gammaData.gammaWallSupport,
    gamma_wall_resistance_strength: gammaData.gammaWallResistanceStrength,
    gamma_wall_support_strength: gammaData.gammaWallSupportStrength,
    dealer_net_gamma: gammaData.dealerNetGamma,
    dealer_positioning: gammaData.dealerPositioning,
    expirations_included: expirations,
  });

  if (error) {
    console.error(`[v0] ❌ Failed to insert gamma snapshot for ${symbol}:`, error.message);
    return false;
  }

  console.log(`[v0] ✅ Inserted gamma snapshot for ${symbol}`);
  return true;
}

/**
 * Calculate and insert IV percentile
 */
async function calculateIVPercentile(symbol: string) {
  // Get last 252 trading days of IV data (1 year)
  const { data: ivData, error } = await supabase
    .from("historical_greeks")
    .select("implied_volatility, timestamp")
    .eq("symbol", symbol)
    .not("implied_volatility", "is", null)
    .order("timestamp", { ascending: false })
    .limit(252);

  if (error || !ivData || ivData.length < 30) {
    console.warn(
      `[v0] ⚠️ Not enough IV data for ${symbol} percentile calc (${ivData?.length || 0} records)`
    );
    return;
  }

  const ivValues = ivData.map((d) => d.implied_volatility).filter((v) => v != null);
  const currentIV = ivValues[0];
  const sorted = [...ivValues].sort((a, b) => a - b);

  // Calculate percentile
  const belowCurrent = sorted.filter((v) => v < currentIV).length;
  const ivPercentile = belowCurrent / sorted.length;

  // Calculate rank (0-1)
  const ivMin = Math.min(...ivValues);
  const ivMax = Math.max(...ivValues);
  const ivRank = ivMax > ivMin ? (currentIV - ivMin) / (ivMax - ivMin) : 0.5;

  // Calculate mean
  const ivMean = ivValues.reduce((sum, v) => sum + v, 0) / ivValues.length;

  // Determine IV regime
  let ivRegime: string;
  if (ivPercentile >= 0.8) ivRegime = "EXTREMELY_HIGH";
  else if (ivPercentile >= 0.6) ivRegime = "HIGH";
  else if (ivPercentile >= 0.4) ivRegime = "NORMAL";
  else if (ivPercentile >= 0.2) ivRegime = "LOW";
  else ivRegime = "EXTREMELY_LOW";

  // Insert/update cache
  const { error: insertError } = await supabase.from("iv_percentile_cache").upsert(
    {
      symbol,
      date: new Date().toISOString().split("T")[0],
      current_iv: currentIV,
      iv_rank: ivRank,
      iv_percentile: ivPercentile,
      iv_regime: ivRegime,
      iv_52w_high: ivMax,
      iv_52w_low: ivMin,
      iv_52w_mean: ivMean,
      iv_52w_median: sorted[Math.floor(sorted.length / 2)],
      data_points_52w: ivValues.length,
    },
    {
      onConflict: "symbol,date",
    }
  );

  if (insertError) {
    console.error(`[v0] ❌ Failed to insert IV percentile for ${symbol}:`, insertError.message);
  } else {
    console.log(
      `[v0] ✅ Updated IV percentile for ${symbol}: ${(ivPercentile * 100).toFixed(1)}% (${ivRegime})`
    );
  }
}

/**
 * Backfill data for a single symbol for a specific date
 */
async function backfillSymbolForDate(symbol: string, date: string) {
  try {
    const snapshot = await fetchOptionsSnapshot(symbol, date);

    if (!snapshot?.results || snapshot.results.length === 0) {
      console.warn(`[v0] ⚠️ No snapshot data for ${symbol} on ${date}`);
      return { greeks: 0, gamma: false };
    }

    const timestamp = new Date(date).getTime();
    const underlyingPrice =
      snapshot.results[0]?.underlying_asset?.price ||
      snapshot.results[0]?.underlying_asset?.value ||
      0;

    // Filter for ATM contracts (within 10% of underlying)
    const atmContracts = snapshot.results.filter((c: any) => {
      const strike = c.details?.strike_price || 0;
      const strikeDistance = Math.abs(strike - underlyingPrice) / underlyingPrice;
      return strikeDistance <= 0.1 && c.greeks && c.implied_volatility;
    });

    // Insert Greeks
    const greeksInserted = await insertGreeks(symbol, atmContracts, timestamp);

    // Calculate and insert gamma exposure
    const gammaData = calculateGammaExposure(snapshot.results, underlyingPrice);
    const expirations = [
      ...new Set(snapshot.results.map((c: any) => c.details?.expiration_date).filter(Boolean)),
    ] as string[];
    const gammaInserted = await insertGammaSnapshot(
      symbol,
      underlyingPrice,
      gammaData,
      timestamp,
      expirations
    );

    // Rate limit delay
    await delay(RATE_LIMIT_DELAY);

    return { greeks: greeksInserted, gamma: gammaInserted };
  } catch (error: any) {
    console.error(`[v0] ❌ Failed to backfill ${symbol} on ${date}:`, error.message);
    return { greeks: 0, gamma: false };
  }
}

/**
 * Backfill data for a single symbol (90 days)
 */
async function backfillSymbol(symbol: string) {
  console.log(`\n[v0] ====== Backfilling ${symbol} (${BACKFILL_DAYS} days) ======`);

  try {
    let totalGreeks = 0;
    let totalGammaSnapshots = 0;

    // Generate list of dates (trading days only - weekdays)
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < BACKFILL_DAYS * 1.5; i++) {
      // 1.5x to account for weekends
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Skip weekends
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      dates.push(date.toISOString().split("T")[0]);

      if (dates.length >= BACKFILL_DAYS) break;
    }

    console.log(`[v0] Processing ${dates.length} trading days...`);

    // Backfill each date
    for (const date of dates) {
      const result = await backfillSymbolForDate(symbol, date);
      totalGreeks += result.greeks;
      if (result.gamma) totalGammaSnapshots++;
    }

    // Calculate IV percentile after backfill
    if (totalGreeks > 0) {
      await calculateIVPercentile(symbol);
    }

    console.log(`[v0] ✅ Backfill complete for ${symbol}:`);
    console.log(`  - Greeks records: ${totalGreeks}`);
    console.log(`  - Gamma snapshots: ${totalGammaSnapshots}`);

    return { greeks: totalGreeks, gamma: totalGammaSnapshots };
  } catch (error: any) {
    console.error(`[v0] ❌ Failed to backfill ${symbol}:`, error.message);
    return { greeks: 0, gamma: 0 };
  }
}

/**
 * Main backfill function
 */
async function main() {
  console.log("[v0] ====================================");
  console.log("[v0] Historical Data Backfill Script");
  console.log("[v0] ====================================\n");
  console.log(`[v0] Backfilling ${BACKFILL_DAYS} days of data`);
  console.log(`[v0] Rate limit: ${RATE_LIMIT_DELAY}ms between requests\n`);

  // Get all watchlist symbols
  const { data: watchlist, error } = await supabase
    .from("watchlist")
    .select("symbol")
    .order("added_at");

  if (error) {
    console.error("[v0] ❌ Failed to fetch watchlist:", error.message);
    process.exit(1);
  }

  if (!watchlist || watchlist.length === 0) {
    console.log("[v0] ⚠️ No symbols in watchlist");
    process.exit(0);
  }

  const symbols = [...new Set(watchlist.map((w) => w.symbol))]; // Deduplicate
  console.log(`[v0] Found ${symbols.length} unique symbols:`, symbols.join(", "), "\n");

  // Backfill each symbol
  let totalGreeks = 0;
  let totalGammaSnapshots = 0;
  for (const symbol of symbols) {
    const result = await backfillSymbol(symbol);
    totalGreeks += result.greeks;
    totalGammaSnapshots += result.gamma;

    // Delay between symbols
    await delay(2000);
  }

  console.log("\n[v0] ====================================");
  console.log("[v0] Backfill Complete");
  console.log(`[v0] Total Greeks records: ${totalGreeks}`);
  console.log(`[v0] Total Gamma snapshots: ${totalGammaSnapshots}`);
  console.log("[v0] ====================================\n");
}

// Run backfill
main().catch((error) => {
  console.error("[v0] ❌ Fatal error:", error);
  process.exit(1);
});
