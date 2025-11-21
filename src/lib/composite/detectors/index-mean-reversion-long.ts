import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector } from '../OpportunityDetector.js';

/**
 * Index Mean Reversion Long Detector (SPX/NDX)
 *
 * Detects oversold bounces specific to indices with VWAP deviation.
 * Similar to equity mean reversion but tuned for index behavior.
 *
 * Expected Frequency: 3-5 signals/day
 */
export const indexMeanReversionLongDetector: OpportunityDetector = createDetector({
  type: 'index_mean_reversion_long',
  direction: 'LONG',
  assetClass: ['INDEX'],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. RSI oversold (< 35)
    const rsi = features.rsi?.['14'];
    if (!rsi || rsi >= 35) return false;

    // 2. Below VWAP (stretched)
    const vwapDist = features.vwap?.distancePct;
    if (!vwapDist || vwapDist >= -0.3) return false;

    // 3. During regular hours
    if (!features.session?.isRegularHours) return false;

    // 4. Not in extreme downtrend
    const regime = features.pattern?.market_regime;
    if (regime === 'trending_down') return false;

    return true;
  },

  scoreFactors: [
    {
      name: 'vwap_deviation_magnitude',
      weight: 0.30,
      evaluate: (features) => {
        const vwapDist = features.vwap?.distancePct || 0;

        // More stretched = higher reversion potential
        if (vwapDist <= -1.5) return 100;
        if (vwapDist <= -1.0) return 85;
        if (vwapDist <= -0.5) return 70;
        if (vwapDist <= -0.3) return 55;

        return Math.max(0, Math.abs(vwapDist) * 50);
      }
    },
    {
      name: 'rsi_extreme',
      weight: 0.25,
      evaluate: (features) => {
        const rsi = features.rsi?.['14'] || 50;

        if (rsi <= 20) return 100;
        if (rsi <= 25) return 85;
        if (rsi <= 30) return 70;
        if (rsi <= 35) return 55;

        return Math.max(0, 100 - (rsi * 2));
      }
    },
    {
      name: 'volume_profile',
      weight: 0.20,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // Higher volume on dip = stronger potential
        if (rvol >= 2.0) return 100;
        if (rvol >= 1.5) return 80;
        if (rvol >= 1.2) return 65;

        return Math.min(100, rvol * 50);
      }
    },
    {
      name: 'market_regime_suitability',
      weight: 0.15,
      evaluate: (features) => {
        const regime = features.pattern?.market_regime;

        // Mean reversion works best in ranging/choppy
        if (regime === 'ranging') return 100;
        if (regime === 'choppy') return 90;
        if (regime === 'volatile') return 70;
        if (regime === 'trending_up') return 60;

        return 40;
      }
    },
    {
      name: 'time_based_probability',
      weight: 0.10,
      evaluate: (features) => {
        const minutesSinceOpen = features.session?.minutesSinceOpen || 0;

        // Mean reversion typically stronger mid-day
        // 60-240 minutes (10 AM - 1 PM) = best
        if (minutesSinceOpen >= 60 && minutesSinceOpen <= 240) return 100;
        if (minutesSinceOpen >= 30 && minutesSinceOpen <= 300) return 80;

        return 60; // Still viable at other times
      }
    }
  ]
});
