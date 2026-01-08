/**
 * @deprecated LEGACY SCANNER - Superseded by compositeScanner.ts (Phase 5+)
 *
 * This scanner uses the old strategy_definitions/strategy_signals tables.
 * For new development, use compositeScanner.ts which provides:
 * - 16 advanced composite detectors
 * - Multi-timeframe signal analysis
 * - Optimized parameters from genetic algorithm (Phase 6)
 * - Phase 1 enhancements (adaptive thresholds, IV gating, confidence scoring)
 *
 * This file is kept for backward compatibility with existing strategy_definitions.
 * It may be removed in a future release once all strategies are migrated to composite detectors.
 *
 * Original Description:
 * Server-Side Signal Scanner Worker
 *
 * Runs independently as a background process to continuously monitor watchlists
 * and detect trading signals 24/7, even when no users are browsing the app.
 *
 * Features:
 * - Scans all active users' watchlists every 60 seconds
 * - Fetches live market data from Massive.com REST API
 * - Evaluates strategy conditions using the strategy engine
 * - Inserts detected signals to database
 * - Sends Discord notifications automatically
 * - Graceful error handling with continued operation
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { scanStrategiesForUser } from "../../src/lib/strategy/scanner.js";
import { buildSymbolFeatures, type TimeframeKey } from "../../src/lib/strategy/featuresBuilder.js";
import { sendStrategySignalToDiscord } from "../../src/lib/discord/strategyAlerts.js";
import type { Bar } from "../../src/lib/strategy/patternDetection.js";
import { fileURLToPath } from "url";
import { fetchBarsForRange } from "./lib/barProvider.js";
import { getAlertPreferencesForUser, pickWebhooks } from "./lib/discordAlertPreferences.js";

// Configuration
const SCAN_INTERVAL = 60000; // 1 minute
const BARS_TO_FETCH = 200; // Fetch last 200 bars for pattern detection
const PRIMARY_TIMEFRAME: TimeframeKey = "5m";

// Supabase client with service role key for server-side operations
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[Scanner Worker] Missing required environment variables:");
  if (!SUPABASE_URL) console.error("  - VITE_SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
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
    const { bars: rawBars, source } = await fetchBarsForRange(symbol, 5, "minute", 7);

    if (rawBars.length < 20) {
      console.warn(
        `[Scanner Worker] Insufficient data for ${symbol} (${rawBars.length} bars) from provider ${source}`
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

    return features;
  } catch (error: any) {
    const provider = error?.provider || "unknown";
    console.error(
      `[Scanner Worker] Error fetching features for ${symbol} (provider ${provider}):`,
      error
    );
    return null;
  }
}

/**
 * Send Discord alerts for newly detected signals
 */
async function sendDiscordAlerts(userId: string, signals: any[]) {
  try {
    // Fetch user's Discord channels
    const { data: channels, error: channelsErr } = await supabase
      .from("discord_channels")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true);

    if (channelsErr) {
      console.error(
        `[Scanner Worker] Error fetching Discord channels for user ${userId}:`,
        channelsErr
      );
      return;
    }

    if (!channels || channels.length === 0) {
      console.log(`[Scanner Worker] No Discord channels configured for user ${userId}`);
      return;
    }

    const webhookUrls = channels.map((ch) => ch.webhook_url).filter(Boolean);

    if (webhookUrls.length === 0) {
      console.log(`[Scanner Worker] No valid webhook URLs for user ${userId}`);
      return;
    }

    const prefs = await getAlertPreferencesForUser(userId);

    // Send alerts for each signal with type-based preferences
    for (const signal of signals) {
      try {
        const confidence = signal.confidence ?? 0;
        const alertType = confidence >= 80 ? "ready" : confidence >= 50 ? "setup" : "signal";
        const targets = pickWebhooks(alertType, prefs, webhookUrls);

        if (!targets.enabled || targets.webhooks.length === 0) {
          console.log(
            `[Scanner Worker] Alert ${alertType} for ${signal.symbol} skipped (disabled or no channels)`
          );
          continue;
        }

        // Fetch strategy definition
        const { data: strategy, error: strategyErr } = await supabase
          .from("strategy_definitions")
          .select("*")
          .eq("id", signal.strategy_id)
          .single();

        if (strategyErr || !strategy) {
          console.error(`[Scanner Worker] Strategy not found for signal ${signal.id}`);
          continue;
        }

        // Send to Discord
        await sendStrategySignalToDiscord(targets.webhooks, signal, strategy);

        console.log(
          `[Scanner Worker] ✅ Discord alert (${alertType}) sent for ${signal.symbol} (${strategy.name}) to ${targets.webhooks.length} channel(s)`
        );
      } catch (alertError) {
        console.error(
          `[Scanner Worker] Error sending Discord alert for signal ${signal.id}:`,
          alertError
        );
      }
    }
  } catch (error) {
    console.error(`[Scanner Worker] Error in sendDiscordAlerts:`, error);
  }
}

/**
 * Scan a single user's watchlist
 */
async function scanUserWatchlist(userId: string): Promise<number> {
  try {
    // Fetch user's watchlist
    let watchlist: any[] | null = null;
    let watchlistErr: any = null;

    // Try 'symbol' column first
    {
      const { data, error } = await supabase
        .from("watchlist")
        .select("symbol")
        .eq("user_id", userId);
      watchlist = data;
      watchlistErr = error;
    }

    // Fallback to 'ticker' column if 'symbol' doesn't exist
    if (
      watchlistErr &&
      (watchlistErr.code === "42703" || /column.*symbol/i.test(watchlistErr.message || ""))
    ) {
      console.warn(`[Scanner Worker] 'symbol' column not found, trying 'ticker' column...`);
      const { data, error } = await supabase
        .from("watchlist")
        .select("ticker")
        .eq("user_id", userId);

      if (!error && data) {
        console.log(`[Scanner Worker] ✅ Using 'ticker' column - DATABASE NEEDS MIGRATION!`);
        watchlist = data.map((row: any) => ({ symbol: row.ticker }));
        watchlistErr = null;
      } else {
        watchlistErr = error;
      }
    }

    if (watchlistErr) {
      console.error(`[Scanner Worker] Error fetching watchlist for user ${userId}:`, watchlistErr);
      return 0;
    }

    if (!watchlist || watchlist.length === 0) {
      console.log(`[Scanner Worker] Empty watchlist for user ${userId}`);
      return 0;
    }

    const symbols = watchlist.map((w) => w.symbol);
    console.log(
      `[Scanner Worker] Scanning ${symbols.length} symbols for user ${userId}: ${symbols.join(", ")}`
    );

    // Fetch market data for each symbol
    const featuresBySymbol: Record<string, any> = {};

    for (const symbol of symbols) {
      const features = await fetchSymbolFeatures(symbol);
      if (features) {
        featuresBySymbol[symbol] = features;
      }
    }

    const symbolsWithData = Object.keys(featuresBySymbol);

    if (symbolsWithData.length === 0) {
      console.log(`[Scanner Worker] No market data available for user ${userId}`);
      return 0;
    }

    console.log(
      `[Scanner Worker] Fetched data for ${symbolsWithData.length}/${symbols.length} symbols`
    );

    // Scan strategies
    const signals = await scanStrategiesForUser({
      owner: userId,
      symbols: symbolsWithData,
      features: featuresBySymbol,
      supabaseClient: supabase,
    });

    if (signals.length > 0) {
      console.log(`[Scanner Worker] 🎯 ${signals.length} new signals detected for user ${userId}`);

      // Send Discord alerts
      await sendDiscordAlerts(userId, signals);
    }

    return signals.length;
  } catch (error) {
    console.error(`[Scanner Worker] Error scanning user ${userId}:`, error);
    return 0;
  }
}

/**
 * Scan all users' watchlists
 */
async function scanAllUsers(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Scanner Worker] ====== Starting scan at ${new Date().toISOString()} ======`);

  try {
    // Fetch all user IDs
    const { data: profiles, error: profilesErr } = await supabase.from("profiles").select("id");

    if (profilesErr) {
      console.error("[Scanner Worker] Error fetching profiles:", profilesErr);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log("[Scanner Worker] No users found");
      return;
    }

    console.log(`[Scanner Worker] Scanning ${profiles.length} users`);

    let totalSignals = 0;

    // Scan each user sequentially (could be parallelized with Promise.all for better performance)
    for (const profile of profiles) {
      const signalCount = await scanUserWatchlist(profile.id);
      totalSignals += signalCount;
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Scanner Worker] ====== Scan complete in ${duration}ms - ${totalSignals} total signals ======\n`
    );

    // Update heartbeat
    await updateHeartbeat(totalSignals);
  } catch (error) {
    console.error("[Scanner Worker] Error in scanAllUsers:", error);
  }
}

/**
 * Update heartbeat table to track worker health
 */
async function updateHeartbeat(signalsDetected: number): Promise<void> {
  try {
    // Upsert heartbeat record
    const { error } = await supabase.from("scanner_heartbeat").upsert(
      {
        id: "main_scanner",
        last_scan: new Date().toISOString(),
        signals_detected: signalsDetected,
        status: "healthy",
      },
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error("[Scanner Worker] Error updating heartbeat:", error);
    }
  } catch (error) {
    console.error("[Scanner Worker] Error in updateHeartbeat:", error);
  }
}

/**
 * Main worker class
 */
export class SignalScannerWorker {
  private scanTimer?: NodeJS.Timeout;
  private isRunning = false;

  /**
   * Start the scanner worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Scanner Worker] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[Scanner Worker] ======================================");
    console.log("[Scanner Worker] Starting 24/7 Signal Scanner Worker");
    console.log("[Scanner Worker] Scan interval: 60 seconds");
    console.log("[Scanner Worker] Primary timeframe: 5m");
    console.log("[Scanner Worker] ======================================\n");

    // Run initial scan immediately
    await scanAllUsers();

    // Schedule recurring scans
    this.scanTimer = setInterval(async () => {
      await scanAllUsers();
    }, SCAN_INTERVAL);

    console.log("[Scanner Worker] Worker started successfully\n");
  }

  /**
   * Stop the scanner worker
   */
  stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }
    this.isRunning = false;
    console.log("[Scanner Worker] Stopped");
  }

  /**
   * Check if worker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Main Entry Point (when run directly)
// ============================================================================

// ES module entry point detection
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const worker = new SignalScannerWorker();

  // Start worker
  worker.start().catch((err) => {
    console.error("[Scanner Worker] Fatal error during startup:", err);
    process.exit(1);
  });

  // Graceful shutdown handlers
  process.on("SIGTERM", () => {
    console.log("[Scanner Worker] Received SIGTERM, shutting down gracefully...");
    worker.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[Scanner Worker] Received SIGINT, shutting down gracefully...");
    worker.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("[Scanner Worker] Uncaught exception:", error);
    worker.stop();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Scanner Worker] Unhandled rejection at:", promise, "reason:", reason);
    // Don't exit on unhandled rejection, just log it
  });
}
