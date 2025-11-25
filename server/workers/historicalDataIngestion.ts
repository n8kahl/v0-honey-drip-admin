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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const INGESTION_INTERVALS = {
  greeks: 15 * 60 * 1000, // 15 minutes
  flow: 60 * 1000, // 1 minute (real-time)
  ivPercentile: 24 * 60 * 60 * 1000, // Daily at market close
  gamma: 15 * 60 * 1000, // 15 minutes
  regime: 24 * 60 * 60 * 1000, // Daily at market close
  watchlistRefresh: 15 * 60 * 1000, // 15 minutes - refresh watchlist to catch new symbols
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
  lastGreeksTime: Date | null;
  lastFlowTime: Date | null;
  lastIVTime: Date | null;
  lastGammaTime: Date | null;
  lastRegimeTime: Date | null;
  lastWatchlistRefresh: Date | null;
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    this.stats = {
      startTime: new Date(),
      cyclesCompleted: 0,
      greeksIngestions: 0,
      flowIngestions: 0,
      ivCalculations: 0,
      gammaSnapshots: 0,
      regimeCalculations: 0,
      watchlistRefreshes: 0,
      lastGreeksTime: null,
      lastFlowTime: null,
      lastIVTime: null,
      lastGammaTime: null,
      lastRegimeTime: null,
      lastWatchlistRefresh: null,
      errors: 0,
      lastError: null,
    };
  }

  /**
   * Fetch all watchlist symbols from database and categorize them
   */
  private async refreshWatchlistSymbols(): Promise<void> {
    try {
      console.log("[HistoricalIngestion] 🔄 Refreshing watchlist symbols from database...");

      const { data, error } = await this.supabase.from("watchlist").select("symbol");

      if (error) {
        throw error;
      }

      // Get unique symbols
      const allSymbols = [...new Set((data || []).map((row: any) => row.symbol as string))];

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

    // IV percentile & market regime - check every hour if market just closed
    this.intervals.daily = setInterval(
      () => this.checkAndRunDailyTasks(),
      60 * 60 * 1000 // Every hour
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
