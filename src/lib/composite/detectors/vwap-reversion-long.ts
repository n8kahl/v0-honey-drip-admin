import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * VWAP Reversion Long Detector
 *
 * Buy when price dips significantly below VWAP with signs of exhaustion.
 * VWAP acts as a "fair value" anchor - prices tend to revert to it.
 *
 * Entry Criteria:
 * - Price at least 0.3% below VWAP (discount to fair value)
 * - RSI showing oversold conditions (below 40)
 * - Volume declining on the dip (lack of selling conviction)
 * - Not in strong downtrend (momentum stabilizing)
 * - ATR reasonable (not in extreme volatility)
 *
 * Expected Frequency: 2-4 signals/day
 */
export const vwapReversionLongDetector: OpportunityDetector = createDetector({
  type: "vwap_reversion_long",
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // Skip if detector shouldn't run (time-based filters)
    if (!shouldRunDetector(features)) return false;

    // 1. Must have price and VWAP data
    if (!features.price?.current || !features.vwap?.value) return false;

    const price = features.price.current;
    const vwap = features.vwap.value;

    // 2. Price must be below VWAP by at least 0.3%
    const discount = ((vwap - price) / vwap) * 100;
    if (discount < 0.3) return false; // Not enough discount

    // Don't chase if too extended (more than 1.5% below)
    if (discount > 1.5) return false;

    // 3. RSI check - oversold but not extreme
    const rsi = features.rsi?.current;
    if (rsi !== undefined) {
      if (rsi > 45) return false; // Not oversold enough
      if (rsi < 20) return false; // Too extreme, might be falling knife
    }

    // 4. Volume declining (exhaustion of selling)
    const volumeRatio = features.volume?.relativeToAvg;
    if (volumeRatio !== undefined && volumeRatio > 1.5) {
      // High volume selling - trend may continue
      return false;
    }

    // 5. Not in strong downtrend
    const momentum = features.momentum?.roc5;
    if (momentum !== undefined && momentum < -2.0) {
      // Strong downward momentum - don't catch falling knife
      return false;
    }

    // 6. ATR sanity check - reasonable volatility
    const atr = features.atr?.value;
    const atrPercent = atr && price ? (atr / price) * 100 : null;
    if (atrPercent !== null && atrPercent > 3) {
      // Extreme volatility - skip
      return false;
    }

    return true;
  },

  scoreFactors: [
    {
      name: "vwap_discount",
      weight: 0.3,
      evaluate: (features) => {
        if (!features.price?.current || !features.vwap?.value) return 0;

        const discount =
          ((features.vwap.value - features.price.current) / features.vwap.value) * 100;

        // Sweet spot is 0.5-1.0% discount
        if (discount >= 0.7 && discount <= 1.0) return 100;
        if (discount >= 0.5 && discount < 0.7) return 90;
        if (discount >= 1.0 && discount <= 1.2) return 80;
        if (discount >= 0.3 && discount < 0.5) return 65;
        if (discount > 1.2 && discount <= 1.5) return 55;
        return 40;
      },
    },
    {
      name: "rsi_oversold",
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.current;
        if (rsi === undefined) return 50;

        // Sweet spot is 25-35 RSI
        if (rsi >= 25 && rsi <= 30) return 100;
        if (rsi >= 30 && rsi <= 35) return 90;
        if (rsi >= 20 && rsi < 25) return 75;
        if (rsi >= 35 && rsi <= 40) return 65;
        if (rsi >= 40 && rsi <= 45) return 50;
        return 40;
      },
    },
    {
      name: "volume_exhaustion",
      weight: 0.2,
      evaluate: (features) => {
        const volumeRatio = features.volume?.relativeToAvg;
        if (volumeRatio === undefined) return 50;

        // Low volume on dip indicates selling exhaustion
        if (volumeRatio < 0.5) return 100;
        if (volumeRatio < 0.7) return 85;
        if (volumeRatio < 0.9) return 70;
        if (volumeRatio < 1.1) return 55;
        if (volumeRatio < 1.3) return 45;
        return 35;
      },
    },
    {
      name: "momentum_stabilizing",
      weight: 0.15,
      evaluate: (features) => {
        const roc = features.momentum?.roc5;
        if (roc === undefined) return 50;

        // Want momentum to be flat to slightly negative (not accelerating down)
        if (roc >= -0.3 && roc <= 0.3) return 100;
        if (roc >= -0.6 && roc < -0.3) return 80;
        if (roc > 0.3 && roc <= 0.6) return 75;
        if (roc >= -1.0 && roc < -0.6) return 60;
        return 40;
      },
    },
    {
      name: "atr_reasonable",
      weight: 0.1,
      evaluate: (features) => {
        const atr = features.atr?.value;
        const price = features.price?.current;
        if (!atr || !price) return 50;

        const atrPercent = (atr / price) * 100;

        // Lower volatility is better for mean reversion
        if (atrPercent < 0.5) return 100;
        if (atrPercent < 1.0) return 85;
        if (atrPercent < 1.5) return 70;
        if (atrPercent < 2.0) return 55;
        return 40;
      },
    },
  ],
});

export default vwapReversionLongDetector;
