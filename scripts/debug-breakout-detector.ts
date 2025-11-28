#!/usr/bin/env tsx
/**
 * Debug why breakout detectors have 0 trades
 * Check if breakouts are detected but filtered by other conditions
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

config({ path: resolve(projectRoot, ".env.local"), override: true });

import fetch from "cross-fetch";
globalThis.fetch = fetch as any;

import { BacktestEngine } from "../src/lib/backtest/BacktestEngine.js";
import { createClient } from "@supabase/supabase-js";

async function main() {
  console.log("\n🔍 BREAKOUT DETECTOR DEBUG\n");

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const engine = new BacktestEngine(
    {
      symbols: ["SPY"],
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      timeframe: "15m",
      targetMultiple: 2.0,
      stopMultiple: 1.0,
      maxHoldBars: 30,
      slippage: 0.001,
    },
    supabase
  );

  // Fetch bars directly to check
  const { data: bars } = await supabase
    .from("historical_bars")
    .select("*")
    .eq("symbol", "SPY")
    .eq("timeframe", "15m")
    .order("timestamp", { ascending: true })
    .limit(500);

  if (!bars || bars.length < 100) {
    console.log("Not enough bars in database");
    return;
  }

  console.log(`Analyzing ${bars.length} bars...\n`);

  let breakoutBullishCount = 0;
  let breakoutBearishCount = 0;
  let volumeSpikeCount = 0;
  let aboveVwapCount = 0;
  let allConditionsMetBullish = 0;
  let allConditionsMetBearish = 0;

  // Check last 400 bars
  for (let i = 50; i < bars.length; i++) {
    const current = bars[i];
    const previous = bars.slice(Math.max(0, i - 50), i);

    // Calculate indicators
    const highs = previous.map((b: any) => b.high);
    const lows = previous.map((b: any) => b.low);
    const volumes = previous.map((b: any) => b.volume);

    // Breakout detection (20-bar lookback)
    const breakoutLookback = Math.min(20, previous.length);
    const recentHighs = highs.slice(-breakoutLookback);
    const recentLows = lows.slice(-breakoutLookback);
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const breakoutBullish = current.high > highestHigh;
    const breakoutBearish = current.low < lowestLow;

    // Volume check
    const avgVolume = volumes.reduce((sum: number, v: number) => sum + v, 0) / volumes.length;
    const relativeVolume = current.volume / avgVolume;
    const hasVolumeSpike = relativeVolume > 1.5;

    // VWAP check (simplified)
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    for (const bar of previous.slice(-20)) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      cumulativePV += typicalPrice * bar.volume;
      cumulativeVolume += bar.volume;
    }
    const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : current.close;
    const aboveVwap = current.close > vwap;
    const belowVwap = current.close < vwap;

    if (breakoutBullish) breakoutBullishCount++;
    if (breakoutBearish) breakoutBearishCount++;
    if (hasVolumeSpike) volumeSpikeCount++;
    if (aboveVwap) aboveVwapCount++;

    if (breakoutBullish && hasVolumeSpike && aboveVwap) {
      allConditionsMetBullish++;
    }
    if (breakoutBearish && hasVolumeSpike && belowVwap) {
      allConditionsMetBearish++;
    }
  }

  const totalBars = bars.length - 50;

  console.log("📊 CONDITION ANALYSIS:\n");
  console.log(`Total bars analyzed: ${totalBars}`);
  console.log(`\nIndividual conditions:`);
  console.log(
    `  - Breakout bullish (high > 20-bar high): ${breakoutBullishCount} (${((breakoutBullishCount / totalBars) * 100).toFixed(1)}%)`
  );
  console.log(
    `  - Breakout bearish (low < 20-bar low):   ${breakoutBearishCount} (${((breakoutBearishCount / totalBars) * 100).toFixed(1)}%)`
  );
  console.log(
    `  - Volume spike (>1.5x avg):             ${volumeSpikeCount} (${((volumeSpikeCount / totalBars) * 100).toFixed(1)}%)`
  );
  console.log(
    `  - Above VWAP:                           ${aboveVwapCount} (${((aboveVwapCount / totalBars) * 100).toFixed(1)}%)`
  );

  console.log(`\nCombined conditions (required for detector to trigger):`);
  console.log(`  - Bullish breakout + volume + above VWAP: ${allConditionsMetBullish}`);
  console.log(`  - Bearish breakout + volume + below VWAP: ${allConditionsMetBearish}`);

  if (allConditionsMetBullish === 0 && allConditionsMetBearish === 0) {
    console.log(`\n⚠️  The combination of conditions is too strict!`);
    console.log(`   Consider relaxing volume threshold or VWAP requirement.`);
  }
}

main().catch(console.error);
