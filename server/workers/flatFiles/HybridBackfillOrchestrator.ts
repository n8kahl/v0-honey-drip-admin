/**
 * Hybrid Backfill Orchestrator
 * Phase 3 Enhancement: Intelligent data backfill using flat files + API
 *
 * Strategy:
 * - Historical data (>1 day old): Use flat files (bulk, fast, accurate)
 * - Recent data (<1 day old): Use API (real-time, up-to-date)
 *
 * Usage:
 *   pnpm backfill:hybrid -- --symbols=SPX,NDX --days=90
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { FlatFileDownloader, type DownloadConfig } from "./FlatFileDownloader.js";
import { FlatFileParser, type ParseConfig } from "./FlatFileParser.js";
import { join } from "path";
import { existsSync } from "fs";

export interface HybridBackfillConfig {
  symbols: string[]; // ['SPX', 'NDX']
  days: number; // 90 (lookback period)
  skipDownload?: boolean; // Skip download if files already exist
  skipParse?: boolean; // Skip parse if data already in DB
}

export interface HybridBackfillStats {
  totalSymbols: number;
  totalDays: number;
  flatFileDays: number;
  apiDays: number;
  filesDownloaded: number;
  rowsInserted: number;
  duration: number;
}

/**
 * Main orchestrator for hybrid backfill
 */
export class HybridBackfillOrchestrator {
  private downloader: FlatFileDownloader;
  private parser: FlatFileParser;
  private dataDir: string;

  constructor() {
    this.downloader = new FlatFileDownloader();
    this.parser = new FlatFileParser();
    this.dataDir = join(process.cwd(), "data", "flat-files");
  }

  /**
   * Execute hybrid backfill
   */
  async backfill(config: HybridBackfillConfig): Promise<HybridBackfillStats> {
    console.log("[HybridBackfill] 🚀 Starting hybrid backfill...");
    console.log(`[HybridBackfill] Symbols: ${config.symbols.join(", ")}`);
    console.log(`[HybridBackfill] Lookback: ${config.days} days`);

    const startTime = Date.now();
    const stats: HybridBackfillStats = {
      totalSymbols: config.symbols.length,
      totalDays: config.days,
      flatFileDays: 0,
      apiDays: 0,
      filesDownloaded: 0,
      rowsInserted: 0,
      duration: 0,
    };

    // Calculate date ranges
    const { historicalStart, historicalEnd, recentStart, recentEnd } = this.calculateDateRanges(
      config.days
    );

    console.log("\n[HybridBackfill] 📅 Date Ranges:");
    console.log(`  Historical (flat files): ${historicalStart} to ${historicalEnd}`);
    console.log(`  Recent (API): ${recentStart} to ${recentEnd}`);

    // STEP 1: Download flat files for historical data (>1 day old)
    if (!config.skipDownload) {
      console.log("\n[HybridBackfill] STEP 1: Downloading flat files...");

      // Download indices data
      const indicesDownloadConfig: DownloadConfig = {
        dataset: "indices",
        startDate: historicalStart,
        endDate: historicalEnd,
        symbols: config.symbols,
      };

      const indicesDownloadStats = await this.downloader.download(indicesDownloadConfig);
      stats.filesDownloaded += indicesDownloadStats.filesDownloaded;
      stats.flatFileDays = indicesDownloadStats.filesDownloaded;

      // TODO: Add options flat file download if needed
      // const optionsDownloadConfig: DownloadConfig = { ... };
    } else {
      console.log("\n[HybridBackfill] STEP 1: Skipping download (using existing files)");
    }

    // STEP 2: Parse and insert flat file data
    if (!config.skipParse) {
      console.log("\n[HybridBackfill] STEP 2: Parsing flat files...");

      const files = this.getDownloadedFiles(historicalStart, historicalEnd);
      console.log(`[HybridBackfill] Found ${files.length} files to parse`);

      for (const file of files) {
        try {
          const parseConfig: ParseConfig = {
            filePath: file,
            dataset: "indices",
            symbols: config.symbols,
            timeframe: "1m",
          };

          const parseStats = await this.parser.parseAndInsert(parseConfig);
          stats.rowsInserted += parseStats.rowsInserted;
        } catch (error) {
          console.error(`[HybridBackfill] Error parsing ${file}:`, error);
        }
      }
    } else {
      console.log("\n[HybridBackfill] STEP 2: Skipping parse (data already in DB)");
    }

    // STEP 3: Use existing API backfill for recent data
    console.log("\n[HybridBackfill] STEP 3: Fetching recent data via API...");
    console.log("[HybridBackfill] ℹ️  Use existing API backfill worker for yesterday + today");
    console.log("[HybridBackfill] ℹ️  Command: pnpm backfill:api -- --days=2");
    stats.apiDays = this.calculateDaysBetween(recentStart, recentEnd);

    stats.duration = Date.now() - startTime;
    this.printSummary(stats, config);
    return stats;
  }

  /**
   * Calculate date ranges for hybrid approach
   * - Historical: From (days ago) to (yesterday)
   * - Recent: Yesterday to today
   */
  private calculateDateRanges(days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const historicalStart = new Date(today);
    historicalStart.setDate(historicalStart.getDate() - days);

    return {
      historicalStart: this.formatDate(historicalStart),
      historicalEnd: this.formatDate(yesterday),
      recentStart: this.formatDate(yesterday),
      recentEnd: this.formatDate(today),
    };
  }

  /**
   * Get list of downloaded files for date range
   */
  private getDownloadedFiles(startDate: string, endDate: string): string[] {
    const files: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = this.formatDate(current);
      const filePath = join(this.dataDir, "indices", `${dateStr}.csv`);

      if (existsSync(filePath)) {
        files.push(filePath);
      }

      current.setDate(current.getDate() + 1);
    }

    return files;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Calculate number of days between two dates
   */
  private calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Print backfill summary
   */
  private printSummary(stats: HybridBackfillStats, config: HybridBackfillConfig): void {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║  HYBRID BACKFILL COMPLETE                              ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("\n📊 Summary:");
    console.log(`  Symbols: ${config.symbols.join(", ")}`);
    console.log(`  Total Days: ${stats.totalDays}`);
    console.log("");
    console.log("📥 Data Sources:");
    console.log(`  ├─ Flat Files (historical): ${stats.flatFileDays} days`);
    console.log(`  └─ API (recent): ${stats.apiDays} days`);
    console.log("");
    console.log("💾 Database:");
    console.log(`  Rows Inserted: ${stats.rowsInserted.toLocaleString()}`);
    console.log("");
    console.log("⏱️  Performance:");
    console.log(`  Duration: ${(stats.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`  Rate: ${(stats.rowsInserted / (stats.duration / 1000)).toFixed(0)} rows/sec`);
    console.log("");
    console.log("✅ Next Steps:");
    console.log("  1. Run API backfill for recent data:");
    console.log("     pnpm backfill:api -- --days=2");
    console.log("");
    console.log("  2. Run backtests:");
    console.log("     pnpm backtest");
    console.log("");
    console.log("═══════════════════════════════════════════════════════════\n");
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const config: HybridBackfillConfig = {
    symbols: ["SPX", "NDX"],
    days: 90,
  };

  // Parse CLI args
  for (const arg of args) {
    if (arg.startsWith("--symbols=")) {
      config.symbols = arg.split("=")[1].split(",");
    } else if (arg.startsWith("--days=")) {
      config.days = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--skip-download") {
      config.skipDownload = true;
    } else if (arg === "--skip-parse") {
      config.skipParse = true;
    }
  }

  const orchestrator = new HybridBackfillOrchestrator();
  orchestrator.backfill(config).catch(console.error);
}
