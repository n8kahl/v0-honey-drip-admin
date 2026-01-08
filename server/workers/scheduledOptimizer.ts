/**
 * Scheduled Optimizer Worker
 *
 * Automatically runs parameter optimization every Sunday at 6pm ET
 * to keep strategies tuned for the upcoming week's trading.
 *
 * Features:
 * - Weekly optimization schedule (Sundays 6pm ET)
 * - Discord notifications on completion
 * - Automatic parameter deployment
 * - Error handling and recovery
 *
 * Usage:
 *   pnpm start:optimizer-scheduler  # Start scheduled optimizer
 */

/* eslint-disable no-console */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

// Fix Node 22 fetch issues
import fetch from "cross-fetch";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.fetch = fetch as any;

import { ConfluenceOptimizer } from "./confluenceOptimizer.js";
import { BacktestConfig } from "../../src/lib/backtest/types.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Singleton Supabase client
let supabaseClient: SupabaseClient<any> | null = null;

function getSupabaseClient(): SupabaseClient<any> {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient!;
}

// Schedule: Every Sunday at 6pm ET (18:00 Eastern Time)
const OPTIMIZATION_SCHEDULE = {
  dayOfWeek: 0, // Sunday (0-6, where 0=Sunday)
  hour: 18, // 6pm
  minute: 0,
  timezone: "America/New_York",
};

// Check interval: every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * Convert time to ET and check if it's time to optimize
 */
function isOptimizationTime(): boolean {
  const now = new Date();

  // Convert to ET
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: OPTIMIZATION_SCHEDULE.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "long",
  });

  const etString = etFormatter.format(now);
  const parts = etFormatter.formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const isSunday = weekday === "Sunday";
  const is6pm = hour === OPTIMIZATION_SCHEDULE.hour;
  const isOnTheHour = minute >= 0 && minute < 5; // 5-minute window

  console.log(
    `[Scheduler] Current time (ET): ${etString}, Sunday=${isSunday}, 6pm=${is6pm}, Window=${isOnTheHour}`
  );

  return isSunday && is6pm && isOnTheHour;
}

/**
 * Get last optimization time from file or database
 */
function getLastOptimizationTime(): Date | null {
  try {
    const configPath = join(process.cwd(), "config", "optimized-params.json");

    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.timestamp) {
        return new Date(config.timestamp);
      }
    }
  } catch (error) {
    console.warn("[Scheduler] Could not read last optimization time:", error);
  }
  return null;
}

/**
 * Check if optimization has already run this week
 */
function hasOptimizedThisWeek(): boolean {
  const lastOptimization = getLastOptimizationTime();
  if (!lastOptimization) return false;

  const now = new Date();
  const daysSinceOptimization =
    (now.getTime() - lastOptimization.getTime()) / (1000 * 60 * 60 * 24);

  // If optimized within last 6 days, skip
  const alreadyOptimized = daysSinceOptimization < 6;

  if (alreadyOptimized) {
    console.log(
      `[Scheduler] Already optimized ${daysSinceOptimization.toFixed(1)} days ago, skipping`
    );
  }

  return alreadyOptimized;
}

/**
 * Send Discord notification about optimization results
 */
async function sendDiscordNotification(
  success: boolean,
  details: {
    winRate?: number;
    profitFactor?: number;
    totalTrades?: number;
    symbols?: string[];
    error?: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Get first Discord webhook from database
    const { data: channels } = await supabase
      .from("discord_channels")
      .select("webhook_url")
      .limit(1);

    if (!channels || channels.length === 0) {
      console.log("[Scheduler] No Discord webhooks configured, skipping notification");
      return;
    }

    const webhookUrl = channels[0].webhook_url;

    const embed = {
      embeds: [
        {
          title: success ? "✅ Weekly Optimization Complete" : "❌ Optimization Failed",
          color: success ? 0x00ff00 : 0xff0000,
          fields: success
            ? [
                {
                  name: "Win Rate",
                  value: `${(details.winRate * 100).toFixed(1)}%`,
                  inline: true,
                },
                {
                  name: "Profit Factor",
                  value: details.profitFactor.toFixed(2),
                  inline: true,
                },
                {
                  name: "Total Trades",
                  value: details.totalTrades.toString(),
                  inline: true,
                },
                {
                  name: "Symbols Tested",
                  value: details.symbols?.join(", ") || "N/A",
                  inline: false,
                },
                {
                  name: "Next Optimization",
                  value: "Next Sunday at 6pm ET",
                  inline: false,
                },
              ]
            : [
                {
                  name: "Error",
                  value: details.error || "Unknown error",
                  inline: false,
                },
              ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Scheduled Weekly Optimizer",
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embed),
    });

    console.log("[Scheduler] ✅ Discord notification sent");
  } catch (error) {
    console.error("[Scheduler] Failed to send Discord notification:", error);
  }
}

/**
 * Run the optimization process
 */
async function runOptimization(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║         Scheduled Weekly Optimization - Starting              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const startTime = Date.now();

  try {
    // Fetch watchlist symbols
    console.log("[Scheduler] 📋 Fetching symbols from watchlist...");
    const supabase = getSupabaseClient();
    const { data: watchlistData, error: watchlistError } = await supabase
      .from("watchlist")
      .select("symbol");

    if (watchlistError) {
      throw new Error(`Failed to fetch watchlist: ${watchlistError.message}`);
    }

    const uniqueSymbols = [...new Set(watchlistData?.map((w) => w.symbol) || [])];

    if (uniqueSymbols.length === 0) {
      console.warn("[Scheduler] ⚠️  No symbols in watchlist, using defaults");
      uniqueSymbols.push("SPX", "NDX", "SPY", "QQQ");
    }

    console.log(
      `[Scheduler] ✅ Found ${uniqueSymbols.length} symbols: ${uniqueSymbols.join(", ")}`
    );

    // Backtest configuration
    const backtestConfig: BacktestConfig = {
      symbols: uniqueSymbols,
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      timeframe: "15m",
      targetMultiple: 1.5,
      stopMultiple: 1.0,
      maxHoldBars: 20,
      slippage: 0.001,
    };

    // GA configuration (full optimization on Sundays)
    const gaConfig = {
      populationSize: 20,
      generations: 10,
    };

    // Run optimization
    const optimizer = new ConfluenceOptimizer(gaConfig);
    const result = await optimizer.optimize();

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║         Scheduled Weekly Optimization - Complete              ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
    console.log(`Duration: ${duration} minutes`);
    console.log(`Win Rate: ${(result.winRate * 100).toFixed(1)}%`);
    console.log(`Profit Factor: ${result.profitFactor.toFixed(2)}`);
    console.log(`Total Trades: ${result.totalTrades}`);
    console.log("\n✅ Optimized parameters saved to config/optimized-params.json");
    console.log("✅ Scanner will use new parameters on next restart\n");

    // Send success notification
    await sendDiscordNotification(true, {
      winRate: result.winRate,
      profitFactor: result.profitFactor,
      totalTrades: result.totalTrades,
      symbols: uniqueSymbols,
    });
  } catch (error: any) {
    console.error("\n❌ Optimization failed:", error);

    // Send failure notification
    await sendDiscordNotification(false, {
      error: error.message,
    });

    throw error;
  }
}

/**
 * Main scheduler loop
 */
async function runScheduler(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║         Scheduled Optimizer - Starting                        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  console.log(
    `Schedule: Every Sunday at ${OPTIMIZATION_SCHEDULE.hour}:${OPTIMIZATION_SCHEDULE.minute.toString().padStart(2, "0")} ET`
  );
  console.log(`Check interval: ${CHECK_INTERVAL / 1000 / 60} minutes`);
  console.log(`Timezone: ${OPTIMIZATION_SCHEDULE.timezone}\n`);

  // Check immediately on startup
  if (isOptimizationTime() && !hasOptimizedThisWeek()) {
    console.log("[Scheduler] 🎯 Optimization time detected on startup, running now...");
    await runOptimization();
  } else {
    console.log("[Scheduler] ⏳ Waiting for next scheduled time...");
  }

  // Schedule periodic checks
  setInterval(async () => {
    try {
      if (isOptimizationTime() && !hasOptimizedThisWeek()) {
        console.log("[Scheduler] 🎯 Scheduled optimization time reached!");
        await runOptimization();
      }
    } catch (error) {
      console.error("[Scheduler] Error in scheduler loop:", error);
      // Continue running despite errors
    }
  }, CHECK_INTERVAL);

  console.log("[Scheduler] ✅ Scheduler running. Press Ctrl+C to stop.\n");
}

// Start scheduler
runScheduler().catch((error) => {
  console.error("[Scheduler] Fatal error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Scheduler] Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Scheduler] Received SIGINT, shutting down...");
  process.exit(0);
});
