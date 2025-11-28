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
