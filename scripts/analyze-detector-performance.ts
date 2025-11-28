#!/usr/bin/env tsx
/**
 * Analyze backtest performance broken down by detector type
 *
 * Usage: tsx scripts/analyze-detector-performance.ts
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

config({ path: resolve(projectRoot, ".env.local"), override: true });
config({ path: resolve(projectRoot, ".env"), override: false });

// Verify environment variables are loaded
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Environment variables not loaded!");
  console.error("SUPABASE_URL:", process.env.SUPABASE_URL ? "Present" : "MISSING");
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY:",
    process.env.SUPABASE_SERVICE_ROLE_KEY ? "Present" : "MISSING"
  );
  console.error("CWD:", process.cwd());
  console.error("Script dir:", __dirname);
  console.error("Project root:", projectRoot);
  console.error("Looking for .env.local at:", resolve(projectRoot, ".env.local"));
  process.exit(1);
}

// Fix Node 22 fetch issues - use cross-fetch polyfill for Supabase
import fetch from "cross-fetch";
globalThis.fetch = fetch as any;

// Use dynamic date range (last 90 days) like optimizer
const END_DATE = new Date().toISOString().split("T")[0];
const START_DATE = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

// Symbols will be fetched from watchlist (like optimizer)

interface DetectorStats {
  name: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

async function analyzeDetector(
  name: string,
  detector: any,
  symbols: string[]
): Promise<DetectorStats> {
  console.log(`\n📊 Testing ${name}...`);

  // Dynamic imports after env vars are loaded
  const { BacktestEngine } = await import("../src/lib/backtest/BacktestEngine.js");
  const { createClient } = await import("@supabase/supabase-js");

  // Create Supabase client for database access (same as optimizer)
  const supabase =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null;

  // Create engine with watchlist symbols (backtestDetector loops through config.symbols internally)
  const engine = new BacktestEngine(
    {
      symbols: symbols,
      startDate: START_DATE,
      endDate: END_DATE,
      timeframe: "15m",
      targetMultiple: 2.0,
      stopMultiple: 1.0,
      maxHoldBars: 30,
      slippage: 0.001,
    },
    supabase
  );

  try {
    // Run backtest for this detector (handles all symbols)
    const result = await engine.backtestDetector(detector);

    const winRate = result.totalTrades > 0 ? (result.winners / result.totalTrades) * 100 : 0;
    const avgWin = result.avgWin || 0;
    const avgLoss = Math.abs(result.avgLoss) || 0;
    const profitFactor = result.profitFactor || 0;

    console.log(
      `  ${result.totalTrades} trades, ${winRate.toFixed(1)}% WR, ${profitFactor.toFixed(2)} PF`
    );

    return {
      name,
      trades: result.totalTrades,
      wins: result.winners,
      losses: result.losers,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
    };
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
    return {
      name,
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
    };
  }
}

async function main() {
  console.log("🔬 Detector Performance Analysis");
  console.log("=".repeat(80));

  // Fetch symbols from watchlist (same as optimizer)
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select("symbol");

  if (watchlistError) {
    console.error("❌ Failed to fetch watchlist:", watchlistError);
    process.exit(1);
  }

  const SYMBOLS = [...new Set(watchlistData?.map((w) => w.symbol) || [])];

  if (SYMBOLS.length === 0) {
    console.warn("⚠️  No symbols in watchlist, using defaults");
    SYMBOLS.push("SPX", "NDX", "SPY", "QQQ");
  }

  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Period: ${START_DATE} to ${END_DATE}`);
  console.log(`Config: 2:1 R:R, 30 bar max hold\n`);

  // Dynamic import BACKTESTABLE_DETECTORS AFTER env vars are loaded (same as optimizer)
  // Options-dependent detectors (gamma_*, eod_pin) are excluded since BacktestEngine
  // doesn't have access to historical options data
  const { BACKTESTABLE_DETECTORS } = await import("../src/lib/composite/detectors/index.js");

  console.log(`Testing ${BACKTESTABLE_DETECTORS.length} backtestable detectors...\n`);
  console.log(`(excludes 5 options-dependent: gamma_*, eod_pin)\n`);

  // Use detector objects with their type as name
  const detectors = BACKTESTABLE_DETECTORS.map((detector) => ({
    name: detector.type,
    detector,
  }));

  const results: DetectorStats[] = [];

  for (const { name, detector } of detectors) {
    try {
      const stats = await analyzeDetector(name, detector, SYMBOLS);
      results.push(stats);
    } catch (error: any) {
      console.error(`❌ ${name} failed: ${error.message}`);
    }
  }

  // Sort by profit factor descending
  results.sort((a, b) => b.profitFactor - a.profitFactor);

  console.log("\n" + "=".repeat(80));
  console.log("📈 RESULTS RANKED BY PROFIT FACTOR\n");
  console.log("Rank | Detector                    | Trades | Win Rate | Profit Factor | Avg W/L");
  console.log("-".repeat(80));

  results.forEach((stats, i) => {
    const rank = `${i + 1}.`.padEnd(5);
    const name = stats.name.padEnd(28);
    const trades = stats.trades.toString().padStart(6);
    const winRate = `${stats.winRate.toFixed(1)}%`.padStart(8);
    const pf = stats.profitFactor.toFixed(2).padStart(13);
    const avgWL = `${stats.avgWin.toFixed(2)}/${stats.avgLoss.toFixed(2)}`.padStart(12);

    console.log(`${rank}${name} ${trades} ${winRate} ${pf} ${avgWL}`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("🎯 BEST PERFORMERS (PF > 1.5):\n");

  const bestPerformers = results.filter((r) => r.profitFactor > 1.5);
  if (bestPerformers.length === 0) {
    console.log("⚠️  No detectors achieved PF > 1.5");
  } else {
    bestPerformers.forEach((stats) => {
      console.log(`✅ ${stats.name}`);
      console.log(
        `   - ${stats.trades} trades, ${stats.winRate.toFixed(1)}% WR, ${stats.profitFactor.toFixed(2)} PF`
      );
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("❌ POOR PERFORMERS (PF < 0.8):\n");

  const poorPerformers = results.filter((r) => r.profitFactor < 0.8);
  if (poorPerformers.length === 0) {
    console.log("✅ All detectors achieved PF > 0.8");
  } else {
    poorPerformers.forEach((stats) => {
      console.log(`⚠️  ${stats.name}`);
      console.log(
        `   - ${stats.trades} trades, ${stats.winRate.toFixed(1)}% WR, ${stats.profitFactor.toFixed(2)} PF`
      );
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n💡 RECOMMENDATIONS:\n");

  if (bestPerformers.length > 0) {
    console.log(`✅ Focus optimization on: ${bestPerformers.map((p) => p.name).join(", ")}`);
  }

  if (poorPerformers.length > 0) {
    console.log(`⚠️  Consider disabling: ${poorPerformers.map((p) => p.name).join(", ")}`);
    console.log(
      `   These detectors may need detector logic improvements, not just parameter tuning.`
    );
  }

  const avgPF = results.reduce((sum, r) => sum + r.profitFactor, 0) / results.length;
  console.log(`\n📊 Average Profit Factor across all detectors: ${avgPF.toFixed(2)}`);

  if (avgPF < 1.0) {
    console.log(`\n⚠️  WARNING: Average PF < 1.0 suggests systematic issues:`);
    console.log(`   - Market conditions during backtest period may not suit these strategies`);
    console.log(`   - Data quality issues (missing volume, no options data)`);
    console.log(`   - Detector logic may need fundamental improvements`);
    console.log(`   - Consider testing on different time periods or symbols`);
  }
}

main().catch(console.error);
