/**
 * HDPortfolioRail - Right rail for Portfolio Management
 *
 * Shows Active Trades & Risk metrics in a monitoring-only view.
 * Part of the 3-pane terminal layout.
 *
 * Features:
 * - Portfolio Risk header (Delta, Theta, Net P&L)
 * - Open Positions with compact rows: [Ticker] [P&L Badge] [Status Dot]
 * - Working Orders section for loaded strategies
 * - Honey Drip Gold for positive Net P&L
 * - Status Dot: Green if pnl > 0, Red if pnl < 0, Pulse if recent update
 *
 * Anti-Pattern: NO action buttons here - monitoring only.
 * Actions happen in the Center Panel.
 */

import { useMemo, useEffect, useState } from "react";
import { useTradeStore } from "../../../stores";
import { useMarketDataStore } from "../../../stores/marketDataStore";
import { Trade } from "../../../types";
import { Shield, Clock, Zap, ChevronRight } from "lucide-react";
import { HDInstitutionalRadar } from "../common/HDInstitutionalRadar";
import { cn, formatPercent } from "../../../lib/utils";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { getEntryPriceFromUpdates } from "../../../lib/tradePnl";
import { getPortfolioGreeks, PortfolioGreeks } from "../../../services/greeksMonitorService";

/**
 * Thesis Dot Status - Based on flow alignment + P&L
 * 🟢 Green (aligned): Flow Aligned + Profit
 * 🟡 Yellow (neutral): Neutral Flow or Flat P&L
 * 🔴 Red (divergent): Flow Divergence (Warning)
 */
type ThesisDotStatus = "aligned" | "neutral" | "divergent";

/**
 * Derive flow score (0-100) from flowMetrics
 * >60 = bullish (more calls than puts)
 * <40 = bearish (more puts than calls)
 * 40-60 = neutral
 */
function deriveFlowScore(
  flowMetrics: { callVolume: number; putVolume: number } | undefined
): number {
  if (!flowMetrics) return 50; // Neutral if no data
  const total = flowMetrics.callVolume + flowMetrics.putVolume;
  if (total === 0) return 50; // Neutral if no volume
  // Convert call ratio (0-1) to flow score (0-100)
  return (flowMetrics.callVolume / total) * 100;
}

function getThesisDotStatus(trade: Trade, pnlPercent: number, flowScore: number): ThesisDotStatus {
  // Determine trade direction from contract type (Call = bullish, Put = bearish)
  const isLong = trade.contract?.type === "C";

  // Flow alignment thresholds: >60 = bullish, <40 = bearish, 40-60 = neutral
  const flowBullish = flowScore > 60;
  const flowBearish = flowScore < 40;

  // Check if flow aligns with trade direction
  const flowAligned = (isLong && flowBullish) || (!isLong && flowBearish);
  const flowDivergent = (isLong && flowBearish) || (!isLong && flowBullish);

  // P&L thresholds
  const isProfitable = pnlPercent > 1;

  // 🟢 Green: Flow aligned AND profitable
  if (flowAligned && isProfitable) return "aligned";

  // 🔴 Red: Flow divergent (warning sign regardless of P&L)
  if (flowDivergent) return "divergent";

  // 🟡 Yellow: Neutral flow, flat P&L, or any other case
  return "neutral";
}

interface HDPortfolioRailProps {
  /** Active trades (ENTERED state) - if not provided, reads from store */
  activeTrades?: Trade[];
  /** Loaded trades (LOADED state) - if not provided, reads from store */
  loadedTrades?: Trade[];
  /** Callback when a trade row is clicked */
  onTradeClick?: (trade: Trade) => void;
}

/**
 * Check if trade has recent updates (within last 5 minutes)
 */
function hasRecentUpdate(trade: Trade): boolean {
  const updates = trade.updates || [];
  if (updates.length === 0) return false;

  const lastUpdate = updates[updates.length - 1];
  const updateTime = lastUpdate.timestamp ? new Date(lastUpdate.timestamp).getTime() : 0;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  return updateTime > fiveMinutesAgo;
}

/**
 * HDCompactTradeRow - Minimal trade row for portfolio monitoring
 *
 * Visual: [Ticker] [P&L %] [Thesis Dot]
 * Thesis Dot Logic:
 *   🟢 Green (aligned): Flow Aligned + Profit
 *   🟡 Yellow (neutral): Neutral Flow or Flat P&L
 *   🔴 Red (divergent): Flow Divergence (Warning)
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

  // Get flow data for the trade's symbol and derive flow score
  const flowMetrics = useMarketDataStore((state) => state.symbols[trade.ticker]?.flowMetrics);
  const flowScore = deriveFlowScore(flowMetrics);

  // Computed values
  const displayPnlPercent = currentPrice > 0 ? pnlPercent : (trade.movePercent ?? 0);
  const isProfit = displayPnlPercent >= 0;
  const isRecent = hasRecentUpdate(trade);

  // Calculate thesis dot status based on flow alignment + P&L
  const thesisStatus = getThesisDotStatus(trade, displayPnlPercent, flowScore);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
        "hover:bg-[var(--surface-2)]",
        isActive && "bg-[var(--brand-primary)]/10 border-l-2 border-[var(--brand-primary)]"
      )}
      onClick={onClick}
    >
      {/* Ticker */}
      <span className="text-sm font-semibold text-[var(--text-high)] flex-1 truncate">
        {trade.ticker}
      </span>

      {/* P&L Badge - Honey Drip Gold for profit */}
      <span
        className={cn(
          "text-sm font-bold tabular-nums min-w-[50px] text-right",
          isProfit ? "text-yellow-500" : "text-[var(--accent-negative)]"
        )}
      >
        {isProfit ? "+" : ""}
        {formatPercent(displayPnlPercent)}
      </span>

      {/* Thesis Dot - Flow alignment + P&L based with pulse for recent updates */}
      <div
        className={cn(
          "w-2.5 h-2.5 rounded-full flex-shrink-0",
          thesisStatus === "aligned" && "bg-green-500",
          thesisStatus === "neutral" && "bg-yellow-500",
          thesisStatus === "divergent" && "bg-red-500",
          isRecent && "animate-pulse"
        )}
        title={
          thesisStatus === "aligned"
            ? "Flow aligned + Profit"
            : thesisStatus === "divergent"
              ? "Flow divergence warning"
              : "Neutral flow / Flat P&L"
        }
      />

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

export function HDPortfolioRail({
  activeTrades: propActiveTrades,
  loadedTrades: propLoadedTrades,
  onTradeClick,
}: HDPortfolioRailProps) {
  const storeActiveTrades = useTradeStore((state) => state.activeTrades);
  const currentTradeId = useTradeStore((state) => state.currentTradeId);

  // Use props if provided, otherwise fall back to store
  const enteredTrades = useMemo(() => {
    if (propActiveTrades !== undefined) return propActiveTrades;
    return storeActiveTrades.filter((t) => t.state === "ENTERED");
  }, [propActiveTrades, storeActiveTrades]);

  const loadedTrades = useMemo(() => {
    if (propLoadedTrades !== undefined) return propLoadedTrades;
    return storeActiveTrades.filter((t) => t.state === "LOADED");
  }, [propLoadedTrades, storeActiveTrades]);

  // Aggregate metrics - use entered trades for P&L calculations
  const allTrades = useMemo(
    () => [...enteredTrades, ...loadedTrades],
    [enteredTrades, loadedTrades]
  );
  const { netPnL, tradeCount } = useAggregateNetPnL(allTrades);
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
  }, [enteredTrades]);

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
        {/* Open Positions Section */}
        {enteredTrades.length > 0 && (
          <div>
            <div className="px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-transparent border-l-2 border-yellow-500">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-yellow-500">
                Open Positions
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

        {/* Working Orders Section (Loaded Strategies) */}
        {loadedTrades.length > 0 && (
          <div className="mt-2">
            <div className="px-3 py-2 bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-blue-500">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                Working Orders
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

        {/* Empty State - No Open Positions */}
        {enteredTrades.length === 0 && loadedTrades.length === 0 && (
          <HDInstitutionalRadar
            message="No Open Positions"
            subMessage="Load a trade from the watchlist"
            size="md"
            className="h-full"
          />
        )}
      </div>

      {/* Footer: Thesis Dot Legend */}
      {enteredTrades.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]">
          <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--text-faint)]">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Aligned</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Neutral</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Divergent</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HDPortfolioRail;
