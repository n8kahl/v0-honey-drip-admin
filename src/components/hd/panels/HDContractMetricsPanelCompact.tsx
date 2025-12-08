/**
 * HDContractMetricsPanelCompact - Compact vertical metrics panel for side-by-side with chart
 * Displays: Bid/Ask/Mid, Spread, Greeks, and Trade Targets in a narrow vertical layout
 */

import React from "react";
import type { Contract, Trade } from "../../../types";
import type { KeyLevels } from "../../../lib/riskEngine/types";

interface HDContractMetricsPanelCompactProps {
  contract: Contract;
  trade?: Trade | null;
  underlyingPrice?: number;
  keyLevels?: Partial<KeyLevels>;
  className?: string;
}

export function HDContractMetricsPanelCompact({
  contract,
  trade,
  underlyingPrice,
  keyLevels,
  className = "",
}: HDContractMetricsPanelCompactProps) {
  // Calculate spread percentage
  const spread = contract.ask - contract.bid;
  const spreadPercent = contract.mid > 0 ? (spread / contract.mid) * 100 : 0;
  const spreadQuality =
    spreadPercent < 2
      ? "excellent"
      : spreadPercent < 5
        ? "good"
        : spreadPercent < 10
          ? "fair"
          : "poor";
  const spreadColor = {
    excellent: "text-green-400",
    good: "text-emerald-400",
    fair: "text-yellow-400",
    poor: "text-red-400",
  }[spreadQuality];

  // Format volume with K/M suffix
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  // VWAP position relative to price
  const vwapPosition =
    keyLevels?.vwap && underlyingPrice
      ? underlyingPrice > keyLevels.vwap
        ? "Above"
        : underlyingPrice < keyLevels.vwap
          ? "Below"
          : "At"
      : undefined;
  const vwapColor =
    vwapPosition === "Above"
      ? "text-green-400"
      : vwapPosition === "Below"
        ? "text-red-400"
        : "text-yellow-400";

  // Calculate R:R if both target and stop are present
  const riskReward =
    trade?.targetPrice && trade?.stopLoss && trade?.contract?.mid
      ? (trade.targetPrice - trade.contract.mid) / (trade.contract.mid - trade.stopLoss)
      : null;

  return (
    <div
      className={`bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg p-3 space-y-3 ${className}`}
    >
      {/* Pricing Section */}
      <div className="space-y-2">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
          Contract Pricing
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
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

      {/* Spread & Volume */}
      <div className="border-t border-[var(--border-hairline)] pt-2 space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-[var(--text-muted)]">SPREAD</span>
          <span className={`text-xs font-semibold ${spreadColor}`}>
            {spreadPercent.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-[var(--text-muted)]">VOL</span>
          <span className="text-xs text-[var(--text-high)]">{formatVolume(contract.volume)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-[var(--text-muted)]">OI</span>
          <span className="text-xs text-[var(--text-high)]">
            {formatVolume(contract.openInterest)}
          </span>
        </div>
      </div>

      {/* Greeks */}
      {(contract.delta !== undefined || contract.theta !== undefined) && (
        <div className="border-t border-[var(--border-hairline)] pt-2 space-y-1">
          <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide">Greeks</div>
          <div className="flex justify-center gap-3 text-xs">
            {contract.delta !== undefined && (
              <span className="text-[var(--text-high)]">Δ {contract.delta?.toFixed(2)}</span>
            )}
            {contract.theta !== undefined && (
              <span className={contract.theta < 0 ? "text-red-400" : "text-green-400"}>
                Θ {contract.theta?.toFixed(2)}
              </span>
            )}
          </div>
          {contract.gamma !== undefined && contract.vega !== undefined && (
            <div className="flex justify-center gap-3 text-[10px] text-[var(--text-muted)]">
              <span>Γ {contract.gamma?.toFixed(3)}</span>
              <span>V {contract.vega?.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* VWAP Position */}
      {keyLevels?.vwap && (
        <div className="border-t border-[var(--border-hairline)] pt-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[var(--text-muted)]">VWAP</span>
            <div className="text-right">
              <span className="text-xs text-[var(--text-high)]">${keyLevels.vwap.toFixed(2)}</span>
              {vwapPosition && (
                <span className={`text-[9px] ml-1 ${vwapColor}`}>({vwapPosition})</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trade Targets */}
      {trade && (trade.targetPrice || trade.stopLoss) && (
        <div className="border-t border-[var(--border-hairline)] pt-2 space-y-1">
          <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide">Targets</div>
          {trade.targetPrice && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[var(--text-muted)]">TP</span>
              <span className="text-xs font-semibold text-green-400">
                ${trade.targetPrice.toFixed(2)}
              </span>
            </div>
          )}
          {trade.stopLoss && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[var(--text-muted)]">SL</span>
              <span className="text-xs font-semibold text-red-400">
                ${trade.stopLoss.toFixed(2)}
              </span>
            </div>
          )}
          {riskReward !== null && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[var(--text-muted)]">R:R</span>
              <span className="text-xs text-[var(--text-high)]">{riskReward.toFixed(1)}:1</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
