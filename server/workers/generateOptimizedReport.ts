import { EventDrivenBacktestEngine } from "../../src/lib/backtest/EventDrivenBacktestEngine.js";
import {
  BACKTESTABLE_DETECTORS_WITH_KCU,
  FLOW_PRIMARY_DETECTORS,
} from "../../src/lib/composite/detectors/index.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import "dotenv/config";

// ============================================================================
// Constants
// ============================================================================

/** Default minimum trades required for a detector to be considered statistically significant */
export const DEFAULT_MIN_TRADES = 30;

/** Default window in days for the backtest */
export const DEFAULT_WINDOW_DAYS = 30;

/** Weight for win rate in composite score (0-1) */
export const WIN_RATE_WEIGHT = 0.6;

/** Weight for profit factor in composite score (0-1) */
export const PROFIT_FACTOR_WEIGHT = 0.4;

/** Maximum expected profit factor for normalization */
export const MAX_PROFIT_FACTOR = 5.0;

// ============================================================================
// Types for JSON Report
// ============================================================================

export interface DetectorStats {
  detector: string;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgHoldBars?: number;
  expectancy?: number;
  wins?: number;
  losses?: number;
  /** Composite score for ranking: (winRate * 0.6) + (normalizedPF * 0.4) */
  compositeScore?: number;
  /** Whether this detector has sufficient sample size */
  hasSufficientSample?: boolean;
  /** Recommended trading style (if available from detector) */
  recommendedStyle?: "scalp" | "day_trade" | "swing" | "unknown";
}

export interface ThresholdsUsed {
  minTrades: number;
  windowDays: number;
}

export interface OptimizedReport {
  timestamp: string;
  parametersSummary: {
    targetMultiple: number;
    stopMultiple: number;
    maxHoldBars: number;
  };
  /** Thresholds used for filtering */
  thresholdsUsed: ThresholdsUsed;
  /** All detectors regardless of sample size */
  allDetectors: DetectorStats[];
  /** Top detectors with sufficient sample size, sorted by composite score */
  topDetectors: DetectorStats[];
  /** Detectors with insufficient sample size */
  lowSampleDetectors: DetectorStats[];
  /** Legacy field for backward compatibility */
  perDetectorStats: DetectorStats[];
  /** Legacy field - ranking by composite score */
  ranking: string[];
  testedSymbols: string[];
  windowStartDate: string;
  windowEndDate: string;
  totalTrades: number;
  avgWinRate: number;
  avgProfitFactor: number;
}

// ============================================================================
// Pure Functions for Ranking and Filtering (Exported for Testing)
// ============================================================================

/**
 * Normalize profit factor to 0-1 range for composite scoring.
 * PF of 0 = 0, PF of MAX_PROFIT_FACTOR or higher = 1
 */
export function normalizeProfitFactor(pf: number, maxPf: number = MAX_PROFIT_FACTOR): number {
  if (!isFinite(pf) || pf <= 0) return 0;
  return Math.min(pf / maxPf, 1);
}

/**
 * Calculate composite score for a detector.
 * score = (winRate * WIN_RATE_WEIGHT) + (normalizedPF * PROFIT_FACTOR_WEIGHT)
 *
 * @param winRate - Win rate as decimal (0-1)
 * @param profitFactor - Profit factor (0+)
 * @returns Composite score between 0-1
 */
export function calculateCompositeScore(winRate: number, profitFactor: number): number {
  const normalizedPf = normalizeProfitFactor(profitFactor);
  return winRate * WIN_RATE_WEIGHT + normalizedPf * PROFIT_FACTOR_WEIGHT;
}

/**
 * Enrich detector stats with composite score and sample size flag.
 */
export function enrichDetectorStats(
  stats: DetectorStats,
  minTrades: number = DEFAULT_MIN_TRADES
): DetectorStats {
  return {
    ...stats,
    compositeScore: calculateCompositeScore(stats.winRate, stats.profitFactor),
    hasSufficientSample: stats.totalTrades >= minTrades,
  };
}

/**
 * Filter detectors into top (sufficient sample) and low sample groups.
 */
export function filterDetectorsBySampleSize(
  detectors: DetectorStats[],
  minTrades: number = DEFAULT_MIN_TRADES
): { topDetectors: DetectorStats[]; lowSampleDetectors: DetectorStats[] } {
  const enriched = detectors.map((d) => enrichDetectorStats(d, minTrades));

  const topDetectors = enriched
    .filter((d) => d.hasSufficientSample)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  const lowSampleDetectors = enriched
    .filter((d) => !d.hasSufficientSample)
    .sort((a, b) => b.totalTrades - a.totalTrades); // Sort by trades descending

  return { topDetectors, lowSampleDetectors };
}

/**
 * Rank detectors by composite score.
 * Returns detector names in order of composite score (highest first).
 */
export function rankDetectorsByCompositeScore(detectors: DetectorStats[]): string[] {
  return [...detectors]
    .map((d) => ({
      ...d,
      compositeScore: calculateCompositeScore(d.winRate, d.profitFactor),
    }))
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .map((d) => d.detector);
}

/**
 * Group detectors by recommended style.
 * Calculates composite scores if not already present.
 */
export function groupDetectorsByStyle(detectors: DetectorStats[]): Record<string, DetectorStats[]> {
  const groups: Record<string, DetectorStats[]> = {
    scalp: [],
    day_trade: [],
    swing: [],
    unknown: [],
  };

  for (const d of detectors) {
    const style = d.recommendedStyle ?? "unknown";
    // Ensure composite score is calculated
    const withScore: DetectorStats =
      d.compositeScore !== undefined
        ? d
        : { ...d, compositeScore: calculateCompositeScore(d.winRate, d.profitFactor) };

    if (groups[style]) {
      groups[style].push(withScore);
    } else {
      groups.unknown.push(withScore);
    }
  }

  // Sort each group by composite score (highest first)
  for (const style of Object.keys(groups)) {
    groups[style].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  }

  return groups;
}

/**
 * Calculate average win rate, excluding detectors with 0 trades.
 */
export function calculateAverageWinRate(detectors: DetectorStats[]): number {
  const withTrades = detectors.filter((d) => d.totalTrades > 0);
  if (withTrades.length === 0) return 0;
  return withTrades.reduce((sum, d) => sum + d.winRate, 0) / withTrades.length;
}

/**
 * Calculate average profit factor, excluding invalid values.
 */
export function calculateAverageProfitFactor(detectors: DetectorStats[]): number {
  const valid = detectors.filter((d) => d.profitFactor > 0 && isFinite(d.profitFactor));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, d) => sum + d.profitFactor, 0) / valid.length;
}

// ============================================================================
// Main Report Generation
// ============================================================================

async function runOptimizedReport() {
  console.log("===========================================");
  console.log("📊 OPTIMIZED STRATEGY PERFORMANCE REPORT");
  console.log("===========================================\n");

  // Configuration
  const minTrades = DEFAULT_MIN_TRADES;
  const windowDays = DEFAULT_WINDOW_DAYS;

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
    console.log(`   Min Trades for Ranking: ${minTrades}`);
    console.log(`   Window: ${windowDays} days\n`);
  } catch (e) {
    console.error("❌ Could not load optimized-params.json. Run optimizer first.");
    return;
  }

  // Force silence common debug logs
  const originalLog = console.log;
  console.log = (...args) => {
    if (args[0]?.includes?.("shouldRun") || args[0]?.includes?.("Testing")) return;
    originalLog(...args);
  };

  // 2. Initialize Engine with Optimized Params
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const engine = new EventDrivenBacktestEngine({
    targetMultiple: params.riskReward.targetMultiple,
    stopMultiple: params.riskReward.stopMultiple,
    maxHoldBars: params.riskReward.maxHoldBars,
    symbols: ["SPY", "TSLA", "NVDA", "MSFT", "AMD"],
    startDate: windowStart,
    endDate: today,
    enableTrailingStop: true,
  });

  const detectors = [...BACKTESTABLE_DETECTORS_WITH_KCU, ...FLOW_PRIMARY_DETECTORS];
  const results: DetectorStats[] = [];

  originalLog(`\n🧪 Analyzing ${detectors.length} detectors using Optimized Parameters...\n`);

  for (const detector of detectors) {
    if (!detector) continue;

    const stats = await engine.runDetector(detector);

    // Try to get recommended style from detector if available
    const recommendedStyle = (detector as any).recommendedStyle ?? "unknown";

    results.push({
      detector: stats.detector,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      totalTrades: stats.totalTrades,
      avgHoldBars: stats.avgHoldBars,
      expectancy: stats.expectancy,
      wins: stats.wins,
      losses: stats.losses,
      recommendedStyle,
    });

    originalLog(
      `✅ ${detector.type.padEnd(25)} | WR: ${(stats.winRate * 100).toFixed(1)}% | PF: ${stats.profitFactor.toFixed(2)} | Trades: ${stats.totalTrades}`
    );
  }

  // Restore logs for final report
  console.log = originalLog;

  // 3. Filter and rank detectors
  const { topDetectors, lowSampleDetectors } = filterDetectorsBySampleSize(results, minTrades);
  const allDetectors = results.map((d) => enrichDetectorStats(d, minTrades));

  // 4. Final Summary Table
  console.log("\n===========================================");
  console.log("🏆 TOP DETECTORS (Sufficient Sample Size)");
  console.log(`   Minimum trades required: ${minTrades}`);
  console.log("===========================================\n");

  if (topDetectors.length === 0) {
    console.log("⚠️  No detectors met the minimum trade threshold.");
    console.log(`   Consider running a longer backtest window or lowering minTrades.\n`);
  } else {
    console.log(
      "STRATEGY".padEnd(35) +
        "SCORE".padEnd(10) +
        "WIN RATE".padEnd(12) +
        "PF".padEnd(10) +
        "TRADES"
    );
    console.log("-".repeat(77));

    for (const r of topDetectors) {
      const score = ((r.compositeScore ?? 0) * 100).toFixed(1);
      const wr = (r.winRate * 100).toFixed(1) + "%";
      const pf = r.profitFactor.toFixed(2);
      console.log(
        `${r.detector.padEnd(35)}${score.padEnd(10)}${wr.padEnd(12)}${pf.padEnd(10)}${r.totalTrades}`
      );
    }
  }

  // Show low sample detectors
  if (lowSampleDetectors.length > 0) {
    console.log("\n-------------------------------------------");
    console.log("⚠️  LOW SAMPLE SIZE (excluded from ranking)");
    console.log("-------------------------------------------\n");

    console.log(
      "STRATEGY".padEnd(35) +
        "WIN RATE".padEnd(12) +
        "PF".padEnd(10) +
        "TRADES".padEnd(10) +
        "NEEDED"
    );
    console.log("-".repeat(77));

    for (const r of lowSampleDetectors.slice(0, 10)) {
      const wr = (r.winRate * 100).toFixed(1) + "%";
      const pf = r.profitFactor.toFixed(2);
      const needed = minTrades - r.totalTrades;
      console.log(
        `${r.detector.padEnd(35)}${wr.padEnd(12)}${pf.padEnd(10)}${String(r.totalTrades).padEnd(10)}+${needed}`
      );
    }

    if (lowSampleDetectors.length > 10) {
      console.log(`... and ${lowSampleDetectors.length - 10} more with low sample size`);
    }
  }

  // Totals
  const totalTrades = results.reduce((s, r) => s + r.totalTrades, 0);
  const avgWinRate = calculateAverageWinRate(results);
  const avgProfitFactor = calculateAverageProfitFactor(results);

  console.log("\n-------------------------------------------");
  console.log(
    `TOTALS`.padEnd(35) +
      ``.padEnd(10) +
      `${(avgWinRate * 100).toFixed(1)}%`.padEnd(12) +
      `${avgProfitFactor.toFixed(2)}`.padEnd(10) +
      totalTrades
  );

  // 5. Build and Write JSON Report
  const report: OptimizedReport = {
    timestamp: new Date().toISOString(),
    parametersSummary: {
      targetMultiple: params.riskReward.targetMultiple,
      stopMultiple: params.riskReward.stopMultiple,
      maxHoldBars: params.riskReward.maxHoldBars,
    },
    thresholdsUsed: {
      minTrades,
      windowDays,
    },
    allDetectors,
    topDetectors,
    lowSampleDetectors,
    // Legacy fields for backward compatibility
    perDetectorStats: allDetectors,
    ranking: topDetectors.map((d) => d.detector),
    testedSymbols: ["SPY", "TSLA", "NVDA", "MSFT", "AMD"],
    windowStartDate: windowStart,
    windowEndDate: today,
    totalTrades,
    avgWinRate,
    avgProfitFactor: isNaN(avgProfitFactor) ? 0 : avgProfitFactor,
  };

  // Write JSON report to config directory
  const configDir = join(process.cwd(), "config");
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const reportPath = join(configDir, "optimized-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ JSON report written to: ${reportPath}`);
  console.log(`   Top detectors: ${topDetectors.length}`);
  console.log(`   Low sample detectors: ${lowSampleDetectors.length}`);
}

runOptimizedReport().catch(console.error);
