import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Index Mean Reversion Long Detector (SPX/NDX)
 *
 * Detects oversold bounces specific to indices with VWAP deviation.
 * Similar to equity mean reversion but tuned for index behavior.
 *
 * Expected Frequency: 3-5 signals/day
 */
export const indexMeanReversionLongDetector: OpportunityDetector = createDetector({
  type: "index_mean_reversion_long",
  direction: "LONG",
  assetClass: ["INDEX"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours or weekend mode)
    const shouldRun = shouldRunDetector(features);
    console.log(`[index-mean-reversion-long] ${symbol}: shouldRun=${shouldRun}`);
    if (!shouldRun) return false;

    // 2. RSI oversold - relaxed threshold for weekend analysis
    const rsi = features.rsi?.["14"];
    // CRITICAL FIX: Explicitly check for false (undefined should default to weekday, not weekend!)
    const isWeekend = features.session?.isRegularHours === false;
    const rsiThreshold = isWeekend ? 40 : 35; // More lenient on weekends
    console.log(
      `[index-mean-reversion-long] ${symbol}: RSI=${rsi}, threshold=${rsiThreshold}, isWeekend=${isWeekend}`
    );
    if (!rsi || rsi >= rsiThreshold) {
      console.log(`[index-mean-reversion-long] ${symbol}: ❌ RSI check failed`);
      return false;
    }

    // 3. Below VWAP (stretched) - relaxed for weekends, optional if data unavailable
    const vwapDist = features.vwap?.distancePct;
    const vwapThreshold = isWeekend ? -0.2 : -0.3; // Less strict on weekends
    console.log(
      `[index-mean-reversion-long] ${symbol}: VWAP dist=${vwapDist}, threshold=${vwapThreshold}`
    );

    // On weekends, VWAP data may be unavailable or return 0 (data quality issue)
    const hasValidVwap = vwapDist !== undefined && vwapDist !== null && vwapDist !== 0;

    if (!isWeekend) {
      // Regular hours: VWAP is required
      if (!hasValidVwap || vwapDist >= vwapThreshold) {
        console.log(`[index-mean-reversion-long] ${symbol}: ❌ VWAP check failed (regular hours)`);
        return false;
      }
    } else if (hasValidVwap) {
      // Weekend with valid VWAP data: apply lenient threshold
      if (vwapDist >= vwapThreshold) {
        console.log(
          `[index-mean-reversion-long] ${symbol}: ❌ VWAP check failed (weekend with data)`
        );
        return false;
      }
    } else {
      console.log(
        `[index-mean-reversion-long] ${symbol}: ⚠️ VWAP unavailable or invalid (${vwapDist}), skipping check`
      );
    }
    // Weekend without valid VWAP data: skip check entirely (rely on RSI + patterns)

    // 4. Market regime check - REVISED LOGIC
    // Previously blocked ALL downtrends, but that's when oversold bounces happen!
    // Now: Only block extreme downtrends (price far below EMAs) or require bounce confirmation
    const regime = features.pattern?.market_regime;
    const ema9 = features.ema?.["9"];
    const ema21 = features.ema?.["21"];
    const price = features.price?.current;

    console.log(`[index-mean-reversion-long] ${symbol}: market_regime=${regime}`);

    if (regime === "trending_down" && ema9 && ema21 && price) {
      // Calculate how far below the EMAs we are
      const distBelowEMA9 = ((ema9 - price) / ema9) * 100;
      const distBelowEMA21 = ((ema21 - price) / ema21) * 100;

      // Only skip if we're in a STRONG downtrend (>2% below both EMAs)
      // This catches falling knives while still allowing oversold bounces
      if (distBelowEMA9 > 2.0 && distBelowEMA21 > 2.0) {
        console.log(
          `[index-mean-reversion-long] ${symbol}: ❌ Strong downtrend (${distBelowEMA9.toFixed(1)}% below EMA9), skipping`
        );
        return false;
      }

      // In moderate downtrend: require more extreme oversold (RSI < 25)
      // This adds confirmation that the move is exhausted
      if (rsi > 25) {
        console.log(
          `[index-mean-reversion-long] ${symbol}: ❌ Moderate downtrend but RSI not extreme enough (${rsi.toFixed(1)} > 25)`
        );
        return false;
      }

      console.log(
        `[index-mean-reversion-long] ${symbol}: ⚠️ Downtrend but RSI extreme (${rsi.toFixed(1)}), allowing signal`
      );
    }

    console.log(`[index-mean-reversion-long] ${symbol}: ✅ ALL CHECKS PASSED - SIGNAL DETECTED!`);
    return true;
  },

  scoreFactors: [
    {
      name: "vwap_deviation_magnitude",
      weight: 0.3,
      evaluate: (features) => {
        const vwapDist = features.vwap?.distancePct || 0;

        // More stretched = higher reversion potential
        if (vwapDist <= -1.5) return 100;
        if (vwapDist <= -1.0) return 85;
        if (vwapDist <= -0.5) return 70;
        if (vwapDist <= -0.3) return 55;

        return Math.max(0, Math.abs(vwapDist) * 50);
      },
    },
    {
      name: "rsi_extreme",
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.["14"] || 50;

        if (rsi <= 20) return 100;
        if (rsi <= 25) return 85;
        if (rsi <= 30) return 70;
        if (rsi <= 35) return 55;

        return Math.max(0, 100 - rsi * 2);
      },
    },
    {
      name: "volume_profile",
      weight: 0.2,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // Higher volume on dip = stronger potential
        if (rvol >= 2.0) return 100;
        if (rvol >= 1.5) return 80;
        if (rvol >= 1.2) return 65;

        return Math.min(100, rvol * 50);
      },
    },
    {
      name: "market_regime_suitability",
      weight: 0.15,
      evaluate: (features) => {
        const regime = features.pattern?.market_regime;

        // Mean reversion works best in ranging/choppy
        if (regime === "ranging") return 100;
        if (regime === "choppy") return 90;
        if (regime === "volatile") return 70;
        if (regime === "trending_up") return 60;

        return 40;
      },
    },
    {
      name: "time_based_probability",
      weight: 0.1,
      evaluate: (features) => {
        const minutesSinceOpen = features.session?.minutesSinceOpen || 0;

        // Mean reversion typically stronger mid-day
        // 60-240 minutes (10 AM - 1 PM) = best
        if (minutesSinceOpen >= 60 && minutesSinceOpen <= 240) return 100;
        if (minutesSinceOpen >= 30 && minutesSinceOpen <= 300) return 80;

        return 60; // Still viable at other times
      },
    },
  ],
});
