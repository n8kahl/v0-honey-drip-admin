/**
 * Composite Scanner
 * Phase 5: Main Scanner Engine
 *
 * Orchestrates opportunity detection, scoring, and signal generation
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

// Phase 2: Import Context Engines
// TEMPORARILY DISABLED for production build compatibility
// Context engines need refactoring to not import frontend Supabase client
// TODO: Make engines accept Supabase client as parameter instead of importing at module level
// import { contextEngines } from '../engines/index.js';
import type {
  IVContext,
  GammaContext,
  MTFContext,
  FlowContext,
  RegimeContext,
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
}

/**
 * Composite Scanner Options
 */
export interface CompositeScannerOptions {
  owner: string; // User ID
  config?: Partial<ScannerConfig>;
  optionsDataProvider?: (symbol: string) => Promise<OptionsChainData | null>;
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

  constructor(options: CompositeScannerOptions) {
    this.owner = options.owner;
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...options.config };
    this.deduplication = new SignalDeduplication();
    this.detectors = ALL_DETECTORS;
    this.optionsDataProvider = options.optionsDataProvider;
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

    // Step 1: Universal pre-filtering
    if (!passesUniversalFilters(symbol, features, this.config.filters)) {
      return {
        filtered: true,
        filterReason: "Failed universal filters",
        detectionCount: 0,
        scanTimeMs: Date.now() - startTime,
      };
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

    // Pick best opportunity (after context boosts)
    const bestOpportunity = contextEnhancedOpportunities.sort(
      (a, b) => b.styleScores.recommendedStyleScore - a.styleScores.recommendedStyleScore
    )[0];

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

    // Step 7: Validate signal
    const validation = this.validateSignal(proposedSignal, thresholds, features);

    if (!validation.pass) {
      return {
        filtered: true,
        filterReason: validation.reason,
        detectionCount: detectedOpportunities.length,
        scanTimeMs: Date.now() - startTime,
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
      };
    }

    // Signal passed all checks!
    this.deduplication.addSignal(proposedSignal);

    return {
      signal: proposedSignal,
      filtered: false,
      detectionCount: detectedOpportunities.length,
      scanTimeMs: Date.now() - startTime,
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
      // TEMPORARILY DISABLED - engines have module resolution issues in production
      const [ivContext, gammaContext, mtfContext, flowContext, regimeContext] = [
        null,
        null,
        null,
        null,
        null,
      ];
      // TODO: Re-enable once engines are refactored
      // const [ivContext, gammaContext, mtfContext, flowContext, regimeContext] = await Promise.all([
      //   contextEngines.ivPercentile.getIVContext(symbol).catch(() => null),
      //   contextEngines.gammaExposure.getGammaContext(symbol).catch(() => null),
      //   contextEngines.mtfAlignment.getMTFContext(symbol).catch(() => null),
      //   contextEngines.flowAnalysis.getFlowContext(symbol, 'medium').catch(() => null),
      //   contextEngines.regimeDetection.getRegimeContext().catch(() => null),
      // ]);

      // Apply boosts to each opportunity
      return opportunities.map((opp) => {
        const direction = opp.detector.direction;
        const recommendedStyle = opp.styleScores.recommendedStyle.toUpperCase() as
          | "SCALP"
          | "DAY"
          | "SWING";

        // Start with current scores
        const scalpScore = opp.styleScores.scalpScore;
        const dayTradeScore = opp.styleScores.dayTradeScore;
        const swingScore = opp.styleScores.swingScore;
        const recommendedStyleScore = opp.styleScores.recommendedStyleScore;

        // Apply context engine boosts
        // TEMPORARILY DISABLED - engines have module resolution issues in production
        // Scanner still works without these advanced boosts, just with baseline detector scores
        // TODO: Re-enable once engines are refactored

        // // Apply IV boost (if available)
        // if (ivContext) {
        //   scalpScore = contextEngines.ivPercentile.applyIVBoost(scalpScore, ivContext, direction);
        //   dayTradeScore = contextEngines.ivPercentile.applyIVBoost(dayTradeScore, ivContext, direction);
        //   swingScore = contextEngines.ivPercentile.applyIVBoost(swingScore, ivContext, direction);
        // }

        // // Apply Gamma boost (if available)
        // if (gammaContext) {
        //   const currentPrice = features.price?.current;
        //   scalpScore = contextEngines.gammaExposure.applyGammaBoost(scalpScore, gammaContext, direction, currentPrice);
        //   dayTradeScore = contextEngines.gammaExposure.applyGammaBoost(dayTradeScore, gammaContext, direction, currentPrice);
        //   swingScore = contextEngines.gammaExposure.applyGammaBoost(swingScore, gammaContext, direction, currentPrice);
        // }

        // // Apply MTF boost (if available)
        // if (mtfContext) {
        //   scalpScore = contextEngines.mtfAlignment.applyMTFBoost(scalpScore, mtfContext, direction);
        //   dayTradeScore = contextEngines.mtfAlignment.applyMTFBoost(dayTradeScore, mtfContext, direction);
        //   swingScore = contextEngines.mtfAlignment.applyMTFBoost(swingScore, mtfContext, direction);
        // }

        // // Apply Flow boost (if available)
        // if (flowContext) {
        //   scalpScore = contextEngines.flowAnalysis.applyFlowBoost(scalpScore, flowContext, direction);
        //   dayTradeScore = contextEngines.flowAnalysis.applyFlowBoost(dayTradeScore, flowContext, direction);
        //   swingScore = contextEngines.flowAnalysis.applyFlowBoost(swingScore, flowContext, direction);
        // }

        // // Apply Regime boost (if available)
        // if (regimeContext) {
        //   scalpScore = contextEngines.regimeDetection.applyRegimeBoost(scalpScore, regimeContext, direction, 'SCALP');
        //   dayTradeScore = contextEngines.regimeDetection.applyRegimeBoost(dayTradeScore, regimeContext, direction, 'DAY');
        //   swingScore = contextEngines.regimeDetection.applyRegimeBoost(swingScore, regimeContext, direction, 'SWING');
        // }

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
    const profiles = [SCALP_PROFILE, DAY_TRADE_PROFILE, SWING_PROFILE];
    const scores: Record<string, number> = {};

    for (const profile of profiles) {
      // Start with base score
      let styleScore = baseScore;

      // Apply opportunity type modifier
      const typeModifier = profile.scoreModifiers.opportunityType[opportunityType] || 1.0;
      styleScore *= typeModifier;

      // Apply time of day modifier
      const timeModifier = profile.scoreModifiers.timeOfDay(
        features.session?.minutesSinceOpen || 0
      );
      styleScore *= timeModifier;

      // Apply volatility modifier
      const mtf5m = features.mtf?.["5m"] as any;
      const atr = mtf5m?.atr || 0;
      const vixLevel = (features as any).pattern?.vix_level || "medium";
      const volModifier = profile.scoreModifiers.volatility(atr, vixLevel);
      styleScore *= volModifier;

      // Cap at 100
      scores[profile.name] = Math.min(100, Math.max(0, styleScore));
    }

    // Find recommended style (highest score)
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const recommended = entries[0];

    return {
      scalpScore: scores.scalp || 0,
      dayTradeScore: scores.day_trade || 0,
      swingScore: scores.swing || 0,
      recommendedStyle: recommended[0] as "scalp" | "day_trade" | "swing",
      recommendedStyleScore: recommended[1],
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

    const effectiveMinStyleScore =
      isWeekend && thresholds.weekendMinStyleScore !== undefined
        ? thresholds.weekendMinStyleScore
        : thresholds.minStyleScore;

    // Base score threshold
    if (signal.baseScore < effectiveMinBaseScore) {
      return {
        pass: false,
        reason: `Base score ${signal.baseScore.toFixed(1)} < ${effectiveMinBaseScore}${isWeekend ? " (weekend)" : ""}`,
      };
    }

    // Style score threshold
    if (signal.recommendedStyleScore < effectiveMinStyleScore) {
      return {
        pass: false,
        reason: `Style score ${signal.recommendedStyleScore.toFixed(1)} < ${effectiveMinStyleScore}${isWeekend ? " (weekend)" : ""}`,
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
