/**
 * Gamma Exposure Context Engine
 * Phase 2: Context Engines
 *
 * Queries gamma exposure snapshots to provide dealer positioning context.
 * Applies score boosts/penalties based on gamma profile.
 *
 * Key Insights:
 * - SHORT_GAMMA (dealers): Amplified price moves → TRENDING/VOLATILE
 * - LONG_GAMMA (dealers): Dampened price moves → RANGE_BOUND/PINNING
 * - Near gamma walls → PINNING behavior
 * - Between walls → TRENDING potential
 */

import { createClient } from '../supabase/client';

/**
 * Gamma Context Result
 */
export interface GammaContext {
  symbol: string;
  timestamp: number;
  underlyingPrice: number;

  // Gamma metrics
  totalGamma: number;
  totalGammaNotional: number;
  callGamma: number;
  putGamma: number;
  gammaSkew: number;

  // Open Interest
  totalCallOI: number;
  totalPutOI: number;
  putCallOIRatio: number;

  // Gamma walls
  gammaWallResistance: number | null;
  gammaWallSupport: number | null;
  resistanceStrength: number | null;
  supportStrength: number | null;

  // Distance to walls (%)
  distanceToResistancePct: number | null;
  distanceToSupportPct: number | null;

  // Dealer positioning
  dealerNetGamma: number;
  dealerPositioning: 'LONG_GAMMA' | 'SHORT_GAMMA' | 'NEUTRAL';
  positioningStrength: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';

  // Market behavior prediction
  expectedBehavior: 'PINNING' | 'TRENDING' | 'VOLATILE' | 'RANGE_BOUND';

  // Trading recommendations
  recommendation: 'BREAKOUT_SETUP' | 'TREND_CONTINUATION' | 'AVOID_PINNING' | 'RANGE_TRADE' | 'NEUTRAL';
  confidence: number;

  // Metadata
  dataAge?: number;
  isStale?: boolean;
}

/**
 * Gamma Boost Configuration
 */
export interface GammaBoostConfig {
  // Boost multipliers by dealer positioning
  positioningBoosts: {
    LONG_GAMMA: {
      WEAK: number;
      MODERATE: number;
      STRONG: number;
      EXTREME: number;
    };
    SHORT_GAMMA: {
      WEAK: number;
      MODERATE: number;
      STRONG: number;
      EXTREME: number;
    };
    NEUTRAL: number;
  };

  // Behavior-specific boosts
  behaviorBoosts: {
    PINNING: number;      // Default: 0.70 (avoid pinning zones)
    TRENDING: number;     // Default: 1.15 (favor trends)
    VOLATILE: number;     // Default: 1.20 (amplified moves)
    RANGE_BOUND: number;  // Default: 0.85 (choppy)
  };

  // Direction-specific modifiers
  directionBoosts: {
    LONG: {
      shortGammaBoost: number;     // Default: 1.10 (favor longs when dealers short)
      longGammaPenalty: number;    // Default: 0.90 (caution when dealers long)
      nearResistancePenalty: number; // Default: 0.85 (avoid longs near walls)
    };
    SHORT: {
      shortGammaPenalty: number;   // Default: 0.90 (caution when dealers short)
      longGammaBoost: number;      // Default: 1.05 (favor shorts when dealers long)
      nearSupportPenalty: number;  // Default: 0.85 (avoid shorts near support)
    };
  };

  // Wall proximity thresholds
  nearWallThresholdPct: number; // Default: 1.0 (within 1% of wall)
  staleThresholdMinutes: number; // Default: 30 minutes
}

/**
 * Default Gamma Boost Configuration
 */
const DEFAULT_GAMMA_BOOST_CONFIG: GammaBoostConfig = {
  positioningBoosts: {
    LONG_GAMMA: {
      WEAK: 0.95,
      MODERATE: 0.90,
      STRONG: 0.85,
      EXTREME: 0.80,
    },
    SHORT_GAMMA: {
      WEAK: 1.05,
      MODERATE: 1.10,
      STRONG: 1.15,
      EXTREME: 1.20,
    },
    NEUTRAL: 1.00,
  },
  behaviorBoosts: {
    PINNING: 0.70,
    TRENDING: 1.15,
    VOLATILE: 1.20,
    RANGE_BOUND: 0.85,
  },
  directionBoosts: {
    LONG: {
      shortGammaBoost: 1.10,
      longGammaPenalty: 0.90,
      nearResistancePenalty: 0.85,
    },
    SHORT: {
      shortGammaPenalty: 0.90,
      longGammaBoost: 1.05,
      nearSupportPenalty: 0.85,
    },
  },
  nearWallThresholdPct: 1.0,
  staleThresholdMinutes: 30,
};

/**
 * Gamma Exposure Context Engine
 */
export class GammaExposureEngine {
  private config: GammaBoostConfig;

  constructor(config?: Partial<GammaBoostConfig>) {
    this.config = { ...DEFAULT_GAMMA_BOOST_CONFIG, ...config };
  }

  /**
   * Get gamma context for a symbol
   *
   * @param symbol - Symbol to query (e.g., 'SPX', 'NDX')
   * @returns Gamma context or null if not available
   */
  async getGammaContext(symbol: string): Promise<GammaContext | null> {
    const supabase = createClient();

    try {
      // Query latest gamma snapshot
      const { data, error } = await supabase
        .from('gamma_exposure_snapshots')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn(`[GammaExposureEngine] No gamma data for ${symbol}:`, error?.message);
        return null;
      }

      // Calculate data age
      const dataAge = Date.now() - data.timestamp;
      const isStale = dataAge > this.config.staleThresholdMinutes * 60 * 1000;

      // Determine recommendation
      const recommendation = this.getRecommendation(
        data.dealer_positioning,
        data.expected_behavior,
        data.distance_to_resistance_pct,
        data.distance_to_support_pct
      );

      // Calculate confidence
      const confidence = this.calculateConfidence(data, dataAge);

      return {
        symbol: data.symbol,
        timestamp: data.timestamp,
        underlyingPrice: data.underlying_price,
        totalGamma: data.total_gamma,
        totalGammaNotional: data.total_gamma_notional,
        callGamma: data.call_gamma,
        putGamma: data.put_gamma,
        gammaSkew: data.gamma_skew,
        totalCallOI: data.total_call_oi,
        totalPutOI: data.total_put_oi,
        putCallOIRatio: data.put_call_oi_ratio,
        gammaWallResistance: data.gamma_wall_resistance,
        gammaWallSupport: data.gamma_wall_support,
        resistanceStrength: data.gamma_wall_resistance_strength,
        supportStrength: data.gamma_wall_support_strength,
        distanceToResistancePct: data.distance_to_resistance_pct,
        distanceToSupportPct: data.distance_to_support_pct,
        dealerNetGamma: data.dealer_net_gamma,
        dealerPositioning: data.dealer_positioning,
        positioningStrength: data.positioning_strength,
        expectedBehavior: data.expected_behavior,
        recommendation,
        confidence,
        dataAge,
        isStale,
      };
    } catch (error) {
      console.error(`[GammaExposureEngine] Error fetching gamma context for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Apply gamma boost to a base score
   *
   * @param baseScore - Original signal score (0-100)
   * @param gammaContext - Gamma context data
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @param currentPrice - Current underlying price
   * @returns Adjusted score
   */
  applyGammaBoost(
    baseScore: number,
    gammaContext: GammaContext | null,
    direction: 'LONG' | 'SHORT',
    currentPrice?: number
  ): number {
    // No context = no boost
    if (!gammaContext) {
      return baseScore;
    }

    // Stale data = reduced boost
    const stalePenalty = gammaContext.isStale ? 0.5 : 0;

    // Get positioning boost
    const positioningBoost = this.getPositioningBoost(
      gammaContext.dealerPositioning,
      gammaContext.positioningStrength
    );

    // Get behavior boost
    const behaviorBoost = this.config.behaviorBoosts[gammaContext.expectedBehavior];

    // Get direction-specific boost
    const directionBoost = this.getDirectionBoost(
      direction,
      gammaContext,
      currentPrice || gammaContext.underlyingPrice
    );

    // Combine boosts with confidence weighting
    const combinedBoost = positioningBoost * behaviorBoost * directionBoost;
    const confidenceWeight = gammaContext.confidence / 100;
    const finalBoost = 1.0 + ((combinedBoost - 1.0) * confidenceWeight) - stalePenalty;

    // Apply boost
    const adjustedScore = baseScore * finalBoost;

    // Clamp to valid range (0-100)
    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Get gamma context summary for UI display
   *
   * @param symbol - Symbol
   * @returns Human-readable summary
   */
  async getGammaSummary(symbol: string): Promise<string> {
    const context = await this.getGammaContext(symbol);

    if (!context) {
      return `Gamma data not available for ${symbol}`;
    }

    const positioning = context.dealerPositioning.replace(/_/g, ' ');
    const behavior = context.expectedBehavior;
    const rec = context.recommendation.replace(/_/g, ' ');

    let wallInfo = '';
    if (context.gammaWallResistance && context.distanceToResistancePct !== null) {
      wallInfo = ` | Resist: ${context.gammaWallResistance.toFixed(0)} (${context.distanceToResistancePct.toFixed(1)}%)`;
    }
    if (context.gammaWallSupport && context.distanceToSupportPct !== null) {
      wallInfo += ` | Supp: ${context.gammaWallSupport.toFixed(0)} (${context.distanceToSupportPct.toFixed(1)}%)`;
    }

    return `${positioning} → ${behavior}${wallInfo} → ${rec}`;
  }

  /**
   * Check if price is near a gamma wall
   *
   * @param context - Gamma context
   * @param currentPrice - Current price
   * @returns True if within nearWallThresholdPct
   */
  isNearGammaWall(context: GammaContext, currentPrice: number): boolean {
    const threshold = this.config.nearWallThresholdPct;

    if (context.distanceToResistancePct !== null && Math.abs(context.distanceToResistancePct) < threshold) {
      return true;
    }

    if (context.distanceToSupportPct !== null && Math.abs(context.distanceToSupportPct) < threshold) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get positioning boost multiplier
   */
  private getPositioningBoost(
    positioning: GammaContext['dealerPositioning'],
    strength: GammaContext['positioningStrength']
  ): number {
    if (positioning === 'NEUTRAL') {
      return this.config.positioningBoosts.NEUTRAL;
    }

    return this.config.positioningBoosts[positioning][strength];
  }

  /**
   * Get direction-specific boost
   */
  private getDirectionBoost(
    direction: 'LONG' | 'SHORT',
    context: GammaContext,
    currentPrice: number
  ): number {
    let boost = 1.0;

    if (direction === 'LONG') {
      // Favor longs when dealers are short gamma (amplified upside)
      if (context.dealerPositioning === 'SHORT_GAMMA') {
        boost *= this.config.directionBoosts.LONG.shortGammaBoost;
      }

      // Penalize longs when dealers are long gamma (dampened upside)
      if (context.dealerPositioning === 'LONG_GAMMA') {
        boost *= this.config.directionBoosts.LONG.longGammaPenalty;
      }

      // Penalize longs near resistance walls
      if (
        context.distanceToResistancePct !== null &&
        Math.abs(context.distanceToResistancePct) < this.config.nearWallThresholdPct
      ) {
        boost *= this.config.directionBoosts.LONG.nearResistancePenalty;
      }
    } else if (direction === 'SHORT') {
      // Penalize shorts when dealers are short gamma (amplified downside risk)
      if (context.dealerPositioning === 'SHORT_GAMMA') {
        boost *= this.config.directionBoosts.SHORT.shortGammaPenalty;
      }

      // Favor shorts when dealers are long gamma (dampened downside)
      if (context.dealerPositioning === 'LONG_GAMMA') {
        boost *= this.config.directionBoosts.SHORT.longGammaBoost;
      }

      // Penalize shorts near support walls
      if (
        context.distanceToSupportPct !== null &&
        Math.abs(context.distanceToSupportPct) < this.config.nearWallThresholdPct
      ) {
        boost *= this.config.directionBoosts.SHORT.nearSupportPenalty;
      }
    }

    return boost;
  }

  /**
   * Get trading recommendation
   */
  private getRecommendation(
    positioning: string,
    behavior: string,
    distanceToResistance: number | null,
    distanceToSupport: number | null
  ): GammaContext['recommendation'] {
    // Near gamma walls → Avoid pinning zones
    const nearWall =
      (distanceToResistance !== null && Math.abs(distanceToResistance) < this.config.nearWallThresholdPct) ||
      (distanceToSupport !== null && Math.abs(distanceToSupport) < this.config.nearWallThresholdPct);

    if (nearWall && behavior === 'PINNING') {
      return 'AVOID_PINNING';
    }

    // Short gamma + not near wall → Breakout potential
    if (positioning === 'SHORT_GAMMA' && !nearWall) {
      return 'BREAKOUT_SETUP';
    }

    // Short gamma + trending behavior → Trend continuation
    if (positioning === 'SHORT_GAMMA' && behavior === 'TRENDING') {
      return 'TREND_CONTINUATION';
    }

    // Long gamma + range bound → Range trading
    if (positioning === 'LONG_GAMMA' && behavior === 'RANGE_BOUND') {
      return 'RANGE_TRADE';
    }

    return 'NEUTRAL';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(data: any, dataAge: number): number {
    let confidence = 100;

    // Penalize stale data
    const minutesOld = dataAge / (1000 * 60);
    if (minutesOld > this.config.staleThresholdMinutes) {
      confidence -= Math.min(30, (minutesOld - this.config.staleThresholdMinutes) * 2);
    }

    // Penalize weak positioning strength
    if (data.positioning_strength === 'WEAK') {
      confidence -= 15;
    } else if (data.positioning_strength === 'MODERATE') {
      confidence -= 5;
    }

    // Penalize low open interest (unreliable gamma walls)
    const totalOI = data.total_call_oi + data.total_put_oi;
    if (totalOI < 50000) {
      confidence -= 20;
    } else if (totalOI < 100000) {
      confidence -= 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }
}

/**
 * Singleton instance for global use
 */
export const gammaExposureEngine = new GammaExposureEngine();
