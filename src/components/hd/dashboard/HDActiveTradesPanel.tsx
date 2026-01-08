import { useMemo } from "react";
import { useTradeStore } from "../../../stores";
import { Trade } from "../../../types";
import { TrendingUp, ChevronRight } from "lucide-react";
import { cn, formatPrice, formatPercent } from "../../../lib/utils";
import { normalizeSymbolForAPI } from "../../../lib/symbolUtils";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { useFlowContext } from "../../../hooks/useFlowContext";
import { getEntryPriceFromUpdates } from "../../../lib/tradePnl";

interface HDActiveTradesPanelProps {
  onTradeClick?: (trade: Trade) => void;
}

/**
 * Determine thesis status based on flow vs trade direction
 * Returns: "aligned" | "diverging" | "neutral"
 */
function getThesisStatus(
  tradeDirection: "call" | "put",
  flowSentiment: "BULLISH" | "BEARISH" | "NEUTRAL"
): "aligned" | "diverging" | "neutral" {
  const isLong = tradeDirection === "call";
  const isBullishFlow = flowSentiment === "BULLISH";
  const isBearishFlow = flowSentiment === "BEARISH";

  if ((isLong && isBullishFlow) || (!isLong && isBearishFlow)) {
    return "aligned";
  }
  if ((isLong && isBearishFlow) || (!isLong && isBullishFlow)) {
    return "diverging";
  }
  return "neutral";
}

/**
 * Compact entered trade row - Shows only essential info for right rail.
 * Ticker, P&L %, and thesis status dot.
 * Full details are in Mission Control (center panel).
 */
function EnteredTradeItem({
  trade,
  isUpdated,
  onTradeClick,
}: {
  trade: Trade;
  isUpdated: boolean;
  onTradeClick?: (trade: Trade) => void;
}) {
  // Live P&L
  const contractTicker =
    trade.contract?.id || trade.contract?.ticker || trade.contract?.symbol || null;
  const entryPrice =
    trade.entryPrice || getEntryPriceFromUpdates(trade.updates || []) || trade.contract?.mid || 0;
  const { currentPrice, pnlPercent } = useActiveTradePnL(trade.id, contractTicker, entryPrice);

  // Live flow for thesis status
  const underlyingTicker = normalizeSymbolForAPI(trade.ticker);
  const { primarySentiment } = useFlowContext(underlyingTicker, {
    refreshInterval: 60000, // Less frequent for rail items
    windows: ["short"],
  });

  // Computed values
  const displayPnlPercent = currentPrice > 0 ? pnlPercent : (trade.movePercent ?? 0);
  const isProfit = displayPnlPercent >= 0;
  const tradeDirection = trade.contract.type === "C" ? "call" : "put";
  const thesisStatus = getThesisStatus(tradeDirection as "call" | "put", primarySentiment);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors cursor-pointer",
        isUpdated && "bg-[var(--brand-primary)]/10"
      )}
      onClick={() => onTradeClick?.(trade)}
    >
      {/* Thesis Status Dot */}
      <div
        className={cn(
          "w-2.5 h-2.5 rounded-full flex-shrink-0",
          thesisStatus === "aligned" && "bg-emerald-500",
          thesisStatus === "diverging" && "bg-red-500 animate-pulse",
          thesisStatus === "neutral" && "bg-zinc-500"
        )}
        title={
          thesisStatus === "aligned"
            ? "Flow aligned with position"
            : thesisStatus === "diverging"
              ? "Flow diverging from position!"
              : "Neutral flow"
        }
      />

      {/* Ticker + Contract */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-high)]">{trade.ticker}</span>
          <span className="text-[10px] text-[var(--text-faint)]">
            {trade.contract.strike}
            {trade.contract.type}
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          {trade.contract.daysToExpiry}DTE • {trade.tradeType}
        </div>
      </div>

      {/* P&L */}
      <div className="text-right flex-shrink-0">
        <div
          className={cn(
            "text-sm font-bold tabular-nums",
            isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {isProfit ? "+" : ""}
          {formatPercent(displayPnlPercent)}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function HDActiveTradesPanel({ onTradeClick }: HDActiveTradesPanelProps) {
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
          />
        ))}

        {/* Loaded Trades (Secondary) - Compact row style */}
        {loadedTrades.map((trade) => (
          <div
            key={trade.id}
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors cursor-pointer",
              updatedTradeIds.has(trade.id) && "bg-[var(--brand-primary)]/10"
            )}
            onClick={() => onTradeClick?.(trade)}
          >
            {/* Blue dot for LOADED state */}
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-blue-500"
              title="Loaded - awaiting entry"
            />

            {/* Ticker + Contract */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-high)]">
                  {trade.ticker}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">
                  {trade.contract.strike}
                  {trade.contract.type}
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {trade.contract.daysToExpiry}DTE • {trade.tradeType}
              </div>
            </div>

            {/* Mid Price */}
            <div className="text-right flex-shrink-0">
              <div className="text-sm tabular-nums text-[var(--text-muted)]">
                ${formatPrice(trade.contract.mid)}
              </div>
            </div>

            {/* Chevron */}
            <ChevronRight className="w-4 h-4 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
}
