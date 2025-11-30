/**
 * Composite Scanner
 * Phase 5: Main Scanner Engine
 * Phase 6: Parameter Application (Optimized Boosts)
 * Phase 1 Enhancement: Adaptive Thresholds, IV Gating, Confidence Scoring
 *
 * Orchestrates opportunity detection, scoring, and signal generation
 * Now supports optimized parameters from genetic algorithm (Phase 5)
 * Now supports adaptive thresholds, IV gating, and confidence scoring (Phase 1 Enhancement)
 */

import type { SymbolFeatures } from "../strategy/engine.js";
import type { OptionsChainData } from "./OpportunityDetector.js";
import type { OpportunityDetector, AssetClass } from "./OpportunityDetector.js";
import { getAssetClass } from "./OpportunityDetector.js";
import type {
  CompositeSignal,
  RiskRewardCalculation,
  StyleScoringResult,
  DetectedOpportunity,
} from "./CompositeSignal.js";
import { generateBarTimeKey } from "./CompositeSignal.js";
import type { ScannerConfig, SignalThresholds } from "./ScannerConfig.js";
import {
  DEFAULT_SCANNER_CONFIG,
  getThresholdsForSignal,
  passesUniversalFilters,
} from "./ScannerConfig.js";
import { SignalDeduplication, checkDeduplication } from "./SignalDeduplication.js";
import { ALL_DETECTORS } from "./detectors/index.js";
import type { ParameterConfig } from "../../types/optimizedParameters.js";

// Phase 1 Enhancement: Import adaptive thresholds, IV gating, and confidence scoring
import {
  getAdaptiveThresholds,
  getWeekendThresholds,
  passesAdaptiveThresholds,
  type AdaptiveThresholdResult,
  type VIXLevel,
  type MarketRegime,
} from "./AdaptiveThresholds.js";
import {
  extractDataAvailability,
  calculateDataConfidence,
  applyConfidenceToScore,
  shouldFilterLowConfidence,
  calculateWeekendConfidence,
  type ConfidenceResult,
} from "./ConfidenceScoring.js";
// Phase 2.1: Import Style Score Modifiers
import {
  extractStyleFactors,
  calculateStyleModifiers,
  applyStyleModifiersToScore,
  type StyleModifierResult,
} from "./StyleScoreModifiers.js";
import {
  analyzeIVForGating,
  shouldGateOnIV,
  getIVScoreModifier,
  type IVAnalysis,
} from "../greeks/IVGating.js";

// Phase 2: Import Context Engines
import {
  contextEngines,
  type IVContext,
  type GammaContext,
  type MTFContext,
  type FlowContext,
  type RegimeContext,
} from "../engines/index.js";

// Import trading style profiles (to be created in Phase 4)
// For now, we'll use placeholder types
interface TradingStyleProfile {
  name: string;
  primaryTimeframe: string;
  risk: {
    stopLossATRMultiplier: number;
    targetATRMultiplier: [number, number, number];
    minRiskReward: number;
  };
  scoreModifiers: {
    opportunityType: Record<string, number>;
    timeOfDay: (minutesSinceOpen: number) => number;
    volatility: (atr: number, vixLevel: string) => number;
  };
}

// Placeholder profiles (will be replaced with actual profiles in Phase 4)
const SCALP_PROFILE: TradingStyleProfile = {
  name: "scalp",
  primaryTimeframe: "5m",
  risk: {
    stopLossATRMultiplier: 0.75,
    targetATRMultiplier: [1.0, 1.5, 2.0],
    minRiskReward: 1.5,
  },
  scoreModifiers: {
    opportunityType: {},
    timeOfDay: () => 1.0,
    volatility: () => 1.0,
  },
};

const DAY_TRADE_PROFILE: TradingStyleProfile = {
  name: "day_trade",
  primaryTimeframe: "15m",
  risk: {
    stopLossATRMultiplier: 1.0,
    targetATRMultiplier: [1.5, 2.5, 3.5],
    minRiskReward: 1.8,
  },
  scoreModifiers: {
    opportunityType: {},
    timeOfDay: () => 1.0,
    volatility: () => 1.0,
  },
};

const SWING_PROFILE: TradingStyleProfile = {
  name: "swing",
  primaryTimeframe: "60m",
  risk: {
    stopLossATRMultiplier: 1.5,
    targetATRMultiplier: [2.0, 3.0, 4.0],
    minRiskReward: 2.0,
  },
  scoreModifiers: {
    opportunityType: {},
    timeOfDay: () => 1.0,
    volatility: () => 1.0,
  },
};

/**
 * Scanner result
 */
export interface ScanResult {
  signal?: CompositeSignal;
  filtered: boolean;
  filterReason?: string;
  detectionCount: number;
  scanTimeMs: number;
  // Phase 1 Enhancement: Additional diagnostic data
  phase1Data?: {
    adaptiveThresholds?: AdaptiveThresholdResult;
    ivAnalysis?: IVAnalysis;
    confidence?: ConfidenceResult;
    ivGateResult?: { gate: boolean; reason?: string };
    confidenceFilterResult?: { filter: boolean; reason?: string };
  };
}

/**
 * Composite Scanner Options
 */
export interface CompositeScannerOptions {
  owner: string; // User ID
  config?: Partial<ScannerConfig>;
  optionsDataProvider?: (symbol: string) => Promise<OptionsChainData | null>;
  optimizedParams?: ParameterConfig; // Phase 6: Optimized parameters from genetic algorithm
  // Phase 1 Enhancement: Enable/disable features
  phase1Options?: {
    enableAdaptiveThresholds?: boolean; // Default: true
    enableIVGating?: boolean; // Default: true
    enableConfidenceScoring?: boolean; // Default: true
    minConfidenceThreshold?: number; // Default: 40
    earningsWindowDays?: number; // Default: 7 (days before earnings to check)
  };
}

/**
 * Main Composite Scanner Engine
 */
export class CompositeScanner {
  private config: ScannerConfig;
  private deduplication: SignalDeduplication;
  private owner: string;
  private detectors: OpportunityDetector[];
  private optionsDataProvider?: (symbol: string) => Promise<OptionsChainData | null>;
  private optimizedParams?: ParameterConfig; // Phase 6: Optimized parameters
  // Phase 1 Enhancement: Configuration
  private phase1Options: Required<NonNullable<CompositeScannerOptions["phase1Options"]>>;

  constructor(options: CompositeScannerOptions) {
    this.owner = options.owner;
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...options.config };
    this.deduplication = new SignalDeduplication();
    this.detectors = ALL_DETECTORS;
    this.optionsDataProvider = options.optionsDataProvider;
    this.optimizedParams = options.optimizedParams; // Phase 6: Store optimized params
    // Phase 1 Enhancement: Initialize with defaults
    this.phase1Options = {
      enableAdaptiveThresholds: options.phase1Options?.enableAdaptiveThresholds ?? true,
      enableIVGating: options.phase1Options?.enableIVGating ?? true,
      enableConfidenceScoring: options.phase1Options?.enableConfidenceScoring ?? true,
      minConfidenceThreshold: options.phase1Options?.minConfidenceThreshold ?? 40,
      earningsWindowDays: options.phase1Options?.earningsWindowDays ?? 7,
    };
  }

  /**
   * Scan a single symbol for opportunities
   *
   * @param symbol - Symbol to scan
   * @param features - Symbol features
   * @returns Scan result with optional signal
   */
  async scanSymbol(symbol: string, features: SymbolFeatures): Promise<ScanResult> {
    const startTime = Date.now();

    // Phase 1 Enhancement: Initialize tracking data
    const phase1Data: ScanResult["phase1Data"] = {};

    // Step 1: Universal pre-filtering
    if (!passesUniversalFilters(symbol, features, this.config.filters)) {
      return {
        filtered: true,
        filterReason: "Failed universal filters",
        detectionCount: 0,
        scanTimeMs: Date.now() - startTime,
      };
    }

    // Phase 1 Enhancement - Step 1.5: Calculate data confidence
    let confidence: ConfidenceResult | undefined;
    if (this.phase1Options.enableConfidenceScoring) {
      const isWeekend = features.session?.isRegularHours !== true;
      if (isWeekend) {
        confidence = calculateWeekendConfidence(features);
      } else {
        const availability = extractDataAvailability(features);
        confidence = calculateDataConfidence(availability);
      }
      phase1Data.confidence = confidence;

      // Filter on low confidence
      const confidenceFilter = shouldFilterLowConfidence(
        confidence,
        this.phase1Options.minConfidenceThreshold
      );
      phase1Data.confidenceFilterResult = confidenceFilter;

      if (confidenceFilter.filter) {
        return {
          filtered: true,
          filterReason: `Low data confidence: ${confidenceFilter.reason}`,
          detectionCount: 0,
          scanTimeMs: Date.now() - startTime,
          phase1Data,
        };
      }
    }

    // Step 2: Fetch options data if needed
    const assetClass = getAssetClass(symbol);
    let optionsData: OptionsChainData | null = null;

    if (assetClass === "INDEX" && this.config.enableOptionsDataFetch && this.optionsDataProvider) {
      try {
        optionsData = await this.optionsDataProvider(symbol);
      } catch (error) {
        console.warn(`[CompositeScanner] Failed to fetch options data for ${symbol}:`, error);
      }
    }

    // Step 3: Run opportunity detection
    const detectedOpportunities = this.detectOpportunities(symbol, features, optionsData);

    if (detectedOpportunities.length === 0) {
      return {
        filtered: true,
        filterReason: "No opportunities detected",
        detectionCount: 0,
        scanTimeMs: Date.now() - startTime,
        phase1Data,
      };
    }

    // Step 4: Score and rank opportunities
    const scoredOpportunities = this.scoreOpportunities(
      detectedOpportunities,
      features,
      optionsData
    );

    // Step 4.5: Apply context engine boosts (Phase 2)
    const contextEnhancedOpportunities = await this.applyContextBoosts(
      scoredOpportunities,
      symbol,
      features
    );

    // Phase 1 Enhancement - Step 4.6: Apply confidence adjustments to scores
    if (this.phase1Options.enableConfidenceScoring && confidence) {
      for (const opp of contextEnhancedOpportunities) {
        // Apply confidence modifier to all style scores
        const baseResult = applyConfidenceToScore(opp.baseScore, confidence);
        const scalpResult = applyConfidenceToScore(opp.styleScores.scalpScore, confidence);
        const dayResult = applyConfidenceToScore(opp.styleScores.dayTradeScore, confidence);
        const swingResult = applyConfidenceToScore(opp.styleScores.swingScore, confidence);

        opp.baseScore = baseResult.adjustedScore;
        opp.styleScores.scalpScore = scalpResult.adjustedScore;
        opp.styleScores.dayTradeScore = dayResult.adjustedScore;
        opp.styleScores.swingScore = swingResult.adjustedScore;

        // Recalculate recommended style
        const scores = {
          scalp: opp.styleScores.scalpScore,
          day_trade: opp.styleScores.dayTradeScore,
          swing: opp.styleScores.swingScore,
        };
        const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        opp.styleScores.recommendedStyle = entries[0][0] as "scalp" | "day_trade" | "swing";
        opp.styleScores.recommendedStyleScore = entries[0][1];
      }
    }

    // Pick best opportunity (after context boosts and confidence adjustments)
    const bestOpportunity = contextEnhancedOpportunities.sort(
      (a, b) => b.styleScores.recommendedStyleScore - a.styleScores.recommendedStyleScore
    )[0];

    // Phase 1 Enhancement - Step 4.7: Calculate adaptive thresholds
    let adaptiveThresholds: AdaptiveThresholdResult | undefined;
    if (this.phase1Options.enableAdaptiveThresholds) {
      const isWeekend = features.session?.isRegularHours !== true;
      if (isWeekend) {
        // For weekends, create a full AdaptiveThresholdResult with relaxed settings
        const weekendBasic = getWeekendThresholds();
        adaptiveThresholds = {
          minBase: weekendBasic.minBase,
          minStyle: weekendBasic.minStyle,
          minRR: weekendBasic.minRR,
          sizeMultiplier: weekendBasic.sizeMultiplier,
          timeWindow: "weekend",
          timeWindowLabel: "Weekend Planning",
          vixLevel: "medium",
          regime: "ranging",
          strategyCategory: "all",
          strategyEnabled: true,
          strategyNotes: "Weekend analysis - for planning only, no live trading",
          warnings: ["Weekend signals are for planning only"],
          breakdown: {
            baseFromTime: weekendBasic.minBase,
            baseFromVIX: 0,
            baseFromRegime: 0,
            styleFromTime: weekendBasic.minStyle,
            styleFromVIX: 0,
            rrFromTime: weekendBasic.minRR,
            rrFromVIX: 0,
            rrFromRegime: 0,
            sizeFromTime: weekendBasic.sizeMultiplier,
            sizeFromVIX: 0,
          },
        };
      } else {
        // Extract VIX level and market regime from features
        const pattern = features.pattern as any;
        const vixLevel = (pattern?.vix_level || "medium") as VIXLevel;
        const regime = (pattern?.market_regime || "trending") as MarketRegime;
        const timeISO = features.time || new Date().toISOString();

        adaptiveThresholds = getAdaptiveThresholds(
          timeISO,
          vixLevel,
          regime,
          bestOpportunity.detector.type
        );
      }
      phase1Data.adaptiveThresholds = adaptiveThresholds;
    }

    // Phase 1 Enhancement - Step 4.8: IV Gating check
    let ivAnalysis: IVAnalysis | undefined;
    let ivGateResult: { gate: boolean; reason?: string } | undefined;
    if (this.phase1Options.enableIVGating) {
      // Analyze IV for this symbol
      // Note: daysToEarnings would come from an earnings calendar API in production
      // For now, we'll pass undefined (no earnings warning)
      ivAnalysis = analyzeIVForGating(symbol);
      phase1Data.ivAnalysis = ivAnalysis;

      // Determine if this is a debit (buying) or credit (selling) strategy
      // Breakout, momentum, and most directional plays are debit strategies
      const isDebitStrategy = [
        "breakout",
        "momentum",
        "trend",
        "continuation",
        "reversal",
        "gamma",
      ].some((type) => bestOpportunity.detector.type.toLowerCase().includes(type));

      ivGateResult = shouldGateOnIV(ivAnalysis, isDebitStrategy);
      phase1Data.ivGateResult = ivGateResult;

      // Apply IV score modifier to base score
      const ivModifier = getIVScoreModifier(ivAnalysis);
      bestOpportunity.baseScore *= ivModifier;

      // Gate signal if IV conditions are unfavorable
      if (ivGateResult.gate && ivAnalysis.gatingDecision !== "INSUFFICIENT_DATA") {
        return {
          filtered: true,
          filterReason: `IV Gating: ${ivGateResult.reason}`,
          detectionCount: detectedOpportunities.length,
          scanTimeMs: Date.now() - startTime,
          phase1Data,
        };
      }
    }

    // Step 5: Calculate risk/reward
    const profile = this.getProfileForStyle(bestOpportunity.styleScores.recommendedStyle);
    const riskReward = this.calculateRiskReward(bestOpportunity.detector, features, profile);

    // Step 6: Check thresholds
    const thresholds = getThresholdsForSignal(
      this.config,
      assetClass,
      bestOpportunity.detector.type
    );

    // Build proposed signal
    const proposedSignal = this.buildSignal(
      symbol,
      features,
      bestOpportunity,
      riskReward,
      assetClass,
      thresholds
    );

    // Step 7: Validate signal (now uses adaptive thresholds if enabled)
    const validation = this.validateSignalWithPhase1(
      proposedSignal,
      thresholds,
      features,
      adaptiveThresholds
    );

    if (!validation.pass) {
      return {
        filtered: true,
        filterReason: validation.reason,
        detectionCount: detectedOpportunities.length,
        scanTimeMs: Date.now() - startTime,
        phase1Data,
      };
    }

    // Step 8: Deduplication check
    const dedupCheck = checkDeduplication(proposedSignal, thresholds, this.deduplication);

    if (!dedupCheck.pass) {
      return {
        filtered: true,
        filterReason: dedupCheck.reason,
        detectionCount: detectedOpportunities.length,
        scanTimeMs: Date.now() - startTime,
        phase1Data,
      };
    }

    // Signal passed all checks!
    this.deduplication.addSignal(proposedSignal);

    // Phase 1 Enhancement: Add adaptive warnings to signal
    if (adaptiveThresholds && adaptiveThresholds.warnings.length > 0) {
      // Store warnings in confluence for UI display
      (proposedSignal as any).adaptiveWarnings = adaptiveThresholds.warnings;
    }

    return {
      signal: proposedSignal,
      filtered: false,
      detectionCount: detectedOpportunities.length,
      scanTimeMs: Date.now() - startTime,
      phase1Data,
    };
  }

  /**
   * Detect opportunities for a symbol
   *
   * @param symbol - Symbol
   * @param features - Symbol features
   * @param optionsData - Options data (if available)
   * @returns Detected opportunities
   */
  private detectOpportunities(
    symbol: string,
    features: SymbolFeatures,
    optionsData: OptionsChainData | null
  ): OpportunityDetector[] {
    const detected: OpportunityDetector[] = [];
    const assetClass = getAssetClass(symbol);

    for (const detector of this.detectors) {
      // Check if detector applies to this asset class
      if (!detector.assetClass.includes(assetClass)) {
        continue;
      }

      // Check if detector requires options data
      if (detector.requiresOptionsData && !optionsData) {
        continue;
      }

      // Run detection
      try {
        if (detector.detect(features, optionsData || undefined)) {
          detected.push(detector);
        }
      } catch (error) {
        console.error(`[CompositeScanner] Error in detector ${detector.type}:`, error);
      }
    }

    return detected;
  }

  /**
   * Score detected opportunities
   *
   * @param detectors - Detected opportunity detectors
   * @param features - Symbol features
   * @param optionsData - Options data (if available)
   * @returns Scored opportunities
   */
  private scoreOpportunities(
    detectors: OpportunityDetector[],
    features: SymbolFeatures,
    optionsData: OptionsChainData | null
  ): DetectedOpportunity[] {
    return detectors.map((detector) => {
      // Get base score with confluence breakdown
      const detectionResult = detector.detectWithScore(features, optionsData || undefined);

      // Apply style modifiers
      const styleScores = this.applyStyleModifiers(
        detectionResult.baseScore,
        detector.type,
        features
      );

      return {
        detector,
        baseScore: detectionResult.baseScore,
        styleScores,
        confluence: detectionResult.factorScores,
      };
    });
  }

  /**
   * Apply context engine boosts to scored opportunities (Phase 2)
   *
   * Queries historical data warehouse and applies boosts/penalties based on:
   * - IV Percentile (entry timing)
   * - Gamma Exposure (pinning vs breakout)
   * - MTF Alignment (trend confirmation)
   * - Flow Analysis (smart money bias)
   * - Market Regime (overall market context)
   *
   * @param opportunities - Scored opportunities
   * @param symbol - Symbol being scanned
   * @param features - Symbol features
   * @returns Context-enhanced opportunities
   */
  private async applyContextBoosts(
    opportunities: DetectedOpportunity[],
    symbol: string,
    features: SymbolFeatures
  ): Promise<DetectedOpportunity[]> {
    try {
      // Fetch all context data in parallel for performance
      const [ivContext, gammaContext, mtfContext, flowContext, regimeContext] = await Promise.all([
        contextEngines.ivPercentile.getIVContext(symbol).catch(() => null),
        contextEngines.gammaExposure.getGammaContext(symbol).catch(() => null),
        contextEngines.mtfAlignment.getMTFContext(symbol).catch(() => null),
        contextEngines.flowAnalysis.getFlowContext(symbol, "medium").catch(() => null),
        contextEngines.regimeDetection.getRegimeContext().catch(() => null),
      ]);

      // Apply boosts to each opportunity
      return opportunities.map((opp) => {
        const direction = opp.detector.direction;
        const recommendedStyle = opp.styleScores.recommendedStyle.toUpperCase() as
          | "SCALP"
          | "DAY"
          | "SWING";

        // Start with current scores
        let scalpScore = opp.styleScores.scalpScore;
        let dayTradeScore = opp.styleScores.dayTradeScore;
        let swingScore = opp.styleScores.swingScore;

        // Phase 6: Apply optimized boosts (if optimizedParams provided)
        if (this.optimizedParams) {
          // Simplified boost application since context engines are disabled
          // When engines are re-enabled, these boosts will be more sophisticated

          // For now, apply flat boosts based on simplified conditions
          // In production: These would be applied based on actual context data

          // Example: Apply IV boost if we detect low/high IV conditions
          // (Placeholder until engines are re-enabled)
          const ivPercentile = (features as any).ivPercentile || 50; // Default to median
          if (ivPercentile < 20) {
            // Low IV - favorable for entries
            scalpScore *= 1 + this.optimizedParams.ivBoosts.lowIV;
            dayTradeScore *= 1 + this.optimizedParams.ivBoosts.lowIV;
            swingScore *= 1 + this.optimizedParams.ivBoosts.lowIV;
          } else if (ivPercentile > 80) {
            // High IV - less favorable
            scalpScore *= 1 + this.optimizedParams.ivBoosts.highIV; // highIV is negative
            dayTradeScore *= 1 + this.optimizedParams.ivBoosts.highIV;
            swingScore *= 1 + this.optimizedParams.ivBoosts.highIV;
          }

          // Apply gamma boost placeholder
          const gammaExposure = (features as any).gammaExposure || 0;
          if (gammaExposure < -1) {
            // Short gamma - volatile conditions
            scalpScore *= 1 + this.optimizedParams.gammaBoosts.shortGamma;
            dayTradeScore *= 1 + this.optimizedParams.gammaBoosts.shortGamma;
            swingScore *= 1 + this.optimizedParams.gammaBoosts.shortGamma;
          } else if (gammaExposure > 1) {
            // Long gamma - pinning risk
            scalpScore *= 1 + this.optimizedParams.gammaBoosts.longGamma; // longGamma is negative
            dayTradeScore *= 1 + this.optimizedParams.gammaBoosts.longGamma;
            swingScore *= 1 + this.optimizedParams.gammaBoosts.longGamma;
          }

          // Apply flow boost placeholder
          const flowAlignment = (features as any).flowAlignment || "neutral";
          if (flowAlignment === "aligned") {
            scalpScore *= 1 + this.optimizedParams.flowBoosts.aligned;
            dayTradeScore *= 1 + this.optimizedParams.flowBoosts.aligned;
            swingScore *= 1 + this.optimizedParams.flowBoosts.aligned;
          } else if (flowAlignment === "opposed") {
            scalpScore *= 1 + this.optimizedParams.flowBoosts.opposed; // opposed is negative
            dayTradeScore *= 1 + this.optimizedParams.flowBoosts.opposed;
            swingScore *= 1 + this.optimizedParams.flowBoosts.opposed;
          }
        }

        // Recalculate recommended style after boosts
        const scores = {
          scalp: scalpScore,
          day_trade: dayTradeScore,
          swing: swingScore,
        };

        const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const newRecommended = entries[0];

        // Update scores
        const enhancedStyleScores: StyleScoringResult = {
          scalpScore,
          dayTradeScore,
          swingScore,
          recommendedStyle: newRecommended[0] as "scalp" | "day_trade" | "swing",
          recommendedStyleScore: newRecommended[1],
        };

        // Store context metadata on the opportunity (for UI display)
        return {
          ...opp,
          styleScores: enhancedStyleScores,
          contextData: {
            ivContext,
            gammaContext,
            mtfContext,
            flowContext,
            regimeContext,
          },
        };
      });
    } catch (error) {
      console.error(`[CompositeScanner] Error applying context boosts:`, error);
      // Return original opportunities on error
      return opportunities;
    }
  }

  /**
   * Apply trading style modifiers to base score
   * Phase 2.1 Enhancement: Uses context-aware style modifiers
   *
   * @param baseScore - Base composite score
   * @param opportunityType - Opportunity type
   * @param features - Symbol features
   * @returns Style-specific scores
   */
  private applyStyleModifiers(
    baseScore: number,
    opportunityType: string,
    features: SymbolFeatures
  ): StyleScoringResult {
    // Phase 2.1: Use new context-aware style modifiers
    const factors = extractStyleFactors(features);
    const modifierResult = calculateStyleModifiers(factors);
    const scores = applyStyleModifiersToScore(baseScore, modifierResult.modifiers);

    // Store the modifier result for diagnostics (can be accessed via contextData)
    (features as any).__styleModifierResult = modifierResult;

    return {
      scalpScore: scores.scalpScore,
      dayTradeScore: scores.dayTradeScore,
      swingScore: scores.swingScore,
      recommendedStyle: scores.recommendedStyle,
      recommendedStyleScore: scores.recommendedStyleScore,
    };
  }

  /**
   * Calculate risk/reward for a detector
   *
   * @param detector - Opportunity detector
   * @param features - Symbol features
   * @param profile - Trading style profile
   * @returns Risk/reward calculation
   */
  private calculateRiskReward(
    detector: OpportunityDetector,
    features: SymbolFeatures,
    profile: TradingStyleProfile
  ): RiskRewardCalculation {
    const entry = features.price?.current || 0;
    const mtfPrimary = features.mtf?.[profile.primaryTimeframe] as any;
    const mtf5m = features.mtf?.["5m"] as any;
    const atr = mtfPrimary?.atr || mtf5m?.atr || 2.0;

    // Calculate stop based on direction and style
    const stopDistance = atr * profile.risk.stopLossATRMultiplier;
    const stop = detector.direction === "LONG" ? entry - stopDistance : entry + stopDistance;

    // Calculate targets
    const targets = {
      T1:
        detector.direction === "LONG"
          ? entry + atr * profile.risk.targetATRMultiplier[0]
          : entry - atr * profile.risk.targetATRMultiplier[0],
      T2:
        detector.direction === "LONG"
          ? entry + atr * profile.risk.targetATRMultiplier[1]
          : entry - atr * profile.risk.targetATRMultiplier[1],
      T3:
        detector.direction === "LONG"
          ? entry + atr * profile.risk.targetATRMultiplier[2]
          : entry - atr * profile.risk.targetATRMultiplier[2],
    };

    const riskAmount = Math.abs(entry - stop);
    const rewardPotential = Math.abs(targets.T2 - entry); // Use T2 as primary target
    const riskRewardRatio = rewardPotential / riskAmount;

    return {
      entry,
      stop,
      targets,
      riskAmount,
      rewardPotential,
      riskRewardRatio,
    };
  }

  /**
   * Build complete signal object
   *
   * @param symbol - Symbol
   * @param features - Symbol features
   * @param opportunity - Detected opportunity
   * @param riskReward - Risk/reward calculation
   * @param assetClass - Asset class
   * @param thresholds - Signal thresholds
   * @returns Complete signal
   */
  private buildSignal(
    symbol: string,
    features: SymbolFeatures,
    opportunity: DetectedOpportunity,
    riskReward: RiskRewardCalculation,
    assetClass: AssetClass,
    thresholds: SignalThresholds
  ): CompositeSignal {
    const timestamp = Date.now();

    return {
      createdAt: new Date(),
      owner: this.owner,
      symbol,
      opportunityType: opportunity.detector.type,
      direction: opportunity.detector.direction,
      assetClass,
      baseScore: opportunity.baseScore,
      scalpScore: opportunity.styleScores.scalpScore,
      dayTradeScore: opportunity.styleScores.dayTradeScore,
      swingScore: opportunity.styleScores.swingScore,
      recommendedStyle: opportunity.styleScores.recommendedStyle,
      recommendedStyleScore: opportunity.styleScores.recommendedStyleScore,
      confluence: opportunity.confluence,
      entryPrice: riskReward.entry,
      stopPrice: riskReward.stop,
      targets: riskReward.targets,
      riskReward: riskReward.riskRewardRatio,
      features,
      status: "ACTIVE",
      expiresAt: new Date(timestamp + 5 * 60 * 1000), // 5 minutes
      barTimeKey: generateBarTimeKey(symbol, timestamp, opportunity.detector.type),
      detectorVersion: this.config.detectorVersion,
      timestamp,
    };
  }

  /**
   * Validate signal meets all thresholds
   *
   * @param signal - Signal to validate
   * @param thresholds - Thresholds to check
   * @param features - Symbol features (for weekend detection)
   * @returns Validation result
   */
  private validateSignal(
    signal: CompositeSignal,
    thresholds: SignalThresholds,
    features: SymbolFeatures
  ): { pass: boolean; reason?: string } {
    // Detect weekend/evening mode
    const isWeekend = features.session?.isRegularHours !== true;

    // Use weekend overrides if available and applicable
    const effectiveMinBaseScore =
      isWeekend && thresholds.weekendMinBaseScore !== undefined
        ? thresholds.weekendMinBaseScore
        : thresholds.minBaseScore;

    let effectiveMinStyleScore =
      isWeekend && thresholds.weekendMinStyleScore !== undefined
        ? thresholds.weekendMinStyleScore
        : thresholds.minStyleScore;

    // Phase 6: Apply optimized min scores (if optimizedParams provided)
    if (this.optimizedParams) {
      // Override style score thresholds with optimized values
      const style = signal.recommendedStyle;
      if (style === "scalp") {
        effectiveMinStyleScore = this.optimizedParams.minScores.scalp;
      } else if (style === "day_trade") {
        effectiveMinStyleScore = this.optimizedParams.minScores.day;
      } else if (style === "swing") {
        effectiveMinStyleScore = this.optimizedParams.minScores.swing;
      }
    }

    // Base score threshold
    if (signal.baseScore < effectiveMinBaseScore) {
      return {
        pass: false,
        reason: `Base score ${signal.baseScore.toFixed(1)} < ${effectiveMinBaseScore}${isWeekend ? " (weekend)" : ""}${this.optimizedParams ? " (optimized)" : ""}`,
      };
    }

    // Style score threshold
    if (signal.recommendedStyleScore < effectiveMinStyleScore) {
      return {
        pass: false,
        reason: `Style score ${signal.recommendedStyleScore.toFixed(1)} < ${effectiveMinStyleScore}${isWeekend ? " (weekend)" : ""}${this.optimizedParams ? " (optimized)" : ""}`,
      };
    }

    // Risk/reward threshold
    if (signal.riskReward < thresholds.minRiskReward) {
      return {
        pass: false,
        reason: `Risk/reward ${signal.riskReward.toFixed(1)} < ${thresholds.minRiskReward}`,
      };
    }

    return { pass: true };
  }

  /**
   * Phase 1 Enhancement: Validate signal with adaptive thresholds
   *
   * @param signal - Signal to validate
   * @param thresholds - Base thresholds to check
   * @param features - Symbol features
   * @param adaptiveThresholds - Adaptive thresholds (optional)
   * @returns Validation result
   */
  private validateSignalWithPhase1(
    signal: CompositeSignal,
    thresholds: SignalThresholds,
    features: SymbolFeatures,
    adaptiveThresholds?: AdaptiveThresholdResult
  ): { pass: boolean; reason?: string } {
    // If adaptive thresholds are available and strategy is disabled, reject immediately
    if (adaptiveThresholds && !adaptiveThresholds.strategyEnabled) {
      return {
        pass: false,
        reason: `Strategy ${signal.opportunityType} not recommended for current conditions (${adaptiveThresholds.warnings.join(", ")})`,
      };
    }

    // Use adaptive thresholds if available
    if (adaptiveThresholds) {
      // Build signal object for passesAdaptiveThresholds
      const signalForAdaptive = {
        baseScore: signal.baseScore,
        recommendedStyleScore: signal.recommendedStyleScore,
        riskReward: signal.riskReward,
      };

      const adaptiveResult = passesAdaptiveThresholds(signalForAdaptive, adaptiveThresholds);
      if (!adaptiveResult.pass) {
        return {
          pass: false,
          reason: adaptiveResult.reason,
        };
      }

      // Also check risk/reward against adaptive threshold
      const minRR = adaptiveThresholds.minRR ?? thresholds.minRiskReward;
      if (signal.riskReward < minRR) {
        return {
          pass: false,
          reason: `Risk/reward ${signal.riskReward.toFixed(1)} < ${minRR} (adaptive)`,
        };
      }

      return { pass: true };
    }

    // Fall back to standard validation if no adaptive thresholds
    return this.validateSignal(signal, thresholds, features);
  }

  /**
   * Get trading style profile by name
   *
   * @param style - Style name
   * @returns Trading style profile
   */
  private getProfileForStyle(style: string): TradingStyleProfile {
    switch (style) {
      case "scalp":
        return SCALP_PROFILE;
      case "day_trade":
        return DAY_TRADE_PROFILE;
      case "swing":
        return SWING_PROFILE;
      default:
        return DAY_TRADE_PROFILE;
    }
  }

  /**
   * Get deduplication statistics
   */
  getDeduplicationStats() {
    return this.deduplication.getStats();
  }

  /**
   * Clear deduplication history (for testing)
   */
  clearDeduplication(): void {
    this.deduplication.clear();
  }

  /**
   * Update scanner configuration
   *
   * @param config - New configuration
   */
  updateConfig(config: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
