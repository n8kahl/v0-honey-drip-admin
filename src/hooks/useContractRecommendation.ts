/**
 * useContractRecommendation Hook
 *
 * Connects composite signals to contract recommendations.
 * When a symbol is clicked, this hook:
 * 1. Finds the top active signal for that symbol
 * 2. Determines the strategy type (e.g., gamma_squeeze, breakout, etc.)
 * 3. Scores available contracts based on that strategy's needs
 * 4. Returns the best contract(s) to highlight in the options chain
 */

import { useMemo } from "react";
import type { Contract } from "../types";
import type { CompositeSignal } from "../lib/composite/CompositeSignal";
import type { OpportunityType } from "../lib/composite/OpportunityDetector";
import {
  rankContractsForStrategy,
  getBestContractForStrategy,
  getStrategyCriteriaDescription,
  type ContractRecommendationResult,
} from "../lib/scoring/ContractRecommendationScorer";

export interface UseContractRecommendationOptions {
  /** Symbol to get recommendations for (e.g., "SPY", "SPX") */
  symbol: string;
  /** Available contracts from options chain */
  contracts: Contract[];
  /** Active signals from useCompositeSignals */
  activeSignals: CompositeSignal[];
  /** Current underlying price (for fallback ATM selection) */
  currentPrice?: number;
  /** Price change percent for trend detection (fallback when no signal) */
  changePercent?: number;
}

export interface ContractRecommendation {
  /** The top recommended contract for the detected strategy */
  bestContract: Contract | null;
  /** Full scoring result for the best contract */
  bestResult: ContractRecommendationResult | null;
  /** All contracts ranked by strategy fit */
  rankedContracts: ContractRecommendationResult[];
  /** The signal that drove this recommendation */
  drivingSignal: CompositeSignal | null;
  /** Strategy type from the signal */
  strategyType: OpportunityType | null;
  /** Direction from the signal */
  direction: "call" | "put" | null;
  /** Human-readable explanation of what contract is ideal for this strategy */
  strategyDescription: {
    description: string;
    rationale: string;
    idealDelta: string;
    idealDTE: string;
    needsHighGamma: boolean;
  } | null;
  /** Whether we have a confident recommendation */
  hasRecommendation: boolean;
  /** Confidence level in the recommendation */
  confidence: "high" | "medium" | "low" | "none";
}

/**
 * Get the top signal for a symbol (highest score among active signals)
 */
function getTopSignalForSymbol(symbol: string, signals: CompositeSignal[]): CompositeSignal | null {
  const symbolSignals = signals.filter(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase() && s.status === "ACTIVE"
  );

  if (symbolSignals.length === 0) return null;

  // Sort by base score descending
  symbolSignals.sort((a, b) => (b.baseScore ?? 0) - (a.baseScore ?? 0));

  return symbolSignals[0];
}

/**
 * Determine direction from signal
 */
function getDirectionFromSignal(signal: CompositeSignal): "call" | "put" {
  // Check signal direction
  if (signal.direction === "LONG") return "call";
  if (signal.direction === "SHORT") return "put";

  // Fallback: infer from opportunity type
  const type = signal.opportunityType;
  if (type.includes("bullish") || type.includes("long")) return "call";
  if (type.includes("bearish") || type.includes("short")) return "put";

  // Default to calls
  return "call";
}

/**
 * Hook to get contract recommendations based on active signals
 */
/**
 * Find the best ATM contract for a given direction and price
 */
function findATMContract(
  contracts: Contract[],
  currentPrice: number,
  direction: "call" | "put"
): Contract | null {
  const optionType = direction === "call" ? "C" : "P";

  // Filter by option type and find nearest DTE (1-3 days ideal for day trades)
  const filteredContracts = contracts.filter((c) => c.type === optionType);
  if (filteredContracts.length === 0) return null;

  // Sort by DTE first, then by distance from ATM
  const sorted = [...filteredContracts].sort((a, b) => {
    // Prefer 0-3 DTE
    const aDTE = a.daysToExpiry ?? 999;
    const bDTE = b.daysToExpiry ?? 999;
    const aIdealDTE = aDTE >= 0 && aDTE <= 3;
    const bIdealDTE = bDTE >= 0 && bDTE <= 3;

    if (aIdealDTE !== bIdealDTE) {
      return aIdealDTE ? -1 : 1;
    }

    // Then sort by distance from current price (ATM)
    const aDistance = Math.abs(a.strike - currentPrice);
    const bDistance = Math.abs(b.strike - currentPrice);
    return aDistance - bDistance;
  });

  return sorted[0] || null;
}

export function useContractRecommendation(
  options: UseContractRecommendationOptions
): ContractRecommendation {
  const { symbol, contracts, activeSignals, currentPrice, changePercent } = options;

  return useMemo(() => {
    // Default empty result
    const emptyResult: ContractRecommendation = {
      bestContract: null,
      bestResult: null,
      rankedContracts: [],
      drivingSignal: null,
      strategyType: null,
      direction: null,
      strategyDescription: null,
      hasRecommendation: false,
      confidence: "none",
    };

    if (!symbol || contracts.length === 0) {
      return emptyResult;
    }

    // Find the top signal for this symbol
    const topSignal = getTopSignalForSymbol(symbol, activeSignals);

    if (!topSignal) {
      // No signal - use ATM fallback based on trend
      if (!currentPrice || currentPrice <= 0) {
        return emptyResult;
      }

      // Determine direction from price change
      // Positive change = bullish = calls, Negative = bearish = puts
      const direction: "call" | "put" = (changePercent ?? 0) >= 0 ? "call" : "put";

      // Find the best ATM contract
      const atmContract = findATMContract(contracts, currentPrice, direction);

      if (!atmContract) {
        return emptyResult;
      }

      return {
        bestContract: atmContract,
        bestResult: null,
        rankedContracts: [],
        drivingSignal: null,
        strategyType: null,
        direction,
        strategyDescription: {
          description: `ATM ${direction === "call" ? "Call" : "Put"} (${(changePercent ?? 0) >= 0 ? "bullish" : "bearish"} trend)`,
          rationale: `No active signal. Defaulting to ATM ${direction} based on ${Math.abs(changePercent ?? 0).toFixed(2)}% ${(changePercent ?? 0) >= 0 ? "gain" : "loss"} today.`,
          idealDelta: "0.50",
          idealDTE: "0-3 DTE",
          needsHighGamma: false,
        },
        hasRecommendation: true,
        confidence: "low",
      };
    }

    // Get strategy and direction from signal
    const strategyType = topSignal.opportunityType as OpportunityType;
    const direction = getDirectionFromSignal(topSignal);

    // Get strategy description
    const strategyDescription = getStrategyCriteriaDescription(strategyType);

    // Rank contracts for this strategy
    const rankedContracts = rankContractsForStrategy(contracts, strategyType, direction);

    // Get best contract
    const bestResult = rankedContracts.length > 0 ? rankedContracts[0] : null;
    const bestContract = bestResult?.contract ?? null;

    // Determine confidence
    let confidence: "high" | "medium" | "low" | "none" = "none";
    if (bestResult) {
      if (bestResult.score >= 80 && bestResult.strategyFit === "excellent") {
        confidence = "high";
      } else if (bestResult.score >= 65 && bestResult.strategyFit !== "poor") {
        confidence = "medium";
      } else if (bestResult.score >= 50) {
        confidence = "low";
      }
    }

    return {
      bestContract,
      bestResult,
      rankedContracts,
      drivingSignal: topSignal,
      strategyType,
      direction,
      strategyDescription,
      hasRecommendation: bestContract !== null && confidence !== "none",
      confidence,
    };
  }, [symbol, contracts, activeSignals, currentPrice, changePercent]);
}

/**
 * Utility to check if a contract is the recommended one
 */
export function isRecommendedContract(
  contractId: string,
  recommendation: ContractRecommendation
): boolean {
  if (!recommendation.hasRecommendation) return false;
  return recommendation.bestContract?.id === contractId;
}

/**
 * Get all recommended contract IDs (including close seconds)
 */
export function getRecommendedContractIds(recommendation: ContractRecommendation): Set<string> {
  const ids = new Set<string>();
  for (const result of recommendation.rankedContracts) {
    if (result.isRecommended && result.contract.id) {
      ids.add(result.contract.id);
    }
  }
  return ids;
}
