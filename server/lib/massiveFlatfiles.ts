/**
 * Massive.com S3 Flatfiles Integration
 *
 * Downloads and parses historical OHLCV data from Massive.com's S3 buckets.
 * Much faster than REST API for bulk historical data downloads.
 *
 * S3 Buckets:
 * - Indices: s3://flatfiles/us_indices/minute_aggs_v1/
 * - Equities: s3://flatfiles/us_stocks_sip/minute_aggs_v1/
 * - Options: s3://flatfiles/us_options_opra/minute_aggs_v1/
 *
 * File Format: CSV.GZ (gzipped CSV)
 * Path: {bucket}/{year}/{month}/{date}.csv.gz
 * Example: us_indices/minute_aggs_v1/2025/11/2025-11-21.csv.gz
 *
 * Required Environment Variables:
 * - MASSIVE_AWS_ACCESS_KEY: S3 access key from Massive.com
 * - MASSIVE_AWS_SECRET_KEY: S3 secret key from Massive.com
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { parse } from "csv-parse";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// S3 Configuration - Use environment variables
const S3_ENDPOINT = "https://files.massive.com";
const S3_ACCESS_KEY = process.env.MASSIVE_AWS_ACCESS_KEY || "";
const S3_SECRET_KEY = process.env.MASSIVE_AWS_SECRET_KEY || "";
const S3_BUCKET = "flatfiles";

// Validate credentials
if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
  console.warn(
    "[MassiveFlatfiles] ⚠️ Missing MASSIVE_AWS_ACCESS_KEY or MASSIVE_AWS_SECRET_KEY environment variables"
  );
  console.warn("[MassiveFlatfiles] S3 flatfile downloads will fail. Set these in .env.local");
}

// S3 Paths by asset type
const S3_PATHS = {
  indices: "us_indices/minute_aggs_v1",
  equities: "us_stocks_sip/minute_aggs_v1",
  options: "us_options_opra/minute_aggs_v1",
};

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: "us-east-1", // Required but not used by Massive.com
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for custom S3 endpoints
});

/**
 * Determine asset type from symbol
 * - Options: Tickers starting with "O:" (e.g., "O:SPY241123C00660000")
 * - Indices: SPX, NDX, VIX, RUT, DJI (with or without "I:" prefix)
 * - Equities: Everything else (stocks, ETFs)
 */
function getAssetType(symbol: string): "indices" | "equities" | "options" {
  // Options tickers start with "O:"
  if (symbol.startsWith("O:")) {
    return "options";
  }

  const indexSymbols = ["SPX", "NDX", "VIX", "RUT", "DJI"];
  const cleanSymbol = symbol.replace(/^I:/, "");
  return indexSymbols.includes(cleanSymbol) ? "indices" : "equities";
}

/**
 * Generate S3 key for a given date
 * Format: {path}/{YYYY}/{MM}/{YYYY-MM-DD}.csv.gz
 */
function getS3Key(symbol: string, date: Date): string {
  const assetType = getAssetType(symbol);
  const basePath = S3_PATHS[assetType];

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  return `${basePath}/${year}/${month}/${dateStr}.csv.gz`;
}

/**
 * Download and decompress a single day's data from S3
 * Returns path to decompressed CSV file
 */
export async function downloadDayFile(symbol: string, date: Date): Promise<string> {
  const s3Key = getS3Key(symbol, date);
  const tempDir = os.tmpdir();
  const gzipPath = path.join(
    tempDir,
    `massive-${symbol}-${date.toISOString().split("T")[0]}.csv.gz`
  );
  const csvPath = gzipPath.replace(".gz", "");

  console.log(`[MassiveFlatfiles] Downloading ${s3Key}...`);

  try {
    // Check if already downloaded and decompressed
    if (fs.existsSync(csvPath)) {
      console.log(`[MassiveFlatfiles] Using cached file: ${csvPath}`);
      return csvPath;
    }

    // Download from S3
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("No data received from S3");
    }

    // Save gzipped file
    const writeStream = fs.createWriteStream(gzipPath);

    // @ts-expect-error - AWS SDK stream typing issue
    await pipeline(response.Body, writeStream);

    console.log(`[MassiveFlatfiles] Downloaded to ${gzipPath}, decompressing...`);

    // Decompress
    const readStream = createReadStream(gzipPath);
    const gunzip = createGunzip();
    const outputStream = fs.createWriteStream(csvPath);

    await pipeline(readStream, gunzip, outputStream);

    // Clean up gzipped file
    fs.unlinkSync(gzipPath);

    console.log(`[MassiveFlatfiles] Decompressed to ${csvPath}`);

    return csvPath;
  } catch (error) {
    console.error(`[MassiveFlatfiles] Error downloading ${s3Key}:`, error);
    throw error;
  }
}

/**
 * Read and parse CSV file, filtering by symbol
 * Returns array of OHLCV bars for the specified symbol
 * Uses streaming to handle large files without memory issues
 */
export async function parseDayFile(csvPath: string, symbol: string): Promise<any[]> {
  const cleanSymbol = symbol.replace(/^I:/, ""); // Remove I: prefix for matching
  const bars: any[] = [];
  const uniqueTickers = new Set<string>();
  let sampleCount = 0;

  console.log(`[MassiveFlatfiles] Parsing ${csvPath} for symbol ${symbol}...`);
  console.log(`[MassiveFlatfiles] Looking for ticker: "${cleanSymbol}"`);

  return new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(
        parse({
          columns: true, // Use first row as column names
          skip_empty_lines: true,
          trim: true,
        })
      )
      .on("data", (row: any) => {
        // Debug: Collect unique tickers for first 100 rows
        if (sampleCount < 100) {
          uniqueTickers.add(row.ticker);
          sampleCount++;
        }

        // Filter by symbol and parse the row
        // Match both "SPX" and "I:SPX" formats
        if (row.ticker === cleanSymbol || row.ticker === `I:${cleanSymbol}`) {
          // Parse timestamp from window_start (nanoseconds) to milliseconds
          const timestampNs = row.window_start || row.timestamp;
          const timestampMs = timestampNs ? Math.floor(parseInt(timestampNs) / 1000000) : 0;

          bars.push({
            ticker: row.ticker,
            t: timestampMs, // Epoch milliseconds
            o: parseFloat(row.open),
            h: parseFloat(row.high),
            l: parseFloat(row.low),
            c: parseFloat(row.close),
            v: row.volume ? parseInt(row.volume) : 0,
            vw: row.vwap ? parseFloat(row.vwap) : parseFloat(row.close), // Use close if vwap missing
            n: row.transactions ? parseInt(row.transactions) : 0,
          });
        }
      })
      .on("end", () => {
        if (bars.length === 0 && uniqueTickers.size > 0) {
          console.log(
            `[MassiveFlatfiles] ⚠️ No bars found. Sample tickers in file: ${Array.from(uniqueTickers).slice(0, 10).join(", ")}`
          );
        }
        console.log(`[MassiveFlatfiles] Found ${bars.length} bars for ${symbol}`);
        resolve(bars);
      })
      .on("error", (error) => {
        console.error(`[MassiveFlatfiles] Error parsing ${csvPath}:`, error);
        reject(error);
      });
  });
}

/**
 * Download historical data for a symbol across multiple days
 * Much faster than REST API for bulk downloads
 */
export async function downloadSymbolHistory(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const allBars: any[] = [];
  const dates: Date[] = [];

  // Generate list of dates
  const current = new Date(startDate);
  while (current <= endDate) {
    // Skip weekends (trading days only)
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  console.log(`[MassiveFlatfiles] Downloading ${dates.length} trading days for ${symbol}...`);

  // Download and parse each day
  for (const date of dates) {
    try {
      const csvPath = await downloadDayFile(symbol, date);
      const dayBars = await parseDayFile(csvPath, symbol);
      allBars.push(...dayBars);
    } catch (error) {
      console.warn(
        `[MassiveFlatfiles] Failed to fetch ${symbol} for ${date.toISOString().split("T")[0]}:`,
        error
      );
      // Continue with other days
    }
  }

  // Sort by timestamp
  allBars.sort((a, b) => a.t - b.t);

  console.log(`[MassiveFlatfiles] Downloaded ${allBars.length} total bars for ${symbol}`);

  return allBars;
}

/**
 * Aggregate minute bars into different timeframes
 * Input: 1-minute bars
 * Output: Aggregated bars for specified timeframe (5m, 15m, 1h, 4h, day)
 */
export function aggregateBars(minuteBars: any[], timeframeMinutes: number): any[] {
  if (minuteBars.length === 0) return [];

  const aggregated: any[] = [];
  let currentBar: any = null;
  let barStartTime = 0;

  for (const bar of minuteBars) {
    const barTime = bar.t;
    const barPeriod = Math.floor(barTime / (timeframeMinutes * 60 * 1000));
    const periodStartTime = barPeriod * timeframeMinutes * 60 * 1000;

    if (!currentBar || periodStartTime !== barStartTime) {
      // Start new aggregated bar
      if (currentBar) {
        aggregated.push(currentBar);
      }

      currentBar = {
        t: periodStartTime,
        o: bar.o,
        h: bar.h,
        l: bar.l,
        c: bar.c,
        v: bar.v,
        vw: bar.vw,
        n: bar.n,
      };
      barStartTime = periodStartTime;
    } else {
      // Update current aggregated bar
      currentBar.h = Math.max(currentBar.h, bar.h);
      currentBar.l = Math.min(currentBar.l, bar.l);
      currentBar.c = bar.c; // Last close
      currentBar.v += bar.v;
      currentBar.n += bar.n;
      // Recalculate VWAP
      currentBar.vw = (currentBar.vw * (currentBar.v - bar.v) + bar.vw * bar.v) / currentBar.v;
    }
  }

  // Add final bar
  if (currentBar) {
    aggregated.push(currentBar);
  }

  return aggregated;
}

/**
 * Download options chain data for an underlying symbol on a specific date
 * Returns all option contracts for that underlying with minute-level OHLCV data
 *
 * @param underlying Underlying symbol (e.g., "SPY", "SPX")
 * @param date Date to fetch options data for
 * @returns Array of option contracts with their minute bars
 */
export async function downloadOptionsForUnderlying(
  underlying: string,
  date: Date
): Promise<Map<string, any[]>> {
  // Download the full options day file
  const s3Key = `${S3_PATHS.options}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}.csv.gz`;

  const tempDir = os.tmpdir();
  const gzipPath = path.join(
    tempDir,
    `massive-options-${underlying}-${date.toISOString().split("T")[0]}.csv.gz`
  );
  const csvPath = gzipPath.replace(".gz", "");

  console.log(
    `[MassiveFlatfiles] Downloading options data for ${underlying} on ${date.toISOString().split("T")[0]}...`
  );

  try {
    // Check if already downloaded
    if (!fs.existsSync(csvPath)) {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error("No data received from S3");
      }

      // Save and decompress
      const writeStream = fs.createWriteStream(gzipPath);
      // @ts-expect-error - AWS SDK stream typing issue
      await pipeline(response.Body, writeStream);

      const readStream = createReadStream(gzipPath);
      const gunzip = createGunzip();
      const outputStream = fs.createWriteStream(csvPath);
      await pipeline(readStream, gunzip, outputStream);

      fs.unlinkSync(gzipPath);
    }

    // Parse options data for the specified underlying
    return await parseOptionsFile(csvPath, underlying);
  } catch (error) {
    console.error(`[MassiveFlatfiles] Error downloading options for ${underlying}:`, error);
    throw error;
  }
}

/**
 * Parse options CSV file and extract all contracts for a specific underlying
 * Returns a map of option ticker -> array of minute bars
 *
 * Options ticker format: O:SPY241123C00450000
 * Where: O: = options prefix, SPY = underlying, 241123 = expiry (YYMMDD),
 *        C = call/P = put, 00450000 = strike * 1000
 */
async function parseOptionsFile(csvPath: string, underlying: string): Promise<Map<string, any[]>> {
  const contractBars = new Map<string, any[]>();
  let totalRows = 0;
  let matchedRows = 0;

  console.log(`[MassiveFlatfiles] Parsing options file for ${underlying}...`);

  // Create regex to match options for this underlying
  // Format: O:SPY241123C00450000 -> Match "O:SPY" at start
  const tickerPattern = new RegExp(`^O:${underlying}\\d{6}[CP]\\d{8}$`, "i");

  return new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        })
      )
      .on("data", (row: any) => {
        totalRows++;

        // Check if this row is for an option on our underlying
        if (tickerPattern.test(row.ticker)) {
          matchedRows++;

          // Parse timestamp
          const timestampNs = row.window_start || row.timestamp;
          const timestampMs = timestampNs ? Math.floor(parseInt(timestampNs) / 1000000) : 0;

          const bar = {
            ticker: row.ticker,
            t: timestampMs,
            o: parseFloat(row.open),
            h: parseFloat(row.high),
            l: parseFloat(row.low),
            c: parseFloat(row.close),
            v: row.volume ? parseInt(row.volume) : 0,
            vw: row.vwap ? parseFloat(row.vwap) : parseFloat(row.close),
            n: row.transactions ? parseInt(row.transactions) : 0,
          };

          // Group bars by contract ticker
          if (!contractBars.has(row.ticker)) {
            contractBars.set(row.ticker, []);
          }
          contractBars.get(row.ticker)!.push(bar);
        }
      })
      .on("end", () => {
        console.log(
          `[MassiveFlatfiles] Parsed ${matchedRows.toLocaleString()} option bars from ${totalRows.toLocaleString()} total rows`
        );
        console.log(
          `[MassiveFlatfiles] Found ${contractBars.size} unique option contracts for ${underlying}`
        );

        // Sort bars by timestamp for each contract
        for (const [ticker, bars] of contractBars.entries()) {
          bars.sort((a, b) => a.t - b.t);
        }

        resolve(contractBars);
      })
      .on("error", (error) => {
        console.error(`[MassiveFlatfiles] Error parsing options file:`, error);
        reject(error);
      });
  });
}

/**
 * Cleanup temporary files older than 24 hours
 */
export function cleanupTempFiles(): void {
  const tempDir = os.tmpdir();
  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  let cleaned = 0;

  for (const file of files) {
    if (file.startsWith("massive-") && file.endsWith(".csv")) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  if (cleaned > 0) {
    console.log(`[MassiveFlatfiles] Cleaned up ${cleaned} old temp files`);
  }
}
