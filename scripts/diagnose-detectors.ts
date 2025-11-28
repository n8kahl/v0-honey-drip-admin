/**
 * Diagnostic Script: Investigate why LONG detectors underperform SHORT detectors
 *
 * This script runs both a profitable and unprofitable detector on the same data
 * and prints detailed trade information to understand the discrepancy.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import fetch from "cross-fetch";
globalThis.fetch = fetch as any;

import { BacktestEngine, DEFAULT_BACKTEST_CONFIG } from "../src/lib/backtest/BacktestEngine.js";
import { meanReversionLongDetector } from "../src/lib/composite/detectors/mean-reversion-long.js";
import { meanReversionShortDetector } from "../src/lib/composite/detectors/mean-reversion-short.js";
import { openingDriveBullishDetector } from "../src/lib/composite/detectors/opening-drive-bullish.js";
import { openingDriveBearishDetector } from "../src/lib/composite/detectors/opening-drive-bearish.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  console.log("\n==============================================");
  console.log("🔍 DETECTOR DIAGNOSTIC ANALYSIS");
  console.log("==============================================\n");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials");
    process.exit(1);
  }

  // Use same config as optimizer
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const config = {
    ...DEFAULT_BACKTEST_CONFIG,
    symbols: ["SPY"], // Focus on one symbol for clarity
    startDate,
    endDate,
    timeframe: "15m",
    targetMultiple: 1.5,
    stopMultiple: 1.0,
  };

  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log(`📊 Symbol: ${config.symbols.join(", ")}`);
  console.log(`⏱️  Timeframe: ${config.timeframe}`);
  console.log(`🎯 Target: ${config.targetMultiple}R, Stop: ${config.stopMultiple}R`);
  console.log();

  const engine = new BacktestEngine(config);

  // Test pairs
  const pairs = [
    {
      name: "Mean Reversion",
      long: meanReversionLongDetector,
      short: meanReversionShortDetector,
    },
    {
      name: "Opening Drive",
      long: openingDriveBullishDetector,
      short: openingDriveBearishDetector,
    },
  ];

  for (const pair of pairs) {
    console.log("\n" + "=".repeat(60));
    console.log(`📈 ${pair.name.toUpperCase()}`);
    console.log("=".repeat(60));

    // Run LONG detector
    console.log(`\n🟢 ${pair.long.type} (LONG):`);
    const longStats = await engine.backtestDetector(pair.long);
    printStats(longStats);
    printSampleTrades(longStats.trades, 5);

    // Run SHORT detector
    console.log(`\n🔴 ${pair.short.type} (SHORT):`);
    const shortStats = await engine.backtestDetector(pair.short);
    printStats(shortStats);
    printSampleTrades(shortStats.trades, 5);

    // Compare
    console.log("\n📊 COMPARISON:");
    console.log(
      `  LONG:  ${longStats.totalTrades} trades, ${(longStats.winRate * 100).toFixed(1)}% WR, ${longStats.profitFactor.toFixed(2)} PF`
    );
    console.log(
      `  SHORT: ${shortStats.totalTrades} trades, ${(shortStats.winRate * 100).toFixed(1)}% WR, ${shortStats.profitFactor.toFixed(2)} PF`
    );

    // Analyze exit reasons
    if (longStats.trades.length > 0 && shortStats.trades.length > 0) {
      console.log("\n📋 EXIT REASON BREAKDOWN:");
      analyzeExitReasons("LONG", longStats.trades);
      analyzeExitReasons("SHORT", shortStats.trades);
    }
  }

  console.log("\n✅ Diagnostic complete\n");
}

function printStats(stats: any) {
  console.log(`  Total Trades: ${stats.totalTrades}`);
  console.log(`  Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor: ${stats.profitFactor.toFixed(2)}`);
  console.log(`  Avg R-Multiple: ${stats.avgRMultiple.toFixed(2)}`);
  console.log(`  Avg Bars Held: ${stats.avgBarsHeld.toFixed(1)}`);
}

function printSampleTrades(trades: any[], count: number) {
  if (trades.length === 0) {
    console.log("  No trades to display");
    return;
  }

  console.log(`\n  Sample Trades (first ${Math.min(count, trades.length)}):`);
  console.log("  " + "-".repeat(80));
  console.log("  Date                 | Entry   | Target  | Stop    | Exit    | Result   | R-Mult");
  console.log("  " + "-".repeat(80));

  for (let i = 0; i < Math.min(count, trades.length); i++) {
    const t = trades[i];
    const date = new Date(t.timestamp).toISOString().split("T")[0];
    const time = new Date(t.timestamp).toISOString().split("T")[1].substring(0, 5);
    const result = t.pnl > 0 ? "WIN" : t.pnl < 0 ? "LOSS" : "BE";
    console.log(
      `  ${date} ${time} | ${t.entryPrice.toFixed(2)} | ${t.targetPrice.toFixed(2)} | ${t.stopPrice.toFixed(2)} | ${t.exitPrice.toFixed(2)} | ${result.padEnd(8)} | ${t.rMultiple.toFixed(2)}`
    );
  }
  console.log("  " + "-".repeat(80));
}

function analyzeExitReasons(label: string, trades: any[]) {
  const reasons = trades.reduce(
    (acc, t) => {
      acc[t.exitReason] = (acc[t.exitReason] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`  ${label}:`);
  for (const [reason, count] of Object.entries(reasons)) {
    const pct = (((count as number) / trades.length) * 100).toFixed(1);
    console.log(`    ${reason}: ${count} (${pct}%)`);
  }
}

main().catch(console.error);
