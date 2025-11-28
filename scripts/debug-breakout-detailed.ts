#!/usr/bin/env tsx
/**
 * Detailed debug: Why breakout detector returns false
 * Tests the exact same conditions as the detector
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

import { createClient } from "@supabase/supabase-js";
import { breakoutBullishDetector } from "../src/lib/composite/detectors/breakout-bullish.js";

async function main() {
  console.log("\n🔍 DETAILED BREAKOUT DETECTOR DEBUG\n");

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Fetch bars
  const { data: bars } = await supabase
    .from("historical_bars")
    .select("*")
    .eq("symbol", "SPY")
    .eq("timeframe", "15m")
    .order("timestamp", { ascending: true })
    .limit(500);

  if (!bars || bars.length < 100) {
    console.log("Not enough bars");
    return;
  }

  console.log(`Testing ${bars.length - 50} bars...\n`);

  let testedCount = 0;
  let detectedCount = 0;
  const failedAt: Record<string, number> = {
    no_pattern: 0,
    no_breakout_flag: 0,
    no_volume_spike: 0,
    not_above_vwap: 0,
    shouldRunDetector_false: 0,
    passed_all: 0,
  };

  // Check last 200 bars
  for (let i = 50; i < Math.min(bars.length, 250); i++) {
    const current = bars[i];
    const previous = bars.slice(Math.max(0, i - 50), i);

    // Reconstruct features exactly like BacktestEngine
    const closes = previous.map((b: any) => b.close);
    const highs = previous.map((b: any) => b.high);
    const lows = previous.map((b: any) => b.low);
    const volumes = previous.map((b: any) => b.volume);

    // Breakout detection (20-bar lookback)
    const breakoutLookback = Math.min(20, previous.length);
    const recentHighs = highs.slice(-breakoutLookback);
    const highestHigh = Math.max(...recentHighs);
    const breakoutBullish = current.high > highestHigh;

    // Volume
    const avgVolume = volumes.reduce((sum: number, v: number) => sum + v, 0) / volumes.length;
    const relativeVolume = current.volume / avgVolume;

    // VWAP
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    const barsForVWAP = bars.slice(Math.max(0, i - 50), i + 1);
    for (const bar of barsForVWAP) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      cumulativePV += typicalPrice * bar.volume;
      cumulativeVolume += bar.volume;
    }
    const vwapValue = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : null;
    const vwapDistancePct =
      vwapValue !== null ? ((current.close - vwapValue) / vwapValue) * 100 : null;

    // Build features like BacktestEngine
    const features: any = {
      symbol: "SPY",
      time: new Date(current.timestamp).toISOString(),
      price: {
        current: current.close,
        open: current.open,
        high: current.high,
        low: current.low,
      },
      volume: {
        current: current.volume,
        avg: avgVolume,
        relativeToAvg: relativeVolume,
      },
      vwap:
        vwapValue !== null
          ? {
              value: vwapValue,
              distancePct: vwapDistancePct,
            }
          : undefined,
      session: {
        minutesSinceOpen: 200, // Simulate mid-day
        isRegularHours: true,
      },
      pattern: {
        breakout_bullish: breakoutBullish,
        breakout_bearish: false,
      },
    };

    testedCount++;

    // Test detector step by step
    if (!features.pattern) {
      failedAt["no_pattern"]++;
      continue;
    }

    if (features.pattern.breakout_bullish !== true) {
      failedAt["no_breakout_flag"]++;
      continue;
    }

    if (!(features.volume?.relativeToAvg && features.volume.relativeToAvg > 1.5)) {
      failedAt["no_volume_spike"]++;
      continue;
    }

    if (!(features.vwap?.distancePct && features.vwap.distancePct > 0)) {
      failedAt["not_above_vwap"]++;
      continue;
    }

    // All conditions passed!
    failedAt["passed_all"]++;

    // Now test the actual detector
    const result = breakoutBullishDetector.detectWithScore(features, undefined);
    if (result.detected) {
      detectedCount++;
    } else {
      failedAt["shouldRunDetector_false"]++;
      console.log(`Bar ${i}: All conditions met but detector returned false!`);
      console.log(`  features.session:`, features.session);
    }
  }

  console.log("📊 FILTER BREAKDOWN:\n");
  console.log(`Total bars tested: ${testedCount}`);
  console.log(`\nWhere signals were filtered:`);
  console.log(`  - No pattern data: ${failedAt["no_pattern"]}`);
  console.log(`  - No breakout flag: ${failedAt["no_breakout_flag"]}`);
  console.log(`  - No volume spike (>1.5x): ${failedAt["no_volume_spike"]}`);
  console.log(`  - Not above VWAP: ${failedAt["not_above_vwap"]}`);
  console.log(`  - shouldRunDetector false: ${failedAt["shouldRunDetector_false"]}`);
  console.log(`  ✅ Passed all conditions: ${failedAt["passed_all"]}`);
  console.log(`\n  Detector returned detected=true: ${detectedCount}`);
}

main().catch(console.error);
