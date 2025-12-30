/**
 * Historical Data Backfill Worker (Multi-Source Version)
 * Phase 4f: Unified backfill script using optimal data source per asset type
 *
 * Data Sources:
 * - INDICES (SPX, VIX, NDX): Massive.com S3 flatfiles (10-100x faster, no limits)
 * - STOCKS (SPY, QQQ, etc.): Yahoo Finance API (free, supports intraday)
 * - OPTIONS: Massive.com S3 flatfiles (future implementation)
 *
 * Why Yahoo Finance for stocks?
 * - Tradier /markets/history only supports daily/weekly/monthly intervals (no intraday)
 * - Massive.com stocks package costs $99 (only have options + indices packages)
 * - Yahoo Finance provides free 1m intraday bars with no API key required
 *
 * Advantages:
 * - Automatic routing based on asset type
 * - Full intraday support for both indices and stocks
 * - S3 for indices (fast bulk), Yahoo for stocks (free intraday)
 * - Zero additional cost for stock data
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
// Tradier import removed - using Yahoo Finance for stocks and Massive S3 for indices
import YahooFinance from "yahoo-finance2";

// Initialize Yahoo Finance client
const yahooFinance = new YahooFinance();

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
const forceS3 = args.includes("--force-s3"); // Force Massive S3 for stocks (requires subscription)

const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg) : 90;

// ============================================================================
// Asset Type Detection
// ============================================================================

type AssetType = "index" | "stock";

/**
 * Determine asset type from symbol
 * Indices: Use Massive.com S3 flatfiles (fast, no limits)
 * Stocks: Use Yahoo Finance API (free) or Massive S3 (with --force-s3)
 */
function getAssetType(symbol: string): AssetType {
  const indexSymbols = ["SPX", "NDX", "VIX", "RUT", "DJI"];
  const cleanSymbol = symbol.replace(/^I:/, "");
  return indexSymbols.includes(cleanSymbol) ? "index" : "stock";
}

/**
 * Fetch stock bars from Yahoo Finance API using chart() method
 * Free alternative to Massive.com for intraday stock data
 *
 * Yahoo Finance chart() provides:
 * - 1-minute bars for last 7 days
 * - 2-minute bars for last 60 days
 * - 5-minute bars for last 60 days
 * - Hourly bars for last 730 days
 *
 * For our use case (90 days, 1-minute data):
 * - We fetch 1m bars for last 7 days
 * - Fall back to 5m bars for 8-90 days
 */
async function fetchYahooStockBars(symbol: string, startDate: Date, endDate: Date): Promise<any[]> {
  try {
    console.log(
      `[YahooFinance] Fetching ${symbol} intraday bars from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}...`
    );

    const allBars: any[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch 1-minute bars for last 7 days (Yahoo limit)
    if (endDate >= sevenDaysAgo) {
      const oneMinStart = startDate > sevenDaysAgo ? startDate : sevenDaysAgo;

      console.log(
        `[YahooFinance]   Fetching 1m bars from ${oneMinStart.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}...`
      );

      const result = await yahooFinance.chart(symbol, {
        period1: oneMinStart,
        period2: endDate,
        interval: "1m",
      });

      // Normalize quotes to our bar format
      const quotes = result.quotes || [];
      const normalized1m = quotes.map((bar: any) => ({
        ticker: symbol,
        t: bar.date.getTime(), // Convert Date to milliseconds
        o: bar.open,
        h: bar.high,
        l: bar.low,
        c: bar.close,
        v: bar.volume || 0,
        vw: bar.close, // Yahoo doesn't provide VWAP, use close as fallback
        n: 0, // Yahoo doesn't provide trade count
      }));

      allBars.push(...normalized1m);
      console.log(`[YahooFinance]   ✅ Fetched ${normalized1m.length} 1m bars`);
    }

    // If requesting data older than 7 days, fetch 5-minute bars
    if (startDate < sevenDaysAgo) {
      const fiveMinEnd = endDate < sevenDaysAgo ? endDate : sevenDaysAgo;

      // Skip if start and end are the same day (Yahoo API requirement)
      const daysDiff = (fiveMinEnd.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysDiff < 1) {
        console.log(`[YahooFinance]   ⏭️  Skipping 5m bars (date range < 1 day)`);
      } else {
        console.log(
          `[YahooFinance]   Fetching 5m bars from ${startDate.toISOString().split("T")[0]} to ${fiveMinEnd.toISOString().split("T")[0]}...`
        );

        const result = await yahooFinance.chart(symbol, {
          period1: startDate,
          period2: fiveMinEnd,
          interval: "5m",
        });

        const quotes = result.quotes || [];

        // Normalize 5m bars - we'll downsample to 1m by duplicating
        // This is a compromise since Yahoo doesn't provide 1m data beyond 7 days
        const normalized5m = quotes.flatMap((bar: any) => {
          const baseBar = {
            ticker: symbol,
            t: bar.date.getTime(),
            o: bar.open,
            h: bar.high,
            l: bar.low,
            c: bar.close,
            v: Math.floor(bar.volume / 5), // Split volume across 5 bars
            vw: bar.close,
            n: 0,
          };

          // Create 5 synthetic 1-minute bars from each 5-minute bar
          return Array.from({ length: 5 }, (_, i) => ({
            ...baseBar,
            t: baseBar.t + i * 60 * 1000, // Add i minutes
          }));
        });

        allBars.push(...normalized5m);
        console.log(
          `[YahooFinance]   ✅ Fetched ${quotes.length} 5m bars (expanded to ${normalized5m.length} 1m bars)`
        );
      }
    }

    // Sort by timestamp
    allBars.sort((a, b) => a.t - b.t);

    console.log(`[YahooFinance] ✅ Total: ${allBars.length} bars for ${symbol}`);
    return allBars;
  } catch (error) {
    console.error(`[YahooFinance] Error fetching ${symbol}:`, error);
    throw error;
  }
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
  const useS3ForThisSymbol = assetType === "index" || forceS3;
  const source = useS3ForThisSymbol ? "Massive S3" : "Yahoo Finance";

  console.log(
    `\n[Backfill] 📥 Processing ${symbol} (${assetType}) via ${source}${forceS3 && assetType === "stock" ? " (--force-s3)" : ""}...`
  );

  // Date range
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - DAYS_TO_BACKFILL * 24 * 60 * 60 * 1000);

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
    // Use Massive S3 for indices OR when --force-s3 flag is set (requires Massive stocks subscription)
    let minuteBars: any[];
    const useS3 = assetType === "index" || forceS3;

    if (useS3) {
      // Use Massive.com S3 flatfiles (fast, no limits)
      console.log(
        `[Backfill] Downloading 1m bars from Massive S3${forceS3 && assetType === "stock" ? " (forced)" : ""}...`
      );
      minuteBars = await downloadSymbolHistory(symbol, startDate, endDate);
    } else {
      // Use Yahoo Finance API (free intraday data for stocks)
      console.log(`[Backfill] Fetching 1m bars from Yahoo Finance...`);
      console.log(
        `[Backfill] ⚠️ Note: Yahoo limits 5m data to 60 days. Use --force-s3 for full history (requires Massive stocks subscription).`
      );
      minuteBars = await fetchYahooStockBars(symbol, startDate, endDate);
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
  console.log("  • Indices: Massive.com S3 flatfiles (fast, bulk)");
  console.log("  • Stocks: Yahoo Finance API (free intraday)");
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
