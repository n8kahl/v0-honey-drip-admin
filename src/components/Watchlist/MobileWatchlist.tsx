import React from "react";
import { Ticker } from "../../types";
import { useSymbolData } from "../../stores/marketDataStore";
import { useUIStore } from "../../stores/uiStore";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "../../lib/utils";
import { cardHover, colorTransition } from "../../lib/animations";
import { SmartScoreBadge, FlowPulse } from "../hd/terminal";
import { useFlowContext } from "../../hooks/useFlowContext";
import { normalizeSymbolForAPI } from "../../lib/symbolUtils";

interface MobileWatchlistProps {
  tickers: Ticker[];
  onRemoveTicker?: (ticker: Ticker) => void;
}

interface WatchlistCardProps {
  ticker: Ticker;
  onTap: () => void;
}

/**
 * Institutional-grade watchlist card with SmartScore and FlowPulse.
 * Shows: Symbol, Price, Change %, Smart Score Ring, Flow Tug-of-War.
 */
const WatchlistCard: React.FC<WatchlistCardProps> = ({ ticker, onTap }) => {
  const symbolData = useSymbolData(ticker.symbol);
  const strategySignals = symbolData?.strategySignals || [];
  const activeSignals = strategySignals.filter((s) => s.status === "ACTIVE");
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
  // Calculate buyPressure from buyVolume / totalVolume (0-100 scale)
  const buyPressure =
    flowContext?.totalVolume && flowContext.totalVolume > 0
      ? (flowContext.buyVolume / flowContext.totalVolume) * 100
      : 50;

  const flowData = flowContext
    ? {
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
      }
    : undefined;

  // Calculate price change %
  const currentPrice = ticker.last || 0;
  const priceChangePercent = ticker.changePercent || 0;
  const isPositive = priceChangePercent >= 0;

  return (
    <div
      onClick={onTap}
      className={cn(
        "flex-shrink-0 w-72 rounded-2xl p-4 flex flex-col gap-4",
        "bg-[var(--surface-2)]",
        "border border-[var(--border-hairline)]",
        "active:scale-[0.98] cursor-pointer",
        "relative overflow-hidden",
        cardHover,
        colorTransition
      )}
    >
      {/* Header: Symbol + Smart Score */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[var(--text-high)] tracking-tight">
            {ticker.symbol}
          </h2>
          {activeSignals.length > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <Activity className="w-3 h-3" />
              {activeSignals.length} Active
            </div>
          )}
        </div>

        {/* Smart Score Ring */}
        <SmartScoreBadge score={confluenceScore} size="md" label="SCORE" />
      </div>

      {/* Price + Change */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold text-[var(--text-high)] tabular-nums">
            ${currentPrice.toFixed(2)}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium tabular-nums",
              isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? "+" : ""}
            {priceChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Flow Pulse - Compact tug-of-war bar */}
      <div className="pt-2 border-t border-[var(--border-hairline)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Options Flow
        </div>
        <FlowPulse flow={flowData} compact showLabels={false} />
      </div>
    </div>
  );
};

export const MobileWatchlist: React.FC<MobileWatchlistProps> = ({ tickers }) => {
  const setMainCockpitSymbol = useUIStore((s) => s.setMainCockpitSymbol);

  const handleCardTap = (ticker: Ticker) => {
    console.log("[v0] MobileWatchlist: Card tapped:", ticker.symbol);
    setMainCockpitSymbol(ticker.symbol);
  };

  if (tickers.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm text-[var(--text-muted)]">No symbols in watchlist</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Add tickers to start tracking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden py-4">
      <div className="flex items-center gap-4 px-4 overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {tickers.map((ticker) => (
          <div key={ticker.symbol} className="snap-center">
            <WatchlistCard ticker={ticker} onTap={() => handleCardTap(ticker)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileWatchlist;
