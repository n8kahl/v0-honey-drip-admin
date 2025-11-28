/**
 * Opportunity Detectors - Phase 3
 *
 * This module exports all 24 opportunity detectors:
 * - 6 Universal Equity Detectors
 * - 11 SPX/NDX-Specific Detectors
 * - 7 Non-Trend Day Strategies (Phase 3)
 */

// Universal Equity Detectors
export { breakoutBullishDetector } from "./breakout-bullish.js";
export { breakoutBearishDetector } from "./breakout-bearish.js";
export { meanReversionLongDetector } from "./mean-reversion-long.js";
export { meanReversionShortDetector } from "./mean-reversion-short.js";
export { trendContinuationLongDetector } from "./trend-continuation-long.js";
export { trendContinuationShortDetector } from "./trend-continuation-short.js";

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

// Non-Trend Day Strategies (Phase 3)
export { rangeFadeLongDetector } from "./range-fade-long.js";
export { rangeFadeShortDetector } from "./range-fade-short.js";
export { vwapReversionLongDetector } from "./vwap-reversion-long.js";
export { vwapReversionShortDetector } from "./vwap-reversion-short.js";
export { gammaPinningDetector } from "./gamma-pinning.js";
export { volatilitySqueezeeLongDetector } from "./volatility-squeeze-long.js";
export { volatilitySqueezeeShortDetector } from "./volatility-squeeze-short.js";

// Convenience array of all detectors
import type { OpportunityDetector } from "../OpportunityDetector.js";
import { breakoutBullishDetector } from "./breakout-bullish.js";
import { breakoutBearishDetector } from "./breakout-bearish.js";
import { meanReversionLongDetector } from "./mean-reversion-long.js";
import { meanReversionShortDetector } from "./mean-reversion-short.js";
import { trendContinuationLongDetector } from "./trend-continuation-long.js";
import { trendContinuationShortDetector } from "./trend-continuation-short.js";
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
// Non-Trend Day Strategies (Phase 3)
import { rangeFadeLongDetector } from "./range-fade-long.js";
import { rangeFadeShortDetector } from "./range-fade-short.js";
import { vwapReversionLongDetector } from "./vwap-reversion-long.js";
import { vwapReversionShortDetector } from "./vwap-reversion-short.js";
import { gammaPinningDetector } from "./gamma-pinning.js";
import { volatilitySqueezeeLongDetector } from "./volatility-squeeze-long.js";
import { volatilitySqueezeeShortDetector } from "./volatility-squeeze-short.js";

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

  // Non-Trend Day Strategies (7) - Phase 3
  rangeFadeLongDetector,
  rangeFadeShortDetector,
  vwapReversionLongDetector,
  vwapReversionShortDetector,
  gammaPinningDetector,
  volatilitySqueezeeLongDetector,
  volatilitySqueezeeShortDetector,
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
 * Non-Trend Day Strategy detectors (Phase 3)
 * These work for all asset classes during ranging/choppy markets
 */
export const NON_TREND_DETECTORS: OpportunityDetector[] = [
  rangeFadeLongDetector,
  rangeFadeShortDetector,
  vwapReversionLongDetector,
  vwapReversionShortDetector,
  gammaPinningDetector,
  volatilitySqueezeeLongDetector,
  volatilitySqueezeeShortDetector,
];
