import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Mean Reversion Long Detector
 *
 * Detects oversold conditions with VWAP deviation, looking for bounce opportunities.
 * RSI extreme + stretched below VWAP + volume confirmation.
 *
 * Expected Frequency: 3-5 signals/day per symbol
 */
export const meanReversionLongDetector: OpportunityDetector = createDetector({
  type: "mean_reversion_long",
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours or weekend mode)
    const shouldRun = shouldRunDetector(features);
    console.log(`[mean-reversion-long] ${symbol}: shouldRun=${shouldRun}`);
    if (!shouldRun) return false;

    // 2. RSI oversold - relaxed threshold for weekend analysis
    const rsi = features.rsi?.["14"];
    // CRITICAL FIX: Explicitly check for false (undefined should default to weekday, not weekend!)
    const isWeekend = features.session?.isRegularHours === false;
    const rsiThreshold = isWeekend ? 40 : 35; // More lenient on weekends
    console.log(
      `[mean-reversion-long] ${symbol}: RSI=${rsi}, threshold=${rsiThreshold}, isWeekend=${isWeekend}`
    );
    if (!rsi || rsi >= rsiThreshold) {
      console.log(`[mean-reversion-long] ${symbol}: ❌ RSI check failed`);
      return false;
    }

    // 3. Below VWAP (stretched) - relaxed for weekends, optional if data unavailable
    const vwapDist = features.vwap?.distancePct;
    const vwapThreshold = isWeekend ? -0.2 : -0.3; // Less strict on weekends
    console.log(
      `[mean-reversion-long] ${symbol}: VWAP dist=${vwapDist}, threshold=${vwapThreshold}`
    );

    // On weekends, VWAP data may be unavailable or return 0 (data quality issue)
    const hasValidVwap = vwapDist !== undefined && vwapDist !== null && vwapDist !== 0;

    if (!isWeekend) {
      // Regular hours: VWAP is required
      if (!hasValidVwap || vwapDist >= vwapThreshold) {
        console.log(`[mean-reversion-long] ${symbol}: ❌ VWAP check failed (regular hours)`);
        return false;
      }
    } else if (hasValidVwap) {
      // Weekend with valid VWAP data: apply lenient threshold
      if (vwapDist >= vwapThreshold) {
        console.log(`[mean-reversion-long] ${symbol}: ❌ VWAP check failed (weekend with data)`);
        return false;
      }
    } else {
      console.log(
        `[mean-reversion-long] ${symbol}: ⚠️ VWAP unavailable or invalid (${vwapDist}), skipping check`
      );
    }
    // Weekend without valid VWAP data: skip check entirely (rely on RSI + patterns)

    // 4. Not in a strong downtrend (optional: check if choppy or ranging regime)
    const regime = features.pattern?.market_regime;
    console.log(`[mean-reversion-long] ${symbol}: market_regime=${regime}`);
    if (regime === "trending_down") {
      console.log(`[mean-reversion-long] ${symbol}: ❌ Trending down, skipping`);
      return false;
    }

    console.log(`[mean-reversion-long] ${symbol}: ✅ ALL CHECKS PASSED - SIGNAL DETECTED!`);
    return true;
  },

  scoreFactors: [
    {
      name: "rsi_extreme",
      weight: 0.35,
      evaluate: (features) => {
        const rsi = features.rsi?.["14"] || 50;

        // More oversold = higher score
        // RSI 30 = 60, RSI 25 = 80, RSI 20 = 100
        if (rsi <= 20) return 100;
        if (rsi <= 25) return 85;
        if (rsi <= 30) return 70;
        if (rsi <= 35) return 55;

        return Math.max(0, 100 - rsi * 2);
      },
    },
    {
      name: "vwap_deviation",
      weight: 0.3,
      evaluate: (features) => {
        const vwapDist = features.vwap?.distancePct || 0;

        // More stretched below VWAP = higher mean reversion potential
        // -0.5% = 60, -1.0% = 80, -1.5%+ = 100
        if (vwapDist <= -1.5) return 100;
        if (vwapDist <= -1.0) return 85;
        if (vwapDist <= -0.5) return 70;
        if (vwapDist <= -0.3) return 55;

        return Math.max(0, Math.abs(vwapDist) * 40);
      },
    },
    {
      name: "volume_profile",
      weight: 0.2,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // Higher volume on the dip = stronger reversal potential
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
        if (regime === "trending_up") return 60;
        if (regime === "trending_down") return 20; // Risky in downtrends

        return 50;
      },
    },
    {
      name: "reversal_confirmation",
      weight: 0.05,
      evaluate: (features) => {
        // Check for early reversal signs
        const hasPatientCandle = features.pattern?.patient_candle === true;
        const hasBullishDivergence = features.pattern?.rsi_bullish_divergence === true;

        let score = 50; // Base

        if (hasBullishDivergence) score += 30;
        if (hasPatientCandle) score += 20;

        return Math.min(100, score);
      },
    },
  ],
});
