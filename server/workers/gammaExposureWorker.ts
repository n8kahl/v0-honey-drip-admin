/**
 * Gamma Exposure Worker
 *
 * Continuously monitors gamma exposure and dealer positioning every 15 minutes
 * during market hours. Critical for trade quality - gamma walls predict price action.
 *
 * Run with: tsx watch server/workers/gammaExposureWorker.ts
 */

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !MASSIVE_API_KEY) {
  console.error("[GammaWorker] ❌ Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const MASSIVE_BASE_URL = "https://api.massive.com";
const SNAPSHOT_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Track statistics
const stats = {
  totalSnapshots: 0,
  totalErrors: 0,
  lastSnapshotTime: new Date(),
};

/**
 * Check if market is open (9:30 AM - 4:00 PM ET, Mon-Fri)
 */
function isMarketHours(): boolean {
  const now = new Date();
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).format(now);

  const [weekday, time] = et.split(", ");
  if (["Sat", "Sun"].includes(weekday)) return false;

  const [hour, minute] = time.split(":").map(Number);
  const minutesSinceOpen = (hour - 9) * 60 + (minute - 30);
  const minutesUntilClose = (16 - hour) * 60 - minute;

  return minutesSinceOpen >= 0 && minutesUntilClose > 0;
}

/**
 * Fetch options snapshot from Massive API
 */
async function fetchOptionsSnapshot(symbol: string) {
  const url = `${MASSIVE_BASE_URL}/v2/options/snapshots/${symbol}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${MASSIVE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
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

  let maxCallOIStrike = 0;
  let maxCallOI = 0;
  let maxPutOIStrike = 0;
  let maxPutOI = 0;

  for (const contract of contracts) {
    const strike = contract.details?.strike_price || 0;
    const gamma = contract.greeks?.gamma || 0;
    const oi = contract.open_interest || 0;
    const volume = contract.day?.volume || 0;
    const isCall = contract.details?.contract_type === "call";

    const strikeKey = strike.toString();

    // Aggregate by strike (gamma notional = gamma * OI * 100)
    const gammaNotional = gamma * oi * 100;
    gammaByStrike[strikeKey] = (gammaByStrike[strikeKey] || 0) + gammaNotional;
    oiByStrike[strikeKey] = (oiByStrike[strikeKey] || 0) + oi;
    volumeByStrike[strikeKey] = (volumeByStrike[strikeKey] || 0) + volume;

    // Aggregate totals
    if (isCall) {
      totalCallOI += oi;
      totalCallVolume += volume;
      totalCallGamma += gammaNotional;
      if (oi > maxCallOI) {
        maxCallOI = oi;
        maxCallOIStrike = strike;
      }
    } else {
      totalPutOI += oi;
      totalPutVolume += volume;
      totalPutGamma += gammaNotional;
      if (oi > maxPutOI) {
        maxPutOI = oi;
        maxPutOIStrike = strike;
      }
    }
  }

  // Find gamma walls (largest gamma concentrations above/below price)
  let maxGammaAbove = 0;
  let maxGammaBelow = 0;
  let resistanceStrike = null;
  let supportStrike = null;

  for (const [strikeStr, gamma] of Object.entries(gammaByStrike)) {
    const strike = parseFloat(strikeStr);
    const absGamma = Math.abs(gamma);

    if (strike > underlyingPrice && absGamma > maxGammaAbove) {
      maxGammaAbove = absGamma;
      resistanceStrike = strike;
    }
    if (strike < underlyingPrice && absGamma > maxGammaBelow) {
      maxGammaBelow = absGamma;
      supportStrike = strike;
    }
  }

  // Dealer net gamma (negative = dealers short gamma = bullish for price)
  const dealerNetGamma = totalCallGamma - totalPutGamma;
  let dealerPositioning: "LONG_GAMMA" | "SHORT_GAMMA" | "NEUTRAL";
  let positioningStrength: "WEAK" | "MODERATE" | "STRONG" | "EXTREME";

  const absGamma = Math.abs(dealerNetGamma);
  if (absGamma < 50000) {
    dealerPositioning = "NEUTRAL";
    positioningStrength = "WEAK";
  } else if (dealerNetGamma < 0) {
    dealerPositioning = "SHORT_GAMMA";
    positioningStrength = absGamma > 200000 ? "EXTREME" : absGamma > 100000 ? "STRONG" : "MODERATE";
  } else {
    dealerPositioning = "LONG_GAMMA";
    positioningStrength = absGamma > 200000 ? "EXTREME" : absGamma > 100000 ? "STRONG" : "MODERATE";
  }

  // Expected behavior based on gamma positioning
  let expectedBehavior: "PINNING" | "TRENDING" | "VOLATILE" | "RANGE_BOUND";
  if (dealerPositioning === "SHORT_GAMMA") {
    expectedBehavior = "TRENDING"; // Dealers hedge by buying/selling, amplifying moves
  } else if (dealerPositioning === "LONG_GAMMA") {
    expectedBehavior = "RANGE_BOUND"; // Dealers hedge by selling strength/buying weakness
  } else if (absGamma < 25000) {
    expectedBehavior = "VOLATILE"; // Low gamma = less hedging pressure
  } else {
    expectedBehavior = "PINNING"; // High OI concentration
  }

  // Distance to gamma walls (%)
  const distanceToResistance = resistanceStrike
    ? ((resistanceStrike - underlyingPrice) / underlyingPrice) * 100
    : null;
  const distanceToSupport = supportStrike
    ? ((underlyingPrice - supportStrike) / underlyingPrice) * 100
    : null;

  return {
    totalGamma: totalCallGamma + totalPutGamma,
    totalGammaNotional: (totalCallGamma + totalPutGamma) * underlyingPrice * underlyingPrice,
    callGamma: totalCallGamma,
    putGamma: totalPutGamma,
    gammaSkew: totalPutGamma !== 0 ? totalCallGamma / totalPutGamma : 0,
    totalCallOI,
    totalPutOI,
    putCallOIRatio: totalCallOI !== 0 ? totalPutOI / totalCallOI : 0,
    totalCallVolume,
    totalPutVolume,
    putCallVolumeRatio: totalCallVolume !== 0 ? totalPutVolume / totalCallVolume : 0,
    gammaByStrike,
    oiByStrike,
    volumeByStrike,
    maxCallOIStrike,
    maxPutOIStrike,
    gammaWallResistance: resistanceStrike,
    gammaWallSupport: supportStrike,
    gammaWallResistanceStrength: maxGammaAbove,
    gammaWallSupportStrength: maxGammaBelow,
    dealerNetGamma,
    dealerPositioning,
    positioningStrength,
    expectedBehavior,
    distanceToResistancePct: distanceToResistance,
    distanceToSupportPct: distanceToSupport,
  };
}

/**
 * Insert gamma exposure snapshot into database
 */
async function insertGammaSnapshot(
  symbol: string,
  underlyingPrice: number,
  gammaData: any,
  expirations: string[]
) {
  const timestamp = Date.now();

  const { error } = await supabase.from("gamma_exposure_snapshots").insert({
    symbol,
    timestamp,
    underlying_price: underlyingPrice,
    total_gamma: gammaData.totalGamma,
    total_gamma_notional: gammaData.totalGammaNotional,
    call_gamma: gammaData.callGamma,
    put_gamma: gammaData.putGamma,
    gamma_skew: gammaData.gammaSkew,
    total_call_oi: gammaData.totalCallOI,
    total_put_oi: gammaData.totalPutOI,
    put_call_oi_ratio: gammaData.putCallOIRatio,
    total_call_volume: gammaData.totalCallVolume,
    total_put_volume: gammaData.totalPutVolume,
    put_call_volume_ratio: gammaData.putCallVolumeRatio,
    gamma_by_strike: gammaData.gammaByStrike,
    oi_by_strike: gammaData.oiByStrike,
    volume_by_strike: gammaData.volumeByStrike,
    max_call_oi_strike: gammaData.maxCallOIStrike,
    max_put_oi_strike: gammaData.maxPutOIStrike,
    gamma_wall_resistance: gammaData.gammaWallResistance,
    gamma_wall_support: gammaData.gammaWallSupport,
    gamma_wall_resistance_strength: gammaData.gammaWallResistanceStrength,
    gamma_wall_support_strength: gammaData.gammaWallSupportStrength,
    dealer_net_gamma: gammaData.dealerNetGamma,
    dealer_positioning: gammaData.dealerPositioning,
    positioning_strength: gammaData.positioningStrength,
    expected_behavior: gammaData.expectedBehavior,
    distance_to_resistance_pct: gammaData.distanceToResistancePct,
    distance_to_support_pct: gammaData.distanceToSupportPct,
    expiration_focus: expirations[0] || null,
    expirations_included: expirations,
  });

  if (error) {
    console.error(`[GammaWorker] ❌ Failed to insert snapshot for ${symbol}:`, error.message);
    return false;
  }

  console.log(
    `[GammaWorker] ✅ Gamma snapshot for ${symbol}: ${gammaData.dealerPositioning} (${gammaData.expectedBehavior})`
  );
  return true;
}

/**
 * Process single symbol
 */
async function processSymbol(symbol: string): Promise<boolean> {
  try {
    const snapshot = await fetchOptionsSnapshot(symbol);

    if (!snapshot?.results || snapshot.results.length === 0) {
      console.warn(`[GammaWorker] ⚠️ No snapshot data for ${symbol}`);
      return false;
    }

    const underlyingPrice =
      snapshot.results[0]?.underlying_asset?.price ||
      snapshot.results[0]?.underlying_asset?.value ||
      0;

    // Calculate gamma exposure
    const gammaData = calculateGammaExposure(snapshot.results, underlyingPrice);

    // Get unique expirations
    const expirations = [
      ...new Set(snapshot.results.map((c: any) => c.details?.expiration_date).filter(Boolean)),
    ] as string[];

    // Insert snapshot
    return await insertGammaSnapshot(symbol, underlyingPrice, gammaData, expirations);
  } catch (error: any) {
    console.error(`[GammaWorker] ❌ Failed to process ${symbol}:`, error.message);
    stats.totalErrors++;
    return false;
  }
}

/**
 * Main worker loop
 */
async function runSnapshot() {
  console.log("[GammaWorker] 📸 Starting gamma snapshot...");

  // Check if market is open
  if (!isMarketHours()) {
    console.log("[GammaWorker] ⏸️  Market closed, skipping snapshot");
    return;
  }

  // Get all watchlist symbols
  const { data: watchlist, error } = await supabase
    .from("watchlist")
    .select("symbol")
    .order("created_at");

  if (error || !watchlist || watchlist.length === 0) {
    console.error("[GammaWorker] ❌ Failed to fetch watchlist:", error?.message);
    stats.totalErrors++;
    return;
  }

  const symbols = [...new Set(watchlist.map((w) => w.symbol))];
  console.log(`[GammaWorker] Processing ${symbols.length} symbols...`);

  let successCount = 0;
  for (const symbol of symbols) {
    const success = await processSymbol(symbol);
    if (success) successCount++;

    // Small delay between symbols to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  stats.totalSnapshots++;
  stats.lastSnapshotTime = new Date();

  console.log(`[GammaWorker] ✅ Snapshot complete: ${successCount}/${symbols.length} symbols`);
  console.log(`[GammaWorker] Stats - Total: ${stats.totalSnapshots}, Errors: ${stats.totalErrors}`);
}

/**
 * Start worker
 */
async function start() {
  console.log("[GammaWorker] ====================================");
  console.log("[GammaWorker] Gamma Exposure Worker");
  console.log("[GammaWorker] ====================================\n");
  console.log(`[GammaWorker] Snapshot Interval: ${SNAPSHOT_INTERVAL / 60000} minutes`);
  console.log("[GammaWorker] Market Hours: 9:30 AM - 4:00 PM ET\n");

  // Run initial snapshot
  await runSnapshot();

  // Schedule recurring snapshots
  setInterval(runSnapshot, SNAPSHOT_INTERVAL);

  console.log("[GammaWorker] 🟢 Worker running...\n");
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[GammaWorker] 🛑 Shutting down gracefully...");
  console.log("[GammaWorker] Final Stats:");
  console.log(`  Total Snapshots: ${stats.totalSnapshots}`);
  console.log(`  Total Errors: ${stats.totalErrors}`);
  console.log(`  Last Snapshot: ${stats.lastSnapshotTime.toISOString()}`);
  process.exit(0);
});

// Start worker
start().catch((error) => {
  console.error("[GammaWorker] ❌ Fatal error:", error);
  process.exit(1);
});
