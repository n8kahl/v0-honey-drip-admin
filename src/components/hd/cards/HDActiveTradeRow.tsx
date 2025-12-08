import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { cn } from "../../../lib/utils";
import { useTradeStore } from "../../../stores";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { useRef, useEffect, useState } from "react";

interface HDActiveTradeRowProps {
  trade: Trade;
  active?: boolean;
  onClick?: () => void;
}

/**
 * Active trade row with live P&L tracking via WebSocket/REST polling.
 * Uses useActiveTradePnL hook for real-time price updates.
 * Features P&L bump animation on value changes.
 */
export function HDActiveTradeRow({ trade, active, onClick }: HDActiveTradeRowProps) {
  // Get live P&L from contract price updates
  // The contract.id is the OCC symbol (e.g., "O:SPY250110P00650000")
  const contractTicker = trade.contract?.id || null;
  const entryPrice = trade.entryPrice || trade.contract?.mid || 0;

  const { pnlPercent, currentPrice, source } = useActiveTradePnL(contractTicker, entryPrice);

  // Use live P&L if available, fallback to stored movePercent
  const displayPnl = entryPrice > 0 && currentPrice > 0 ? pnlPercent : (trade.movePercent ?? 0);
  const isProfit = displayPnl >= 0;

  // P&L bump animation state
  const [pnlBump, setPnlBump] = useState(false);
  const prevPnlRef = useRef<number>(displayPnl);

  useEffect(() => {
    // Trigger bump animation when P&L changes significantly (>0.5%)
    const diff = Math.abs(displayPnl - prevPnlRef.current);
    if (diff > 0.5) {
      setPnlBump(true);
      const timeout = setTimeout(() => setPnlBump(false), 300);
      prevPnlRef.current = displayPnl;
      return () => clearTimeout(timeout);
    }
    prevPnlRef.current = displayPnl;
  }, [displayPnl]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      useTradeStore.setState({ currentTrade: trade, tradeState: trade.state });
    }
  };

  return (
    <div
      className={cn(
        "w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] group min-h-[52px]",
        "cursor-pointer hover:bg-[var(--surface-2)] transition-colors duration-150 ease-out touch-manipulation",
        active && "bg-blue-500/10 border-l-2 border-l-blue-500 shadow-sm"
      )}
      onClick={handleClick}
      data-testid={`active-trade-${trade.id}`}
    >
      <div className="flex-1 flex items-center justify-between text-left gap-3">
        {/* Left: Contract Details */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-medium">{trade.ticker}</span>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {trade.contract?.strike}
            {trade.contract?.type} · {trade.contract?.daysToExpiry}
            <span className="ml-1 font-semibold text-green-500">DTE</span>
          </div>
        </div>

        {/* Right: P&L */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-[var(--text-high)] font-mono text-sm font-medium tabular-nums",
              isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]",
              pnlBump && "animate-pnl-bump"
            )}
          >
            {isProfit ? "+" : ""}
            {displayPnl.toFixed(2)}%
          </span>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[9px] uppercase tracking-wide border",
                isProfit
                  ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border-[var(--accent-positive)]/30"
                  : "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] border-[var(--accent-negative)]/30"
              )}
            >
              {isProfit ? "Profit" : "Loss"}
            </span>
            {/* Live indicator */}
            {source === "websocket" && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Live" />
            )}
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // For active trades, click to view details (no remove action)
        }}
        className="ml-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all touch-manipulation active:scale-95"
        title="View active trade details"
      >
        <span aria-hidden>&#9889;</span>
      </button>
    </div>
  );
}
