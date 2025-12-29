import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { cn } from "../../../lib/utils";
import { useTradeStore } from "../../../stores";
import { useRef, useEffect, useState, useMemo } from "react";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { Wifi, WifiOff } from "lucide-react";
import { calculateRealizedPnL, getEntryPriceFromUpdates } from "../../../lib/tradePnl";
import { formatExpirationShort } from "../../../ui/semantics";

interface HDActiveTradeRowProps {
  trade: Trade;
  active?: boolean;
  onClick?: () => void;
}

/**
 * Active trade row with P&L display.
 * Features real-time P&L updates via WebSocket/REST streaming.
 * Features P&L bump animation on value changes.
 */
export function HDActiveTradeRow({ trade, active, onClick }: HDActiveTradeRowProps) {
  // Get contract details for streaming
  const contractTicker =
    trade.contract?.id || trade.contract?.ticker || trade.contract?.symbol || null;
  const entryPrice =
    trade.entryPrice || getEntryPriceFromUpdates(trade.updates || []) || trade.contract?.mid || 0;
  const realizedPnL = useMemo(() => calculateRealizedPnL(trade), [trade]);

  // Subscribe to LIVE price data via WebSocket/REST transport
  const {
    pnlPercent: livePnlPercent,
    currentPrice: liveCurrentPrice,
    source,
    asOf,
    isStale,
  } = useActiveTradePnL(trade.id, contractTicker, entryPrice);

  // Use live data if available, fallback to store's current price
  const currentPrice =
    liveCurrentPrice > 0
      ? liveCurrentPrice
      : trade.currentPrice || trade.last_option_price || entryPrice;
  const displayPnl =
    liveCurrentPrice > 0
      ? livePnlPercent
      : entryPrice > 0
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : (trade.movePercent ?? 0);
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
  }, [displayPnl, liveCurrentPrice]); // Added liveCurrentPrice to trigger on live updates

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Focus on this trade by setting its ID in the store
      useTradeStore.getState().setCurrentTradeId(trade.id);
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
          <div className="text-xs flex items-center gap-1">
            <span className="text-[var(--text-muted)]">
              {trade.contract?.strike}
              {trade.contract?.type}
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span
              className={cn(
                "font-semibold",
                trade.contract?.daysToExpiry === 0
                  ? "text-red-500"
                  : trade.contract?.daysToExpiry <= 3
                    ? "text-orange-500"
                    : trade.contract?.daysToExpiry <= 7
                      ? "text-yellow-500"
                      : "text-green-500"
              )}
            >
              {trade.contract?.daysToExpiry} DTE
            </span>
            {trade.contract?.expiry && (
              <>
                <span className="text-[var(--text-faint)]">•</span>
                <span className="text-[10px] text-[var(--text-faint)]">
                  Exp: {formatExpirationShort(trade.contract.expiry)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Live Indicator + P&L */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Live data indicator */}
            {source === "websocket" && !isStale ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : isStale ? (
              <WifiOff className="w-3 h-3 text-amber-500" />
            ) : null}
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
          </div>
          <div
            className={cn(
              "text-[10px] tabular-nums",
              realizedPnL.realizedPercent >= 0
                ? "text-[var(--accent-positive)]/80"
                : "text-[var(--accent-negative)]/80"
            )}
          >
            Realized {realizedPnL.realizedPercent >= 0 ? "+" : ""}
            {realizedPnL.realizedPercent.toFixed(1)}%
          </div>
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
