/**
 * MobileScanScreen - Watchlist Stack (Discovery)
 *
 * Horizontal scrolling watchlist cards with institutional evidence.
 * Each card shows SmartScore, Flow, and price action.
 *
 * Part of the Opportunity Stack [SCAN] tab.
 */

import { useMemo } from "react";
import { Ticker } from "../../../types";
import { useUIStore } from "../../../stores/uiStore";
import { useSymbolData, useMarketDataStore } from "../../../stores/marketDataStore";
import { useFlowContext } from "../../../hooks/useFlowContext";
import { normalizeSymbolForAPI } from "../../../lib/symbolUtils";
import { SmartScoreBadge, FlowPulse } from "../../hd/terminal";
import { Plus, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { HDInstitutionalRadar } from "../../hd/common/HDInstitutionalRadar";
import { cn } from "../../../lib/utils";
import { cardHover, colorTransition } from "../../../lib/animations";

interface MobileScanScreenProps {
  watchlist: Ticker[];
  onTickerTap: (ticker: Ticker) => void;
  onAddTicker: () => void;
}

/**
 * WatchlistStackCard - Large touch-friendly card for mobile
 *
 * Shows:
 * - Symbol + Price + Change
 * - SmartScore ring
 * - FlowPulse compact bar
 * - Gold border for Score > 90
 */
function WatchlistStackCard({
  ticker,
  onTap,
  isActive,
}: {
  ticker: Ticker;
  onTap: () => void;
  isActive?: boolean;
}) {
  const symbolData = useSymbolData(ticker.symbol);
  const strategySignals = (symbolData as any)?.strategySignals || [];
  const activeSignals = strategySignals.filter((s: any) => s.status === "ACTIVE");
  const confluenceScore = symbolData?.confluence?.overall || 0;

  // Get live flow context
  const normalizedSymbol = normalizeSymbolForAPI(ticker.symbol);
  const {
    short: flowContext,
    primarySentiment,
    sweepCount,
  } = useFlowContext(normalizedSymbol, {
    refreshInterval: 30000,
    windows: ["short"],
  });

  // Transform flow context to FlowPulse format
  const buyPressure = useMemo(() => {
    if (!flowContext?.totalVolume || flowContext.totalVolume === 0) return 50;
    return (flowContext.buyVolume / flowContext.totalVolume) * 100;
  }, [flowContext]);

  const flowData = useMemo(() => {
    if (!flowContext) return undefined;
    return {
      flowScore: flowContext.institutionalScore ?? 0,
      flowBias:
        primarySentiment === "BULLISH"
          ? ("bullish" as const)
          : primarySentiment === "BEARISH"
            ? ("bearish" as const)
            : ("neutral" as const),
      buyPressure,
      putCallRatio: flowContext.putCallVolumeRatio ?? 1,
      sweepCount: sweepCount ?? 0,
    };
  }, [flowContext, primarySentiment, sweepCount, buyPressure]);

  // Price data
  const currentPrice = ticker.last || 0;
  const priceChangePercent = ticker.changePercent || 0;
  const isPositive = priceChangePercent >= 0;

  // High conviction indicator
  const isHighConviction = confluenceScore >= 90;

  return (
    <button
      onClick={onTap}
      className={cn(
        // Base styles
        "w-full flex flex-col gap-4 p-4 rounded-2xl text-left",
        "bg-[var(--surface-2)] border",
        "transition-all duration-200",
        // Touch target minimum
        "min-h-[120px]",
        // Border based on score
        isHighConviction
          ? "border-yellow-500/50"
          : isActive
            ? "border-[var(--brand-primary)]"
            : "border-[var(--border-hairline)]",
        // Active state
        isActive && "bg-[var(--brand-primary)]/5",
        // Touch feedback
        "active:scale-[0.98] active:opacity-90",
        cardHover
      )}
    >
      {/* Row 1: Symbol + SmartScore */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Symbol - large and bold */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[var(--text-high)] tracking-tight">
              {ticker.symbol}
            </span>
            {activeSignals.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {activeSignals.length} SIG
              </span>
            )}
          </div>

          {/* Price + Change */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-semibold text-[var(--text-high)] tabular-nums">
              ${currentPrice.toFixed(2)}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-medium tabular-nums",
                isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {isPositive ? "+" : ""}
              {priceChangePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* SmartScore Ring */}
        <SmartScoreBadge score={confluenceScore} size="md" showValue />
      </div>

      {/* Row 2: Flow Pulse (compact) */}
      <div className="pt-2 border-t border-[var(--border-hairline)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Options Flow
          </span>
          {sweepCount && sweepCount > 0 && (
            <span className="text-[10px] font-bold text-amber-400">{sweepCount} sweeps</span>
          )}
        </div>
        <FlowPulse flow={flowData} compact showLabels={false} />
      </div>

      {/* Chevron indicator */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
        <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
    </button>
  );
}

export function MobileScanScreen({ watchlist, onTickerTap, onAddTicker }: MobileScanScreenProps) {
  const focusSymbol = useUIStore((s) => s.mainCockpitSymbol);
  const symbolsData = useMarketDataStore((state) => state.symbols);

  // Sort watchlist by Smart Score (highest first)
  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      const scoreA = symbolsData[a.symbol]?.confluence?.overall || 0;
      const scoreB = symbolsData[b.symbol]?.confluence?.overall || 0;
      return scoreB - scoreA;
    });
  }, [watchlist, symbolsData]);

  // Empty state - Institutional Radar
  if (watchlist.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <HDInstitutionalRadar
          message="Scanning for opportunities..."
          subMessage="Add symbols to your watchlist"
          size="lg"
        />
        <button
          onClick={onAddTicker}
          className="flex items-center gap-2 px-5 py-4 rounded-xl bg-[var(--brand-primary)] text-black font-semibold min-h-[52px] mt-4"
        >
          <Plus className="w-5 h-5" />
          Add Symbol
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Opportunities
          </span>
          <span className="text-xs text-[var(--text-muted)]">({sortedWatchlist.length})</span>
        </div>
        <button
          onClick={onAddTicker}
          className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Plus className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Watchlist Cards */}
      <div className="px-4 pb-4 space-y-3">
        {sortedWatchlist.map((ticker) => (
          <WatchlistStackCard
            key={ticker.id}
            ticker={ticker}
            onTap={() => onTickerTap(ticker)}
            isActive={focusSymbol === ticker.symbol}
          />
        ))}
      </div>
    </div>
  );
}

export default MobileScanScreen;
