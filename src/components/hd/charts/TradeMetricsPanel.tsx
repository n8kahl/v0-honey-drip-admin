/**
 * TradeMetricsPanel - Shows P&L % and trade metrics for active trades
 * Displayed below chart in ENTERED state
 */

import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { Trade, Contract } from "../../../types";

interface TradeMetricsPanelProps {
  trade: Trade;
  contract: Contract;
  currentPrice: number;
  isExpanded?: boolean;
}

export function TradeMetricsPanel({
  trade,
  contract,
  currentPrice,
  isExpanded: initialExpanded = false,
}: TradeMetricsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  if (!trade.entryPrice) {
    return null;
  }

  // Calculate P&L percentage
  const pnlPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  const pnlColor = pnlPercent >= 0 ? "text-green-500" : "text-red-500";
  const bgColor = pnlPercent >= 0 ? "bg-green-950" : "bg-red-950";

  // Calculate other metrics
  const movePercent = pnlPercent;
  const movePrice = currentPrice - trade.entryPrice;
  const riskRewardRatio = trade.targetPrice
    ? Math.abs((trade.targetPrice - trade.entryPrice) / (trade.entryPrice - (trade.stopLoss || 0)))
    : 0;

  const daysToExpiry = contract.daysToExpiry;
  const isDTE0 = daysToExpiry === 0;
  const isNearExpiry = daysToExpiry <= 7;

  return (
    <div className={`border-t border-gray-700 ${bgColor} transition-colors`}>
      {/* Compact View - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 hover:bg-gray-800/50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-400">P&L</span>
            <span className={`text-xl font-bold ${pnlColor}`}>
              {movePercent >= 0 ? "+" : ""}
              {movePercent.toFixed(2)}%
            </span>
          </div>

          <div className="flex flex-col items-start border-l border-gray-600 pl-4">
            <span className="text-xs text-gray-400">Price Move</span>
            <span className={`text-lg font-semibold ${pnlColor}`}>
              {movePrice >= 0 ? "+" : ""}${movePrice.toFixed(2)}
            </span>
          </div>

          {/* DTE Warning */}
          {isDTE0 && (
            <div className="flex flex-col items-start border-l border-gray-600 pl-4 bg-red-900/30 px-2 py-1 rounded">
              <span className="text-xs text-red-300 font-semibold">0DTE</span>
              <span className="text-xs text-red-400">Expiry Today</span>
            </div>
          )}
          {isNearExpiry && !isDTE0 && (
            <div className="flex flex-col items-start border-l border-gray-600 pl-4">
              <span className="text-xs text-yellow-400 font-semibold">{daysToExpiry}DTE</span>
              <span className="text-xs text-yellow-500">Near Expiry</span>
            </div>
          )}
        </div>

        <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* Expanded View - Detailed Metrics */}
      {isExpanded && (
        <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-400">Entry Price</div>
            <div className="text-sm font-semibold">${trade.entryPrice.toFixed(2)}</div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Current Price</div>
            <div className="text-sm font-semibold">${currentPrice.toFixed(2)}</div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Target (TP)</div>
            <div className="text-sm font-semibold text-green-400">
              ${trade.targetPrice?.toFixed(2) || "N/A"}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400">Stop Loss</div>
            <div className="text-sm font-semibold text-red-400">
              ${trade.stopLoss?.toFixed(2) || "N/A"}
            </div>
          </div>

          {/* Greeks for Options */}
          {contract.delta !== undefined && (
            <>
              <div>
                <div className="text-xs text-gray-400">Delta</div>
                <div className="text-sm font-semibold">{contract.delta?.toFixed(3) || "-"}</div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Theta</div>
                <div
                  className={`text-sm font-semibold ${(contract.theta ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}
                >
                  {contract.theta?.toFixed(4) || "-"}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">IV</div>
                <div className="text-sm font-semibold">{contract.iv?.toFixed(2) || "-"}%</div>
              </div>

              <div>
                <div className="text-xs text-gray-400">DTE</div>
                <div
                  className={`text-sm font-semibold ${isDTE0 ? "text-red-400" : isNearExpiry ? "text-yellow-400" : ""}`}
                >
                  {daysToExpiry}
                </div>
              </div>
            </>
          )}

          {/* Risk/Reward */}
          {riskRewardRatio > 0 && (
            <div>
              <div className="text-xs text-gray-400">Risk/Reward</div>
              <div className="text-sm font-semibold text-blue-400">
                {riskRewardRatio.toFixed(2)}:1
              </div>
            </div>
          )}

          {/* Entry Time */}
          {trade.entryTime && (
            <div>
              <div className="text-xs text-gray-400">Entry Time</div>
              <div className="text-sm font-semibold">
                {new Date(trade.entryTime).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            </div>
          )}

          {/* Duration */}
          {trade.entryTime && (
            <div>
              <div className="text-xs text-gray-400">Duration</div>
              <div className="text-sm font-semibold">
                {formatDuration(Date.now() - new Date(trade.entryTime).getTime())}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
