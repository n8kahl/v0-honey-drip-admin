import type { SymbolFeatures } from "../strategy/engine.js";

/**
 * Options Chain Data Interface
 * Used by SPX/NDX-specific detectors for gamma analysis
 */
export interface OptionsChainData {
  // Gamma analysis
  maxGammaStrike?: number;
  gammaAtStrike?: (strike: number) => number;
  dealerGamma?: number;
  gammaFlipLevel?: number;
  gammaAtFlipLevel?: number;

  // Dealer positioning
  dealerNetDelta?: number;
  dealerNetGamma?: number;

  // Max pain
  maxPainStrike?: number;
  openInterestAtStrike?: (strike: number) => number;
  totalOpenInterest?: number;

  // Call/Put analysis
  callPutRatio?: number;
  callVolume?: number;
  putVolume?: number;
  callOI?: number;
  putOI?: number;

  // 0DTE specific
  minutesToExpiry?: number;
  is0DTE?: boolean;

  // Volume
  totalVolume?: number;
  avgVolume?: number;
}

/**
 * Direction of trade opportunity
 */
export type OpportunityDirection = "LONG" | "SHORT";

/**
 * Type of opportunity detected
 */
export type OpportunityType =
  // Universal Equity
  | "breakout_bullish"
  | "breakout_bearish"
  | "mean_reversion_long"
  | "mean_reversion_short"
  | "trend_continuation_long"
  | "trend_continuation_short"
  // SPX/NDX Specific
  | "gamma_squeeze_bullish"
  | "gamma_squeeze_bearish"
  | "power_hour_reversal_bullish"
  | "power_hour_reversal_bearish"
  | "index_mean_reversion_long"
  | "index_mean_reversion_short"
  | "opening_drive_bullish"
  | "opening_drive_bearish"
  | "gamma_flip_bullish"
  | "gamma_flip_bearish"
  | "eod_pin_setup"
  // KCU LTP Strategies
  | "kcu_ema_bounce"
  | "kcu_vwap_standard"
  | "kcu_vwap_advanced"
  | "kcu_king_queen"
  | "kcu_orb_breakout"
  | "kcu_cloud_bounce"
  // Flow-Primary (Phase 3)
  | "sweep_momentum_long"
  | "sweep_momentum_short";

/**
 * Asset class classification
 */
export type AssetClass = "INDEX" | "EQUITY_ETF" | "STOCK";

/**
 * Score factor for weighted confluence calculation
 */
export interface ScoreFactor {
  name: string;
  weight: number; // 0-1, all factors should sum to 1.0
  evaluate: (features: SymbolFeatures, optionsData?: OptionsChainData) => number; // Returns 0-100
}

/**
 * Result of detection with weighted scores
 */
export interface DetectionResult {
  detected: boolean;
  baseScore: number; // 0-100 composite score
  factorScores: Record<string, number>; // Individual factor scores
  confidence: number; // 0-100, can be same as baseScore or adjusted
}

/**
 * Core Opportunity Detector Interface
 * Each detector implements this to identify and score trade opportunities
 */
export interface OpportunityDetector {
  // Metadata
  type: OpportunityType;
  direction: OpportunityDirection;
  assetClass: AssetClass[]; // Which asset classes this detector applies to
  requiresOptionsData: boolean; // Whether this detector needs options chain data
  idealTimeframe?: "1m" | "5m" | "15m" | "60m" | "1D"; // The timeframe this strategy is designed for

  // Detection logic
  detect: (features: SymbolFeatures, optionsData?: OptionsChainData) => boolean;

  // Scoring factors (must sum to 1.0 in weights)
  scoreFactors: ScoreFactor[];

  // Full detection with scoring
  detectWithScore: (features: SymbolFeatures, optionsData?: OptionsChainData) => DetectionResult;
}

/**
 * Calculate composite score from weighted factors
 *
 * @param factors - Array of score factors
 * @param features - Symbol features
 * @param optionsData - Optional options chain data
 * @returns Composite score (0-100)
 */
export function calculateCompositeScore(
  factors: ScoreFactor[],
  features: SymbolFeatures,
  optionsData?: OptionsChainData
): { score: number; factorScores: Record<string, number> } {
  let weightedSum = 0;
  let totalWeight = 0;
  const factorScores: Record<string, number> = {};

  for (const factor of factors) {
    // Calculate factor score (0-100)
    const factorScore = factor.evaluate(features, optionsData);

    // Clamp to 0-100
    const clampedScore = Math.min(100, Math.max(0, factorScore));
    factorScores[factor.name] = clampedScore;

    // Apply weight
    weightedSum += clampedScore * factor.weight;
    totalWeight += factor.weight;
  }

  // Normalize to 0-100
  const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    score: Math.min(100, Math.max(0, baseScore)),
    factorScores,
  };
}

/**
 * Helper to create a detector with default detectWithScore implementation
 */
export function createDetector(config: {
  type: OpportunityType;
  direction: OpportunityDirection;
  assetClass: AssetClass[];
  requiresOptionsData: boolean;
  idealTimeframe?: "1m" | "5m" | "15m" | "60m" | "1D";
  detect: (features: SymbolFeatures, optionsData?: OptionsChainData) => boolean;
  scoreFactors: ScoreFactor[];
}): OpportunityDetector {
  return {
    ...config,
    detectWithScore: (
      features: SymbolFeatures,
      optionsData?: OptionsChainData
    ): DetectionResult => {
      const detected = config.detect(features, optionsData);

      if (!detected) {
        return {
          detected: false,
          baseScore: 0,
          factorScores: {},
          confidence: 0,
        };
      }

      const { score, factorScores } = calculateCompositeScore(
        config.scoreFactors,
        features,
        optionsData
      );

      return {
        detected: true,
        baseScore: score,
        factorScores,
        confidence: score,
      };
    },
  };
}

/**
 * Helper: Check if symbol is SPX or NDX
 */
export function isSPXorNDX(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  return upper === "SPX" || upper === "NDX" || upper === "$SPX" || upper === "$NDX";
}

/**
 * Helper: Determine asset class from symbol
 */
export function getAssetClass(symbol: string): AssetClass {
  if (isSPXorNDX(symbol)) {
    return "INDEX";
  }

  const upper = symbol.toUpperCase();
  const etfSymbols = ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "XLV", "XLI", "XLP"];

  if (etfSymbols.includes(upper)) {
    return "EQUITY_ETF";
  }

  return "STOCK";
}

/**
 * Helper: Get expected frequency for an opportunity type
 */
export function getExpectedFrequency(type: OpportunityType): string {
  const frequencies: Record<OpportunityType, string> = {
    // Universal Equity
    breakout_bullish: "2-4 signals/day",
    breakout_bearish: "2-4 signals/day",
    mean_reversion_long: "3-5 signals/day",
    mean_reversion_short: "3-5 signals/day",
    trend_continuation_long: "1-3 signals/day",
    trend_continuation_short: "1-3 signals/day",

    // SPX/NDX Specific
    gamma_squeeze_bullish: "2-4 signals/day on 0DTE",
    gamma_squeeze_bearish: "2-4 signals/day on 0DTE",
    power_hour_reversal_bullish: "1-2 signals/day",
    power_hour_reversal_bearish: "1-2 signals/day",
    index_mean_reversion_long: "3-5 signals/day",
    index_mean_reversion_short: "3-5 signals/day",
    opening_drive_bullish: "1-2 signals/day",
    opening_drive_bearish: "1-2 signals/day",
    gamma_flip_bullish: "0-1 signals/day",
    gamma_flip_bearish: "0-1 signals/day",
    eod_pin_setup: "0-1 signals/day on 0DTE",

    // KCU LTP Strategies
    kcu_ema_bounce: "3-5 signals/day",
    kcu_vwap_standard: "2-4 signals/day",
    kcu_vwap_advanced: "1-2 signals/day",
    kcu_king_queen: "2-3 signals/day",
    kcu_orb_breakout: "1-2 signals/day",
    kcu_cloud_bounce: "1-3 signals/day (afternoon)",

    // Flow-Primary (Phase 3)
    sweep_momentum_long: "2-5 signals/day (when flow active)",
    sweep_momentum_short: "2-5 signals/day (when flow active)",
  };

  return frequencies[type] || "Unknown";
}
