/**
 * IV Percentile Context Engine
 * Phase 2: Context Engines
 *
 * Queries historical IV percentile data to provide entry timing context.
 * Applies score boosts/penalties based on IV regime.
 *
 * Key Insights:
 * - LOW IV (0-20th percentile): Options are cheap → BUY_PREMIUM
 * - NORMAL IV (20-80th percentile): Fair value → NEUTRAL
 * - HIGH IV (80-100th percentile): Options are expensive → WAIT or SELL_PREMIUM
 */

import { createClient } from '../supabase/client';

/**
 * IV Percentile Context Result
 */
export interface IVContext {
  symbol: string;
  date: string;
  timestamp: number;

  // Current IV metrics
  currentIV: number;
  ivPercentile: number;
  ivRank: number;

  // Historical context
  iv52WeekHigh: number;
  iv52WeekLow: number;
  iv52WeekMean: number;
  ivStdDev: number;

  // Regime classification
  ivRegime: 'EXTREMELY_LOW' | 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREMELY_HIGH';

  // Trading recommendations
  recommendation: 'BUY_PREMIUM' | 'BUY_FAVORABLE' | 'NEUTRAL' | 'WAIT_FOR_IV_DROP' | 'SELL_PREMIUM';
  confidence: number;

  // Optional metadata
  dataAge?: number; // Milliseconds since data was calculated
  isStale?: boolean; // True if data is >24 hours old
}

/**
 * IV Boost Configuration
 */
export interface IVBoostConfig {
  // Boost multipliers by regime (applied to base score)
  regimeBoosts: {
    EXTREMELY_LOW: number;  // Default: 1.20 (+20% for cheap options)
    LOW: number;            // Default: 1.10 (+10%)
    NORMAL: number;         // Default: 1.00 (neutral)
    ELEVATED: number;       // Default: 0.95 (-5%)
    HIGH: number;           // Default: 0.85 (-15%)
    EXTREMELY_HIGH: number; // Default: 0.70 (-30% for expensive options)
  };

  // Direction-specific boosts
  directionBoosts: {
    LONG: {
      lowIVBoost: number;    // Default: 1.15 (favor longs when IV is low)
      highIVPenalty: number; // Default: 0.80 (avoid longs when IV is high)
    };
    SHORT: {
      lowIVPenalty: number;  // Default: 0.90 (avoid shorts when IV is low)
      highIVBoost: number;   // Default: 1.10 (favor shorts when IV is high)
    };
  };

  // Confidence thresholds
  minDataPoints: number;  // Minimum 52-week bars required
  staleThresholdHours: number; // Consider data stale after N hours
}

/**
 * Default IV Boost Configuration
 */
const DEFAULT_IV_BOOST_CONFIG: IVBoostConfig = {
  regimeBoosts: {
    EXTREMELY_LOW: 1.20,
    LOW: 1.10,
    NORMAL: 1.00,
    ELEVATED: 0.95,
    HIGH: 0.85,
    EXTREMELY_HIGH: 0.70,
  },
  directionBoosts: {
    LONG: {
      lowIVBoost: 1.15,
      highIVPenalty: 0.80,
    },
    SHORT: {
      lowIVPenalty: 0.90,
      highIVBoost: 1.10,
    },
  },
  minDataPoints: 200, // ~40 weeks of daily data
  staleThresholdHours: 24,
};

/**
 * IV Percentile Context Engine
 */
export class IVPercentileEngine {
  private config: IVBoostConfig;

  constructor(config?: Partial<IVBoostConfig>) {
    this.config = { ...DEFAULT_IV_BOOST_CONFIG, ...config };
  }

  /**
   * Get IV context for a symbol
   *
   * @param symbol - Symbol to query (e.g., 'SPX', 'NDX')
   * @returns IV context or null if not available
   */
  async getIVContext(symbol: string): Promise<IVContext | null> {
    const supabase = createClient();

    try {
      // Query latest IV percentile from cache
      const { data, error } = await supabase
        .from('iv_percentile_cache')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn(`[IVPercentileEngine] No IV data for ${symbol}:`, error?.message);
        return null;
      }

      // Calculate data age
      const dataTimestamp = new Date(data.date).getTime();
      const dataAge = Date.now() - dataTimestamp;
      const isStale = dataAge > this.config.staleThresholdHours * 60 * 60 * 1000;

      // Classify IV regime
      const ivRegime = this.classifyIVRegime(data.iv_percentile);

      // Determine recommendation
      const recommendation = this.getRecommendation(ivRegime, data.iv_percentile);

      // Calculate confidence based on data quality
      const confidence = this.calculateConfidence(data, dataAge);

      return {
        symbol: data.symbol,
        date: data.date,
        timestamp: dataTimestamp,
        currentIV: data.current_iv,
        ivPercentile: data.iv_percentile,
        ivRank: data.iv_rank,
        iv52WeekHigh: data.iv_52week_high,
        iv52WeekLow: data.iv_52week_low,
        iv52WeekMean: data.iv_52week_mean,
        ivStdDev: data.iv_std_dev,
        ivRegime,
        recommendation,
        confidence,
        dataAge,
        isStale,
      };
    } catch (error) {
      console.error(`[IVPercentileEngine] Error fetching IV context for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Apply IV boost to a base score
   *
   * @param baseScore - Original signal score (0-100)
   * @param ivContext - IV context data
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @returns Adjusted score
   */
  applyIVBoost(
    baseScore: number,
    ivContext: IVContext | null,
    direction: 'LONG' | 'SHORT'
  ): number {
    // No context = no boost
    if (!ivContext) {
      return baseScore;
    }

    // Stale data = reduced boost
    const stalePenalty = ivContext.isStale ? 0.5 : 0;

    // Get regime boost
    const regimeBoost = this.config.regimeBoosts[ivContext.ivRegime];

    // Get direction-specific boost
    let directionBoost = 1.0;
    if (direction === 'LONG') {
      if (ivContext.ivPercentile < 20) {
        directionBoost = this.config.directionBoosts.LONG.lowIVBoost;
      } else if (ivContext.ivPercentile > 80) {
        directionBoost = this.config.directionBoosts.LONG.highIVPenalty;
      }
    } else if (direction === 'SHORT') {
      if (ivContext.ivPercentile < 20) {
        directionBoost = this.config.directionBoosts.SHORT.lowIVPenalty;
      } else if (ivContext.ivPercentile > 80) {
        directionBoost = this.config.directionBoosts.SHORT.highIVBoost;
      }
    }

    // Combine boosts (regime × direction) with confidence weighting
    const combinedBoost = regimeBoost * directionBoost;
    const confidenceWeight = ivContext.confidence / 100;
    const finalBoost = 1.0 + ((combinedBoost - 1.0) * confidenceWeight) - stalePenalty;

    // Apply boost
    const adjustedScore = baseScore * finalBoost;

    // Clamp to valid range (0-100)
    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Get IV context summary for UI display
   *
   * @param symbol - Symbol
   * @returns Human-readable summary
   */
  async getIVSummary(symbol: string): Promise<string> {
    const context = await this.getIVContext(symbol);

    if (!context) {
      return `IV data not available for ${symbol}`;
    }

    const percentile = context.ivPercentile.toFixed(0);
    const regime = context.ivRegime.replace(/_/g, ' ');
    const rec = context.recommendation.replace(/_/g, ' ');

    return `IV: ${percentile}th %ile (${regime}) → ${rec}`;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Classify IV regime based on percentile
   */
  private classifyIVRegime(
    percentile: number
  ): IVContext['ivRegime'] {
    if (percentile < 10) return 'EXTREMELY_LOW';
    if (percentile < 20) return 'LOW';
    if (percentile < 40) return 'NORMAL';
    if (percentile < 60) return 'NORMAL';
    if (percentile < 80) return 'ELEVATED';
    if (percentile < 90) return 'HIGH';
    return 'EXTREMELY_HIGH';
  }

  /**
   * Get trading recommendation based on IV regime
   */
  private getRecommendation(
    regime: IVContext['ivRegime'],
    percentile: number
  ): IVContext['recommendation'] {
    if (regime === 'EXTREMELY_LOW' || regime === 'LOW') {
      return 'BUY_PREMIUM';
    }

    if (regime === 'NORMAL' && percentile < 40) {
      return 'BUY_FAVORABLE';
    }

    if (regime === 'NORMAL') {
      return 'NEUTRAL';
    }

    if (regime === 'ELEVATED' || regime === 'HIGH') {
      return 'WAIT_FOR_IV_DROP';
    }

    return 'SELL_PREMIUM'; // EXTREMELY_HIGH
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(data: any, dataAge: number): number {
    let confidence = 100;

    // Penalize stale data
    const hoursOld = dataAge / (1000 * 60 * 60);
    if (hoursOld > 24) {
      confidence -= Math.min(30, (hoursOld - 24) * 2); // -2% per hour after 24h
    }

    // Penalize insufficient data points
    const dataPoints = data.data_points || 0;
    if (dataPoints < this.config.minDataPoints) {
      confidence -= ((this.config.minDataPoints - dataPoints) / this.config.minDataPoints) * 20;
    }

    // Penalize extreme percentiles (less reliable at edges)
    if (data.iv_percentile < 5 || data.iv_percentile > 95) {
      confidence -= 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }
}

/**
 * Singleton instance for global use
 */
export const ivPercentileEngine = new IVPercentileEngine();
