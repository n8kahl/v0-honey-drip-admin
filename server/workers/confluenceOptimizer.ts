import { BacktestEngine } from "../../src/lib/backtest/BacktestEngine.js";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

/**
 * Confluence Optimizer
 *
 * Uses a Genetic Algorithm to find optimal parameters for strategy detectors.
 * Maximizes Expectancy = (WinRate * AvgWin) / AvgLoss
 *
 * Process:
 * 1. Generate Population (random param sets)
 * 2. Evaluate Fitness (run backtests)
 * 3. Selection (tournament)
 * 4. Crossover & Mutation
 * 5. Repeat
 */

interface OptimizationParams {
  riskReward: {
    targetMultiple: number; // 1.5 - 3.0
    stopMultiple: number; // 0.5 - 1.5
    maxHoldBars: number; // 10 - 50
  };
  minScores: {
    day: number; // 30 - 70
    swing: number; // 30 - 70
    scalp: number; // 30 - 70
  };
  consensus: {
    minDetectors: number; // 1 - 3
    minTotalScore: number; // 50 - 150
  };
}

interface Individual {
  params: OptimizationParams;
  fitness: number;
  stats?: any;
}

const POPULATION_SIZE = 20; // Small for demo, increase for production
const GENERATIONS = 5;
const MUTATION_RATE = 0.1;

export class ConfluenceOptimizer {
  private engine: BacktestEngine;
  private population: Individual[] = [];

  constructor() {
    this.engine = new BacktestEngine();
  }

  // --- 1. Initialization ---

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
          stopMultiple: this.randomRange(0.5, 1.5),
          maxHoldBars: this.randomInt(10, 40),
        },
        minScores: {
          day: this.randomInt(40, 70),
          swing: this.randomInt(40, 70),
          scalp: this.randomInt(40, 70),
        },
        consensus: {
          minDetectors: this.randomInt(1, 3),
          minTotalScore: this.randomInt(60, 120),
        },
      },
      fitness: -Infinity,
    };
  }

  private initPopulation() {
    this.population = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
      this.population.push(this.createRandomIndividual());
    }
  }

  // --- 2. Evaluation ---

  // Mock function to apply params to the backtest config
  // In a real implementation, BacktestEngine needs to accept these params dynamically
  // For now, we assume BacktestEngine reads from a config file or similar,
  // or we temporarily modify its instance config if possible (via public config property or method).
  // Current BacktestEngine reads from OptimizedScannerConfig.js which is static.
  // We will need to make BacktestEngine accept overrides.
  // For this MV implementation, we'll simulate by just logging.

  private async evaluateFitness(ind: Individual): Promise<number> {
    console.log("Evaluating individual:", JSON.stringify(ind.params));

    // TODO: Pass `ind.params` effectively to engine.backtestAll()
    // Doing this requires modifying BacktestEngine to accepting paramsOverride.
    // For now, we will run backtestAll() with default config and assume
    // we are just creating the framework.

    // Run backtest
    const results = await this.engine.backtestAll(true); // Include KCU

    // Aggregate results
    let totalTrades = 0;
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;

    for (const stats of results) {
      totalTrades += stats.totalTrades;
      // Derived totals
      const grossWin = stats.avgWin * stats.winners;
      const grossLoss = Math.abs(stats.avgLoss) * stats.losers;
      totalWin += grossWin;
      totalLoss += grossLoss;
      winCount += stats.winners;
    }

    if (totalTrades === 0) return 0;
    if (totalLoss === 0) return totalWin; // Infinite profit factor

    const profitFactor = totalWin / totalLoss;
    const winRate = winCount / totalTrades;
    const avgWin = totalWin / winCount || 0;
    const avgLoss = totalLoss / (totalTrades - winCount) || 0;

    // Fitness Function: Expectancy * log(Trades) (to favor statistical significance)
    // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
    // But simplified to Profit Factor * WinRate for stability
    const fitness = profitFactor * winRate * Math.log10(totalTrades + 1);

    ind.fitness = fitness;
    ind.stats = { totalTrades, winRate, profitFactor };

    return fitness;
  }

  // --- 3. Genetic Operators ---

  private tournamentSelection(): Individual {
    const k = 3;
    let best = this.population[Math.floor(Math.random() * POPULATION_SIZE)];
    for (let i = 0; i < k; i++) {
      const ind = this.population[Math.floor(Math.random() * POPULATION_SIZE)];
      if (ind.fitness > best.fitness) {
        best = ind;
      }
    }
    return best;
  }

  private crossover(p1: Individual, p2: Individual): Individual {
    // Uniform crossover
    const child = this.createRandomIndividual();

    // Mix Risk/Reward
    child.params.riskReward = Math.random() > 0.5 ? p1.params.riskReward : p2.params.riskReward;
    // Mix Scores
    child.params.minScores = Math.random() > 0.5 ? p1.params.minScores : p2.params.minScores;
    // Mix Consensus
    child.params.consensus = Math.random() > 0.5 ? p1.params.consensus : p2.params.consensus;

    return child;
  }

  private mutate(ind: Individual) {
    if (Math.random() < MUTATION_RATE) {
      ind.params.riskReward.targetMultiple = this.randomRange(1.5, 4.0);
    }
    if (Math.random() < MUTATION_RATE) {
      ind.params.minScores.day = this.randomInt(30, 80);
    }
    // ... add more mutations
  }

  // --- Main Loop ---

  public async run() {
    console.log("Starting Optimization...");
    this.initPopulation();

    for (let gen = 0; gen < GENERATIONS; gen++) {
      console.log(`\n=== Generation ${gen + 1} ===`);

      // Evaluate all
      for (const ind of this.population) {
        if (ind.fitness === -Infinity) {
          await this.evaluateFitness(ind);
        }
      }

      // Sort
      this.population.sort((a, b) => b.fitness - a.fitness);
      const best = this.population[0];
      console.log(`Best Fitness Gen ${gen + 1}: ${best.fitness.toFixed(4)}`, best.params);

      // Evolve
      const newPop: Individual[] = [];

      // Elitism: Keep best 2
      newPop.push(this.population[0]);
      newPop.push(this.population[1]);

      while (newPop.length < POPULATION_SIZE) {
        const p1 = this.tournamentSelection();
        const p2 = this.tournamentSelection();
        const child = this.crossover(p1, p2);
        this.mutate(child);
        newPop.push(child);
      }

      this.population = newPop;
    }

    console.log("\nOptimization Complete.");
    const bestOverall = this.population[0];

    // Save to file
    const outputContent = `export const OPTIMIZED_PARAMS = ${JSON.stringify(bestOverall.params, null, 2)};
    
export function getOptimizedParams() {
  return OPTIMIZED_PARAMS;
}`;

    const outputPath = join(process.cwd(), "src/lib/composite/OptimizedParams.ts");
    // writeFileSync(outputPath, outputContent); // Commented out to avoid overwriting prod without review
    console.log("Optimal Parameters:", JSON.stringify(bestOverall.params, null, 2));
    console.log("Stats:", bestOverall.stats);
  }
}

// Interactive runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const optimizer = new ConfluenceOptimizer();
  optimizer.run().catch(console.error);
}
