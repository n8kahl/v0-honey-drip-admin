import { EventDrivenBacktestEngine } from "../../src/lib/backtest/EventDrivenBacktestEngine.js";
import {
  BACKTESTABLE_DETECTORS_WITH_KCU,
  FLOW_PRIMARY_DETECTORS,
} from "../../src/lib/composite/detectors/index.js";
import { readFileSync } from "fs";
import { join } from "path";
import "dotenv/config";

async function runOptimizedReport() {
  console.log("===========================================");
  console.log("📊 OPTIMIZED STRATEGY PERFORMANCE REPORT");
  console.log("===========================================\n");

  // 1. Load Optimized Params
  let params;
  try {
    const path = join(process.cwd(), "config", "optimized-params.json");
    const raw = readFileSync(path, "utf-8");
    const fullConfig = JSON.parse(raw);
    params = fullConfig.parameters;
    console.log(`✅ Loaded Optimized Parameters (Phase ${fullConfig.phase}):`);
    console.log(`   Target: ${params.riskReward.targetMultiple}x ATR`);
    console.log(`   Stop: ${params.riskReward.stopMultiple}x ATR`);
    console.log(`   Min Score (Overridden for Report): 40\n`);
  } catch (e) {
    console.error("❌ Could not load optimized-params.json. Run optimizer first.");
    return;
  }
  // Set

  // Force silence common debug logs
  const originalLog = console.log;
  console.log = (...args) => {
    if (args[0]?.includes("shouldRun") || args[0]?.includes("Testing")) return;
    originalLog(...args);
  };

  // 2. Initialize Engine with Optimized Params
  const day30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const engine = new EventDrivenBacktestEngine({
    targetMultiple: params.riskReward.targetMultiple,
    stopMultiple: params.riskReward.stopMultiple,
    maxHoldBars: params.riskReward.maxHoldBars,
    symbols: ["SPY", "TSLA", "NVDA", "MSFT", "AMD"],
    startDate: day30,
    endDate: today,
    enableTrailingStop: true,
  });

  const detectors = [...BACKTESTABLE_DETECTORS_WITH_KCU, ...FLOW_PRIMARY_DETECTORS];
  const results = [];

  originalLog(`\n🧪 Analyzing ${detectors.length} detectors using Optimized Parameters...\n`);

  for (const detector of detectors) {
    if (!detector) continue;

    const stats = await engine.runDetector(detector);
    results.push(stats);
    originalLog(
      `✅ ${detector.type.padEnd(25)} | WR: ${(stats.winRate * 100).toFixed(1)}% | PF: ${stats.profitFactor.toFixed(2)} | Trades: ${stats.totalTrades}`
    );
  }

  // Restore logs for final report
  console.log = originalLog;

  // 3. Final Summary Table
  console.log("\n===========================================");
  console.log("🏆 PERFORMANCE RANKING");
  console.log("===========================================\n");

  results.sort((a, b) => b.winRate - a.winRate);

  console.log("STRATEGY".padEnd(35) + "WIN RATE".padEnd(15) + "PF".padEnd(10) + "TRADES");
  console.log("-".repeat(70));

  for (const r of results) {
    const wr = (r.winRate * 100).toFixed(1) + "%";
    const pf = r.profitFactor.toFixed(2);
    console.log(`${r.detector.padEnd(35)}${wr.padEnd(15)}${pf.padEnd(10)}${r.totalTrades}`);
  }

  const totalTrades = results.reduce((s, r) => s + r.totalTrades, 0);
  const avgWinRate = results.reduce((s, r) => s + r.winRate, 0) / results.length;

  console.log("-".repeat(70));
  console.log(
    `TOTALS`.padEnd(35) +
      `${(avgWinRate * 100).toFixed(1)}%`.padEnd(15) +
      "".padEnd(10) +
      totalTrades
  );
}

runOptimizedReport().catch(console.error);
