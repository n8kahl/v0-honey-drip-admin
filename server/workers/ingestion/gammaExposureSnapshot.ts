/**
 * Gamma Exposure Snapshot Module
 * Calculates dealer gamma positioning and identifies gamma walls
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOptionChain } from "../../massive/client.js";

export interface GammaSnapshotResult {
  success: boolean;
  symbol: string;
  timestamp: number;
  dealerPositioning: string | null;
  gammaWallResistance: number | null;
  gammaWallSupport: number | null;
  contractsAnalyzed: number;
  error?: string;
}

interface GammaSnapshot {
  symbol: string;
  timestamp: number;
  underlying_price: number;
  total_gamma: number;
  total_gamma_notional: number;
  call_gamma: number;
  put_gamma: number;
  gamma_skew: number;
  total_call_oi: number;
  total_put_oi: number;
  put_call_oi_ratio: number;
  total_call_volume: number;
  total_put_volume: number;
  put_call_volume_ratio: number;
  gamma_by_strike: Record<string, number>;
  oi_by_strike: Record<string, number>;
  volume_by_strike: Record<string, number>;
  max_call_oi_strike: number | null;
  max_put_oi_strike: number | null;
  max_call_volume_strike: number | null;
  max_put_volume_strike: number | null;
  gamma_wall_resistance: number | null;
  gamma_wall_support: number | null;
  gamma_wall_resistance_strength: number | null;
  gamma_wall_support_strength: number | null;
  dealer_net_gamma: number;
  dealer_positioning: "LONG_GAMMA" | "SHORT_GAMMA" | "NEUTRAL";
  positioning_strength: "WEAK" | "MODERATE" | "STRONG" | "EXTREME";
  expected_behavior: "PINNING" | "TRENDING" | "VOLATILE" | "RANGE_BOUND";
  distance_to_resistance_pct: number | null;
  distance_to_support_pct: number | null;
  expiration_focus: string | null;
  expirations_included: string[];
}

/**
 * Calculate dealer gamma positioning strength
 */
function calculatePositioningStrength(netGamma: number, totalGamma: number): GammaSnapshot["positioning_strength"] {
  const ratio = Math.abs(netGamma / totalGamma);

  if (ratio > 0.75) return "EXTREME";
  if (ratio > 0.5) return "STRONG";
  if (ratio > 0.25) return "MODERATE";
  return "WEAK";
}

/**
 * Predict market behavior based on gamma profile
 */
function predictBehavior(
  dealerPositioning: string,
  distanceToResistance: number | null,
  distanceToSupport: number | null
): GammaSnapshot["expected_behavior"] {
  // Near gamma wall (within 1%) → Pinning
  if (
    (distanceToResistance !== null && Math.abs(distanceToResistance) < 1) ||
    (distanceToSupport !== null && Math.abs(distanceToSupport) < 1)
  ) {
    return "PINNING";
  }

  // Dealers short gamma → Amplified moves → Volatile
  if (dealerPositioning === "SHORT_GAMMA") {
    return "VOLATILE";
  }

  // Dealers long gamma → Dampened moves → Range bound
  if (dealerPositioning === "LONG_GAMMA") {
    return "RANGE_BOUND";
  }

  return "TRENDING";
}

/**
 * Snapshot gamma exposure for a symbol
 */
export async function snapshotGammaExposure(
  supabase: SupabaseClient,
  symbol: string
): Promise<GammaSnapshotResult> {
  const timestamp = Date.now();

  try {
    // Fetch options chain
    const chain = await getOptionChain(symbol);

    if (!chain || !chain.contracts || chain.contracts.length === 0) {
      return {
        success: false,
        symbol,
        timestamp,
        dealerPositioning: null,
        gammaWallResistance: null,
        gammaWallSupport: null,
        contractsAnalyzed: 0,
        error: "No options chain data available",
      };
    }

    const underlyingPrice = chain.underlying_price;
    const contracts = chain.contracts;

    // Initialize accumulators
    let totalGamma = 0;
    let totalGammaNotional = 0;
    let callGamma = 0;
    let putGamma = 0;
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;

    const gammaByStrike: Record<string, number> = {};
    const oiByStrike: Record<string, number> = {};
    const volumeByStrike: Record<string, number> = {};
    const expirations = new Set<string>();

    // Track max OI and volume strikes
    let maxCallOIStrike = { strike: 0, oi: 0 };
    let maxPutOIStrike = { strike: 0, oi: 0 };
    let maxCallVolumeStrike = { strike: 0, volume: 0 };
    let maxPutVolumeStrike = { strike: 0, volume: 0 };

    // Process each contract
    for (const contract of contracts) {
      const strike = contract.strike;
      const strikeKey = strike.toString();
      const gamma = contract.greeks?.gamma || 0;
      const oi = contract.open_interest || 0;
      const volume = contract.volume || 0;
      const optionType = contract.option_type.toLowerCase();

      expirations.add(contract.expiration);

      // Dealer gamma = -Market gamma (dealers are on the other side)
      // For market participants: long calls/puts = positive gamma
      // For dealers: short calls/puts to market = negative gamma
      const marketGamma = gamma * oi;
      const dealerGamma = -marketGamma;

      // Notional gamma (gamma × price^2 × 100)
      const gammaNotional = gamma * Math.pow(underlyingPrice, 2) * 100 * oi;

      // Accumulate
      totalGamma += dealerGamma;
      totalGammaNotional += gammaNotional;

      if (optionType === "call") {
        callGamma += dealerGamma;
        totalCallOI += oi;
        totalCallVolume += volume;

        if (oi > maxCallOIStrike.oi) {
          maxCallOIStrike = { strike, oi };
        }
        if (volume > maxCallVolumeStrike.volume) {
          maxCallVolumeStrike = { strike, volume };
        }
      } else {
        putGamma += dealerGamma;
        totalPutOI += oi;
        totalPutVolume += volume;

        if (oi > maxPutOIStrike.oi) {
          maxPutOIStrike = { strike, oi };
        }
        if (volume > maxPutVolumeStrike.volume) {
          maxPutVolumeStrike = { strike, volume };
        }
      }

      // Aggregate by strike
      gammaByStrike[strikeKey] = (gammaByStrike[strikeKey] || 0) + dealerGamma;
      oiByStrike[strikeKey] = (oiByStrike[strikeKey] || 0) + oi;
      volumeByStrike[strikeKey] = (volumeByStrike[strikeKey] || 0) + volume;
    }

    // Find gamma walls
    const strikes = Object.keys(gammaByStrike)
      .map(Number)
      .sort((a, b) => a - b);

    // Resistance: Strike above price with most negative gamma (dealers short)
    const strikesAbove = strikes.filter((s) => s > underlyingPrice);
    let gammaWallResistance: number | null = null;
    let resistanceStrength: number | null = null;

    if (strikesAbove.length > 0) {
      let minGamma = 0;
      for (const strike of strikesAbove) {
        const gamma = gammaByStrike[strike.toString()];
        if (gamma < minGamma) {
          minGamma = gamma;
          gammaWallResistance = strike;
          resistanceStrength = gamma;
        }
      }
    }

    // Support: Strike below price with most positive gamma (dealers long)
    const strikesBelow = strikes.filter((s) => s < underlyingPrice);
    let gammaWallSupport: number | null = null;
    let supportStrength: number | null = null;

    if (strikesBelow.length > 0) {
      let maxGamma = 0;
      for (const strike of strikesBelow) {
        const gamma = gammaByStrike[strike.toString()];
        if (gamma > maxGamma) {
          maxGamma = gamma;
          gammaWallSupport = strike;
          supportStrength = gamma;
        }
      }
    }

    // Determine dealer positioning
    let dealerPositioning: GammaSnapshot["dealer_positioning"];
    if (totalGamma < -1000) {
      dealerPositioning = "SHORT_GAMMA"; // Dealers short = bullish for price moves
    } else if (totalGamma > 1000) {
      dealerPositioning = "LONG_GAMMA"; // Dealers long = dampens price moves
    } else {
      dealerPositioning = "NEUTRAL";
    }

    const positioningStrength = calculatePositioningStrength(totalGamma, Math.abs(totalGamma) + Math.abs(callGamma) + Math.abs(putGamma));

    // Calculate distances to gamma walls
    const distanceToResistance = gammaWallResistance
      ? ((gammaWallResistance - underlyingPrice) / underlyingPrice) * 100
      : null;

    const distanceToSupport = gammaWallSupport
      ? ((underlyingPrice - gammaWallSupport) / underlyingPrice) * 100
      : null;

    // Predict behavior
    const expectedBehavior = predictBehavior(dealerPositioning, distanceToResistance, distanceToSupport);

    // Calculate ratios
    const gammaSkew = putGamma !== 0 ? callGamma / putGamma : 0;
    const putCallOIRatio = totalCallOI !== 0 ? totalPutOI / totalCallOI : 0;
    const putCallVolumeRatio = totalCallVolume !== 0 ? totalPutVolume / totalCallVolume : 0;

    // Find dominant expiration (most OI)
    const expirationOI = new Map<string, number>();
    for (const contract of contracts) {
      const exp = contract.expiration;
      const oi = contract.open_interest || 0;
      expirationOI.set(exp, (expirationOI.get(exp) || 0) + oi);
    }

    const expirationFocus = Array.from(expirationOI.entries()).reduce(
      (max, [exp, oi]) => (oi > max[1] ? [exp, oi] : max),
      ["", 0]
    )[0];

    // Build snapshot record
    const snapshot: GammaSnapshot = {
      symbol,
      timestamp,
      underlying_price: underlyingPrice,
      total_gamma: totalGamma,
      total_gamma_notional: totalGammaNotional,
      call_gamma: callGamma,
      put_gamma: putGamma,
      gamma_skew: gammaSkew,
      total_call_oi: totalCallOI,
      total_put_oi: totalPutOI,
      put_call_oi_ratio: putCallOIRatio,
      total_call_volume: totalCallVolume,
      total_put_volume: totalPutVolume,
      put_call_volume_ratio: putCallVolumeRatio,
      gamma_by_strike: gammaByStrike,
      oi_by_strike: oiByStrike,
      volume_by_strike: volumeByStrike,
      max_call_oi_strike: maxCallOIStrike.oi > 0 ? maxCallOIStrike.strike : null,
      max_put_oi_strike: maxPutOIStrike.oi > 0 ? maxPutOIStrike.strike : null,
      max_call_volume_strike: maxCallVolumeStrike.volume > 0 ? maxCallVolumeStrike.strike : null,
      max_put_volume_strike: maxPutVolumeStrike.volume > 0 ? maxPutVolumeStrike.strike : null,
      gamma_wall_resistance: gammaWallResistance,
      gamma_wall_support: gammaWallSupport,
      gamma_wall_resistance_strength: resistanceStrength,
      gamma_wall_support_strength: supportStrength,
      dealer_net_gamma: totalGamma,
      dealer_positioning: dealerPositioning,
      positioning_strength: positioningStrength,
      expected_behavior: expectedBehavior,
      distance_to_resistance_pct: distanceToResistance,
      distance_to_support_pct: distanceToSupport,
      expiration_focus: expirationFocus || null,
      expirations_included: Array.from(expirations),
    };

    // Store in database
    const { error } = await supabase.from("gamma_exposure_snapshots").upsert(snapshot as any, {
      onConflict: "symbol,timestamp",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`[GammaSnapshot] Database error for ${symbol}:`, error);
      return {
        success: false,
        symbol,
        timestamp,
        dealerPositioning,
        gammaWallResistance,
        gammaWallSupport,
        contractsAnalyzed: contracts.length,
        error: error.message,
      };
    }

    return {
      success: true,
      symbol,
      timestamp,
      dealerPositioning,
      gammaWallResistance,
      gammaWallSupport,
      contractsAnalyzed: contracts.length,
    };
  } catch (error) {
    console.error(`[GammaSnapshot] Error for ${symbol}:`, error);
    return {
      success: false,
      symbol,
      timestamp,
      dealerPositioning: null,
      gammaWallResistance: null,
      gammaWallSupport: null,
      contractsAnalyzed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
