import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * VWAP Reversion Short Detector
 *
 * Short when price rallies significantly above VWAP with signs of exhaustion.
 * VWAP acts as a "fair value" anchor - prices tend to revert to it.
 *
 * Entry Criteria:
 * - Price at least 0.3% above VWAP (premium to fair value)
 * - RSI showing overbought conditions (above 60)
 * - Volume declining on the rally (lack of buying conviction)
 * - Not in strong uptrend (momentum stabilizing)
 * - ATR reasonable (not in extreme volatility)
 *
 * Expected Frequency: 2-4 signals/day
 */
export const vwapReversionShortDetector: OpportunityDetector = createDetector({
  type: "vwap_reversion_short",
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // Skip if detector shouldn't run (time-based filters)
    if (!shouldRunDetector(features)) return false;

    // 1. Must have price and VWAP data
    if (!features.price?.current || !features.vwap?.value) return false;

    const price = features.price.current;
    const vwap = features.vwap.value;

    // 2. Price must be above VWAP by at least 0.3%
    const premium = ((price - vwap) / vwap) * 100;
    if (premium < 0.3) return false; // Not enough premium

    // Don't chase if too extended (more than 1.5% above)
    if (premium > 1.5) return false;

    // 3. RSI check - overbought but not extreme
    const rsi = features.rsi?.current;
    if (rsi !== undefined) {
      if (rsi < 55) return false; // Not overbought enough
      if (rsi > 80) return false; // Too extreme, might be parabolic
    }

    // 4. Volume declining (exhaustion of buying)
    const volumeRatio = features.volume?.relativeToAvg;
    if (volumeRatio !== undefined && volumeRatio > 1.5) {
      // High volume buying - trend may continue
      return false;
    }

    // 5. Not in strong uptrend
    const momentum = features.momentum?.roc5;
    if (momentum !== undefined && momentum > 2.0) {
      // Strong upward momentum - don't short rockets
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
      name: "vwap_premium",
      weight: 0.3,
      evaluate: (features) => {
        if (!features.price?.current || !features.vwap?.value) return 0;

        const premium =
          ((features.price.current - features.vwap.value) / features.vwap.value) * 100;

        // Sweet spot is 0.5-1.0% premium
        if (premium >= 0.7 && premium <= 1.0) return 100;
        if (premium >= 0.5 && premium < 0.7) return 90;
        if (premium >= 1.0 && premium <= 1.2) return 80;
        if (premium >= 0.3 && premium < 0.5) return 65;
        if (premium > 1.2 && premium <= 1.5) return 55;
        return 40;
      },
    },
    {
      name: "rsi_overbought",
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.current;
        if (rsi === undefined) return 50;

        // Sweet spot is 65-75 RSI
        if (rsi >= 70 && rsi <= 75) return 100;
        if (rsi >= 65 && rsi < 70) return 90;
        if (rsi >= 75 && rsi <= 80) return 75;
        if (rsi >= 60 && rsi < 65) return 65;
        if (rsi >= 55 && rsi < 60) return 50;
        return 40;
      },
    },
    {
      name: "volume_exhaustion",
      weight: 0.2,
      evaluate: (features) => {
        const volumeRatio = features.volume?.relativeToAvg;
        if (volumeRatio === undefined) return 50;

        // Low volume on rally indicates buying exhaustion
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

        // Want momentum to be flat to slightly positive (not accelerating up)
        if (roc >= -0.3 && roc <= 0.3) return 100;
        if (roc > 0.3 && roc <= 0.6) return 80;
        if (roc >= -0.6 && roc < -0.3) return 75;
        if (roc > 0.6 && roc <= 1.0) return 60;
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

export default vwapReversionShortDetector;
