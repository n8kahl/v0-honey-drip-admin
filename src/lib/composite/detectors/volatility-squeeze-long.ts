import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Volatility Squeeze Long Detector
 *
 * Detect compression in volatility (low ATR, tight price range) with
 * bullish bias, suggesting an imminent upside breakout.
 *
 * Entry Criteria:
 * - ATR is below recent average (compressed volatility)
 * - Price near support or consolidation low
 * - RSI not oversold (avoid catching falling knives)
 * - Slight bullish bias (above VWAP or short-term EMA)
 * - Volume building or stable (coiling for breakout)
 *
 * Expected Frequency: 1-2 signals/day
 */
export const volatilitySqueezeeLongDetector: OpportunityDetector = createDetector({
  type: "volatility_squeeze_long",
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK", "INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // Skip if detector shouldn't run (time-based filters)
    if (!shouldRunDetector(features)) return false;

    // 1. Must have price and ATR data
    if (!features.price?.current || !features.atr?.value) return false;

    const price = features.price.current;
    const atr = features.atr.value;

    // 2. ATR must be compressed (low relative to price)
    const atrPercent = (atr / price) * 100;
    if (atrPercent > 1.0) return false; // Not compressed enough

    // 3. Need prior day levels to assess range compression
    const priorDayLevels = features.priorDayLevels;
    if (priorDayLevels?.high && priorDayLevels?.low) {
      const priorRange = priorDayLevels.high - priorDayLevels.low;
      const priorRangePercent = (priorRange / price) * 100;

      // Prior day range should be relatively tight
      if (priorRangePercent > 2.0) return false;
    }

    // 4. Bullish bias - price should be holding above key levels
    const vwap = features.vwap?.value;
    if (vwap !== undefined) {
      // Ideally near or slightly above VWAP
      const vwapDiff = ((price - vwap) / vwap) * 100;
      if (vwapDiff < -0.5) return false; // Too far below VWAP
    }

    // 5. RSI should be neutral to slightly bullish (not oversold)
    const rsi = features.rsi?.current;
    if (rsi !== undefined) {
      if (rsi < 35) return false; // Too oversold
      if (rsi > 70) return false; // Already overbought
    }

    // 6. Momentum should be flat to slightly positive (coiling)
    const momentum = features.momentum?.roc5;
    if (momentum !== undefined) {
      if (momentum < -1.0) return false; // Too bearish
      if (momentum > 1.5) return false; // Already breaking out
    }

    // 7. Volume should not be too low (need participation)
    const volumeRatio = features.volume?.relativeToAvg;
    if (volumeRatio !== undefined && volumeRatio < 0.3) {
      return false; // Dead volume - no conviction
    }

    return true;
  },

  scoreFactors: [
    {
      name: "volatility_compression",
      weight: 0.3,
      evaluate: (features) => {
        const atr = features.atr?.value;
        const price = features.price?.current;
        if (!atr || !price) return 0;

        const atrPercent = (atr / price) * 100;

        // Lower ATR% = more compression = higher score
        if (atrPercent < 0.3) return 100;
        if (atrPercent < 0.5) return 90;
        if (atrPercent < 0.7) return 75;
        if (atrPercent < 0.9) return 60;
        if (atrPercent <= 1.0) return 45;
        return 30;
      },
    },
    {
      name: "bullish_bias",
      weight: 0.25,
      evaluate: (features) => {
        let score = 50;

        // Above VWAP = bullish bias
        const price = features.price?.current;
        const vwap = features.vwap?.value;
        if (price && vwap) {
          const vwapDiff = ((price - vwap) / vwap) * 100;
          if (vwapDiff > 0.3) score += 25;
          else if (vwapDiff > 0) score += 15;
          else if (vwapDiff > -0.3) score += 5;
          else score -= 10;
        }

        // Slight positive momentum = coiling bullishly
        const roc = features.momentum?.roc5;
        if (roc !== undefined) {
          if (roc > 0.2 && roc < 0.8) score += 25;
          else if (roc > 0 && roc < 1.0) score += 15;
          else if (roc >= -0.3 && roc <= 0) score += 5;
        }

        return Math.min(100, Math.max(0, score));
      },
    },
    {
      name: "rsi_setup",
      weight: 0.2,
      evaluate: (features) => {
        const rsi = features.rsi?.current;
        if (rsi === undefined) return 50;

        // Sweet spot is 45-55 (neutral, ready for move)
        if (rsi >= 45 && rsi <= 55) return 100;
        if (rsi >= 40 && rsi < 45) return 85;
        if (rsi >= 55 && rsi <= 60) return 80;
        if (rsi >= 35 && rsi < 40) return 65;
        if (rsi >= 60 && rsi <= 65) return 60;
        if (rsi >= 65 && rsi <= 70) return 45;
        return 30;
      },
    },
    {
      name: "range_tightness",
      weight: 0.15,
      evaluate: (features) => {
        const price = features.price?.current;
        const high = features.priorDayLevels?.high;
        const low = features.priorDayLevels?.low;

        if (!price || !high || !low) return 50;

        const rangePercent = ((high - low) / price) * 100;

        // Tighter range = more compression
        if (rangePercent < 0.5) return 100;
        if (rangePercent < 0.8) return 85;
        if (rangePercent < 1.0) return 70;
        if (rangePercent < 1.5) return 55;
        if (rangePercent <= 2.0) return 40;
        return 25;
      },
    },
    {
      name: "volume_readiness",
      weight: 0.1,
      evaluate: (features) => {
        const volumeRatio = features.volume?.relativeToAvg;
        if (volumeRatio === undefined) return 50;

        // Average volume = ready for breakout
        // Very low = no interest, very high = already moving
        if (volumeRatio >= 0.7 && volumeRatio <= 1.1) return 100;
        if (volumeRatio >= 0.5 && volumeRatio < 0.7) return 75;
        if (volumeRatio > 1.1 && volumeRatio <= 1.3) return 70;
        if (volumeRatio >= 0.3 && volumeRatio < 0.5) return 50;
        if (volumeRatio > 1.3 && volumeRatio <= 1.5) return 55;
        return 35;
      },
    },
  ],
});

export default volatilitySqueezeeLongDetector;
