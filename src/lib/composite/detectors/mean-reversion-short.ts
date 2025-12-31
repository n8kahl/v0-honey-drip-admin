import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Mean Reversion Short Detector
 *
 * Detects overbought conditions with VWAP deviation, looking for pullback opportunities.
 * RSI extreme + stretched above VWAP + volume confirmation.
 *
 * Expected Frequency: 3-5 signals/day per symbol
 */
export const meanReversionShortDetector: OpportunityDetector = createDetector({
  type: "mean_reversion_short",
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. RSI overbought - OPTIMIZED: Tighter threshold (was 65, now 70)
    const rsi = features.rsi?.["14"];
    if (!rsi || rsi <= 70) return false;

    // 2. Above VWAP (stretched) - OPTIMIZED: Require more stretched (was 0.3, now 0.5)
    const vwapDist = features.vwap?.distancePct;
    if (!vwapDist || vwapDist <= 0.5) return false; // Must be at least +0.5% above VWAP

    // 3. Volume confirmation - OPTIMIZED: Require elevated volume for quality
    const relativeVolume = features.volume?.relativeToAvg ?? 1;
    if (relativeVolume < 1.2) return false; // Skip low-volume setups

    // 4. Check if detector should run (market hours or weekend mode)
    if (!shouldRunDetector(features)) return false;

    // 5. Not in a strong uptrend
    const regime = features.pattern?.market_regime;
    if (regime === "trending_up") return false; // Don't fight strong uptrends

    return true;
  },

  scoreFactors: [
    {
      name: "rsi_extreme",
      weight: 0.35,
      evaluate: (features) => {
        const rsi = features.rsi?.["14"] || 50;

        // More overbought = higher score
        // RSI 70 = 60, RSI 75 = 80, RSI 80+ = 100
        if (rsi >= 80) return 100;
        if (rsi >= 75) return 85;
        if (rsi >= 70) return 70;
        if (rsi >= 65) return 55;

        return Math.max(0, (rsi - 50) * 2);
      },
    },
    {
      name: "vwap_deviation",
      weight: 0.3,
      evaluate: (features) => {
        const vwapDist = features.vwap?.distancePct || 0;

        // More stretched above VWAP = higher mean reversion potential
        // +0.5% = 60, +1.0% = 80, +1.5%+ = 100
        if (vwapDist >= 1.5) return 100;
        if (vwapDist >= 1.0) return 85;
        if (vwapDist >= 0.5) return 70;
        if (vwapDist >= 0.3) return 55;

        return Math.min(100, vwapDist * 40);
      },
    },
    {
      name: "volume_profile",
      weight: 0.2,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // Higher volume on the rally = stronger reversal potential (exhaustion)
        // 1.0x = 50, 1.5x = 70, 2.0x+ = 100
        if (rvol >= 2.0) return 100;
        if (rvol >= 1.5) return 80;
        if (rvol >= 1.2) return 65;

        return Math.min(100, rvol * 50);
      },
    },
    {
      name: "market_regime_suitability",
      weight: 0.1,
      evaluate: (features) => {
        const regime = features.pattern?.market_regime;

        // Mean reversion works best in ranging/choppy markets
        if (regime === "ranging") return 100;
        if (regime === "choppy") return 90;
        if (regime === "volatile") return 70;
        if (regime === "trending_down") return 60;
        if (regime === "trending_up") return 20; // Risky in uptrends

        return 50;
      },
    },
    {
      name: "reversal_confirmation",
      weight: 0.05,
      evaluate: (features) => {
        // Check for early reversal signs
        const hasPatientCandle = features.pattern?.patient_candle === true;
        const hasBearishDivergence = features.pattern?.rsi_bearish_divergence === true;

        let score = 50; // Base

        if (hasBearishDivergence) score += 30;
        if (hasPatientCandle) score += 20;

        return Math.min(100, score);
      },
    },
  ],
});
