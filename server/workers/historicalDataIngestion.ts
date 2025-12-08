/**
 * Historical Data Ingestion Worker
 * Phase 1: Enhanced Strategy Engine
 *
 * Orchestrates ingestion of historical options and indices data from Massive.com:
 * - Historical Greeks (every 15 minutes)
 * - Options flow tracking (real-time)
 * - IV percentile calculations (daily)
 * - Gamma exposure snapshots (every 15 minutes)
 * - Market regime tracking (daily)
 *
 * Run this worker alongside compositeScanner for complete data coverage
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getOptionChain, getIndicesSnapshot } from "../massive/client.js";
import { isIndex } from "../lib/symbolUtils.js";
import { ingestHistoricalGreeks, GreeksIngestionResult } from "./ingestion/greeksIngestion.js";
import { ingestOptionsFlow, FlowIngestionResult } from "./ingestion/flowIngestion.js";
import { calculateIVPercentile, IVPercentileResult } from "./ingestion/ivPercentileCalculation.js";
import { snapshotGammaExposure, GammaSnapshotResult } from "./ingestion/gammaExposureSnapshot.js";
import { calculateMarketRegime, MarketRegimeResult } from "./ingestion/marketRegimeCalculation.js";

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
// Allow using anon key if service role key is not available (for development)
// In production, you should use SUPABASE_SERVICE_ROLE_KEY for workers
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

// Singleton Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient!;
}

const INGESTION_INTERVALS = {
  greeks: 15 * 60 * 1000, // 15 minutes
  flow: 60 * 1000, // 1 minute (real-time)
  ivPercentile: 24 * 60 * 60 * 1000, // Daily at market close
  gamma: 15 * 60 * 1000, // 15 minutes
  regime: 24 * 60 * 60 * 1000, // Daily at market close
  watchlistRefresh: 15 * 60 * 1000, // 15 minutes - refresh watchlist to catch new symbols
  queueProcessing: 60 * 1000, // 1 minute - process ingestion queue
};

// Market close time (4:00pm ET = 9:00pm UTC)
const MARKET_CLOSE_HOUR = 21; // UTC
const MARKET_CLOSE_MINUTE = 0;

// ============================================================================
// Main Worker
// ============================================================================

interface WorkerStats {
  startTime: Date;
  cyclesCompleted: number;
  greeksIngestions: number;
  flowIngestions: number;
  ivCalculations: number;
  gammaSnapshots: number;
  regimeCalculations: number;
  watchlistRefreshes: number;
  queueEntriesProcessed: number;
  lastGreeksTime: Date | null;
  lastFlowTime: Date | null;
  lastIVTime: Date | null;
  lastGammaTime: Date | null;
  lastRegimeTime: Date | null;
  lastWatchlistRefresh: Date | null;
  lastQueueProcessing: Date | null;
  errors: number;
  lastError: string | null;
}

class HistoricalDataIngestionWorker {
  private supabase: ReturnType<typeof createClient>;
  private isRunning: boolean = false;
  private stats: WorkerStats;
  private intervals: Record<string, NodeJS.Timeout> = {};

  // Dynamic symbol lists (populated from database)
  private indexSymbols: string[] = [];
  private equitySymbols: string[] = [];

  constructor() {
    console.log("[HistoricalDataIngestion] Environment check:");
    console.log("  VITE_SUPABASE_URL:", SUPABASE_URL ? "✅" : "❌");
    console.log("  SUPABASE_KEY:", SUPABASE_KEY ? "✅" : "❌");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY)"
      );
    }

    this.supabase = getSupabaseClient();

    this.stats = {
      startTime: new Date(),
      cyclesCompleted: 0,
      greeksIngestions: 0,
      flowIngestions: 0,
      ivCalculations: 0,
      gammaSnapshots: 0,
      regimeCalculations: 0,
      watchlistRefreshes: 0,
      queueEntriesProcessed: 0,
      lastGreeksTime: null,
      lastFlowTime: null,
      lastIVTime: null,
      lastGammaTime: null,
      lastRegimeTime: null,
      lastWatchlistRefresh: null,
      lastQueueProcessing: null,
      errors: 0,
      lastError: null,
    };
  }

  /**
   * Fetch all watchlist symbols from database and categorize them
   * Note: Uses RPC function to bypass RLS and get all symbols across all users
   */
  private async refreshWatchlistSymbols(): Promise<void> {
    try {
      console.log("[HistoricalIngestion] 🔄 Refreshing watchlist symbols from database...");

      // Query all distinct symbols from watchlist (bypasses RLS when using service role key)
      // If using anon key, we need to use a stored procedure or get symbols another way
      const { data, error } = await this.supabase.rpc("get_all_watchlist_symbols");

      // Fallback: If RPC function doesn't exist, try direct query (works with service role key)
      let rows: Array<{ symbol: string }> = [];
      if (error && error.message?.includes("function")) {
        console.log("[HistoricalIngestion] RPC function not found, trying direct query...");
        const { data: directData, error: directError } = await this.supabase
          .from("watchlist")
          .select("symbol");

        if (directError) {
          throw directError;
        }
        rows = directData || [];
      } else if (error) {
        throw error;
      } else {
        rows = data || [];
      }

      // Get unique symbols (explicit type to avoid TypeScript inference issues)
      const allSymbols = [...new Set(rows.map((row) => row.symbol))];

      // Categorize into indices vs equities
      this.indexSymbols = allSymbols.filter((symbol) => isIndex(symbol));
      this.equitySymbols = allSymbols.filter((symbol) => !isIndex(symbol));

      this.stats.watchlistRefreshes++;
      this.stats.lastWatchlistRefresh = new Date();

      console.log(
        `[HistoricalIngestion] ✅ Watchlist refreshed: ${allSymbols.length} symbols (${this.indexSymbols.length} indices, ${this.equitySymbols.length} equities)`
      );
      console.log(`[HistoricalIngestion]   Indices: ${this.indexSymbols.join(", ")}`);
      console.log(`[HistoricalIngestion]   Equities: ${this.equitySymbols.join(", ")}`);
    } catch (error) {
      console.error("[HistoricalIngestion] ❌ Error refreshing watchlist:", error);
      this.stats.errors++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);

      // Fallback to SPX/NDX if database fetch fails
      if (this.indexSymbols.length === 0) {
        console.warn("[HistoricalIngestion] ⚠️ Falling back to default indices: SPX, NDX");
        this.indexSymbols = ["SPX", "NDX"];
      }
    }
  }

  /**
   * Process historical ingestion queue (Phase 3)
   * Automatically backfills historical data when new symbols added to watchlist
   */
  private async processIngestionQueue(): Promise<void> {
    try {
      // Get pending queue entries (limit to 5 for rate limiting)
      const { data: queueEntries, error } = await this.supabase
        .from("historical_ingestion_queue")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: true })
        .limit(5);

      if (error) {
        throw error;
      }

      if (!queueEntries || queueEntries.length === 0) {
        // No pending entries - this is normal
        return;
      }

      console.log(
        `[HistoricalIngestion] 📥 Processing queue: ${queueEntries.length} pending symbols`
      );

      for (const entry of queueEntries as any[]) {
        try {
          // Update status to processing
          await (this.supabase.from("historical_ingestion_queue") as any)
            .update({
              status: "processing",
              started_at: new Date().toISOString(),
            })
            .eq("id", entry.id);

          console.log(
            `[HistoricalIngestion] 🔄 Backfilling ${entry.symbol} (${entry.days_to_backfill} days)...`
          );

          // Call backfill logic (imported from backfill script)
          await this.backfillSymbolData(entry.symbol, entry.days_to_backfill || 90);

          // Update status to completed
          await (this.supabase.from("historical_ingestion_queue") as any)
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", entry.id);

          this.stats.queueEntriesProcessed++;
          this.stats.lastQueueProcessing = new Date();

          console.log(`[HistoricalIngestion] ✅ Queue entry completed: ${entry.symbol}`);
        } catch (error) {
          console.error(`[HistoricalIngestion] ❌ Queue entry failed for ${entry.symbol}:`, error);

          // Increment retry count
          const newRetryCount = (entry.retry_count || 0) + 1;
          const maxRetries = 3;

          if (newRetryCount >= maxRetries) {
            // Max retries reached - mark as failed
            await (this.supabase.from("historical_ingestion_queue") as any)
              .update({
                status: "failed",
                completed_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : String(error),
                retry_count: newRetryCount,
              })
              .eq("id", entry.id);

            console.warn(
              `[HistoricalIngestion] ⚠️ Max retries reached for ${entry.symbol}, marked as failed`
            );
          } else {
            // Reset to pending for retry
            await (this.supabase.from("historical_ingestion_queue") as any)
              .update({
                status: "pending",
                retry_count: newRetryCount,
                error_message: error instanceof Error ? error.message : String(error),
              })
              .eq("id", entry.id);

            console.log(
              `[HistoricalIngestion] 🔄 Retrying ${entry.symbol} (attempt ${newRetryCount}/${maxRetries})`
            );
          }

          this.stats.errors++;
        }

        // Small delay between queue entries
        await this.sleep(1000);
      }
    } catch (error) {
      console.error("[HistoricalIngestion] ❌ Error processing queue:", error);
      this.stats.errors++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Backfill historical data for a single symbol (all timeframes)
   * Uses same logic as backfill script but integrated into worker
   */
  private async backfillSymbolData(symbol: string, days: number): Promise<void> {
    const TIMEFRAMES = [
      { key: "1m", mult: 1, span: "minute" },
      { key: "5m", mult: 5, span: "minute" },
      { key: "15m", mult: 15, span: "minute" },
      { key: "1h", mult: 1, span: "hour" },
      { key: "4h", mult: 4, span: "hour" },
      { key: "day", mult: 1, span: "day" },
    ];

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    const from = fromDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const to = toDate.toISOString().split("T")[0];

    for (const tf of TIMEFRAMES) {
      try {
        // Check if data already exists
        const { data: existing } = await this.supabase
          .from("historical_bars")
          .select("timestamp")
          .eq("symbol", symbol)
          .eq("timeframe", tf.key)
          .gte("timestamp", fromDate.getTime())
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[HistoricalIngestion]   ⏭️  ${symbol} ${tf.key} - Already exists, skipping`);
          continue;
        }

        // Fetch from Massive.com
        const bars = await this.fetchBarsFromMassive(symbol, tf.mult, tf.span, from, to);

        if (bars.length === 0) {
          console.warn(`[HistoricalIngestion]   ⚠️ No data for ${symbol} ${tf.key}`);
          continue;
        }

        // Transform and store in database
        const rows = bars.map((bar: any) => ({
          symbol,
          timeframe: tf.key,
          timestamp: bar.t,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          vwap: bar.vw || null,
          trades: bar.n || null,
        }));

        const { error } = await this.supabase.from("historical_bars").upsert(rows as any, {
          onConflict: "symbol,timeframe,timestamp",
        });

        if (error) {
          throw error;
        }

        console.log(`[HistoricalIngestion]   ✅ ${symbol} ${tf.key} - Stored ${bars.length} bars`);
      } catch (error) {
        console.error(`[HistoricalIngestion]   ❌ ${symbol} ${tf.key} - Failed:`, error);
        throw error; // Propagate error to retry logic
      }

      // Small delay between timeframes
      await this.sleep(500);
    }
  }

  /**
   * Fetch bars from Massive.com with retry logic
   */
  private async fetchBarsFromMassive(
    symbol: string,
    mult: number,
    span: string,
    from: string,
    to: string,
    retries = 0
  ): Promise<any[]> {
    const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY!;
    const MAX_RETRIES = 3;

    // Import symbol normalization
    const { normalizeSymbolForMassive } = await import("../lib/symbolUtils.js");
    const normalizedSymbol = normalizeSymbolForMassive(symbol);

    const isIndexSymbol = normalizedSymbol.startsWith("I:");
    const endpoint = isIndexSymbol ? "v2/aggs/ticker" : "v2/aggs/ticker";

    const url = `https://api.massive.com/${endpoint}/${encodeURIComponent(
      normalizedSymbol
    )}/range/${mult}/${span}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${MASSIVE_API_KEY}`,
        },
      });

      if (!response.ok) {
        if (response.status === 429 && retries < MAX_RETRIES) {
          // Rate limited - exponential backoff
          const backoffMs = Math.pow(2, retries) * 2000; // 2s, 4s, 8s
          console.warn(
            `[HistoricalIngestion]   ⚠️ Rate limited for ${symbol}, retrying in ${backoffMs / 1000}s...`
          );
          await this.sleep(backoffMs);
          return this.fetchBarsFromMassive(symbol, mult, span, from, to, retries + 1);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return json.results || [];
    } catch (error) {
      if (retries < MAX_RETRIES) {
        const backoffMs = Math.pow(2, retries) * 2000;
        await this.sleep(backoffMs);
        return this.fetchBarsFromMassive(symbol, mult, span, from, to, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Start the ingestion worker
   */
  async start() {
    if (this.isRunning) {
      console.warn("[HistoricalIngestion] Worker already running");
      return;
    }

    this.isRunning = true;
    console.log("[HistoricalIngestion] 🚀 Starting worker...");

    // Fetch watchlist symbols from database
    await this.refreshWatchlistSymbols();

    // Run initial ingestion immediately
    await this.runFullIngestionCycle();

    // Schedule periodic ingestion tasks
    this.scheduleIngestionTasks();

    console.log("[HistoricalIngestion] ✅ Worker started successfully");
    this.printStats();

    // Keep process alive
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }

  /**
   * Stop the worker
   */
  stop() {
    console.log("[HistoricalIngestion] 🛑 Stopping worker...");
    this.isRunning = false;

    // Clear all intervals
    Object.values(this.intervals).forEach((interval) => clearInterval(interval));

    this.printStats();
    process.exit(0);
  }

  /**
   * Schedule periodic ingestion tasks
   */
  private scheduleIngestionTasks() {
    // Watchlist refresh - every 15 minutes (catch new symbols)
    this.intervals.watchlist = setInterval(
      () => this.refreshWatchlistSymbols(),
      INGESTION_INTERVALS.watchlistRefresh
    );

    // Queue processing - every 1 minute (Phase 3: auto-backfill new symbols)
    this.intervals.queue = setInterval(
      () => this.processIngestionQueue(),
      INGESTION_INTERVALS.queueProcessing
    );

    // Greeks ingestion - every 15 minutes
    this.intervals.greeks = setInterval(
      () => this.ingestGreeksForAllSymbols(),
      INGESTION_INTERVALS.greeks
    );

    // Options flow - every 1 minute
    this.intervals.flow = setInterval(
      () => this.ingestFlowForAllSymbols(),
      INGESTION_INTERVALS.flow
    );

    // Gamma exposure - every 15 minutes
    this.intervals.gamma = setInterval(
      () => this.snapshotGammaForAllSymbols(),
      INGESTION_INTERVALS.gamma
    );

    // IV percentile & market regime - check every 5 minutes to catch the 10-minute market close window
    this.intervals.daily = setInterval(
      () => this.checkAndRunDailyTasks(),
      5 * 60 * 1000 // Every 5 minutes
    );
  }

  /**
   * Run full ingestion cycle (all tasks)
   */
  private async runFullIngestionCycle() {
    console.log("[HistoricalIngestion] 🔄 Running full ingestion cycle...");

    try {
      await Promise.allSettled([
        this.ingestGreeksForAllSymbols(),
        this.ingestFlowForAllSymbols(),
        this.snapshotGammaForAllSymbols(),
      ]);

      // Check if we should run daily tasks
      await this.checkAndRunDailyTasks();

      this.stats.cyclesCompleted++;
    } catch (error) {
      console.error("[HistoricalIngestion] Error in full cycle:", error);
      this.stats.errors++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Ingest historical Greeks for all symbols
   */
  private async ingestGreeksForAllSymbols() {
    const allSymbols = [...this.indexSymbols, ...this.equitySymbols];

    for (const symbol of allSymbols) {
      try {
        const result = await ingestHistoricalGreeks(this.supabase, symbol);

        if (result.success) {
          this.stats.greeksIngestions++;
          this.stats.lastGreeksTime = new Date();
          console.log(
            `[HistoricalIngestion] ✅ Greeks ingested for ${symbol}: ${result.contractsProcessed} contracts`
          );
        } else {
          console.warn(
            `[HistoricalIngestion] ⚠️ Greeks ingestion failed for ${symbol}:`,
            result.error
          );
          this.stats.errors++;
        }
      } catch (error) {
        console.error(`[HistoricalIngestion] Error ingesting Greeks for ${symbol}:`, error);
        this.stats.errors++;
      }

      // Small delay between symbols to respect rate limits
      await this.sleep(500);
    }
  }

  /**
   * Ingest options flow for all symbols
   */
  private async ingestFlowForAllSymbols() {
    const allSymbols = [...this.indexSymbols, ...this.equitySymbols];

    for (const symbol of allSymbols) {
      try {
        const result = await ingestOptionsFlow(this.supabase, symbol);

        if (result.success) {
          this.stats.flowIngestions++;
          this.stats.lastFlowTime = new Date();

          if (result.tradesProcessed > 0) {
            console.log(
              `[HistoricalIngestion] ✅ Flow ingested for ${symbol}: ${result.tradesProcessed} trades (${result.sweepsDetected} sweeps)`
            );
          }
        } else {
          console.warn(
            `[HistoricalIngestion] ⚠️ Flow ingestion failed for ${symbol}:`,
            result.error
          );
          this.stats.errors++;
        }
      } catch (error) {
        console.error(`[HistoricalIngestion] Error ingesting flow for ${symbol}:`, error);
        this.stats.errors++;
      }

      await this.sleep(500);
    }
  }

  /**
   * Snapshot gamma exposure for all symbols
   */
  private async snapshotGammaForAllSymbols() {
    const allSymbols = [...this.indexSymbols, ...this.equitySymbols];

    for (const symbol of allSymbols) {
      try {
        const result = await snapshotGammaExposure(this.supabase, symbol);

        if (result.success) {
          this.stats.gammaSnapshots++;
          this.stats.lastGammaTime = new Date();
          console.log(
            `[HistoricalIngestion] ✅ Gamma snapshot for ${symbol}: ${result.dealerPositioning} (${result.contractsAnalyzed} contracts)`
          );
        } else {
          console.warn(
            `[HistoricalIngestion] ⚠️ Gamma snapshot failed for ${symbol}:`,
            result.error
          );
          this.stats.errors++;
        }
      } catch (error) {
        console.error(`[HistoricalIngestion] Error snapshotting gamma for ${symbol}:`, error);
        this.stats.errors++;
      }

      await this.sleep(500);
    }
  }

  /**
   * Check if market just closed and run daily tasks
   */
  private async checkAndRunDailyTasks() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // Check if it's within 10 minutes after market close
    const isMarketCloseWindow =
      utcHour === MARKET_CLOSE_HOUR &&
      utcMinute >= MARKET_CLOSE_MINUTE &&
      utcMinute < MARKET_CLOSE_MINUTE + 10;

    if (!isMarketCloseWindow) {
      return;
    }

    // Check if we already ran today
    if (this.stats.lastIVTime && this.isSameDay(this.stats.lastIVTime, now)) {
      return; // Already ran today
    }

    console.log("[HistoricalIngestion] 📊 Running daily tasks (market just closed)...");

    await Promise.allSettled([
      this.calculateIVPercentilesForAllSymbols(),
      this.calculateMarketRegime(),
    ]);
  }

  /**
   * Calculate IV percentiles for all symbols
   */
  private async calculateIVPercentilesForAllSymbols() {
    const allSymbols = [...this.indexSymbols, ...this.equitySymbols];

    for (const symbol of allSymbols) {
      try {
        const result = await calculateIVPercentile(this.supabase, symbol);

        if (result.success) {
          this.stats.ivCalculations++;
          this.stats.lastIVTime = new Date();
          console.log(
            `[HistoricalIngestion] ✅ IV percentile calculated for ${symbol}: ${result.ivPercentile}% (${result.ivRegime})`
          );
        } else {
          console.warn(
            `[HistoricalIngestion] ⚠️ IV calculation failed for ${symbol}:`,
            result.error
          );
          this.stats.errors++;
        }
      } catch (error) {
        console.error(`[HistoricalIngestion] Error calculating IV for ${symbol}:`, error);
        this.stats.errors++;
      }

      await this.sleep(500);
    }
  }

  /**
   * Calculate overall market regime
   */
  private async calculateMarketRegime() {
    try {
      const result = await calculateMarketRegime(this.supabase);

      if (result.success) {
        this.stats.regimeCalculations++;
        this.stats.lastRegimeTime = new Date();
        console.log(
          `[HistoricalIngestion] ✅ Market regime calculated: ${result.marketRegime} (VIX: ${result.vixLevel}, Breadth: ${result.breadthRegime})`
        );
      } else {
        console.warn(`[HistoricalIngestion] ⚠️ Regime calculation failed:`, result.error);
        this.stats.errors++;
      }
    } catch (error) {
      console.error(`[HistoricalIngestion] Error calculating market regime:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Print worker statistics
   */
  private printStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const uptimeMinutes = Math.floor(uptime / 60000);
    const totalSymbols = this.indexSymbols.length + this.equitySymbols.length;

    console.log("\n" + "=".repeat(60));
    console.log("📊 Historical Data Ingestion Worker Stats");
    console.log("=".repeat(60));
    console.log(`Uptime: ${uptimeMinutes} minutes`);
    console.log(
      `Watchlist Symbols: ${totalSymbols} (${this.indexSymbols.length} indices, ${this.equitySymbols.length} equities)`
    );
    console.log(`Watchlist Refreshes: ${this.stats.watchlistRefreshes}`);
    console.log(`Queue Entries Processed: ${this.stats.queueEntriesProcessed}`);
    console.log(`Cycles Completed: ${this.stats.cyclesCompleted}`);
    console.log(`Greeks Ingestions: ${this.stats.greeksIngestions}`);
    console.log(`Flow Ingestions: ${this.stats.flowIngestions}`);
    console.log(`IV Calculations: ${this.stats.ivCalculations}`);
    console.log(`Gamma Snapshots: ${this.stats.gammaSnapshots}`);
    console.log(`Regime Calculations: ${this.stats.regimeCalculations}`);
    console.log(`Errors: ${this.stats.errors}`);

    if (this.stats.lastWatchlistRefresh) {
      console.log(`Last Watchlist Refresh: ${this.stats.lastWatchlistRefresh.toLocaleString()}`);
    }
    if (this.stats.lastQueueProcessing) {
      console.log(`Last Queue Processing: ${this.stats.lastQueueProcessing.toLocaleString()}`);
    }
    if (this.stats.lastGreeksTime) {
      console.log(`Last Greeks: ${this.stats.lastGreeksTime.toLocaleString()}`);
    }
    if (this.stats.lastFlowTime) {
      console.log(`Last Flow: ${this.stats.lastFlowTime.toLocaleString()}`);
    }
    if (this.stats.lastGammaTime) {
      console.log(`Last Gamma: ${this.stats.lastGammaTime.toLocaleString()}`);
    }
    if (this.stats.lastIVTime) {
      console.log(`Last IV: ${this.stats.lastIVTime.toLocaleString()}`);
    }
    if (this.stats.lastRegimeTime) {
      console.log(`Last Regime: ${this.stats.lastRegimeTime.toLocaleString()}`);
    }

    if (this.stats.lastError) {
      console.log(`Last Error: ${this.stats.lastError}`);
    }

    console.log("=".repeat(60) + "\n");
  }

  /**
   * Utility: Sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Utility: Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log("🚀 Starting Historical Data Ingestion Worker");
  console.log("Environment:", process.env.NODE_ENV || "development");

  const worker = new HistoricalDataIngestionWorker();
  await worker.start();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { HistoricalDataIngestionWorker };
