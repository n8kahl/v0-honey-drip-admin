import type { SymbolFeatures } from '../../strategy/engine.js';
import { createDetector, type OpportunityDetector, type OptionsChainData } from '../OpportunityDetector.js';

/**
 * End-of-Day Pin Setup Detector (SPX/NDX 0DTE)
 *
 * Detects max pain pinning in last 30 minutes of 0DTE expiration.
 * Price gravitates toward max pain strike due to dealer hedging.
 *
 * Expected Frequency: 0-1 signals/day (only on 0DTE close)
 * Direction: Can be LONG or SHORT depending on pin direction
 */
export const eodPinSetupDetector: OpportunityDetector = createDetector({
  type: 'eod_pin_setup',
  direction: 'LONG', // Note: This is neutral/directional based on max pain
  assetClass: ['INDEX'],
  requiresOptionsData: true,

  detect: (features: SymbolFeatures, optionsData?: OptionsChainData) => {
    if (!optionsData) return false;

    // 1. Last 30 minutes (360+ minutes since open)
    const minutesSinceOpen = features.session?.minutesSinceOpen || 0;
    if (minutesSinceOpen < 360) return false;

    // 2. 0DTE expiration (< 30 minutes to expiry)
    const is0DTE = optionsData.is0DTE || (optionsData.minutesToExpiry && optionsData.minutesToExpiry < 30);
    if (!is0DTE) return false;

    // 3. Max pain strike identified
    const maxPainStrike = optionsData.maxPainStrike;
    if (!maxPainStrike) return false;

    // 4. Near max pain strike (within 0.5%)
    const price = features.price.current;
    const nearMaxPain = Math.abs(price - maxPainStrike) / maxPainStrike < 0.005;
    if (!nearMaxPain) return false;

    // 5. Large open interest at strike
    const oiAtStrike = optionsData.openInterestAtStrike?.(maxPainStrike) || 0;
    if (oiAtStrike < 5000) return false; // Minimum OI threshold

    return true;
  },

  scoreFactors: [
    {
      name: 'max_pain_proximity',
      weight: 0.40,
      evaluate: (features, optionsData) => {
        if (!optionsData?.maxPainStrike) return 0;

        const price = features.price.current;
        const maxPainStrike = optionsData.maxPainStrike;
        const distancePct = Math.abs(price - maxPainStrike) / maxPainStrike;

        // 0% = 100, 0.25% = 50, 0.5% = 0
        return Math.max(0, 100 - (distancePct * 20000));
      }
    },
    {
      name: 'open_interest_concentration',
      weight: 0.30,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 0;

        const maxPainStrike = optionsData.maxPainStrike;
        if (!maxPainStrike || !optionsData.openInterestAtStrike) return 0;

        const oiAtMaxPain = optionsData.openInterestAtStrike(maxPainStrike);
        const totalOI = optionsData.totalOpenInterest || 1;
        const concentration = oiAtMaxPain / totalOI;

        // 10% = 50, 20% = 75, 30%+ = 100
        return Math.min(100, concentration * 333);
      }
    },
    {
      name: 'time_remaining',
      weight: 0.20,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 0;

        const minutesToExpiry = optionsData.minutesToExpiry || 30;

        // Last 15 minutes = 100, 20 minutes = 75, 30 minutes = 50
        return Math.max(50, 100 - (minutesToExpiry * 1.67));
      }
    },
    {
      name: 'dealer_gamma',
      weight: 0.10,
      evaluate: (features, optionsData) => {
        if (!optionsData) return 50;

        const maxPainStrike = optionsData.maxPainStrike;
        if (!maxPainStrike || !optionsData.gammaAtStrike) return 50;

        const dealerGamma = optionsData.gammaAtStrike(maxPainStrike);

        // Positive dealer gamma = pin more likely
        return dealerGamma > 0 ? 100 : 30;
      }
    }
  ]
});
