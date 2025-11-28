import type { SymbolFeatures } from "../../strategy/engine.js";
import {
  createDetector,
  type OpportunityDetector,
  type OptionsChainData,
} from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Gamma Pinning Detector
 *
 * Detect when price is being pinned between significant options strikes
 * due to dealer hedging activity. This creates range-bound conditions
 * ideal for selling premium or trading small range bounces.
 *
 * Entry Criteria:
 * - Price between significant put wall and call wall
 * - Walls are relatively close (within 2% of each other)
 * - High total open interest at these strikes
 * - Near expiration (0DTE or weekly expiry day)
 * - Low momentum / range-bound price action
 *
 * This is a NEUTRAL strategy (not directional) - used for:
 * - Iron condors / strangles
 * - Range trading between walls
 * - Scalping mean reversion within the pinned range
 *
 * Expected Frequency: 0-2 signals/day near expiry
 */
export const gammaPinningDetector: OpportunityDetector = createDetector({
  type: "gamma_pinning",
  direction: "LONG", // Neutral strategy, but needs a direction - defaults to LONG for range trades
  assetClass: ["INDEX", "EQUITY_ETF"],
  requiresOptionsData: true,

  detect: (features: SymbolFeatures, optionsData?: OptionsChainData) => {
    // Skip if detector shouldn't run (time-based filters)
    if (!shouldRunDetector(features)) return false;

    // 1. Must have price data
    if (!features.price?.current) return false;

    // 2. Must have options data
    if (!optionsData) return false;

    const price = features.price.current;

    // 3. Check if near expiration (0DTE or within 2 days)
    const is0DTE = optionsData.is0DTE ?? false;
    const minutesToExpiry = optionsData.minutesToExpiry ?? 9999;
    const isNearExpiry = is0DTE || minutesToExpiry < 2880; // Within 2 days

    if (!isNearExpiry) return false;

    // 4. Need max gamma strike and significant OI
    const maxGammaStrike = optionsData.maxGammaStrike;
    const totalOI = optionsData.totalOpenInterest ?? 0;

    if (!maxGammaStrike) return false;
    if (totalOI < 10000) return false; // Need significant OI for pinning effect

    // 5. Check if price is near max gamma strike (within 0.5%)
    const distanceFromGamma = Math.abs(price - maxGammaStrike) / price;
    if (distanceFromGamma > 0.005) return false; // Not close enough to gamma strike

    // 6. Check for strong dealer gamma (positive gamma = pinning)
    const dealerGamma = optionsData.dealerNetGamma ?? 0;
    if (dealerGamma <= 0) return false; // Need positive dealer gamma for pinning

    // 7. Momentum should be low (range-bound)
    const momentum = features.momentum?.roc5;
    if (momentum !== undefined && Math.abs(momentum) > 0.5) {
      // Too much directional movement
      return false;
    }

    // 8. RSI should be neutral (40-60 range)
    const rsi = features.rsi?.current;
    if (rsi !== undefined) {
      if (rsi < 35 || rsi > 65) return false; // Not in neutral territory
    }

    // 9. Volume should be average or below (no conviction)
    const volumeRatio = features.volume?.relativeToAvg;
    if (volumeRatio !== undefined && volumeRatio > 1.3) {
      // High volume suggests breakout potential
      return false;
    }

    return true;
  },

  scoreFactors: [
    {
      name: "gamma_strike_proximity",
      weight: 0.25,
      evaluate: (features, optionsData) => {
        if (!features.price?.current || !optionsData?.maxGammaStrike) return 0;

        const distancePercent =
          (Math.abs(features.price.current - optionsData.maxGammaStrike) / features.price.current) *
          100;

        // Closer to max gamma strike = stronger pinning
        if (distancePercent < 0.1) return 100;
        if (distancePercent < 0.2) return 90;
        if (distancePercent < 0.3) return 75;
        if (distancePercent < 0.4) return 60;
        if (distancePercent < 0.5) return 45;
        return 30;
      },
    },
    {
      name: "dealer_gamma_strength",
      weight: 0.25,
      evaluate: (features, optionsData) => {
        const dealerGamma = optionsData?.dealerNetGamma ?? 0;
        const totalOI = optionsData?.totalOpenInterest ?? 1;

        // Normalize gamma by OI
        const normalizedGamma = dealerGamma / (totalOI / 1000);

        if (normalizedGamma > 100) return 100;
        if (normalizedGamma > 50) return 85;
        if (normalizedGamma > 25) return 70;
        if (normalizedGamma > 10) return 55;
        if (normalizedGamma > 0) return 40;
        return 20;
      },
    },
    {
      name: "time_to_expiry",
      weight: 0.2,
      evaluate: (features, optionsData) => {
        const minutesToExpiry = optionsData?.minutesToExpiry ?? 9999;
        const is0DTE = optionsData?.is0DTE ?? false;

        // Closer to expiry = stronger pinning
        if (is0DTE && minutesToExpiry < 120) return 100; // Last 2 hours of 0DTE
        if (is0DTE) return 90;
        if (minutesToExpiry < 480) return 75; // Same day, >2 hours
        if (minutesToExpiry < 1440) return 60; // Within 24 hours
        if (minutesToExpiry < 2880) return 45; // Within 48 hours
        return 30;
      },
    },
    {
      name: "range_bound_action",
      weight: 0.15,
      evaluate: (features) => {
        const roc = features.momentum?.roc5;
        const rsi = features.rsi?.current;

        let score = 50;

        // Low momentum is good for pinning
        if (roc !== undefined) {
          if (Math.abs(roc) < 0.1) score += 25;
          else if (Math.abs(roc) < 0.3) score += 15;
          else if (Math.abs(roc) < 0.5) score += 5;
        }

        // Neutral RSI is good for pinning
        if (rsi !== undefined) {
          if (rsi >= 45 && rsi <= 55) score += 25;
          else if (rsi >= 40 && rsi <= 60) score += 15;
          else if (rsi >= 35 && rsi <= 65) score += 5;
        }

        return Math.min(100, score);
      },
    },
    {
      name: "open_interest_concentration",
      weight: 0.15,
      evaluate: (features, optionsData) => {
        const totalOI = optionsData?.totalOpenInterest ?? 0;
        const maxGammaStrike = optionsData?.maxGammaStrike;
        const getOIAtStrike = optionsData?.openInterestAtStrike;

        if (!maxGammaStrike || !getOIAtStrike) {
          // Use total OI as proxy
          if (totalOI > 100000) return 100;
          if (totalOI > 50000) return 80;
          if (totalOI > 25000) return 60;
          if (totalOI > 10000) return 40;
          return 20;
        }

        // Check OI concentration at max gamma strike
        const oiAtStrike = getOIAtStrike(maxGammaStrike);
        const concentration = oiAtStrike / totalOI;

        if (concentration > 0.15) return 100; // >15% at one strike
        if (concentration > 0.1) return 85;
        if (concentration > 0.05) return 65;
        if (concentration > 0.02) return 45;
        return 30;
      },
    },
  ],
});

export default gammaPinningDetector;
