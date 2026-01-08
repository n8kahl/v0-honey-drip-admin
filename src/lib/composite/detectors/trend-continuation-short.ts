import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Trend Continuation Short Detector
 *
 * Detects rallies in established downtrends, looking for continuation short entries.
 * Lower highs/lows pattern + EMA resistance + healthy RSI.
 *
 * Expected Frequency: 1-3 signals/day per symbol
 */
export const trendContinuationShortDetector: OpportunityDetector = createDetector({
  type: "trend_continuation_short",
  direction: "SHORT",
  assetClass: ["EQUITY_ETF", "STOCK"],
  requiresOptionsData: false,
  idealTimeframe: "15m",

  detect: (features: SymbolFeatures) => {
    // 1. In trending down regime
    const regime = features.pattern?.market_regime;
    if (regime !== "trending_down") return false;

    // 2. Price below key EMAs (21 and 50)
    const ema21 = features.ema?.["21"];
    const ema50 = features.ema?.["50"];
    const price = features.price.current;

    if (!ema21 || !ema50 || !price) return false;
    if (price > ema21 || price > ema50) return false;

    // 3. EMAs in bearish alignment (21 < 50)
    if (ema21 > ema50) return false;

    // 4. RSI in rally zone - OPTIMIZED: Tighter range for better quality entries
    const rsi = features.rsi?.["14"];
    if (!rsi || rsi < 40 || rsi > 55) return false; // WAS: 30-60, now 40-55 for rallies

    // 5. Price close to EMA21 resistance (within 1%) - OPTIMIZED: Adds timing
    const distToEMA21 = ((ema21 - price) / ema21) * 100;
    if (distToEMA21 > 1.0) return false; // Too far below - wait for rally to EMA

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

        // Price well below EMAs
        const belowEMA21Pct = ((ema21 - price) / ema21) * 100;
        if (belowEMA21Pct > 1.0) score += 20;
        else if (belowEMA21Pct > 0.5) score += 10;

        // EMA spacing (wider = stronger downtrend)
        const emaSpacing = ((ema50 - ema21) / ema50) * 100;
        if (emaSpacing > 2.0) score += 20;
        else if (emaSpacing > 1.0) score += 10;

        // Long-term trend confirmation
        if (ema200 && ema21 < ema200) score += 10;

        return Math.min(100, score);
      },
    },
    {
      name: "rally_quality",
      weight: 0.2, // Reduced from 0.25 to accommodate flow factor
      evaluate: (features) => {
        const rsi = features.rsi?.["14"] || 50;
        const vwapDist = features.vwap?.distancePct || 0;

        // Looking for weak rallies in downtrends (counter-trend bounces)
        // RSI 40-55 = ideal, VWAP slightly above = good short entry

        let score = 50;

        // RSI in rally zone (40-55 = ideal for shorts)
        if (rsi >= 40 && rsi <= 55) {
          score += 30;
        } else if (rsi >= 35 && rsi <= 60) {
          score += 15;
        }

        // Price near/at VWAP (good short entry on rally)
        if (vwapDist >= -0.5 && vwapDist <= 0.2) {
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

        // Moderate volume on rally = healthy for shorting
        // Too high = potential reversal, too low = weak
        // 0.8-1.5x = ideal
        if (rvol >= 0.8 && rvol <= 1.5) return 100;
        if (rvol >= 0.6 && rvol <= 2.0) return 75;
        if (rvol >= 0.5 && rvol <= 2.5) return 60;

        return 40; // Too extreme
      },
    },
    {
      name: "lower_highs_pattern",
      weight: 0.15,
      evaluate: (features) => {
        // Check for lower highs pattern
        const hasLowerHighs = features.pattern?.lower_highs === true;
        const nearSwingHigh = features.pattern?.near_swing_high === true;

        let score = 50;

        if (hasLowerHighs) score += 40;
        if (nearSwingHigh) score += 10; // Good short entry near resistance

        return Math.min(100, score);
      },
    },
    {
      name: "mtf_trend_strength",
      weight: 0.1,
      evaluate: (features) => {
        if (!features.mtf) return 50;

        // Check if higher timeframes confirm downtrend
        let confirmedCount = 0;
        let totalChecked = 0;

        const timeframes = ["15m", "60m"];

        for (const tf of timeframes) {
          const tfData = features.mtf[tf];
          if (tfData?.ema?.["21"] && tfData?.ema?.["50"]) {
            totalChecked++;
            // Check if 21 EMA < 50 EMA in higher TF
            if (tfData.ema["21"] < tfData.ema["50"]) {
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

        // Bearish flow aligns with short trend continuation
        if (flow.flowBias === "bearish") {
          score += 25;
          // Strong institutional activity = higher conviction
          if (flow.flowScore && flow.flowScore >= 70) score += 15;
          if (flow.sweepCount && flow.sweepCount >= 3) score += 10;
        } else if (flow.flowBias === "bullish") {
          // Bullish flow opposes short continuation
          score -= 20;
          if (flow.flowScore && flow.flowScore >= 70) score -= 15;
        }

        // Flow trend adds/subtracts confidence
        if (flow.flowTrend === "INCREASING" && flow.flowBias === "bearish") {
          score += 10; // Accelerating bearish flow
        } else if (flow.flowTrend === "DECREASING" && flow.flowBias === "bullish") {
          score += 5; // Weakening bullish flow = less opposition
        }

        return Math.max(0, Math.min(100, score));
      },
    },
  ],
});
