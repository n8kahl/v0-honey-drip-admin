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

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

// Singleton Supabase client
let supabaseClient: SupabaseClient<any> | null = null;

function getSupabaseClient(): SupabaseClient<any> {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("[Composite Scanner] ✅ Supabase client created successfully");
  }
  return supabaseClient!;
}

const supabase = getSupabaseClient();

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
 * Aggregate bars into larger timeframe
 * @param bars - Input bars (e.g., 5m bars)
 * @param multiplier - Number of bars to aggregate (e.g., 3 for 5m→15m, 12 for 5m→60m)
 * @returns Aggregated bars
 */
function aggregateBarsToTimeframe(bars: Bar[], multiplier: number): Bar[] {
  if (bars.length === 0 || multiplier <= 1) return bars;

  const aggregated: Bar[] = [];

  for (let i = 0; i < bars.length; i += multiplier) {
    const chunk = bars.slice(i, i + multiplier);
    if (chunk.length === 0) continue;

    aggregated.push({
      time: chunk[0].time, // Use first bar's timestamp
      open: chunk[0].open, // First bar's open
      high: Math.max(...chunk.map((b) => b.high)), // Highest high
      low: Math.min(...chunk.map((b) => b.low)), // Lowest low
      close: chunk[chunk.length - 1].close, // Last bar's close
      volume: chunk.reduce((sum, b) => sum + b.volume, 0), // Sum volume
    });
  }

  return aggregated;
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

    // Convert to Bar format (5m bars)
    const bars5m: Bar[] = rawBars.map((b) => ({
      time: Math.floor(b.t / 1000), // Convert ms to seconds
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v || 0,
    }));

    // Aggregate 5m bars to 15m bars (3 x 5m = 15m)
    const bars15m = aggregateBarsToTimeframe(bars5m, 3);

    // Fetch or aggregate 60m (hourly) bars
    let bars60m: Bar[] = [];
    try {
      // Try to fetch hourly bars directly (more efficient for indices)
      const hourlyResult = await fetchBarsForRange(symbol, 1, "hour", 14); // 14 days for better trend context
      bars60m = hourlyResult.bars.map((b) => ({
        time: Math.floor(b.t / 1000),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v || 0,
      }));
      console.log(`[Composite Scanner] Fetched ${bars60m.length} hourly bars for ${symbol}`);
    } catch (err) {
      // Fallback: aggregate from 5m bars (12 x 5m = 60m)
      bars60m = aggregateBarsToTimeframe(bars5m, 12);
      console.log(
        `[Composite Scanner] Aggregated ${bars60m.length} hourly bars from 5m for ${symbol}`
      );
    }

    // Get latest bar from 5m (primary timeframe)
    const latestBar = bars5m[bars5m.length - 1];
    const prevBar = bars5m.length > 1 ? bars5m[bars5m.length - 2] : latestBar;

    // Calculate indicators for each timeframe
    const indicators5m = calculateIndicators(bars5m);
    const indicators15m = calculateIndicators(bars15m);
    const indicators60m = calculateIndicators(bars60m);

    const vwap5m = calculateVWAP(bars5m);
    const vwap15m = calculateVWAP(bars15m);
    const vwap60m = calculateVWAP(bars60m);

    const vwapDistancePct5m = vwap5m > 0 ? ((latestBar.close - vwap5m) / vwap5m) * 100 : 0;
    const vwapDistancePct15m = vwap15m > 0 ? ((latestBar.close - vwap15m) / vwap15m) * 100 : 0;
    const vwapDistancePct60m = vwap60m > 0 ? ((latestBar.close - vwap60m) / vwap60m) * 100 : 0;

    // Helper to build timeframe context
    const buildTfContext = (
      bars: Bar[],
      indicators: any,
      vwap: number,
      vwapDistancePct: number
    ) => {
      const latest = bars[bars.length - 1] || latestBar;
      const prev = bars.length > 1 ? bars[bars.length - 2] : latest;
      return {
        price: {
          current: latest.close,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          prevClose: prev.close,
          prev: prev.close,
        },
        vwap: {
          value: vwap,
          distancePct: vwapDistancePct,
          prev: calculateVWAP(bars.slice(0, -1)),
        },
        ema: indicators.ema,
        rsi: indicators.rsi,
        atr: indicators.atr,
      };
    };

    // Build multi-timeframe context with 5m, 15m, and 60m
    const mtf = {
      "5m": buildTfContext(bars5m, indicators5m, vwap5m, vwapDistancePct5m),
      "15m": buildTfContext(bars15m, indicators15m, vwap15m, vwapDistancePct15m),
      "60m": buildTfContext(bars60m, indicators60m, vwap60m, vwapDistancePct60m),
    } as any; // Type assertion needed for RawMTFContext compatibility

    // Keep reference to primary timeframe bars for buildSymbolFeatures
    const bars = bars5m;
    const indicators = indicators5m;
    const vwap = vwap5m;
    const vwapDistancePct = vwapDistancePct5m;

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

  // Format flow context (Phase 4 Enhancement)
  const flow = signal.features?.flow;
  let flowContextLine = "";
  if (flow) {
    const biasEmoji =
      flow.flowBias === "bullish" ? "🟢" : flow.flowBias === "bearish" ? "🔴" : "⚪";
    const biasLabel = flow.flowBias ? flow.flowBias.toUpperCase() : "NEUTRAL";
    const sweepInfo = flow.sweepCount ? `${flow.sweepCount} sweeps` : "";
    const scoreInfo = flow.flowScore ? `Score: ${flow.flowScore.toFixed(0)}/100` : "";
    const trendInfo = flow.flowTrend ? `Trend: ${flow.flowTrend}` : "";
    const pcRatio = flow.putCallRatio ? `P/C: ${flow.putCallRatio.toFixed(2)}` : "";

    // Check flow alignment with trade direction
    const isAligned =
      (signal.direction === "LONG" && flow.flowBias === "bullish") ||
      (signal.direction === "SHORT" && flow.flowBias === "bearish");
    const alignmentStatus = isAligned
      ? "✅ Flow Aligned"
      : flow.flowBias === "neutral"
        ? "⚪ Flow Neutral"
        : "⚠️ Flow Opposing";

    const parts = [`${biasEmoji} ${biasLabel}`, sweepInfo, scoreInfo, pcRatio, trendInfo].filter(
      Boolean
    );

    flowContextLine = parts.join(" • ") + "\n" + alignmentStatus;
  }

  const fields = [
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
  ];

  // Add flow context field if available (Phase 4)
  if (flowContextLine) {
    fields.push({
      name: "🌊 Flow Context",
      value: flowContextLine,
      inline: false,
    });
  }

  // Add confluence factors
  fields.push({
    name: "Confluence Factors",
    value: confluenceLines || "N/A",
    inline: false,
  });

  return {
    embeds: [
      {
        title: `${emoji} ${signal.symbol} - ${typeDisplay}`,
        description: `**${signal.direction}** Setup (Score: ${signal.baseScore.toFixed(0)}/100)`,
        color,
        fields,
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
 * Idempotent: Checks if signal was already alerted before sending
 */
async function sendDiscordAlerts(userId: string, signal: CompositeSignal): Promise<void> {
  try {
    // IDEMPOTENCY CHECK: Skip if already alerted
    if (signal.alertedAt) {
      console.log(
        `[Composite Scanner] Signal ${signal.id} already alerted at ${signal.alertedAt.toISOString()}, skipping`
      );
      return;
    }

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

    // Track if at least one webhook succeeded
    let anySuccess = false;

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
          anySuccess = true;
        }
      } catch (err) {
        console.error(`[Composite Scanner] Error sending to webhook:`, err);
      }
    }

    // Mark signal as alerted if at least one webhook succeeded
    if (anySuccess && signal.id) {
      try {
        const { error: updateErr } = await supabase
          .from("composite_signals")
          .update({ alerted_at: new Date().toISOString() })
          .eq("id", signal.id);

        if (updateErr) {
          console.error(
            `[Composite Scanner] Error marking signal ${signal.id} as alerted:`,
            updateErr
          );
        } else {
          console.log(`[Composite Scanner] ✅ Signal ${signal.id} marked as alerted`);
        }
      } catch (markErr) {
        console.error(`[Composite Scanner] Exception marking signal as alerted:`, markErr);
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
 * Determine health status based on error rate and scan results
 * - healthy: <10% error rate
 * - degraded: 10-50% error rate or scan took >60s
 * - unhealthy: >50% error rate or no data for >5 minutes
 */
function determineHealthStatus(): "healthy" | "degraded" | "unhealthy" {
  const errorRate = stats.totalScans > 0 ? stats.totalErrors / stats.totalScans : 0;
  const lastScanAgeMs = Date.now() - stats.lastScanTime.getTime();
  const scanTooSlow = stats.lastScanDuration > 60000; // > 60 seconds
  const dataStale = lastScanAgeMs > 5 * 60 * 1000; // > 5 minutes since last scan

  if (errorRate > 0.5 || dataStale) {
    return "unhealthy";
  }

  if (errorRate > 0.1 || scanTooSlow) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Update heartbeat table to track worker health
 */
async function updateHeartbeat(signalsDetected: number): Promise<void> {
  try {
    const status = determineHealthStatus();
    const errorRate =
      stats.totalScans > 0 ? ((stats.totalErrors / stats.totalScans) * 100).toFixed(1) : "0";

    console.log(
      `[Composite Scanner] Heartbeat: status=${status}, signals=${signalsDetected}, errorRate=${errorRate}%`
    );

    // Upsert heartbeat record with dynamic status
    // Use metadata JSONB column for extended metrics (error_rate, scan_duration_ms)
    const { data, error } = await supabase
      .from("scanner_heartbeat")
      .upsert(
        {
          id: "composite_scanner",
          last_scan: new Date().toISOString(),
          signals_detected: signalsDetected,
          status,
          metadata: {
            error_rate: parseFloat(errorRate),
            scan_duration_ms: stats.lastScanDuration,
            total_scans: stats.totalScans,
            total_errors: stats.totalErrors,
            avg_scan_duration: Math.round(stats.avgScanDuration),
            last_updated: new Date().toISOString(),
          },
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
