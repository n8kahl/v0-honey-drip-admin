/**
 * HDRowWatchlist - Scanner-grade watchlist row with collapsible details
 *
 * Layout (collapsed):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [▶] [Signal] SPY    $605.23 +0.45%    ████░░ sparkline   78▓▓░  │
 * │                                                [MTF][RSI][VOL]  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Layout (expanded):
 * ├─────────────────────────────────────────────────────────────────┤
 * │  ✓ Multi-Timeframe Trend Alignment                              │
 * │  ✓ RSI Momentum Confirmation                                    │
 * │  ○ Volume Confirmation                                          │
 * │  ✓ Above VWAP                                                   │
 * │  [Power mode: Flow details, Gamma details, IV details]          │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { Ticker } from "../../../types";
import { formatPrice, cn } from "../../../lib/utils";
import { X, ChevronRight, ChevronDown } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useUIStore } from "../../../stores";
import { Collapsible, CollapsibleContent } from "../../ui/collapsible";
import { useRef, useEffect, useState } from "react";
import type { CompositeSignal } from "../../../lib/composite/CompositeSignal";
import { CompositeSignalBadge } from "../signals/CompositeSignalBadge";
import { HDMiniSparkline, HDMiniSparklineSkeleton } from "../charts/HDMiniSparkline";
import { HDLiveIndicator, type DataStatus } from "../common/HDLiveIndicator";
import { HDConfluenceMeter } from "../common/HDConfluenceMeter";
import { HDSignalChips } from "../common/HDSignalChips";
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
  /** View mode: clean (minimal) or power (full metrics) */
  viewMode?: "clean" | "power";
  /** Is this row expanded */
  isExpanded?: boolean;
  /** Callback when expansion changes */
  onExpandChange?: (expanded: boolean) => void;
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

  // Warehouse data integration (only used in power mode)
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

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandChange}>
      <div
        className={cn(
          "relative w-full flex flex-col border-b border-[var(--border-hairline)] group",
          "transition-all duration-150 ease-out",
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
                  <span
                    className={cn("text-[10px] font-mono font-medium tabular-nums", priceColor)}
                  >
                    {changePercent > 0 ? "+" : ""}
                    {changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Sparkline + Confluence Meter + Signal Chips */}
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

                {/* Confluence meter (replaces old tooltip-based beacon) */}
                <HDConfluenceMeter score={confluenceScore} size="sm" symbol={ticker.symbol} />

                {/* Signal chips (collapsed mode: max 3 passing chips) */}
                <HDSignalChips components={confluenceComponents} max={3} />

                {/* Power mode badges (Flow/Gamma/IV) - only in power mode */}
                {viewMode === "power" && (
                  <div className="flex items-center gap-1 text-[10px]">
                    {/* Flow indicator */}
                    {flowSummary && (
                      <div
                        className={cn(
                          "px-1.5 py-0.5 rounded font-mono font-medium",
                          flowSummary.netPremium > 0
                            ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                            : "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                        )}
                        title={`Options Flow: Net $${(flowSummary.netPremium / 1e6).toFixed(1)}M`}
                        data-testid={`flow-badge-${ticker.symbol}`}
                      >
                        {flowSummary.netPremium > 0 ? "F+" : "F-"}
                      </div>
                    )}

                    {/* Gamma indicator */}
                    {gammaData && (
                      <div
                        className={cn(
                          "px-1.5 py-0.5 rounded font-mono font-medium",
                          gammaData.netGamma > 0
                            ? "bg-[var(--accent-info)]/20 text-[var(--accent-info)]"
                            : "bg-orange-500/20 text-orange-500"
                        )}
                        title={`Gamma: ${gammaData.netGamma > 0 ? "Positive (Support)" : "Negative (Resistance)"}`}
                        data-testid={`gamma-badge-${ticker.symbol}`}
                      >
                        {gammaData.netGamma > 0 ? "G+" : "G-"}
                      </div>
                    )}

                    {/* IV indicator */}
                    {ivData && (
                      <div
                        className={cn(
                          "px-1.5 py-0.5 rounded font-mono font-medium",
                          ivData.iv_percentile >= 70
                            ? "bg-red-500/20 text-red-500"
                            : ivData.iv_percentile >= 40
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                        )}
                        title={`IV Percentile: ${ivData.iv_percentile.toFixed(0)}th`}
                        data-testid={`iv-badge-${ticker.symbol}`}
                      >
                        IV{Math.round(ivData.iv_percentile)}
                      </div>
                    )}
                  </div>
                )}
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
                  className="relative z-30 ml-2 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-[var(--radius)] opacity-50 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/20 transition-all touch-manipulation active:scale-95 pointer-events-auto"
                  title="Remove from watchlist"
                >
                  <X className="w-4 h-4" />
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
            {/* Full confluence checklist */}
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                Confluence Factors
              </div>
              <HDSignalChips components={confluenceComponents} showAll />
            </div>

            {/* Power mode: additional metrics */}
            {viewMode === "power" && (flowSummary || gammaData || ivData) && (
              <div className="mt-3 pt-2 border-t border-[var(--border-hairline)]">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                  Advanced Metrics
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {flowSummary && (
                    <div>
                      <div className="text-zinc-500 text-[10px]">Flow</div>
                      <div
                        className={cn(
                          "font-mono",
                          flowSummary.netPremium > 0
                            ? "text-[var(--accent-positive)]"
                            : "text-[var(--accent-negative)]"
                        )}
                      >
                        ${(flowSummary.netPremium / 1e6).toFixed(1)}M
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        C: {flowSummary.callCount} / P: {flowSummary.putCount}
                      </div>
                    </div>
                  )}
                  {gammaData && (
                    <div>
                      <div className="text-zinc-500 text-[10px]">Gamma</div>
                      <div
                        className={cn(
                          "font-mono",
                          gammaData.netGamma > 0 ? "text-[var(--accent-info)]" : "text-orange-500"
                        )}
                      >
                        {gammaData.netGamma > 0 ? "+" : ""}
                        {gammaData.netGamma?.toFixed(0) || "N/A"}
                      </div>
                      {gammaData.majorStrike && (
                        <div className="text-[10px] text-zinc-500">
                          Key: ${gammaData.majorStrike.toFixed(0)}
                        </div>
                      )}
                    </div>
                  )}
                  {ivData && (
                    <div>
                      <div className="text-zinc-500 text-[10px]">IV</div>
                      <div
                        className={cn(
                          "font-mono",
                          ivData.iv_percentile >= 70
                            ? "text-red-500"
                            : ivData.iv_percentile >= 40
                              ? "text-yellow-500"
                              : "text-[var(--accent-positive)]"
                        )}
                      >
                        {ivData.iv_percentile.toFixed(0)}th %ile
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {ivData.iv_regime || "Normal"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
