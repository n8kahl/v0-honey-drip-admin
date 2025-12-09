/**
 * DecisionViz - Main Container with Mode Toggle
 *
 * Displays above SymbolSummaryStrip/Options Chain in NowPanelSymbol.
 * Provides 3 visualization modes (A/B/C) with auto-defaulting based on data health.
 *
 * Modes:
 * - A: Sparkline + Levels (default when data fresh)
 * - B: Range + ATR Gauge (fallback when data stale)
 * - C: MTF Ladder (when candle data sparse but indicators exist)
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ExternalLink, RefreshCw, Activity, BarChart3, Layers } from "lucide-react";
import { cn } from "../../../lib/utils";
import { chipStyle } from "../../../ui/semantics";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { Candle, Indicators, MTFTrend, Timeframe } from "../../../stores/marketDataStore";

import { DecisionVizSparkline } from "./DecisionVizSparkline";
import { DecisionVizRange } from "./DecisionVizRange";
import { DecisionVizMTF } from "./DecisionVizMTF";

// ============================================================================
// Types
// ============================================================================

export type VizMode = "A" | "B" | "C";
export type DataHealth = "live" | "delayed" | "stale";

export interface DecisionVizProps {
  symbol: string;
  candles: Candle[];
  keyLevels: KeyLevels | null;
  indicators: Indicators;
  mtfTrend: Record<Timeframe, MTFTrend>;
  dataHealth: DataHealth;
  onRetry?: () => void;
  currentPrice?: number;
}

// ============================================================================
// Local Storage Key
// ============================================================================

const STORAGE_KEY = "decisionViz.mode";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default mode based on data availability and health
 */
function getDefaultMode(
  candles: Candle[],
  keyLevels: KeyLevels | null,
  dataHealth: DataHealth
): VizMode {
  // If chart data is fresh and available → A Sparkline
  if (candles.length >= 20 && dataHealth === "live") return "A";

  // If chart fails OR data stale → B Range+ATR (works with less data)
  if (dataHealth === "stale" || candles.length < 10) return "B";

  // If candle data sparse but indicators exist → C MTF Ladder
  if (candles.length < 20) return "C";

  return "A"; // Default
}

/**
 * Get stored mode preference from localStorage
 */
function getStoredMode(): VizMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "A" || stored === "B" || stored === "C") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  return null;
}

/**
 * Store mode preference in localStorage
 */
function setStoredMode(mode: VizMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage may be unavailable
  }
}

// ============================================================================
// Component
// ============================================================================

export function DecisionViz({
  symbol,
  candles,
  keyLevels,
  indicators,
  mtfTrend,
  dataHealth,
  onRetry,
  currentPrice,
}: DecisionVizProps) {
  // Get initial mode: stored preference or auto-default
  const autoMode = useMemo(
    () => getDefaultMode(candles, keyLevels, dataHealth),
    [candles.length, keyLevels, dataHealth]
  );

  const [mode, setMode] = useState<VizMode>(() => {
    const stored = getStoredMode();
    return stored || autoMode;
  });

  // Update stored mode when user changes it
  const handleModeChange = useCallback((newMode: VizMode) => {
    setMode(newMode);
    setStoredMode(newMode);
  }, []);

  // Get actual current price from candles if not provided
  const price = useMemo(() => {
    if (currentPrice) return currentPrice;
    if (candles.length > 0) {
      return candles[candles.length - 1].close;
    }
    return 0;
  }, [currentPrice, candles]);

  // Mode button config
  const modeButtons: { mode: VizMode; label: string; icon: React.ReactNode }[] = [
    { mode: "A", label: "Sparkline", icon: <Activity className="w-3 h-3" /> },
    { mode: "B", label: "Range", icon: <BarChart3 className="w-3 h-3" /> },
    { mode: "C", label: "MTF", icon: <Layers className="w-3 h-3" /> },
  ];

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

  // TradingView URL
  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${symbol}`;

  return (
    <div className="p-3 border-b border-[var(--border-hairline)]">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
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
        </div>

        {/* Right: Mode Toggle + Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle Pills */}
          <div className="flex items-center bg-[var(--surface-2)] rounded-md p-0.5">
            {modeButtons.map(({ mode: m, label, icon }) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all duration-150",
                  mode === m
                    ? "bg-[var(--brand-primary)] text-black"
                    : "text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)]"
                )}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

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
        </div>
      </div>

      {/* Body: Render Selected Mode */}
      <div className="animate-crossfade">
        {mode === "A" && (
          <DecisionVizSparkline
            candles={candles}
            keyLevels={keyLevels}
            currentPrice={price}
          />
        )}
        {mode === "B" && (
          <DecisionVizRange
            candles={candles}
            keyLevels={keyLevels}
            indicators={indicators}
            currentPrice={price}
          />
        )}
        {mode === "C" && (
          <DecisionVizMTF
            mtfTrend={mtfTrend}
            indicators={indicators}
            candles={candles}
          />
        )}
      </div>
    </div>
  );
}

export default DecisionViz;
