/**
 * CockpitLayout - Fixed no-scroll cockpit grid layout
 *
 * Implements a CSS Grid layout that fits within the viewport without scrolling.
 * Structure:
 * - Header row (auto)
 * - Main content (1fr) with 2 columns: Left (chart+confluence), Right (plan+contract)
 * - Action bar row (auto)
 *
 * All panels are always visible - NO collapsible sections.
 */

import React from "react";
import { cn } from "../../../lib/utils";
import type { Trade, TradeState, Ticker, Contract } from "../../../types";
import type { KeyLevels } from "../../../lib/riskEngine/types";

export type CockpitViewState = "watch" | "plan" | "loaded" | "entered" | "exited" | "expired";

export interface CockpitLayoutProps {
  viewState: CockpitViewState;
  symbol: string;
  trade?: Trade | null;
  contract?: Contract | null;
  activeTicker?: Ticker | null;
  keyLevels?: KeyLevels | null;
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

/**
 * Main cockpit layout container
 * Uses CSS Grid with fixed rows - no internal scrolling
 */
export function CockpitLayout({ viewState, children, className }: CockpitLayoutProps) {
  return (
    <div
      className={cn("h-full flex flex-col overflow-hidden", "bg-[var(--surface-0)]", className)}
      data-testid="cockpit-layout"
      data-view-state={viewState}
    >
      {/* Header - Always visible, auto height */}
      <div className="flex-shrink-0 z-20" data-testid="cockpit-header">
        {children.header}
      </div>

      {/* Main Content - Takes remaining space, no scroll */}
      <div
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 p-2"
        data-testid="cockpit-main"
      >
        {/* Left Column: Chart + Confluence */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* Chart Area - ~55% of left column */}
          <div
            className="flex-[1.2] min-h-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
            data-testid="cockpit-chart-area"
          >
            {children.chart}
          </div>

          {/* Confluence Panel - ~45% of left column */}
          <div
            className="flex-1 min-h-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
            data-testid="cockpit-confluence-area"
          >
            {children.confluence}
          </div>
        </div>

        {/* Right Column: Plan + Contract */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* Plan Panel - ~55% of right column */}
          <div
            className="flex-[1.2] min-h-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
            data-testid="cockpit-plan-area"
          >
            {children.plan}
          </div>

          {/* Contract Panel - ~45% of right column */}
          <div
            className="flex-1 min-h-0 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden"
            data-testid="cockpit-contract-area"
          >
            {children.contractPanel}
          </div>
        </div>
      </div>

      {/* Action Bar - Always visible, auto height */}
      <div
        className="flex-shrink-0 z-10 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]"
        data-testid="cockpit-actions-bar"
      >
        {children.actions}
      </div>
    </div>
  );
}

/**
 * Mobile-optimized single column cockpit layout
 * Used on screens < lg breakpoint
 */
export function CockpitLayoutMobile({ viewState, children, className }: CockpitLayoutProps) {
  return (
    <div
      className={cn("h-full flex flex-col overflow-hidden", "bg-[var(--surface-0)]", className)}
      data-testid="cockpit-layout-mobile"
      data-view-state={viewState}
    >
      {/* Header */}
      <div className="flex-shrink-0 z-20">{children.header}</div>

      {/* Scrollable content for mobile */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {/* Chart */}
        <div className="h-48 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden">
          {children.chart}
        </div>

        {/* Plan */}
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden">
          {children.plan}
        </div>

        {/* Confluence */}
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden">
          {children.confluence}
        </div>

        {/* Contract */}
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden">
          {children.contractPanel}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex-shrink-0 z-10 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]">
        {children.actions}
      </div>
    </div>
  );
}

export default CockpitLayout;
