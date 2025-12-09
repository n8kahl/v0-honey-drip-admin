/**
 * DecisionVizGrid - 4-Box Layout for Decision Visualization
 *
 * Replaces the old chart area with a collapsible grid showing all visualization
 * modes side-by-side: Sparkline (A), Range (B), MTF (C), and Mini Chart (D).
 */

import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../../../lib/utils";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Activity,
  BarChart3,
  Layers,
} from "lucide-react";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { Candle, Indicators, MTFTrend, Timeframe } from "../../../stores/marketDataStore";

import { DecisionVizSparkline } from "./DecisionVizSparkline";
import { DecisionVizRange } from "./DecisionVizRange";
import { DecisionVizMTF } from "./DecisionVizMTF";

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
  changePercent?: number;
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
  changePercent,
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
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide shrink-0">
            Decision Viz
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
              healthBadge.className
            )}
          >
            {healthBadge.label}
          </span>

          {/* Collapsed summary */}
          {!expanded && (
            <div className="flex items-center gap-2 ml-3 text-xs text-[var(--text-muted)] truncate">
              <span
                className={cn(
                  summary.trendSummary === "Bullish" && "text-[var(--accent-positive)]",
                  summary.trendSummary === "Bearish" && "text-[var(--accent-negative)]"
                )}
              >
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

        {/* Right: Actions - use shrink-0 to prevent overlap */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* TradingView Button */}
          <a
            href={tradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors"
            title="Open in TradingView"
          >
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Retry Button (if stale) */}
          {dataHealth === "stale" && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/10 transition-colors"
              title="Retry loading data"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}

          {/* Expand/Collapse Toggle */}
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
            <DecisionVizSparkline candles={candles} keyLevels={keyLevels} currentPrice={price} />
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
            <DecisionVizMTF mtfTrend={mtfTrend} indicators={indicators} candles={candles} />
          </div>

          {/* Mode D: Symbol & Price Display */}
          <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] min-h-[200px] flex flex-col justify-center items-center">
            {/* Symbol */}
            <div className="text-3xl font-bold text-[var(--text-high)] tracking-tight">
              {symbol}
            </div>

            {/* Current Price */}
            <div className="text-2xl font-semibold text-[var(--text-high)] tabular-nums mt-1">
              ${price.toFixed(2)}
            </div>

            {/* Change Percent */}
            {changePercent !== undefined && (
              <div
                className={cn(
                  "text-lg font-medium tabular-nums mt-1",
                  changePercent > 0 && "text-[var(--accent-positive)]",
                  changePercent < 0 && "text-[var(--accent-negative)]",
                  changePercent === 0 && "text-[var(--text-muted)]"
                )}
              >
                {changePercent > 0 ? "+" : ""}
                {changePercent.toFixed(2)}%
              </div>
            )}

            {/* Data Health Indicator */}
            <div className="flex items-center gap-1.5 mt-3 text-[10px] text-[var(--text-faint)]">
              <Activity className="w-3 h-3" />
              <span>
                {dataHealth === "live" ? "Live" : dataHealth === "delayed" ? "Delayed" : "Stale"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DecisionVizGrid;
