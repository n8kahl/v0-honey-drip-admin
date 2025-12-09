/**
 * DecisionVizGrid - 4-Box Layout for Decision Visualization
 *
 * Replaces the old chart area with a collapsible grid showing all visualization
 * modes side-by-side: Sparkline (A), Range (B), MTF (C), and Mini Chart (D).
 */

import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../../../lib/utils";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Activity, BarChart3, Layers, LineChart } from "lucide-react";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { Candle, Indicators, MTFTrend, Timeframe } from "../../../stores/marketDataStore";

import { DecisionVizSparkline } from "./DecisionVizSparkline";
import { DecisionVizRange } from "./DecisionVizRange";
import { DecisionVizMTF } from "./DecisionVizMTF";
import { HDLiveChart } from "../charts/HDLiveChart";

// ============================================================================
// Types
// ============================================================================

export type DataHealth = "live" | "delayed" | "stale";

export interface DecisionVizGridProps {
  symbol: string;
  candles: Candle[];
  keyLevels: KeyLevels | null;
  indicators: Indicators;
  mtfTrend: Record<Timeframe, MTFTrend>;
  dataHealth: DataHealth;
  onRetry?: () => void;
  currentPrice?: number;
  defaultExpanded?: boolean;
}

// ============================================================================
// Storage Key
// ============================================================================

const STORAGE_KEY = "decisionVizGrid.expanded";

function getStoredExpanded(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default to true (expanded) if not set
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

function setStoredExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(expanded));
  } catch {
    // localStorage may be unavailable
  }
}

// ============================================================================
// Component
// ============================================================================

export function DecisionVizGrid({
  symbol,
  candles,
  keyLevels,
  indicators,
  mtfTrend,
  dataHealth,
  onRetry,
  currentPrice,
  defaultExpanded,
}: DecisionVizGridProps) {
  const [expanded, setExpanded] = useState(() => {
    return defaultExpanded ?? getStoredExpanded();
  });

  const handleToggle = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    setStoredExpanded(newExpanded);
  }, [expanded]);

  // Get actual current price from candles if not provided
  const price = useMemo(() => {
    if (currentPrice) return currentPrice;
    if (candles.length > 0) {
      return candles[candles.length - 1].close;
    }
    return 0;
  }, [currentPrice, candles]);

  // Data health badge styling
  const healthBadge = useMemo(() => {
    switch (dataHealth) {
      case "live":
        return {
          label: "Live",
          className: "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
        };
      case "delayed":
        return {
          label: "Delayed",
          className: "bg-[var(--data-stale)]/20 text-[var(--data-stale)]",
        };
      case "stale":
        return {
          label: "Stale",
          className: "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] animate-pulse",
        };
    }
  }, [dataHealth]);

  // Compact summary for collapsed state
  const summary = useMemo(() => {
    const bullTrends = Object.values(mtfTrend).filter((t) => t === "bull").length;
    const bearTrends = Object.values(mtfTrend).filter((t) => t === "bear").length;

    let trendSummary = "Mixed";
    if (bullTrends >= 3) trendSummary = "Bullish";
    else if (bearTrends >= 3) trendSummary = "Bearish";

    const rsi = indicators.rsi14;
    let rsiSummary = "";
    if (rsi !== undefined) {
      if (rsi >= 70) rsiSummary = "OB";
      else if (rsi <= 30) rsiSummary = "OS";
      else rsiSummary = `RSI ${rsi.toFixed(0)}`;
    }

    return { trendSummary, rsiSummary };
  }, [mtfTrend, indicators.rsi14]);

  // TradingView URL
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${symbol}`;

  return (
    <div className="border-b border-[var(--border-hairline)]">
      {/* Header - Always Visible */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-1)]">
        {/* Left: Title + Health Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Decision Viz
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              healthBadge.className
            )}
          >
            {healthBadge.label}
          </span>

          {/* Collapsed summary */}
          {!expanded && (
            <div className="flex items-center gap-2 ml-3 text-xs text-[var(--text-muted)]">
              <span className={cn(
                summary.trendSummary === "Bullish" && "text-[var(--accent-positive)]",
                summary.trendSummary === "Bearish" && "text-[var(--accent-negative)]"
              )}>
                {summary.trendSummary}
              </span>
              {summary.rsiSummary && (
                <>
                  <span className="text-[var(--text-faint)]">•</span>
                  <span>{summary.rsiSummary}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* TradingView Button */}
          <a
            href={tradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
            title="Open in TradingView"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">TV</span>
          </a>

          {/* Retry Button (if stale) */}
          {dataHealth === "stale" && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/10 transition-colors"
              title="Retry loading data"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Retry</span>
            </button>
          )}

          {/* Expand/Collapse Toggle */}
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span className="hidden sm:inline">Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span className="hidden sm:inline">Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded: 4-Box Grid */}
      {expanded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 animate-fade-in-up">
          {/* Mode A: Sparkline */}
          <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-[var(--text-muted)]">
              <Activity className="w-3 h-3" />
              <span>Sparkline</span>
            </div>
            <DecisionVizSparkline
              candles={candles}
              keyLevels={keyLevels}
              currentPrice={price}
            />
          </div>

          {/* Mode B: Range + ATR */}
          <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-[var(--text-muted)]">
              <BarChart3 className="w-3 h-3" />
              <span>Range + ATR</span>
            </div>
            <DecisionVizRange
              candles={candles}
              keyLevels={keyLevels}
              indicators={indicators}
              currentPrice={price}
            />
          </div>

          {/* Mode C: MTF Ladder */}
          <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-[var(--text-muted)]">
              <Layers className="w-3 h-3" />
              <span>MTF Ladder</span>
            </div>
            <DecisionVizMTF
              mtfTrend={mtfTrend}
              indicators={indicators}
              candles={candles}
            />
          </div>

          {/* Mode D: Mini Chart */}
          <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] min-h-[200px]">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-medium text-[var(--text-muted)]">
              <LineChart className="w-3 h-3" />
              <span>1m Chart</span>
            </div>
            <div className="h-[160px]">
              <HDLiveChart
                ticker={symbol}
                initialTimeframe="1"
                height={160}
                showControls={false}
                showHeader={false}
                className="w-full"
                loadDelay={0}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DecisionVizGrid;
