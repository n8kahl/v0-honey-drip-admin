/**
 * Historical Data Backfill Worker
 * Phase 2: One-time script to populate historical_bars table with 90 days of OHLCV data
 *
 * Usage:
 *   pnpm backfill                    # Backfill all symbols, all timeframes (90 days)
 *   pnpm backfill --days=30          # Backfill 30 days
 *   pnpm backfill --symbol=SPY       # Backfill single symbol
 *   pnpm backfill --timeframe=15m    # Backfill single timeframe
 *   pnpm backfill --skip-check       # Skip existing data check (force re-fetch)
 *
 * Features:
 * - Parallel fetching (5 symbols at a time to respect rate limits)
 * - Resume capability (skips already fetched data)
 * - Progress tracking with ETA
 * - Error recovery with exponential backoff
 * - Stores all data in historical_bars table for fast backtesting
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient } from "@supabase/supabase-js";
import { normalizeSymbolForMassive, isIndex } from "../lib/symbolUtils.js";

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY!;

// Timeframes to backfill (all needed for backtesting)
const TIMEFRAMES = [
  { key: "1m", mult: 1, span: "minute" },
  { key: "5m", mult: 5, span: "minute" },
  { key: "15m", mult: 15, span: "minute" },
  { key: "1h", mult: 1, span: "hour" },
  { key: "4h", mult: 4, span: "hour" },
  { key: "day", mult: 1, span: "day" },
];

const CONCURRENCY_LIMIT = 5; // Max parallel API calls
const RETRY_LIMIT = 3; // Max retries per failed request
const RATE_LIMIT_DELAY = 1000; // 1 second between batches

// ============================================================================
// Command Line Arguments
// ============================================================================

const args = process.argv.slice(2);
const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1];
const symbolArg = args.find((a) => a.startsWith("--symbol="))?.split("=")[1];
const timeframeArg = args.find((a) => a.startsWith("--timeframe="))?.split("=")[1];
const skipCheck = args.includes("--skip-check");

const DAYS_TO_BACKFILL = daysArg ? parseInt(daysArg) : 90;

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

function getTodayDate(): string {
  return formatDate(new Date());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch bars from Massive.com API
 */
async function fetchBarsFromMassive(
  symbol: string,
  mult: number,
  span: string,
  from: string,
  to: string,
  retries = 0
): Promise<any[]> {
  const normalizedSymbol = normalizeSymbolForMassive(symbol);
  const url = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(
    normalizedSymbol
  )}/range/${mult}/${span}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${MASSIVE_API_KEY}`,
      },
    });

    if (!response.ok) {
      if (response.status === 429 && retries < RETRY_LIMIT) {
        // Rate limited - wait and retry with exponential backoff
        const backoffMs = Math.pow(2, retries) * 2000; // 2s, 4s, 8s
        console.warn(
          `[Backfill] ⚠️ Rate limited for ${symbol}, retrying in ${backoffMs / 1000}s...`
        );
        await delay(backoffMs);
        return fetchBarsFromMassive(symbol, mult, span, from, to, retries + 1);
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (error) {
    if (retries < RETRY_LIMIT) {
      const backoffMs = Math.pow(2, retries) * 2000;
      console.warn(`[Backfill] ⚠️ Error fetching ${symbol}, retrying in ${backoffMs / 1000}s...`);
      await delay(backoffMs);
      return fetchBarsFromMassive(symbol, mult, span, from, to, retries + 1);
    }

    console.error(`[Backfill] ❌ Failed to fetch ${symbol} after ${retries} retries:`, error);
    return [];
  }
}

/**
 * Check if data already exists in database
 */
async function checkExistingData(
  supabase: any,
  symbol: string,
  timeframe: string,
  from: string,
  to: string
): Promise<boolean> {
  if (skipCheck) {
    return false; // Force re-fetch
  }

  try {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime() + 86400000 - 1; // End of day

    const { data, error } = await supabase
      .from("historical_bars")
      .select("timestamp")
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .gte("timestamp", fromMs)
      .lte("timestamp", toMs)
      .limit(1);

    if (error) {
      console.warn(`[Backfill] Error checking existing data for ${symbol}:`, error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.warn(`[Backfill] Exception checking existing data:`, error);
    return false;
  }
}

/**
 * Store bars in historical_bars table
 */
async function storeBars(
  supabase: any,
  symbol: string,
  timeframe: string,
  bars: any[]
): Promise<boolean> {
  if (bars.length === 0) {
    return false;
  }

  try {
    const rows = bars.map((bar) => ({
      symbol,
      timeframe,
      timestamp: bar.t,
      open: Number(bar.o),
      high: Number(bar.h),
      low: Number(bar.l),
      close: Number(bar.c),
      volume: Number(bar.v || 0),
      vwap: bar.vw || null,
      trades: bar.n || null,
    }));

    const { error } = await supabase.from("historical_bars").upsert(rows, {
      onConflict: "symbol,timeframe,timestamp",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`[Backfill] ❌ Error storing bars for ${symbol}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Backfill] ❌ Exception storing bars:`, error);
    return false;
  }
}

/**
 * Backfill single symbol-timeframe combination
 */
async function backfillSymbolTimeframe(
  supabase: any,
  symbol: string,
  timeframe: { key: string; mult: number; span: string },
  from: string,
  to: string
): Promise<{ success: boolean; bars: number; skipped: boolean }> {
  // Check if data already exists
  const exists = await checkExistingData(supabase, symbol, timeframe.key, from, to);

  if (exists) {
    return { success: true, bars: 0, skipped: true };
  }

  // Fetch from Massive.com
  const bars = await fetchBarsFromMassive(symbol, timeframe.mult, timeframe.span, from, to);

  if (bars.length === 0) {
    console.warn(`[Backfill] ⚠️ No data returned for ${symbol} ${timeframe.key}`);
    return { success: false, bars: 0, skipped: false };
  }

  // Store in database
  const stored = await storeBars(supabase, symbol, timeframe.key, bars);

  return { success: stored, bars: bars.length, skipped: false };
}

/**
 * Backfill all timeframes for a symbol
 */
async function backfillSymbol(
  supabase: any,
  symbol: string,
  from: string,
  to: string
): Promise<{ total: number; skipped: number; failed: number }> {
  let total = 0;
  let skipped = 0;
  let failed = 0;

  const timeframesToFetch = timeframeArg
    ? TIMEFRAMES.filter((tf) => tf.key === timeframeArg)
    : TIMEFRAMES;

  for (const timeframe of timeframesToFetch) {
    const result = await backfillSymbolTimeframe(supabase, symbol, timeframe, from, to);

    if (result.skipped) {
      skipped++;
      console.log(`[Backfill] ⏭️  ${symbol} ${timeframe.key} - Already exists, skipping`);
    } else if (result.success) {
      total += result.bars;
      console.log(`[Backfill] ✅ ${symbol} ${timeframe.key} - Stored ${result.bars} bars`);
    } else {
      failed++;
      console.error(`[Backfill] ❌ ${symbol} ${timeframe.key} - Failed`);
    }

    // Small delay between timeframes to respect rate limits
    await delay(200);
  }

  return { total, skipped, failed };
}

/**
 * Process symbols in parallel batches
 */
async function backfillBatch(
  supabase: any,
  symbols: string[],
  from: string,
  to: string,
  batchIndex: number,
  totalBatches: number
): Promise<{ total: number; skipped: number; failed: number }> {
  const startTime = Date.now();

  const results = await Promise.allSettled(
    symbols.map((symbol) => backfillSymbol(supabase, symbol, from, to))
  );

  const stats = results.reduce(
    (acc, result) => {
      if (result.status === "fulfilled") {
        acc.total += result.value.total;
        acc.skipped += result.value.skipped;
        acc.failed += result.value.failed;
      } else {
        acc.failed += TIMEFRAMES.length; // All timeframes failed for this symbol
      }
      return acc;
    },
    { total: 0, skipped: 0, failed: 0 }
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgPerSymbol = (Date.now() - startTime) / symbols.length / 1000;
  const remainingBatches = totalBatches - batchIndex - 1;
  const etaSeconds = Math.round(remainingBatches * avgPerSymbol * CONCURRENCY_LIMIT);
  const etaMinutes = Math.floor(etaSeconds / 60);

  console.log(
    `[Backfill] 📊 Batch ${batchIndex + 1}/${totalBatches} complete (${duration}s) - ETA: ${etaMinutes}m ${etaSeconds % 60}s`
  );

  return stats;
}

/**
 * Main backfill function
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║         Historical Data Backfill - Phase 2                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MASSIVE_API_KEY) {
    console.error("❌ Missing required environment variables");
    console.error("   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MASSIVE_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Date range
  const from = getDateNDaysAgo(DAYS_TO_BACKFILL);
  const to = getTodayDate();

  console.log(`Date Range: ${from} to ${to} (${DAYS_TO_BACKFILL} days)`);
  console.log(`Timeframes: ${TIMEFRAMES.map((tf) => tf.key).join(", ")}`);
  console.log(`Concurrency: ${CONCURRENCY_LIMIT} symbols in parallel`);
  console.log(`Rate Limit Delay: ${RATE_LIMIT_DELAY}ms between batches\n`);

  // Fetch watchlist symbols
  console.log("[Backfill] 🔄 Fetching watchlist symbols...");
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select("symbol");

  if (watchlistError) {
    console.error("❌ Error fetching watchlist:", watchlistError);
    process.exit(1);
  }

  let symbols = [...new Set((watchlistData || []).map((row: any) => row.symbol))];

  // Filter by symbol if specified
  if (symbolArg) {
    symbols = symbols.filter((s) => s === symbolArg.toUpperCase());
    if (symbols.length === 0) {
      console.error(`❌ Symbol ${symbolArg} not found in watchlist`);
      process.exit(1);
    }
  }

  const indexSymbols = symbols.filter((s) => isIndex(s));
  const equitySymbols = symbols.filter((s) => !isIndex(s));

  console.log(`[Backfill] ✅ Found ${symbols.length} symbols to backfill`);
  console.log(`   Indices: ${indexSymbols.join(", ")}`);
  console.log(`   Equities: ${equitySymbols.join(", ")}\n`);

  // Calculate total tasks
  const timeframeCount = timeframeArg ? 1 : TIMEFRAMES.length;
  const totalTasks = symbols.length * timeframeCount;
  console.log(
    `[Backfill] Total tasks: ${totalTasks} (${symbols.length} symbols × ${timeframeCount} timeframes)\n`
  );

  // Process in batches
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += CONCURRENCY_LIMIT) {
    batches.push(symbols.slice(i, i + CONCURRENCY_LIMIT));
  }

  console.log(`[Backfill] Processing ${batches.length} batches...\n`);

  const overallStart = Date.now();
  let totalBars = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (let i = 0; i < batches.length; i++) {
    const stats = await backfillBatch(supabase, batches[i], from, to, i, batches.length);
    totalBars += stats.total;
    totalSkipped += stats.skipped;
    totalFailed += stats.failed;

    // Delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await delay(RATE_LIMIT_DELAY);
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000 / 60).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Backfill Complete!");
  console.log("=".repeat(60));
  console.log(`Duration: ${overallDuration} minutes`);
  console.log(`Symbols Processed: ${symbols.length}`);
  console.log(`Total Bars Stored: ${totalBars.toLocaleString()}`);
  console.log(`Tasks Skipped (already exists): ${totalSkipped}`);
  console.log(`Tasks Failed: ${totalFailed}`);
  console.log("=".repeat(60) + "\n");

  if (totalFailed > 0) {
    console.warn("⚠️ Some tasks failed. Re-run the script to retry failed tasks.");
  } else {
    console.log("✅ All tasks completed successfully!");
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Verify data: SELECT COUNT(*) FROM historical_bars;");
  console.log("   2. Run backtests: pnpm backtest");
  console.log("   3. Optimize strategies: pnpm optimize\n");

  process.exit(0);
}

// Run the backfill
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
