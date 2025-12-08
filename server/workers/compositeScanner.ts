/**
 * Composite Scanner Worker
 * Phase 7: Server Scanner Worker
 *
 * Runs independently as a background process to continuously monitor watchlists
 * and detect composite trading signals 24/7 using the new Phase 5 CompositeScanner.
 *
 * Features:
 * - Scans all active users' watchlists every 60 seconds
 * - Uses CompositeScanner for high-quality signal detection
 * - Fetches live market data from Massive.com REST API
 * - Inserts detected signals to composite_signals table
 * - Sends Discord notifications automatically
 * - Expires old signals
 * - Graceful error handling with continued operation
 * - Performance monitoring and logging
 */

// Load environment variables
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

// Note: Node 18+ has native fetch support - no polyfill needed

import { createClient } from "@supabase/supabase-js";
import { CompositeScanner } from "../../src/lib/composite/CompositeScanner.js";
import type { CompositeSignal } from "../../src/lib/composite/CompositeSignal.js";
import { buildSymbolFeatures, type TimeframeKey } from "../../src/lib/strategy/featuresBuilder.js";
import {
  insertCompositeSignal,
  expireOldSignals,
} from "../../src/lib/supabase/compositeSignals.js";
import type { Bar } from "../../src/lib/strategy/patternDetection.js";
import { fileURLToPath } from "url";
import { OPTIMIZED_SCANNER_CONFIG } from "../../src/lib/composite/OptimizedScannerConfig.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ParameterConfig } from "../../src/types/optimizedParameters.js";
import { fetchBarsForRange } from "./lib/barProvider.js";

// Configuration
const SCAN_INTERVAL = 60000; // 1 minute
const BARS_TO_FETCH = 200; // Fetch last 200 bars for pattern detection
const PRIMARY_TIMEFRAME: TimeframeKey = "5m";
const EXPIRE_SIGNALS_INTERVAL = 5 * 60 * 1000; // Expire old signals every 5 minutes

// Supabase client with service role key for server-side operations
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("[Composite Scanner] 🔍 Supabase Configuration:");
console.log(`  URL: ${SUPABASE_URL || "❌ MISSING"}`);
console.log(
  `  Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY ? "✅ Present (" + SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + "...)" : "❌ MISSING"}`
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[Composite Scanner] Missing required environment variables:");
  if (!SUPABASE_URL) console.error("  - SUPABASE_URL or VITE_SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
console.log("[Composite Scanner] ✅ Supabase client created successfully");

/**
 * Phase 6: Load optimized parameters from configuration file
 */
function loadOptimizedParameters(): ParameterConfig | undefined {
  try {
    const configPath =
      process.env.OPTIMIZED_PARAMS_PATH || join(process.cwd(), "config", "optimized-params.json");

    if (!existsSync(configPath)) {
      console.log("[Composite Scanner] 📊 No optimized parameters found at", configPath);
      console.log("[Composite Scanner] ℹ️  Using default parameters");
      return undefined;
    }

    const configFile = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configFile);

    if (config.parameters) {
      console.log("[Composite Scanner] ✅ Loaded optimized parameters:");
      console.log(`  Win Rate: ${(config.performance?.winRate * 100 || 0).toFixed(1)}%`);
      console.log(`  Profit Factor: ${config.performance?.profitFactor?.toFixed(2) || "N/A"}`);
      console.log(`  Optimization Date: ${config.timestamp || "Unknown"}`);
      return config.parameters as ParameterConfig;
    }

    console.warn("[Composite Scanner] ⚠️  Invalid config format, using defaults");
    return undefined;
  } catch (error) {
    console.error("[Composite Scanner] ❌ Error loading optimized parameters:", error);
    console.log("[Composite Scanner] ℹ️  Falling back to default parameters");
    return undefined;
  }
}

// Load optimized parameters on startup
const OPTIMIZED_PARAMS = loadOptimizedParameters();

/**
 * Performance statistics
 */
interface ScanStatistics {
  totalScans: number;
  totalSignals: number;
  totalErrors: number;
  lastScanDuration: number;
  avgScanDuration: number;
  lastScanTime: Date;
  signalsByType: Record<string, number>;
  signalsBySymbol: Record<string, number>;
}

const stats: ScanStatistics = {
  totalScans: 0,
  totalSignals: 0,
  totalErrors: 0,
  lastScanDuration: 0,
  avgScanDuration: 0,
  lastScanTime: new Date(),
  signalsByType: {},
  signalsBySymbol: {},
};

/**
 * Helper to normalize symbol for Massive API calls
 */
function normalizeSymbol(symbol: string): string {
  // Remove I: prefix if present
  return symbol.replace(/^I:/, "").toUpperCase();
}

/**
 * Calculate indicator values from bars (simplified version for server-side)
 */
function calculateIndicators(bars: Bar[]) {
  if (bars.length === 0) return { ema: {}, rsi: {}, atr: 0 };

  // Simple EMA calculation
  function calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  // Simple RSI calculation
  function calculateRSI(data: number[], period: number = 14): number {
    if (data.length < period + 1) return 50; // Neutral default

    const changes = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }

    let gains = 0;
    let losses = 0;

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) gains += changes[i];
      else losses -= changes[i];
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // Simple ATR calculation
  function calculateATR(bars: Bar[], period: number = 14): number {
    if (bars.length < period + 1) return 0;

    const trueRanges = [];
    for (let i = 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }

    return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
  }

  const closePrices = bars.map((b) => b.close);

  return {
    ema: {
      "9": calculateEMA(closePrices, 9),
      "20": calculateEMA(closePrices, 20),
      "50": calculateEMA(closePrices, 50),
      "200": calculateEMA(closePrices, 200),
    },
    rsi: {
      "14": calculateRSI(closePrices, 14),
    },
    atr: calculateATR(bars, 14),
  };
}

/**
 * Calculate VWAP from bars
 */
function calculateVWAP(bars: Bar[]): number {
  if (bars.length === 0) return 0;

  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativePV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
  }

  return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0;
}

/**
 * Fetch market data and build features for a symbol
 */
async function fetchSymbolFeatures(
  symbol: string
): Promise<ReturnType<typeof buildSymbolFeatures> | null> {
  try {
    const normalized = normalizeSymbol(symbol);

    let rawBars: any[] = [];
    let usedDatabase = false;
    let provider = "unknown";

    // Fetch bars (last 200 5-minute bars = ~16 hours of trading)
    const to = new Date().toISOString().split("T")[0]; // Today
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // 7 days ago

    // Provider-aware fetch (Massive for indices, Tradier for equities)
    try {
      const result = await fetchBarsForRange(symbol, 5, "minute", 7);
      rawBars = result.bars;
      provider = result.source;
      console.log(
        `[Composite Scanner] Provider ${provider} returned ${rawBars.length} bars for ${symbol}`
      );
    } catch (err: any) {
      // On 429 rate limit or any API error, try database fallback immediately
      const is429 = err?.message?.includes("429") || err?.status === 429;
      const errProvider = err?.provider || provider || "unknown";
      console.warn(
        `[Composite Scanner] ${is429 ? "Rate limit hit" : "API error"} for ${symbol} from provider ${errProvider}, trying database fallback...`
      );
      rawBars = []; // Trigger database fallback below
      provider = errProvider;
    }

    // Database fallback: If Massive API failed or returned insufficient data
    if (rawBars.length < 20) {
      console.log(
        `[Composite Scanner] Provider ${provider} returned ${rawBars.length} bars for ${symbol}, falling back to database...`
      );

      const fromTimestamp = new Date(from).getTime();
      const toTimestamp = new Date(to).getTime();

      const { data: dbBars, error: dbError } = await supabase
        .from("historical_bars")
        .select("*")
        .eq("symbol", normalized)
        .eq("timeframe", "5m")
        .gte("timestamp", fromTimestamp)
        .lte("timestamp", toTimestamp)
        .order("timestamp", { ascending: true })
        .limit(BARS_TO_FETCH);

      if (dbError) {
        console.error(`[Composite Scanner] Database query error for ${symbol}:`, dbError);
      } else if (dbBars && dbBars.length > 0) {
        // Convert database format to API format
        rawBars = dbBars.map((bar) => ({
          t: bar.timestamp,
          o: bar.open,
          h: bar.high,
          l: bar.low,
          c: bar.close,
          v: bar.volume || 0,
        }));
        usedDatabase = true;
        console.log(
          `[Composite Scanner] ✅ Fetched ${rawBars.length} bars from database for ${symbol}`
        );
      } else {
        console.warn(`[Composite Scanner] No data in database for ${symbol}`);
      }
    }

    // Final check after database fallback
    if (rawBars.length < 20) {
      console.warn(
        `[Composite Scanner] Insufficient data for ${symbol} (${rawBars.length} bars) after database fallback`
      );
      return null;
    }

    // Convert to Bar format
    const bars: Bar[] = rawBars.map((b) => ({
      time: Math.floor(b.t / 1000), // Convert ms to seconds
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v || 0,
    }));

    // Get latest bar
    const latestBar = bars[bars.length - 1];
    const prevBar = bars.length > 1 ? bars[bars.length - 2] : latestBar;

    // Calculate indicators
    const indicators = calculateIndicators(bars);
    const vwap = calculateVWAP(bars);
    const vwapDistancePct = vwap > 0 ? ((latestBar.close - vwap) / vwap) * 100 : 0;

    // Build multi-timeframe context (for now, just 5m)
    const mtf = {
      [PRIMARY_TIMEFRAME]: {
        price: {
          current: latestBar.close,
          open: latestBar.open,
          high: latestBar.high,
          low: latestBar.low,
          prevClose: prevBar.close,
          prev: prevBar.close,
        },
        vwap: {
          value: vwap,
          distancePct: vwapDistancePct,
          prev: calculateVWAP(bars.slice(0, -1)),
        },
        ema: indicators.ema,
        rsi: indicators.rsi,
        atr: indicators.atr,
      },
    } as any; // Type assertion needed for RawMTFContext compatibility

    // Build features
    const features = buildSymbolFeatures({
      symbol,
      timeISO: new Date(latestBar.time * 1000).toISOString(),
      primaryTf: PRIMARY_TIMEFRAME,
      mtf,
      bars,
      timezone: "America/New_York",
    });

    // Log pattern detection results for diagnostics
    console.log(`[FEATURES] ${symbol}:`, {
      hasPattern: !!features.pattern,
      patternKeys: features.pattern
        ? Object.keys(features.pattern).filter((k) => features.pattern![k] === true)
        : [],
      rsi: features.mtf?.["5m"]?.rsi?.[14]?.toFixed(1),
      price: latestBar.close.toFixed(2),
      volume: latestBar.volume,
      barCount: bars.length,
    });

    return features;
  } catch (error) {
    console.error(`[Composite Scanner] Error fetching features for ${symbol}:`, error);
    stats.totalErrors++;
    return null;
  }
}

/**
 * Format Discord message for composite signal
 */
function formatDiscordMessage(signal: CompositeSignal): any {
  const emoji = signal.direction === "LONG" ? "🟢" : "🔴";
  const color = signal.direction === "LONG" ? 0x00ff00 : 0xff0000;

  // Format opportunity type
  const typeDisplay = signal.opportunityType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Format confluence breakdown
  const confluenceLines = Object.entries(signal.confluence)
    .map(([factor, score]) => `• ${factor}: ${score.toFixed(0)}/100`)
    .join("\n");

  return {
    embeds: [
      {
        title: `${emoji} ${signal.symbol} - ${typeDisplay}`,
        description: `**${signal.direction}** Setup (Score: ${signal.baseScore.toFixed(0)}/100)`,
        color,
        fields: [
          {
            name: "Recommended Style",
            value: signal.recommendedStyle.toUpperCase(),
            inline: true,
          },
          {
            name: "Entry",
            value: `$${signal.entryPrice.toFixed(2)}`,
            inline: true,
          },
          {
            name: "Stop",
            value: `$${signal.stopPrice.toFixed(2)}`,
            inline: true,
          },
          {
            name: "Target T1",
            value: `$${signal.targets.T1.toFixed(2)}`,
            inline: true,
          },
          {
            name: "Target T2",
            value: `$${signal.targets.T2.toFixed(2)}`,
            inline: true,
          },
          {
            name: "Target T3",
            value: `$${signal.targets.T3.toFixed(2)}`,
            inline: true,
          },
          {
            name: "Risk/Reward",
            value: `${signal.riskReward.toFixed(1)}:1`,
            inline: true,
          },
          {
            name: "Expires",
            value: `<t:${Math.floor(signal.expiresAt.getTime() / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Confluence Factors",
            value: confluenceLines || "N/A",
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: `${signal.assetClass} • ${signal.detectorVersion}`,
        },
      },
    ],
  };
}

/**
 * Send Discord alerts for newly detected signals
 */
async function sendDiscordAlerts(userId: string, signal: CompositeSignal): Promise<void> {
  try {
    // Fetch user's Discord channels
    const { data: channels, error: channelsErr } = await supabase
      .from("discord_channels")
      .select("*")
      .eq("user_id", userId);
    // Note: 'enabled' column doesn't exist in schema, fetching all channels

    if (channelsErr) {
      console.error(
        `[Composite Scanner] Error fetching Discord channels for user ${userId}:`,
        channelsErr
      );
      return;
    }

    if (!channels || channels.length === 0) {
      console.log(`[Composite Scanner] No Discord channels configured for user ${userId}`);
      return;
    }

    const webhookUrls = channels.map((ch) => ch.webhook_url).filter(Boolean);

    if (webhookUrls.length === 0) {
      console.log(`[Composite Scanner] No valid webhook URLs for user ${userId}`);
      return;
    }

    // Format message
    const message = formatDiscordMessage(signal);

    // Send to each webhook
    for (const webhookUrl of webhookUrls) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          console.error(
            `[Composite Scanner] Discord webhook error: ${response.status} ${response.statusText}`
          );
        } else {
          console.log(
            `[Composite Scanner] ✅ Discord alert sent for ${signal.symbol} (${signal.opportunityType})`
          );
        }
      } catch (err) {
        console.error(`[Composite Scanner] Error sending to webhook:`, err);
      }
    }
  } catch (error) {
    console.error(`[Composite Scanner] Error in sendDiscordAlerts:`, error);
  }
}

/**
 * Scan a single user's watchlist
 */
async function scanUserWatchlist(userId: string): Promise<number> {
  try {
    // Fetch user's watchlist
    console.log(`[Composite Scanner] Querying watchlist for user ${userId}`);
    const { data: watchlist, error: watchlistErr } = await supabase
      .from("watchlist")
      .select("symbol")
      .eq("user_id", userId);

    if (watchlistErr) {
      console.error(
        `[Composite Scanner] Error fetching watchlist for user ${userId}:`,
        watchlistErr
      );
      stats.totalErrors++;
      return 0;
    }

    if (!watchlist || watchlist.length === 0) {
      console.log(`[Composite Scanner] Empty watchlist for user ${userId}`);
      return 0;
    }

    const symbols = watchlist.map((w) => w.symbol);
    console.log(
      `[Composite Scanner] Scanning ${symbols.length} symbols for user ${userId}: ${symbols.join(", ")}`
    );
    console.log(`[DEBUG] Watchlist raw data:`, watchlist.slice(0, 3)); // Show first 3 for debugging

    // Create scanner instance for this user with optimized configuration
    // Phase 6: Include optimized parameters if available
    const scanner = new CompositeScanner({
      owner: userId,
      config: OPTIMIZED_SCANNER_CONFIG,
      optimizedParams: OPTIMIZED_PARAMS, // Phase 6: Apply genetic algorithm optimized parameters
    });

    let signalsGenerated = 0;

    /**
     * Fetch features with rate limit protection
     * Use database cache when available, only hit API when needed
     */
    console.log(
      `[Composite Scanner] Fetching features for ${symbols.length} symbols (with rate limit protection)...`
    );

    // Fetch sequentially with small delays to avoid rate limits
    const featureResults: Array<
      PromiseSettledResult<Awaited<ReturnType<typeof fetchSymbolFeatures>>>
    > = [];
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      try {
        const features = await fetchSymbolFeatures(symbol);
        featureResults.push({ status: "fulfilled", value: features });

        // Add small delay between symbols to avoid bursting API (except for last symbol)
        if (i < symbols.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay = max 5 requests/second
        }
      } catch (error) {
        featureResults.push({ status: "rejected", reason: error });
      }
    }

    // Process each symbol's features
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const featureResult = featureResults[i];

      try {
        // Check if feature fetch succeeded
        if (featureResult.status === "rejected") {
          console.error(
            `[Composite Scanner] Failed to fetch features for ${symbol}:`,
            featureResult.reason
          );
          stats.totalErrors++;
          continue;
        }

        const features = featureResult.value;
        if (!features) {
          continue;
        }

        // Scan symbol
        const result = await scanner.scanSymbol(symbol, features);

        // Enhanced logging for diagnostics
        console.log(`[SCAN] ${symbol}:`, {
          filtered: result.filtered,
          filterReason: result.filterReason,
          hasSignal: !!result.signal,
          signal: result.signal
            ? {
                type: result.signal.opportunityType,
                baseScore: result.signal.baseScore.toFixed(1),
                direction: result.signal.direction,
                entry: result.signal.entryPrice,
                rr: result.signal.riskReward?.toFixed(2),
              }
            : null,
        });

        if (result.filtered) {
          console.log(`[Composite Scanner] ${symbol}: Filtered (${result.filterReason})`);
          continue;
        }

        if (result.signal) {
          // Insert signal to database
          try {
            console.log(
              `[Composite Scanner] Attempting to insert signal: ${symbol} ${result.signal.opportunityType}`
            );

            const inserted = await insertCompositeSignal(result.signal, supabase);

            console.log(
              `[Composite Scanner] 🎯 NEW SIGNAL SAVED: ${symbol} ${result.signal.opportunityType} (${result.signal.baseScore.toFixed(0)}/100) ID: ${inserted.id}`
            );

            // Send Discord alert
            await sendDiscordAlerts(userId, inserted);

            // Update stats
            stats.totalSignals++;
            stats.signalsByType[result.signal.opportunityType] =
              (stats.signalsByType[result.signal.opportunityType] || 0) + 1;
            stats.signalsBySymbol[symbol] = (stats.signalsBySymbol[symbol] || 0) + 1;

            signalsGenerated++;
          } catch (insertErr: any) {
            if (insertErr.message?.includes("Duplicate signal")) {
              console.log(`[Composite Scanner] ${symbol}: Duplicate signal (skipped)`);
            } else {
              console.error(`[Composite Scanner] ❌ Error inserting signal for ${symbol}:`, {
                message: insertErr.message,
                details: insertErr.details || insertErr.toString(),
                code: insertErr.code,
                opportunityType: result.signal.opportunityType,
              });
              stats.totalErrors++;
            }
          }
        }
      } catch (scanErr) {
        console.error(`[Composite Scanner] Error scanning ${symbol}:`, scanErr);
        stats.totalErrors++;
      }
    }

    return signalsGenerated;
  } catch (error) {
    console.error(`[Composite Scanner] Error scanning user ${userId}:`, error);
    stats.totalErrors++;
    return 0;
  }
}

/**
 * Scan all users' watchlists
 */
async function scanAllUsers(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Composite Scanner] ====== Starting scan at ${new Date().toISOString()} ======`);

  try {
    // Fetch all user IDs
    const { data: profiles, error: profilesErr } = await supabase.from("profiles").select("id");

    if (profilesErr) {
      console.error("[Composite Scanner] Error fetching profiles:", profilesErr);
      stats.totalErrors++;
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log("[Composite Scanner] No users found");
      return;
    }

    console.log(`[Composite Scanner] Scanning ${profiles.length} users`);

    let totalSignals = 0;

    // Scan each user sequentially
    for (const profile of profiles) {
      const signalCount = await scanUserWatchlist(profile.id);
      totalSignals += signalCount;
    }

    const duration = Date.now() - startTime;
    stats.totalScans++;
    stats.lastScanDuration = duration;
    stats.avgScanDuration =
      (stats.avgScanDuration * (stats.totalScans - 1) + duration) / stats.totalScans;
    stats.lastScanTime = new Date();

    console.log(
      `[Composite Scanner] ====== Scan complete in ${duration}ms - ${totalSignals} signals ======`
    );
    console.log(
      `[Composite Scanner] Stats: ${stats.totalScans} scans, ${stats.totalSignals} total signals, ${stats.totalErrors} errors\n`
    );

    // Update heartbeat
    await updateHeartbeat(totalSignals);
  } catch (error) {
    console.error("[Composite Scanner] Error in scanAllUsers:", error);
    stats.totalErrors++;
  }
}

/**
 * Expire old active signals
 */
async function expireOldActiveSignals(): Promise<void> {
  try {
    console.log("[Composite Scanner] Expiring old signals...");
    const count = await expireOldSignals(undefined, supabase);
    if (count > 0) {
      console.log(`[Composite Scanner] ✅ Expired ${count} old signals`);
    }
  } catch (error) {
    console.error("[Composite Scanner] Error expiring old signals:", error);
    stats.totalErrors++;
  }
}

/**
 * Update heartbeat table to track worker health
 */
async function updateHeartbeat(signalsDetected: number): Promise<void> {
  try {
    console.log(`[Composite Scanner] Attempting heartbeat update... (signals: ${signalsDetected})`);

    // Upsert heartbeat record
    const { data, error } = await supabase
      .from("scanner_heartbeat")
      .upsert(
        {
          id: "composite_scanner",
          last_scan: new Date().toISOString(),
          signals_detected: signalsDetected,
          status: "healthy",
        },
        {
          onConflict: "id",
        }
      )
      .select();

    if (error) {
      console.error("[Composite Scanner] ❌ Heartbeat update failed:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      stats.totalErrors++;
    } else {
      console.log("[Composite Scanner] ✅ Heartbeat updated successfully:", data);
    }
  } catch (error) {
    console.error("[Composite Scanner] ❌ Heartbeat update exception:", error);
    stats.totalErrors++;
  }
}

/**
 * Print performance statistics
 */
function printStatistics(): void {
  console.log("[Composite Scanner] ====== Performance Statistics ======");
  console.log(`Total Scans: ${stats.totalScans}`);
  console.log(`Total Signals: ${stats.totalSignals}`);
  console.log(`Total Errors: ${stats.totalErrors}`);
  console.log(`Last Scan: ${stats.lastScanTime.toISOString()}`);
  console.log(`Last Duration: ${stats.lastScanDuration}ms`);
  console.log(`Avg Duration: ${stats.avgScanDuration.toFixed(0)}ms`);
  console.log(
    `Signals per Scan: ${(stats.totalSignals / Math.max(1, stats.totalScans)).toFixed(1)}`
  );
  console.log("\nSignals by Type:");
  Object.entries(stats.signalsByType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log("\nSignals by Symbol:");
  Object.entries(stats.signalsBySymbol)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([symbol, count]) => {
      console.log(`  ${symbol}: ${count}`);
    });
  console.log("===========================================\n");
}

/**
 * Main worker class
 */
export class CompositeScannerWorker {
  private scanTimer?: NodeJS.Timeout;
  private expireTimer?: NodeJS.Timeout;
  private statsTimer?: NodeJS.Timeout;
  private isRunning = false;

  /**
   * Start the scanner worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Composite Scanner] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[Composite Scanner] ======================================");
    console.log("[Composite Scanner] Starting Composite Signal Scanner");
    console.log("[Composite Scanner] Configuration: OPTIMIZED (High Accuracy)");
    console.log("[Composite Scanner] Scan interval: 60 seconds");
    console.log("[Composite Scanner] Primary timeframe: 5m");
    console.log(
      `[Composite Scanner] Min Base Score: ${OPTIMIZED_SCANNER_CONFIG.defaultThresholds.minBaseScore} (Equity), ${OPTIMIZED_SCANNER_CONFIG.assetClassThresholds?.INDEX?.minBaseScore || 85} (Index)`
    );
    console.log(
      `[Composite Scanner] Min R:R Ratio: ${OPTIMIZED_SCANNER_CONFIG.defaultThresholds.minRiskReward}:1`
    );
    console.log("[Composite Scanner] Target Win Rate: 65%+");
    console.log("[Composite Scanner] ======================================\n");

    // Run initial scan immediately
    await scanAllUsers();

    // Run initial signal expiration
    await expireOldActiveSignals();

    // Schedule recurring scans
    this.scanTimer = setInterval(async () => {
      await scanAllUsers();
    }, SCAN_INTERVAL);

    // Schedule recurring signal expiration
    this.expireTimer = setInterval(async () => {
      await expireOldActiveSignals();
    }, EXPIRE_SIGNALS_INTERVAL);

    // Schedule periodic stats printing (every 5 minutes)
    this.statsTimer = setInterval(
      () => {
        printStatistics();
      },
      5 * 60 * 1000
    );

    console.log("[Composite Scanner] Worker started successfully\n");
  }

  /**
   * Stop the scanner worker
   */
  stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }
    if (this.expireTimer) {
      clearInterval(this.expireTimer);
      this.expireTimer = undefined;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
    this.isRunning = false;
    console.log("[Composite Scanner] Stopped");
    printStatistics();
  }

  /**
   * Check if worker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current statistics
   */
  getStatistics(): ScanStatistics {
    return { ...stats };
  }
}

// ============================================================================
// Main Entry Point (when run directly)
// ============================================================================

// ES module entry point detection
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const worker = new CompositeScannerWorker();

  // Start worker
  worker.start().catch((err) => {
    console.error("[Composite Scanner] Fatal error during startup:", err);
    process.exit(1);
  });

  // Graceful shutdown handlers
  process.on("SIGTERM", () => {
    console.log("[Composite Scanner] Received SIGTERM, shutting down gracefully...");
    worker.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[Composite Scanner] Received SIGINT, shutting down gracefully...");
    worker.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("[Composite Scanner] Uncaught exception:", error);
    worker.stop();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Composite Scanner] Unhandled rejection at:", promise, "reason:", reason);
    // Don't exit on unhandled rejection, just log it
  });
}
