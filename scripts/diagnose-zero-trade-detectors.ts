/**
 * Diagnostic: Why do some detectors have 0 trades?
 *
 * This script analyzes what data each detector requires and checks
 * if BacktestEngine provides it.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import fetch from "cross-fetch";
globalThis.fetch = fetch as any;

import { BacktestEngine, DEFAULT_BACKTEST_CONFIG } from "../src/lib/backtest/BacktestEngine.js";
import { breakoutBullishDetector } from "../src/lib/composite/detectors/breakout-bullish.js";
import { breakoutBearishDetector } from "../src/lib/composite/detectors/breakout-bearish.js";
import { gammaSqueezeBullishDetector } from "../src/lib/composite/detectors/gamma-squeeze-bullish.js";
import { gammaSqueezeBearishDetector } from "../src/lib/composite/detectors/gamma-squeeze-bearish.js";
import { gammaFlipBullishDetector } from "../src/lib/composite/detectors/gamma-flip-bullish.js";
import { gammaFlipBearishDetector } from "../src/lib/composite/detectors/gamma-flip-bearish.js";
import { powerHourReversalBullishDetector } from "../src/lib/composite/detectors/power-hour-reversal-bullish.js";
import { powerHourReversalBearishDetector } from "../src/lib/composite/detectors/power-hour-reversal-bearish.js";
import { eodPinSetupDetector } from "../src/lib/composite/detectors/eod-pin-setup.js";

const ZERO_TRADE_DETECTORS = [
  { name: "breakout_bullish", detector: breakoutBullishDetector, requiresOptions: false },
  { name: "breakout_bearish", detector: breakoutBearishDetector, requiresOptions: false },
  { name: "gamma_squeeze_bullish", detector: gammaSqueezeBullishDetector, requiresOptions: true },
  { name: "gamma_squeeze_bearish", detector: gammaSqueezeBearishDetector, requiresOptions: true },
  { name: "gamma_flip_bullish", detector: gammaFlipBullishDetector, requiresOptions: true },
  { name: "gamma_flip_bearish", detector: gammaFlipBearishDetector, requiresOptions: true },
  {
    name: "power_hour_reversal_bullish",
    detector: powerHourReversalBullishDetector,
    requiresOptions: false,
  },
  {
    name: "power_hour_reversal_bearish",
    detector: powerHourReversalBearishDetector,
    requiresOptions: false,
  },
  { name: "eod_pin_setup", detector: eodPinSetupDetector, requiresOptions: true },
];

async function main() {
  console.log("\n==============================================");
  console.log("🔍 ZERO-TRADE DETECTOR DIAGNOSTIC");
  console.log("==============================================\n");

  console.log("This diagnostic checks why certain detectors produce 0 trades.\n");

  // Summary of requirements
  console.log("📋 DETECTOR REQUIREMENTS SUMMARY:\n");
  console.log(
    "┌─────────────────────────────────────┬──────────────────────────────────────────────────┐"
  );
  console.log(
    "│ Detector                            │ Key Requirements                                 │"
  );
  console.log(
    "├─────────────────────────────────────┼──────────────────────────────────────────────────┤"
  );
  console.log(
    "│ breakout_bullish                    │ pattern.breakout_bullish === true                │"
  );
  console.log(
    "│ breakout_bearish                    │ pattern.breakout_bearish === true                │"
  );
  console.log(
    "│ gamma_squeeze_bullish               │ optionsData (dealerNetGamma, maxGammaStrike)     │"
  );
  console.log(
    "│ gamma_squeeze_bearish               │ optionsData (dealerNetGamma, maxGammaStrike)     │"
  );
  console.log(
    "│ gamma_flip_bullish                  │ optionsData (dealerNetGamma)                     │"
  );
  console.log(
    "│ gamma_flip_bearish                  │ optionsData (dealerNetGamma)                     │"
  );
  console.log(
    "│ power_hour_reversal_bullish         │ minutesSinceOpen >= 300, RSI < 35                │"
  );
  console.log(
    "│ power_hour_reversal_bearish         │ minutesSinceOpen >= 300, RSI > 65                │"
  );
  console.log(
    "│ eod_pin_setup                       │ optionsData (maxPainStrike, is0DTE)              │"
  );
  console.log(
    "└─────────────────────────────────────┴──────────────────────────────────────────────────┘"
  );

  console.log("\n\n📊 BACKTEST ENGINE PROVIDES:\n");
  console.log(
    "┌─────────────────────────────────────┬──────────────────────────────────────────────────┐"
  );
  console.log(
    "│ Feature                             │ Value/Status                                     │"
  );
  console.log(
    "├─────────────────────────────────────┼──────────────────────────────────────────────────┤"
  );
  console.log(
    "│ pattern.atr                         │ ✅ Calculated from historical bars               │"
  );
  console.log(
    "│ pattern.trend                       │ ✅ Calculated from EMA comparison                │"
  );
  console.log(
    "│ pattern.market_regime               │ ✅ Calculated from price/EMA relationship        │"
  );
  console.log(
    "│ pattern.breakout_bullish            │ ❌ NOT PROVIDED (always undefined)               │"
  );
  console.log(
    "│ pattern.breakout_bearish            │ ❌ NOT PROVIDED (always undefined)               │"
  );
  console.log(
    "│ pattern.near_orb_high               │ ❌ NOT PROVIDED                                  │"
  );
  console.log(
    "│ pattern.near_swing_high             │ ❌ NOT PROVIDED                                  │"
  );
  console.log(
    "│ optionsData                         │ ❌ NOT PROVIDED (null in backtests)              │"
  );
  console.log(
    "│ session.minutesSinceOpen            │ ✅ FIXED - Now calculated from timestamp         │"
  );
  console.log(
    "│ session.isRegularHours              │ ✅ FIXED - Now checks market hours               │"
  );
  console.log(
    "│ rsi.14                              │ ✅ Calculated from historical bars               │"
  );
  console.log(
    "│ ema.9/21/50                         │ ✅ Calculated from historical bars               │"
  );
  console.log(
    "│ vwap.distancePct                    │ ✅ Calculated if volume data available           │"
  );
  console.log(
    "│ volume.relativeToAvg                │ ✅ Calculated from historical bars               │"
  );
  console.log(
    "└─────────────────────────────────────┴──────────────────────────────────────────────────┘"
  );

  console.log("\n\n🚫 BLOCKERS BY DETECTOR:\n");

  for (const { name, requiresOptions } of ZERO_TRADE_DETECTORS) {
    console.log(`\n${name}:`);
    if (requiresOptions) {
      console.log("  ❌ BLOCKED: Requires optionsData which BacktestEngine doesn't provide");
      console.log("     This detector CANNOT be backtested without options chain data.");
      console.log("     Options needed: dealerNetGamma, maxGammaStrike, maxPainStrike, etc.");
    } else if (name.startsWith("breakout")) {
      console.log("  ❌ BLOCKED: Requires pattern.breakout_bullish/bearish flag");
      console.log("     BacktestEngine only computes: atr, trend, market_regime");
      console.log("     Missing: breakout detection, ORB levels, swing levels, resistance levels");
    } else if (name.startsWith("power_hour")) {
      console.log("  ⚠️  PARTIAL: Should work now with minutesSinceOpen fix");
      console.log("     Requires: minutesSinceOpen >= 300 (after 2:30 PM ET)");
      console.log(
        "     May have 0 trades if database doesn't contain power hour bars (3:00-4:00 PM)"
      );
    }
  }

  console.log("\n\n💡 RECOMMENDATIONS:\n");
  console.log("1. OPTIONS-DEPENDENT DETECTORS (gamma_*, eod_pin):");
  console.log("   - Cannot be backtested without historical options data");
  console.log("   - Would need to store options snapshots in database");
  console.log("   - Alternative: Disable in optimizer, enable only for live trading");
  console.log("");
  console.log("2. BREAKOUT DETECTORS:");
  console.log("   - Need to compute breakout flags in BacktestEngine");
  console.log("   - Options:");
  console.log("     a) Add breakout detection to reconstructFeatures()");
  console.log("     b) Store pre-computed breakout flags in historical_bars");
  console.log("     c) Disable until live data provides these flags");
  console.log("");
  console.log("3. POWER_HOUR DETECTORS:");
  console.log("   - Should work now with minutesSinceOpen fix");
  console.log("   - Check if database has bars from 3:00-4:00 PM ET");
  console.log("   - May need to backfill historical data for this time window");

  // Let's actually test power_hour to see why it might still have issues
  console.log("\n\n🧪 TESTING POWER_HOUR DETECTORS:\n");

  const config = {
    ...DEFAULT_BACKTEST_CONFIG,
    symbols: ["SPY"],
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  };

  try {
    const engine = new BacktestEngine(config);

    console.log("Running power_hour_reversal_bullish...");
    const bullishStats = await engine.backtestDetector(powerHourReversalBullishDetector);
    console.log(
      `  Trades: ${bullishStats.totalTrades}, Win Rate: ${(bullishStats.winRate * 100).toFixed(1)}%`
    );

    console.log("Running power_hour_reversal_bearish...");
    const bearishStats = await engine.backtestDetector(powerHourReversalBearishDetector);
    console.log(
      `  Trades: ${bearishStats.totalTrades}, Win Rate: ${(bearishStats.winRate * 100).toFixed(1)}%`
    );

    if (bullishStats.totalTrades === 0 && bearishStats.totalTrades === 0) {
      console.log("\n⚠️  Both power_hour detectors still have 0 trades.");
      console.log("   Let's check if database has power hour bars...");
    }
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }

  console.log("\n✅ Diagnostic complete\n");
}

main().catch(console.error);
