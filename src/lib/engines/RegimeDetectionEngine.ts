/**
 * Market Regime Detection Engine
 * Phase 2: Context Engines
 *
 * Queries market regime history to provide overall market context.
 * Applies score boosts/penalties and strategy recommendations based on regime.
 *
 * Key Insights:
 * - STRONG_UPTREND: VIX low, breadth bullish → Favor longs
 * - CHOPPY/RANGE_BOUND: Mixed signals → Reduce size or avoid
 * - CAPITULATION: Extreme fear → Contrarian longs
 * - EUPHORIA: Extreme greed → Contrarian shorts
 */

import { createClient } from "../supabase/client.js";

/**
 * Market Regime Classification
 */
export type MarketRegime =
  | "STRONG_UPTREND"
  | "WEAK_UPTREND"
  | "CHOPPY_BULLISH"
  | "RANGE_BOUND"
  | "CHOPPY_BEARISH"
  | "WEAK_DOWNTREND"
  | "STRONG_DOWNTREND"
  | "BREAKOUT"
  | "BREAKDOWN"
  | "CAPITULATION"
  | "EUPHORIA";

/**
 * VIX Regime
 */
export type VIXRegime = "EXTREMELY_LOW" | "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";

/**
 * Breadth Regime
 */
export type BreadthRegime =
  | "EXTREMELY_BEARISH"
  | "BEARISH"
  | "NEUTRAL"
  | "BULLISH"
  | "EXTREMELY_BULLISH";

/**
 * Regime Context Result
 */
export interface RegimeContext {
  date: string;
  timestamp: number;

  // VIX metrics
  vixLevel: number;
  vixRegime: VIXRegime;
  vixChange: number | null;
  vixChangePct: number | null;

  // Breadth metrics
  advanceDeclineRatio: number | null;
  breadthRegime: BreadthRegime | null;
  newHighsLows: number | null;

  // Index performance
  spyClose: number | null;
  spyChangePct: number | null;
  ndxChangePct: number | null;

  // Overall regime
  marketRegime: MarketRegime;
  confidenceScore: number;

  // Trading recommendations
  recommendation:
    | "AGGRESSIVE_LONGS"
    | "SELECTIVE_LONGS"
    | "NEUTRAL"
    | "SELECTIVE_SHORTS"
    | "AGGRESSIVE_SHORTS"
    | "AVOID_TRADING"
    | "CONTRARIAN_OPPORTUNITY";
  strategyAdvice: string;

  // Metadata
  dataAge?: number;
  isStale?: boolean;
}

/**
 * Regime Boost Configuration
 */
export interface RegimeBoostConfig {
  // Boost multipliers by market regime
  regimeBoosts: {
    STRONG_UPTREND: number; // Default: 1.25
    WEAK_UPTREND: number; // Default: 1.10
    CHOPPY_BULLISH: number; // Default: 0.95
    RANGE_BOUND: number; // Default: 0.80
    CHOPPY_BEARISH: number; // Default: 0.90
    WEAK_DOWNTREND: number; // Default: 1.05
    STRONG_DOWNTREND: number; // Default: 1.20
    BREAKOUT: number; // Default: 1.30
    BREAKDOWN: number; // Default: 1.25
    CAPITULATION: number; // Default: 1.40 (contrarian)
    EUPHORIA: number; // Default: 0.70 (caution)
  };

  // VIX-based boosts
  vixBoosts: {
    EXTREMELY_LOW: number; // Default: 1.05 (complacency)
    LOW: number; // Default: 1.10 (low vol)
    NORMAL: number; // Default: 1.00
    ELEVATED: number; // Default: 0.95 (caution)
    HIGH: number; // Default: 0.85 (high vol)
    EXTREME: number; // Default: 0.70 (panic/opportunity)
  };

  // Direction-specific modifiers
  directionBoosts: {
    LONG: {
      uptrendBoost: number; // Default: 1.20
      downtrendPenalty: number; // Default: 0.70
      capitulationBoost: number; // Default: 1.30 (buy fear)
      euphoriaPenalty: number; // Default: 0.60 (avoid greed)
    };
    SHORT: {
      downtrendBoost: number; // Default: 1.20
      uptrendPenalty: number; // Default: 0.70
      euphoriaBoost: number; // Default: 1.25 (sell greed)
      capitulationPenalty: number; // Default: 0.65 (avoid panic)
    };
  };

  // Strategy-specific recommendations
  strategyFilters: {
    SCALP: MarketRegime[]; // Favorable regimes for scalping
    DAY: MarketRegime[]; // Favorable regimes for day trading
    SWING: MarketRegime[]; // Favorable regimes for swings
  };

  staleThresholdHours: number; // Default: 24 hours
}

/**
 * Default Regime Boost Configuration
 */
const DEFAULT_REGIME_BOOST_CONFIG: RegimeBoostConfig = {
  regimeBoosts: {
    STRONG_UPTREND: 1.25,
    WEAK_UPTREND: 1.1,
    CHOPPY_BULLISH: 0.95,
    RANGE_BOUND: 0.8,
    CHOPPY_BEARISH: 0.9,
    WEAK_DOWNTREND: 1.05,
    STRONG_DOWNTREND: 1.2,
    BREAKOUT: 1.3,
    BREAKDOWN: 1.25,
    CAPITULATION: 1.4,
    EUPHORIA: 0.7,
  },
  vixBoosts: {
    EXTREMELY_LOW: 1.05,
    LOW: 1.1,
    NORMAL: 1.0,
    ELEVATED: 0.95,
    HIGH: 0.85,
    EXTREME: 0.7,
  },
  directionBoosts: {
    LONG: {
      uptrendBoost: 1.2,
      downtrendPenalty: 0.7,
      capitulationBoost: 1.3,
      euphoriaPenalty: 0.6,
    },
    SHORT: {
      downtrendBoost: 1.2,
      uptrendPenalty: 0.7,
      euphoriaBoost: 1.25,
      capitulationPenalty: 0.65,
    },
  },
  strategyFilters: {
    SCALP: ["STRONG_UPTREND", "WEAK_UPTREND", "BREAKOUT", "STRONG_DOWNTREND", "BREAKDOWN"],
    DAY: [
      "STRONG_UPTREND",
      "WEAK_UPTREND",
      "STRONG_DOWNTREND",
      "WEAK_DOWNTREND",
      "BREAKOUT",
      "BREAKDOWN",
    ],
    SWING: ["STRONG_UPTREND", "STRONG_DOWNTREND", "BREAKOUT", "BREAKDOWN", "CAPITULATION"],
  },
  staleThresholdHours: 24,
};

/**
 * Market Regime Detection Engine
 */
export class RegimeDetectionEngine {
  private config: RegimeBoostConfig;

  constructor(config?: Partial<RegimeBoostConfig>) {
    this.config = { ...DEFAULT_REGIME_BOOST_CONFIG, ...config };
  }

  /**
   * Get market regime context
   *
   * @returns Regime context or null if not available
   */
  async getRegimeContext(): Promise<RegimeContext | null> {
    const supabase = createClient();

    try {
      // Query latest market regime
      const { data, error } = await supabase
        .from("market_regime_history")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // Silently return null for missing table (406) or no data
        // Only warn for unexpected errors
        if (error?.code !== "PGRST116" && error?.message?.includes("does not exist") === false) {
          console.warn(`[RegimeDetectionEngine] No regime data:`, error?.message);
        }
        return null;
      }

      // Parse timestamp
      const timestamp = new Date(data.date).getTime();
      const dataAge = Date.now() - timestamp;
      const isStale = dataAge > this.config.staleThresholdHours * 60 * 60 * 1000;

      // Determine recommendation
      const recommendation = this.getRecommendation(data.market_regime, data.vix_regime);

      // Get strategy advice
      const strategyAdvice = this.getStrategyAdvice(data.market_regime);

      return {
        date: data.date,
        timestamp,
        vixLevel: data.vix_level,
        vixRegime: data.vix_regime,
        vixChange: data.vix_change,
        vixChangePct: data.vix_change_pct,
        advanceDeclineRatio: data.advance_decline_ratio,
        breadthRegime: data.breadth_regime,
        newHighsLows: data.new_highs && data.new_lows ? data.new_highs - data.new_lows : null,
        spyClose: data.spy_close,
        spyChangePct: data.spy_change_pct,
        ndxChangePct: data.ndx_change_pct,
        marketRegime: data.market_regime,
        confidenceScore: data.confidence_score,
        recommendation,
        strategyAdvice,
        dataAge,
        isStale,
      };
    } catch (error) {
      console.error(`[RegimeDetectionEngine] Error fetching regime context:`, error);
      return null;
    }
  }

  /**
   * Apply regime boost to a base score
   *
   * @param baseScore - Original signal score (0-100)
   * @param regimeContext - Regime context data
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @param tradingStyle - Trading style ('SCALP', 'DAY', 'SWING')
   * @returns Adjusted score
   */
  applyRegimeBoost(
    baseScore: number,
    regimeContext: RegimeContext | null,
    direction: "LONG" | "SHORT",
    tradingStyle?: "SCALP" | "DAY" | "SWING"
  ): number {
    // No context = no boost
    if (!regimeContext) {
      return baseScore;
    }

    // Stale data = reduced boost
    const stalePenalty = regimeContext.isStale ? 0.2 : 0;

    // Get regime boost
    const regimeBoost = this.config.regimeBoosts[regimeContext.marketRegime];

    // Get VIX boost
    const vixBoost = this.config.vixBoosts[regimeContext.vixRegime];

    // Get direction-specific boost
    const directionBoost = this.getDirectionBoost(direction, regimeContext.marketRegime);

    // Apply strategy filter
    let strategyFilter = 1.0;
    if (tradingStyle && !this.isFavorableRegime(regimeContext.marketRegime, tradingStyle)) {
      strategyFilter = 0.85; // Reduce score if regime not favorable for strategy
    }

    // Combine boosts with confidence weighting
    const combinedBoost = regimeBoost * vixBoost * directionBoost * strategyFilter;
    const confidenceWeight = regimeContext.confidenceScore / 100;
    const finalBoost = 1.0 + (combinedBoost - 1.0) * confidenceWeight - stalePenalty;

    // Apply boost
    const adjustedScore = baseScore * finalBoost;

    // Clamp to valid range (0-100)
    return Math.max(0, Math.min(100, adjustedScore));
  }

  /**
   * Get regime context summary for UI display
   *
   * @returns Human-readable summary
   */
  async getRegimeSummary(): Promise<string> {
    const context = await this.getRegimeContext();

    if (!context) {
      return `Regime data not available`;
    }

    const regime = context.marketRegime.replace(/_/g, " ");
    const vix = context.vixRegime.replace(/_/g, " ");
    const rec = context.recommendation.replace(/_/g, " ");

    return `Regime: ${regime} | VIX: ${vix} (${context.vixLevel.toFixed(1)}) → ${rec}`;
  }

  /**
   * Check if current regime is favorable for a trading style
   *
   * @param style - Trading style
   * @returns True if favorable, false otherwise
   */
  async isFavorableForStyle(style: "SCALP" | "DAY" | "SWING"): Promise<boolean> {
    const context = await this.getRegimeContext();
    if (!context) return true; // Unknown regime = neutral (don't filter)

    return this.isFavorableRegime(context.marketRegime, style);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Check if regime is favorable for a strategy
   */
  private isFavorableRegime(regime: MarketRegime, style: "SCALP" | "DAY" | "SWING"): boolean {
    return this.config.strategyFilters[style].includes(regime);
  }

  /**
   * Get direction-specific boost
   */
  private getDirectionBoost(direction: "LONG" | "SHORT", regime: MarketRegime): number {
    const uptrendRegimes: MarketRegime[] = [
      "STRONG_UPTREND",
      "WEAK_UPTREND",
      "CHOPPY_BULLISH",
      "BREAKOUT",
    ];
    const downtrendRegimes: MarketRegime[] = [
      "STRONG_DOWNTREND",
      "WEAK_DOWNTREND",
      "CHOPPY_BEARISH",
      "BREAKDOWN",
    ];

    if (direction === "LONG") {
      if (uptrendRegimes.includes(regime)) {
        return this.config.directionBoosts.LONG.uptrendBoost;
      }
      if (downtrendRegimes.includes(regime)) {
        return this.config.directionBoosts.LONG.downtrendPenalty;
      }
      if (regime === "CAPITULATION") {
        return this.config.directionBoosts.LONG.capitulationBoost;
      }
      if (regime === "EUPHORIA") {
        return this.config.directionBoosts.LONG.euphoriaPenalty;
      }
    } else if (direction === "SHORT") {
      if (downtrendRegimes.includes(regime)) {
        return this.config.directionBoosts.SHORT.downtrendBoost;
      }
      if (uptrendRegimes.includes(regime)) {
        return this.config.directionBoosts.SHORT.uptrendPenalty;
      }
      if (regime === "EUPHORIA") {
        return this.config.directionBoosts.SHORT.euphoriaBoost;
      }
      if (regime === "CAPITULATION") {
        return this.config.directionBoosts.SHORT.capitulationPenalty;
      }
    }

    return 1.0; // Neutral
  }

  /**
   * Get trading recommendation
   */
  private getRecommendation(
    regime: MarketRegime,
    vixRegime: VIXRegime
  ): RegimeContext["recommendation"] {
    // Extreme conditions
    if (regime === "CAPITULATION") {
      return "CONTRARIAN_OPPORTUNITY";
    }
    if (regime === "EUPHORIA") {
      return "CONTRARIAN_OPPORTUNITY";
    }

    // Strong trends
    if (regime === "STRONG_UPTREND" || regime === "BREAKOUT") {
      return "AGGRESSIVE_LONGS";
    }
    if (regime === "STRONG_DOWNTREND" || regime === "BREAKDOWN") {
      return "AGGRESSIVE_SHORTS";
    }

    // Weak trends
    if (regime === "WEAK_UPTREND" || regime === "CHOPPY_BULLISH") {
      return "SELECTIVE_LONGS";
    }
    if (regime === "WEAK_DOWNTREND" || regime === "CHOPPY_BEARISH") {
      return "SELECTIVE_SHORTS";
    }

    // Range bound
    if (regime === "RANGE_BOUND") {
      if (vixRegime === "EXTREMELY_LOW" || vixRegime === "LOW") {
        return "NEUTRAL";
      }
      return "AVOID_TRADING";
    }

    return "NEUTRAL";
  }

  /**
   * Get strategy advice
   */
  private getStrategyAdvice(regime: MarketRegime): string {
    const advice: Record<MarketRegime, string> = {
      STRONG_UPTREND: "Favor trend-following longs. Use pullbacks as entries. Ride winners.",
      WEAK_UPTREND: "Selective longs on strong setups. Take profits at resistance. Reduce size.",
      CHOPPY_BULLISH: "Quick scalps only. Avoid holding overnight. Watch for false breakouts.",
      RANGE_BOUND: "Range-bound strategies only. Fade extremes. Reduce exposure.",
      CHOPPY_BEARISH: "Quick scalps or avoid. High probability of whipsaws. Reduce size.",
      WEAK_DOWNTREND: "Selective shorts on weak bounces. Cover at support. Reduce size.",
      STRONG_DOWNTREND: "Favor trend-following shorts. Sell rallies. Ride winners.",
      BREAKOUT: "Aggressive entries on breakout confirmation. Trail stops. Full size.",
      BREAKDOWN: "Aggressive shorts on breakdown confirmation. Trail stops. Full size.",
      CAPITULATION: "Contrarian longs near panic lows. Wait for reversal signals. Scale in.",
      EUPHORIA: "Contrarian shorts near greed highs. Wait for exhaustion. Scale in.",
    };

    return advice[regime] || "Monitor market conditions closely.";
  }
}

/**
 * Singleton instance for global use
 */
export const regimeDetectionEngine = new RegimeDetectionEngine();
