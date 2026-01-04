import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Trend Continuation Long Detector
 *
 * Detects pullbacks in established uptrends, looking for continuation entries.
 * Higher highs/lows pattern + EMA support + healthy RSI.
 *
 * Expected Frequency: 1-3 signals/day per symbol
 */
export const trendContinuationLongDetector: OpportunityDetector = createDetector({
  type: "trend_continuation_long",
  direction: "LONG",
  assetClass: ["EQUITY_ETF", "STOCK"],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. In trending up regime
    const regime = features.pattern?.market_regime;
    if (regime !== "trending_up") return false;

    // 2. Price above key EMAs (21 and 50)
    const ema21 = features.ema?.["21"];
    const ema50 = features.ema?.["50"];
    const ema200 = features.ema?.["200"];
    const price = features.price.current;

    if (!ema21 || !ema50 || !price) return false;
    if (price < ema21 || price < ema50) return false;

    // 3. EMAs in bullish alignment (21 > 50)
    if (ema21 < ema50) return false;

    // PHASE 1 OPTIMIZATION: EMA 200 filter for long-term trend confirmation
    // Only take continuation trades in confirmed long-term uptrends
    if (ema200 && price < ema200) return false; // Must be above EMA 200

    // 4. RSI in pullback zone - OPTIMIZED: Tighter range for better quality entries
    const rsi = features.rsi?.["14"];
    if (!rsi || rsi < 45 || rsi > 60) return false; // WAS: 40-70, now 45-60 for pullbacks

    // 5. Price close to EMA21 support (within 1%) - OPTIMIZED: Adds timing
    const distToEMA21 = ((price - ema21) / ema21) * 100;
    if (distToEMA21 > 1.0) return false; // Too far above - wait for pullback to EMA

    // PHASE 2 OPTIMIZATION: ATR-based filter (replaces Bollinger Bands)
    // Avoid entries when price is overextended above EMA21
    // ATR adapts to volatility better than fixed BB bands
    const atr = features.atr;
    if (atr && atr > 0) {
      const deviationAboveEMA21 = (price - ema21) / atr;
      if (deviationAboveEMA21 > 2.0) {
        // Price stretched >2 ATR above EMA21 = overextended, wait for pullback
        return false;
      }
    }

    // 6. Volume confirmation - OPTIMIZED: Require minimum volume activity
    const relativeVolume = features.volume?.relativeToAvg ?? 1;
    if (relativeVolume < 0.8) return false; // Skip low volume setups

    // 7. Check if detector should run (market hours or weekend mode)
    if (!shouldRunDetector(features)) return false;

    return true;
  },

  scoreFactors: [
    {
      name: "ema_alignment",
      weight: 0.25, // Reduced from 0.30 to accommodate flow factor
      evaluate: (features) => {
        const ema21 = features.ema?.["21"];
        const ema50 = features.ema?.["50"];
        const ema200 = features.ema?.["200"];
        const price = features.price.current;

        if (!ema21 || !ema50 || !price) return 50;

        let score = 50;

        // Price well above EMAs
        const aboveEMA21Pct = ((price - ema21) / ema21) * 100;
        if (aboveEMA21Pct > 1.0) score += 20;
        else if (aboveEMA21Pct > 0.5) score += 10;

        // EMA spacing (wider = stronger trend)
        const emaSpacing = ((ema21 - ema50) / ema50) * 100;
        if (emaSpacing > 2.0) score += 20;
        else if (emaSpacing > 1.0) score += 10;

        // Long-term trend confirmation
        if (ema200 && ema21 > ema200) score += 10;

        return Math.min(100, score);
      },
    },
    {
      name: "pullback_quality",
      weight: 0.2, // Reduced from 0.25 to accommodate flow factor
      evaluate: (features) => {
        const rsi = features.rsi?.["14"] || 50;
        const vwapDist = features.vwap?.distancePct || 0;

        // Looking for healthy pullbacks, not deep corrections
        // RSI 45-55 = ideal, VWAP slightly below = good entry

        let score = 50;

        // RSI in pullback zone (45-60 = ideal)
        if (rsi >= 45 && rsi <= 60) {
          score += 30;
        } else if (rsi >= 40 && rsi <= 65) {
          score += 15;
        }

        // Price near/at VWAP (good entry on pullback)
        if (vwapDist >= -0.2 && vwapDist <= 0.5) {
          score += 20;
        }

        return Math.min(100, score);
      },
    },
    {
      name: "volume_confirmation",
      weight: 0.15, // Reduced from 0.20 to accommodate flow factor
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // Moderate volume on pullback = healthy
        // Too high = distribution, too low = weak
        // 0.8-1.5x = ideal
        if (rvol >= 0.8 && rvol <= 1.5) return 100;
        if (rvol >= 0.6 && rvol <= 2.0) return 75;
        if (rvol >= 0.5 && rvol <= 2.5) return 60;

        return 40; // Too extreme
      },
    },
    {
      name: "higher_lows_pattern",
      weight: 0.15,
      evaluate: (features) => {
        // Check for higher lows pattern
        const hasHigherLows = features.pattern?.higher_lows === true;
        const nearSwingLow = features.pattern?.near_swing_low === true;

        let score = 50;

        if (hasHigherLows) score += 40;
        if (nearSwingLow) score += 10; // Good entry near support

        return Math.min(100, score);
      },
    },
    {
      name: "mtf_trend_strength",
      weight: 0.1,
      evaluate: (features) => {
        if (!features.mtf) return 50;

        // Check if higher timeframes confirm uptrend
        let confirmedCount = 0;
        let totalChecked = 0;

        const timeframes = ["15m", "60m"];

        for (const tf of timeframes) {
          const tfData = features.mtf[tf];
          if (tfData?.ema?.["21"] && tfData?.ema?.["50"]) {
            totalChecked++;
            // Check if 21 EMA > 50 EMA in higher TF
            if (tfData.ema["21"] > tfData.ema["50"]) {
              confirmedCount++;
            }
          }
        }

        if (totalChecked === 0) return 50;

        const confirmationPct = (confirmedCount / totalChecked) * 100;
        return confirmationPct;
      },
    },
    {
      // Phase 4: Flow alignment factor for trend continuation
      name: "flow_alignment",
      weight: 0.15,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 50; // Neutral if no flow data

        let score = 50;

        // Bullish flow aligns with long trend continuation
        if (flow.flowBias === "bullish") {
          score += 25;
          // Strong institutional activity = higher conviction
          if (flow.flowScore && flow.flowScore >= 70) score += 15;
          if (flow.sweepCount && flow.sweepCount >= 3) score += 10;
        } else if (flow.flowBias === "bearish") {
          // Bearish flow opposes long continuation
          score -= 20;
          if (flow.flowScore && flow.flowScore >= 70) score -= 15;
        }

        // Flow trend adds/subtracts confidence
        if (flow.flowTrend === "INCREASING" && flow.flowBias === "bullish") {
          score += 10; // Accelerating bullish flow
        } else if (flow.flowTrend === "DECREASING" && flow.flowBias === "bearish") {
          score += 5; // Weakening bearish flow = less opposition
        }

        return Math.max(0, Math.min(100, score));
      },
    },
  ],
});
