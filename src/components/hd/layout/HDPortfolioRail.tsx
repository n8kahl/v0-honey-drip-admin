/**
 * HDPortfolioRail - Right rail for Portfolio Management
 *
 * Shows Active Trades & Risk metrics in a monitoring-only view.
 * Part of the 3-pane terminal layout.
 *
 * Features:
 * - Portfolio Risk header (Delta, Theta, Net P&L)
 * - Active trades with compact rows (Ticker | P&L % | Thesis Dot)
 * - Pending Orders section for loaded strategies
 * - Honey Drip Gold for positive Net P&L
 *
 * Anti-Pattern: NO action buttons here - monitoring only.
 * Actions happen in the Center Panel.
 */

import { useMemo, useEffect, useState } from "react";
import { useTradeStore } from "../../../stores";
import { Trade } from "../../../types";
import { Shield, Clock, Zap, ChevronRight } from "lucide-react";
import { HDInstitutionalRadar } from "../common/HDInstitutionalRadar";
import { cn, formatPercent } from "../../../lib/utils";
import { useFlowContext } from "../../../hooks/useFlowContext";
import { normalizeSymbolForAPI } from "../../../lib/symbolUtils";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { getEntryPriceFromUpdates } from "../../../lib/tradePnl";
import { getPortfolioGreeks, PortfolioGreeks } from "../../../services/greeksMonitorService";

interface HDPortfolioRailProps {
  onTradeClick?: (trade: Trade) => void;
}

/**
 * Thesis status based on flow vs trade direction
 */
type ThesisStatus = "aligned" | "diverging" | "neutral";

function getThesisStatus(
  tradeDirection: "call" | "put",
  flowSentiment: "BULLISH" | "BEARISH" | "NEUTRAL"
): ThesisStatus {
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
 * HDCompactTradeRow - Minimal trade row for portfolio monitoring
 *
 * Visual: Thesis Dot | Ticker | P&L %
 * Clicking focuses the trade in Mission Control
 */
function HDCompactTradeRow({
  trade,
  onClick,
  isActive,
}: {
  trade: Trade;
  onClick?: () => void;
  isActive?: boolean;
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
  const tradeDirection = trade.contract?.type === "C" ? "call" : "put";
  const thesisStatus = getThesisStatus(tradeDirection, primarySentiment);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
        "hover:bg-[var(--surface-2)]",
        isActive && "bg-[var(--brand-primary)]/10 border-l-2 border-[var(--brand-primary)]"
      )}
      onClick={onClick}
    >
      {/* Thesis Status Dot - Aligned=Green, Diverging=Red */}
      <div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          thesisStatus === "aligned" && "bg-[var(--accent-positive)]",
          thesisStatus === "diverging" && "bg-[var(--accent-negative)] animate-pulse",
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

      {/* Ticker */}
      <span className="text-sm font-semibold text-[var(--text-high)] flex-1 truncate">
        {trade.ticker}
      </span>

      {/* Contract Type Badge - Call=Green, Put=Red */}
      <span
        className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded",
          trade.contract?.type === "C"
            ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
            : "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
        )}
      >
        {trade.contract?.type === "C" ? "C" : "P"}
      </span>

      {/* P&L - Honey Drip Gold for profit */}
      <span
        className={cn(
          "text-sm font-bold tabular-nums min-w-[50px] text-right",
          isProfit ? "text-yellow-500" : "text-[var(--accent-negative)]"
        )}
      >
        {isProfit ? "+" : ""}
        {formatPercent(displayPnlPercent)}
      </span>

      {/* Chevron on hover */}
      <ChevronRight className="w-3 h-3 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * HDPendingOrderRow - Compact row for loaded strategies awaiting entry
 */
function HDPendingOrderRow({ trade, onClick }: { trade: Trade; onClick?: () => void }) {
  const mid = trade.contract?.mid ?? 0;

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
      onClick={onClick}
    >
      {/* Blue dot for pending */}
      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-blue-500" title="Awaiting entry" />

      {/* Ticker */}
      <span className="text-sm font-medium text-[var(--text-muted)] flex-1 truncate">
        {trade.ticker}
      </span>

      {/* Contract info */}
      <span className="text-[10px] text-[var(--text-faint)]">
        {trade.contract?.strike}
        {trade.contract?.type}
      </span>

      {/* Mid price */}
      <span className="text-xs tabular-nums text-[var(--text-muted)]">${mid.toFixed(2)}</span>

      {/* Chevron on hover */}
      <ChevronRight className="w-3 h-3 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * Calculate aggregate Net P&L from trades
 */
function useAggregateNetPnL(trades: Trade[]) {
  return useMemo(() => {
    const enteredTrades = trades.filter((t) => t.state === "ENTERED");
    if (enteredTrades.length === 0) {
      return { netPnL: 0, avgPnL: 0, tradeCount: 0 };
    }

    let totalPnL = 0;
    for (const trade of enteredTrades) {
      totalPnL += trade.movePercent ?? 0;
    }

    return {
      netPnL: totalPnL,
      avgPnL: totalPnL / enteredTrades.length,
      tradeCount: enteredTrades.length,
    };
  }, [trades]);
}

export function HDPortfolioRail({ onTradeClick }: HDPortfolioRailProps) {
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const currentTradeId = useTradeStore((state) => state.currentTradeId);

  // Filter trades by state
  const enteredTrades = useMemo(
    () => activeTrades.filter((t) => t.state === "ENTERED"),
    [activeTrades]
  );
  const loadedTrades = useMemo(
    () => activeTrades.filter((t) => t.state === "LOADED"),
    [activeTrades]
  );

  // Aggregate metrics
  const { netPnL, tradeCount } = useAggregateNetPnL(activeTrades);
  const isProfit = netPnL >= 0;

  // Portfolio Greeks
  const [portfolioGreeks, setPortfolioGreeks] = useState<PortfolioGreeks | null>(null);

  useEffect(() => {
    const updateGreeks = () => {
      const greeks = getPortfolioGreeks();
      setPortfolioGreeks(greeks);
    };

    updateGreeks();
    const interval = setInterval(updateGreeks, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [activeTrades]);

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)]">
      {/* Header: Portfolio Risk */}
      <div className="p-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--brand-primary)]" />
            <h2 className="text-sm font-medium text-[var(--text-high)]">Portfolio Risk</h2>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            {tradeCount} position{tradeCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Net P&L - Honey Drip Gold for profit */}
        <div className="flex items-baseline gap-2 mb-3">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              isProfit ? "text-yellow-500" : "text-[var(--accent-negative)]"
            )}
          >
            {isProfit ? "+" : ""}
            {netPnL.toFixed(1)}%
          </span>
          <span className="text-xs text-[var(--text-muted)]">Net P&L</span>
        </div>

        {/* Greeks Summary Row */}
        {portfolioGreeks && enteredTrades.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            {/* Delta */}
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-400" />
              <span className="text-[var(--text-faint)]">Δ</span>
              <span
                className={cn(
                  "font-mono tabular-nums",
                  portfolioGreeks.totalDelta >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {portfolioGreeks.totalDelta >= 0 ? "+" : ""}
                {portfolioGreeks.totalDelta.toFixed(2)}
              </span>
            </div>

            {/* Theta */}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-[var(--text-faint)]">θ</span>
              <span className="font-mono tabular-nums text-amber-400">
                -${Math.abs(portfolioGreeks.thetaPerDay).toFixed(0)}/d
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Positions Section */}
        {enteredTrades.length > 0 && (
          <div>
            <div className="px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-yellow-500">
                Active Positions
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-hairline)]">
              {enteredTrades.map((trade) => (
                <HDCompactTradeRow
                  key={trade.id}
                  trade={trade}
                  isActive={currentTradeId === trade.id}
                  onClick={() => onTradeClick?.(trade)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Orders Section (Loaded Strategies) */}
        {loadedTrades.length > 0 && (
          <div className="mt-2">
            <div className="px-3 py-2 bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-blue-500">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                Pending Orders
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-hairline)]">
              {loadedTrades.map((trade) => (
                <HDPendingOrderRow
                  key={trade.id}
                  trade={trade}
                  onClick={() => onTradeClick?.(trade)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State - Institutional Radar */}
        {enteredTrades.length === 0 && loadedTrades.length === 0 && (
          <HDInstitutionalRadar
            message="Waiting for institutional flow..."
            subMessage="Load a trade from the watchlist"
            size="md"
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

export default HDPortfolioRail;
