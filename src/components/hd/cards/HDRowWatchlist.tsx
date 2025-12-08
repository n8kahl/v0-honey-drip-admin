import { Ticker } from "../../../types";
import { formatPrice, cn } from "../../../lib/utils";
import { X, Wifi, Zap, Activity } from "lucide-react";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useUIStore } from "../../../stores";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { useRef, useEffect } from "react";
import type { CompositeSignal } from "../../../lib/composite/CompositeSignal";
import { CompositeSignalBadge } from "../signals/CompositeSignalBadge";

interface HDRowWatchlistProps {
  ticker: Ticker;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  /** Composite signals for this symbol (from useCompositeSignals) */
  compositeSignals?: CompositeSignal[];
}

export function HDRowWatchlist({
  ticker,
  active,
  onClick,
  onRemove,
  compositeSignals,
}: HDRowWatchlistProps) {
  // Get all data from marketDataStore (single source of truth)
  const symbolData = useSymbolData(ticker.symbol);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const scrollChartToBar = useUIStore((state) => state.scrollChartToBar);
  const setMainCockpitSymbol = useUIStore((state) => state.setMainCockpitSymbol);
  // Explicit store instance for row click, per request
  const uiStore = useUIStore();

  // Local timestamp tracking based on price changes since marketDataStore isn't updating quotes
  const lastUpdateRef = useRef<number>(Date.now());
  const prevPriceRef = useRef<number>(ticker.last);

  useEffect(() => {
    if (ticker.last !== prevPriceRef.current) {
      lastUpdateRef.current = Date.now();
      prevPriceRef.current = ticker.last;
    }
  }, [ticker.last]);

  const currentPrice = ticker.last;
  const changePercent = ticker.changePercent || 0;
  const change = ticker.change || 0;

  // Determine price direction color
  const priceColor =
    changePercent > 0
      ? "text-green-500"
      : changePercent < 0
        ? "text-red-500"
        : "text-[var(--text-high)]";

  // Prefer symbolData timestamp if present, else fallback to local ref
  const lastUpdated = symbolData?.lastUpdated || lastUpdateRef.current;
  const strategySignals = symbolData?.strategySignals || [];
  const activeCount = Array.isArray(strategySignals)
    ? strategySignals.filter((s: any) => s?.active === true || s?.status === "ACTIVE").length
    : 0;
  const indicators = symbolData?.indicators;
  const confluence = symbolData?.confluence;

  // Filter active signals
  const activeSignals = strategySignals.filter((s) => s.status === "ACTIVE");
  const activeSignalCount = activeSignals.length;

  // Prepare tooltip lines with strategy IDs and confluence score
  const confluenceScore = symbolData?.confluence?.overall;
  const tooltipText = activeSignals.length
    ? `${ticker.symbol}: ${activeSignals.map((s) => s.strategyId).join(", ")} · conf ${
        typeof confluenceScore === "number" ? Math.round(confluenceScore) : "-"
      }`
    : undefined;

  // Handle badge click - navigate to chart at signal bar
  const handleBadgeClick = (signal: any) => {
    console.log("[v0] Strategy badge clicked:", signal);

    // First, select this ticker if not already active
    if (!active) {
      onClick?.();
    }

    // Switch to live tab to show chart
    setActiveTab("live");

    // Scroll chart to the bar where signal triggered
    if (signal.barTimeKey) {
      // Small delay to ensure chart is rendered
      setTimeout(() => {
        scrollChartToBar(signal.barTimeKey);
      }, 100);
    } else {
      console.warn("[v0] Signal missing barTimeKey, cannot scroll chart");
    }
  };

  // Staleness check: stale if lastUpdated > 30s ago (aligned with marketDataStore)
  const isStale = lastUpdated ? Date.now() - lastUpdated > 30000 : true;

  // Confluence / monitoring status
  const confluenceStatus = (() => {
    if (!symbolData?.confluence || !lastUpdated)
      return { label: "Monitoring", tone: "muted" as const };
    if (isStale) return { label: "Stale", tone: "danger" as const };
    const score = symbolData.confluence.overall ?? 0;
    if (score >= 80) return { label: "Confluence", tone: "success" as const, score };
    if (score >= 60) return { label: "Setup", tone: "warn" as const, score };
    return { label: "Monitoring", tone: "muted" as const, score };
  })();

  // Helper to format last updated text - must be defined before confluencePill
  const getLastUpdatedText = () => {
    if (!lastUpdated) return null;
    const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);
    if (secondsAgo < 5) return "Live";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };

  const lastUpdatedText = getLastUpdatedText();

  const confluencePill = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-[22px] items-center justify-center gap-1.5 px-2.5 text-[10px] leading-none font-medium rounded-full border",
            confluenceStatus.tone === "success" &&
              "bg-emerald-500/15 text-emerald-200 border-emerald-500/60",
            confluenceStatus.tone === "warn" &&
              "bg-amber-500/15 text-amber-200 border-amber-500/60",
            confluenceStatus.tone === "danger" && "bg-red-500/15 text-red-200 border-red-500/60",
            confluenceStatus.tone === "muted" && "bg-zinc-700/40 text-zinc-200 border-zinc-600/80"
          )}
        >
          {confluenceStatus.label === "Monitoring" && <Activity className="w-3 h-3" />}
          {confluenceStatus.label === "Setup" && <Zap className="w-3 h-3" />}
          {confluenceStatus.label === "Confluence" && <Zap className="w-3 h-3" />}
          {confluenceStatus.label === "Stale" && <Wifi className="w-3 h-3" />}
          <span className="leading-none">{confluenceStatus.label}</span>
          {typeof confluenceStatus.score === "number" && (
            <span className="font-mono text-[10px] leading-none opacity-80">
              {Math.round(confluenceStatus.score)}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="bg-[var(--surface-4)] text-[var(--text-high)] border border-[var(--border-strong)] max-w-xs px-3 py-2.5 shadow-lg rounded-[10px]">
        <div className="flex items-center justify-between text-[11px] font-semibold leading-tight">
          <span>
            {ticker.symbol} · {confluenceStatus.label}
          </span>
          {typeof confluenceStatus.score === "number" && (
            <span className="font-mono text-[11px] text-emerald-200">
              {Math.round(confluenceStatus.score)}
            </span>
          )}
        </div>
        <div className="mt-1 text-[10.5px] text-[var(--text-muted)] leading-tight">
          {lastUpdatedText ? `Updated ${lastUpdatedText}` : "No recent updates"}
        </div>
        {symbolData?.confluence && (
          <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px] text-[var(--text-high)] leading-tight">
            <span className="text-[var(--text-muted)]">Trend</span>
            <span className="font-mono text-right">
              {Math.round(symbolData.confluence.trend ?? 0)}
            </span>
            <span className="text-[var(--text-muted)]">Momentum</span>
            <span className="font-mono text-right">
              {Math.round(symbolData.confluence.momentum ?? 0)}
            </span>
            <span className="text-[var(--text-muted)]">Volume</span>
            <span className="font-mono text-right">
              {Math.round(symbolData.confluence.volume ?? 0)}
            </span>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );

  // Defensive: fallback for missing price
  const priceDisplay =
    typeof currentPrice === "number" && !isNaN(currentPrice) ? (
      formatPrice(currentPrice)
    ) : (
      <span className="text-[var(--text-muted)] italic">N/A</span>
    );

  // Loading skeleton
  if (!ticker || !ticker.symbol) {
    return (
      <div className="w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] animate-pulse">
        <div className="h-4 w-16 bg-[var(--surface-2)] rounded" />
        <div className="h-4 w-10 bg-[var(--surface-2)] rounded" />
      </div>
    );
  }

  // No animation per request
  const pulseClass = "";

  return (
    <div
      className={cn(
        "w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] group min-h-[48px]",
        "cursor-pointer hover:bg-zinc-800 transition-colors duration-150 ease-out touch-manipulation",
        active && "bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)] shadow-sm",
        isStale && "opacity-60",
        pulseClass
      )}
      data-testid={`watchlist-item-${ticker.symbol}`}
      onClick={() => {
        onClick?.();
        uiStore.setMainCockpitSymbol(ticker.symbol);
      }}
    >
      <div
        className="flex-1 flex items-center justify-between text-left"
        title={isStale ? "Data is stale" : undefined}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {/* Composite signals - primary signal display */}
            {compositeSignals && compositeSignals.length > 0 && (
              <CompositeSignalBadge
                symbol={ticker.symbol}
                signals={compositeSignals}
                compact
                className="mr-1"
              />
            )}
            {/* Fallback to legacy signals if no composite signals */}
            {(!compositeSignals || compositeSignals.length === 0) && activeSignalCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-xs font-medium rounded mr-1",
                      "bg-zinc-700 text-zinc-300"
                    )}
                    aria-label={`${activeSignalCount} active setups`}
                  >
                    {activeSignalCount}
                  </span>
                </TooltipTrigger>
                {tooltipText && (
                  <TooltipContent
                    side="bottom"
                    className="bg-zinc-800 text-zinc-200 border border-zinc-700"
                  >
                    <div className="max-w-xs whitespace-pre-wrap text-xs">{tooltipText}</div>
                  </TooltipContent>
                )}
              </Tooltip>
            )}
            <span className="text-[var(--text-high)] font-medium">{ticker.symbol}</span>
            {confluencePill}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Wifi className="w-2.5 h-2.5 text-green-500" />
            {lastUpdatedText}
            {isStale && <span className="ml-1 text-red-500">stale</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className={cn("font-mono text-sm font-medium", priceColor)}>{priceDisplay}</span>
            {changePercent !== 0 && (
              <span className={cn("text-[10px] font-mono font-medium", priceColor)}>
                {changePercent > 0 ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
            )}
          </div>
          {indicators?.ema9 && (
            <span
              className={cn(
                "text-[10px] font-mono",
                currentPrice > indicators.ema9 ? "text-green-500" : "text-red-500"
              )}
            >
              EMA9: {indicators.ema9.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all touch-manipulation active:scale-95"
          title="Remove from watchlist"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
