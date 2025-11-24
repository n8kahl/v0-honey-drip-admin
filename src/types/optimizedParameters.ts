/**
 * Optimized Parameter Configuration
 * Shared type for genetic algorithm optimized parameters
 * Used by both frontend (CompositeScanner) and backend (confluenceOptimizer)
 */

export interface ParameterConfig {
  // Detector minimum scores (0-100)
  minScores: {
    scalp: number; // Default: 40
    day: number; // Default: 40
    swing: number; // Default: 40
  };

  // IV Percentile boosts (0.0-0.5)
  ivBoosts: {
    lowIV: number; // Default: 0.15 (15% boost when IV < 20th %ile)
    highIV: number; // Default: -0.20 (-20% penalty when IV > 80th %ile)
  };

  // Gamma Exposure boosts (0.0-0.3)
  gammaBoosts: {
    shortGamma: number; // Default: 0.15 (15% boost for volatile conditions)
    longGamma: number; // Default: -0.10 (-10% penalty for pinning)
  };

  // Options Flow boosts (0.0-0.3)
  flowBoosts: {
    aligned: number; // Default: 0.20 (20% boost when flow aligns)
    opposed: number; // Default: -0.15 (-15% penalty when flow opposes)
  };

  // MTF Alignment weights (0.5-3.0)
  mtfWeights: {
    weekly: number; // Default: 3.0
    daily: number; // Default: 2.0
    hourly: number; // Default: 1.0
    fifteenMin: number; // Default: 0.5
  };

  // Risk/Reward multipliers (0.5-3.0)
  riskReward: {
    targetMultiple: number; // Default: 1.5 (1.5x risk for target)
    stopMultiple: number; // Default: 1.0 (1.0x risk for stop)
    maxHoldBars: number; // Default: 20 bars
  };
}
