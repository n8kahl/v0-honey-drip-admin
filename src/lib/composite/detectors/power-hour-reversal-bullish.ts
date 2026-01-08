import type { SymbolFeatures } from "../../strategy/engine.js";
import {
  createDetector,
  type OpportunityDetector,
  type OptionsChainData,
} from "../OpportunityDetector.js";

/**
 * Power Hour Reversal Bullish Detector (SPX/NDX)
 *
 * Detects bullish reversals during power hour (3:00-4:00 PM ET).
 * Price at day lows + approaching close + institutional flow.
 *
 * Expected Frequency: 1-2 signals/day
 */
export const powerHourReversalBullishDetector: OpportunityDetector = createDetector({
  type: "power_hour_reversal_bullish",
  direction: "LONG",
  assetClass: ["INDEX"],
  requiresOptionsData: false,
  idealTimeframe: "5m",

  detect: (features: SymbolFeatures) => {
    // 1. Power hour (3:00-4:00 PM = 330-390 minutes since open)
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 330 || minutesSinceOpen > 390) return false;

    // 2. Price near day's low (within 0.5% of low)
    const price = features.price.current;
    const dayLow = features.price.low;
    if (!dayLow || (price - dayLow) / dayLow > 0.005) return false;

    // 3. RSI showing oversold
    const rsi = features.rsi?.["14"];
    if (!rsi || rsi > 40) return false;

    // 4. Volume confirmation
    const rvol = features.volume?.relativeToAvg || 1.0;
    if (rvol < 1.2) return false;

    return true;
  },

  scoreFactors: [
    {
      name: "extreme_proximity",
      weight: 0.25,
      evaluate: (features) => {
        const price = features.price.current;
        const dayLow = features.price.low || price;
        const dayHigh = features.price.high || price;
        const dayRange = dayHigh - dayLow;

        if (dayRange === 0) return 50;

        // How close to day's low (0-10% of range = best)
        const distanceFromLow = price - dayLow;
        const pctOfRange = (distanceFromLow / dayRange) * 100;

        if (pctOfRange <= 5) return 100;
        if (pctOfRange <= 10) return 85;
        if (pctOfRange <= 20) return 70;

        return Math.max(0, 100 - pctOfRange * 3);
      },
    },
    {
      name: "power_hour_timing",
      weight: 0.2,
      evaluate: (features) => {
        const minutesSinceOpen = features.session?.minutesSinceOpen || 0;

        // Last 30 minutes = highest score (institutional closing flows)
        if (minutesSinceOpen >= 360) return 100; // 3:30-4:00
        if (minutesSinceOpen >= 345) return 85; // 3:15-3:30
        if (minutesSinceOpen >= 330) return 70; // 3:00-3:15

        return 50;
      },
    },
    {
      name: "reversal_confirmation",
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.["14"] || 50;

        // More oversold = stronger reversal potential
        if (rsi <= 25) return 100;
        if (rsi <= 30) return 85;
        if (rsi <= 35) return 70;
        if (rsi <= 40) return 55;

        return 40;
      },
    },
    {
      name: "institutional_flow",
      weight: 0.2,
      evaluate: (features) => {
        if (!features.flow) return 50;

        const { flowBias = "neutral", blockCount = 0, sweepCount = 0 } = features.flow;

        // Institutional buying (blocks/sweeps)
        let score = 50;

        if (flowBias === "bullish") score += 30;
        if (blockCount > 2) score += 10;
        if (sweepCount > 2) score += 10;

        return Math.min(100, score);
      },
    },
    {
      name: "day_range_position",
      weight: 0.1,
      evaluate: (features) => {
        const price = features.price.current;
        const dayOpen = features.price.open || price;
        const dayLow = features.price.low || price;

        // Better score if we're below open (selling pressure exhausted)
        if (price < dayOpen) {
          const dropPct = ((dayOpen - price) / dayOpen) * 100;
          // 0.5% drop = 70, 1.0% drop = 85, 1.5%+ = 100
          return Math.min(100, 40 + dropPct * 40);
        }

        return 50;
      },
    },
  ],
});
