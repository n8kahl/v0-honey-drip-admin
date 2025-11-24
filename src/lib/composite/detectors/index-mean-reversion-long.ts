import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector } from '../OpportunityDetector.js';
import { shouldRunDetector } from './utils.js';

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
    const symbol = (features as any).symbol || 'UNKNOWN';

    // 1. Check if detector should run (market hours or weekend mode)
    const shouldRun = shouldRunDetector(features);
    console.log(`[index-mean-reversion-long] ${symbol}: shouldRun=${shouldRun}`);
    if (!shouldRun) return false;

    // 2. RSI oversold - relaxed threshold for weekend analysis
    const rsi = features.rsi?.['14'];
    const isWeekend = features.session?.isRegularHours !== true;
    const rsiThreshold = isWeekend ? 40 : 35; // More lenient on weekends
    console.log(`[index-mean-reversion-long] ${symbol}: RSI=${rsi}, threshold=${rsiThreshold}, isWeekend=${isWeekend}`);
    if (!rsi || rsi >= rsiThreshold) {
      console.log(`[index-mean-reversion-long] ${symbol}: ❌ RSI check failed`);
      return false;
    }

    // 3. Below VWAP (stretched) - relaxed for weekends, optional if data unavailable
    const vwapDist = features.vwap?.distancePct;
    const vwapThreshold = isWeekend ? -0.2 : -0.3; // Less strict on weekends
    console.log(`[index-mean-reversion-long] ${symbol}: VWAP dist=${vwapDist}, threshold=${vwapThreshold}`);

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
        console.log(`[index-mean-reversion-long] ${symbol}: ❌ VWAP check failed (weekend with data)`);
        return false;
      }
    } else {
      console.log(`[index-mean-reversion-long] ${symbol}: ⚠️ VWAP unavailable or invalid (${vwapDist}), skipping check`);
    }
    // Weekend without valid VWAP data: skip check entirely (rely on RSI + patterns)

    // 4. Not in extreme downtrend
    const regime = features.pattern?.market_regime;
    console.log(`[index-mean-reversion-long] ${symbol}: market_regime=${regime}`);
    if (regime === 'trending_down') {
      console.log(`[index-mean-reversion-long] ${symbol}: ❌ Trending down, skipping`);
      return false;
    }

    console.log(`[index-mean-reversion-long] ${symbol}: ✅ ALL CHECKS PASSED - SIGNAL DETECTED!`);
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
