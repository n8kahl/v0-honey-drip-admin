/**
 * Multi-Timeframe Alignment Engine
 * Phase 2: Context Engines
 *
 * Queries Massive.com historical bars across multiple timeframes to provide
 * trend alignment context. Prevents false breakouts by filtering intraday
 * signals against daily/weekly trends.
 *
 * Key Insights:
 * - ALIGNED: All timeframes trending same direction → HIGH CONFIDENCE
 * - DIVERGING: Lower TF counter to higher TF → CAUTION
 * - NEUTRAL: Mixed signals → WAIT FOR CONFIRMATION
 *
 * Uses Massive.com Advanced historical aggregates for accurate backtesting
 */

import { createClient } from "../supabase/client.js";

// Throttle warning logs to prevent console spam
const warnedSymbolTimeframes = new Set<string>();
const WARN_THROTTLE_MS = 60_000; // Only warn once per minute per symbol+tf

/**
 * Timeframe trend classification
 */
export type TrendDirection = "STRONG_UP" | "UP" | "NEUTRAL" | "DOWN" | "STRONG_DOWN";

/**
 * Timeframe definition
 */
export interface Timeframe {
  name: string;
  interval: "1" | "5" | "15" | "60" | "240" | "1D" | "1W";
  weight: number; // Weight in alignment calculation (higher TF = more weight)
  barsNeeded: number; // Number of bars to analyze
}

/**
 * Timeframe analysis result
 */
export interface TimeframeAnalysis {
  timeframe: string;
  trend: TrendDirection;
  strength: number; // 0-100
  emaSlope: number;
  priceVsEMA: number; // % distance from EMA
  recentHigh: number;
  recentLow: number;
  atr: number;
  confidence: number;
}

/**
 * MTF Alignment Result
 */
export interface MTFContext {
  symbol: string;
  timestamp: number;

  // Individual timeframe analysis
  timeframes: Record<string, TimeframeAnalysis>;

  // Overall alignment
  alignment: "FULLY_ALIGNED" | "MOSTLY_ALIGNED" | "NEUTRAL" | "DIVERGING" | "CONFLICTING";
  alignmentScore: number; // 0-100 (higher = more aligned)
  dominantTrend: TrendDirection;
  trendStrength: number;

  // Trading recommendations
  recommendation: "STRONG_SIGNAL" | "CONFIRM_SIGNAL" | "WAIT_ALIGNMENT" | "AVOID_DIVERGENCE";
  confidence: number;

  // Metadata
  dataAge?: number;
  isStale?: boolean;
}

/**
 * MTF Boost Configuration
 */
export interface MTFBoostConfig {
  // Timeframe definitions (ordered by importance)
  timeframes: Timeframe[];

  // Alignment thresholds
  alignmentThresholds: {
    fullyAligned: number; // Default: 85 (85%+ alignment)
    mostlyAligned: number; // Default: 65
    neutral: number; // Default: 45
    diverging: number; // Default: 25
  };

  // Boost multipliers by alignment
  alignmentBoosts: {
    FULLY_ALIGNED: number; // Default: 1.25 (+25%)
    MOSTLY_ALIGNED: number; // Default: 1.10 (+10%)
    NEUTRAL: number; // Default: 1.00 (no change)
    DIVERGING: number; // Default: 0.85 (-15%)
    CONFLICTING: number; // Default: 0.65 (-35%)
  };

  // Direction-specific boosts
  directionBoosts: {
    LONG: {
      alignedUpBoost: number; // Default: 1.20 (favor aligned longs)
      divergingPenalty: number; // Default: 0.70 (avoid diverging longs)
    };
    SHORT: {
      alignedDownBoost: number; // Default: 1.20 (favor aligned shorts)
      divergingPenalty: number; // Default: 0.70 (avoid diverging shorts)
    };
  };

  // EMA periods for trend detection
  emaPeriod: number; // Default: 20 (20-bar EMA)
  atrPeriod: number; // Default: 14 (ATR for volatility)

  // Stale threshold
  staleThresholdHours: number; // Default: 4 hours
}

/**
 * Default MTF Boost Configuration
 */
const DEFAULT_MTF_BOOST_CONFIG: MTFBoostConfig = {
  timeframes: [
    { name: "1W", interval: "1W", weight: 3.0, barsNeeded: 20 }, // Weekly: highest weight
    { name: "1D", interval: "1D", weight: 2.0, barsNeeded: 30 }, // Daily: high weight
    { name: "4H", interval: "240", weight: 1.5, barsNeeded: 40 }, // 4H: medium-high weight
    { name: "1H", interval: "60", weight: 1.0, barsNeeded: 40 }, // 1H: medium weight
    { name: "15m", interval: "15", weight: 0.5, barsNeeded: 50 }, // 15m: low weight
    { name: "5m", interval: "5", weight: 0.25, barsNeeded: 50 }, // 5m: scalping context
  ],
  alignmentThresholds: {
    fullyAligned: 85,
    mostlyAligned: 65,
    neutral: 45,
    diverging: 25,
  },
  alignmentBoosts: {
    FULLY_ALIGNED: 1.25,
    MOSTLY_ALIGNED: 1.1,
    NEUTRAL: 1.0,
    DIVERGING: 0.85,
    CONFLICTING: 0.65,
  },
  directionBoosts: {
    LONG: {
      alignedUpBoost: 1.2,
      divergingPenalty: 0.7,
    },
    SHORT: {
      alignedDownBoost: 1.2,
      divergingPenalty: 0.7,
    },
  },
  emaPeriod: 20,
  atrPeriod: 14,
  staleThresholdHours: 4,
};

/**
 * Multi-Timeframe Alignment Engine
 */
export class MTFAlignmentEngine {
  private config: MTFBoostConfig;

  constructor(config?: Partial<MTFBoostConfig>) {
    this.config = { ...DEFAULT_MTF_BOOST_CONFIG, ...config };
  }

  /**
   * Get MTF context for a symbol
   *
   * Uses historical_bars table (Phase 1 persistent storage) for fast access
   *
   * @param symbol - Symbol to query (e.g., 'SPY', 'SPX')
   * @returns MTF context or null if not available
   */
  async getMTFContext(symbol: string): Promise<MTFContext | null> {
    const supabase = createClient();

    try {
      const timestamp = Date.now();
      const timeframeAnalyses: Record<string, TimeframeAnalysis> = {};

      // Analyze each timeframe in PARALLEL for performance (5x speedup)
      const analysisPromises = this.config.timeframes.map((tf) =>
        this.analyzeTimeframe(supabase, symbol, tf)
          .then((analysis) => (analysis ? { tfName: tf.name, analysis } : null))
          .catch((err) => {
            console.error(`[MTFAlignmentEngine] Failed to analyze ${tf.name} for ${symbol}:`, err);
            return null;
          })
      );

      const results = await Promise.all(analysisPromises);

      // Aggregate results
      for (const res of results) {
        if (res) {
          timeframeAnalyses[res.tfName] = res.analysis;
        }
      }

      // Not enough data
      if (Object.keys(timeframeAnalyses).length === 0) {
        console.warn(`[MTFAlignmentEngine] No timeframe data for ${symbol}`);
        return null;
      }

      // Calculate alignment score
      const { alignment, alignmentScore, dominantTrend, trendStrength } =
        this.calculateAlignment(timeframeAnalyses);

      // Determine recommendation
      const recommendation = this.getRecommendation(alignment, dominantTrend);

      // Calculate confidence
      const confidence = this.calculateConfidence(timeframeAnalyses, alignmentScore);

      // Check data age (use most recent timeframe data)
      const mostRecentTimestamp = Math.max(
        ...Object.values(timeframeAnalyses).map((tf) => timestamp)
      );
      const dataAge = Date.now() - mostRecentTimestamp;
      const isStale = dataAge > this.config.staleThresholdHours * 60 * 60 * 1000;

      return {
        symbol,
        timestamp,
        timeframes: timeframeAnalyses,
        alignment,
        alignmentScore,
        dominantTrend,
        trendStrength,
        recommendation,
        confidence,
        dataAge,
        isStale,
      };
    } catch (error) {
      console.error(`[MTFAlignmentEngine] Error fetching MTF context for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Apply MTF boost to a base score
   *
   * @param baseScore - Original signal score (0-100)
   * @param mtfContext - MTF context data
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @returns Adjusted score
   */
  applyMTFBoost(
    baseScore: number,
    mtfContext: MTFContext | null,
    direction: "LONG" | "SHORT"
  ): number {
    // No context = no boost
    if (!mtfContext) {
      return baseScore;
    }

    // Stale data = reduced boost
    const stalePenalty = mtfContext.isStale ? 0.3 : 0;

    // Get alignment boost
    const alignmentBoost = this.config.alignmentBoosts[mtfContext.alignment];

    // Get direction-specific boost
    const directionBoost = this.getDirectionBoost(direction, mtfContext);

    // Combine boosts with confidence weighting
    const combinedBoost = alignmentBoost * directionBoost;
    const confidenceWeight = mtfContext.confidence / 100;
    const finalBoost = 1.0 + (combinedBoost - 1.0) * confidenceWeight - stalePenalty;

    // Apply boost
    const adjustedScore = baseScore * finalBoost;

    // Clamp to valid range (0-100)
    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Get MTF context summary for UI display
   *
   * @param symbol - Symbol
   * @returns Human-readable summary
   */
  async getMTFSummary(symbol: string): Promise<string> {
    const context = await this.getMTFContext(symbol);

    if (!context) {
      return `MTF data not available for ${symbol}`;
    }

    const alignment = context.alignment.replace(/_/g, " ");
    const trend = context.dominantTrend.replace(/_/g, " ");
    const rec = context.recommendation.replace(/_/g, " ");

    return `MTF: ${alignment} (${trend}) → ${rec} (${context.alignmentScore.toFixed(0)}%)`;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Analyze a single timeframe
   */
  private async analyzeTimeframe(
    supabase: any,
    symbol: string,
    tf: Timeframe
  ): Promise<TimeframeAnalysis | null> {
    try {
      // Query historical bars from database (Phase 1 persistent storage)
      const { data, error } = await supabase
        .from("historical_bars")
        .select("*")
        .eq("symbol", symbol)
        .eq("timeframe", this.mapIntervalToTimeframe(tf.interval))
        .order("timestamp", { ascending: false })
        .limit(tf.barsNeeded);

      if (error || !data || data.length < tf.barsNeeded / 2) {
        // Throttle warning logs (only log once per symbol+tf per minute)
        const warnKey = `${symbol}:${tf.name}`;
        if (!warnedSymbolTimeframes.has(warnKey)) {
          console.warn(
            `[MTFAlignmentEngine] Insufficient data for ${symbol} ${tf.name} (will not repeat for 1 min)`
          );
          warnedSymbolTimeframes.add(warnKey);
          setTimeout(() => warnedSymbolTimeframes.delete(warnKey), WARN_THROTTLE_MS);
        }
        return null;
      }

      // Reverse to chronological order
      const bars = data.reverse();

      // Calculate EMA
      const closes = bars.map((b: any) => b.close);
      const ema = this.calculateEMA(closes, this.config.emaPeriod);

      // Calculate ATR
      const highs = bars.map((b: any) => b.high);
      const lows = bars.map((b: any) => b.low);
      const atr = this.calculateATR(highs, lows, closes, this.config.atrPeriod);

      // Analyze trend
      const currentPrice = closes[closes.length - 1];
      const currentEMA = ema[ema.length - 1];
      const priceVsEMA = ((currentPrice - currentEMA) / currentEMA) * 100;

      // EMA slope (last 5 periods)
      const emaSlope = this.calculateSlope(ema.slice(-5));

      // Recent high/low
      const recentHigh = Math.max(...highs.slice(-20));
      const recentLow = Math.min(...lows.slice(-20));

      // Classify trend
      const trend = this.classifyTrend(priceVsEMA, emaSlope);
      const strength = this.calculateTrendStrength(priceVsEMA, emaSlope, atr, currentPrice);

      // Confidence based on data quality
      const confidence = Math.min(100, (data.length / tf.barsNeeded) * 100);

      return {
        timeframe: tf.name,
        trend,
        strength,
        emaSlope,
        priceVsEMA,
        recentHigh,
        recentLow,
        atr,
        confidence,
      };
    } catch (error) {
      console.error(`[MTFAlignmentEngine] Error analyzing ${symbol} ${tf.name}:`, error);
      return null;
    }
  }

  /**
   * Map interval to timeframe string for database query
   */
  private mapIntervalToTimeframe(interval: string): string {
    const map: Record<string, string> = {
      "1": "1m",
      "5": "5m",
      "15": "15m",
      "60": "1h",
      "240": "4h",
      "1D": "day",
      "1W": "week",
    };
    return map[interval] || interval;
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    ema[0] = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    const trueRanges: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
  }

  /**
   * Calculate slope of an array
   */
  private calculateSlope(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Classify trend based on price vs EMA and slope
   */
  private classifyTrend(priceVsEMA: number, emaSlope: number): TrendDirection {
    if (priceVsEMA > 3 && emaSlope > 0.5) return "STRONG_UP";
    if (priceVsEMA > 1 && emaSlope > 0) return "UP";
    if (priceVsEMA < -3 && emaSlope < -0.5) return "STRONG_DOWN";
    if (priceVsEMA < -1 && emaSlope < 0) return "DOWN";
    return "NEUTRAL";
  }

  /**
   * Calculate trend strength (0-100)
   */
  private calculateTrendStrength(
    priceVsEMA: number,
    emaSlope: number,
    atr: number,
    price: number
  ): number {
    const priceScore = Math.min(100, Math.abs(priceVsEMA) * 10);
    const slopeScore = Math.min(100, Math.abs(emaSlope) * 20);
    const volatilityScore = Math.min(100, (atr / price) * 100 * 5);

    return priceScore * 0.4 + slopeScore * 0.4 + volatilityScore * 0.2;
  }

  /**
   * Calculate alignment across timeframes
   */
  private calculateAlignment(timeframes: Record<string, TimeframeAnalysis>): {
    alignment: MTFContext["alignment"];
    alignmentScore: number;
    dominantTrend: TrendDirection;
    trendStrength: number;
  } {
    const tfArray = Object.values(timeframes);

    // Calculate weighted alignment score
    let totalWeight = 0;
    let alignedWeight = 0;
    let weightedTrendScore = 0;

    const trendScores: Record<TrendDirection, number> = {
      STRONG_UP: 2,
      UP: 1,
      NEUTRAL: 0,
      DOWN: -1,
      STRONG_DOWN: -2,
    };

    for (const tf of tfArray) {
      const tfConfig = this.config.timeframes.find((t) => t.name === tf.timeframe);
      const weight = tfConfig?.weight || 1.0;

      totalWeight += weight;
      weightedTrendScore += trendScores[tf.trend] * weight * (tf.strength / 100);

      // Count as aligned if same sign as weighted average
      if (
        (weightedTrendScore > 0 && trendScores[tf.trend] > 0) ||
        (weightedTrendScore < 0 && trendScores[tf.trend] < 0)
      ) {
        alignedWeight += weight;
      }
    }

    const alignmentScore = (alignedWeight / totalWeight) * 100;

    // Determine alignment classification
    let alignment: MTFContext["alignment"];
    if (alignmentScore >= this.config.alignmentThresholds.fullyAligned) {
      alignment = "FULLY_ALIGNED";
    } else if (alignmentScore >= this.config.alignmentThresholds.mostlyAligned) {
      alignment = "MOSTLY_ALIGNED";
    } else if (alignmentScore >= this.config.alignmentThresholds.neutral) {
      alignment = "NEUTRAL";
    } else if (alignmentScore >= this.config.alignmentThresholds.diverging) {
      alignment = "DIVERGING";
    } else {
      alignment = "CONFLICTING";
    }

    // Determine dominant trend
    const avgTrendScore = weightedTrendScore / totalWeight;
    let dominantTrend: TrendDirection;
    if (avgTrendScore > 1.5) dominantTrend = "STRONG_UP";
    else if (avgTrendScore > 0.5) dominantTrend = "UP";
    else if (avgTrendScore < -1.5) dominantTrend = "STRONG_DOWN";
    else if (avgTrendScore < -0.5) dominantTrend = "DOWN";
    else dominantTrend = "NEUTRAL";

    // Calculate overall trend strength
    const trendStrength = Math.min(100, Math.abs(avgTrendScore) * 50);

    return { alignment, alignmentScore, dominantTrend, trendStrength };
  }

  /**
   * Get direction-specific boost
   */
  private getDirectionBoost(direction: "LONG" | "SHORT", context: MTFContext): number {
    if (direction === "LONG") {
      // Favor longs when aligned up
      if (context.dominantTrend === "STRONG_UP" || context.dominantTrend === "UP") {
        if (context.alignment === "FULLY_ALIGNED" || context.alignment === "MOSTLY_ALIGNED") {
          return this.config.directionBoosts.LONG.alignedUpBoost;
        }
      }

      // Penalize longs when diverging or down trending
      if (context.alignment === "DIVERGING" || context.alignment === "CONFLICTING") {
        return this.config.directionBoosts.LONG.divergingPenalty;
      }
    } else if (direction === "SHORT") {
      // Favor shorts when aligned down
      if (context.dominantTrend === "STRONG_DOWN" || context.dominantTrend === "DOWN") {
        if (context.alignment === "FULLY_ALIGNED" || context.alignment === "MOSTLY_ALIGNED") {
          return this.config.directionBoosts.SHORT.alignedDownBoost;
        }
      }

      // Penalize shorts when diverging or up trending
      if (context.alignment === "DIVERGING" || context.alignment === "CONFLICTING") {
        return this.config.directionBoosts.SHORT.divergingPenalty;
      }
    }

    return 1.0; // Neutral
  }

  /**
   * Get trading recommendation
   */
  private getRecommendation(
    alignment: MTFContext["alignment"],
    dominantTrend: TrendDirection
  ): MTFContext["recommendation"] {
    if (alignment === "FULLY_ALIGNED" && dominantTrend !== "NEUTRAL") {
      return "STRONG_SIGNAL";
    }

    if (alignment === "MOSTLY_ALIGNED") {
      return "CONFIRM_SIGNAL";
    }

    if (alignment === "DIVERGING" || alignment === "CONFLICTING") {
      return "AVOID_DIVERGENCE";
    }

    return "WAIT_ALIGNMENT";
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    timeframes: Record<string, TimeframeAnalysis>,
    alignmentScore: number
  ): number {
    // Base confidence on alignment
    let confidence = alignmentScore;

    // Penalize if missing high-weight timeframes
    const missingHighWeight = this.config.timeframes
      .filter((tf) => tf.weight >= 2.0)
      .filter((tf) => !timeframes[tf.name]);

    confidence -= missingHighWeight.length * 15;

    // Boost if all timeframes have high individual confidence
    const avgTimeframeConfidence =
      Object.values(timeframes).reduce((sum, tf) => sum + tf.confidence, 0) /
      Object.keys(timeframes).length;

    confidence = (confidence + avgTimeframeConfidence) / 2;

    return Math.max(0, Math.min(100, confidence));
  }
}

/**
 * Singleton instance for global use
 */
export const mtfAlignmentEngine = new MTFAlignmentEngine();
