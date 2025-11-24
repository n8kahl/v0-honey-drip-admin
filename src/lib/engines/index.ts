/**
 * Context Engines - Phase 2
 *
 * Centralized export for all context engines that enhance signal detection
 * by leveraging historical data warehouse (Phase 1).
 */

export {
  IVPercentileEngine,
  ivPercentileEngine,
  type IVContext,
  type IVBoostConfig,
} from './IVPercentileEngine';

export {
  GammaExposureEngine,
  gammaExposureEngine,
  type GammaContext,
  type GammaBoostConfig,
} from './GammaExposureEngine';

export {
  MTFAlignmentEngine,
  mtfAlignmentEngine,
  type MTFContext,
  type MTFBoostConfig,
  type TrendDirection,
  type TimeframeAnalysis,
} from './MTFAlignmentEngine';

export {
  FlowAnalysisEngine,
  flowAnalysisEngine,
  type FlowContext,
  type FlowBoostConfig,
  type FlowType,
  type FlowSentiment,
  type FlowAggressiveness,
} from './FlowAnalysisEngine';

export {
  RegimeDetectionEngine,
  regimeDetectionEngine,
  type RegimeContext,
  type RegimeBoostConfig,
  type MarketRegime,
  type VIXRegime,
  type BreadthRegime,
} from './RegimeDetectionEngine';

/**
 * All context engines (singleton instances)
 */
export const contextEngines = {
  ivPercentile: ivPercentileEngine,
  gammaExposure: gammaExposureEngine,
  mtfAlignment: mtfAlignmentEngine,
  flowAnalysis: flowAnalysisEngine,
  regimeDetection: regimeDetectionEngine,
};
