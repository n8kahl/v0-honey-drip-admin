/**
 * Plan Anchors - Structure-based TP/SL selection with rationale
 *
 * This module selects meaningful TP/SL levels based on:
 * - Key structural levels (VWAP, ORB, PDH/PDL)
 * - Gamma walls (Call Wall, Put Wall, Max Pain)
 * - ATR-based fallbacks when no structure exists
 *
 * Each anchor includes a human-readable "reason" explaining WHY
 * this level was chosen, making the plan feel calculated rather than generic.
 */

import type {
  KeyLevels,
  AnchorType,
  PlanAnchor,
  TargetAnchor,
  PlanQuality,
  TradePlanAnchors,
  TradeType,
} from "./types";

// ============================================================================
// Anchor Candidate Type
// ============================================================================

interface AnchorCandidate {
  type: AnchorType;
  price: number;
  reason: string;
  weight: number; // Higher = preferred
  isGamma: boolean; // Gamma-based levels
}

// ============================================================================
// Reason Templates
// ============================================================================

const ANCHOR_REASONS: Record<AnchorType, { stop: string; target: string }> = {
  VWAP: {
    stop: "Below VWAP invalidates bullish thesis",
    target: "VWAP acts as magnetic mean-reversion target",
  },
  ORB_HIGH: {
    stop: "Below ORB high invalidates opening breakout",
    target: "ORB high is key intraday resistance",
  },
  ORB_LOW: {
    stop: "Below ORB low confirms bearish breakdown",
    target: "ORB low provides support for bounce",
  },
  PDH: {
    stop: "Prior day high breakdown = failed test",
    target: "Prior day high = major resistance to clear",
  },
  PDL: {
    stop: "Below prior day low = bearish continuation",
    target: "Prior day low = key support level",
  },
  GAMMA_WALL: {
    stop: "Gamma flip level breach changes dealer hedging",
    target: "Gamma wall creates price magnetism",
  },
  CALL_WALL: {
    stop: "Above call wall = extreme bullish sentiment",
    target: "Call wall = heavy resistance from dealer hedging",
  },
  PUT_WALL: {
    stop: "Below put wall = dealer unwinding creates acceleration",
    target: "Put wall = strong support from dealer hedging",
  },
  MAX_PAIN: {
    stop: "Below max pain = move away from equilibrium",
    target: "Max pain = gravitational pull for expiration",
  },
  WEEKLY_HIGH: {
    stop: "Below weekly high = failed breakout",
    target: "Weekly high = significant resistance",
  },
  WEEKLY_LOW: {
    stop: "Below weekly low = bearish trend confirmation",
    target: "Weekly low = major support level",
  },
  ATR_FALLBACK: {
    stop: "ATR-based stop (no structural level found)",
    target: "ATR-based target (no structural level found)",
  },
  PERCENT_FALLBACK: {
    stop: "Percent-based stop (default risk parameters)",
    target: "Percent-based target (default reward parameters)",
  },
};

// ============================================================================
// Build Anchor Candidates
// ============================================================================

/**
 * Build all potential anchor candidates from key levels and gamma data
 */
function buildAnchorCandidates(
  keyLevels: KeyLevels,
  currentPrice: number,
  direction: "long" | "short"
): { stopCandidates: AnchorCandidate[]; targetCandidates: AnchorCandidate[] } {
  const stopCandidates: AnchorCandidate[] = [];
  const targetCandidates: AnchorCandidate[] = [];

  // Helper to add candidate
  const addCandidate = (
    type: AnchorType,
    price: number | undefined,
    weight: number,
    isGamma: boolean
  ) => {
    if (!price || price <= 0) return;

    const reason = ANCHOR_REASONS[type];
    const distancePercent = ((price - currentPrice) / currentPrice) * 100;

    // For LONG: stops below current, targets above
    // For SHORT: stops above current, targets below
    if (direction === "long") {
      if (price < currentPrice && Math.abs(distancePercent) <= 5) {
        // Stop candidates: below current price, within 5%
        stopCandidates.push({
          type,
          price,
          reason: reason.stop,
          weight,
          isGamma,
        });
      } else if (price > currentPrice && Math.abs(distancePercent) <= 10) {
        // Target candidates: above current price, within 10%
        targetCandidates.push({
          type,
          price,
          reason: reason.target,
          weight,
          isGamma,
        });
      }
    } else {
      // SHORT direction
      if (price > currentPrice && Math.abs(distancePercent) <= 5) {
        stopCandidates.push({
          type,
          price,
          reason: reason.stop,
          weight,
          isGamma,
        });
      } else if (price < currentPrice && Math.abs(distancePercent) <= 10) {
        targetCandidates.push({
          type,
          price,
          reason: reason.target,
          weight,
          isGamma,
        });
      }
    }
  };

  // Structural levels (weight based on importance)
  addCandidate("VWAP", keyLevels.vwap, 90, false);
  addCandidate("ORB_HIGH", keyLevels.orbHigh, 85, false);
  addCandidate("ORB_LOW", keyLevels.orbLow, 85, false);
  addCandidate("PDH", keyLevels.priorDayHigh, 80, false);
  addCandidate("PDL", keyLevels.priorDayLow, 80, false);
  addCandidate("WEEKLY_HIGH", keyLevels.weeklyHigh, 70, false);
  addCandidate("WEEKLY_LOW", keyLevels.weeklyLow, 70, false);

  // Gamma levels (if available)
  if (keyLevels.optionsFlow) {
    addCandidate("CALL_WALL", keyLevels.optionsFlow.callWall ?? undefined, 95, true);
    addCandidate("PUT_WALL", keyLevels.optionsFlow.putWall ?? undefined, 95, true);
    addCandidate("MAX_PAIN", keyLevels.optionsFlow.maxPain ?? undefined, 75, true);
    addCandidate("GAMMA_WALL", keyLevels.optionsFlow.gammaWall ?? undefined, 90, true);
  }

  // Sort by weight (descending), then by distance (ascending)
  const sortCandidates = (candidates: AnchorCandidate[]) => {
    return candidates.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice);
    });
  };

  return {
    stopCandidates: sortCandidates(stopCandidates),
    targetCandidates: sortCandidates(targetCandidates),
  };
}

// ============================================================================
// Select Best Anchors
// ============================================================================

export interface SelectAnchorsInput {
  /** Key levels including structural and gamma levels */
  keyLevels: KeyLevels;
  /** Current underlying price */
  currentUnderlyingPrice: number;
  /** Trade direction */
  direction: "long" | "short";
  /** Current option premium (for dual price display) */
  currentOptionPremium?: number;
  /** Delta for premium calculation */
  delta?: number;
  /** ATR for fallback calculations */
  atr?: number;
  /** Trade type for profile selection */
  tradeType?: TradeType;
  /** Default TP/SL percentages for fallback */
  defaults?: { tpPercent?: number; slPercent?: number };
}

/**
 * Select plan anchors from key levels with rationale
 *
 * Priority:
 * 1. Gamma walls (highest conviction - dealer hedging creates real barriers)
 * 2. ORB levels (intraday key levels)
 * 3. VWAP (institutional fair value)
 * 4. Prior day levels (swing reference)
 * 5. ATR fallback (if nothing else)
 */
export function selectPlanAnchors(input: SelectAnchorsInput): TradePlanAnchors {
  const {
    keyLevels,
    currentUnderlyingPrice,
    direction,
    currentOptionPremium = 0,
    delta = 0.5,
    atr = 0,
    tradeType = "DAY",
    defaults = { tpPercent: 50, slPercent: 20 },
  } = input;

  const { stopCandidates, targetCandidates } = buildAnchorCandidates(
    keyLevels,
    currentUnderlyingPrice,
    direction
  );

  const warnings: string[] = [];
  const reasons: string[] = [];

  // ========== SELECT STOP ANCHOR ==========
  let stopAnchor: PlanAnchor;

  if (stopCandidates.length > 0) {
    const best = stopCandidates[0];
    const distancePercent = ((best.price - currentUnderlyingPrice) / currentUnderlyingPrice) * 100;
    const premiumMove = (best.price - currentUnderlyingPrice) * delta;

    stopAnchor = {
      type: best.type,
      price: best.price,
      reason: best.reason,
      underlyingPrice: best.price,
      premiumPrice: currentOptionPremium + premiumMove,
      distancePercent,
      isFallback: false,
    };

    if (best.isGamma) {
      reasons.push(`Stop anchored to ${best.type} (gamma-based)`);
    } else {
      reasons.push(`Stop anchored to ${best.type}`);
    }
  } else if (atr > 0) {
    // ATR fallback
    const multiplier = tradeType === "SCALP" ? 1.0 : tradeType === "DAY" ? 1.5 : 2.0;
    const stopPrice =
      direction === "long"
        ? currentUnderlyingPrice - atr * multiplier
        : currentUnderlyingPrice + atr * multiplier;
    const distancePercent = ((stopPrice - currentUnderlyingPrice) / currentUnderlyingPrice) * 100;
    const premiumMove = (stopPrice - currentUnderlyingPrice) * delta;

    stopAnchor = {
      type: "ATR_FALLBACK",
      price: stopPrice,
      reason: `${multiplier}x ATR stop (no structural level found)`,
      underlyingPrice: stopPrice,
      premiumPrice: currentOptionPremium + premiumMove,
      distancePercent,
      isFallback: true,
    };

    warnings.push("No structural stop level found - using ATR fallback");
    reasons.push("Stop based on ATR (volatility-adjusted)");
  } else {
    // Percent fallback
    const slPercent = defaults.slPercent || 20;
    const stopPrice =
      direction === "long"
        ? currentUnderlyingPrice * (1 - slPercent / 100 / 10) // ~2% underlying for 20% option
        : currentUnderlyingPrice * (1 + slPercent / 100 / 10);
    const distancePercent = ((stopPrice - currentUnderlyingPrice) / currentUnderlyingPrice) * 100;
    const premiumMove = (stopPrice - currentUnderlyingPrice) * delta;

    stopAnchor = {
      type: "PERCENT_FALLBACK",
      price: stopPrice,
      reason: `${slPercent}% option stop (no levels or ATR available)`,
      underlyingPrice: stopPrice,
      premiumPrice: currentOptionPremium * (1 - slPercent / 100),
      distancePercent,
      isFallback: true,
    };

    warnings.push("No structural levels or ATR - using percent-based fallback");
    reasons.push("Stop based on default risk percentage");
  }

  // ========== SELECT TARGET ANCHORS ==========
  const targets: TargetAnchor[] = [];

  if (targetCandidates.length > 0) {
    // Take up to 3 targets
    const labels: Array<"TP1" | "TP2" | "TP3"> = ["TP1", "TP2", "TP3"];

    targetCandidates.slice(0, 3).forEach((candidate, idx) => {
      const distancePercent =
        ((candidate.price - currentUnderlyingPrice) / currentUnderlyingPrice) * 100;
      const premiumMove = (candidate.price - currentUnderlyingPrice) * delta;

      targets.push({
        label: labels[idx],
        type: candidate.type,
        price: candidate.price,
        reason: candidate.reason,
        underlyingPrice: candidate.price,
        premiumPrice: currentOptionPremium + premiumMove,
        distancePercent,
        isFallback: false,
      });
    });

    if (targetCandidates.some((c) => c.isGamma)) {
      reasons.push("Targets include gamma-based levels");
    }
    reasons.push(`${targets.length} structural target(s) identified`);
  } else if (atr > 0) {
    // ATR fallback targets
    const multipliers =
      tradeType === "SCALP" ? [1.0, 1.5] : tradeType === "DAY" ? [1.5, 2.5, 3.5] : [2.0, 3.0, 4.0];
    const labels: Array<"TP1" | "TP2" | "TP3"> = ["TP1", "TP2", "TP3"];

    multipliers.slice(0, 3).forEach((mult, idx) => {
      const targetPrice =
        direction === "long"
          ? currentUnderlyingPrice + atr * mult
          : currentUnderlyingPrice - atr * mult;
      const distancePercent =
        ((targetPrice - currentUnderlyingPrice) / currentUnderlyingPrice) * 100;
      const premiumMove = (targetPrice - currentUnderlyingPrice) * delta;

      targets.push({
        label: labels[idx],
        type: "ATR_FALLBACK",
        price: targetPrice,
        reason: `${mult}x ATR target`,
        underlyingPrice: targetPrice,
        premiumPrice: currentOptionPremium + premiumMove,
        distancePercent,
        isFallback: true,
      });
    });

    warnings.push("No structural targets - using ATR-based levels");
    reasons.push("Targets based on ATR multiples");
  } else {
    // Percent fallback
    const tpPercent = defaults.tpPercent || 50;
    const multipliers = [tpPercent, tpPercent * 1.5, tpPercent * 2];
    const labels: Array<"TP1" | "TP2" | "TP3"> = ["TP1", "TP2", "TP3"];

    multipliers.slice(0, 2).forEach((pct, idx) => {
      const underlyingMove = (pct / 100 / 10) * currentUnderlyingPrice; // ~5% underlying for 50% option
      const targetPrice =
        direction === "long"
          ? currentUnderlyingPrice + underlyingMove
          : currentUnderlyingPrice - underlyingMove;
      const distancePercent =
        ((targetPrice - currentUnderlyingPrice) / currentUnderlyingPrice) * 100;

      targets.push({
        label: labels[idx],
        type: "PERCENT_FALLBACK",
        price: targetPrice,
        reason: `${pct.toFixed(0)}% option target`,
        underlyingPrice: targetPrice,
        premiumPrice: currentOptionPremium * (1 + pct / 100),
        distancePercent,
        isFallback: true,
      });
    });

    warnings.push("Using percent-based targets (no structural levels)");
    reasons.push("Targets based on default reward percentages");
  }

  // ========== CALCULATE PLAN QUALITY ==========
  let score = 50; // Base score

  // Bonus for structural (non-fallback) anchors
  if (!stopAnchor.isFallback) score += 20;
  targets.forEach((t) => {
    if (!t.isFallback) score += 10;
  });

  // Bonus for gamma-based anchors
  if (stopAnchor.type.includes("WALL") || stopAnchor.type === "GAMMA_WALL") score += 10;
  targets.forEach((t) => {
    if (t.type.includes("WALL") || t.type === "GAMMA_WALL") score += 5;
  });

  // Penalty for all fallbacks
  if (stopAnchor.isFallback && targets.every((t) => t.isFallback)) {
    score -= 20;
  }

  // Cap score
  score = Math.min(100, Math.max(0, score));

  const level: PlanQuality["level"] = score >= 70 ? "strong" : score >= 50 ? "moderate" : "weak";

  const planQuality: PlanQuality = {
    score,
    level,
    warnings,
    reasons,
  };

  return {
    stopAnchor,
    targets,
    planQuality,
    direction,
    currentUnderlyingPrice,
    tradeType,
  };
}

/**
 * Format anchor type for display
 */
export function formatAnchorType(type: AnchorType): string {
  const labels: Record<AnchorType, string> = {
    VWAP: "VWAP",
    ORB_HIGH: "ORB High",
    ORB_LOW: "ORB Low",
    PDH: "Prior Day High",
    PDL: "Prior Day Low",
    GAMMA_WALL: "Gamma Wall",
    CALL_WALL: "Call Wall",
    PUT_WALL: "Put Wall",
    MAX_PAIN: "Max Pain",
    WEEKLY_HIGH: "Weekly High",
    WEEKLY_LOW: "Weekly Low",
    ATR_FALLBACK: "ATR",
    PERCENT_FALLBACK: "Default %",
  };
  return labels[type] || type;
}

/**
 * Get short anchor label for compact display
 */
export function getShortAnchorLabel(type: AnchorType): string {
  const labels: Record<AnchorType, string> = {
    VWAP: "VWAP",
    ORB_HIGH: "ORH",
    ORB_LOW: "ORL",
    PDH: "PDH",
    PDL: "PDL",
    GAMMA_WALL: "GEX",
    CALL_WALL: "C.Wall",
    PUT_WALL: "P.Wall",
    MAX_PAIN: "MaxP",
    WEEKLY_HIGH: "WkH",
    WEEKLY_LOW: "WkL",
    ATR_FALLBACK: "ATR",
    PERCENT_FALLBACK: "%",
  };
  return labels[type] || type;
}
