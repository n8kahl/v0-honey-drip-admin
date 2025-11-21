import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector } from '../OpportunityDetector.js';

/**
 * Breakout Bearish Detector
 *
 * Detects high-volume breakdowns below consolidation or support levels
 * with strong bearish momentum and flow alignment.
 *
 * Expected Frequency: 2-4 signals/day per symbol
 */
export const breakoutBearishDetector: OpportunityDetector = createDetector({
  type: 'breakout_bearish',
  direction: 'SHORT',
  assetClass: ['EQUITY_ETF', 'STOCK'],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. Must have pattern data
    if (!features.pattern) return false;

    // 2. Breakdown detected
    const hasBreakdown = features.pattern.breakout_bearish === true;
    if (!hasBreakdown) return false;

    // 3. Volume surge (>1.5x average)
    const hasVolumeSpike = features.volume?.relativeToAvg && features.volume.relativeToAvg > 1.5;
    if (!hasVolumeSpike) return false;

    // 4. Price below VWAP
    const belowVWAP = features.vwap?.distancePct && features.vwap.distancePct < 0;
    if (!belowVWAP) return false;

    // 5. During regular hours
    const regularHours = features.session?.isRegularHours === true;
    if (!regularHours) return false;

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

        // Strong bearish flow
        if (flowBias === 'bearish' && flowScore > 70) return 100;
        if (flowBias === 'bearish' && flowScore > 60) return 85;

        // Sweep activity (bearish sweeps)
        if (sweepCount > 3) return 90;
        if (sweepCount > 0) return 70;

        // Neutral or weak
        if (flowBias === 'neutral') return 60;
        if (flowBias === 'bullish') return 30; // Bullish flow on bearish breakdown = poor

        return 50;
      }
    },
    {
      name: 'vwap_weakness',
      weight: 0.20,
      evaluate: (features) => {
        const vwapDist = features.vwap?.distancePct || 0;

        // Below VWAP with momentum
        // -0.5% = 70, -1.0% = 85, -1.5%+ = 100
        if (vwapDist <= -1.5) return 100;
        if (vwapDist <= -1.0) return 85;
        if (vwapDist <= -0.5) return 70;
        if (vwapDist <= -0.2) return 60;
        if (vwapDist <= 0) return 50;

        return 0; // Above VWAP = poor for shorts
      }
    },
    {
      name: 'breakdown_strength',
      weight: 0.15,
      evaluate: (features) => {
        // Check if price is breaking key levels
        const nearORB = features.pattern?.near_orb_low === true;
        const nearSwingLow = features.pattern?.near_swing_low === true;
        const breakingSupport = features.pattern?.breaking_support === true;

        let score = 50; // Base score

        if (breakingSupport) score += 30;
        if (nearORB) score += 10;
        if (nearSwingLow) score += 10;

        return Math.min(100, score);
      }
    },
    {
      name: 'mtf_alignment',
      weight: 0.10,
      evaluate: (features) => {
        if (!features.mtf) return 50;

        // Check if multiple timeframes are aligned bearish
        let alignedCount = 0;
        let totalChecked = 0;

        // Check 5m, 15m, 60m RSI
        const timeframes = ['5m', '15m', '60m'];

        for (const tf of timeframes) {
          const tfData = features.mtf[tf];
          if (tfData?.rsi?.['14']) {
            totalChecked++;
            const rsi = tfData.rsi['14'];
            // RSI 30-50 = bearish but not oversold
            if (rsi >= 30 && rsi <= 50) {
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
