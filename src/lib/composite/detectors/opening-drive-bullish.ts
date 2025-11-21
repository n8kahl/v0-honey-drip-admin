import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector } from '../OpportunityDetector.js';

/**
 * Opening Drive Bullish Detector (SPX/NDX)
 *
 * Detects strong bullish momentum in first 30 minutes.
 * Large gap up + continuing momentum + volume.
 *
 * Expected Frequency: 1-2 signals/day
 */
export const openingDriveBullishDetector: OpportunityDetector = createDetector({
  type: 'opening_drive_bullish',
  direction: 'LONG',
  assetClass: ['INDEX'],
  requiresOptionsData: false,

  detect: (features: SymbolFeatures) => {
    // 1. First 30 minutes (0-30 minutes since open)
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 0 || minutesSinceOpen > 30) return false;

    // 2. Strong move from open
    const price = features.price.current;
    const dayOpen = features.price.open;
    if (!dayOpen) return false;

    const moveFromOpen = (price - dayOpen) / dayOpen;
    if (moveFromOpen < 0.003) return false; // Must be up at least 0.3%

    // 3. Volume confirmation
    const rvol = features.volume?.relativeToAvg || 1.0;
    if (rvol < 1.5) return false;

    return true;
  },

  scoreFactors: [
    {
      name: 'momentum_strength',
      weight: 0.30,
      evaluate: (features) => {
        const price = features.price.current;
        const dayOpen = features.price.open || price;
        const moveFromOpen = Math.abs(price - dayOpen) / dayOpen;

        // 0.3% = 50, 0.5% = 75, 1.0%+ = 100
        return Math.min(100, (moveFromOpen - 0.003) * 10000 / 7 + 50);
      }
    },
    {
      name: 'volume_intensity',
      weight: 0.25,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // 2.0x = 50, 3.0x = 75, 5.0x+ = 100
        return Math.min(100, (rvol - 2.0) * 25 + 50);
      }
    },
    {
      name: 'flow_alignment',
      weight: 0.20,
      evaluate: (features) => {
        if (!features.flow) return 50;

        const { flowScore = 50, flowBias = 'neutral', sweepCount = 0 } = features.flow;

        if (flowBias === 'bullish' && flowScore > 60) return 100;
        if (sweepCount > 3) return 90;
        if (flowBias === 'bullish') return 75;

        return 50;
      }
    },
    {
      name: 'overnight_gap',
      weight: 0.15,
      evaluate: (features) => {
        const dayOpen = features.price.open;
        const prevClose = features.price.prevClose;

        if (!dayOpen || !prevClose) return 50;

        const gapPct = Math.abs((dayOpen - prevClose) / prevClose);

        // Large gap = momentum likely continues
        // 0.5% gap = 70, 1.0% gap = 100
        return Math.min(100, gapPct * 100 + 20);
      }
    },
    {
      name: 'mtf_alignment',
      weight: 0.10,
      evaluate: (features) => {
        // Check if breaking above key resistance or aligned with trend
        return features.pattern?.mtf_divergence_aligned ? 100 : 50;
      }
    }
  ]
});
