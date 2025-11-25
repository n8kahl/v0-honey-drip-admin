/**
 * Historical Data Backfill Worker (Multi-Source Version)
 * Phase 4e: Unified backfill script using optimal data source per asset type
 *
 * Data Sources:
 * - INDICES (SPX, VIX, NDX): Massive.com S3 flatfiles (10-100x faster, no limits)
 * - STOCKS (SPY, QQQ, etc.): Tradier API (S3 access denied, API limits: 20-40 days)
 * - OPTIONS: Massive.com S3 flatfiles (future implementation)
 *
 * Advantages:
 * - Automatic routing based on asset type
 * - No more S3 403 errors for stocks
 * - Optimal performance per asset class
 *
 * Usage:
 *   pnpm backfill:s3                    # All symbols, 90 days, all timeframes
 *   pnpm backfill:s3 --days=30          # Last 30 days
 *   pnpm backfill:s3 --symbol=SPY       # Single symbol (auto-detects source)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { downloadSymbolHistory, aggregateBars, cleanupTempFiles } from "../lib/massiveFlatfiles.js";
import { fetchTradierBars } from "../lib/tradierAPI.js";

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Timeframes to backfill (derived from 1-minute data)
const TIMEFRAMES = [
  { key: "1m", minutes: 1 },
  { key: "5m", minutes: 5 },
  { key: "15m", minutes: 15 },
  { key: "1h", minutes: 60 },
  { key: "4h", minutes: 240 },
  { key: "day", minutes: 1440 },
];

// CLI Options
const args = process.argv.slice(2);
const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1];
const symbolArg = args.find((a) => a.startsWith("--symbol="))?.split("=")[1];
const skipCheck = args.includes("--skip-check");

const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg) : 90;

// ============================================================================
// Asset Type Detection
// ============================================================================

type AssetType = "index" | "stock";

/**
 * Determine asset type from symbol
 * Indices: Use Massive.com S3 (fast, no limits)
 * Stocks: Use Tradier API (S3 access denied)
 */
function getAssetType(symbol: string): AssetType {
  const indexSymbols = ["SPX", "NDX", "VIX", "RUT", "DJI"];
  const cleanSymbol = symbol.replace(/^I:/, "");
  return indexSymbols.includes(cleanSymbol) ? "index" : "stock";
}

// ============================================================================
// Main Backfill Logic
// ============================================================================

interface BackfillStats {
  totalSymbols: number;
  totalTimeframes: number;
  totalBarsStored: number;
  totalDownloadedMB: number;
  startTime: number;
  errors: string[];
}

async function backfillSymbol(symbol: string, stats: BackfillStats): Promise<void> {
  const assetType = getAssetType(symbol);
  const source = assetType === "index" ? "Massive S3" : "Tradier API";

  console.log(`\n[Backfill] 📥 Processing ${symbol} (${assetType}) via ${source}...`);

  // Date range
  const endDate = new Date();
  let startDate = new Date(endDate.getTime() - DAYS_TO_BACKFILL * 24 * 60 * 60 * 1000);

  // Tradier API has lookback limits - enforce them
  if (assetType === "stock") {
    const maxDays = 20; // Conservative limit for 1-minute bars
    if (DAYS_TO_BACKFILL > maxDays) {
      console.warn(
        `[Backfill] ⚠️  Tradier API limit: ${maxDays} days for stocks. Adjusting from ${DAYS_TO_BACKFILL} days.`
      );
      startDate = new Date(endDate.getTime() - maxDays * 24 * 60 * 60 * 1000);
    }
  }

  try {
    // Check if data already exists (skip check if --skip-check flag)
    if (!skipCheck) {
      const { data: existing } = await supabase
        .from("historical_bars")
        .select("timestamp")
        .eq("symbol", symbol)
        .eq("timeframe", "1m")
        .gte("timestamp", startDate.getTime())
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Backfill] ⏭️  ${symbol} - Data already exists, skipping`);
        return;
      }
    }

    // Fetch 1-minute bars from appropriate source
    let minuteBars: any[];

    if (assetType === "index") {
      // Use Massive.com S3 flatfiles (fast, no limits)
      console.log(`[Backfill] Downloading 1m bars from Massive S3...`);
      minuteBars = await downloadSymbolHistory(symbol, startDate, endDate);
    } else {
      // Use Tradier API (stocks have S3 access denied)
      console.log(`[Backfill] Fetching 1m bars from Tradier API...`);
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      minuteBars = await fetchTradierBars(symbol, "1m", startDateStr, endDateStr);
    }

    if (minuteBars.length === 0) {
      console.warn(`[Backfill] ⚠️ No data found for ${symbol}`);
      stats.errors.push(`${symbol}: No data found`);
      return;
    }

    // Estimate download size (rough calculation)
    const estimatedMB = (minuteBars.length * 50) / (1024 * 1024); // ~50 bytes per bar
    stats.totalDownloadedMB += estimatedMB;

    console.log(
      `[Backfill] Downloaded ${minuteBars.length} 1m bars from ${source} (~${estimatedMB.toFixed(2)} MB)`
    );

    // Generate all timeframes from 1-minute data
    for (const tf of TIMEFRAMES) {
      try {
        console.log(`[Backfill]   Generating ${tf.key}...`);

        let bars: any[];
        if (tf.key === "1m") {
          bars = minuteBars;
        } else {
          bars = aggregateBars(minuteBars, tf.minutes);
        }

        if (bars.length === 0) {
          console.warn(`[Backfill]   ⚠️ No bars generated for ${tf.key}`);
          continue;
        }

        // Transform to database format
        const rows = bars.map((bar) => ({
          symbol,
          timeframe: tf.key,
          timestamp: bar.t,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          vwap: bar.vw,
          trades: bar.n,
        }));

        // Store in database
        const { error } = await supabase.from("historical_bars").upsert(rows as any, {
          onConflict: "symbol,timeframe,timestamp",
        });

        if (error) {
          throw error;
        }

        stats.totalBarsStored += rows.length;
        console.log(`[Backfill]   ✅ ${tf.key} - Stored ${rows.length} bars`);
      } catch (error) {
        const errorMsg = `${symbol} ${tf.key}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Backfill]   ❌ ${tf.key} - Failed:`, error);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`[Backfill] ✅ ${symbol} - Complete`);
  } catch (error) {
    const errorMsg = `${symbol}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Backfill] ❌ ${symbol} - Failed:`, error);
    stats.errors.push(errorMsg);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log("\n=================================================");
  console.log("📦 HISTORICAL DATA BACKFILL (Multi-Source)");
  console.log("=================================================");
  console.log("  • Indices: Massive.com S3 (fast, unlimited)");
  console.log("  • Stocks: Tradier API (20-day limit)");
  console.log("=================================================\n");

  const stats: BackfillStats = {
    totalSymbols: 0,
    totalTimeframes: TIMEFRAMES.length,
    totalBarsStored: 0,
    totalDownloadedMB: 0,
    startTime: Date.now(),
    errors: [],
  };

  // Get symbols to backfill
  let symbols: string[];
  if (symbolArg) {
    symbols = [symbolArg];
  } else {
    // Fetch from database
    const { data, error } = await supabase.from("watchlist").select("symbol");

    if (error) {
      console.error("Failed to fetch watchlist:", error);
      symbols = ["SPY", "SPX", "NDX", "QQQ", "VIX"]; // Fallback
    } else {
      const rows: Array<{ symbol: string }> = data || [];
      symbols = [...new Set(rows.map((row) => row.symbol))];
    }
  }

  stats.totalSymbols = symbols.length;

  console.log(`Configuration:`);
  console.log(`  Symbols: ${symbols.length} (${symbols.join(", ")})`);
  console.log(`  Date Range: ${DAYS_TO_BACKFILL} days`);
  console.log(`  Timeframes: ${TIMEFRAMES.map((tf) => tf.key).join(", ")}`);
  console.log(`  Total Tasks: ${symbols.length} symbols × ${TIMEFRAMES.length} timeframes`);
  console.log(`  Skip Check: ${skipCheck ? "Yes" : "No"}`);
  console.log();

  // Process each symbol sequentially (S3 downloads are already fast)
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    console.log(`\n[${i + 1}/${symbols.length}] Processing ${symbol}...`);

    await backfillSymbol(symbol, stats);

    // Progress update
    const elapsed = Date.now() - stats.startTime;
    const avgTimePerSymbol = elapsed / (i + 1);
    const remaining = symbols.length - (i + 1);
    const etaMs = avgTimePerSymbol * remaining;
    const etaMin = Math.floor(etaMs / 60000);
    const etaSec = Math.floor((etaMs % 60000) / 1000);

    console.log(
      `\n📊 Progress: ${i + 1}/${symbols.length} (${(((i + 1) / symbols.length) * 100).toFixed(1)}%) - ETA: ${etaMin}m ${etaSec}s`
    );
  }

  // Cleanup temp files
  cleanupTempFiles();

  // Final report
  const duration = Date.now() - stats.startTime;
  const durationMin = Math.floor(duration / 60000);
  const durationSec = Math.floor((duration % 60000) / 1000);

  console.log("\n===========================================");
  console.log("📊 BACKFILL COMPLETE");
  console.log("===========================================\n");

  console.log(`Symbols Processed: ${stats.totalSymbols}`);
  console.log(`Total Bars Stored: ${stats.totalBarsStored.toLocaleString()}`);
  console.log(`Data Downloaded: ${stats.totalDownloadedMB.toFixed(2)} MB`);
  console.log(`Duration: ${durationMin}m ${durationSec}s`);
  console.log(`Throughput: ${(stats.totalBarsStored / (duration / 1000)).toFixed(0)} bars/sec`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️ Errors: ${stats.errors.length}`);
    stats.errors.forEach((err) => console.log(`  - ${err}`));
  } else {
    console.log("\n✅ No errors!");
  }

  console.log("\n===========================================\n");

  process.exit(stats.errors.length > 0 ? 1 : 0);
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
