import { EventDrivenBacktestEngine } from "../../src/lib/backtest/EventDrivenBacktestEngine.js";
import { BacktestStats } from "../../src/lib/backtest/types.js";
import {
  BACKTESTABLE_DETECTORS_WITH_KCU,
  FLOW_PRIMARY_DETECTORS,
} from "../../src/lib/composite/detectors/index.js";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

/**
 * Confluence Optimizer (Phase 4 Upgraded)
 *
 * Uses a Genetic Algorithm to find optimal parameters for strategy detectors
 * using the advanced EventDrivenBacktestEngine (MTF + Flow aware).
 *
 * Maximizes Expectancy = (WinRate * AvgWin) / AvgLoss
 */

interface OptimizationParams {
  riskReward: {
    targetMultiple: number; // 1.5 - 4.0
    stopMultiple: number; // 0.8 - 1.5
    maxHoldBars: number; // 12 - 96 (3 hours - 3 days approx depending on timeframe)
  };
  consensus: {
    minScore: number; // 50 - 80
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
  private engine: EventDrivenBacktestEngine;
  private population: Individual[] = [];
  private populationSize: number;
  private generations: number;
  private mutationRate = 0.15; // Slightly higher for more exploration

  constructor(gaConfig?: GAConfig) {
    // We instantiate the engine PER run or re-configure it?
    // The engine holds state (data cache), so we should keep one engine instance
    // and just update its config per individual.
    this.engine = new EventDrivenBacktestEngine();
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
          stopMultiple: this.randomRange(0.8, 1.5),
          maxHoldBars: this.randomInt(12, 60),
        },
        consensus: {
          minScore: this.randomInt(50, 80),
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
    // console.log("Evaluating:", JSON.stringify(ind.params));

    // Update Engine Config
    // We need to extend the engine to accept dynamic config updates or passed in runDetector
    // For now, assuming we recreate or the engine is stateless enough regarding config for the run
    this.engine = new EventDrivenBacktestEngine({
      targetMultiple: ind.params.riskReward.targetMultiple,
      stopMultiple: ind.params.riskReward.stopMultiple,
      maxHoldBars: ind.params.riskReward.maxHoldBars,
    });

    const results: BacktestStats[] = [];
    const detectors = [...BACKTESTABLE_DETECTORS_WITH_KCU, ...FLOW_PRIMARY_DETECTORS];

    // Run backtest for all detectors
    for (const detector of detectors) {
      if (!detector) continue;
      // In a real GA, running ALL detectors for every individual is slow.
      // We might want to optimize one detector at a time or a subset.
      // But for "General Market Params", we test across the suite.
      const stats = await this.engine.runDetector(detector);
      results.push(stats);
    }

    // Aggregate results
    let totalTrades = 0;
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;

    for (const stats of results) {
      totalTrades += stats.totalTrades;
      // Approximate gross PnL from R-multiples for fitness
      // (Assuming 1R risk)
      const grossWinR = stats.winners * ind.params.riskReward.targetMultiple; // Simplification
      const grossLossR = stats.losers * 1.0; // Simplification (loss is 1R)

      totalWin += stats.totalPnl > 0 ? stats.totalPnl : 0; // Use real PnL if available
      totalLoss += stats.totalPnl < 0 ? Math.abs(stats.totalPnl) : 0;

      winCount += stats.winners;
    }

    if (totalTrades === 0) return 0;

    // Safety against division by zero
    const profitFactor = totalLoss === 0 ? (totalWin > 0 ? 10 : 0) : totalWin / totalLoss;
    const winRate = winCount / totalTrades;

    // Fitness Function: Expectancy * log(Trades)
    // We want robust systems: decent PF + significant sample size
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
    child.params.consensus = Math.random() > 0.5 ? p1.params.consensus : p2.params.consensus;
    return child;
  }

  private mutate(ind: Individual) {
    if (Math.random() < this.mutationRate) {
      ind.params.riskReward.targetMultiple = this.randomRange(1.5, 4.0);
    }
    if (Math.random() < this.mutationRate) {
      ind.params.consensus.minScore = this.randomInt(50, 80);
    }
  }

  // --- Main Public Method ---

  public async optimize(): Promise<OptimizationResult> {
    console.log("Starting Confluence Optimization (Event-Driven)...");
    this.initPopulation();

    for (let gen = 0; gen < this.generations; gen++) {
      console.log(`\n=== Generation ${gen + 1} ===`);
      const start = Date.now();

      for (const ind of this.population) {
        if (ind.fitness === -Infinity) {
          await this.evaluateFitness(ind);
        }
      }

      this.population.sort((a, b) => b.fitness - a.fitness);
      const best = this.population[0];
      const duration = ((Date.now() - start) / 1000).toFixed(1);

      console.log(
        `Gen ${gen + 1} Best: Fitness=${best.fitness.toFixed(3)} PF=${best.stats.profitFactor.toFixed(2)} WR=${(best.stats.winRate * 100).toFixed(1)}% Trades=${best.stats.totalTrades} (${duration}s)`
      );

      // Evolve
      const newPop: Individual[] = [];
      // Elitism: Keep top 2
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

    // Map optimization results to the standard ParameterConfig format
    const parameters = {
      minScores: {
        scalp: bestOverall.params.consensus.minScore,
        day: bestOverall.params.consensus.minScore,
        swing: bestOverall.params.consensus.minScore,
      },
      ivBoosts: { lowIV: 0.15, highIV: -0.2 },
      gammaBoosts: { shortGamma: 0.15, longGamma: -0.1 },
      flowBoosts: { aligned: 0.2, opposed: -0.15 },
      mtfWeights: { weekly: 3.0, daily: 2.0, hourly: 1.0, fifteenMin: 0.5 },
      riskReward: {
        targetMultiple: bestOverall.params.riskReward.targetMultiple,
        stopMultiple: bestOverall.params.riskReward.stopMultiple,
        maxHoldBars: bestOverall.params.riskReward.maxHoldBars,
      },
    };

    // Save to file in the exact format compositeScanner expects
    const outputContent = JSON.stringify(
      {
        parameters,
        performance: {
          winRate: bestOverall.stats.winRate,
          profitFactor: bestOverall.stats.profitFactor,
          totalTrades: bestOverall.stats.totalTrades,
        },
        timestamp: new Date().toISOString(),
        phase: 4,
      },
      null,
      2
    );

    const configDir = join(process.cwd(), "config");
    try {
      // Ensure dir exists
      try {
        mkdirSync(configDir);
      } catch (_e) {
        /* ignore if exists */
      }

      const outputPath = join(configDir, "optimized-params.json");
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
  }
}

// Interactive runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const optimizer = new ConfluenceOptimizer();
  optimizer.run().catch(console.error);
}
