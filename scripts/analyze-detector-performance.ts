#!/usr/bin/env tsx
/**
 * Analyze backtest performance broken down by detector type
 *
 * Usage: tsx scripts/analyze-detector-performance.ts
 */

import { BacktestEngine } from "../src/lib/backtest/BacktestEngine.js";
import { BacktestResult } from "../src/lib/backtest/types.js";
import {
  BreakoutBullish,
  BreakoutBearish,
  ORBBreakout,
  MomentumContinuation,
  MeanReversionBullish,
  MeanReversionBearish,
  TrendContinuationLong,
  TrendContinuationShort,
  SwingReversal,
  LiquidityGrab,
  VolatilityContraction,
  GapFill,
} from "../src/lib/composite/detectors/index.js";

const SYMBOLS = ["SPY", "QQQ", "IWM", "DIA"];
const START_DATE = "2024-01-01";
const END_DATE = "2024-11-26";

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

async function analyzeDetector(name: string, detector: any): Promise<DetectorStats> {
  console.log(`\n📊 Testing ${name}...`);

  const engine = new BacktestEngine({
    startDate: START_DATE,
    endDate: END_DATE,
    targetMultiple: 2.0,
    stopMultiple: 1.0,
    maxHoldBars: 30,
    slippage: 0.001,
  });

  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalProfitPct = 0;
  let totalLossPct = 0;

  for (const symbol of SYMBOLS) {
    try {
      const result: BacktestResult = await engine.backtestDetector(symbol, detector);

      totalTrades += result.totalTrades;
      totalWins += result.winningTrades;
      totalLosses += result.losingTrades;

      // Accumulate profit/loss
      for (const trade of result.trades) {
        if (trade.profitPercent > 0) {
          totalProfitPct += trade.profitPercent;
        } else {
          totalLossPct += Math.abs(trade.profitPercent);
        }
      }

      console.log(`  ${symbol}: ${result.totalTrades} trades, ${result.winRate.toFixed(1)}% WR`);
    } catch (error) {
      console.log(`  ${symbol}: Error - ${error.message}`);
    }
  }

  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const avgWin = totalWins > 0 ? totalProfitPct / totalWins : 0;
  const avgLoss = totalLosses > 0 ? totalLossPct / totalLosses : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * totalWins) / (avgLoss * totalLosses) : 0;

  return {
    name,
    trades: totalTrades,
    wins: totalWins,
    losses: totalLosses,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
  };
}

async function main() {
  console.log("🔬 Detector Performance Analysis");
  console.log("=".repeat(80));
  console.log(`Symbols: ${SYMBOLS.join(", ")}`);
  console.log(`Period: ${START_DATE} to ${END_DATE}`);
  console.log(`Config: 2:1 R:R, 30 bar max hold\n`);

  const detectors = [
    { name: "Breakout Bullish", detector: BreakoutBullish },
    { name: "Breakout Bearish", detector: BreakoutBearish },
    { name: "ORB Breakout", detector: ORBBreakout },
    { name: "Momentum Continuation", detector: MomentumContinuation },
    { name: "Mean Reversion Bullish", detector: MeanReversionBullish },
    { name: "Mean Reversion Bearish", detector: MeanReversionBearish },
    { name: "Trend Continuation Long", detector: TrendContinuationLong },
    { name: "Trend Continuation Short", detector: TrendContinuationShort },
    { name: "Swing Reversal", detector: SwingReversal },
    { name: "Liquidity Grab", detector: LiquidityGrab },
    { name: "Volatility Contraction", detector: VolatilityContraction },
    { name: "Gap Fill", detector: GapFill },
  ];

  const results: DetectorStats[] = [];

  for (const { name, detector } of detectors) {
    try {
      const stats = await analyzeDetector(name, detector);
      results.push(stats);
    } catch (error) {
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
