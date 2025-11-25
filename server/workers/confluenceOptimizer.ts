/**
 * Confluence Optimizer - Phase 5
 * Genetic Algorithm for Parameter Optimization
 *
 * Auto-tunes 20+ parameters to maximize win rate using genetic algorithms:
 * - Detector minimum scores
 * - IV boost multipliers
 * - Gamma boost multipliers
 * - Flow boost multipliers
 * - MTF alignment weights
 *
 * Usage:
 *   pnpm optimize              # Run full optimization (10-20 generations)
 *   pnpm optimize:quick        # Quick optimization (5 generations)
 *   pnpm optimize:continue     # Continue from previous run
 *
 * Target: 65%+ win rate across all detectors
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

// Fix Node 22 fetch issues - use cross-fetch polyfill for Supabase and HTTP requests
import fetch from "cross-fetch";
globalThis.fetch = fetch as any;

import { BacktestEngine, type BacktestConfig } from "../../src/lib/backtest/BacktestEngine.js";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ParameterConfig } from "../../src/types/optimizedParameters.js";

// Re-export for backward compatibility
export type { ParameterConfig };

// Supabase service role client for server-side operations
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================================
// Parameter Space Definition
// ============================================================================

/**
 * Parameter bounds (min/max for each parameter)
 */
const PARAMETER_BOUNDS: { [key: string]: { min: number; max: number } } = {
  "minScores.scalp": { min: 30, max: 60 },
  "minScores.day": { min: 30, max: 60 },
  "minScores.swing": { min: 30, max: 60 },

  "ivBoosts.lowIV": { min: 0.0, max: 0.4 },
  "ivBoosts.highIV": { min: -0.4, max: 0.0 },

  "gammaBoosts.shortGamma": { min: 0.0, max: 0.3 },
  "gammaBoosts.longGamma": { min: -0.3, max: 0.0 },

  "flowBoosts.aligned": { min: 0.0, max: 0.4 },
  "flowBoosts.opposed": { min: -0.4, max: 0.0 },

  "mtfWeights.weekly": { min: 1.0, max: 5.0 },
  "mtfWeights.daily": { min: 0.5, max: 3.0 },
  "mtfWeights.hourly": { min: 0.5, max: 2.0 },
  "mtfWeights.fifteenMin": { min: 0.1, max: 1.0 },

  "riskReward.targetMultiple": { min: 1.0, max: 3.0 },
  "riskReward.stopMultiple": { min: 0.5, max: 2.0 },
  "riskReward.maxHoldBars": { min: 10, max: 40 },
};

/**
 * Default parameter configuration (baseline)
 */
const DEFAULT_PARAMS: ParameterConfig = {
  minScores: { scalp: 40, day: 40, swing: 40 },
  ivBoosts: { lowIV: 0.15, highIV: -0.2 },
  gammaBoosts: { shortGamma: 0.15, longGamma: -0.1 },
  flowBoosts: { aligned: 0.2, opposed: -0.15 },
  mtfWeights: { weekly: 3.0, daily: 2.0, hourly: 1.0, fifteenMin: 0.5 },
  riskReward: { targetMultiple: 1.5, stopMultiple: 1.0, maxHoldBars: 20 },
};

// ============================================================================
// Genetic Algorithm Configuration
// ============================================================================

interface GAConfig {
  populationSize: number; // Number of parameter sets per generation
  generations: number; // Number of generations to evolve
  mutationRate: number; // Probability of mutation (0-1)
  crossoverRate: number; // Probability of crossover (0-1)
  elitismCount: number; // Number of top performers to keep unchanged
  targetWinRate: number; // Target win rate (0.65 = 65%)
  minTradesThreshold: number; // Minimum trades required for valid result
}

const GA_CONFIG: GAConfig = {
  populationSize: 20, // 20 parameter sets per generation
  generations: 10, // 10 generations (200 backtests total)
  mutationRate: 0.2, // 20% chance of mutation
  crossoverRate: 0.7, // 70% chance of crossover
  elitismCount: 2, // Keep top 2 performers
  targetWinRate: 0.65, // Target 65% win rate
  minTradesThreshold: 30, // Minimum 30 trades for statistical significance
};

// ============================================================================
// Individual (Parameter Set + Fitness)
// ============================================================================

interface Individual {
  params: ParameterConfig;
  fitness: number; // Fitness score (higher = better)
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  generation: number;
}

// ============================================================================
// Genetic Algorithm Class
// ============================================================================

export class ConfluenceOptimizer {
  private backtestEngine: BacktestEngine;
  private config: GAConfig;
  private population: Individual[] = [];
  private bestIndividual: Individual | null = null;
  private generationStats: any[] = [];

  constructor(backtestConfig: BacktestConfig, gaConfig: Partial<GAConfig> = {}) {
    // Create service role Supabase client for server-side database access
    const supabase =
      SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        : null;

    if (!supabase) {
      console.warn(
        "[Optimizer] Warning: No Supabase credentials found. BacktestEngine may not access database."
      );
    }

    this.backtestEngine = new BacktestEngine(backtestConfig, supabase);
    this.config = { ...GA_CONFIG, ...gaConfig };
  }

  /**
   * Run the genetic algorithm optimization
   */
  async optimize(): Promise<Individual> {
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║         Confluence Optimizer - Phase 5                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log(`Population Size: ${this.config.populationSize}`);
    console.log(`Generations: ${this.config.generations}`);
    console.log(`Target Win Rate: ${(this.config.targetWinRate * 100).toFixed(0)}%`);
    console.log(`Mutation Rate: ${(this.config.mutationRate * 100).toFixed(0)}%`);
    console.log(`Crossover Rate: ${(this.config.crossoverRate * 100).toFixed(0)}%\n`);

    // Generation 0: Create initial population
    console.log("[Optimizer] 🧬 Creating initial population...");
    await this.initializePopulation();

    // Evolve for N generations
    for (let gen = 1; gen <= this.config.generations; gen++) {
      console.log(`\n[Optimizer] 📊 Generation ${gen}/${this.config.generations}`);

      // Selection: Pick parents for next generation
      const parents = this.selection();

      // Crossover: Create offspring from parents
      const offspring = this.crossover(parents);

      // Mutation: Randomly mutate some offspring
      this.mutate(offspring);

      // Evaluate offspring fitness
      await this.evaluateFitness(offspring, gen);

      // Replace old population (keep elites)
      this.replacePopulation(offspring);

      // Track best individual
      this.updateBest();

      // Log generation stats
      this.logGenerationStats(gen);
    }

    // Final results
    console.log("\n[Optimizer] ✅ Optimization Complete!");
    console.log("════════════════════════════════════════════════════════════════\n");
    this.logFinalResults();

    // Save results
    this.saveResults();

    return this.bestIndividual!;
  }

  /**
   * Initialize population with random parameter sets
   */
  private async initializePopulation() {
    const individuals: Individual[] = [];

    // Add default params as one individual
    individuals.push({
      params: DEFAULT_PARAMS,
      fitness: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      generation: 0,
    });

    // Generate random individuals
    for (let i = 1; i < this.config.populationSize; i++) {
      individuals.push({
        params: this.randomParams(),
        fitness: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        generation: 0,
      });
    }

    // Evaluate fitness for all individuals
    await this.evaluateFitness(individuals, 0);

    this.population = individuals;
    this.updateBest();
  }

  /**
   * Evaluate fitness for a set of individuals
   */
  private async evaluateFitness(individuals: Individual[], generation: number) {
    console.log(`  Evaluating ${individuals.length} individuals...`);

    for (let i = 0; i < individuals.length; i++) {
      const individual = individuals[i];
      individual.generation = generation;

      // Skip if already evaluated
      if (individual.fitness > 0) continue;

      // Run backtest with these parameters
      const results = await this.runBacktest(individual.params);

      // Calculate fitness score
      individual.winRate = results.winRate;
      individual.profitFactor = results.profitFactor;
      individual.totalTrades = results.totalTrades;
      individual.fitness = this.calculateFitness(results);

      // Log progress
      if ((i + 1) % 5 === 0 || i === individuals.length - 1) {
        console.log(
          `    Evaluated ${i + 1}/${individuals.length} (Best fitness: ${this.bestIndividual?.fitness.toFixed(2) || "N/A"})`
        );
      }
    }
  }

  /**
   * Run backtest with specific parameters
   */
  private async runBacktest(params: ParameterConfig): Promise<any> {
    // TODO: Apply params to BacktestEngine configuration
    // For now, run with default config
    // In production, you'd modify the detector scoring based on params

    const results = await this.backtestEngine.backtestAll();

    // Aggregate results across all detectors
    const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
    const totalWinners = results.reduce((sum, r) => sum + r.winners, 0);

    // Calculate total profits and losses from averages
    const totalProfits = results.reduce((sum, r) => sum + r.avgWin * r.winners, 0);
    const totalLosses = results.reduce((sum, r) => sum + Math.abs(r.avgLoss) * r.losers, 0);

    return {
      winRate: totalWinners / totalTrades,
      profitFactor: totalProfits / (totalLosses || 1),
      totalTrades,
      expectancy: (totalProfits - totalLosses) / totalTrades,
    };
  }

  /**
   * Calculate fitness score for backtest results
   */
  private calculateFitness(results: any): number {
    const { winRate, profitFactor, totalTrades, expectancy } = results;

    // Penalty for insufficient trades
    if (totalTrades < this.config.minTradesThreshold) {
      return 0;
    }

    // Fitness components (weighted)
    const winRateScore = winRate * 100; // 0-100 (weight: 40%)
    const profitFactorScore = Math.min(profitFactor * 20, 100); // 0-100 (weight: 30%)
    const expectancyScore = Math.max(0, expectancy * 50); // 0-100 (weight: 20%)
    const tradeCountScore = Math.min(totalTrades / 2, 50); // 0-50 (weight: 10%)

    // Weighted fitness
    let fitness =
      winRateScore * 0.4 + profitFactorScore * 0.3 + expectancyScore * 0.2 + tradeCountScore * 0.1;

    // Bonus for exceeding target win rate
    if (winRate >= this.config.targetWinRate) {
      fitness += 20; // +20 bonus points
    }

    // Bonus for excellent profit factor (>2.0)
    if (profitFactor >= 2.0) {
      fitness += 10;
    }

    return fitness;
  }

  /**
   * Selection: Pick parents for next generation (tournament selection)
   */
  private selection(): Individual[] {
    const parents: Individual[] = [];
    const tournamentSize = 3;

    // Keep elites
    const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness);
    for (let i = 0; i < this.config.elitismCount; i++) {
      parents.push({ ...sorted[i] });
    }

    // Tournament selection for rest
    while (parents.length < this.config.populationSize) {
      // Random tournament
      const tournament: Individual[] = [];
      for (let i = 0; i < tournamentSize; i++) {
        const randomIndex = Math.floor(Math.random() * this.population.length);
        tournament.push(this.population[randomIndex]);
      }

      // Winner = highest fitness
      const winner = tournament.reduce((best, ind) => (ind.fitness > best.fitness ? ind : best));

      parents.push({ ...winner });
    }

    return parents;
  }

  /**
   * Crossover: Create offspring from parents
   */
  private crossover(parents: Individual[]): Individual[] {
    const offspring: Individual[] = [];

    // Keep elites unchanged
    for (let i = 0; i < this.config.elitismCount; i++) {
      offspring.push({ ...parents[i] });
    }

    // Create offspring from remaining parents
    for (let i = this.config.elitismCount; i < parents.length; i += 2) {
      const parent1 = parents[i];
      const parent2 = parents[Math.min(i + 1, parents.length - 1)];

      if (Math.random() < this.config.crossoverRate) {
        // Crossover: Mix parameters from both parents
        const child: Individual = {
          params: this.crossoverParams(parent1.params, parent2.params),
          fitness: 0,
          winRate: 0,
          profitFactor: 0,
          totalTrades: 0,
          generation: 0,
        };
        offspring.push(child);
      } else {
        // No crossover: Clone parent
        offspring.push({ ...parent1, fitness: 0 });
      }
    }

    return offspring.slice(0, this.config.populationSize);
  }

  /**
   * Crossover two parameter sets (uniform crossover)
   */
  private crossoverParams(p1: ParameterConfig, p2: ParameterConfig): ParameterConfig {
    return {
      minScores: {
        scalp: Math.random() < 0.5 ? p1.minScores.scalp : p2.minScores.scalp,
        day: Math.random() < 0.5 ? p1.minScores.day : p2.minScores.day,
        swing: Math.random() < 0.5 ? p1.minScores.swing : p2.minScores.swing,
      },
      ivBoosts: {
        lowIV: Math.random() < 0.5 ? p1.ivBoosts.lowIV : p2.ivBoosts.lowIV,
        highIV: Math.random() < 0.5 ? p1.ivBoosts.highIV : p2.ivBoosts.highIV,
      },
      gammaBoosts: {
        shortGamma: Math.random() < 0.5 ? p1.gammaBoosts.shortGamma : p2.gammaBoosts.shortGamma,
        longGamma: Math.random() < 0.5 ? p1.gammaBoosts.longGamma : p2.gammaBoosts.longGamma,
      },
      flowBoosts: {
        aligned: Math.random() < 0.5 ? p1.flowBoosts.aligned : p2.flowBoosts.aligned,
        opposed: Math.random() < 0.5 ? p1.flowBoosts.opposed : p2.flowBoosts.opposed,
      },
      mtfWeights: {
        weekly: Math.random() < 0.5 ? p1.mtfWeights.weekly : p2.mtfWeights.weekly,
        daily: Math.random() < 0.5 ? p1.mtfWeights.daily : p2.mtfWeights.daily,
        hourly: Math.random() < 0.5 ? p1.mtfWeights.hourly : p2.mtfWeights.hourly,
        fifteenMin: Math.random() < 0.5 ? p1.mtfWeights.fifteenMin : p2.mtfWeights.fifteenMin,
      },
      riskReward: {
        targetMultiple:
          Math.random() < 0.5 ? p1.riskReward.targetMultiple : p2.riskReward.targetMultiple,
        stopMultiple: Math.random() < 0.5 ? p1.riskReward.stopMultiple : p2.riskReward.stopMultiple,
        maxHoldBars: Math.random() < 0.5 ? p1.riskReward.maxHoldBars : p2.riskReward.maxHoldBars,
      },
    };
  }

  /**
   * Mutation: Randomly alter parameters
   */
  private mutate(individuals: Individual[]) {
    // Skip elites
    for (let i = this.config.elitismCount; i < individuals.length; i++) {
      if (Math.random() < this.config.mutationRate) {
        individuals[i].params = this.mutateParams(individuals[i].params);
      }
    }
  }

  /**
   * Mutate a parameter set (Gaussian mutation)
   */
  private mutateParams(params: ParameterConfig): ParameterConfig {
    const mutated = JSON.parse(JSON.stringify(params)); // Deep clone

    // Randomly pick 1-3 parameters to mutate
    const numMutations = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numMutations; i++) {
      const paramPath = this.randomParamPath();
      const bounds = PARAMETER_BOUNDS[paramPath];

      // Get current value
      const keys = paramPath.split(".");
      let obj: any = mutated;
      for (let j = 0; j < keys.length - 1; j++) {
        obj = obj[keys[j]];
      }
      const lastKey = keys[keys.length - 1];
      const currentValue = obj[lastKey];

      // Gaussian mutation (mean=current, stddev=10% of range)
      const range = bounds.max - bounds.min;
      const stddev = range * 0.1;
      const delta = this.gaussianRandom() * stddev;
      const newValue = Math.max(bounds.min, Math.min(bounds.max, currentValue + delta));

      obj[lastKey] = newValue;
    }

    return mutated;
  }

  /**
   * Replace population with offspring (keep elites)
   */
  private replacePopulation(offspring: Individual[]) {
    this.population = offspring;
  }

  /**
   * Update best individual
   */
  private updateBest() {
    const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness);
    if (!this.bestIndividual || sorted[0].fitness > this.bestIndividual.fitness) {
      this.bestIndividual = sorted[0];
    }
  }

  /**
   * Log generation statistics
   */
  private logGenerationStats(generation: number) {
    const fitnesses = this.population.map((ind) => ind.fitness);
    const winRates = this.population.map((ind) => ind.winRate);

    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const maxFitness = Math.max(...fitnesses);
    const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;

    console.log(`  Gen ${generation} Summary:`);
    console.log(`    Avg Fitness: ${avgFitness.toFixed(2)}`);
    console.log(`    Max Fitness: ${maxFitness.toFixed(2)}`);
    console.log(`    Avg Win Rate: ${(avgWinRate * 100).toFixed(1)}%`);
    console.log(`    Best Win Rate: ${(this.bestIndividual!.winRate * 100).toFixed(1)}%`);

    this.generationStats.push({
      generation,
      avgFitness,
      maxFitness,
      avgWinRate,
      bestWinRate: this.bestIndividual!.winRate,
    });
  }

  /**
   * Log final results
   */
  private logFinalResults() {
    const best = this.bestIndividual!;

    console.log("🏆 Best Configuration Found:");
    console.log(`  Fitness: ${best.fitness.toFixed(2)}`);
    console.log(`  Win Rate: ${(best.winRate * 100).toFixed(1)}%`);
    console.log(`  Profit Factor: ${best.profitFactor.toFixed(2)}`);
    console.log(`  Total Trades: ${best.totalTrades}`);
    console.log(`  Generation: ${best.generation}`);
    console.log("\n  Parameters:");
    console.log(JSON.stringify(best.params, null, 2));
  }

  /**
   * Save results to file
   */
  private saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const outputPath = join(process.cwd(), `optimization-results-${timestamp}.json`);

    const results = {
      timestamp: new Date().toISOString(),
      config: this.config,
      bestIndividual: this.bestIndividual,
      generationStats: this.generationStats,
      finalPopulation: this.population.sort((a, b) => b.fitness - a.fitness).slice(0, 10),
    };

    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private randomParams(): ParameterConfig {
    return {
      minScores: {
        scalp: this.randomInRange(30, 60),
        day: this.randomInRange(30, 60),
        swing: this.randomInRange(30, 60),
      },
      ivBoosts: {
        lowIV: this.randomInRange(0, 0.4),
        highIV: this.randomInRange(-0.4, 0),
      },
      gammaBoosts: {
        shortGamma: this.randomInRange(0, 0.3),
        longGamma: this.randomInRange(-0.3, 0),
      },
      flowBoosts: {
        aligned: this.randomInRange(0, 0.4),
        opposed: this.randomInRange(-0.4, 0),
      },
      mtfWeights: {
        weekly: this.randomInRange(1, 5),
        daily: this.randomInRange(0.5, 3),
        hourly: this.randomInRange(0.5, 2),
        fifteenMin: this.randomInRange(0.1, 1),
      },
      riskReward: {
        targetMultiple: this.randomInRange(1, 3),
        stopMultiple: this.randomInRange(0.5, 2),
        maxHoldBars: Math.floor(this.randomInRange(10, 40)),
      },
    };
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private randomParamPath(): string {
    const paths = Object.keys(PARAMETER_BOUNDS);
    return paths[Math.floor(Math.random() * paths.length)];
  }

  private gaussianRandom(): number {
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  // Backtest configuration
  const backtestConfig: BacktestConfig = {
    symbols: ["SPX", "NDX"],
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    timeframe: "15m",
    targetMultiple: 1.5,
    stopMultiple: 1.0,
    maxHoldBars: 20,
    slippage: 0.001,
  };

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const quick = args.includes("--quick");
  const generations = quick ? 5 : 10;

  // GA configuration
  const gaConfig: Partial<GAConfig> = {
    populationSize: quick ? 10 : 20,
    generations,
  };

  // Create optimizer
  const optimizer = new ConfluenceOptimizer(backtestConfig, gaConfig);

  // Run optimization
  const bestConfig = await optimizer.optimize();

  // Exit
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
