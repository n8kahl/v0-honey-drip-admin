/**
 * HDContractMetricsPanel - Shows contract pricing and key market levels
 * Displays: Bid/Ask/Mid, Spread, Volume/OI, VWAP position, ORB levels, Support/Resistance
 */

import React from "react";
import type { Contract, Trade } from "../../../types";
import type { KeyLevels } from "../../../lib/riskEngine/types";

interface HDContractMetricsPanelProps {
  contract: Contract;
  trade?: Trade | null;
  underlyingPrice?: number;
  keyLevels?: Partial<KeyLevels>;
  className?: string;
}

export function HDContractMetricsPanel({
  contract,
  trade,
  underlyingPrice,
  keyLevels,
  className = "",
}: HDContractMetricsPanelProps) {
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

  // ORB position
  const orbHigh = keyLevels?.orbHigh;
  const orbLow = keyLevels?.orbLow;
  const orbPosition =
    orbHigh && orbLow && underlyingPrice
      ? underlyingPrice > orbHigh
        ? "Above High"
        : underlyingPrice < orbLow
          ? "Below Low"
          : "Inside"
      : undefined;

  return (
    <div
      className={`bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg ${className}`}
    >
      {/* Contract Pricing Row */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="grid grid-cols-6 gap-4 text-center">
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Bid</div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              ${contract.bid.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Ask</div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              ${contract.ask.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Mid</div>
            <div className="text-sm font-semibold text-[var(--brand-primary)]">
              ${contract.mid.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Spread
            </div>
            <div className={`text-sm font-semibold ${spreadColor}`}>
              {spreadPercent.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Volume
            </div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              {formatVolume(contract.volume)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Open Int
            </div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              {formatVolume(contract.openInterest)}
            </div>
          </div>
        </div>
      </div>

      {/* Key Levels Row */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-4 text-center">
          {/* VWAP */}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">VWAP</div>
            {keyLevels?.vwap ? (
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold text-[var(--text-high)]">
                  ${keyLevels.vwap.toFixed(2)}
                </span>
                {vwapPosition && (
                  <span className={`text-[10px] ${vwapColor}`}>({vwapPosition})</span>
                )}
              </div>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">-</span>
            )}
          </div>

          {/* ORB */}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">ORB</div>
            {orbHigh && orbLow ? (
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-[var(--text-high)]">
                  H ${orbHigh.toFixed(2)} / L ${orbLow.toFixed(2)}
                </span>
                {orbPosition && (
                  <span
                    className={`text-[10px] ${orbPosition === "Above High" ? "text-green-400" : orbPosition === "Below Low" ? "text-red-400" : "text-yellow-400"}`}
                  >
                    ({orbPosition})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">-</span>
            )}
          </div>

          {/* Prior Day High/Low */}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Prior Day
            </div>
            {keyLevels?.priorDayHigh && keyLevels?.priorDayLow ? (
              <span className="text-[10px] text-[var(--text-high)]">
                H ${keyLevels.priorDayHigh.toFixed(2)} / L ${keyLevels.priorDayLow.toFixed(2)}
              </span>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">-</span>
            )}
          </div>

          {/* Greeks Summary */}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Greeks
            </div>
            {contract.delta !== undefined ? (
              <div className="flex items-center justify-center gap-2 text-[10px]">
                <span className="text-[var(--text-high)]">Δ {contract.delta?.toFixed(2)}</span>
                {contract.theta !== undefined && (
                  <span className={contract.theta < 0 ? "text-red-400" : "text-green-400"}>
                    Θ {contract.theta?.toFixed(2)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">-</span>
            )}
          </div>
        </div>
      </div>

      {/* Trade Targets Row (if trade loaded) */}
      {trade && (trade.targetPrice || trade.stopLoss) && (
        <div className="px-4 py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {trade.targetPrice && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)]">Target:</span>
                  <span className="text-xs font-semibold text-green-400">
                    ${trade.targetPrice.toFixed(2)}
                  </span>
                  {trade.targetUnderlyingPrice && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      | {trade.ticker} @ ${trade.targetUnderlyingPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
              {trade.stopLoss && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)]">Stop:</span>
                  <span className="text-xs font-semibold text-red-400">
                    ${trade.stopLoss.toFixed(2)}
                  </span>
                  {trade.stopUnderlyingPrice && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      | {trade.ticker} @ ${trade.stopUnderlyingPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {trade.targetPrice && trade.stopLoss && trade.contract.mid && (
              <div className="text-[10px] text-[var(--text-muted)]">
                R:R{" "}
                {(
                  (trade.targetPrice - trade.contract.mid) /
                  (trade.contract.mid - trade.stopLoss)
                ).toFixed(1)}
                :1
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
