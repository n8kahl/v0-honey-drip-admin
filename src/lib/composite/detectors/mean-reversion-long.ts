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
  idealTimeframe: "15m",

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours or weekend mode)
    const shouldRun = shouldRunDetector(features);
    console.log(`[mean-reversion-long] ${symbol}: shouldRun=${shouldRun}`);
    if (!shouldRun) return false;

    // 2. RSI oversold - OPTIMIZED: Tighter thresholds for higher quality signals
    const rsi = features.rsi?.["14"];
    // CRITICAL FIX: Explicitly check for false (undefined should default to weekday, not weekend!)
    const isWeekend = features.session?.isRegularHours === false;
    // OPTIMIZED: Require more extreme oversold (was 40/35, now 35/30)
    const rsiThreshold = isWeekend ? 35 : 30;
    console.log(
      `[mean-reversion-long] ${symbol}: RSI=${rsi}, threshold=${rsiThreshold}, isWeekend=${isWeekend}`
    );
    if (!rsi || rsi >= rsiThreshold) {
      console.log(`[mean-reversion-long] ${symbol}: ❌ RSI check failed`);
      return false;
    }

    // 3. Below VWAP (stretched) - OPTIMIZED: Require more stretched for quality
    const vwapDist = features.vwap?.distancePct;
    // OPTIMIZED: Increased deviation requirement (was -0.2/-0.3, now -0.3/-0.5)
    const vwapThreshold = isWeekend ? -0.3 : -0.5;
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

    // PHASE 2 OPTIMIZATION: ATR-based entry filter (replaces Bollinger Bands)
    // ATR adapts to volatility and includes overnight gaps - better than fixed BB bands
    const atr = features.atr;
    const ema21 = features.ema?.["21"];
    const price = features.price?.current;
    if (atr && ema21 && price && atr > 0) {
      // Price must be stretched at least 2.0 ATR below EMA21 for mean reversion
      // TIGHTENED: Was 1.5, increased to 2.0 to filter more low-quality signals
      const deviationInATR = (ema21 - price) / atr;
      if (deviationInATR < 2.0) {
        console.log(
          `[mean-reversion-long] ${symbol}: ❌ Price not stretched enough (${deviationInATR.toFixed(2)} ATR below EMA21, need 2.0+)`
        );
        return false;
      }
      console.log(
        `[mean-reversion-long] ${symbol}: ✓ Price stretched ${deviationInATR.toFixed(2)} ATR below EMA21`
      );
    }

    // 4. Market regime check - REVISED LOGIC
    // Previously blocked ALL downtrends, but that's when oversold bounces happen!
    // Now: Only block extreme downtrends (price far below EMAs) or require bounce confirmation
    const regime = features.pattern?.market_regime;
    const ema9 = features.ema?.["9"];
    // ema21 and price already declared above in ATR section

    console.log(`[mean-reversion-long] ${symbol}: market_regime=${regime}`);

    if (regime === "trending_down" && ema9 && ema21 && price) {
      // Calculate how far below the EMAs we are
      const distBelowEMA9 = ((ema9 - price) / ema9) * 100;
      const distBelowEMA21 = ((ema21 - price) / ema21) * 100;

      // OPTIMIZED: Only skip if we're in a VERY STRONG downtrend (>3% below both EMAs)
      // Was 2% - now allows more oversold bounce opportunities
      // Also check that RSI isn't extremely oversold (< 20) - those can still bounce
      if (distBelowEMA9 > 3.0 && distBelowEMA21 > 3.0 && rsi > 20) {
        console.log(
          `[mean-reversion-long] ${symbol}: ❌ Very strong downtrend (${distBelowEMA9.toFixed(1)}% below EMA9), skipping`
        );
        return false;
      }

      // OPTIMIZED: In moderate downtrend, require extreme oversold (RSI < 20, was 25)
      // This allows more signals while still requiring quality confirmation
      if (rsi > 20) {
        console.log(
          `[mean-reversion-long] ${symbol}: ❌ Moderate downtrend but RSI not extreme enough (${rsi.toFixed(1)} > 20)`
        );
        return false;
      }

      console.log(
        `[mean-reversion-long] ${symbol}: ⚠️ Downtrend but RSI extreme (${rsi.toFixed(1)}), allowing signal`
      );
    }

    // PHASE 3: Flow confirmation (don't fight smart money)
    // If institutional flow shows heavy bearish activity, skip the signal
    const flow = features.flow;
    if (flow && flow.flowBias === "bearish" && flow.blockCount > 2) {
      console.log(
        `[mean-reversion-long] ${symbol}: ❌ Blocked by institutional selling ` +
          `(${flow.blockCount} blocks, ${flow.flowBias} bias)`
      );
      return false;
    }

    // If flow shows heavy bearish sweeps, also skip
    if (flow && flow.flowBias === "bearish" && flow.sweepCount >= 3 && flow.flowScore >= 70) {
      console.log(
        `[mean-reversion-long] ${symbol}: ❌ Blocked by bearish sweeps ` +
          `(${flow.sweepCount} sweeps, ${flow.flowScore} flow score)`
      );
      return false;
    }

    console.log(`[mean-reversion-long] ${symbol}: ✅ ALL CHECKS PASSED - SIGNAL DETECTED!`);
    return true;
  },

  scoreFactors: [
    {
      name: "rsi_extreme",
      weight: 0.2, // Reduced from 0.35 to make room for new factors
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
      weight: 0.15, // Reduced from 0.3
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
      // PHASE 2: ATR-normalized deviation scoring
      name: "atr_deviation",
      weight: 0.15,
      evaluate: (features) => {
        const atr = features.atr;
        const ema21 = features.ema?.["21"];
        const price = features.price?.current;

        if (!atr || !ema21 || !price || atr === 0) return 50;

        // How far price is below EMA21 in ATR units
        const deviationInATR = (ema21 - price) / atr;

        // 3+ ATR = 100, 2.5 ATR = 90, 2 ATR = 80, 1.5 ATR = 70
        if (deviationInATR >= 3.0) return 100;
        if (deviationInATR >= 2.5) return 90;
        if (deviationInATR >= 2.0) return 80;
        if (deviationInATR >= 1.5) return 70;
        if (deviationInATR >= 1.0) return 55;

        return 40; // Not stretched enough
      },
    },
    {
      name: "volume_profile",
      weight: 0.1, // Reduced from 0.2
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
      // PHASE 2: RSI divergence confirmation (bullish divergence = reversal signal)
      name: "divergence_confirmation",
      weight: 0.15,
      evaluate: (features) => {
        const div = features.divergence;

        if (!div || div.type !== "bullish") return 50;

        // Use confidence score from divergence detection
        // Confidence 70 = score 85, confidence 90 = score 95
        return Math.min(100, 50 + div.confidence * 0.5);
      },
    },
    {
      // PHASE 2: RSI momentum (turning up from oversold = better entry)
      name: "rsi_momentum",
      weight: 0.1,
      evaluate: (features) => {
        const currentRSI = features.rsi?.["14"];
        const prevRSI = features.prev?.rsi?.["14"];

        if (!currentRSI || !prevRSI) return 50;

        const rsiDelta = currentRSI - prevRSI;

        // Oversold AND momentum turning up = great entry
        if (currentRSI < 35 && rsiDelta > 0) {
          return 90; // Strong buy signal
        }
        // Oversold but still falling = wait
        if (currentRSI < 30 && rsiDelta <= 0) {
          return 40; // Penalize falling knife
        }
        // Scale by momentum
        return Math.min(100, Math.max(0, 50 + rsiDelta * 5));
      },
    },
    {
      name: "reversal_confirmation",
      weight: 0.05,
      evaluate: (features) => {
        // Check for early reversal signs
        const hasPatientCandle = features.pattern?.patient_candle === true;

        let score = 50; // Base

        if (hasPatientCandle) score += 30;

        return Math.min(100, score);
      },
    },
  ],
});
