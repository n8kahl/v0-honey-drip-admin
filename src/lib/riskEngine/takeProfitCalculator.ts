/**
 * Unified Take Profit Calculator
 *
 * Single source of truth for all TP calculations across the app.
 *
 * Priority Hierarchy:
 * 1. User manual override (if set after entry)
 * 2. Risk engine calculation (from entry data)
 * 3. DTE-based defaults (from settings store)
 * 4. Contract mid-price * 1.5 (fallback)
 *
 * Usage:
 * ```ts
 * const tp = calculateTakeProfit({
 *   entryPrice: 15.50,
 *   contract: {...},
 *   userOverride: trade.manualTP,  // if user adjusted
 *   keyLevels: {...},              // for levels mode
 *   atr: 12.5,                     // for ATR mode
 *   mode: 'levels',                // from settingsStore
 * });
 * ```
 */

import type { Contract } from "../../types";
import { calculateRisk } from "./calculator";
import type { RiskCalculationResult, KeyLevels, AdminRiskDefaults } from "./types";

export interface TakeProfitInput {
  /** Entry price (contract price at entry time) */
  entryPrice: number;

  /** Full contract details for DTE calculation */
  contract: Pick<Contract, "expiration" | "strike" | "type" | "bid" | "ask">;

  /** User manual override (highest priority) */
  userOverride?: number;

  /** Key levels for risk calculation */
  keyLevels?: KeyLevels;

  /** Current underlying price */
  currentUnderlyingPrice?: number;

  /** Current option mid price */
  currentOptionMid?: number;

  /** ATR value for ATR mode */
  atr?: number;

  /** Risk defaults from settings */
  defaults?: Partial<AdminRiskDefaults>;
}

export interface TakeProfitResult {
  /** Calculated target price */
  targetPrice: number;

  /** How this value was calculated */
  source: "user_override" | "risk_engine" | "dte_default" | "contract_mid_fallback";

  /** Human-readable label for UI */
  label: string;

  /** Confidence in this calculation (0-100) */
  confidence: number;

  /** Optional: Full risk calculation result if available */
  riskDetails?: RiskCalculationResult;
}

/**
 * Calculate Take Profit with clear priority hierarchy
 */
export function calculateTakeProfit(input: TakeProfitInput): TakeProfitResult {
  // Priority 1: User manual override
  if (input.userOverride !== undefined && input.userOverride > 0) {
    return {
      targetPrice: input.userOverride,
      source: "user_override",
      label: "Adjusted TP",
      confidence: 100, // User choice = 100% confidence
    };
  }

  // Priority 2: Risk engine calculation (if enough data)
  if (hasMinimalRiskData(input)) {
    try {
      const riskResult = calculateRisk({
        entryPrice: input.entryPrice,
        currentUnderlyingPrice: input.currentUnderlyingPrice || input.contract.strike,
        currentOptionMid: input.currentOptionMid || (input.contract.bid + input.contract.ask) / 2,
        keyLevels: input.keyLevels || {},
        atr: input.atr,
        defaults: {
          mode: input.defaults?.mode || "calculated",
          tpPercent: input.defaults?.tpPercent || 50,
          slPercent: input.defaults?.slPercent || 20,
          ...input.defaults,
        },
        expirationISO: input.contract.expiration,
      });

      // Validate risk engine output
      if (riskResult.targetPrice > 0 && riskResult.targetPrice !== input.entryPrice) {
        // Map confidence string to number
        const confidenceMap = { high: 85, medium: 65, low: 40 };
        return {
          targetPrice: riskResult.targetPrice,
          source: "risk_engine",
          label: "Initial TP",
          confidence: confidenceMap[riskResult.confidence],
          riskDetails: riskResult,
        };
      }
    } catch (error) {
      console.warn("[v0] Risk engine calculation failed:", error);
    }
  }

  // Priority 3: DTE-based defaults
  const dte = calculateDTE(input.contract.expiration);
  const tpPercent = input.defaults?.tpPercent;
  const dteDefault = getDTEBasedDefault(dte, input.entryPrice, tpPercent);

  if (dteDefault > 0) {
    return {
      targetPrice: dteDefault,
      source: "dte_default",
      label: "Default TP",
      confidence: 60, // Medium confidence - based on DTE strategy
    };
  }

  // Priority 4: Fallback - contract mid * 1.5
  const midPrice = (input.contract.bid + input.contract.ask) / 2;
  const fallbackPrice = midPrice * 1.5;

  return {
    targetPrice: fallbackPrice,
    source: "contract_mid_fallback",
    label: "Estimated TP",
    confidence: 30, // Low confidence - simple multiplier
  };
}

/**
 * Check if we have enough data for risk engine calculation
 */
function hasMinimalRiskData(input: TakeProfitInput): boolean {
  // For levels mode: need at least 2 key levels
  if (input.keyLevels) {
    const levelCount = Object.values(input.keyLevels).filter(
      (v) => v !== undefined && v > 0
    ).length;
    if (levelCount >= 2) return true;
  }

  // For ATR mode: need ATR
  if (input.atr && input.atr > 0) return true;

  // For percent mode: always works if we have defaults
  if (input.defaults?.tpPercent) return true;

  return false;
}

/**
 * Calculate Days to Expiration
 */
function calculateDTE(expirationISO: string): number {
  const expiry = new Date(expirationISO);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Get DTE-based default TP
 *
 * Strategy tiers:
 * - 0 DTE: 30-50% (scalp)
 * - 1-4 DTE: 50-100% (day trade)
 * - 5-29 DTE: 100-150% (swing)
 * - 30+ DTE: 150-200% (LEAP)
 */
function getDTEBasedDefault(dte: number, entryPrice: number, tpPercent?: number): number {
  let multiplier = 1.5; // Default 50% gain

  if (dte === 0) {
    // 0DTE: Scalp strategy - 30-50%
    multiplier = tpPercent ? 1 + tpPercent / 100 : 1.3;
  } else if (dte < 5) {
    // Day trade: 50-100%
    multiplier = tpPercent ? 1 + tpPercent / 100 : 1.5;
  } else if (dte < 30) {
    // Swing: 100-150%
    multiplier = tpPercent ? 1 + tpPercent / 100 : 2.0;
  } else {
    // LEAP: 150-200%
    multiplier = tpPercent ? 1 + tpPercent / 100 : 2.5;
  }

  return entryPrice * multiplier;
}

/**
 * Format TP for display with source indicator
 */
export function formatTakeProfitDisplay(result: TakeProfitResult, showSource = true): string {
  const price = `$${result.targetPrice.toFixed(2)}`;

  if (!showSource) return price;

  // Show label with confidence indicator
  const confidenceIndicator = result.confidence >= 80 ? "✓" : result.confidence >= 60 ? "~" : "?";
  return `${price} ${confidenceIndicator} ${result.label}`;
}

/**
 * Get all TP variants for comparison (useful for debugging)
 */
export function getAllTPVariants(input: TakeProfitInput): {
  userOverride?: TakeProfitResult;
  riskEngine?: TakeProfitResult;
  dteDefault: TakeProfitResult;
  fallback: TakeProfitResult;
  recommended: TakeProfitResult;
} {
  // Calculate each variant
  const userOverride = input.userOverride
    ? calculateTakeProfit({ ...input, keyLevels: undefined, atr: undefined })
    : undefined;

  const riskEngine = hasMinimalRiskData(input)
    ? calculateTakeProfit({ ...input, userOverride: undefined })
    : undefined;

  const dte = calculateDTE(input.contract.expiration);
  const tpPercent = input.defaults?.tpPercent;
  const dteDefaultPrice = getDTEBasedDefault(dte, input.entryPrice, tpPercent);
  const dteDefault: TakeProfitResult = {
    targetPrice: dteDefaultPrice,
    source: "dte_default",
    label: "Default TP",
    confidence: 60,
  };

  const midPrice = (input.contract.bid + input.contract.ask) / 2;
  const fallback: TakeProfitResult = {
    targetPrice: midPrice * 1.5,
    source: "contract_mid_fallback",
    label: "Estimated TP",
    confidence: 30,
  };

  // Recommended is the actual result
  const recommended = calculateTakeProfit(input);

  return {
    userOverride,
    riskEngine,
    dteDefault,
    fallback,
    recommended,
  };
}
