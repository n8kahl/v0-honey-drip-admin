/**
 * Options Flow Analysis Engine
 * Phase 2: Context Engines
 *
 * Queries options flow history to track institutional smart money activity.
 * Applies score boosts/penalties based on flow bias.
 *
 * Key Insights:
 * - SWEEPS: Market orders hitting multiple exchanges → Aggressive
 * - BLOCKS: Large single trades → Institutional positioning
 * - BULLISH FLOW: Heavy call buying or put selling → Upside bias
 * - BEARISH FLOW: Heavy put buying or call selling → Downside bias
 *
 * Future Enhancement: Integrate Massive.com Advanced options trade feed
 * for real-time unusual activity detection
 */

import { createClient } from '../supabase/client';

/**
 * Flow Classification
 */
export type FlowType = 'SWEEP' | 'BLOCK' | 'SPLIT' | 'LARGE' | 'REGULAR';
export type FlowSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type FlowAggressiveness = 'PASSIVE' | 'MODERATE' | 'AGGRESSIVE' | 'VERY_AGGRESSIVE';

/**
 * Flow Analysis Result
 */
export interface FlowContext {
  symbol: string;
  timestamp: number;
  window: string; // Time window analyzed (e.g., '1h', '4h', '1d')

  // Flow metrics
  totalVolume: number;
  totalPremium: number;
  tradeCount: number;

  // Call/Put breakdown
  callVolume: number;
  putVolume: number;
  callPremium: number;
  putPremium: number;
  putCallVolumeRatio: number;
  putCallPremiumRatio: number;

  // Buy/Sell breakdown
  buyVolume: number;
  sellVolume: number;
  buyPremium: number;
  sellPremium: number;

  // Flow type breakdown
  sweepCount: number;
  blockCount: number;
  splitCount: number;
  largeCount: number;

  // Sentiment analysis
  sentiment: FlowSentiment;
  sentimentStrength: number; // 0-100
  aggressiveness: FlowAggressiveness;

  // Smart money indicators
  avgTradeSize: number;
  largeTradePercentage: number;
  institutionalScore: number; // 0-100 (higher = more institutional activity)

  // Trading recommendations
  recommendation: 'FOLLOW_FLOW' | 'CONFIRM_FLOW' | 'NEUTRAL' | 'FADE_FLOW' | 'WAIT';
  confidence: number;

  // Metadata
  dataAge?: number;
  isStale?: boolean;
}

/**
 * Flow Boost Configuration
 */
export interface FlowBoostConfig {
  // Time windows to analyze (most recent first)
  timeWindows: {
    short: number;   // Default: 1 hour (milliseconds)
    medium: number;  // Default: 4 hours
    long: number;    // Default: 24 hours
  };

  // Sentiment thresholds (put/call ratios)
  sentimentThresholds: {
    strongBullish: number;   // Default: 0.5 (2:1 call:put)
    bullish: number;         // Default: 0.7 (1.4:1)
    bearish: number;         // Default: 1.3 (1:1.3)
    strongBearish: number;   // Default: 2.0 (1:2)
  };

  // Boost multipliers by sentiment strength
  sentimentBoosts: {
    BULLISH: {
      WEAK: number;         // Default: 1.05
      MODERATE: number;     // Default: 1.10
      STRONG: number;       // Default: 1.15
      VERY_STRONG: number;  // Default: 1.20
    };
    BEARISH: {
      WEAK: number;         // Default: 1.05
      MODERATE: number;     // Default: 1.10
      STRONG: number;       // Default: 1.15
      VERY_STRONG: number;  // Default: 1.20
    };
    NEUTRAL: number;        // Default: 1.00
  };

  // Direction-specific boosts
  directionBoosts: {
    LONG: {
      bullishFlowBoost: number;     // Default: 1.15 (favor longs with bullish flow)
      bearishFlowPenalty: number;   // Default: 0.80 (avoid longs with bearish flow)
    };
    SHORT: {
      bearishFlowBoost: number;     // Default: 1.15 (favor shorts with bearish flow)
      bullishFlowPenalty: number;   // Default: 0.80 (avoid shorts with bullish flow)
    };
  };

  // Institutional activity boosts
  institutionalBoosts: {
    low: number;        // Default: 0.95 (< 30 institutional score)
    moderate: number;   // Default: 1.05 (30-60)
    high: number;       // Default: 1.10 (60-80)
    veryHigh: number;   // Default: 1.15 (> 80)
  };

  // Minimum thresholds for confidence
  minTradeCount: number;        // Default: 10
  minPremium: number;           // Default: $50,000
  staleThresholdHours: number;  // Default: 2 hours
}

/**
 * Default Flow Boost Configuration
 */
const DEFAULT_FLOW_BOOST_CONFIG: FlowBoostConfig = {
  timeWindows: {
    short: 60 * 60 * 1000,      // 1 hour
    medium: 4 * 60 * 60 * 1000, // 4 hours
    long: 24 * 60 * 60 * 1000,  // 24 hours
  },
  sentimentThresholds: {
    strongBullish: 0.5,
    bullish: 0.7,
    bearish: 1.3,
    strongBearish: 2.0,
  },
  sentimentBoosts: {
    BULLISH: {
      WEAK: 1.05,
      MODERATE: 1.10,
      STRONG: 1.15,
      VERY_STRONG: 1.20,
    },
    BEARISH: {
      WEAK: 1.05,
      MODERATE: 1.10,
      STRONG: 1.15,
      VERY_STRONG: 1.20,
    },
    NEUTRAL: 1.00,
  },
  directionBoosts: {
    LONG: {
      bullishFlowBoost: 1.15,
      bearishFlowPenalty: 0.80,
    },
    SHORT: {
      bearishFlowBoost: 1.15,
      bullishFlowPenalty: 0.80,
    },
  },
  institutionalBoosts: {
    low: 0.95,
    moderate: 1.05,
    high: 1.10,
    veryHigh: 1.15,
  },
  minTradeCount: 10,
  minPremium: 50000,
  staleThresholdHours: 2,
};

/**
 * Options Flow Analysis Engine
 */
export class FlowAnalysisEngine {
  private config: FlowBoostConfig;

  constructor(config?: Partial<FlowBoostConfig>) {
    this.config = { ...DEFAULT_FLOW_BOOST_CONFIG, ...config };
  }

  /**
   * Get flow context for a symbol
   *
   * @param symbol - Symbol to query (e.g., 'SPX', 'NDX')
   * @param window - Time window ('short', 'medium', 'long')
   * @returns Flow context or null if not available
   */
  async getFlowContext(
    symbol: string,
    window: 'short' | 'medium' | 'long' = 'medium'
  ): Promise<FlowContext | null> {
    const supabase = createClient();

    try {
      const now = Date.now();
      const windowMs = this.config.timeWindows[window];
      const since = now - windowMs;

      // Query flow history from database
      const { data, error } = await supabase
        .from('options_flow_history')
        .select('*')
        .eq('symbol', symbol)
        .gte('timestamp', since)
        .order('timestamp', { ascending: false });

      if (error || !data || data.length === 0) {
        console.warn(`[FlowAnalysisEngine] No flow data for ${symbol} (${window}):`, error?.message);
        return null;
      }

      // Aggregate flow data
      const aggregated = this.aggregateFlowData(data);

      // Analyze sentiment
      const { sentiment, sentimentStrength } = this.analyzeSentiment(
        aggregated.putCallVolumeRatio,
        aggregated.putCallPremiumRatio
      );

      // Determine aggressiveness
      const aggressiveness = this.analyzeAggressiveness(
        aggregated.sweepCount,
        aggregated.tradeCount,
        aggregated.buyPremium,
        aggregated.totalPremium
      );

      // Calculate institutional score
      const institutionalScore = this.calculateInstitutionalScore(aggregated);

      // Determine recommendation
      const recommendation = this.getRecommendation(
        sentiment,
        sentimentStrength,
        institutionalScore,
        aggregated.tradeCount
      );

      // Calculate confidence
      const confidence = this.calculateConfidence(aggregated, now - since);

      // Check data age (most recent trade)
      const mostRecentTrade = data[0];
      const dataAge = now - mostRecentTrade.timestamp;
      const isStale = dataAge > this.config.staleThresholdHours * 60 * 60 * 1000;

      return {
        symbol,
        timestamp: now,
        window: this.formatWindow(windowMs),
        ...aggregated,
        sentiment,
        sentimentStrength,
        aggressiveness,
        institutionalScore,
        recommendation,
        confidence,
        dataAge,
        isStale,
      };
    } catch (error) {
      console.error(`[FlowAnalysisEngine] Error fetching flow context for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Apply flow boost to a base score
   *
   * @param baseScore - Original signal score (0-100)
   * @param flowContext - Flow context data
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @returns Adjusted score
   */
  applyFlowBoost(
    baseScore: number,
    flowContext: FlowContext | null,
    direction: 'LONG' | 'SHORT'
  ): number {
    // No context = no boost
    if (!flowContext) {
      return baseScore;
    }

    // Insufficient data = no boost
    if (
      flowContext.tradeCount < this.config.minTradeCount ||
      flowContext.totalPremium < this.config.minPremium
    ) {
      return baseScore;
    }

    // Stale data = reduced boost
    const stalePenalty = flowContext.isStale ? 0.3 : 0;

    // Get sentiment boost
    const sentimentBoost = this.getSentimentBoost(flowContext.sentiment, flowContext.sentimentStrength);

    // Get direction-specific boost
    const directionBoost = this.getDirectionBoost(direction, flowContext.sentiment);

    // Get institutional boost
    const institutionalBoost = this.getInstitutionalBoost(flowContext.institutionalScore);

    // Combine boosts with confidence weighting
    const combinedBoost = sentimentBoost * directionBoost * institutionalBoost;
    const confidenceWeight = flowContext.confidence / 100;
    const finalBoost = 1.0 + ((combinedBoost - 1.0) * confidenceWeight) - stalePenalty;

    // Apply boost
    const adjustedScore = baseScore * finalBoost;

    // Clamp to valid range (0-100)
    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Get flow context summary for UI display
   *
   * @param symbol - Symbol
   * @param window - Time window
   * @returns Human-readable summary
   */
  async getFlowSummary(symbol: string, window: 'short' | 'medium' | 'long' = 'medium'): Promise<string> {
    const context = await this.getFlowContext(symbol, window);

    if (!context) {
      return `Flow data not available for ${symbol}`;
    }

    const sentiment = context.sentiment;
    const strength = context.sentimentStrength.toFixed(0);
    const instScore = context.institutionalScore.toFixed(0);
    const rec = context.recommendation.replace(/_/g, ' ');

    return `Flow (${context.window}): ${sentiment} (${strength}%) | Inst: ${instScore}% → ${rec}`;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Aggregate flow data
   */
  private aggregateFlowData(flows: any[]): {
    totalVolume: number;
    totalPremium: number;
    tradeCount: number;
    callVolume: number;
    putVolume: number;
    callPremium: number;
    putPremium: number;
    putCallVolumeRatio: number;
    putCallPremiumRatio: number;
    buyVolume: number;
    sellVolume: number;
    buyPremium: number;
    sellPremium: number;
    sweepCount: number;
    blockCount: number;
    splitCount: number;
    largeCount: number;
    avgTradeSize: number;
    largeTradePercentage: number;
  } {
    let totalVolume = 0;
    let totalPremium = 0;
    let callVolume = 0;
    let putVolume = 0;
    let callPremium = 0;
    let putPremium = 0;
    let buyVolume = 0;
    let sellVolume = 0;
    let buyPremium = 0;
    let sellPremium = 0;
    let sweepCount = 0;
    let blockCount = 0;
    let splitCount = 0;
    let largeCount = 0;

    for (const flow of flows) {
      const volume = flow.size || 0;
      const premium = flow.premium || 0;

      totalVolume += volume;
      totalPremium += premium;

      if (flow.option_type === 'call') {
        callVolume += volume;
        callPremium += premium;
      } else {
        putVolume += volume;
        putPremium += premium;
      }

      if (flow.side === 'buy') {
        buyVolume += volume;
        buyPremium += premium;
      } else {
        sellVolume += volume;
        sellPremium += premium;
      }

      // Count flow types
      if (flow.type === 'SWEEP') sweepCount++;
      else if (flow.type === 'BLOCK') blockCount++;
      else if (flow.type === 'SPLIT') splitCount++;
      else if (flow.type === 'LARGE') largeCount++;
    }

    const putCallVolumeRatio = callVolume > 0 ? putVolume / callVolume : 0;
    const putCallPremiumRatio = callPremium > 0 ? putPremium / callPremium : 0;
    const avgTradeSize = flows.length > 0 ? totalPremium / flows.length : 0;
    const largeTradePercentage =
      flows.length > 0 ? ((sweepCount + blockCount) / flows.length) * 100 : 0;

    return {
      totalVolume,
      totalPremium,
      tradeCount: flows.length,
      callVolume,
      putVolume,
      callPremium,
      putPremium,
      putCallVolumeRatio,
      putCallPremiumRatio,
      buyVolume,
      sellVolume,
      buyPremium,
      sellPremium,
      sweepCount,
      blockCount,
      splitCount,
      largeCount,
      avgTradeSize,
      largeTradePercentage,
    };
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(
    pcVolumeRatio: number,
    pcPremiumRatio: number
  ): { sentiment: FlowSentiment; sentimentStrength: number } {
    // Average the two ratios for overall sentiment
    const avgRatio = (pcVolumeRatio + pcPremiumRatio) / 2;

    let sentiment: FlowSentiment;
    let strength: number;

    if (avgRatio < this.config.sentimentThresholds.strongBullish) {
      sentiment = 'BULLISH';
      strength = Math.min(100, (1 - avgRatio) * 100);
    } else if (avgRatio < this.config.sentimentThresholds.bullish) {
      sentiment = 'BULLISH';
      strength = Math.min(80, (1 - avgRatio) * 80);
    } else if (avgRatio > this.config.sentimentThresholds.strongBearish) {
      sentiment = 'BEARISH';
      strength = Math.min(100, (avgRatio - 1) * 100);
    } else if (avgRatio > this.config.sentimentThresholds.bearish) {
      sentiment = 'BEARISH';
      strength = Math.min(80, (avgRatio - 1) * 80);
    } else {
      sentiment = 'NEUTRAL';
      strength = 50;
    }

    return { sentiment, sentimentStrength: strength };
  }

  /**
   * Analyze aggressiveness
   */
  private analyzeAggressiveness(
    sweepCount: number,
    totalTrades: number,
    buyPremium: number,
    totalPremium: number
  ): FlowAggressiveness {
    const sweepPercentage = totalTrades > 0 ? (sweepCount / totalTrades) * 100 : 0;
    const buyPremiumPercentage = totalPremium > 0 ? (buyPremium / totalPremium) * 100 : 0;

    const aggressivenessScore = (sweepPercentage + buyPremiumPercentage) / 2;

    if (aggressivenessScore > 75) return 'VERY_AGGRESSIVE';
    if (aggressivenessScore > 60) return 'AGGRESSIVE';
    if (aggressivenessScore > 40) return 'MODERATE';
    return 'PASSIVE';
  }

  /**
   * Calculate institutional score
   */
  private calculateInstitutionalScore(aggregated: any): number {
    let score = 0;

    // Large trade percentage (0-40 points)
    score += Math.min(40, aggregated.largeTradePercentage);

    // Average trade size (0-30 points)
    // $100k+ = 30 points, $50k = 15 points, <$10k = 0 points
    if (aggregated.avgTradeSize > 100000) score += 30;
    else if (aggregated.avgTradeSize > 50000) score += 15;
    else if (aggregated.avgTradeSize > 10000) score += 5;

    // Sweep activity (0-20 points)
    const sweepPercentage = aggregated.tradeCount > 0 ? (aggregated.sweepCount / aggregated.tradeCount) * 100 : 0;
    score += Math.min(20, sweepPercentage);

    // Block activity (0-10 points)
    const blockPercentage = aggregated.tradeCount > 0 ? (aggregated.blockCount / aggregated.tradeCount) * 100 : 0;
    score += Math.min(10, blockPercentage);

    return Math.min(100, score);
  }

  /**
   * Get sentiment boost multiplier
   */
  private getSentimentBoost(sentiment: FlowSentiment, strength: number): number {
    if (sentiment === 'NEUTRAL') {
      return this.config.sentimentBoosts.NEUTRAL;
    }

    const category = sentiment === 'BULLISH' ? this.config.sentimentBoosts.BULLISH : this.config.sentimentBoosts.BEARISH;

    if (strength > 80) return category.VERY_STRONG;
    if (strength > 60) return category.STRONG;
    if (strength > 40) return category.MODERATE;
    return category.WEAK;
  }

  /**
   * Get direction-specific boost
   */
  private getDirectionBoost(direction: 'LONG' | 'SHORT', sentiment: FlowSentiment): number {
    if (direction === 'LONG') {
      if (sentiment === 'BULLISH') {
        return this.config.directionBoosts.LONG.bullishFlowBoost;
      }
      if (sentiment === 'BEARISH') {
        return this.config.directionBoosts.LONG.bearishFlowPenalty;
      }
    } else if (direction === 'SHORT') {
      if (sentiment === 'BEARISH') {
        return this.config.directionBoosts.SHORT.bearishFlowBoost;
      }
      if (sentiment === 'BULLISH') {
        return this.config.directionBoosts.SHORT.bullishFlowPenalty;
      }
    }

    return 1.0; // Neutral
  }

  /**
   * Get institutional boost
   */
  private getInstitutionalBoost(score: number): number {
    if (score > 80) return this.config.institutionalBoosts.veryHigh;
    if (score > 60) return this.config.institutionalBoosts.high;
    if (score > 30) return this.config.institutionalBoosts.moderate;
    return this.config.institutionalBoosts.low;
  }

  /**
   * Get trading recommendation
   */
  private getRecommendation(
    sentiment: FlowSentiment,
    strength: number,
    institutionalScore: number,
    tradeCount: number
  ): FlowContext['recommendation'] {
    // Insufficient data
    if (tradeCount < this.config.minTradeCount) {
      return 'WAIT';
    }

    // Strong sentiment + high institutional = follow flow
    if (strength > 70 && institutionalScore > 70) {
      return 'FOLLOW_FLOW';
    }

    // Moderate sentiment + moderate institutional = confirm flow
    if (strength > 50 && institutionalScore > 50) {
      return 'CONFIRM_FLOW';
    }

    // Weak sentiment or low institutional = neutral
    if (sentiment === 'NEUTRAL' || institutionalScore < 30) {
      return 'NEUTRAL';
    }

    // Counter-trend (retail heavy) = fade flow
    if (institutionalScore < 20 && strength > 60) {
      return 'FADE_FLOW';
    }

    return 'NEUTRAL';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(aggregated: any, windowMs: number): number {
    let confidence = 100;

    // Penalize low trade count
    if (aggregated.tradeCount < this.config.minTradeCount * 2) {
      confidence -= 20;
    }

    // Penalize low premium
    if (aggregated.totalPremium < this.config.minPremium * 2) {
      confidence -= 15;
    }

    // Penalize low institutional score
    if (aggregated.institutionalScore < 30) {
      confidence -= 15;
    }

    // Penalize short time window (less reliable)
    if (windowMs < this.config.timeWindows.medium) {
      confidence -= 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Format window in human-readable form
   */
  private formatWindow(windowMs: number): string {
    const hours = windowMs / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  }
}

/**
 * Singleton instance for global use
 */
export const flowAnalysisEngine = new FlowAnalysisEngine();
