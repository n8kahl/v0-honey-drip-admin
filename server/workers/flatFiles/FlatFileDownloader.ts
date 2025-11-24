/**
 * Flat File Downloader
 * Phase 3 Enhancement: Hybrid bulk historical data ingestion
 *
 * Downloads Massive.com flat files from S3 for bulk historical data loading.
 * Used for initial backfill and periodic bulk updates (weekly/monthly).
 *
 * Usage:
 *   pnpm backfill:bulk -- --dataset=indices --startDate=2024-01-01 --endDate=2024-11-24
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { join } from "path";

// Environment
const MASSIVE_AWS_ACCESS_KEY = process.env.MASSIVE_AWS_ACCESS_KEY;
const MASSIVE_AWS_SECRET_KEY = process.env.MASSIVE_AWS_SECRET_KEY;
const MASSIVE_S3_REGION = process.env.MASSIVE_S3_REGION || "us-east-1";

// S3 Configuration
const S3_BUCKETS = {
  options: "us_options_opra/minute_aggs_v1",
  indices: "us_indices/minute_aggs_v1",
} as const;

// Local storage
const DATA_DIR = join(process.cwd(), "data", "flat-files");

export type Dataset = "options" | "indices";

export interface DownloadConfig {
  dataset: Dataset;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  overwrite?: boolean; // Re-download existing files
  symbols?: string[]; // Filter symbols (post-download)
}

export interface DownloadStats {
  dataset: Dataset;
  filesDownloaded: number;
  filesSkipped: number;
  totalSizeBytes: number;
  errors: number;
  duration: number;
}

/**
 * Main downloader class
 */
export class FlatFileDownloader {
  private s3Client: S3Client | null = null;
  private dataDir: string;

  constructor() {
    this.dataDir = DATA_DIR;
    this.ensureDataDirectory();
    this.initializeS3Client();
  }

  /**
   * Download flat files for specified date range
   */
  async download(config: DownloadConfig): Promise<DownloadStats> {
    console.log("[FlatFileDownloader] 📥 Starting download...");
    console.log(`[FlatFileDownloader] Dataset: ${config.dataset}`);
    console.log(`[FlatFileDownloader] Date range: ${config.startDate} to ${config.endDate}`);

    const startTime = Date.now();
    const stats: DownloadStats = {
      dataset: config.dataset,
      filesDownloaded: 0,
      filesSkipped: 0,
      totalSizeBytes: 0,
      errors: 0,
      duration: 0,
    };

    if (!this.s3Client) {
      console.warn("[FlatFileDownloader] ⚠️  S3 client not configured. Using mock mode.");
      console.warn(
        "[FlatFileDownloader] Set MASSIVE_AWS_ACCESS_KEY and MASSIVE_AWS_SECRET_KEY to enable S3 download."
      );
      return this.mockDownload(config, stats);
    }

    try {
      // Generate list of dates to download
      const dates = this.getDateRange(config.startDate, config.endDate);
      console.log(`[FlatFileDownloader] Dates to process: ${dates.length}`);

      // Download each date's file
      for (const date of dates) {
        try {
          const downloaded = await this.downloadDateFile(config.dataset, date, config.overwrite);
          if (downloaded) {
            stats.filesDownloaded++;
          } else {
            stats.filesSkipped++;
          }
        } catch (error) {
          console.error(`[FlatFileDownloader] Error downloading ${date}:`, error);
          stats.errors++;
        }
      }

      stats.duration = Date.now() - startTime;
      this.printSummary(stats);
      return stats;
    } catch (error) {
      console.error("[FlatFileDownloader] Fatal error:", error);
      stats.errors++;
      stats.duration = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * Download a single date's file
   */
  private async downloadDateFile(
    dataset: Dataset,
    date: string,
    overwrite: boolean = false
  ): Promise<boolean> {
    // File path format: data/flat-files/indices/2024-11-24.csv
    const localPath = this.getLocalFilePath(dataset, date);

    // Skip if already exists and overwrite is false
    if (existsSync(localPath) && !overwrite) {
      console.log(`[FlatFileDownloader] ⏭️  Skipping ${date} (already exists)`);
      return false;
    }

    // S3 key format: us_indices/minute_aggs_v1/2024/2024-11-24.csv
    const s3Key = this.getS3Key(dataset, date);

    console.log(`[FlatFileDownloader] ⬇️  Downloading ${date}...`);

    try {
      const command = new GetObjectCommand({
        Bucket: "flatfiles",
        Key: s3Key,
      });

      const response = await this.s3Client!.send(command);

      if (!response.Body) {
        throw new Error("Empty response body");
      }

      // Stream to file (decompress gzip)
      const readable = response.Body as Readable;
      const gunzip = createGunzip();
      const writable = createWriteStream(localPath);
      await pipeline(readable, gunzip, writable);

      const sizeKB = (response.ContentLength || 0) / 1024;
      console.log(`[FlatFileDownloader] ✅ Downloaded ${date} (${sizeKB.toFixed(1)} KB)`);
      return true;
    } catch (error: any) {
      // Handle NoSuchKey error (file doesn't exist for this date - likely weekend/holiday)
      if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
        console.log(`[FlatFileDownloader] ⏭️  No data for ${date} (likely non-trading day)`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Initialize S3 client with Massive.com credentials
   */
  private initializeS3Client(): void {
    if (!MASSIVE_AWS_ACCESS_KEY || !MASSIVE_AWS_SECRET_KEY) {
      console.warn("[FlatFileDownloader] S3 credentials not configured");
      return;
    }

    this.s3Client = new S3Client({
      region: MASSIVE_S3_REGION,
      endpoint: "https://files.massive.com",
      credentials: {
        accessKeyId: MASSIVE_AWS_ACCESS_KEY,
        secretAccessKey: MASSIVE_AWS_SECRET_KEY,
      },
      forcePathStyle: true, // Required for S3-compatible services
      // Note: Signature version v4 is the default in AWS SDK v3
    });

    console.log("[FlatFileDownloader] S3 client initialized");
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    const dirs = [this.dataDir, join(this.dataDir, "options"), join(this.dataDir, "indices")];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[FlatFileDownloader] Created directory: ${dir}`);
      }
    }
  }

  /**
   * Generate array of dates between start and end
   */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get local file path for a date
   */
  private getLocalFilePath(dataset: Dataset, date: string): string {
    return join(this.dataDir, dataset, `${date}.csv`);
  }

  /**
   * Get S3 key for a date
   * Format: us_indices/minute_aggs_v1/2024/11/2024-11-24.csv.gz
   * (Matches Massive.com Python boto3 example)
   */
  private getS3Key(dataset: Dataset, date: string): string {
    const [year, month] = date.split("-");
    const bucket = S3_BUCKETS[dataset];
    return `${bucket}/${year}/${month}/${date}.csv.gz`;
  }

  /**
   * Mock download for testing without S3 credentials
   */
  private async mockDownload(config: DownloadConfig, stats: DownloadStats): Promise<DownloadStats> {
    const dates = this.getDateRange(config.startDate, config.endDate);
    console.log(`[FlatFileDownloader] MOCK MODE: Would download ${dates.length} files`);

    // Simulate download delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    stats.filesSkipped = dates.length;
    stats.duration = 1000;
    return stats;
  }

  /**
   * Print download summary
   */
  private printSummary(stats: DownloadStats): void {
    console.log("\n[FlatFileDownloader] ✅ Download Complete!");
    console.log("==========================================");
    console.log(`Dataset: ${stats.dataset}`);
    console.log(`Files Downloaded: ${stats.filesDownloaded}`);
    console.log(`Files Skipped: ${stats.filesSkipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Duration: ${(stats.duration / 1000).toFixed(1)}s`);
    console.log("==========================================\n");
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const config: DownloadConfig = {
    dataset: "indices",
    startDate: "2024-08-01",
    endDate: "2024-11-24",
  };

  // Parse CLI args
  for (const arg of args) {
    if (arg.startsWith("--dataset=")) {
      config.dataset = arg.split("=")[1] as Dataset;
    } else if (arg.startsWith("--startDate=")) {
      config.startDate = arg.split("=")[1];
    } else if (arg.startsWith("--endDate=")) {
      config.endDate = arg.split("=")[1];
    } else if (arg === "--overwrite") {
      config.overwrite = true;
    }
  }

  const downloader = new FlatFileDownloader();
  downloader.download(config).catch(console.error);
}
