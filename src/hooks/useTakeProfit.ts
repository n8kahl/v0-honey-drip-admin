/**
 * React hook for unified Take Profit calculations
 *
 * Provides consistent TP values across all UI components
 * with clear sourcing and confidence indicators.
 */

import { useMemo } from "react";
import type { Contract } from "../types";
import { useSettingsStore } from "../stores";
import {
  calculateTakeProfit,
  type TakeProfitInput,
  type TakeProfitResult,
} from "../lib/riskEngine/takeProfitCalculator";
import type { KeyLevels } from "../lib/riskEngine/types";

export interface UseTakeProfitInput {
  /** Entry price (contract price at entry) */
  entryPrice: number;

  /** Full contract details */
  contract: Pick<Contract, "expiration" | "strike" | "type" | "bid" | "ask">;

  /** User manual override (from trade.manualTP) */
  userOverride?: number;

  /** Key levels from confluence */
  keyLevels?: KeyLevels;

  /** Current underlying price */
  currentUnderlyingPrice?: number;

  /** Current option mid price */
  currentOptionMid?: number;

  /** ATR from market data */
  atr?: number;
}

/**
 * Calculate unified Take Profit with settings integration
 *
 * @example
 * ```tsx
 * const { targetPrice, source, label, confidence } = useTakeProfit({
 *   entryPrice: 15.50,
 *   contract: trade.contract,
 *   userOverride: trade.manualTP,
 *   keyLevels: trade.confluence?.keyLevels,
 *   atr: symbolData.atr,
 * });
 *
 * return (
 *   <div>
 *     TP: ${targetPrice.toFixed(2)}
 *     <span className="text-xs text-zinc-400">{label}</span>
 *     <ConfidenceBadge score={confidence} />
 *   </div>
 * );
 * ```
 */
export function useTakeProfit(input: UseTakeProfitInput): TakeProfitResult {
  // Get TP settings from settings store
  const tpMode = useSettingsStore((s) => s.tpSettings.tpMode);
  const tpPercent = useSettingsStore((s) => s.tpSettings.tpPercent);
  const slPercent = useSettingsStore((s) => s.tpSettings.slPercent);

  // Memoize calculation to prevent unnecessary recalculations
  const result = useMemo(() => {
    const calcInput: TakeProfitInput = {
      entryPrice: input.entryPrice,
      contract: input.contract,
      userOverride: input.userOverride,
      keyLevels: input.keyLevels,
      currentUnderlyingPrice: input.currentUnderlyingPrice,
      currentOptionMid: input.currentOptionMid,
      atr: input.atr,
      defaults: {
        mode: tpMode === "calculated" ? "calculated" : "percent",
        tpPercent,
        slPercent,
      },
    };

    return calculateTakeProfit(calcInput);
  }, [
    input.entryPrice,
    input.contract,
    input.userOverride,
    input.keyLevels,
    input.currentUnderlyingPrice,
    input.currentOptionMid,
    input.atr,
    tpMode,
    tpPercent,
    slPercent,
  ]);

  return result;
}

/**
 * Display-ready TP string with source indicator
 *
 * @example
 * ```tsx
 * const tpDisplay = useTakeProfitDisplay({
 *   entryPrice: 15.50,
 *   contract,
 *   showSource: true,
 * });
 * // Returns: "$23.25 ✓ Initial TP"
 * ```
 */
export function useTakeProfitDisplay(
  input: UseTakeProfitInput,
  options: { showSource?: boolean; showConfidence?: boolean } = {}
): string {
  const result = useTakeProfit(input);

  const price = `$${result.targetPrice.toFixed(2)}`;

  if (!options.showSource) return price;

  // Confidence indicator
  const confidenceIndicator = result.confidence >= 80 ? "✓" : result.confidence >= 60 ? "~" : "?";

  // Source label
  const parts = [price, confidenceIndicator, result.label];

  if (options.showConfidence) {
    parts.push(`(${result.confidence}%)`);
  }

  return parts.join(" ");
}
