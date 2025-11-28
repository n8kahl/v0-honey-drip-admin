import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Range Fade Long Detector
 *
 * Fade short-term dips at range support in non-trending markets.
 * Best for choppy/ranging markets, lunch hours, low volatility days.
 *
 * Entry Criteria:
 * - Price near lower range boundary (prior day low, support level)
 * - RSI oversold but not extreme (30-45 range)
 * - Volume declining on the pullback (lack of selling pressure)
 * - VWAP above current price (discount to fair value)
 * - No strong downward momentum
 *
 * Expected Frequency: 1-3 signals/day during ranging conditions
 */
export const rangeFadeLongDetector: OpportunityDetector = createDetector({
  type: "range_fade_long",
  direction: "LONG",
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

    // 3. Price must be near support (within 15% of range from low)
    const distanceFromLow = price - priorDayLow;
    const distancePercent = distanceFromLow / rangeSize;

    if (distancePercent > 0.2) return false; // Not close enough to support

    // 4. RSI check - oversold but not extreme
    const rsi = features.rsi?.current;
    if (rsi !== undefined) {
      if (rsi < 25 || rsi > 45) return false; // Too extreme or not oversold
    }

    // 5. Volume declining (bullish on pullback)
    const volumeRatio = features.volume?.relativeToAvg;
    if (volumeRatio !== undefined && volumeRatio > 1.2) {
      // High volume selling - don't fade
      return false;
    }

    // 6. Not in strong downtrend (check momentum)
    const momentum = features.momentum?.roc5;
    if (momentum !== undefined && momentum < -1.5) {
      // Strong downward momentum - don't catch falling knife
      return false;
    }

    // 7. Preferably below VWAP (discount)
    const vwap = features.vwap?.value;
    if (vwap !== undefined && price > vwap * 1.005) {
      // Above VWAP - less favorable
      return false;
    }

    return true;
  },

  scoreFactors: [
    {
      name: "range_support_proximity",
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
        const distancePercent = (price - low) / rangeSize;

        // Closer to support = higher score
        if (distancePercent <= 0.05) return 100;
        if (distancePercent <= 0.1) return 85;
        if (distancePercent <= 0.15) return 70;
        if (distancePercent <= 0.2) return 55;
        return 40;
      },
    },
    {
      name: "rsi_oversold",
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.current;
        if (rsi === undefined) return 50;

        // Sweet spot is 30-40 range
        if (rsi >= 30 && rsi <= 35) return 100;
        if (rsi >= 35 && rsi <= 40) return 85;
        if (rsi >= 25 && rsi < 30) return 70;
        if (rsi >= 40 && rsi <= 45) return 60;
        return 40;
      },
    },
    {
      name: "volume_declining",
      weight: 0.2,
      evaluate: (features) => {
        const volumeRatio = features.volume?.relativeToAvg;
        if (volumeRatio === undefined) return 50;

        // Low volume on pullback is bullish
        if (volumeRatio < 0.5) return 100;
        if (volumeRatio < 0.7) return 85;
        if (volumeRatio < 0.9) return 70;
        if (volumeRatio < 1.1) return 55;
        return 40;
      },
    },
    {
      name: "vwap_discount",
      weight: 0.15,
      evaluate: (features) => {
        if (!features.price?.current || !features.vwap?.value) return 50;

        const discount =
          ((features.vwap.value - features.price.current) / features.vwap.value) * 100;

        if (discount >= 0.5) return 100;
        if (discount >= 0.25) return 85;
        if (discount >= 0) return 70;
        if (discount >= -0.25) return 50;
        return 30;
      },
    },
    {
      name: "momentum_stabilizing",
      weight: 0.1,
      evaluate: (features) => {
        const roc = features.momentum?.roc5;
        if (roc === undefined) return 50;

        // Want momentum to be flat to slightly negative (not accelerating down)
        if (roc >= -0.3 && roc <= 0.3) return 100;
        if (roc >= -0.6 && roc < -0.3) return 75;
        if (roc >= -1.0 && roc < -0.6) return 55;
        return 40;
      },
    },
  ],
});

export default rangeFadeLongDetector;
