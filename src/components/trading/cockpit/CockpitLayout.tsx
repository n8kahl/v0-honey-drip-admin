/**
 * CockpitLayout - State-Aware Dynamic Layout (No Scrolling)
 *
 * REWORKED V3: Fixed height allocations with CSS Grid to eliminate scrolling
 *
 * Layout Philosophy:
 * - WATCH/PLAN: Chart 65% + Confluence 35% on left, Plan + Contract on right
 * - LOADED: Same but with emphasized Plan panel (decision time)
 * - ENTERED: Chart maximized, confluence minimal bar, compact panels
 *
 * Key Changes from V2:
 * - Confluence is always a fixed 48px horizontal bar (no scrolling)
 * - Chart takes all remaining space on left
 * - Right column uses explicit pixel heights based on viewport
 */

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Ticker, Contract } from "../../../types";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import { ChevronUp, ChevronDown, Maximize2, Minimize2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type CockpitViewState = "watch" | "plan" | "loaded" | "entered" | "exited" | "expired";

export interface CockpitLayoutProps {
  viewState: CockpitViewState;
  symbol: string;
  trade?: Trade | null;
  contract?: Contract | null;
  activeTicker?: Ticker | null;
  keyLevels?: KeyLevels | null;
  /** Optional stale banner to show at top */
  staleBanner?: React.ReactNode;
  children: {
    header: React.ReactNode;
    chart: React.ReactNode;
    confluence: React.ReactNode;
    plan: React.ReactNode;
    contractPanel: React.ReactNode;
    actions: React.ReactNode;
  };
  className?: string;
}

// ============================================================================
// Layout Configuration V3
// ============================================================================

/**
 * Simplified layout config - now using fixed heights for clarity
 * Confluence is ALWAYS 48px (single-row horizontal bar)
 */
const LAYOUT_CONFIG: Record<
  CockpitViewState,
  {
    // Column widths as grid template
    gridTemplate: string;
    // Confluence bar height (fixed)
    confluenceHeight: number;
    // Right column panel split (plan gets this %, contract gets rest)
    planPercent: number;
    // Whether to show contract panel
    showContract: boolean;
    // Visual emphasis
    emphasizePlan: boolean;
    emphasizeActions: boolean;
    description: string;
  }
> = {
  watch: {
    gridTemplate: "1.8fr 1fr", // Unified 65/35 split for maximized chart
    confluenceHeight: 48,
    planPercent: 100, // Right panel is now unified CockpitRightPanel
    showContract: false, // Handled by CockpitRightPanel
    emphasizePlan: false,
    emphasizeActions: false,
    description: "Analyzing opportunity",
  },
  plan: {
    gridTemplate: "1.8fr 1fr", // Unified 65/35 split
    confluenceHeight: 48,
    planPercent: 100,
    showContract: false,
    emphasizePlan: true,
    emphasizeActions: false,
    description: "Reviewing plan",
  },
  loaded: {
    gridTemplate: "1.8fr 1fr", // Same as ENTERED for consistent chart size
    confluenceHeight: 48,
    planPercent: 100,
    showContract: false,
    emphasizePlan: true,
    emphasizeActions: true,
    description: "Ready to enter",
  },
  entered: {
    gridTemplate: "1.8fr 1fr", // Chart dominates
    confluenceHeight: 48,
    planPercent: 100,
    showContract: false,
    emphasizePlan: false,
    emphasizeActions: false,
    description: "Managing position",
  },
  exited: {
    gridTemplate: "1.8fr 1fr", // Unified
    confluenceHeight: 48,
    planPercent: 100,
    showContract: false,
    emphasizePlan: false,
    emphasizeActions: false,
    description: "Trade completed",
  },
  expired: {
    gridTemplate: "1.8fr 1fr", // Unified
    confluenceHeight: 48,
    planPercent: 100,
    showContract: false,
    emphasizePlan: false,
    emphasizeActions: true,
    description: "Trade expired",
  },
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main cockpit layout container with state-aware dynamic sizing
 * V3: Uses CSS Grid with fixed confluence height to prevent scrolling
 */
export function CockpitLayout({ viewState, staleBanner, children, className }: CockpitLayoutProps) {
  const config = useMemo(() => LAYOUT_CONFIG[viewState], [viewState]);

  return (
    <div
      className={cn("h-full flex flex-col overflow-hidden", "bg-[var(--surface-0)]", className)}
      data-testid="cockpit-layout"
      data-view-state={viewState}
    >
      {/* Stale Banner (optional) - shows above header when data is stale */}
      {staleBanner}

      {/* Header - Always visible, fixed height */}
      <div className="flex-shrink-0 z-20" data-testid="cockpit-header">
        {children.header}
      </div>

      {/* Main Content - CSS Grid with explicit columns */}
      <div
        className="flex-1 min-h-0 grid gap-2 p-2"
        style={{
          gridTemplateColumns: config.gridTemplate,
        }}
        data-testid="cockpit-main"
      >
        {/* Left Column: Chart + Confluence (stacked) */}
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
          {/* Chart Area - Takes all available space minus confluence */}
          <div
            className="flex-1 min-h-[200px] rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
            data-testid="cockpit-chart-area"
          >
            {children.chart}
          </div>

          {/* Confluence Panel - FIXED HEIGHT horizontal bar, never scrolls */}
          <div
            className="flex-shrink-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
            style={{ height: config.confluenceHeight }}
            data-testid="cockpit-confluence-area"
          >
            {children.confluence}
          </div>
        </div>

        {/* Right Column: Unified Panel (or legacy plan + contract if contractPanel provided) */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Unified Plan/Right Panel - Takes full height */}
          <div
            className={cn(
              "flex-1 min-h-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-auto",
              // In LOADED/PLAN state, panel gets emphasis border
              config.emphasizePlan &&
                "ring-2 ring-[var(--brand-primary)]/50 border-[var(--brand-primary)]/30"
            )}
            data-testid="cockpit-plan-area"
          >
            {children.plan}
          </div>

          {/* Legacy Contract Panel - Only show if explicitly provided and config allows */}
          {config.showContract && children.contractPanel && (
            <div
              className={cn(
                "mt-2 min-h-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-auto",
                config.emphasizePlan && "opacity-80"
              )}
              style={{ flex: "0 0 auto", maxHeight: "40%" }}
              data-testid="cockpit-contract-area"
            >
              {children.contractPanel}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar - Always visible, fixed height */}
      <div
        className={cn(
          "flex-shrink-0 z-10 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]",
          // Emphasize action bar in LOADED state (decision time)
          config.emphasizeActions && "bg-[var(--brand-primary)]/5"
        )}
        data-testid="cockpit-actions-bar"
      >
        {children.actions}
      </div>
    </div>
  );
}

// ============================================================================
// Mobile Layout V3 - Simplified Split Screen
// ============================================================================

/**
 * Mobile-optimized layout with fixed confluence bar
 */
export function CockpitLayoutMobile({
  viewState,
  staleBanner,
  children,
  className,
}: CockpitLayoutProps) {
  const [chartExpanded, setChartExpanded] = useState(false);
  const config = useMemo(() => LAYOUT_CONFIG[viewState], [viewState]);

  const toggleChart = useCallback(() => {
    setChartExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={cn("h-full flex flex-col overflow-hidden", "bg-[var(--surface-0)]", className)}
      data-testid="cockpit-layout-mobile"
      data-view-state={viewState}
    >
      {/* Stale Banner */}
      {staleBanner}

      {/* Compact Header */}
      <div className="flex-shrink-0 z-20">{children.header}</div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Chart Section - 60% when not expanded, full when expanded */}
        <div
          className={cn(
            "relative flex-shrink-0 transition-all duration-300 ease-out",
            chartExpanded ? "flex-1" : "h-[60%]",
            "min-h-[180px]"
          )}
        >
          <div className="h-full rounded-b-lg overflow-hidden border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
            {children.chart}
          </div>

          {/* Chart Expand Toggle */}
          <button
            onClick={toggleChart}
            className={cn(
              "absolute bottom-2 right-2 z-20 p-2 rounded-lg",
              "bg-[var(--surface-2)]/90 backdrop-blur border border-[var(--border-hairline)]",
              "text-[var(--text-muted)] hover:text-[var(--text-high)]",
              "transition-colors touch-manipulation"
            )}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            {chartExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Bottom Section (hidden when chart expanded) */}
        {!chartExpanded && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Confluence Bar - Fixed 48px, no scrolling */}
            <div
              className="flex-shrink-0 px-2 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]"
              style={{ height: 48 }}
            >
              {children.confluence}
            </div>

            {/* Scrollable Panel Area */}
            <div
              className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {/* Plan Panel */}
              <div
                className={cn(
                  "rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden",
                  config.emphasizePlan &&
                    "ring-2 ring-[var(--brand-primary)]/50 border-[var(--brand-primary)]/30"
                )}
              >
                {children.plan}
              </div>

              {/* Contract Panel */}
              {config.showContract && (
                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden">
                  {children.contractPanel}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Action Bar */}
      <div
        className={cn(
          "flex-shrink-0 z-30 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]",
          "safe-area-pb",
          config.emphasizeActions && "bg-[var(--brand-primary)]/5"
        )}
        data-testid="cockpit-actions-bar-mobile"
      >
        {children.actions}
      </div>
    </div>
  );
}

export default CockpitLayout;
