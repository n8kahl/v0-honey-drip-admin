/**
 * Flat File Parser
 * Phase 3 Enhancement: Parse Massive.com CSV flat files
 *
 * Parses downloaded flat files and prepares data for bulk database insertion.
 * Handles both indices and options minute aggregate formats.
 */

import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";

// Environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[FlatFileParser] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Batch size for bulk inserts
const BATCH_SIZE = 10000;

export interface ParseConfig {
  filePath: string;
  dataset: "indices" | "options";
  symbols?: string[]; // Filter for specific symbols
  timeframe?: string; // Default: '1m'
}

export interface ParseStats {
  rowsParsed: number;
  rowsInserted: number;
  rowsSkipped: number;
  errors: number;
  duration: number;
}

/**
 * Massive.com indices minute aggregate CSV format
 */
interface IndicesRow {
  timestamp: string; // ISO 8601 or epoch
  ticker: string; // 'I:SPX', 'I:NDX', 'I:VIX'
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string; // May not be present for indices
}

/**
 * Massive.com options minute aggregate CSV format
 */
interface OptionsRow {
  timestamp: string;
  ticker: string; // 'O:SPY251121C00650000'
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  vwap?: string;
  transactions?: string; // Number of trades
}

/**
 * Database row format
 */
interface BarRow {
  symbol: string;
  timeframe: string;
  timestamp: number; // Epoch milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  vwap?: number;
  trades?: number;
}

/**
 * Main parser class
 */
export class FlatFileParser {
  /**
   * Parse a flat file and insert into database
   */
  async parseAndInsert(config: ParseConfig): Promise<ParseStats> {
    console.log("[FlatFileParser] 📊 Starting parse...");
    console.log(`[FlatFileParser] File: ${config.filePath}`);
    console.log(`[FlatFileParser] Dataset: ${config.dataset}`);

    const startTime = Date.now();
    const stats: ParseStats = {
      rowsParsed: 0,
      rowsInserted: 0,
      rowsSkipped: 0,
      errors: 0,
      duration: 0,
    };

    const batch: BarRow[] = [];
    const symbols = new Set(config.symbols?.map((s) => this.normalizeSymbol(s)));

    return new Promise((resolve, reject) => {
      const stream = createReadStream(config.filePath);
      const parser = parse({
        columns: true, // First row is header
        skip_empty_lines: true,
        trim: true,
      });

      stream
        .pipe(parser)
        .on("data", async (row: IndicesRow | OptionsRow) => {
          try {
            stats.rowsParsed++;

            // Parse row based on dataset type
            const barRow = this.parseRow(row, config.dataset, config.timeframe || "1m");

            // Filter by symbols if specified
            if (symbols.size > 0 && !symbols.has(barRow.symbol)) {
              stats.rowsSkipped++;
              return;
            }

            batch.push(barRow);

            // Bulk insert when batch is full
            if (batch.length >= BATCH_SIZE) {
              parser.pause();
              const inserted = await this.bulkInsert(batch);
              stats.rowsInserted += inserted;
              batch.length = 0; // Clear batch
              parser.resume();
            }
          } catch (error) {
            console.error("[FlatFileParser] Error parsing row:", error);
            stats.errors++;
          }
        })
        .on("end", async () => {
          // Insert remaining batch
          if (batch.length > 0) {
            const inserted = await this.bulkInsert(batch);
            stats.rowsInserted += inserted;
          }

          stats.duration = Date.now() - startTime;
          this.printSummary(stats);
          resolve(stats);
        })
        .on("error", (error) => {
          console.error("[FlatFileParser] Stream error:", error);
          stats.errors++;
          stats.duration = Date.now() - startTime;
          reject(error);
        });
    });
  }

  /**
   * Parse a CSV row into BarRow format
   */
  private parseRow(row: IndicesRow | OptionsRow, dataset: string, timeframe: string): BarRow {
    // Parse timestamp (handle both ISO 8601 and epoch formats)
    const timestamp = this.parseTimestamp(row.timestamp);

    // Extract symbol
    const symbol = this.extractSymbol(row.ticker, dataset);

    // Parse OHLC
    const open = parseFloat(row.open);
    const high = parseFloat(row.high);
    const low = parseFloat(row.low);
    const close = parseFloat(row.close);

    const barRow: BarRow = {
      symbol,
      timeframe,
      timestamp,
      open,
      high,
      low,
      close,
    };

    // Add optional fields
    if ("volume" in row && row.volume) {
      barRow.volume = parseInt(row.volume, 10);
    }

    if ("vwap" in row && row.vwap) {
      barRow.vwap = parseFloat(row.vwap);
    }

    if ("transactions" in row && row.transactions) {
      barRow.trades = parseInt(row.transactions, 10);
    }

    return barRow;
  }

  /**
   * Parse timestamp to epoch milliseconds
   */
  private parseTimestamp(timestamp: string): number {
    // Try parsing as number first (epoch)
    const epochMs = parseInt(timestamp, 10);
    if (!isNaN(epochMs)) {
      // If less than 13 digits, assume seconds, convert to ms
      return epochMs < 10000000000000 ? epochMs * 1000 : epochMs;
    }

    // Parse as ISO 8601
    return new Date(timestamp).getTime();
  }

  /**
   * Extract clean symbol from ticker
   * 'I:SPX' -> 'SPX'
   * 'O:SPY251121C00650000' -> 'SPY' (underlying)
   */
  private extractSymbol(ticker: string, dataset: string): string {
    if (dataset === "indices") {
      // Format: 'I:SPX' -> 'SPX'
      return ticker.replace(/^I:/, "");
    } else {
      // Format: 'O:SPY251121C00650000' -> 'SPY'
      const match = ticker.match(/^O:([A-Z]+)/);
      return match ? match[1] : ticker;
    }
  }

  /**
   * Normalize symbol for comparison
   */
  private normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/^(I:|O:)/, "");
  }

  /**
   * Bulk insert bars into database
   */
  private async bulkInsert(bars: BarRow[]): Promise<number> {
    if (bars.length === 0) return 0;

    try {
      const { error, count } = await supabase.from("historical_bars").upsert(
        bars.map((bar) => ({
          symbol: bar.symbol,
          timeframe: bar.timeframe,
          timestamp: bar.timestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume || null,
          vwap: bar.vwap || null,
          trades: bar.trades || null,
        })),
        {
          onConflict: "symbol,timeframe,timestamp",
          ignoreDuplicates: true,
        }
      );

      if (error) {
        console.error("[FlatFileParser] Bulk insert error:", error);
        return 0;
      }

      console.log(`[FlatFileParser] ✅ Inserted ${bars.length} bars`);
      return bars.length;
    } catch (error) {
      console.error("[FlatFileParser] Fatal insert error:", error);
      return 0;
    }
  }

  /**
   * Print parse summary
   */
  private printSummary(stats: ParseStats): void {
    console.log("\n[FlatFileParser] ✅ Parse Complete!");
    console.log("==========================================");
    console.log(`Rows Parsed: ${stats.rowsParsed.toLocaleString()}`);
    console.log(`Rows Inserted: ${stats.rowsInserted.toLocaleString()}`);
    console.log(`Rows Skipped: ${stats.rowsSkipped.toLocaleString()}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Duration: ${(stats.duration / 1000).toFixed(1)}s`);
    console.log(`Rate: ${(stats.rowsParsed / (stats.duration / 1000)).toFixed(0)} rows/sec`);
    console.log("==========================================\n");
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const config: ParseConfig = {
    filePath: "",
    dataset: "indices",
  };

  // Parse CLI args
  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      config.filePath = arg.split("=")[1];
    } else if (arg.startsWith("--dataset=")) {
      config.dataset = arg.split("=")[1] as "indices" | "options";
    } else if (arg.startsWith("--symbols=")) {
      config.symbols = arg.split("=")[1].split(",");
    }
  }

  if (!config.filePath) {
    console.error(
      "Usage: tsx FlatFileParser.ts --file=<path> --dataset=<indices|options> [--symbols=SPX,NDX]"
    );
    process.exit(1);
  }

  const parser = new FlatFileParser();
  parser.parseAndInsert(config).catch(console.error);
}
