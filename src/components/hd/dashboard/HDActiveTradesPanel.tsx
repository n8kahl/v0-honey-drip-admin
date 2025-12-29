import { useMemo } from "react";
import { useTradeStore } from "../../../stores";
import { Trade } from "../../../types";
import { TrendingUp, TrendingDown, MoveUp, X, Scissors, Wifi } from "lucide-react";
import { cn, formatPrice, formatPercent } from "../../../lib/utils";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { calculateRealizedPnL, getEntryPriceFromUpdates } from "../../../lib/tradePnl";

interface HDActiveTradesPanelProps {
  onTradeClick?: (trade: Trade) => void;
  onTrimClick?: (trade: Trade) => void;
  onMoveSLClick?: (trade: Trade) => void;
  onExitClick?: (trade: Trade) => void;
}

/**
 * Individual entered trade row with LIVE P&L via useActiveTradePnL hook.
 * Extracted as a separate component so each trade can have its own hook subscription.
 */
function EnteredTradeItem({
  trade,
  isUpdated,
  onTradeClick,
  onTrimClick,
  onMoveSLClick,
  onExitClick,
}: {
  trade: Trade;
  isUpdated: boolean;
  onTradeClick?: (trade: Trade) => void;
  onTrimClick?: (trade: Trade) => void;
  onMoveSLClick?: (trade: Trade) => void;
  onExitClick?: (trade: Trade) => void;
}) {
  // ✅ FIX: Use live P&L hook instead of stale store data
  const contractTicker =
    trade.contract?.id || trade.contract?.ticker || trade.contract?.symbol || null;
  const entryPrice =
    trade.entryPrice || getEntryPriceFromUpdates(trade.updates || []) || trade.contract?.mid || 0;
  const realizedPnL = useMemo(() => calculateRealizedPnL(trade), [trade]);
  const { currentPrice, pnlPercent, source } = useActiveTradePnL(
    trade.id,
    contractTicker,
    entryPrice
  );

  // Use live data, fallback to stored movePercent if no live data yet
  const displayPnlPercent = currentPrice > 0 ? pnlPercent : (trade.movePercent ?? 0);
  const displayCurrentPrice = currentPrice > 0 ? currentPrice : (trade.currentPrice ?? 0);
  const isProfit = displayPnlPercent >= 0;

  // Calculate dollar P&L from live percent (entry * percent / 100)
  const pnlDollars = entryPrice > 0 ? (entryPrice * displayPnlPercent) / 100 : 0;

  return (
    <div
      className={cn(
        "p-3 hover:bg-[var(--surface-2)] transition-colors cursor-pointer",
        isUpdated && "bg-[var(--brand-primary)]/10"
      )}
      onClick={() => onTradeClick?.(trade)}
    >
      {/* Header: Ticker + Contract */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-high)]">{trade.ticker}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {trade.contract.strike}
            {trade.contract.type} {trade.contract.daysToExpiry}DTE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Live indicator */}
          <Wifi
            className={cn("w-3 h-3", source === "websocket" ? "text-green-500" : "text-yellow-500")}
          />
          <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]">
            Entered
          </span>
        </div>
      </div>

      {/* P&L */}
      <div className="mb-3">
        <div
          className={cn(
            "text-xl font-semibold tabular-nums",
            isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {isProfit ? "+" : ""}
          {formatPercent(displayPnlPercent)} (${formatPrice(Math.abs(pnlDollars))})
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
          Realized {realizedPnL.realizedPercent >= 0 ? "+" : ""}
          {realizedPnL.realizedPercent.toFixed(1)}% ({realizedPnL.realizedDollars >= 0 ? "+" : "-"}
          {formatPrice(Math.abs(realizedPnL.realizedDollars))})
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">
          Entry: ${formatPrice(entryPrice)} • Current: ${formatPrice(displayCurrentPrice)}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrimClick?.(trade);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[var(--surface-3)] hover:bg-[var(--brand-primary)]/20 text-xs font-medium text-[var(--text-high)] transition-colors"
          title="Trim position"
        >
          <Scissors className="w-3.5 h-3.5" />
          Trim
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveSLClick?.(trade);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[var(--surface-3)] hover:bg-[var(--brand-primary)]/20 text-xs font-medium text-[var(--text-high)] transition-colors"
          title="Move stop loss"
        >
          <MoveUp className="w-3.5 h-3.5" />
          Move SL
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExitClick?.(trade);
          }}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-[var(--accent-negative)]/20 hover:bg-[var(--accent-negative)]/30 text-xs font-medium text-[var(--accent-negative)] transition-colors"
          title="Exit position"
        >
          <X className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>
    </div>
  );
}

export function HDActiveTradesPanel({
  onTradeClick,
  onTrimClick,
  onMoveSLClick,
  onExitClick,
}: HDActiveTradesPanelProps) {
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const updatedTradeIds = useTradeStore((state) => state.updatedTradeIds);

  // Separate by state
  const enteredTrades = activeTrades.filter((t) => t.state === "ENTERED");
  const loadedTrades = activeTrades.filter((t) => t.state === "LOADED");

  if (activeTrades.length === 0) {
    return (
      <div className="w-full lg:w-[360px] border-l border-[var(--border-hairline)] flex flex-col bg-[var(--surface-1)]">
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <h2 className="text-sm font-medium text-[var(--text-high)]">Active Trades</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No active trades</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Load a trade from the watchlist</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-[360px] border-l border-[var(--border-hairline)] flex flex-col bg-[var(--surface-1)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-hairline)] flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text-high)]">
          Active Trades ({activeTrades.length})
        </h2>
      </div>

      {/* Scrollable Trade List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
        {/* Entered Trades (Priority) - Each uses live P&L hook */}
        {enteredTrades.map((trade) => (
          <EnteredTradeItem
            key={trade.id}
            trade={trade}
            isUpdated={updatedTradeIds.has(trade.id)}
            onTradeClick={onTradeClick}
            onTrimClick={onTrimClick}
            onMoveSLClick={onMoveSLClick}
            onExitClick={onExitClick}
          />
        ))}

        {/* Loaded Trades (Secondary) */}
        {loadedTrades.map((trade) => {
          const isUpdated = updatedTradeIds.has(trade.id);

          return (
            <div
              key={trade.id}
              className={cn(
                "p-3 hover:bg-[var(--surface-2)] transition-colors cursor-pointer",
                isUpdated && "bg-[var(--brand-primary)]/10"
              )}
              onClick={() => onTradeClick?.(trade)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-high)]">
                    {trade.ticker}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {trade.contract.strike}
                    {trade.contract.type} {trade.contract.daysToExpiry}DTE
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  Loaded
                </span>
              </div>

              {/* Contract Details */}
              <div className="text-xs text-[var(--text-muted)]">
                Mid: ${formatPrice(trade.contract.mid)} • Target: {trade.tradeType}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
