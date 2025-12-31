/**
 * Opportunity Detectors - Phase 3
 *
 * This module exports all 17 opportunity detectors:
 * - 6 Universal Equity Detectors
 * - 11 SPX/NDX-Specific Detectors
 */

// Universal Equity Detectors
export { breakoutBullishDetector } from "./breakout-bullish.js";
export { breakoutBearishDetector } from "./breakout-bearish.js";
export { meanReversionLongDetector } from "./mean-reversion-long.js";
export { meanReversionShortDetector } from "./mean-reversion-short.js";
export { trendContinuationLongDetector } from "./trend-continuation-long.js";
export { trendContinuationShortDetector } from "./trend-continuation-short.js";

// Flow-Primary Detectors (Phase 3 - Smart Money Following)
export { sweepMomentumLongDetector } from "./sweep-momentum-long.js";
export { sweepMomentumShortDetector } from "./sweep-momentum-short.js";

// SPX/NDX-Specific Detectors
export { gammaSqueezeBullishDetector } from "./gamma-squeeze-bullish.js";
export { gammaSqueezeBearishDetector } from "./gamma-squeeze-bearish.js";
export { powerHourReversalBullishDetector } from "./power-hour-reversal-bullish.js";
export { powerHourReversalBearishDetector } from "./power-hour-reversal-bearish.js";
export { indexMeanReversionLongDetector } from "./index-mean-reversion-long.js";
export { indexMeanReversionShortDetector } from "./index-mean-reversion-short.js";
export { openingDriveBullishDetector } from "./opening-drive-bullish.js";
export { openingDriveBearishDetector } from "./opening-drive-bearish.js";
export { gammaFlipBullishDetector } from "./gamma-flip-bullish.js";
export { gammaFlipBearishDetector } from "./gamma-flip-bearish.js";
export { eodPinSetupDetector } from "./eod-pin-setup.js";

// KCU LTP Strategy Detectors
export * from "./kcu/index.js";
import { ALL_KCU_DETECTORS } from "./kcu/index.js";

// Convenience array of all detectors
import type { OpportunityDetector } from "../OpportunityDetector.js";
import { breakoutBullishDetector } from "./breakout-bullish.js";
import { breakoutBearishDetector } from "./breakout-bearish.js";
import { meanReversionLongDetector } from "./mean-reversion-long.js";
import { meanReversionShortDetector } from "./mean-reversion-short.js";
import { trendContinuationLongDetector } from "./trend-continuation-long.js";
import { trendContinuationShortDetector } from "./trend-continuation-short.js";
import { sweepMomentumLongDetector } from "./sweep-momentum-long.js";
import { sweepMomentumShortDetector } from "./sweep-momentum-short.js";
import { gammaSqueezeBullishDetector } from "./gamma-squeeze-bullish.js";
import { gammaSqueezeBearishDetector } from "./gamma-squeeze-bearish.js";
import { powerHourReversalBullishDetector } from "./power-hour-reversal-bullish.js";
import { powerHourReversalBearishDetector } from "./power-hour-reversal-bearish.js";
import { indexMeanReversionLongDetector } from "./index-mean-reversion-long.js";
import { indexMeanReversionShortDetector } from "./index-mean-reversion-short.js";
import { openingDriveBullishDetector } from "./opening-drive-bullish.js";
import { openingDriveBearishDetector } from "./opening-drive-bearish.js";
import { gammaFlipBullishDetector } from "./gamma-flip-bullish.js";
import { gammaFlipBearishDetector } from "./gamma-flip-bearish.js";
import { eodPinSetupDetector } from "./eod-pin-setup.js";

/**
 * All opportunity detectors
 */
export const ALL_DETECTORS: OpportunityDetector[] = [
  // Universal Equity (6)
  breakoutBullishDetector,
  breakoutBearishDetector,
  meanReversionLongDetector,
  meanReversionShortDetector,
  trendContinuationLongDetector,
  trendContinuationShortDetector,

  // Flow-Primary (2) - Phase 3 Smart Money Following
  sweepMomentumLongDetector,
  sweepMomentumShortDetector,

  // SPX/NDX-Specific (11)
  gammaSqueezeBullishDetector,
  gammaSqueezeBearishDetector,
  powerHourReversalBullishDetector,
  powerHourReversalBearishDetector,
  indexMeanReversionLongDetector,
  indexMeanReversionShortDetector,
  openingDriveBullishDetector,
  openingDriveBearishDetector,
  gammaFlipBullishDetector,
  gammaFlipBearishDetector,
  eodPinSetupDetector,
];

/**
 * Universal equity detectors only
 */
export const EQUITY_DETECTORS: OpportunityDetector[] = [
  breakoutBullishDetector,
  breakoutBearishDetector,
  meanReversionLongDetector,
  meanReversionShortDetector,
  trendContinuationLongDetector,
  trendContinuationShortDetector,
];

/**
 * SPX/NDX-specific detectors only
 */
export const INDEX_DETECTORS: OpportunityDetector[] = [
  gammaSqueezeBullishDetector,
  gammaSqueezeBearishDetector,
  powerHourReversalBullishDetector,
  powerHourReversalBearishDetector,
  indexMeanReversionLongDetector,
  indexMeanReversionShortDetector,
  openingDriveBullishDetector,
  openingDriveBearishDetector,
  gammaFlipBullishDetector,
  gammaFlipBearishDetector,
  eodPinSetupDetector,
];

/**
 * PROFITABLE DETECTORS ONLY
 * Based on 90-day backtest analysis (Nov 2025):
 * - opening_drive_bearish: 3.30 PF, 56.3% WR
 * - mean_reversion_short: 2.09 PF, 62.5% WR
 * - index_mean_reversion_short: 2.09 PF, 62.5% WR
 *
 * EXCLUDED (PF < 0.8):
 * - trend_continuation_long (0.49 PF) - highest volume loser
 * - trend_continuation_short (0.19 PF)
 * - opening_drive_bullish (0.66 PF)
 * - mean_reversion_long (0.03 PF)
 * - index_mean_reversion_long (0.03 PF)
 *
 * EXCLUDED (0 trades - BacktestEngine missing pattern flags):
 * - All breakout detectors
 * - All gamma detectors
 * - All power_hour detectors
 * - eod_pin_setup
 */
export const PROFITABLE_DETECTORS: OpportunityDetector[] = [
  openingDriveBearishDetector,
  meanReversionShortDetector,
  indexMeanReversionShortDetector,
];

/**
 * BACKTESTABLE DETECTORS
 * Detectors that can be evaluated by BacktestEngine using historical price/volume data.
 *
 * EXCLUDED (require real-time options data - cannot backtest):
 * - gamma_squeeze_bullish/bearish: Needs dealerNetGamma, maxGammaStrike
 * - gamma_flip_bullish/bearish: Needs gammaFlipLevel, is0DTE
 * - eod_pin_setup: Needs maxPainStrike, openInterestAtStrike, is0DTE
 *
 * INCLUDED (12 detectors):
 * - All breakout detectors (pattern flags computed by BacktestEngine)
 * - All mean reversion detectors
 * - All trend continuation detectors
 * - All opening drive detectors
 * - All power hour reversal detectors
 * - All index mean reversion detectors
 */
export const BACKTESTABLE_DETECTORS: OpportunityDetector[] = [
  // Universal Equity (6)
  breakoutBullishDetector,
  breakoutBearishDetector,
  meanReversionLongDetector,
  meanReversionShortDetector,
  trendContinuationLongDetector,
  trendContinuationShortDetector,

  // SPX/NDX-Specific that DON'T require options data (6)
  powerHourReversalBullishDetector,
  powerHourReversalBearishDetector,
  indexMeanReversionLongDetector,
  indexMeanReversionShortDetector,
  openingDriveBullishDetector,
  openingDriveBearishDetector,
];

/**
 * OPTIONS-DEPENDENT DETECTORS
 * These require real-time options chain data and cannot be backtested.
 * Use only for live trading with CompositeScanner.
 */
export const OPTIONS_DEPENDENT_DETECTORS: OpportunityDetector[] = [
  gammaSqueezeBullishDetector,
  gammaSqueezeBearishDetector,
  gammaFlipBullishDetector,
  gammaFlipBearishDetector,
  eodPinSetupDetector,
];

/**
 * KCU LTP STRATEGY DETECTORS
 * Mr. K Capital University trading methodology:
 * - EMA Bounce (8 detectors - 4 strategies × 2 directions)
 * - VWAP Standard
 * - King & Queen
 * - ORB Breakout
 */
export const KCU_DETECTORS: OpportunityDetector[] = ALL_KCU_DETECTORS;

/**
 * ALL DETECTORS INCLUDING KCU
 * Total: 25 detectors (17 original + 8 KCU)
 */
export const ALL_DETECTORS_WITH_KCU: OpportunityDetector[] = [...ALL_DETECTORS, ...KCU_DETECTORS];

/**
 * BACKTESTABLE KCU DETECTORS
 * All KCU detectors can be backtested as they rely on:
 * - Price action (OHLC)
 * - VWAP (computed from volume)
 * - EMAs (computed from price)
 * - ORB levels (computed from first 15-30 min)
 *
 * None require real-time options data.
 */
export const BACKTESTABLE_KCU_DETECTORS: OpportunityDetector[] = ALL_KCU_DETECTORS;

/**
 * BACKTESTABLE DETECTORS WITH KCU
 * Total: 20 detectors (12 original backtestable + 8 KCU)
 */
export const BACKTESTABLE_DETECTORS_WITH_KCU: OpportunityDetector[] = [
  ...BACKTESTABLE_DETECTORS,
  ...BACKTESTABLE_KCU_DETECTORS,
];

/**
 * FLOW-PRIMARY DETECTORS (Phase 3)
 * Use institutional flow (sweeps, blocks) as PRIMARY signal.
 * Technical indicators are SECONDARY confirmation only.
 *
 * These detectors follow smart money and require features.flow data:
 * - sweep_momentum_long: Multiple bullish sweeps + high flow score
 * - sweep_momentum_short: Multiple bearish sweeps + low buy pressure
 *
 * NOTE: Cannot backtest without historical flow data (30+ days needed)
 */
export const FLOW_PRIMARY_DETECTORS: OpportunityDetector[] = [
  sweepMomentumLongDetector,
  sweepMomentumShortDetector,
];

/**
 * ALL DETECTORS INCLUDING FLOW
 * Total: 19 detectors (17 original + 2 flow-primary)
 */
export const ALL_DETECTORS_WITH_FLOW: OpportunityDetector[] = [...ALL_DETECTORS];
