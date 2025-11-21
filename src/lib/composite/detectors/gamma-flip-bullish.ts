import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector, type OptionsChainData } from '../OpportunityDetector.js';

/**
 * Gamma Flip Bullish Detector (SPX/NDX 0DTE)
 *
 * Detects price crossing above dealer gamma flip point on 0DTE days.
 * Creates accelerated upside as dealers flip from short to long gamma.
 *
 * Expected Frequency: 0-1 signals/day (rare, high-impact)
 */
export const gammaFlipBullishDetector: OpportunityDetector = createDetector({
  type: 'gamma_flip_bullish',
  direction: 'LONG',
  assetClass: ['INDEX'],
  requiresOptionsData: true,

  detect: (features: SymbolFeatures, optionsData?: OptionsChainData) => {
    if (!optionsData) return false;

    // 1. 0DTE expiration day (< 8 hours to expiry)
    const is0DTE = optionsData.is0DTE || (optionsData.minutesToExpiry && optionsData.minutesToExpiry < 480);
    if (!is0DTE) return false;

    // 2. Gamma flip level identified
    const gammaFlipLevel = optionsData.gammaFlipLevel;
    if (!gammaFlipLevel) return false;

    // 3. Price crossing above gamma flip
    const price = features.price.current;
    const prevPrice = features.price.prev || features.price.prevClose || price;

    const crossingFlip = prevPrice < gammaFlipLevel && price > gammaFlipLevel;
    if (!crossingFlip) return false;

    // 4. Approaching close (gamma effect strongest after 1 PM)
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 210) return false; // After 12:30 PM

    return true;
  },

  scoreFactors: [
    {
      name: 'gamma_flip_significance',
      weight: 0.35,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 0;

        const gammaAtFlip = Math.abs(optionsData.gammaAtFlipLevel || 0);

        // Larger gamma = more significant flip
        // 500 gamma = 50, 1000 gamma = 75, 2000+ gamma = 100
        return Math.min(100, gammaAtFlip / 20 + 25);
      }
    },
    {
      name: 'time_to_expiry',
      weight: 0.25,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 0;

        const minutesToExpiry = optionsData.minutesToExpiry || 480;

        // Last 2 hours = maximum effect
        if (minutesToExpiry <= 120) return 100;
        if (minutesToExpiry <= 240) return 75;
        if (minutesToExpiry <= 360) return 50;

        return 25;
      }
    },
    {
      name: 'dealer_hedging_pressure',
      weight: 0.20,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 50;

        const dealerNetPosition = Math.abs(optionsData.dealerNetDelta || 0);

        // Large dealer position = more hedging flow expected
        return Math.min(100, dealerNetPosition / 100);
      }
    },
    {
      name: 'options_volume',
      weight: 0.15,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 50;

        const optionsVolume = optionsData.totalVolume || 0;
        const avgVolume = optionsData.avgVolume || 1;
        const rvol = optionsVolume / avgVolume;

        return Math.min(100, (rvol - 0.5) * 100);
      }
    },
    {
      name: 'price_momentum',
      weight: 0.05,
      evaluate: (features) => {
        const rvol = features.volume?.relativeToAvg || 1.0;
        return Math.min(100, (rvol - 1.0) * 50);
      }
    }
  ]
});
