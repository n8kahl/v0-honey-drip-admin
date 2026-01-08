/**
 * MobileWatchlist - Decision Stack for Mobile
 *
 * Displays watchlist as a vertical feed of opportunity cards.
 * Each card shows key decision metrics at a glance.
 *
 * Features:
 * - SmartScore badge (confluence score ring)
 * - FlowPulse (compact tug-of-war bar)
 * - Price + Change %
 * - Active strategy signals indicator
 * - Gold border highlight for high conviction (Score >= 90)
 *
 * Layout: Vertical scroll only, no horizontal tables.
 */

import React, { useMemo } from "react";
import { Ticker } from "../../types";
import { useSymbolData, useMarketDataStore } from "../../stores/marketDataStore";
import { useUIStore } from "../../stores/uiStore";
import { TrendingUp, TrendingDown, Activity, ChevronRight, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { cardHover, colorTransition } from "../../lib/animations";
import { SmartScoreBadge, FlowPulse } from "../hd/terminal";
import { useFlowContext } from "../../hooks/useFlowContext";
import { normalizeSymbolForAPI } from "../../lib/symbolUtils";
import { HDInstitutionalRadar } from "../hd/common/HDInstitutionalRadar";

interface MobileWatchlistProps {
  tickers: Ticker[];
  onRemoveTicker?: (ticker: Ticker) => void;
  onAddTicker?: () => void;
}

interface MobileDecisionCardProps {
  ticker: Ticker;
  onTap: () => void;
  isActive?: boolean;
}

/**
 * MobileDecisionCard - Full-width card for the Decision Stack
 *
 * Shows all key metrics for quick decision making:
 * - Symbol + Price + Change
 * - SmartScore ring
 * - FlowPulse bar
 * - Strategy signals indicator
 */
const MobileDecisionCard: React.FC<MobileDecisionCardProps> = ({ ticker, onTap, isActive }) => {
  const symbolData = useSymbolData(ticker.symbol);
  const strategySignals = (symbolData as any)?.strategySignals || [];
  const activeSignals = strategySignals.filter((s: any) => s.status === "ACTIVE");
  const confluenceScore = symbolData?.confluence?.overall || 0;

  // Get live flow context for this symbol
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

  // High conviction indicator (gold border for score >= 90)
  const isHighConviction = confluenceScore >= 90;

  return (
    <button
      onClick={onTap}
      className={cn(
        // Base styles
        "w-full flex flex-col gap-3 p-4 rounded-2xl text-left",
        "bg-[var(--surface-2)] border",
        "transition-all duration-200",
        // Touch target minimum
        "min-h-[120px]",
        // Border based on score/state
        isHighConviction
          ? "border-yellow-500/50"
          : isActive
            ? "border-[var(--brand-primary)]"
            : "border-[var(--border-hairline)]",
        // Active state background
        isActive && "bg-[var(--brand-primary)]/5",
        // Touch feedback
        "active:scale-[0.98] active:opacity-90",
        cardHover
      )}
    >
      {/* Row 1: Symbol + Price + SmartScore */}
      <div className="flex items-start justify-between">
        {/* Left: Symbol + Price */}
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

        {/* Right: SmartScore Ring */}
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
};

export const MobileWatchlist: React.FC<MobileWatchlistProps> = ({ tickers, onAddTicker }) => {
  const setMainCockpitSymbol = useUIStore((s) => s.setMainCockpitSymbol);
  const focusSymbol = useUIStore((s) => s.mainCockpitSymbol);
  const symbolsData = useMarketDataStore((state) => state.symbols);

  // Sort watchlist by Smart Score (highest first)
  const sortedTickers = useMemo(() => {
    return [...tickers].sort((a, b) => {
      const scoreA = symbolsData[a.symbol]?.confluence?.overall || 0;
      const scoreB = symbolsData[b.symbol]?.confluence?.overall || 0;
      return scoreB - scoreA;
    });
  }, [tickers, symbolsData]);

  const handleCardTap = (ticker: Ticker) => {
    console.log("[v0] MobileWatchlist: Card tapped:", ticker.symbol);
    setMainCockpitSymbol(ticker.symbol);
  };

  // Empty state - Institutional Radar
  if (tickers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <HDInstitutionalRadar
          message="Scanning for opportunities..."
          subMessage="Add symbols to your watchlist"
          size="lg"
        />
        {onAddTicker && (
          <button
            onClick={onAddTicker}
            className="flex items-center gap-2 px-5 py-4 rounded-xl bg-[var(--brand-primary)] text-black font-semibold min-h-[52px] mt-4"
          >
            <Plus className="w-5 h-5" />
            Add Symbol
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between sticky top-0 bg-[var(--surface-1)] z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Decision Stack
          </span>
          <span className="text-xs text-[var(--text-muted)]">({sortedTickers.length})</span>
        </div>
        {onAddTicker && (
          <button
            onClick={onAddTicker}
            className="p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        )}
      </div>

      {/* Decision Stack - Vertical cards */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        {sortedTickers.map((ticker) => (
          <MobileDecisionCard
            key={ticker.id}
            ticker={ticker}
            onTap={() => handleCardTap(ticker)}
            isActive={focusSymbol === ticker.symbol}
          />
        ))}
      </div>
    </div>
  );
};

export default MobileWatchlist;
