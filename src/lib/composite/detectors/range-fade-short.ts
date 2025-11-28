import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Range Fade Short Detector
 *
 * Fade rallies at range resistance in non-trending markets.
 * Best for choppy/ranging markets, lunch hours, low volatility days.
 *
 * Entry Criteria:
 * - Price near upper range boundary (prior day high, resistance level)
 * - RSI overbought but not extreme (55-70 range)
 * - Volume declining on the rally (lack of buying pressure)
 * - VWAP below current price (premium to fair value)
 * - No strong upward momentum
 *
 * Expected Frequency: 1-3 signals/day during ranging conditions
 */
export const rangeFadeShortDetector: OpportunityDetector = createDetector({
  type: "range_fade_short",
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // Skip if detector shouldn't run (time-based filters)
    if (!shouldRunDetector(features)) return false;

    // 1. Must have price and level data
    if (!features.price?.current || !features.priorDayLevels) return false;

    const price = features.price.current;
    const priorDayLow = features.priorDayLevels.low;
    const priorDayHigh = features.priorDayLevels.high;

    if (!priorDayLow || !priorDayHigh) return false;

    // 2. Calculate range
    const rangeSize = priorDayHigh - priorDayLow;
    const rangePercent = (rangeSize / price) * 100;

    // Range must be reasonable (0.5% - 2.5%)
    if (rangePercent < 0.5 || rangePercent > 2.5) return false;

    // 3. Price must be near resistance (within 15% of range from high)
    const distanceFromHigh = priorDayHigh - price;
    const distancePercent = distanceFromHigh / rangeSize;

    if (distancePercent > 0.2) return false; // Not close enough to resistance

    // 4. RSI check - overbought but not extreme
    const rsi = features.rsi?.current;
    if (rsi !== undefined) {
      if (rsi < 55 || rsi > 75) return false; // Too extreme or not overbought
    }

    // 5. Volume declining (bearish on rally)
    const volumeRatio = features.volume?.relativeToAvg;
    if (volumeRatio !== undefined && volumeRatio > 1.2) {
      // High volume buying - don't fade
      return false;
    }

    // 6. Not in strong uptrend (check momentum)
    const momentum = features.momentum?.roc5;
    if (momentum !== undefined && momentum > 1.5) {
      // Strong upward momentum - don't short rockets
      return false;
    }

    // 7. Preferably above VWAP (premium)
    const vwap = features.vwap?.value;
    if (vwap !== undefined && price < vwap * 0.995) {
      // Below VWAP - less favorable short
      return false;
    }

    return true;
  },

  scoreFactors: [
    {
      name: "range_resistance_proximity",
      weight: 0.3,
      evaluate: (features) => {
        if (
          !features.price?.current ||
          !features.priorDayLevels?.low ||
          !features.priorDayLevels?.high
        )
          return 0;

        const price = features.price.current;
        const low = features.priorDayLevels.low;
        const high = features.priorDayLevels.high;
        const rangeSize = high - low;
        const distancePercent = (high - price) / rangeSize;

        // Closer to resistance = higher score
        if (distancePercent <= 0.05) return 100;
        if (distancePercent <= 0.1) return 85;
        if (distancePercent <= 0.15) return 70;
        if (distancePercent <= 0.2) return 55;
        return 40;
      },
    },
    {
      name: "rsi_overbought",
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.current;
        if (rsi === undefined) return 50;

        // Sweet spot is 60-70 range
        if (rsi >= 65 && rsi <= 70) return 100;
        if (rsi >= 60 && rsi < 65) return 85;
        if (rsi >= 70 && rsi <= 75) return 70;
        if (rsi >= 55 && rsi < 60) return 60;
        return 40;
      },
    },
    {
      name: "volume_declining",
      weight: 0.2,
      evaluate: (features) => {
        const volumeRatio = features.volume?.relativeToAvg;
        if (volumeRatio === undefined) return 50;

        // Low volume on rally is bearish
        if (volumeRatio < 0.5) return 100;
        if (volumeRatio < 0.7) return 85;
        if (volumeRatio < 0.9) return 70;
        if (volumeRatio < 1.1) return 55;
        return 40;
      },
    },
    {
      name: "vwap_premium",
      weight: 0.15,
      evaluate: (features) => {
        if (!features.price?.current || !features.vwap?.value) return 50;

        const premium =
          ((features.price.current - features.vwap.value) / features.vwap.value) * 100;

        if (premium >= 0.5) return 100;
        if (premium >= 0.25) return 85;
        if (premium >= 0) return 70;
        if (premium >= -0.25) return 50;
        return 30;
      },
    },
    {
      name: "momentum_stabilizing",
      weight: 0.1,
      evaluate: (features) => {
        const roc = features.momentum?.roc5;
        if (roc === undefined) return 50;

        // Want momentum to be flat to slightly positive (not accelerating up)
        if (roc >= -0.3 && roc <= 0.3) return 100;
        if (roc > 0.3 && roc <= 0.6) return 75;
        if (roc > 0.6 && roc <= 1.0) return 55;
        return 40;
      },
    },
  ],
});

export default rangeFadeShortDetector;
