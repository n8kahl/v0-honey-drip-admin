/**
 * MobileTickerTape - Sticky header showing active focus symbol
 *
 * The "Ticker Tape" displays the currently focused symbol with:
 * - Symbol name + price
 * - SmartScoreBadge (mini ring)
 * - FlowPulse (compact bar)
 *
 * Designed for institutional-grade mobile trading.
 */

import { useMemo } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useMarketStore } from "../../stores/marketStore";
import { useSymbolData } from "../../stores/marketDataStore";
import { useFlowContext } from "../../hooks/useFlowContext";
import { normalizeSymbolForAPI } from "../../lib/symbolUtils";
import { SmartScoreBadge, FlowPulse } from "../hd/terminal";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface MobileTickerTapeProps {
  onSymbolClick?: () => void;
}

export function MobileTickerTape({ onSymbolClick }: MobileTickerTapeProps) {
  const focusSymbol = useUIStore((s) => s.mainCockpitSymbol);
  const watchlist = useMarketStore((s) => s.watchlist);

  // Find the ticker data from watchlist
  const ticker = useMemo(() => {
    if (!focusSymbol) return null;
    return watchlist.find((t) => t.symbol === focusSymbol);
  }, [focusSymbol, watchlist]);

  // Get symbol data from marketDataStore
  const symbolData = useSymbolData(focusSymbol || "");

  // Get live flow context
  const normalizedSymbol = normalizeSymbolForAPI(focusSymbol || "");
  const {
    short: flowContext,
    primarySentiment,
    sweepCount,
  } = useFlowContext(normalizedSymbol, {
    refreshInterval: 30000,
    windows: ["short"],
  });

  // Calculate flow data for FlowPulse
  const flowData = useMemo(() => {
    if (!flowContext) return undefined;

    const buyPressure =
      flowContext.totalVolume && flowContext.totalVolume > 0
        ? (flowContext.buyVolume / flowContext.totalVolume) * 100
        : 50;

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
  }, [flowContext, primarySentiment, sweepCount]);

  // Price data
  const currentPrice = ticker?.last ?? 0;
  const changePercent = ticker?.changePercent ?? 0;
  const isPositive = changePercent >= 0;
  const confluenceScore = symbolData?.confluence?.overall ?? 0;

  // No symbol selected state
  if (!focusSymbol || !ticker) {
    return (
      <div className="sticky top-0 z-40 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
        <div className="safe-area-top" />
        <div className="flex items-center justify-center h-14 px-4">
          <button
            onClick={onSymbolClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] min-h-[44px]"
          >
            <span className="text-sm text-[var(--text-muted)]">Tap to select symbol</span>
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
      {/* Safe area for notch */}
      <div className="safe-area-top" />

      {/* Main ticker tape content */}
      <div className="px-4 py-3">
        {/* Row 1: Symbol + Price + SmartScore */}
        <div className="flex items-center justify-between mb-2">
          {/* Symbol + Price (tappable) */}
          <button
            onClick={onSymbolClick}
            className="flex items-center gap-3 min-h-[44px] -ml-2 px-2 rounded-xl active:bg-[var(--surface-2)] transition-colors"
          >
            {/* Symbol name - large and bold */}
            <span className="text-2xl font-bold text-[var(--text-high)] tracking-tight">
              {focusSymbol}
            </span>

            {/* Dropdown indicator */}
            <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
          </button>

          {/* Price + Change */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-semibold text-[var(--text-high)] tabular-nums">
                ${currentPrice.toFixed(2)}
              </div>
              <div
                className={cn(
                  "flex items-center justify-end gap-1 text-sm font-medium tabular-nums",
                  isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%
              </div>
            </div>

            {/* SmartScore Ring */}
            <SmartScoreBadge score={confluenceScore} size="sm" showValue />
          </div>
        </div>

        {/* Row 2: Flow Pulse (compact) */}
        <FlowPulse flow={flowData} compact showLabels={false} />
      </div>
    </div>
  );
}

export default MobileTickerTape;
