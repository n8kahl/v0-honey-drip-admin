import type { StrategyDefinition, StrategyOptimizationParams } from "../../types/strategy";
import { EventDrivenBacktestEngine } from "../backtest/EventDrivenBacktestEngine";
import type { BacktestStats } from "../backtest/types";
import { DEFAULT_BACKTEST_CONFIG } from "../backtest/types";
import {
  ALL_DETECTORS,
  BACKTESTABLE_DETECTORS_WITH_KCU,
  FLOW_PRIMARY_DETECTORS,
} from "../composite/detectors";
import type { OpportunityDetector } from "../composite/OpportunityDetector";

export interface OptimizationOptions {
  daysToTest?: number;
  populationSize?: number; // Candidates per generation (default 15)
  generations?: number; // Number of refinement passes (default 5)
  onProgress?: (progress: number, message: string) => void;
}

export interface OptimizationResult {
  bestParams: StrategyOptimizationParams;
  originalExpectancy: number; // Baseline
  newExpectancy: number; // Improved
  improvement: number; // Percentage gain
  stats: BacktestStats;
}

interface Individual {
  params: StrategyOptimizationParams;
  fitness: number;
  expectancy: number;
  stats?: BacktestStats;
}

export class StrategyOptimizer {
  private engine: EventDrivenBacktestEngine;
  private population: Individual[] = [];
  private mutationRate = 0.15;

  constructor() {
    this.engine = new EventDrivenBacktestEngine();
  }

  /**
   * Run the optimization process for a given strategy
   */
  async optimize(
    strategy: StrategyDefinition,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const {
      daysToTest = 30, // Default to 30 days
      populationSize = 15,
      generations = 5,
      onProgress,
    } = options;

    if (onProgress) onProgress(0, "Initializing optimization engine...");

    // 1. Resolve Detector
    const detector = this.mapStrategyToDetector(strategy);
    if (!detector) {
      throw new Error(`No matching detector found for strategy slug: ${strategy.slug}`);
    }

    // 2. Setup Time Range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysToTest);

    // Default config for engine
    const symbols = ["SPY", "QQQ", "IWM", "TSLA", "NVDA"]; // Default basket for robust optimization

    if (onProgress) onProgress(5, `Loading data for default basket (${symbols.length} symbols)...`);

    // 3. Establish Baseline
    // Create random individual close to defaults to measure baseline
    const baselineParams: StrategyOptimizationParams = {
      riskReward: {
        targetMultiplier: 2.0,
        stopMultiplier: 1.0,
        trailingStopPct: 0.2, // default assumption
      },
      consensus: {
        minScore: 60,
      },
    };

    // Evaluate baseline
    const baselineStats = await this.evaluateFitnessForDetector(
      baselineParams,
      detector,
      symbols,
      startDate.toISOString(),
      endDate.toISOString()
    );

    const oldExpectancy = strategy.baselineExpectancy ?? baselineStats.expectancy;

    if (onProgress) onProgress(10, `Baseline Expectancy: ${oldExpectancy.toFixed(3)}`);

    // 4. Initialize Population
    this.initPopulation(populationSize);

    // 5. Run GA Generations
    for (let gen = 0; gen < generations; gen++) {
      const progressStart = 10;
      const progressEnd = 90;
      const currentProgress = progressStart + (gen / generations) * (progressEnd - progressStart);

      if (onProgress)
        onProgress(currentProgress, `Running generation ${gen + 1}/${generations}...`);

      // Evaluate all individuals
      const promises = this.population.map(async (ind) => {
        if (ind.fitness === -Infinity) {
          await this.evaluateFitness(
            ind,
            detector,
            symbols,
            startDate.toISOString(),
            endDate.toISOString()
          );
        }
      });

      // Run in parallel (browser concurrency might limit this, but promises work)
      await Promise.all(promises);

      // Sort by fitness desc
      this.population.sort((a, b) => b.fitness - a.fitness);

      const best = this.population[0];
      if (onProgress)
        onProgress(currentProgress + 2, `Best Gen ${gen + 1}: Exp=${best.expectancy.toFixed(3)}`);

      // Evolve (except last gen)
      if (gen < generations - 1) {
        this.evolvePopulation(populationSize);
      }
    }

    // 6. Result
    const bestOverall = this.population[0];
    const newExpectancy = bestOverall.expectancy;
    const improvement =
      oldExpectancy !== 0
        ? (newExpectancy - oldExpectancy) / Math.abs(oldExpectancy)
        : newExpectancy > 0
          ? 1
          : 0;

    if (onProgress) onProgress(100, "Optimization complete.");

    return {
      bestParams: bestOverall.params,
      originalExpectancy: oldExpectancy,
      newExpectancy: newExpectancy,
      improvement: improvement,
      stats: bestOverall.stats!,
    };
  }

  // --- GA Helpers ---

  private initPopulation(size: number) {
    this.population = [];
    for (let i = 0; i < size; i++) {
      this.population.push(this.createRandomIndividual());
    }
  }

  private createRandomIndividual(): Individual {
    return {
      params: {
        riskReward: {
          targetMultiplier: this.randomRange(1.5, 4.0),
          stopMultiplier: this.randomRange(0.8, 1.5),
          trailingStopPct: 0.2, // Fixed for now or randomized
        },
        consensus: {
          minScore: this.randomInt(50, 80),
        },
      },
      fitness: -Infinity,
      expectancy: 0,
    };
  }

  private evolvePopulation(size: number) {
    const newPop: Individual[] = [];

    // Elitism: Keep top 2
    if (this.population.length > 0) newPop.push(this.population[0]);
    if (this.population.length > 1) newPop.push(this.population[1]);

    while (newPop.length < size) {
      const p1 = this.tournamentSelection();
      const p2 = this.tournamentSelection();
      const child = this.crossover(p1, p2);
      this.mutate(child);
      newPop.push(child);
    }
    this.population = newPop;
  }

  private tournamentSelection(): Individual {
    const k = 3;
    let best = this.population[Math.floor(Math.random() * this.population.length)];
    for (let i = 0; i < k; i++) {
      const ind = this.population[Math.floor(Math.random() * this.population.length)];
      if (ind.fitness > best.fitness) {
        best = ind;
      }
    }
    return best;
  }

  private crossover(p1: Individual, p2: Individual): Individual {
    const child = this.createRandomIndividual();
    const rr1 = p1.params.riskReward!;
    const rr2 = p2.params.riskReward!;

    child.params.riskReward = {
      targetMultiplier: Math.random() > 0.5 ? rr1.targetMultiplier : rr2.targetMultiplier,
      stopMultiplier: Math.random() > 0.5 ? rr1.stopMultiplier : rr2.stopMultiplier,
      trailingStopPct: 0.2,
    };

    child.params.consensus = {
      minScore: Math.random() > 0.5 ? p1.params.consensus!.minScore : p2.params.consensus!.minScore,
    };

    return child;
  }

  private mutate(ind: Individual) {
    const rr = ind.params.riskReward!;
    if (Math.random() < this.mutationRate) {
      rr.targetMultiplier = this.randomRange(1.5, 4.0);
    }
    if (Math.random() < this.mutationRate) {
      rr.stopMultiplier = this.randomRange(0.8, 1.5);
    }
    if (Math.random() < this.mutationRate) {
      ind.params.consensus!.minScore = this.randomInt(50, 80);
    }
  }

  // --- Evaluation ---

  private async evaluateFitness(
    ind: Individual,
    detector: OpportunityDetector,
    symbols: string[],
    start: string,
    end: string
  ) {
    const stats = await this.evaluateFitnessForDetector(ind.params, detector, symbols, start, end);

    // Fitness = Expectancy * log(Trades)
    // Encourages profitable strategies that trade frequently enough to be significant
    if (stats.totalTrades < 5) {
      ind.fitness = -Infinity;
      ind.expectancy = 0;
    } else {
      ind.expectancy = stats.expectancy;
      ind.fitness = stats.expectancy * Math.log10(stats.totalTrades + 1);
    }
    ind.stats = stats;
  }

  private async evaluateFitnessForDetector(
    params: StrategyOptimizationParams,
    detector: OpportunityDetector,
    symbols: string[],
    start: string,
    end: string
  ): Promise<BacktestStats> {
    // Configure engine logic
    // Note: EventDrivenBacktestEngine takes config in constructor for some defaults,
    // but runDetector doesn't take overrides easily for *these specific logical params*
    // unless we hack the engine or recreate it.
    // The ConfluenceOptimizer recreates the engine every time. Let's do that.

    const rr = params.riskReward!;
    const engine = new EventDrivenBacktestEngine({
      symbols: symbols,
      startDate: start,
      endDate: end,
      targetMultiple: rr.targetMultiplier,
      stopMultiple: rr.stopMultiplier,
      maxHoldBars: 24, // Default or parameterized
      // We can add minScore logic to detector or engine if supported
    });

    return await engine.runDetector(detector);
  }

  // --- Utils ---

  private mapStrategyToDetector(strategy: StrategyDefinition): OpportunityDetector | null {
    const slug = strategy.slug.toLowerCase().replace(/-/g, "_");

    // Search all detectors
    const all = [
      ...ALL_DETECTORS,
      ...BACKTESTABLE_DETECTORS_WITH_KCU,
      ...FLOW_PRIMARY_DETECTORS,
    ].filter(Boolean);

    // 1. Exact match
    const exact = all.find((d) => d.type === slug);
    if (exact) return exact;

    // 2. Partial match
    return all.find((d) => slug.includes(d.type) || d.type.includes(slug)) || null;
  }

  private randomRange(min: number, max: number, decimals: number = 2): number {
    const val = Math.random() * (max - min) + min;
    return Number(val.toFixed(decimals));
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
