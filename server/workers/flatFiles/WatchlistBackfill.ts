/**
 * Watchlist Backfill Worker
 * Automatically backfills historical data for all symbols in the watchlist
 *
 * Runs as a scheduled worker that:
 * 1. Checks for new watchlist symbols every hour
 * 2. Auto-backfills any symbols without historical data
 * 3. Cleans up old data (>1 year)
 *
 * Usage:
 *   pnpm dev:watchlist       # Development mode (watch)
 *   pnpm start:watchlist     # Production mode
 *   pnpm backfill:watchlist -- --days=90  # Manual run
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HybridBackfillOrchestrator } from "./HybridBackfillOrchestrator.js";

// Environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[WatchlistBackfill] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Singleton Supabase client
let supabaseClient: SupabaseClient<any> | null = null;

function getSupabaseClient(): SupabaseClient<any> {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient!;
}

const supabase = getSupabaseClient();

export interface WatchlistBackfillConfig {
  days: number; // 90 (lookback period)
  force?: boolean; // Re-backfill even if data exists
  limit?: number; // Max symbols to backfill (default: all)
}

export interface WatchlistBackfillStats {
  totalWatchlistSymbols: number;
  symbolsNeedingBackfill: number;
  symbolsBackfilled: number;
  symbolsSkipped: number;
  rowsInserted: number;
  duration: number;
}

/**
 * Main watchlist backfill orchestrator
 */
export class WatchlistBackfill {
  private orchestrator: HybridBackfillOrchestrator;

  constructor() {
    this.orchestrator = new HybridBackfillOrchestrator();
  }

  /**
   * Execute watchlist backfill
   */
  async backfill(config: WatchlistBackfillConfig): Promise<WatchlistBackfillStats> {
    console.log("[WatchlistBackfill] 🚀 Starting watchlist backfill...");
    console.log(`[WatchlistBackfill] Lookback: ${config.days} days`);
    console.log(`[WatchlistBackfill] Force: ${config.force ? "Yes" : "No"}`);

    const startTime = Date.now();
    const stats: WatchlistBackfillStats = {
      totalWatchlistSymbols: 0,
      symbolsNeedingBackfill: 0,
      symbolsBackfilled: 0,
      symbolsSkipped: 0,
      rowsInserted: 0,
      duration: 0,
    };

    try {
      // STEP 1: Get all unique symbols from watchlist
      console.log("\n[WatchlistBackfill] STEP 1: Fetching watchlist symbols...");
      const watchlistSymbols = await this.getWatchlistSymbols(config.limit);

      if (watchlistSymbols.length === 0) {
        console.log("[WatchlistBackfill] ⚠️  No symbols in watchlist. Add some first!");
        stats.duration = Date.now() - startTime;
        return stats;
      }

      stats.totalWatchlistSymbols = watchlistSymbols.length;
      console.log(
        `[WatchlistBackfill] Found ${watchlistSymbols.length} symbols: ${watchlistSymbols.join(", ")}`
      );

      // STEP 2: Check which symbols already have data (unless force=true)
      let symbolsToBackfill: string[] = watchlistSymbols;

      if (!config.force) {
        console.log("\n[WatchlistBackfill] STEP 2: Checking existing data...");
        const symbolsWithData = await this.getSymbolsWithData();
        symbolsToBackfill = watchlistSymbols.filter((s) => !symbolsWithData.has(s));

        stats.symbolsSkipped = watchlistSymbols.length - symbolsToBackfill.length;

        if (symbolsToBackfill.length === 0) {
          console.log("[WatchlistBackfill] ✅ All watchlist symbols already have data!");
          console.log("[WatchlistBackfill] Use --force to re-backfill anyway");
          stats.duration = Date.now() - startTime;
          return stats;
        }

        console.log(`[WatchlistBackfill] Symbols with existing data: ${stats.symbolsSkipped}`);
        console.log(`[WatchlistBackfill] Symbols needing backfill: ${symbolsToBackfill.length}`);
        console.log(`[WatchlistBackfill] Symbols to backfill: ${symbolsToBackfill.join(", ")}`);
      } else {
        console.log("\n[WatchlistBackfill] STEP 2: Skipping data check (force mode)");
      }

      stats.symbolsNeedingBackfill = symbolsToBackfill.length;

      // STEP 3: Run hybrid backfill for symbols needing data
      console.log("\n[WatchlistBackfill] STEP 3: Running hybrid backfill...");

      const backfillStats = await this.orchestrator.backfill({
        symbols: symbolsToBackfill,
        days: config.days,
      });

      stats.symbolsBackfilled = symbolsToBackfill.length;
      stats.rowsInserted = backfillStats.rowsInserted;

      stats.duration = Date.now() - startTime;
      this.printSummary(stats, config);
      return stats;
    } catch (error) {
      console.error("[WatchlistBackfill] Fatal error:", error);
      stats.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Get all unique symbols from watchlist
   */
  private async getWatchlistSymbols(limit?: number): Promise<string[]> {
    try {
      let query = supabase
        .from("watchlist")
        .select("symbol")
        .order("added_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[WatchlistBackfill] Error fetching watchlist:", error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Get unique symbols (in case of duplicates across users)
      const uniqueSymbols = [...new Set(data.map((row) => row.symbol.toUpperCase()))];
      return uniqueSymbols;
    } catch (error) {
      console.error("[WatchlistBackfill] Error querying watchlist:", error);
      return [];
    }
  }

  /**
   * Get set of symbols that already have historical data
   */
  private async getSymbolsWithData(): Promise<Set<string>> {
    try {
      const { data, error } = await supabase
        .from("historical_bars")
        .select("symbol")
        .eq("timeframe", "1m");

      if (error) {
        console.error("[WatchlistBackfill] Error checking existing data:", error);
        return new Set();
      }

      if (!data || data.length === 0) {
        return new Set();
      }

      return new Set(data.map((row) => row.symbol.toUpperCase()));
    } catch (error) {
      console.error("[WatchlistBackfill] Error querying historical_bars:", error);
      return new Set();
    }
  }

  /**
   * Print backfill summary
   */
  private printSummary(stats: WatchlistBackfillStats, config: WatchlistBackfillConfig): void {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║  WATCHLIST BACKFILL COMPLETE                           ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("\n📊 Summary:");
    console.log(`  Watchlist Symbols: ${stats.totalWatchlistSymbols}`);
    console.log(`  Symbols Skipped (already have data): ${stats.symbolsSkipped}`);
    console.log(`  Symbols Backfilled: ${stats.symbolsBackfilled}`);
    console.log("");
    console.log("💾 Database:");
    console.log(`  Rows Inserted: ${stats.rowsInserted.toLocaleString()}`);
    console.log("");
    console.log("⏱️  Performance:");
    console.log(`  Duration: ${(stats.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log("");
    console.log("✅ Next Steps:");
    console.log("  1. Add more symbols to watchlist to automatically include them");
    console.log("  2. Run daily: pnpm backfill:api -- --days=1");
    console.log("  3. Run backtests: pnpm backtest");
    console.log("");
    console.log("═══════════════════════════════════════════════════════════\n");
  }
}

/**
 * Run database cleanup (delete data >1 year old)
 */
async function runCleanup(): Promise<void> {
  console.log("[WatchlistBackfill] 🧹 Running database cleanup...");

  try {
    const { error } = await supabase.rpc("cleanup_old_historical_bars");

    if (error) {
      console.error("[WatchlistBackfill] Cleanup error:", error);
      return;
    }

    console.log("[WatchlistBackfill] ✅ Cleanup complete");
  } catch (error) {
    console.error("[WatchlistBackfill] Cleanup failed:", error);
  }
}

/**
 * Scheduled worker loop
 */
async function runScheduledWorker(): Promise<void> {
  console.log("🚀 Starting Watchlist Backfill Worker");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Check interval: 1 hour`);
  console.log(`Cleanup interval: Daily at 2am`);

  const backfill = new WatchlistBackfill();
  let cyclesCompleted = 0;

  // Run immediately on startup
  await runCycle();

  // Then run every hour
  setInterval(runCycle, 60 * 60 * 1000); // 1 hour

  // Cleanup daily at 2am
  scheduleDaily2AMCleanup();

  async function runCycle() {
    cyclesCompleted++;
    console.log(`\n[WatchlistBackfill] 🔄 Starting cycle #${cyclesCompleted}...`);

    try {
      const stats = await backfill.backfill({
        days: 90,
        force: false,
      });

      // Log summary
      console.log(`[WatchlistBackfill] Cycle #${cyclesCompleted} complete:`);
      console.log(`  Symbols checked: ${stats.totalWatchlistSymbols}`);
      console.log(`  Symbols backfilled: ${stats.symbolsBackfilled}`);
      console.log(`  Rows inserted: ${stats.rowsInserted.toLocaleString()}`);
    } catch (error) {
      console.error(`[WatchlistBackfill] Cycle #${cyclesCompleted} failed:`, error);
    }
  }

  function scheduleDaily2AMCleanup() {
    // Calculate time until next 2am
    const now = new Date();
    const next2AM = new Date();
    next2AM.setHours(2, 0, 0, 0);

    if (now.getHours() >= 2) {
      // If past 2am today, schedule for tomorrow
      next2AM.setDate(next2AM.getDate() + 1);
    }

    const msUntil2AM = next2AM.getTime() - now.getTime();

    setTimeout(() => {
      runCleanup();
      // Then repeat daily
      setInterval(runCleanup, 24 * 60 * 60 * 1000);
    }, msUntil2AM);

    console.log(`[WatchlistBackfill] Cleanup scheduled for ${next2AM.toLocaleString()}`);
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  // Check if running as scheduled worker
  if (args.includes("--worker")) {
    runScheduledWorker();
  } else {
    // Manual one-time run
    const config: WatchlistBackfillConfig = {
      days: 90,
    };

    // Parse CLI args
    for (const arg of args) {
      if (arg.startsWith("--days=")) {
        config.days = parseInt(arg.split("=")[1], 10);
      } else if (arg === "--force") {
        config.force = true;
      } else if (arg.startsWith("--limit=")) {
        config.limit = parseInt(arg.split("=")[1], 10);
      }
    }

    const backfill = new WatchlistBackfill();
    backfill.backfill(config).catch(console.error);
  }
}
