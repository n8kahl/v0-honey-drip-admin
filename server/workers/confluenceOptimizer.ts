/**
 * Confluence Optimizer Worker - Phase 4 Production-Ready
 *
 * Uses a Genetic Algorithm to find optimal parameters for strategy detectors
 * using the advanced EventDrivenBacktestEngine (MTF + Flow aware).
 *
 * Features:
 * - Fetches active strategies from database where auto_optimize = true
 * - Optimizes each strategy using EventDrivenBacktestEngine
 * - Updates pending_params and last_optimized_at (does NOT overwrite live params)
 * - Compares old vs new expectancy in logs
 * - Graceful error handling with continued operation
 *
 * Maximizes Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EventDrivenBacktestEngine } from "../../src/lib/backtest/EventDrivenBacktestEngine.js";
import { BacktestStats } from "../../src/lib/backtest/types.js";
import {
  ALL_DETECTORS,
  BACKTESTABLE_DETECTORS_WITH_KCU,
  FLOW_PRIMARY_DETECTORS,
} from "../../src/lib/composite/detectors/index.js";
import type { OpportunityDetector } from "../../src/lib/composite/OpportunityDetector.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

// Configuration
const SCAN_INTERVAL = 24 * 60 * 60 * 1000; // Run once per day
const DEFAULT_POPULATION_SIZE = 15;
const DEFAULT_GENERATIONS = 5;

// Supabase client with service role key for server-side operations
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Singleton Supabase client
let supabaseClient: SupabaseClient<any> | null = null;

function getSupabaseClient(): SupabaseClient<any> | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

// ============================================================================
// Types
// ============================================================================

interface OptimizationParams {
  riskReward: {
    targetMultiple: number; // 1.5 - 4.0
    stopMultiple: number; // 0.8 - 1.5
    maxHoldBars: number; // 12 - 96
  };
  consensus: {
    minScore: number; // 50 - 80
  };
}

interface Individual {
  params: OptimizationParams;
  fitness: number;
  expectancy: number;
  stats?: BacktestAggregateStats;
}

interface BacktestAggregateStats {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
}

interface StrategyRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  bar_timeframe: string;
  entry_side: string;
  conditions: any;
  baseline_expectancy: number | null;
  pending_params: any | null;
  last_optimized_at: string | null;
}

interface GAConfig {
  populationSize?: number;
  generations?: number;
  symbols?: string[];
  startDate?: string;
  endDate?: string;
}

interface OptimizationResult {
  strategyId: string;
  strategyName: string;
  oldExpectancy: number;
  newExpectancy: number;
  improvement: number;
  params: OptimizationParams;
  stats: BacktestAggregateStats;
}

// ============================================================================
// Confluence Optimizer Class
// ============================================================================

export class ConfluenceOptimizer {
  private engine: EventDrivenBacktestEngine;
  private population: Individual[] = [];
  private populationSize: number;
  private generations: number;
  private mutationRate = 0.15;
  private symbols: string[];
  private startDate: string;
  private endDate: string;

  constructor(gaConfig?: GAConfig) {
    this.populationSize = gaConfig?.populationSize || DEFAULT_POPULATION_SIZE;
    this.generations = gaConfig?.generations || DEFAULT_GENERATIONS;

    // Default backtest period: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.startDate = gaConfig?.startDate || thirtyDaysAgo.toISOString().split("T")[0];
    this.endDate = gaConfig?.endDate || now.toISOString().split("T")[0];

    // Default symbols for optimization
    this.symbols = gaConfig?.symbols || ["SPY", "QQQ", "AAPL", "TSLA", "NVDA"];

    this.engine = new EventDrivenBacktestEngine({
      symbols: this.symbols,
      startDate: this.startDate,
      endDate: this.endDate,
    });
  }

  // --- Random Helpers ---

  private randomRange(min: number, max: number, decimals: number = 2): number {
    const val = Math.random() * (max - min) + min;
    return Number(val.toFixed(decimals));
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private createRandomIndividual(): Individual {
    return {
      params: {
        riskReward: {
          targetMultiple: this.randomRange(1.5, 4.0),
          stopMultiple: this.randomRange(0.8, 1.5),
          maxHoldBars: this.randomInt(12, 60),
        },
        consensus: {
          minScore: this.randomInt(50, 80),
        },
      },
      fitness: -Infinity,
      expectancy: 0,
    };
  }

  private initPopulation() {
    this.population = [];
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(this.createRandomIndividual());
    }
  }

  // --- Fitness Evaluation ---

  /**
   * Calculate Expectancy: (WinRate * AvgWin) - (LossRate * AvgLoss)
   */
  private calculateExpectancy(stats: BacktestAggregateStats): number {
    const winRate = stats.winRate;
    const lossRate = 1 - winRate;
    const avgWin = Math.abs(stats.avgWin);
    const avgLoss = Math.abs(stats.avgLoss);

    return winRate * avgWin - lossRate * avgLoss;
  }

  /**
   * Evaluate fitness for an individual against a specific detector
   */
  private async evaluateFitnessForDetector(
    ind: Individual,
    detector: OpportunityDetector
  ): Promise<BacktestAggregateStats> {
    // Create engine with individual's parameters
    this.engine = new EventDrivenBacktestEngine({
      symbols: this.symbols,
      startDate: this.startDate,
      endDate: this.endDate,
      targetMultiple: ind.params.riskReward.targetMultiple,
      stopMultiple: ind.params.riskReward.stopMultiple,
      maxHoldBars: ind.params.riskReward.maxHoldBars,
    });

    // Run backtest for the detector
    const stats = await this.engine.runDetector(detector);

    // Aggregate stats
    const aggregateStats: BacktestAggregateStats = {
      totalTrades: stats.totalTrades,
      winRate: stats.winRate,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      profitFactor: stats.profitFactor,
      expectancy: 0, // Calculated below
    };

    aggregateStats.expectancy = this.calculateExpectancy(aggregateStats);

    return aggregateStats;
  }

  /**
   * Full fitness evaluation - runs detector and calculates fitness
   */
  private async evaluateFitness(ind: Individual, detector: OpportunityDetector): Promise<number> {
    const stats = await this.evaluateFitnessForDetector(ind, detector);

    // Safety: Need minimum trades for statistical significance
    if (stats.totalTrades < 10) {
      ind.fitness = -Infinity;
      ind.expectancy = 0;
      ind.stats = stats;
      return -Infinity;
    }

    // Fitness = Expectancy * log(Trades) - encourages both profitability AND sample size
    const expectancy = stats.expectancy;
    const fitness = expectancy * Math.log10(stats.totalTrades + 1);

    ind.fitness = fitness;
    ind.expectancy = expectancy;
    ind.stats = stats;

    return fitness;
  }

  /**
   * Legacy fitness evaluation for all detectors at once
   */
  private async evaluateFitnessAllDetectors(ind: Individual): Promise<number> {
    this.engine = new EventDrivenBacktestEngine({
      symbols: this.symbols,
      startDate: this.startDate,
      endDate: this.endDate,
      targetMultiple: ind.params.riskReward.targetMultiple,
      stopMultiple: ind.params.riskReward.stopMultiple,
      maxHoldBars: ind.params.riskReward.maxHoldBars,
    });

    const results: BacktestStats[] = [];
    const detectors = [...BACKTESTABLE_DETECTORS_WITH_KCU, ...FLOW_PRIMARY_DETECTORS];

    for (const detector of detectors) {
      if (!detector) continue;
      const stats = await this.engine.runDetector(detector);
      results.push(stats);
    }

    // Aggregate results
    let totalTrades = 0;
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;
    let sumAvgWin = 0;
    let sumAvgLoss = 0;
    let winnerCount = 0;
    let loserCount = 0;

    for (const stats of results) {
      totalTrades += stats.totalTrades;
      totalWin += stats.totalPnl > 0 ? stats.totalPnl : 0;
      totalLoss += stats.totalPnl < 0 ? Math.abs(stats.totalPnl) : 0;
      winCount += stats.winners;

      if (stats.avgWin > 0) {
        sumAvgWin += stats.avgWin;
        winnerCount++;
      }
      if (stats.avgLoss < 0) {
        sumAvgLoss += Math.abs(stats.avgLoss);
        loserCount++;
      }
    }

    if (totalTrades === 0) return 0;

    const profitFactor = totalLoss === 0 ? (totalWin > 0 ? 10 : 0) : totalWin / totalLoss;
    const winRate = winCount / totalTrades;
    const avgWin = winnerCount > 0 ? sumAvgWin / winnerCount : 0;
    const avgLoss = loserCount > 0 ? sumAvgLoss / loserCount : 0;

    const aggStats: BacktestAggregateStats = {
      totalTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy: 0,
    };
    aggStats.expectancy = this.calculateExpectancy(aggStats);

    // Fitness Function: Expectancy * log(Trades)
    const fitness = aggStats.expectancy * Math.log10(totalTrades + 1);

    ind.fitness = fitness;
    ind.expectancy = aggStats.expectancy;
    ind.stats = aggStats;

    return fitness;
  }

  // --- Genetic Operators ---

  private tournamentSelection(): Individual {
    const k = 3;
    let best = this.population[Math.floor(Math.random() * this.populationSize)];
    for (let i = 0; i < k; i++) {
      const ind = this.population[Math.floor(Math.random() * this.populationSize)];
      if (ind.fitness > best.fitness) {
        best = ind;
      }
    }
    return best;
  }

  private crossover(p1: Individual, p2: Individual): Individual {
    const child = this.createRandomIndividual();
    // Uniform crossover for each gene
    child.params.riskReward.targetMultiple =
      Math.random() > 0.5
        ? p1.params.riskReward.targetMultiple
        : p2.params.riskReward.targetMultiple;
    child.params.riskReward.stopMultiple =
      Math.random() > 0.5 ? p1.params.riskReward.stopMultiple : p2.params.riskReward.stopMultiple;
    child.params.riskReward.maxHoldBars =
      Math.random() > 0.5 ? p1.params.riskReward.maxHoldBars : p2.params.riskReward.maxHoldBars;
    child.params.consensus.minScore =
      Math.random() > 0.5 ? p1.params.consensus.minScore : p2.params.consensus.minScore;
    return child;
  }

  private mutate(ind: Individual) {
    if (Math.random() < this.mutationRate) {
      ind.params.riskReward.targetMultiple = this.randomRange(1.5, 4.0);
    }
    if (Math.random() < this.mutationRate) {
      ind.params.riskReward.stopMultiple = this.randomRange(0.8, 1.5);
    }
    if (Math.random() < this.mutationRate) {
      ind.params.riskReward.maxHoldBars = this.randomInt(12, 60);
    }
    if (Math.random() < this.mutationRate) {
      ind.params.consensus.minScore = this.randomInt(50, 80);
    }
  }

  // --- Strategy Mapping ---

  /**
   * Map strategy row to detector type
   * This maps database strategy definitions to composite detectors
   */
  private mapStrategyToDetector(strategy: StrategyRow): OpportunityDetector | null {
    const slug = strategy.slug.toLowerCase().replace(/-/g, "_");

    // Search in all detectors
    const allDetectors = [
      ...ALL_DETECTORS,
      ...BACKTESTABLE_DETECTORS_WITH_KCU,
      ...FLOW_PRIMARY_DETECTORS,
    ].filter(Boolean);

    // Exact match first
    for (const detector of allDetectors) {
      if (detector && detector.type === slug) {
        return detector;
      }
    }

    // Try partial matching
    for (const detector of allDetectors) {
      if (detector && (slug.includes(detector.type) || detector.type.includes(slug))) {
        return detector;
      }
    }

    console.warn(
      `[Optimizer] No matching detector found for strategy: ${strategy.name} (${strategy.slug})`
    );
    return null;
  }

  // --- Main Optimization Methods ---

  /**
   * Optimize a single strategy
   */
  public async optimizeStrategy(
    strategy: StrategyRow,
    detector: OpportunityDetector
  ): Promise<OptimizationResult | null> {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Optimizer] Optimizing: ${strategy.name} (${detector.type})`);
    console.log(`${"=".repeat(60)}`);

    // 1. Calculate baseline expectancy (with default params)
    const baselineInd = this.createRandomIndividual();
    baselineInd.params.riskReward = { targetMultiple: 2.0, stopMultiple: 1.0, maxHoldBars: 24 };
    baselineInd.params.consensus = { minScore: 60 };

    const baselineStats = await this.evaluateFitnessForDetector(baselineInd, detector);
    const oldExpectancy = strategy.baseline_expectancy ?? baselineStats.expectancy;

    console.log(`[Optimizer] Baseline Expectancy: ${oldExpectancy.toFixed(4)}`);
    console.log(
      `[Optimizer] Baseline Stats: ${baselineStats.totalTrades} trades, ` +
        `${(baselineStats.winRate * 100).toFixed(1)}% WR, PF=${baselineStats.profitFactor.toFixed(2)}`
    );

    // 2. Initialize population
    this.initPopulation();

    // 3. Run GA generations
    for (let gen = 0; gen < this.generations; gen++) {
      const genStart = Date.now();

      // Evaluate fitness for all unevaluated individuals
      for (const ind of this.population) {
        if (ind.fitness === -Infinity) {
          await this.evaluateFitness(ind, detector);
        }
      }

      // Sort by fitness (descending)
      this.population.sort((a, b) => b.fitness - a.fitness);

      const best = this.population[0];
      const genDuration = ((Date.now() - genStart) / 1000).toFixed(1);

      console.log(
        `[Optimizer] Gen ${gen + 1}/${this.generations}: ` +
          `Exp=${best.expectancy.toFixed(4)} ` +
          `WR=${((best.stats?.winRate || 0) * 100).toFixed(1)}% ` +
          `PF=${(best.stats?.profitFactor || 0).toFixed(2)} ` +
          `Trades=${best.stats?.totalTrades || 0} ` +
          `(${genDuration}s)`
      );

      // Evolve population (except last generation)
      if (gen < this.generations - 1) {
        const newPop: Individual[] = [];

        // Elitism: Keep top 2
        newPop.push(this.population[0]);
        newPop.push(this.population[1]);

        // Generate rest through crossover + mutation
        while (newPop.length < this.populationSize) {
          const p1 = this.tournamentSelection();
          const p2 = this.tournamentSelection();
          const child = this.crossover(p1, p2);
          this.mutate(child);
          newPop.push(child);
        }

        this.population = newPop;
      }
    }

    // 4. Get best result
    const bestOverall = this.population[0];
    const newExpectancy = bestOverall.expectancy;
    const improvement =
      oldExpectancy !== 0 ? ((newExpectancy - oldExpectancy) / Math.abs(oldExpectancy)) * 100 : 0;

    console.log(`\n[Optimizer] === RESULTS for ${strategy.name} ===`);
    console.log(`[Optimizer] Old Expectancy: ${oldExpectancy.toFixed(4)}`);
    console.log(`[Optimizer] New Expectancy: ${newExpectancy.toFixed(4)}`);
    console.log(
      `[Optimizer] Improvement: ${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}%`
    );
    console.log(`[Optimizer] Best Params:`, JSON.stringify(bestOverall.params, null, 2));

    // Only return result if there's actual improvement
    if (newExpectancy <= oldExpectancy && strategy.baseline_expectancy !== null) {
      console.log(`[Optimizer] No improvement - keeping existing params`);
      return null;
    }

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      oldExpectancy,
      newExpectancy,
      improvement,
      params: bestOverall.params,
      stats: bestOverall.stats!,
    };
  }

  /**
   * Fetch strategies from database that are eligible for optimization
   */
  private async fetchOptimizableStrategies(): Promise<StrategyRow[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn("[Optimizer] Supabase not configured - skipping DB fetch");
      return [];
    }

    const { data, error } = await supabase
      .from("strategy_definitions")
      .select(
        "id, name, slug, category, bar_timeframe, entry_side, conditions, baseline_expectancy, pending_params, last_optimized_at"
      )
      .eq("enabled", true)
      .eq("auto_optimize", true);

    if (error) {
      console.error("[Optimizer] Error fetching strategies:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Update strategy with optimized params (pending, not live)
   */
  private async updateStrategyPendingParams(result: OptimizationResult): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn("[Optimizer] Supabase not configured - skipping DB update");
      return false;
    }

    const pendingParams = {
      riskReward: result.params.riskReward,
      consensus: result.params.consensus,
      performance: {
        expectancy: result.newExpectancy,
        winRate: result.stats.winRate,
        profitFactor: result.stats.profitFactor,
        totalTrades: result.stats.totalTrades,
      },
      optimizedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("strategy_definitions")
      .update({
        pending_params: pendingParams,
        baseline_expectancy: result.oldExpectancy,
        last_optimized_at: new Date().toISOString(),
      })
      .eq("id", result.strategyId);

    if (error) {
      console.error(`[Optimizer] Error updating strategy ${result.strategyId}:`, error);
      return false;
    }

    console.log(`[Optimizer] ✅ Updated pending_params for ${result.strategyName}`);
    return true;
  }

  /**
   * Main optimization loop - iterates through all eligible strategies
   */
  public async optimize(): Promise<OptimizationResult[]> {
    console.log("\n" + "=".repeat(70));
    console.log("[Optimizer] Starting Confluence Optimization (Production Worker)");
    console.log("[Optimizer] Backtest Period:", this.startDate, "to", this.endDate);
    console.log("[Optimizer] Symbols:", this.symbols.join(", "));
    console.log("=".repeat(70));

    const results: OptimizationResult[] = [];

    // 1. Fetch eligible strategies
    const strategies = await this.fetchOptimizableStrategies();

    if (strategies.length === 0) {
      console.log("[Optimizer] No strategies found with auto_optimize = true");
      console.log("[Optimizer] Running on all composite detectors instead...");
      return this.optimizeAllDetectors();
    }

    console.log(`[Optimizer] Found ${strategies.length} strategies to optimize\n`);

    // 2. Optimize each strategy
    for (const strategy of strategies) {
      try {
        const detector = this.mapStrategyToDetector(strategy);

        if (!detector) {
          console.log(`[Optimizer] Skipping ${strategy.name} - no matching detector`);
          continue;
        }

        const result = await this.optimizeStrategy(strategy, detector);

        if (result) {
          await this.updateStrategyPendingParams(result);
          results.push(result);
        }
      } catch (error) {
        console.error(`[Optimizer] Error optimizing ${strategy.name}:`, error);
      }
    }

    // 3. Summary
    this.printSummary(strategies.length, results);

    return results;
  }

  /**
   * Fallback: Optimize all composite detectors (legacy behavior)
   */
  private async optimizeAllDetectors(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    const detectors = [...BACKTESTABLE_DETECTORS_WITH_KCU, ...FLOW_PRIMARY_DETECTORS].filter(
      Boolean
    );

    for (const detector of detectors) {
      if (!detector) continue;

      try {
        const mockStrategy: StrategyRow = {
          id: `detector-${detector.type}`,
          name: detector.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          slug: detector.type,
          category: "composite",
          bar_timeframe: detector.idealTimeframe || "15m",
          entry_side: detector.direction,
          conditions: {},
          baseline_expectancy: null,
          pending_params: null,
          last_optimized_at: null,
        };

        const result = await this.optimizeStrategy(mockStrategy, detector);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[Optimizer] Error optimizing detector ${detector.type}:`, error);
      }
    }

    // Save to file (legacy behavior)
    this.saveResultsToFile(results);

    this.printSummary(detectors.length, results);

    return results;
  }

  /**
   * Save optimization results to JSON file
   */
  private saveResultsToFile(results: OptimizationResult[]): void {
    if (results.length === 0) return;

    const bestResult = results.reduce((best, r) =>
      r.newExpectancy > best.newExpectancy ? r : best
    );

    const parameters = {
      minScores: {
        scalp: bestResult.params.consensus.minScore,
        day: bestResult.params.consensus.minScore,
        swing: bestResult.params.consensus.minScore,
      },
      ivBoosts: { lowIV: 0.15, highIV: -0.2 },
      gammaBoosts: { shortGamma: 0.15, longGamma: -0.1 },
      flowBoosts: { aligned: 0.2, opposed: -0.15 },
      mtfWeights: { weekly: 3.0, daily: 2.0, hourly: 1.0, fifteenMin: 0.5 },
      riskReward: bestResult.params.riskReward,
    };

    const outputContent = JSON.stringify(
      {
        parameters,
        performance: {
          expectancy: bestResult.newExpectancy,
          winRate: bestResult.stats.winRate,
          profitFactor: bestResult.stats.profitFactor,
          totalTrades: bestResult.stats.totalTrades,
        },
        timestamp: new Date().toISOString(),
        phase: 4,
      },
      null,
      2
    );

    const configDir = join(process.cwd(), "config");
    try {
      try {
        mkdirSync(configDir);
      } catch {
        /* ignore if exists */
      }

      const outputPath = join(configDir, "optimized-params.json");
      writeFileSync(outputPath, outputContent);
      console.log(`[Optimizer] Saved optimized params to ${outputPath}`);
    } catch (e) {
      console.warn("[Optimizer] Could not save optimized params file:", e);
    }
  }

  /**
   * Print summary of optimization results
   */
  private printSummary(totalStrategies: number, results: OptimizationResult[]): void {
    console.log("\n" + "=".repeat(70));
    console.log("[Optimizer] OPTIMIZATION COMPLETE");
    console.log("=".repeat(70));
    console.log(`[Optimizer] Total strategies processed: ${totalStrategies}`);
    console.log(`[Optimizer] Strategies improved: ${results.length}`);

    if (results.length > 0) {
      console.log("\n[Optimizer] Improvements Summary:");
      for (const r of results) {
        console.log(
          `  - ${r.strategyName}: ${r.oldExpectancy.toFixed(4)} → ${r.newExpectancy.toFixed(4)} ` +
            `(${r.improvement >= 0 ? "+" : ""}${r.improvement.toFixed(1)}%)`
        );
      }
    }
  }

  /**
   * Run the optimizer as a worker
   */
  public async run(): Promise<OptimizationResult[]> {
    try {
      const results = await this.optimize();
      await this.updateHeartbeat(results.length);
      return results;
    } catch (error) {
      console.error("[Optimizer] Fatal error:", error);
      throw error;
    }
  }

  /**
   * Update heartbeat table to track worker health
   */
  private async updateHeartbeat(strategiesOptimized: number): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase.from("scanner_heartbeat").upsert(
        {
          id: "confluence_optimizer",
          last_scan: new Date().toISOString(),
          signals_detected: strategiesOptimized,
          status: "healthy",
        } as any,
        { onConflict: "id" }
      );

      if (error) {
        console.error("[Optimizer] Error updating heartbeat:", error);
      }
    } catch (error) {
      console.error("[Optimizer] Error in updateHeartbeat:", error);
    }
  }
}

// ============================================================================
// Worker Class for Scheduled Runs
// ============================================================================

export class OptimizerWorker {
  private optimizer: ConfluenceOptimizer;
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config?: GAConfig) {
    this.optimizer = new ConfluenceOptimizer(config);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Optimizer Worker] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[Optimizer Worker] ======================================");
    console.log("[Optimizer Worker] Starting Confluence Optimizer Worker");
    console.log("[Optimizer Worker] Interval: Once per day");
    console.log("[Optimizer Worker] ======================================\n");

    // Run initial optimization
    await this.optimizer.run();

    // Schedule daily runs
    this.timer = setInterval(async () => {
      await this.optimizer.run();
    }, SCAN_INTERVAL);

    console.log("[Optimizer Worker] Worker started successfully\n");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.isRunning = false;
    console.log("[Optimizer Worker] Stopped");
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Main Entry Point (when run directly)
// ============================================================================

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const runAsWorker = process.argv.includes("--worker");

  if (runAsWorker) {
    const worker = new OptimizerWorker();

    worker.start().catch((err) => {
      console.error("[Optimizer Worker] Fatal error during startup:", err);
      process.exit(1);
    });

    // Graceful shutdown handlers
    process.on("SIGTERM", () => {
      console.log("[Optimizer Worker] Received SIGTERM, shutting down...");
      worker.stop();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.log("[Optimizer Worker] Received SIGINT, shutting down...");
      worker.stop();
      process.exit(0);
    });
  } else {
    // Single run mode
    const optimizer = new ConfluenceOptimizer();
    optimizer
      .run()
      .then((results) => {
        console.log("\n[Optimizer] Complete. Optimized", results.length, "strategies.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[Optimizer] Fatal error:", err);
        process.exit(1);
      });
  }
}
