/**
 * HDRowWatchlist - Institutional-grade watchlist row with Smart Badges
 *
 * Shows institutional evidence:
 * - Smart Score pill (composite confluence score)
 * - Flow Sparkline (recent sweep activity)
 * - Gold border for Score > 90
 *
 * Layout (collapsed):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [▶] [92] SPY    $605.23 +0.45%    [████] flow bars   [Flow]     │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { Ticker } from "../../../types";
import { formatPrice, cn } from "../../../lib/utils";
import { X, ChevronRight, ChevronDown, Zap } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useUIStore } from "../../../stores";
import { Collapsible, CollapsibleContent } from "../../ui/collapsible";
import { useRef, useEffect, useState, useMemo } from "react";
import type { CompositeSignal } from "../../../lib/composite/CompositeSignal";
import { CompositeSignalBadge } from "../signals/CompositeSignalBadge";
import { HDMiniSparkline, HDMiniSparklineSkeleton } from "../charts/HDMiniSparkline";
import { HDLiveIndicator, type DataStatus } from "../common/HDLiveIndicator";
import { HDSignalChips } from "../common/HDSignalChips";
import { useFlowContext } from "../../../hooks/useFlowContext";
import { normalizeSymbolForAPI } from "../../../lib/symbolUtils";

interface HDRowWatchlistProps {
  ticker: Ticker;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  /** Composite signals for this symbol (from useCompositeSignals) */
  compositeSignals?: CompositeSignal[];
  /** Animation delay for stagger effect */
  animationDelay?: number;
  /** View mode: clean (minimal) or power (full metrics) */
  viewMode?: "clean" | "power";
  /** Is this row expanded */
  isExpanded?: boolean;
  /** Callback when expansion changes */
  onExpandChange?: (expanded: boolean) => void;
}

/**
 * SmartScorePill - Compact score indicator with color coding
 */
function SmartScorePill({ score }: { score: number }) {
  const rounded = Math.round(score);
  const isHigh = rounded >= 80;
  const isMedium = rounded >= 60 && rounded < 80;

  return (
    <div
      className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums",
        isHigh && "bg-yellow-500/20 text-yellow-500",
        isMedium && "bg-emerald-500/20 text-emerald-400",
        !isHigh && !isMedium && "bg-zinc-700/50 text-zinc-400"
      )}
      title={`Smart Score: ${rounded}/100`}
    >
      {rounded}
    </div>
  );
}

/**
 * FlowSparkline - Mini bar chart showing recent call/put sweep activity
 * Green bars = call sweeps, Red bars = put sweeps
 */
function FlowSparkline({
  sweepCount,
  buyPressure,
  flowBias,
}: {
  sweepCount: number;
  buyPressure: number; // 0-100 scale
  flowBias: "bullish" | "bearish" | "neutral";
}) {
  // Generate 5 mini bars based on buy pressure
  // buyPressure of 75 = 3-4 green bars
  const bars = useMemo(() => {
    const result: ("call" | "put" | "neutral")[] = [];
    const callBars = Math.round((buyPressure / 100) * 5);
    for (let i = 0; i < 5; i++) {
      if (i < callBars) {
        result.push("call");
      } else if (i >= 5 - (5 - callBars)) {
        result.push("put");
      } else {
        result.push("neutral");
      }
    }
    return result;
  }, [buyPressure]);

  if (sweepCount === 0) {
    return (
      <div className="flex items-end gap-px h-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-1 h-1 rounded-sm bg-zinc-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-px h-3" title={`${sweepCount} sweeps | ${flowBias}`}>
      {bars.map((type, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-sm transition-all",
            type === "call" && "bg-emerald-500",
            type === "put" && "bg-red-500",
            type === "neutral" && "bg-zinc-600"
          )}
          style={{ height: `${40 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

/**
 * FlowBiasBadge - Compact badge showing flow direction
 */
function FlowBiasBadge({
  bias,
  sweepCount,
}: {
  bias: "bullish" | "bearish" | "neutral";
  sweepCount: number;
}) {
  if (sweepCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
        bias === "bullish" && "bg-emerald-500/20 text-emerald-400",
        bias === "bearish" && "bg-red-500/20 text-red-400",
        bias === "neutral" && "bg-zinc-700/50 text-zinc-400"
      )}
      title={`${sweepCount} institutional sweeps detected`}
    >
      <Zap className="w-2.5 h-2.5" />
      {sweepCount}
    </div>
  );
}

export function HDRowWatchlist({
  ticker,
  active,
  onClick,
  onRemove,
  compositeSignals,
  animationDelay,
  viewMode = "clean",
  isExpanded = false,
  onExpandChange,
}: HDRowWatchlistProps) {
  // Get all data from marketDataStore (single source of truth)
  const symbolData = useSymbolData(ticker.symbol);
  const uiStore = useUIStore();

  // Local timestamp tracking based on price changes
  const lastUpdateRef = useRef<number>(Date.now());
  const prevPriceRef = useRef<number>(ticker.last);

  // Live flow context for institutional evidence
  const normalizedSymbol = normalizeSymbolForAPI(ticker.symbol);
  const {
    short: flowContext,
    primarySentiment,
    sweepCount,
  } = useFlowContext(normalizedSymbol, {
    refreshInterval: 30000,
    windows: ["short"],
  });

  // Calculate buyPressure from flow context
  const buyPressure = useMemo(() => {
    if (!flowContext?.totalVolume || flowContext.totalVolume === 0) return 50;
    return (flowContext.buyVolume / flowContext.totalVolume) * 100;
  }, [flowContext]);

  // Flow bias for display
  const flowBias: "bullish" | "bearish" | "neutral" =
    primarySentiment === "BULLISH"
      ? "bullish"
      : primarySentiment === "BEARISH"
        ? "bearish"
        : "neutral";

  // Price flash animation state: 'up' | 'down' | null
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (ticker.last !== prevPriceRef.current) {
      lastUpdateRef.current = Date.now();

      // Determine flash direction
      const direction = ticker.last > prevPriceRef.current ? "up" : "down";
      setPriceFlash(direction);

      // Clear flash after animation (400ms)
      const timeout = setTimeout(() => setPriceFlash(null), 400);

      prevPriceRef.current = ticker.last;
      return () => clearTimeout(timeout);
    }
  }, [ticker.last]);

  const currentPrice = ticker.last;
  const changePercent = ticker.changePercent || 0;

  // Determine price direction color using semantic variables
  const priceColor =
    changePercent > 0
      ? "text-[var(--accent-positive)]"
      : changePercent < 0
        ? "text-[var(--accent-negative)]"
        : "text-[var(--text-high)]";

  // Data freshness and status
  const lastUpdated = symbolData?.lastUpdated || lastUpdateRef.current;
  const confluenceScore = symbolData?.confluence?.overall || 0;
  const confluenceComponents = symbolData?.confluence?.components || {};

  // Determine data status
  const getDataStatus = (): DataStatus => {
    if (!lastUpdated) return "stale";
    const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);
    if (secondsAgo < 5) return "live";
    if (secondsAgo < 30) return "polling";
    return "stale";
  };

  const dataStatus = getDataStatus();
  const isStale = dataStatus === "stale";

  // Check if we have candle data for sparkline
  const hasCandles =
    symbolData?.candles?.["1m"]?.length > 0 || symbolData?.candles?.["5m"]?.length > 0;

  // Handle badge click - navigate to chart at signal bar
  const handleBadgeClick = (signal: any) => {
    if (!active) {
      onClick?.();
    }
    if (signal.barTimeKey) {
      setTimeout(() => uiStore.scrollChartToBar(signal.barTimeKey), 100);
    }
  };

  // Handle row click
  const handleRowClick = () => {
    onClick?.();
    uiStore.setMainCockpitSymbol(ticker.symbol);
  };

  // Defensive: fallback for missing price
  const priceDisplay =
    typeof currentPrice === "number" && !isNaN(currentPrice) ? (
      formatPrice(currentPrice)
    ) : (
      <span className="text-[var(--text-muted)] italic">--</span>
    );

  // Loading skeleton
  if (!ticker || !ticker.symbol) {
    return (
      <div className="w-full flex flex-col gap-1 p-3 border-b border-[var(--border-hairline)] animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 bg-[var(--surface-2)] rounded" />
          <div className="h-4 w-20 bg-[var(--surface-2)] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 flex-1 bg-[var(--surface-2)] rounded" />
          <div className="h-4 w-8 bg-[var(--surface-2)] rounded" />
        </div>
      </div>
    );
  }

  // Price flash animation class
  const priceFlashClass =
    priceFlash === "up" ? "animate-flash-green" : priceFlash === "down" ? "animate-flash-red" : "";

  // Legacy signals fallback
  const strategySignals = (symbolData as any)?.strategySignals || [];
  const activeSignals = strategySignals.filter((s: any) => s.status === "ACTIVE");
  const activeSignalCount = activeSignals.length;

  // Determine if this is a high-conviction ticker (Score > 90)
  const isHighConviction = confluenceScore >= 90;

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandChange}>
      <div
        className={cn(
          "relative w-full flex flex-col border-b border-[var(--border-hairline)] group",
          "transition-all duration-150 ease-out",
          // Gold border for high conviction (Score > 90)
          isHighConviction && !active && "border-l-2 border-l-yellow-500",
          // Active state takes precedence
          active && "bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)] shadow-sm",
          isStale && "opacity-60"
        )}
        style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
        data-testid={`watchlist-row-${ticker.symbol}`}
      >
        {/* Row header - horizontal layout with expand button separate from content */}
        <div className="flex">
          {/* Expand button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpandChange?.(!isExpanded);
            }}
            className="flex-shrink-0 w-8 h-full min-h-[40px] flex items-center justify-center text-zinc-500 hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
            data-testid={`watchlist-expand-${ticker.symbol}`}
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 pointer-events-none" />
            ) : (
              <ChevronRight className="w-4 h-4 pointer-events-none" />
            )}
          </button>

          {/* Main row content - clickable area */}
          <div
            className={cn(
              "flex-1 flex flex-col gap-1.5 px-2 py-2.5",
              "cursor-pointer touch-manipulation",
              "hover:bg-[var(--surface-3)] hover:shadow-sm"
            )}
            onClick={handleRowClick}
          >
            {/* Row 1: Smart Score + Symbol + Price */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {/* Smart Score Pill - always show if we have a score */}
                {confluenceScore > 0 && <SmartScorePill score={confluenceScore} />}

                {/* Symbol */}
                <span className="text-[var(--text-high)] font-semibold text-sm leading-tight truncate">
                  {ticker.symbol}
                </span>

                {/* Composite signal indicator (if any active) */}
                {compositeSignals && compositeSignals.length > 0 && (
                  <span className="text-[9px] font-bold text-amber-400">
                    {compositeSignals.length} SIG
                  </span>
                )}
              </div>

              {/* Price + Change */}
              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                <span
                  className={cn(
                    "font-mono text-sm font-medium tabular-nums transition-colors duration-150",
                    priceColor,
                    priceFlashClass
                  )}
                >
                  {priceDisplay}
                </span>
                {changePercent !== 0 && (
                  <span
                    className={cn("text-[10px] font-mono font-medium tabular-nums", priceColor)}
                  >
                    {changePercent > 0 ? "+" : ""}
                    {changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Price Sparkline + Flow Evidence */}
            <div className="flex items-center gap-2">
              {/* Price Sparkline - takes most of the space */}
              <div className="flex-1 min-w-0">
                {hasCandles ? (
                  <HDMiniSparkline symbol={ticker.symbol} height={24} />
                ) : (
                  <HDMiniSparklineSkeleton height={24} />
                )}
              </div>

              {/* Institutional Evidence - compact right side */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Live indicator */}
                <HDLiveIndicator status={dataStatus} lastUpdate={lastUpdated} showLabel={false} />

                {/* Flow Sparkline - mini bars showing sweep activity */}
                <FlowSparkline
                  sweepCount={sweepCount ?? 0}
                  buyPressure={buyPressure}
                  flowBias={flowBias}
                />

                {/* Flow Bias Badge with sweep count */}
                <FlowBiasBadge bias={flowBias} sweepCount={sweepCount ?? 0} />
              </div>

              {/* Remove button - visible on hover */}
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemove();
                  }}
                  className="relative z-30 ml-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-[var(--radius)] opacity-50 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/20 transition-all touch-manipulation active:scale-95 pointer-events-auto"
                  title="Remove from watchlist"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded content (inline, not overlay) */}
        <CollapsibleContent>
          <div
            className="px-3 pb-3 pt-1 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]"
            data-testid={`watchlist-expanded-${ticker.symbol}`}
          >
            {/* Confluence checklist */}
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                Confluence Factors
              </div>
              <HDSignalChips components={confluenceComponents} showAll />
            </div>

            {/* Flow Context Details */}
            {flowContext && (
              <div className="mt-3 pt-2 border-t border-[var(--border-hairline)]">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                  Institutional Flow
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-zinc-500 text-[10px]">Sentiment</div>
                    <div
                      className={cn(
                        "font-mono font-bold",
                        flowBias === "bullish" && "text-emerald-400",
                        flowBias === "bearish" && "text-red-400",
                        flowBias === "neutral" && "text-zinc-400"
                      )}
                    >
                      {primarySentiment}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px]">Sweeps</div>
                    <div className="font-mono text-[var(--text-high)]">{sweepCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[10px]">Buy Pressure</div>
                    <div
                      className={cn(
                        "font-mono",
                        buyPressure > 55 && "text-emerald-400",
                        buyPressure < 45 && "text-red-400",
                        buyPressure >= 45 && buyPressure <= 55 && "text-zinc-400"
                      )}
                    >
                      {buyPressure.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
