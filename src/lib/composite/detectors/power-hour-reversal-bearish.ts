import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector } from '../OpportunityDetector.js';

/**
 * Power Hour Reversal Bearish Detector (SPX/NDX)
 *
 * Detects bearish reversals during power hour (3:00-4:00 PM ET).
 * Price at day highs + approaching close + institutional flow.
 *
 * Expected Frequency: 1-2 signals/day
 */
export const powerHourReversalBearishDetector: OpportunityDetector = createDetector({
  type: 'power_hour_reversal_bearish',
  direction: 'SHORT',
  assetClass: ['INDEX'],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. Power hour (3:00-4:00 PM = 330-390 minutes since open)
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 330 || minutesSinceOpen > 390) return false;

    // 2. Price near day's high (within 0.5% of high)
    const price = features.price.current;
    const dayHigh = features.price.high;
    if (!dayHigh || ((dayHigh - price) / dayHigh) > 0.005) return false;

    // 3. RSI showing overbought
    const rsi = features.rsi?.['14'];
    if (!rsi || rsi < 60) return false;

    // 4. Volume confirmation
    const rvol = features.volume?.relativeToAvg || 1.0;
    if (rvol < 1.2) return false;

    return true;
  },

  scoreFactors: [
    {
      name: 'extreme_proximity',
      weight: 0.25,
      evaluate: (features) => {
        const price = features.price.current;
        const dayLow = features.price.low || price;
        const dayHigh = features.price.high || price;
        const dayRange = dayHigh - dayLow;

        if (dayRange === 0) return 50;

        // How close to day's high (90-100% of range = best)
        const distanceFromLow = price - dayLow;
        const pctOfRange = (distanceFromLow / dayRange) * 100;

        if (pctOfRange >= 95) return 100;
        if (pctOfRange >= 90) return 85;
        if (pctOfRange >= 80) return 70;

        return Math.max(0, pctOfRange - 50);
      }
    },
    {
      name: 'power_hour_timing',
      weight: 0.20,
      evaluate: (features) => {
        const minutesSinceOpen = features.session?.minutesSinceOpen || 0;

        // Last 30 minutes = highest score
        if (minutesSinceOpen >= 360) return 100;
        if (minutesSinceOpen >= 345) return 85;
        if (minutesSinceOpen >= 330) return 70;

        return 50;
      }
    },
    {
      name: 'reversal_confirmation',
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.['14'] || 50;

        // More overbought = stronger reversal potential
        if (rsi >= 75) return 100;
        if (rsi >= 70) return 85;
        if (rsi >= 65) return 70;
        if (rsi >= 60) return 55;

        return 40;
      }
    },
    {
      name: 'institutional_flow',
      weight: 0.20,
      evaluate: (features) => {
        if (!features.flow) return 50;

        const { flowBias = 'neutral', blockCount = 0, sweepCount = 0 } = features.flow;

        // Institutional selling
        let score = 50;

        if (flowBias === 'bearish') score += 30;
        if (blockCount > 2) score += 10;
        if (sweepCount > 2) score += 10;

        return Math.min(100, score);
      }
    },
    {
      name: 'day_range_position',
      weight: 0.10,
      evaluate: (features) => {
        const price = features.price.current;
        const dayOpen = features.price.open || price;

        // Better score if we're above open (buying pressure exhausted)
        if (price > dayOpen) {
          const gainPct = ((price - dayOpen) / dayOpen) * 100;
          return Math.min(100, 40 + (gainPct * 40));
        }

        return 50;
      }
    }
  ]
});
