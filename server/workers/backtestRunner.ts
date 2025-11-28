/**
 * Backtest Runner
 * Phase 3: Run all detectors on historical data and generate performance reports
 *
 * Usage:
 *   pnpm backtest              # Run all detectors
 *   pnpm backtest --detector MOMENTUM_BREAKOUT  # Run single detector
 *   pnpm backtest --symbol SPY  # Run on single symbol
 */

// Load environment variables from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  BacktestEngine,
  type BacktestStats,
  DEFAULT_BACKTEST_CONFIG,
} from "../../src/lib/backtest/BacktestEngine.js";
import { ALL_DETECTORS } from "../../src/lib/composite/detectors/index.js";
import * as fs from "fs";
import * as path from "path";

// Parse command line arguments
const args = process.argv.slice(2);
const detectorFilter = args.find((arg) => arg.startsWith("--detector="))?.split("=")[1];
const symbolFilter = args.find((arg) => arg.startsWith("--symbol="))?.split("=")[1];
const outputDir =
  args.find((arg) => arg.startsWith("--output="))?.split("=")[1] || "./backtest-results";

interface BacktestReport {
  timestamp: string;
  config: typeof DEFAULT_BACKTEST_CONFIG;
  results: BacktestStats[];
  summary: {
    totalDetectors: number;
    totalTrades: number;
    overallWinRate: number;
    bestDetector: string;
    worstDetector: string;
    avgProfitFactor: number;
    avgExpectancy: number;
  };
}

/**
 * Main backtest runner
 */
async function runBacktests() {
  console.log("\n===========================================");
  console.log("🧪 BACKTEST RUNNER - Phase 3");
  console.log("===========================================\n");

  // Initialize engine
  const config = { ...DEFAULT_BACKTEST_CONFIG };
  if (symbolFilter) {
    config.symbols = [symbolFilter];
  }

  const engine = new BacktestEngine(config);

  console.log("Configuration:");
  console.log(`  Symbols: ${config.symbols.join(", ")}`);
  console.log(`  Date Range: ${config.startDate} to ${config.endDate}`);
  console.log(`  Timeframe: ${config.timeframe}`);
  console.log(`  Target: ${config.targetMultiple}R`);
  console.log(`  Stop: ${config.stopMultiple}R`);
  console.log(`  Max Hold: ${config.maxHoldBars} bars`);
  console.log();

  // Filter detectors
  const detectorsToTest = detectorFilter
    ? ALL_DETECTORS.filter((d) => d.type === detectorFilter)
    : ALL_DETECTORS;

  if (detectorsToTest.length === 0) {
    console.error(`❌ No detectors found matching: ${detectorFilter}`);
    process.exit(1);
  }

  console.log(`Testing ${detectorsToTest.length} detector(s)...\n`);

  // Run backtests
  const results: BacktestStats[] = [];
  const startTime = Date.now();

  for (const detector of detectorsToTest) {
    try {
      const stats = await engine.backtestDetector(detector);
      results.push(stats);

      // Print summary
      printDetectorSummary(stats);
    } catch (error) {
      console.error(`❌ Error testing ${detector.type}:`, error);
    }
  }

  const duration = Date.now() - startTime;

  // Generate report
  const report = generateReport(config, results, duration);

  // Save to file
  saveReport(report, outputDir);

  // Print final summary
  printFinalSummary(report);

  process.exit(0);
}

/**
 * Print detector summary
 */
function printDetectorSummary(stats: BacktestStats) {
  const winRateColor = stats.winRate >= 0.65 ? "✅" : stats.winRate >= 0.55 ? "⚠️ " : "❌";
  const pfColor = stats.profitFactor >= 2.0 ? "✅" : stats.profitFactor >= 1.5 ? "⚠️ " : "❌";

  console.log(`\n${stats.detector}:`);
  console.log(`  Trades: ${stats.totalTrades}`);
  console.log(`  ${winRateColor} Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
  console.log(`  ${pfColor} Profit Factor: ${stats.profitFactor.toFixed(2)}`);
  console.log(`  Expectancy: ${stats.expectancy.toFixed(2)}R`);
  console.log(`  Avg Win: +${stats.avgWin.toFixed(2)}% (${stats.avgWinBars.toFixed(0)} bars)`);
  console.log(`  Avg Loss: ${stats.avgLoss.toFixed(2)}% (${stats.avgLossBars.toFixed(0)} bars)`);
  console.log(`  Total P&L: ${stats.totalPnlPercent.toFixed(2)}%`);
}

/**
 * Generate backtest report
 */
function generateReport(
  config: typeof DEFAULT_BACKTEST_CONFIG,
  results: BacktestStats[],
  duration: number
): BacktestReport {
  // Calculate summary stats
  const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
  const totalWinners = results.reduce((sum, r) => sum + r.winners, 0);
  const overallWinRate = totalTrades > 0 ? totalWinners / totalTrades : 0;

  const avgProfitFactor = results.reduce((sum, r) => sum + r.profitFactor, 0) / results.length;
  const avgExpectancy = results.reduce((sum, r) => sum + r.expectancy, 0) / results.length;

  // Find best/worst detectors
  const sortedByWinRate = [...results].sort((a, b) => b.winRate - a.winRate);
  const bestDetector = sortedByWinRate[0]?.detector || "N/A";
  const worstDetector = sortedByWinRate[sortedByWinRate.length - 1]?.detector || "N/A";

  return {
    timestamp: new Date().toISOString(),
    config,
    results,
    summary: {
      totalDetectors: results.length,
      totalTrades,
      overallWinRate,
      bestDetector,
      worstDetector,
      avgProfitFactor,
      avgExpectancy,
    },
  };
}

/**
 * Save report to JSON file
 */
function saveReport(report: BacktestReport, outputDir: string) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const filename = `backtest-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  // Write JSON
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  console.log(`\n📄 Report saved to: ${filepath}`);

  // Generate CSV for easy analysis in Excel
  const csvFilename = `backtest-${timestamp}.csv`;
  const csvPath = path.join(outputDir, csvFilename);
  generateCSV(report, csvPath);

  console.log(`📊 CSV saved to: ${csvPath}`);
}

/**
 * Generate CSV report
 */
function generateCSV(report: BacktestReport, filepath: string) {
  const headers = [
    "Detector",
    "Total Trades",
    "Winners",
    "Losers",
    "Win Rate %",
    "Profit Factor",
    "Expectancy (R)",
    "Avg Win %",
    "Avg Loss %",
    "Largest Win %",
    "Largest Loss %",
    "Total P&L %",
    "Avg Bars Held",
  ].join(",");

  const rows = report.results.map((r) => {
    return [
      r.detector,
      r.totalTrades,
      r.winners,
      r.losers,
      (r.winRate * 100).toFixed(1),
      r.profitFactor.toFixed(2),
      r.expectancy.toFixed(2),
      r.avgWin.toFixed(2),
      r.avgLoss.toFixed(2),
      r.largestWin.toFixed(2),
      r.largestLoss.toFixed(2),
      r.totalPnlPercent.toFixed(2),
      r.avgBarsHeld.toFixed(1),
    ].join(",");
  });

  const csv = [headers, ...rows].join("\n");
  fs.writeFileSync(filepath, csv);
}

/**
 * Print final summary
 */
function printFinalSummary(report: BacktestReport) {
  console.log("\n===========================================");
  console.log("📊 BACKTEST SUMMARY");
  console.log("===========================================\n");

  console.log(`Detectors Tested: ${report.summary.totalDetectors}`);
  console.log(`Total Trades: ${report.summary.totalTrades}`);
  console.log(`Overall Win Rate: ${(report.summary.overallWinRate * 100).toFixed(1)}%`);
  console.log(`Avg Profit Factor: ${report.summary.avgProfitFactor.toFixed(2)}`);
  console.log(`Avg Expectancy: ${report.summary.avgExpectancy.toFixed(2)}R`);
  console.log();

  console.log("🏆 Top Performers:");
  const sorted = [...report.results].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
  sorted.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.detector.padEnd(30)} ${(r.winRate * 100).toFixed(1)}% (${r.totalTrades} trades, ${r.profitFactor.toFixed(2)} PF)`
    );
  });

  console.log("\n📉 Needs Improvement:");
  const bottom = [...report.results].sort((a, b) => a.winRate - b.winRate).slice(0, 3);
  bottom.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.detector.padEnd(30)} ${(r.winRate * 100).toFixed(1)}% (${r.totalTrades} trades, ${r.profitFactor.toFixed(2)} PF)`
    );
  });

  console.log("\n===========================================");
  console.log("✅ Backtest Complete!");
  console.log("===========================================\n");

  // Recommendations
  console.log("💡 Recommendations:");
  const highPerformers = report.results.filter((r) => r.winRate >= 0.65 && r.totalTrades >= 10);
  const lowPerformers = report.results.filter((r) => r.winRate < 0.45 && r.totalTrades >= 10);

  if (highPerformers.length > 0) {
    console.log(`  ✅ ${highPerformers.length} detector(s) meet 65%+ win rate target`);
    console.log(
      `     Consider increasing weight for: ${highPerformers.map((r) => r.detector).join(", ")}`
    );
  } else {
    console.log(`  ⚠️  No detectors meet 65%+ win rate target`);
    console.log(`     Consider optimizing detector logic or confluence weights`);
  }

  if (lowPerformers.length > 0) {
    console.log(`  ❌ ${lowPerformers.length} detector(s) have <45% win rate`);
    console.log(`     Consider disabling: ${lowPerformers.map((r) => r.detector).join(", ")}`);
  }

  console.log();
}

// Run backtests
runBacktests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
