import { BacktestEngine, BacktestConfig } from "../../src/lib/backtest/BacktestEngine.js";
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

interface GAConfig {
  populationSize?: number;
  generations?: number;
}

interface OptimizationResult {
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  params: OptimizationParams;
}

export class ConfluenceOptimizer {
  private engine: BacktestEngine;
  private population: Individual[] = [];
  private populationSize: number;
  private generations: number;
  private mutationRate = 0.1;

  constructor(backtestConfig?: Partial<BacktestConfig>, gaConfig?: GAConfig) {
    this.engine = new BacktestEngine(backtestConfig);
    this.populationSize = gaConfig?.populationSize || 20;
    this.generations = gaConfig?.generations || 5;
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
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(this.createRandomIndividual());
    }
  }

  // --- 2. Evaluation ---

  private async evaluateFitness(ind: Individual): Promise<number> {
    console.log("Evaluating individual:", JSON.stringify(ind.params));

    // Run backtest
    const results = await this.engine.backtestAll(true); // Include KCU

    // Aggregate results
    let totalTrades = 0;
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;

    for (const stats of results) {
      totalTrades += stats.totalTrades;
      const grossWin = stats.avgWin * stats.winners;
      const grossLoss = Math.abs(stats.avgLoss) * stats.losers;
      totalWin += grossWin;
      totalLoss += grossLoss;
      winCount += stats.winners;
    }

    if (totalTrades === 0) return 0;
    if (totalLoss === 0) return totalWin;

    const profitFactor = totalWin / totalLoss;
    const winRate = winCount / totalTrades;

    // Fitness Function: Expectancy * log(Trades)
    const fitness = profitFactor * winRate * Math.log10(totalTrades + 1);

    ind.fitness = fitness;
    ind.stats = { totalTrades, winRate, profitFactor };

    return fitness;
  }

  // --- 3. Genetic Operators ---

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
    child.params.riskReward = Math.random() > 0.5 ? p1.params.riskReward : p2.params.riskReward;
    child.params.minScores = Math.random() > 0.5 ? p1.params.minScores : p2.params.minScores;
    child.params.consensus = Math.random() > 0.5 ? p1.params.consensus : p2.params.consensus;
    return child;
  }

  private mutate(ind: Individual) {
    if (Math.random() < this.mutationRate) {
      ind.params.riskReward.targetMultiple = this.randomRange(1.5, 4.0);
    }
    if (Math.random() < this.mutationRate) {
      ind.params.minScores.day = this.randomInt(30, 80);
    }
  }

  // --- Main Public Method ---

  public async optimize(): Promise<OptimizationResult> {
    console.log("Starting Optimization...");
    this.initPopulation();

    for (let gen = 0; gen < this.generations; gen++) {
      console.log(`\n=== Generation ${gen + 1} ===`);

      for (const ind of this.population) {
        if (ind.fitness === -Infinity) {
          await this.evaluateFitness(ind);
        }
      }

      this.population.sort((a, b) => b.fitness - a.fitness);
      const best = this.population[0];
      console.log(`Best Fitness Gen ${gen + 1}: ${best.fitness.toFixed(4)}`, best.params);

      // Evolve
      const newPop: Individual[] = [];
      newPop.push(this.population[0]);
      newPop.push(this.population[1]);

      while (newPop.length < this.populationSize) {
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
    const outputContent = JSON.stringify(
      {
        ...bestOverall.params,
        timestamp: new Date().toISOString(),
        stats: bestOverall.stats,
      },
      null,
      2
    );

    const outputPath = join(process.cwd(), "config", "optimized-params.json");
    try {
      writeFileSync(outputPath, outputContent);
      console.log(`Saved optimized params to ${outputPath}`);
    } catch (e) {
      console.warn("Could not save optimized params file:", e);
    }

    return {
      winRate: bestOverall.stats?.winRate || 0,
      profitFactor: bestOverall.stats?.profitFactor || 0,
      totalTrades: bestOverall.stats?.totalTrades || 0,
      params: bestOverall.params,
    };
  }

  // --- Standalone Runner ---

  public async run() {
    const result = await this.optimize();
    console.log("Optimal Parameters:", JSON.stringify(result.params, null, 2));
    console.log("Stats:", result);
  }
}

// Interactive runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const optimizer = new ConfluenceOptimizer();
  optimizer.run().catch(console.error);
}
