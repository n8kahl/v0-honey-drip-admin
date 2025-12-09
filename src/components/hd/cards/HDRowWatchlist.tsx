/**
 * HDRowWatchlist - Watchlist row with sparkline and confluence
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ [Signal] SPY                    ▲ 605.23 +0.45%            │
 * │          ████████░░ sparkline   Live • Conf 78             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { Ticker } from "../../../types";
import { formatPrice, cn } from "../../../lib/utils";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useUIStore } from "../../../stores";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { useRef, useEffect, useState } from "react";
import type { CompositeSignal } from "../../../lib/composite/CompositeSignal";
import { CompositeSignalBadge } from "../signals/CompositeSignalBadge";
import { HDMiniSparkline, HDMiniSparklineSkeleton } from "../charts/HDMiniSparkline";
import { HDLiveIndicator, HDConfluenceBadge, type DataStatus } from "../common/HDLiveIndicator";
import { useWarehouseData } from "../../../hooks/useWarehouseData";

interface HDRowWatchlistProps {
  ticker: Ticker;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  /** Composite signals for this symbol (from useCompositeSignals) */
  compositeSignals?: CompositeSignal[];
  /** Animation delay for stagger effect */
  animationDelay?: number;
}

export function HDRowWatchlist({
  ticker,
  active,
  onClick,
  onRemove,
  compositeSignals,
  animationDelay,
}: HDRowWatchlistProps) {
  // Get all data from marketDataStore (single source of truth)
  const symbolData = useSymbolData(ticker.symbol);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const scrollChartToBar = useUIStore((state) => state.scrollChartToBar);
  const uiStore = useUIStore();

  // Local timestamp tracking based on price changes
  const lastUpdateRef = useRef<number>(Date.now());
  const prevPriceRef = useRef<number>(ticker.last);

  // Warehouse data integration
  const { flowSummary, gammaData, ivData } = useWarehouseData(ticker.symbol);

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
  const confluenceScore = symbolData?.confluence?.overall;

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
    setActiveTab("live");
    if (signal.barTimeKey) {
      setTimeout(() => scrollChartToBar(signal.barTimeKey), 100);
    }
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

  return (
    <>
      <div
        className={cn(
          "w-full flex flex-col gap-1.5 px-3 py-2.5 border-b border-[var(--border-hairline)] group",
          "cursor-pointer transition-all duration-150 ease-out touch-manipulation",
          "hover:bg-[var(--surface-3)] hover:shadow-sm",
          active && "bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)] shadow-sm",
          isStale && "opacity-60"
        )}
        style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
        data-testid={`watchlist-item-${ticker.symbol}`}
        onClick={() => {
          onClick?.();
          uiStore.setMainCockpitSymbol(ticker.symbol);
        }}
      >
        {/* Row 1: Signal + Symbol + Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {/* Composite signals badge */}
            {compositeSignals && compositeSignals.length > 0 && (
              <CompositeSignalBadge
                symbol={ticker.symbol}
                signals={compositeSignals}
                compact
                onClick={(e) => {
                  e.stopPropagation();
                  handleBadgeClick(compositeSignals[0]);
                }}
              />
            )}

            {/* Legacy signal count fallback */}
            {(!compositeSignals || compositeSignals.length === 0) && activeSignalCount > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium rounded",
                  "bg-zinc-700 text-zinc-300"
                )}
              >
                {activeSignalCount}
              </span>
            )}

            {/* Symbol */}
            <span className="text-[var(--text-high)] font-semibold text-sm leading-tight truncate">
              {ticker.symbol}
            </span>
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
              <span className={cn("text-[10px] font-mono font-medium tabular-nums", priceColor)}>
                {changePercent > 0 ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Sparkline + Status */}
        <div className="flex items-center gap-2">
          {/* Sparkline - takes most of the space */}
          <div className="flex-1 min-w-0">
            {hasCandles ? (
              <HDMiniSparkline symbol={ticker.symbol} height={28} />
            ) : (
              <HDMiniSparklineSkeleton height={28} />
            )}
          </div>

          {/* Status indicators - compact right side */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Live indicator */}
            <HDLiveIndicator status={dataStatus} lastUpdate={lastUpdated} showLabel={false} />

            {/* Enhanced Confluence Indicator with pulsing beacon + component badges */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col gap-0.5">
                  {/* Pulsing beacon + score */}
                  <div className="flex items-center gap-1">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        confluenceScore >= 70
                          ? "bg-[var(--accent-positive)] shadow-[0_0_6px_var(--accent-positive)] animate-pulse"
                          : confluenceScore >= 40
                            ? "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)] animate-pulse"
                            : "bg-zinc-500 animate-pulse"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold tabular-nums",
                        confluenceScore >= 70
                          ? "text-[var(--accent-positive)]"
                          : confluenceScore >= 40
                            ? "text-yellow-500"
                            : "text-zinc-500"
                      )}
                    >
                      {Math.round(confluenceScore || 0)}
                    </span>
                  </div>

                  {/* Component mini-badges */}
                  <div className="flex items-center gap-0.5">
                    {/* MTF - Multi-Timeframe */}
                    <div
                      className={cn(
                        "w-4 h-3 flex items-center justify-center rounded text-[7px] font-bold transition-all duration-200",
                        symbolData?.confluence?.components?.trendAlignment
                          ? "bg-[var(--accent-positive)]/25 text-[var(--accent-positive)] border border-[var(--accent-positive)]/40"
                          : "bg-zinc-700/40 text-zinc-600"
                      )}
                    >
                      M
                    </div>

                    {/* RSI - Momentum */}
                    <div
                      className={cn(
                        "w-4 h-3 flex items-center justify-center rounded text-[7px] font-bold transition-all duration-200",
                        symbolData?.confluence?.components?.rsiConfirm
                          ? "bg-[var(--accent-positive)]/25 text-[var(--accent-positive)] border border-[var(--accent-positive)]/40"
                          : "bg-zinc-700/40 text-zinc-600"
                      )}
                    >
                      R
                    </div>

                    {/* VOL - Volume */}
                    <div
                      className={cn(
                        "w-4 h-3 flex items-center justify-center rounded text-[7px] font-bold transition-all duration-200",
                        symbolData?.confluence?.components?.volumeConfirm
                          ? "bg-[var(--accent-positive)]/25 text-[var(--accent-positive)] border border-[var(--accent-positive)]/40"
                          : "bg-zinc-700/40 text-zinc-600"
                      )}
                    >
                      V
                    </div>

                    {/* VWAP - Price Position */}
                    <div
                      className={cn(
                        "w-4 h-3 flex items-center justify-center rounded text-[7px] font-bold transition-all duration-200",
                        symbolData?.confluence?.components?.aboveVWAP
                          ? "bg-[var(--accent-positive)]/25 text-[var(--accent-positive)] border border-[var(--accent-positive)]/40"
                          : "bg-zinc-700/40 text-zinc-600"
                      )}
                    >
                      W
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-2">
                  <div className="font-semibold">
                    Confluence: {Math.round(confluenceScore || 0)}/100
                  </div>
                  <div className="text-[10px] text-zinc-400 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={
                          symbolData?.confluence?.components?.trendAlignment
                            ? "text-[var(--accent-positive)]"
                            : "text-zinc-500"
                        }
                      >
                        {symbolData?.confluence?.components?.trendAlignment ? "✓" : "○"}
                      </span>
                      <span>Multi-Timeframe Trend</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={
                          symbolData?.confluence?.components?.rsiConfirm
                            ? "text-[var(--accent-positive)]"
                            : "text-zinc-500"
                        }
                      >
                        {symbolData?.confluence?.components?.rsiConfirm ? "✓" : "○"}
                      </span>
                      <span>RSI Momentum</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={
                          symbolData?.confluence?.components?.volumeConfirm
                            ? "text-[var(--accent-positive)]"
                            : "text-zinc-500"
                        }
                      >
                        {symbolData?.confluence?.components?.volumeConfirm ? "✓" : "○"}
                      </span>
                      <span>Volume Confirmation</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={
                          symbolData?.confluence?.components?.aboveVWAP
                            ? "text-[var(--accent-positive)]"
                            : "text-zinc-500"
                        }
                      >
                        {symbolData?.confluence?.components?.aboveVWAP ? "✓" : "○"}
                      </span>
                      <span>Above VWAP</span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Inline metrics badges */}
            <div className="flex items-center gap-1 text-[10px]">
              {/* Flow indicator */}
              {flowSummary && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "px-1.5 py-0.5 rounded font-mono font-medium",
                        flowSummary.netPremium > 0
                          ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                          : "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                      )}
                    >
                      {flowSummary.netPremium > 0 ? "F+" : "F-"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-semibold mb-1">Options Flow</div>
                      <div className="text-[var(--text-low)]">
                        Net: ${(flowSummary.netPremium / 1e6).toFixed(1)}M
                      </div>
                      <div className="text-[var(--text-low)]">
                        Calls: {flowSummary.callCount} | Puts: {flowSummary.putCount}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Gamma indicator */}
              {gammaData && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "px-1.5 py-0.5 rounded font-mono font-medium",
                        gammaData.netGamma > 0
                          ? "bg-[var(--accent-info)]/20 text-[var(--accent-info)]"
                          : "bg-orange-500/20 text-orange-500"
                      )}
                    >
                      {gammaData.netGamma > 0 ? "G+" : "G-"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-semibold mb-1">Gamma Exposure</div>
                      <div className="text-[var(--text-low)]">
                        {gammaData.netGamma > 0 ? "Positive (Support)" : "Negative (Resistance)"}
                      </div>
                      {gammaData.majorStrike && (
                        <div className="text-[var(--text-low)]">
                          Key: ${gammaData.majorStrike.toFixed(0)}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* IV indicator */}
              {ivData && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "px-1.5 py-0.5 rounded font-mono font-medium",
                        ivData.iv_percentile >= 70
                          ? "bg-red-500/20 text-red-500"
                          : ivData.iv_percentile >= 40
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                      )}
                    >
                      IV{Math.round(ivData.iv_percentile)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-semibold mb-1">IV Percentile</div>
                      <div className="text-[var(--text-low)]">
                        {ivData.iv_percentile.toFixed(0)}th percentile
                      </div>
                      <div className="text-[var(--text-low)]">{ivData.iv_regime || "Normal"}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Remove button */}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="min-w-[24px] min-h-[24px] flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all touch-manipulation active:scale-95"
              title="Remove from watchlist"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
