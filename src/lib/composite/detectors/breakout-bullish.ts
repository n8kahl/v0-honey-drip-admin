import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector } from '../OpportunityDetector.js';
import { shouldRunDetector } from './utils.js';

/**
 * Breakout Bullish Detector
 *
 * Detects high-volume breakouts above consolidation or resistance levels
 * with strong momentum and flow alignment.
 *
 * Expected Frequency: 2-4 signals/day per symbol
 */
export const breakoutBullishDetector: OpportunityDetector = createDetector({
  type: 'breakout_bullish',
  direction: 'LONG',
  assetClass: ['EQUITY_ETF', 'STOCK'],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. Must have pattern data
    if (!features.pattern) return false;

    // 2. Breakout detected
    const hasBreakout = features.pattern.breakout_bullish === true;
    if (!hasBreakout) return false;

    // 3. Volume surge (>1.5x average)
    const hasVolumeSpike = features.volume?.relativeToAvg && features.volume.relativeToAvg > 1.5;
    if (!hasVolumeSpike) return false;

    // 4. Price above VWAP
    const aboveVWAP = features.vwap?.distancePct && features.vwap.distancePct > 0;
    if (!aboveVWAP) return false;

    // 5. Check if detector should run (market hours or weekend mode)
    if (!shouldRunDetector(features)) return false;

    return true;
  },

  scoreFactors: [
    {
      name: 'volume_intensity',
      weight: 0.30,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;
        // 1.5x = 50, 2.5x = 75, 4.0x+ = 100
        if (rvol >= 4.0) return 100;
        if (rvol >= 2.5) return 75;
        if (rvol >= 1.5) return 50;
        return Math.min(100, (rvol - 1.0) * 33);
      }
    },
    {
      name: 'flow_alignment',
      weight: 0.25,
      evaluate: (features) => {
        if (!features.flow) return 50; // Neutral if no flow data

        const { flowScore = 50, flowBias = 'neutral', sweepCount = 0 } = features.flow;

        // Strong bullish flow
        if (flowBias === 'bullish' && flowScore > 70) return 100;
        if (flowBias === 'bullish' && flowScore > 60) return 85;

        // Sweep activity
        if (sweepCount > 3) return 90;
        if (sweepCount > 0) return 70;

        // Neutral or weak
        if (flowBias === 'neutral') return 60;
        if (flowBias === 'bearish') return 30; // Bearish flow on bullish breakout = poor

        return 50;
      }
    },
    {
      name: 'vwap_strength',
      weight: 0.20,
      evaluate: (features) => {
        const vwapDist = features.vwap?.distancePct || 0;

        // Above VWAP with momentum
        // +0.5% = 70, +1.0% = 85, +1.5%+ = 100
        if (vwapDist >= 1.5) return 100;
        if (vwapDist >= 1.0) return 85;
        if (vwapDist >= 0.5) return 70;
        if (vwapDist >= 0.2) return 60;
        if (vwapDist >= 0) return 50;

        return 0; // Below VWAP = poor
      }
    },
    {
      name: 'breakout_strength',
      weight: 0.15,
      evaluate: (features) => {
        // Check if price is breaking key levels
        const nearORB = features.pattern?.near_orb_high === true;
        const nearSwingHigh = features.pattern?.near_swing_high === true;
        const breakingResistance = features.pattern?.breaking_resistance === true;

        let score = 50; // Base score

        if (breakingResistance) score += 30;
        if (nearORB) score += 10;
        if (nearSwingHigh) score += 10;

        return Math.min(100, score);
      }
    },
    {
      name: 'mtf_alignment',
      weight: 0.10,
      evaluate: (features) => {
        if (!features.mtf) return 50;

        // Check if multiple timeframes are aligned bullish
        let alignedCount = 0;
        let totalChecked = 0;

        // Check 5m, 15m, 60m RSI
        const timeframes = ['5m', '15m', '60m'];

        for (const tf of timeframes) {
          const tfData = features.mtf[tf];
          if (tfData?.rsi?.['14']) {
            totalChecked++;
            const rsi = tfData.rsi['14'];
            // RSI 50-70 = bullish but not overbought
            if (rsi >= 50 && rsi <= 70) {
              alignedCount++;
            }
          }
        }

        if (totalChecked === 0) return 50;

        const alignmentPct = (alignedCount / totalChecked) * 100;
        return alignmentPct;
      }
    }
  ]
});
