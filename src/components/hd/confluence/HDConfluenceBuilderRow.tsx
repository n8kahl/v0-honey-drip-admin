/**
 * HDConfluenceBuilderRow.tsx - Per-symbol confluence display row
 *
 * Shows a symbol's confluence factors building toward entry:
 * - Header: Symbol, price, change, overall score
 * - Grid of factor gauges (RVOL, Flow, RSI, etc.)
 * - MTF alignment visual
 * - Actions: View Chain, Load Setup
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { HDFactorGauge, HDFactorChip } from "./HDFactorGauge";
import { MTFHeatmap } from "../viz/MTFHeatmap";
import { useSymbolConfluence, type SymbolConfluence } from "../../../hooks/useSymbolConfluence";

// ============================================================================
// Types
// ============================================================================

interface HDConfluenceBuilderRowProps {
  /** Symbol to display (e.g., "SPY") */
  symbol: string;
  /** Pre-computed confluence data (from useWatchlistConfluence) */
  confluenceData?: SymbolConfluence;
  /** Callback when "View Chain" is clicked */
  onViewChain?: (symbol: string) => void;
  /** Callback when "Load Setup" is clicked */
  onLoadSetup?: (symbol: string) => void;
  /** Start expanded */
  defaultExpanded?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function HDConfluenceBuilderRow({
  symbol,
  confluenceData: precomputedData,
  onViewChain,
  onLoadSetup,
  defaultExpanded = false,
  className,
}: HDConfluenceBuilderRowProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Get detailed confluence when expanded (includes full factor calculations)
  const detailedConfluence = useSymbolConfluence(isExpanded ? symbol : "");

  // Use precomputed data for compact view, detailed for expanded
  const confluence = isExpanded && detailedConfluence ? detailedConfluence : precomputedData;

  if (!confluence) {
    return (
      <div className={cn("p-3 border-b border-[var(--border-hairline)]", className)}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{symbol}</span>
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
        </div>
      </div>
    );
  }

  const priceColor =
    confluence.changePercent >= 0
      ? "text-[var(--accent-positive)]"
      : "text-[var(--accent-negative)]";
  const scoreColor = confluence.isReady
    ? "text-[var(--accent-positive)]"
    : confluence.isHot
      ? "text-amber-400"
      : "text-[var(--text-muted)]";

  return (
    <div
      className={cn(
        "border-b border-[var(--border-hairline)] transition-all duration-200",
        confluence.isReady &&
          "bg-[var(--accent-positive)]/5 border-l-2 border-l-[var(--accent-positive)]",
        confluence.isHot && !confluence.isReady && "bg-amber-400/5 border-l-2 border-l-amber-400",
        className
      )}
    >
      {/* Compact Header Row */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-1)]",
          isExpanded && "bg-[var(--surface-1)]"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        <button className="p-0.5 hover:bg-[var(--surface-2)] rounded">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>

        {/* Symbol + Price */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="font-bold text-[var(--text-high)]">{confluence.symbol}</span>
          <span className="font-mono tabular-nums text-sm text-[var(--text-muted)]">
            ${confluence.price.toFixed(2)}
          </span>
          <span className={cn("text-xs font-medium tabular-nums", priceColor)}>
            {confluence.changePercent >= 0 ? "+" : ""}
            {confluence.changePercent.toFixed(1)}%
          </span>
        </div>

        {/* Quick Factor Summary (compact view) */}
        {!isExpanded && confluence.factors.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 flex-1">
            {confluence.factors.slice(0, 5).map((factor) => (
              <HDFactorChip key={factor.name} factor={factor} />
            ))}
          </div>
        )}

        {/* MTF Heatmap */}
        <div className="hidden sm:block w-[200px]">
          <MTFHeatmap
            timeframes={confluence.mtf.map((tf) => ({
              tf: tf.timeframe,
              trend: tf.direction === "up" ? "bull" : tf.direction === "down" ? "bear" : "neutral",
              label: tf.label,
            }))}
            className="gap-0.5"
          />
        </div>

        {/* Overall Score */}
        <div className="flex items-center gap-2 ml-auto">
          {confluence.isReady && (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] animate-pulse">
              READY
            </span>
          )}
          {confluence.isHot && !confluence.isReady && (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400">
              HOT
            </span>
          )}

          {/* Score Bar */}
          <div className="flex items-center gap-1.5 min-w-[80px]">
            <div className="w-12 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  confluence.isReady
                    ? "bg-[var(--accent-positive)]"
                    : confluence.isHot
                      ? "bg-amber-400"
                      : "bg-[var(--text-muted)]"
                )}
                style={{
                  width: `${Math.min(100, (confluence.overallScore / confluence.threshold) * 100)}%`,
                }}
              />
            </div>
            <span className={cn("text-sm font-bold font-mono tabular-nums", scoreColor)}>
              {confluence.overallScore.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--border-hairline)]">
          {/* Factors Grid */}
          {detailedConfluence && detailedConfluence.factors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
              {detailedConfluence.factors.map((factor) => (
                <HDFactorGauge key={factor.name} factor={factor} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4 text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading factors...
            </div>
          )}

          {/* MTF Alignment Full */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                Fractal Trend Alignment
              </span>
            </div>
            <MTFHeatmap
              timeframes={confluence.mtf.map((tf) => ({
                tf: tf.timeframe,
                trend:
                  tf.direction === "up" ? "bull" : tf.direction === "down" ? "bear" : "neutral",
                label: tf.label,
              }))}
              className="gap-1 h-8"
              orientation="horizontal"
            />
          </div>

          {/* Footer: Style + Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-hairline)]">
            {/* Best Style */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Best fit:</span>
              <span
                className={cn(
                  "text-xs font-bold uppercase px-2 py-0.5 rounded",
                  confluence.bestStyle === "scalp" && "bg-purple-500/20 text-purple-400",
                  confluence.bestStyle === "day" && "bg-blue-500/20 text-blue-400",
                  confluence.bestStyle === "swing" && "bg-amber-500/20 text-amber-400"
                )}
              >
                {confluence.bestStyle}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewChain?.(confluence.symbol);
                }}
                className="text-xs h-7"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Chain
              </Button>

              {confluence.isHot && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSetup?.(confluence.symbol);
                  }}
                  className={cn(
                    "text-xs h-7",
                    confluence.isReady &&
                      "bg-[var(--accent-positive)] hover:bg-[var(--accent-positive)]/90",
                    !confluence.isReady && "bg-amber-500 hover:bg-amber-500/90"
                  )}
                >
                  Load Setup
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HDConfluenceBuilderRow;
