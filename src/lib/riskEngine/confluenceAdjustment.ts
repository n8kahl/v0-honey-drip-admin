/**
 * Adjust risk profile level weights based on confluence metrics
 * 
 * Takes confluence data (volatility, trend, liquidity) and modifies
 * the level weights for more aggressive or conservative targets
 */

import { RiskProfile } from './profiles';
import {
  MassiveTrendMetrics,
  MassiveVolatilityMetrics,
  MassiveLiquidityMetrics,
} from '../../services/massiveClient';

export interface ConfluenceContext {
  trend?: MassiveTrendMetrics;
  volatility?: MassiveVolatilityMetrics;
  liquidity?: MassiveLiquidityMetrics;
}

/**
 * Apply confluence adjustments to a risk profile's level weights
 * 
 * Rules:
 * - High trend score (>70): Boost TP level weights by 15-20%
 * - Low trend score (<30): Conservative mode, reduce TP weights by 10-15%
 * - High IV (>75th percentile): Favor ATR-based targets, reduce key level weights
 * - Low IV (<25th percentile): Favor key level targets, boost key level weights
 * - Good liquidity: Normal weights
 * - Poor liquidity: Reduce targets closer to entry (reduce all TP weights)
 * 
 * @param profile Original risk profile (DAY, SWING, LEAP, SCALP)
 * @param confluence Confluence context (trend, volatility, liquidity)
 * @returns Adjusted profile with modified levelWeights
 */
export function adjustProfileByConfluence(
  profile: RiskProfile,
  confluence: ConfluenceContext
): RiskProfile {
  // Start with original profile
  const adjusted = { ...profile };
  const newWeights = { ...profile.levelWeights };

  // 1. TREND-based adjustments (risk appetite)
  if (confluence.trend) {
    const { trendScore } = confluence.trend;
    
    if (trendScore > 70) {
      // Bullish trend: aggressive TP targets
      console.log('[confluence] Bullish trend detected, boosting TP weights');
      for (const levelName in newWeights) {
        if (levelName !== 'ATR') {
          newWeights[levelName] = Math.min(1.0, newWeights[levelName] * 1.15);
        }
      }
      // Also boost ATR-based targets
      if (newWeights['ATR']) {
        newWeights['ATR'] = Math.min(1.0, newWeights['ATR'] * 1.1);
      }
    } else if (trendScore < 30) {
      // Bearish/weak trend: conservative TP targets
      console.log('[confluence] Weak trend detected, reducing TP weights');
      for (const levelName in newWeights) {
        newWeights[levelName] = newWeights[levelName] * 0.85;
      }
    }
  }

  // 2. VOLATILITY-based adjustments (level preference)
  if (confluence.volatility) {
    const { ivPercentile } = confluence.volatility;
    
    if (ivPercentile > 75) {
      // High IV: use ATR-based targets (more reliable in high vol)
      console.log('[confluence] High IV detected (>75th %ile), favoring ATR targets');
      // Reduce key level weights, keep ATR high
      for (const levelName in newWeights) {
        if (levelName !== 'ATR') {
          newWeights[levelName] = newWeights[levelName] * 0.8;
        }
      }
      if (newWeights['ATR']) {
        newWeights['ATR'] = Math.min(1.0, newWeights['ATR'] * 1.2);
      }
    } else if (ivPercentile < 25) {
      // Low IV: use technical levels (more defined support/resistance)
      console.log('[confluence] Low IV detected (<25th %ile), favoring key levels');
      // Boost key level weights
      for (const levelName in newWeights) {
        if (levelName !== 'ATR') {
          newWeights[levelName] = Math.min(1.0, newWeights[levelName] * 1.2);
        }
      }
      if (newWeights['ATR']) {
        newWeights['ATR'] = newWeights['ATR'] * 0.9;
      }
    }
  }

  // 3. LIQUIDITY-based adjustments (confidence in fill price)
  if (confluence.liquidity) {
    const { liquidityScore, spreadPct } = confluence.liquidity;
    
    if (liquidityScore < 40 || spreadPct > 5) {
      // Poor liquidity: reduce all TP targets (slippage risk)
      console.log('[confluence] Poor liquidity detected, reducing target aggression');
      for (const levelName in newWeights) {
        newWeights[levelName] = newWeights[levelName] * 0.75;
      }
    } else if (liquidityScore > 80 && spreadPct < 1) {
      // Excellent liquidity: can be slightly more aggressive
      console.log('[confluence] Excellent liquidity, allowing slightly tighter targets');
      // No change - already at base profile
    }
  }

  // Normalize weights (ensure they don't exceed 1.0)
  for (const levelName in newWeights) {
    newWeights[levelName] = Math.min(1.0, Math.max(0.1, newWeights[levelName]));
  }

  adjusted.levelWeights = newWeights;
  return adjusted;
}

/**
 * Get a text description of confluence adjustments applied
 */
export function getConfluenceAdjustmentReasoning(confluence: ConfluenceContext): string {
  const reasons: string[] = [];

  if (confluence.trend) {
    const { trendScore, description } = confluence.trend;
    reasons.push(`Trend: ${description} (${trendScore}/100)`);
  }

  if (confluence.volatility) {
    const { ivPercentile, description } = confluence.volatility;
    reasons.push(`Volatility: ${description} (${ivPercentile}th %ile)`);
  }

  if (confluence.liquidity) {
    const { liquidityScore, spreadPct, description } = confluence.liquidity;
    reasons.push(`Liquidity: ${description} (Score: ${liquidityScore}, Spread: ${spreadPct.toFixed(2)}%)`);
  }

  return reasons.join(' • ');
}
