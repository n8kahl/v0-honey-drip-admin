import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector, type OptionsChainData } from '../OpportunityDetector.js';

/**
 * Gamma Squeeze Bearish Detector (SPX/NDX)
 *
 * Detects bearish gamma squeeze setups near 0DTE expiration.
 * Price approaching gamma wall from above + dealer net long gamma + volume surge.
 *
 * Expected Frequency: 2-4 signals/day on 0DTE days
 */
export const gammaSqueezeBearishDetector: OpportunityDetector = createDetector({
  type: 'gamma_squeeze_bearish',
  direction: 'SHORT',
  assetClass: ['INDEX'],
  requiresOptionsData: true,

  detect: (features: SymbolFeatures, optionsData?: OptionsChainData) => {
    if (!optionsData) return false;

    // 1. Gamma wall identified
    const gammaWall = optionsData.maxGammaStrike;
    if (!gammaWall) return false;

    // 2. Price approaching gamma wall (within 0.5%)
    const price = features.price.current;
    const distancePct = Math.abs(price - gammaWall) / gammaWall;
    if (distancePct >= 0.005) return false;

    // 3. Dealer positioning (for bearish squeeze, can work with either sign)
    // Bearish squeeze happens when price approaches from above and dealers need to hedge

    // 4. Volume increasing
    const rvol = features.volume?.relativeToAvg || 1.0;
    if (rvol < 1.3) return false;

    // 5. Power hour window
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 300) return false;

    return true;
  },

  scoreFactors: [
    {
      name: 'gamma_wall_proximity',
      weight: 0.30,
      evaluate: (features, optionsData) => {
        if (!optionsData?.maxGammaStrike) return 0;

        const price = features.price.current;
        const gammaWall = optionsData.maxGammaStrike;
        const distancePct = Math.abs(price - gammaWall) / gammaWall;

        // Closer = higher score
        return Math.max(0, 100 - (distancePct * 20000));
      }
    },
    {
      name: 'dealer_gamma_exposure',
      weight: 0.25,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 50;

        const dealerGamma = optionsData.dealerNetGamma || 0;

        // For bearish squeeze, positive dealer gamma can create downside pressure
        // +1000 gamma = 100, 0 gamma = 50, -1000 gamma = 0
        return Math.min(100, 50 + (dealerGamma / 20));
      }
    },
    {
      name: 'call_put_skew',
      weight: 0.20,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 50;

        const callVolume = optionsData.callVolume || 0;
        const putVolume = optionsData.putVolume || 0;
        const totalVolume = callVolume + putVolume;

        if (totalVolume === 0) return 50;

        // Put volume dominance for bearish squeeze
        const putPct = (putVolume / totalVolume) * 100;

        // 60%+ puts = 100, 55% = 75, 50% = 50
        if (putPct >= 60) return 100;
        if (putPct >= 55) return 75;
        if (putPct >= 50) return 50;

        return 30; // Call-heavy = less bearish
      }
    },
    {
      name: 'time_decay_acceleration',
      weight: 0.15,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 50;

        const minutesToExpiry = optionsData.minutesToExpiry || 480;

        // Closer to expiration = more gamma effect
        if (minutesToExpiry <= 30) return 100;
        if (minutesToExpiry <= 60) return 85;
        if (minutesToExpiry <= 120) return 70;
        if (minutesToExpiry <= 240) return 55;

        return Math.max(0, 100 - (minutesToExpiry / 5));
      }
    },
    {
      name: 'volume_surge',
      weight: 0.10,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;

        // Volume surge indicates gamma hedging
        if (rvol >= 3.0) return 100;
        if (rvol >= 2.0) return 80;
        if (rvol >= 1.5) return 60;

        return Math.min(100, rvol * 40);
      }
    }
  ]
});
