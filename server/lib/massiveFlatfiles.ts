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
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { parse } from "csv-parse";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// S3 Configuration
const S3_ENDPOINT = "https://files.massive.com";
const S3_ACCESS_KEY = "702efe59-fd51-4674-a7fb-16584e982261";
const S3_SECRET_KEY = "9Cdq8BI5iFsF8NZ2niJPn3zqJrrLk7X5";
const S3_BUCKET = "flatfiles";

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
 */
function getAssetType(symbol: string): "indices" | "equities" {
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
          bars.push({
            ticker: row.ticker,
            t: parseInt(row.timestamp), // Epoch milliseconds
            o: parseFloat(row.open),
            h: parseFloat(row.high),
            l: parseFloat(row.low),
            c: parseFloat(row.close),
            v: parseInt(row.volume),
            vw: parseFloat(row.vwap),
            n: parseInt(row.transactions),
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
