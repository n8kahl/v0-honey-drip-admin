/**
 * HDContractMetricsPanelCompact - Compact vertical metrics panel for side-by-side with chart
 *
 * Phase 2 Redesign:
 * - Key Levels (VWAP, ORB, Prior Day) - ALWAYS visible (underlying-dependent)
 * - Bid/Ask (real-time) - ALWAYS visible
 * - Take Profit Progress Bars - Show when contract loaded, animate when ENTERED
 */

import React, { useMemo } from "react";
import type { Contract, Trade } from "../../../types";
import type { KeyLevels } from "../../../lib/riskEngine/types";

interface HDContractMetricsPanelCompactProps {
  /** Contract data (nullable - panel still shows Key Levels when no contract) */
  contract: Contract | null;
  trade?: Trade | null;
  underlyingPrice?: number;
  keyLevels?: Partial<KeyLevels>;
  className?: string;
}

/** Calculate progress percentage towards a target */
function calculateProgress(entryPrice: number, currentPrice: number, targetPrice: number): number {
  if (targetPrice === entryPrice) return 0;
  const progress = ((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100;
  return Math.min(100, Math.max(0, progress));
}

/** Format price for display */
function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null || isNaN(price)) return "—";
  return `$${price.toFixed(2)}`;
}

export function HDContractMetricsPanelCompact({
  contract,
  trade,
  underlyingPrice,
  keyLevels,
  className = "",
}: HDContractMetricsPanelCompactProps) {
  // Check if trade is in ENTERED state (for progress bar animation)
  const isEntered = trade?.state === "ENTERED";

  // Get entry price (for progress calculation)
  const entryPrice = trade?.entryPrice || trade?.contract?.mid || 0;

  // Get current contract price (real-time updates)
  const currentContractPrice = contract?.mid || 0;

  // Calculate VWAP position
  const vwapPosition = useMemo(() => {
    if (!keyLevels?.vwap || !underlyingPrice) return null;
    if (underlyingPrice > keyLevels.vwap) return { label: "Above", color: "text-green-400" };
    if (underlyingPrice < keyLevels.vwap) return { label: "Below", color: "text-red-400" };
    return { label: "At", color: "text-yellow-400" };
  }, [keyLevels?.vwap, underlyingPrice]);

  // Calculate price change percentage
  const priceChange = useMemo(() => {
    if (!underlyingPrice || !keyLevels?.priorDayClose) return null;
    const change = ((underlyingPrice - keyLevels.priorDayClose) / keyLevels.priorDayClose) * 100;
    return {
      value: change,
      label: change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`,
      color: change >= 0 ? "text-green-400" : "text-red-400",
    };
  }, [underlyingPrice, keyLevels?.priorDayClose]);

  // Build take profit targets with progress
  const tpTargets = useMemo(() => {
    if (!trade) return [];

    const targets: Array<{
      label: string;
      price: number;
      progress: number;
      percentGain: number;
    }> = [];

    // T1 - primary target
    if (trade.targetPrice) {
      const percentGain =
        entryPrice > 0 ? ((trade.targetPrice - entryPrice) / entryPrice) * 100 : 0;
      targets.push({
        label: "T1",
        price: trade.targetPrice,
        progress: isEntered
          ? calculateProgress(entryPrice, currentContractPrice, trade.targetPrice)
          : 0,
        percentGain,
      });
    }

    // T2 and T3 from dynamic targets if available
    const dynamicTargets = (trade as any).dynamicTargets;
    if (dynamicTargets?.t2) {
      const percentGain =
        entryPrice > 0 ? ((dynamicTargets.t2 - entryPrice) / entryPrice) * 100 : 0;
      targets.push({
        label: "T2",
        price: dynamicTargets.t2,
        progress: isEntered
          ? calculateProgress(entryPrice, currentContractPrice, dynamicTargets.t2)
          : 0,
        percentGain,
      });
    }
    if (dynamicTargets?.t3) {
      const percentGain =
        entryPrice > 0 ? ((dynamicTargets.t3 - entryPrice) / entryPrice) * 100 : 0;
      targets.push({
        label: "T3",
        price: dynamicTargets.t3,
        progress: isEntered
          ? calculateProgress(entryPrice, currentContractPrice, dynamicTargets.t3)
          : 0,
        percentGain,
      });
    }

    return targets;
  }, [trade, entryPrice, currentContractPrice, isEntered]);

  return (
    <div
      className={`bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg p-3 space-y-3 overflow-y-auto ${className}`}
    >
      {/* Underlying Price - Real-time Bid/Ask */}
      <div className="space-y-2">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
          Underlying
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-[var(--text-high)]">
            {formatPrice(underlyingPrice)}
          </span>
          {priceChange && (
            <span className={`text-xs font-medium ${priceChange.color}`}>{priceChange.label}</span>
          )}
        </div>
      </div>

      {/* Key Levels Section */}
      <div className="border-t border-[var(--border-hairline)] pt-2 space-y-1.5">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
          Key Levels
        </div>

        {/* VWAP */}
        {keyLevels?.vwap && (
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[var(--text-muted)]">VWAP</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--text-high)]">{formatPrice(keyLevels.vwap)}</span>
              {vwapPosition && (
                <span className={`text-[9px] ${vwapPosition.color}`}>({vwapPosition.label})</span>
              )}
            </div>
          </div>
        )}

        {/* ORB High/Low */}
        {(keyLevels?.orbHigh || keyLevels?.orbLow) && (
          <>
            {keyLevels?.orbHigh && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">ORB High</span>
                <span className="text-xs text-green-400">{formatPrice(keyLevels.orbHigh)}</span>
              </div>
            )}
            {keyLevels?.orbLow && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">ORB Low</span>
                <span className="text-xs text-red-400">{formatPrice(keyLevels.orbLow)}</span>
              </div>
            )}
          </>
        )}

        {/* Prior Day High/Low */}
        {(keyLevels?.priorDayHigh || keyLevels?.priorDayLow) && (
          <>
            {keyLevels?.priorDayHigh && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">PDH</span>
                <span className="text-xs text-[var(--text-high)]">
                  {formatPrice(keyLevels.priorDayHigh)}
                </span>
              </div>
            )}
            {keyLevels?.priorDayLow && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">PDL</span>
                <span className="text-xs text-[var(--text-high)]">
                  {formatPrice(keyLevels.priorDayLow)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Pre-Market High/Low */}
        {(keyLevels?.preMarketHigh || keyLevels?.preMarketLow) && (
          <>
            {keyLevels?.preMarketHigh && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">PM High</span>
                <span className="text-xs text-amber-400">
                  {formatPrice(keyLevels.preMarketHigh)}
                </span>
              </div>
            )}
            {keyLevels?.preMarketLow && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">PM Low</span>
                <span className="text-xs text-amber-400">
                  {formatPrice(keyLevels.preMarketLow)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Options Flow Levels - Institutional positioning */}
        {(keyLevels?.optionsFlow?.callWall ||
          keyLevels?.optionsFlow?.putWall ||
          keyLevels?.optionsFlow?.maxPain) && (
          <div className="border-t border-[var(--border-hairline)]/50 pt-1.5 mt-1.5 space-y-1">
            <div className="text-[8px] text-pink-400 uppercase tracking-wide font-medium">
              Options Flow
            </div>
            {keyLevels?.optionsFlow?.callWall && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">Call Wall</span>
                <span className="text-xs text-emerald-400">
                  {formatPrice(keyLevels.optionsFlow.callWall)}
                </span>
              </div>
            )}
            {keyLevels?.optionsFlow?.putWall && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">Put Wall</span>
                <span className="text-xs text-red-400">
                  {formatPrice(keyLevels.optionsFlow.putWall)}
                </span>
              </div>
            )}
            {keyLevels?.optionsFlow?.maxPain && (
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-[var(--text-muted)]">Max Pain</span>
                <span className="text-xs text-purple-400">
                  {formatPrice(keyLevels.optionsFlow.maxPain)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* No key levels available - show nothing if data unavailable (stocks plan not available) */}
        {!keyLevels && (
          <div className="text-[10px] text-[var(--text-faint)] italic">Levels unavailable</div>
        )}
      </div>

      {/* Contract Bid/Ask - Only when contract loaded */}
      {contract && (
        <div className="border-t border-[var(--border-hairline)] pt-2 space-y-1.5">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
            Contract
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-[9px] text-[var(--text-muted)]">BID</div>
              <div className="text-xs font-semibold text-[var(--text-high)]">
                ${contract.bid.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-[var(--text-muted)]">ASK</div>
              <div className="text-xs font-semibold text-[var(--text-high)]">
                ${contract.ask.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-[var(--text-muted)]">MID</div>
              <div className="text-xs font-semibold text-[var(--brand-primary)]">
                ${contract.mid.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Take Profit Targets with Progress Bars */}
      {tpTargets.length > 0 && (
        <div className="border-t border-[var(--border-hairline)] pt-2 space-y-2">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
            Take Profit Targets
          </div>

          {tpTargets.map((target) => (
            <div key={target.label} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">
                  {target.label}: {formatPrice(target.price)}
                </span>
                <span className="text-green-400 font-medium">
                  +{target.percentGain.toFixed(0)}%
                </span>
              </div>
              {/* Progress Bar */}
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300 ease-out"
                  style={{ width: `${target.progress}%` }}
                />
              </div>
            </div>
          ))}

          {/* Stop Loss */}
          {trade?.stopLoss && (
            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-[var(--text-muted)]">SL: {formatPrice(trade.stopLoss)}</span>
              <span className="text-red-400 font-medium">
                {entryPrice > 0
                  ? `${(((trade.stopLoss - entryPrice) / entryPrice) * 100).toFixed(0)}%`
                  : "—"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Loading state when no contract and no key levels */}
      {!contract && !keyLevels?.vwap && (
        <div className="text-center py-4">
          <div className="text-[10px] text-[var(--text-muted)]">
            Select a symbol to view key levels
          </div>
        </div>
      )}
    </div>
  );
}
