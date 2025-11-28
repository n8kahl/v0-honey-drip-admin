/**
 * DealerPositioning - Calculate dealer gamma exposure and positioning
 *
 * Market makers (dealers) are required to hedge their options positions.
 * Understanding their positioning helps predict market behavior:
 *
 * - POSITIVE GAMMA: Dealers sell rallies, buy dips → dampens moves, mean-reverting
 * - NEGATIVE GAMMA: Dealers buy rallies, sell dips → amplifies moves, trending
 *
 * The "Gamma Flip" level is where dealer gamma changes from positive to negative.
 * Below this level, expect amplified moves. Above, expect dampened moves.
 */

export interface OptionsOpenInterest {
  strike: number;
  callOI: number;
  putOI: number;
  callGamma: number; // Per-contract gamma
  putGamma: number;
  expiration: string;
  dte: number;
}

export interface GammaExposureByStrike {
  strike: number;
  callGEX: number; // Call gamma exposure in $ per 1% move
  putGEX: number; // Put gamma exposure in $ per 1% move
  netGEX: number; // Net gamma exposure (call - put for dealer perspective)
  totalOI: number;
  percentOfMax: number; // Relative to max GEX strike
}

export interface DealerPositioningSummary {
  // Overall positioning
  totalNetGamma: number; // Positive = dealers short gamma (mean-reverting market)
  gammaImbalance: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  gammaImbalanceStrength: "STRONG" | "MODERATE" | "WEAK";

  // Key levels
  gammaFlipLevel: number | null; // Price where gamma flips sign
  maxGammaStrike: number; // Strike with highest absolute gamma
  putWall: number | null; // Highest put OI strike below current price
  callWall: number | null; // Highest call OI strike above current price

  // Market implications
  expectedBehavior: "MEAN_REVERTING" | "TRENDING" | "PINNING" | "VOLATILE";
  supportLevels: number[];
  resistanceLevels: number[];

  // Confidence
  dataQuality: "HIGH" | "MEDIUM" | "LOW";
  expirationsCovered: number;
  totalOIAnalyzed: number;
}

export interface GammaContextResult {
  summary: DealerPositioningSummary;
  byStrike: GammaExposureByStrike[];
  tradingImplications: string[];
  warnings: string[];
}

/**
 * Calculate dealer gamma exposure from options open interest data
 *
 * Dealers are typically SHORT options (sold to retail/institutions)
 * So dealer gamma = -1 * customer gamma
 *
 * For CALLS: Dealer is short call → has negative delta, positive gamma
 * For PUTS: Dealer is short put → has positive delta, negative gamma
 */
export function calculateGammaExposure(
  optionsData: OptionsOpenInterest[],
  currentPrice: number,
  spotMultiplier: number = 100 // Contract multiplier (100 shares per contract)
): GammaExposureByStrike[] {
  // Group by strike
  const byStrike = new Map<number, GammaExposureByStrike>();

  for (const opt of optionsData) {
    const existing = byStrike.get(opt.strike) || {
      strike: opt.strike,
      callGEX: 0,
      putGEX: 0,
      netGEX: 0,
      totalOI: 0,
      percentOfMax: 0,
    };

    // Gamma Exposure = Gamma * OI * Spot * SpotMultiplier * 0.01
    // The 0.01 converts to "dollars per 1% move"
    const callGEX = opt.callGamma * opt.callOI * currentPrice * spotMultiplier * 0.01;
    const putGEX = opt.putGamma * opt.putOI * currentPrice * spotMultiplier * 0.01;

    // From dealer perspective (they're short options):
    // Short call = positive gamma for dealer (they buy when price rises)
    // Short put = negative gamma for dealer (they sell when price rises)
    existing.callGEX += callGEX;
    existing.putGEX += -putGEX; // Negative because dealer is short puts
    existing.netGEX += callGEX - putGEX;
    existing.totalOI += opt.callOI + opt.putOI;

    byStrike.set(opt.strike, existing);
  }

  const results = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);

  // Calculate percentOfMax
  const maxAbsGEX = Math.max(...results.map((r) => Math.abs(r.netGEX)));
  if (maxAbsGEX > 0) {
    for (const r of results) {
      r.percentOfMax = (Math.abs(r.netGEX) / maxAbsGEX) * 100;
    }
  }

  return results;
}

/**
 * Find the gamma flip level - where dealer gamma changes sign
 */
export function findGammaFlipLevel(
  gexByStrike: GammaExposureByStrike[],
  currentPrice: number
): number | null {
  if (gexByStrike.length < 2) return null;

  // Find strikes around current price
  const sortedStrikes = [...gexByStrike].sort((a, b) => a.strike - b.strike);

  // Look for sign change in net GEX
  for (let i = 0; i < sortedStrikes.length - 1; i++) {
    const curr = sortedStrikes[i];
    const next = sortedStrikes[i + 1];

    // Check if gamma flips between these strikes
    if (curr.netGEX * next.netGEX < 0) {
      // Linear interpolation to find exact flip point
      const flipLevel =
        curr.strike +
        ((next.strike - curr.strike) * Math.abs(curr.netGEX)) /
          (Math.abs(curr.netGEX) + Math.abs(next.netGEX));

      // Only return if it's reasonably close to current price (within 5%)
      if (Math.abs(flipLevel - currentPrice) / currentPrice < 0.05) {
        return Math.round(flipLevel * 100) / 100;
      }
    }
  }

  return null;
}

/**
 * Find put and call walls (high OI concentration levels)
 */
export function findWalls(
  gexByStrike: GammaExposureByStrike[],
  currentPrice: number,
  minOIThreshold: number = 0.1 // 10% of max OI
): { putWall: number | null; callWall: number | null } {
  const maxOI = Math.max(...gexByStrike.map((g) => g.totalOI));
  const threshold = maxOI * minOIThreshold;

  // Put wall: Highest OI strike below current price
  const putWallCandidates = gexByStrike
    .filter((g) => g.strike < currentPrice && g.totalOI >= threshold)
    .sort((a, b) => b.totalOI - a.totalOI);

  // Call wall: Highest OI strike above current price
  const callWallCandidates = gexByStrike
    .filter((g) => g.strike > currentPrice && g.totalOI >= threshold)
    .sort((a, b) => b.totalOI - a.totalOI);

  return {
    putWall: putWallCandidates[0]?.strike || null,
    callWall: callWallCandidates[0]?.strike || null,
  };
}

/**
 * Calculate total net gamma across all strikes
 */
export function calculateTotalNetGamma(gexByStrike: GammaExposureByStrike[]): number {
  return gexByStrike.reduce((sum, g) => sum + g.netGEX, 0);
}

/**
 * Determine gamma imbalance classification
 */
export function classifyGammaImbalance(
  totalNetGamma: number,
  gexByStrike: GammaExposureByStrike[]
): { imbalance: "POSITIVE" | "NEGATIVE" | "NEUTRAL"; strength: "STRONG" | "MODERATE" | "WEAK" } {
  // Calculate average GEX magnitude for context
  const avgAbsGEX =
    gexByStrike.reduce((sum, g) => sum + Math.abs(g.netGEX), 0) / Math.max(gexByStrike.length, 1);

  if (avgAbsGEX === 0) {
    return { imbalance: "NEUTRAL", strength: "WEAK" };
  }

  const ratio = Math.abs(totalNetGamma) / (avgAbsGEX * gexByStrike.length);

  let strength: "STRONG" | "MODERATE" | "WEAK";
  if (ratio > 0.5) {
    strength = "STRONG";
  } else if (ratio > 0.2) {
    strength = "MODERATE";
  } else {
    strength = "WEAK";
  }

  if (Math.abs(totalNetGamma) < avgAbsGEX * 0.5) {
    return { imbalance: "NEUTRAL", strength };
  }

  return {
    imbalance: totalNetGamma > 0 ? "POSITIVE" : "NEGATIVE",
    strength,
  };
}

/**
 * Determine expected market behavior based on gamma positioning
 */
export function determineExpectedBehavior(
  imbalance: "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  strength: "STRONG" | "MODERATE" | "WEAK",
  currentPrice: number,
  gammaFlipLevel: number | null,
  putWall: number | null,
  callWall: number | null
): "MEAN_REVERTING" | "TRENDING" | "PINNING" | "VOLATILE" {
  // Check for pinning scenario (price between strong put/call walls)
  if (putWall && callWall) {
    const range = callWall - putWall;
    const priceInRange = currentPrice - putWall;
    const percentInRange = priceInRange / range;

    // If price is within 20-80% of the range and walls are close
    if (percentInRange > 0.2 && percentInRange < 0.8 && range / currentPrice < 0.03) {
      return "PINNING";
    }
  }

  // Strong positive gamma = mean reverting
  if (imbalance === "POSITIVE" && strength === "STRONG") {
    return "MEAN_REVERTING";
  }

  // Strong negative gamma = trending
  if (imbalance === "NEGATIVE" && strength === "STRONG") {
    return "TRENDING";
  }

  // Near gamma flip = volatile
  if (gammaFlipLevel && Math.abs(currentPrice - gammaFlipLevel) / currentPrice < 0.01) {
    return "VOLATILE";
  }

  // Moderate imbalances
  if (imbalance === "POSITIVE") {
    return "MEAN_REVERTING";
  }
  if (imbalance === "NEGATIVE") {
    return "TRENDING";
  }

  return "VOLATILE";
}

/**
 * Find key support and resistance levels from gamma
 */
export function findGammaLevels(
  gexByStrike: GammaExposureByStrike[],
  currentPrice: number,
  topN: number = 3
): { support: number[]; resistance: number[] } {
  // High positive GEX = support (dealers buy dips)
  // High negative GEX = resistance (dealers sell rallies)

  const support = gexByStrike
    .filter((g) => g.strike < currentPrice && g.netGEX > 0)
    .sort((a, b) => b.netGEX - a.netGEX)
    .slice(0, topN)
    .map((g) => g.strike);

  const resistance = gexByStrike
    .filter((g) => g.strike > currentPrice && g.netGEX < 0)
    .sort((a, b) => a.netGEX - b.netGEX) // Most negative first
    .slice(0, topN)
    .map((g) => g.strike);

  return { support, resistance };
}

/**
 * Generate trading implications based on gamma analysis
 */
export function generateTradingImplications(summary: DealerPositioningSummary): string[] {
  const implications: string[] = [];

  // Expected behavior implications
  switch (summary.expectedBehavior) {
    case "MEAN_REVERTING":
      implications.push("Dealers will dampen moves - fade extremes, buy dips, sell rallies");
      implications.push("Mean reversion strategies favored over breakouts");
      if (summary.gammaImbalanceStrength === "STRONG") {
        implications.push("Strong gamma cushion - expect tight ranges");
      }
      break;

    case "TRENDING":
      implications.push("Dealers will amplify moves - trend following favored");
      implications.push("Breakouts more likely to extend - don't fade");
      if (summary.gammaImbalanceStrength === "STRONG") {
        implications.push("High volatility likely - size down, widen stops");
      }
      break;

    case "PINNING":
      implications.push("Price likely to pin between walls - range bound");
      implications.push("Sell premium strategies favored (iron condors, strangles)");
      implications.push("Avoid directional plays until breakout from range");
      break;

    case "VOLATILE":
      implications.push("Near gamma flip - expect unpredictable swings");
      implications.push("Reduce position size - increased whipsaw risk");
      implications.push("Wait for clearer gamma positioning before committing");
      break;
  }

  // Level-specific implications
  if (summary.gammaFlipLevel) {
    implications.push(
      `Gamma flip at ${summary.gammaFlipLevel.toFixed(2)} - behavior changes at this level`
    );
  }

  if (summary.putWall) {
    implications.push(`Put wall support at ${summary.putWall} - dealers buy here`);
  }

  if (summary.callWall) {
    implications.push(`Call wall resistance at ${summary.callWall} - dealers sell here`);
  }

  return implications;
}

/**
 * Generate warnings based on gamma analysis
 */
export function generateGammaWarnings(
  summary: DealerPositioningSummary,
  currentPrice: number
): string[] {
  const warnings: string[] = [];

  // Data quality warning
  if (summary.dataQuality === "LOW") {
    warnings.push("Limited options data - gamma analysis may be unreliable");
  }

  // Near gamma flip warning
  if (
    summary.gammaFlipLevel &&
    Math.abs(currentPrice - summary.gammaFlipLevel) / currentPrice < 0.005
  ) {
    warnings.push("CAUTION: Price at gamma flip level - expect volatility");
  }

  // Strong negative gamma warning
  if (summary.gammaImbalance === "NEGATIVE" && summary.gammaImbalanceStrength === "STRONG") {
    warnings.push("WARNING: Strong negative gamma - moves may accelerate rapidly");
  }

  // Expiration concentration warning
  if (summary.expirationsCovered < 2) {
    warnings.push("Only near-term expirations analyzed - longer-term gamma not reflected");
  }

  return warnings;
}
