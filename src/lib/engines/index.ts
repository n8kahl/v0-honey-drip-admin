/**
 * Context Engines - Phase 2
 *
 * Centralized export for all context engines that enhance signal detection
 * by leveraging historical data warehouse (Phase 1).
 */

// Import engines (no .js extensions for Vite bundling)
import {
  IVPercentileEngine,
  ivPercentileEngine as _ivPercentileEngine,
  type IVContext,
  type IVBoostConfig,
} from "./IVPercentileEngine";

import {
  GammaExposureEngine,
  gammaExposureEngine as _gammaExposureEngine,
  type GammaContext,
  type GammaBoostConfig,
} from "./GammaExposureEngine";

import {
  MTFAlignmentEngine,
  mtfAlignmentEngine as _mtfAlignmentEngine,
  type MTFContext,
  type MTFBoostConfig,
  type TrendDirection,
  type TimeframeAnalysis,
} from "./MTFAlignmentEngine";

import {
  FlowAnalysisEngine,
  flowAnalysisEngine as _flowAnalysisEngine,
  type FlowContext,
  type FlowBoostConfig,
  type FlowType,
  type FlowSentiment,
  type FlowAggressiveness,
} from "./FlowAnalysisEngine";

import {
  RegimeDetectionEngine,
  regimeDetectionEngine as _regimeDetectionEngine,
  type RegimeContext,
  type RegimeBoostConfig,
  type MarketRegime,
  type VIXRegime,
  type BreadthRegime,
} from "./RegimeDetectionEngine";

// Export classes
export { IVPercentileEngine };
export { GammaExposureEngine };
export { MTFAlignmentEngine };
export { FlowAnalysisEngine };
export { RegimeDetectionEngine };

// Export singletons
export const ivPercentileEngine = _ivPercentileEngine;
export const gammaExposureEngine = _gammaExposureEngine;
export const mtfAlignmentEngine = _mtfAlignmentEngine;
export const flowAnalysisEngine = _flowAnalysisEngine;
export const regimeDetectionEngine = _regimeDetectionEngine;

// Export types
export type { IVContext, IVBoostConfig };
export type { GammaContext, GammaBoostConfig };
export type { MTFContext, MTFBoostConfig, TrendDirection, TimeframeAnalysis };
export type { FlowContext, FlowBoostConfig, FlowType, FlowSentiment, FlowAggressiveness };
export type { RegimeContext, RegimeBoostConfig, MarketRegime, VIXRegime, BreadthRegime };

/**
 * All context engines (singleton instances)
 */
export const contextEngines = {
  ivPercentile: _ivPercentileEngine,
  gammaExposure: _gammaExposureEngine,
  mtfAlignment: _mtfAlignmentEngine,
  flowAnalysis: _flowAnalysisEngine,
  regimeDetection: _regimeDetectionEngine,
};
