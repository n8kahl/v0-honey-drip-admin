/**
 * CockpitPlanPanel - Trade plan display / Management summary
 *
 * For PLAN/LOADED states:
 * - Entry / Stop / TP1 / TP2 / R:R
 * - Confidence score + top 2-3 "WHY" bullets
 * - Underlying entry trigger + contract target/stop
 *
 * For ENTERED state:
 * - Live P&L, R multiple, distance to stop/TP, time in trade
 * - Replaces planning controls with management summary
 */

import React from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Contract } from "../../../types";
import type { CockpitViewState } from "./CockpitLayout";
import { useActiveTradeLiveModel } from "../../../hooks/useActiveTradeLiveModel";
import { fmtDTE, getPnlStyle } from "../../../ui/semantics";
import {
  Target,
  Shield,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface CockpitPlanPanelProps {
  viewState: CockpitViewState;
  symbol: string;
  trade?: Trade | null;
  contract?: Contract | null;
  entryPrice?: number | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  tp2Price?: number | null;
  riskReward?: number | null;
  confidence?: number | null;
  whyBullets?: string[];
  className?: string;
}

export function CockpitPlanPanel({
  viewState,
  symbol,
  trade,
  contract,
  entryPrice,
  stopLoss,
  targetPrice,
  tp2Price,
  riskReward,
  confidence,
  whyBullets,
  className,
}: CockpitPlanPanelProps) {
  // For ENTERED state, show management view
  if (viewState === "entered" && trade) {
    return <ManagementSummary trade={trade} className={className} />;
  }

  // For EXITED/EXPIRED, show result summary
  if ((viewState === "exited" || viewState === "expired") && trade) {
    return <ResultSummary trade={trade} viewState={viewState} className={className} />;
  }

  // For WATCH/PLAN/LOADED, show plan details
  return (
    <PlanDetails
      viewState={viewState}
      trade={trade}
      contract={contract}
      entryPrice={entryPrice}
      stopLoss={stopLoss}
      targetPrice={targetPrice}
      tp2Price={tp2Price}
      riskReward={riskReward}
      confidence={confidence}
      whyBullets={whyBullets}
      className={className}
    />
  );
}

// ============================================================================
// Plan Details (WATCH/PLAN/LOADED)
// ============================================================================

interface PlanDetailsProps {
  viewState: CockpitViewState;
  trade?: Trade | null;
  contract?: Contract | null;
  entryPrice?: number | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  tp2Price?: number | null;
  riskReward?: number | null;
  confidence?: number | null;
  whyBullets?: string[];
  className?: string;
}

function PlanDetails({
  viewState,
  trade,
  contract,
  entryPrice,
  stopLoss,
  targetPrice,
  tp2Price,
  riskReward,
  confidence,
  whyBullets,
  className,
}: PlanDetailsProps) {
  // Derive values from trade/contract if not provided
  const effectiveEntry = entryPrice ?? contract?.mid ?? trade?.entryPrice ?? null;
  const effectiveStop = stopLoss ?? trade?.stopLoss ?? null;
  const effectiveTP = targetPrice ?? trade?.targetPrice ?? null;
  const effectiveRR = riskReward ?? trade?.riskReward ?? null;

  // Default why bullets if not provided
  const defaultBullets = [
    "Select a contract to see trade thesis",
    "Plan will populate with entry/stop/target",
  ];
  const bullets = whyBullets ?? defaultBullets;

  const hasContract = !!contract || !!trade?.contract;

  return (
    <div
      className={cn("h-full flex flex-col p-3 overflow-hidden", className)}
      data-testid="cockpit-plan-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-high)]">Trade Plan</span>
        </div>
        {confidence !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-faint)]">Confidence</span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                confidence >= 80
                  ? "text-[var(--accent-positive)]"
                  : confidence >= 60
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)]"
              )}
            >
              {confidence}%
            </span>
          </div>
        )}
      </div>

      {/* Price Levels Grid */}
      <div className="grid grid-cols-2 gap-2 flex-shrink-0">
        {/* Entry */}
        <PriceLevelCard
          label="Entry"
          value={effectiveEntry}
          icon={<Crosshair className="w-3.5 h-3.5" />}
          color="brand"
        />

        {/* Stop Loss */}
        <PriceLevelCard
          label="Stop Loss"
          value={effectiveStop}
          icon={<Shield className="w-3.5 h-3.5" />}
          color="negative"
        />

        {/* Target 1 */}
        <PriceLevelCard
          label="Target 1"
          value={effectiveTP}
          icon={<Target className="w-3.5 h-3.5" />}
          color="positive"
        />

        {/* R:R */}
        <div
          className={cn(
            "p-2 rounded border",
            "bg-[var(--surface-2)] border-[var(--border-hairline)]"
          )}
        >
          <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-0.5">
            Risk : Reward
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                effectiveRR && effectiveRR >= 2
                  ? "text-[var(--accent-positive)]"
                  : effectiveRR && effectiveRR >= 1.5
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)]"
              )}
            >
              {effectiveRR !== null ? `1:${effectiveRR.toFixed(1)}` : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Target 2 (if available) */}
      {tp2Price && (
        <div className="mt-2 flex-shrink-0">
          <PriceLevelCard
            label="Target 2"
            value={tp2Price}
            icon={<Target className="w-3.5 h-3.5" />}
            color="positive"
            secondary
          />
        </div>
      )}

      {/* Why Bullets */}
      <div className="flex-1 min-h-0 mt-3 overflow-y-auto">
        <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1.5">
          Trade Thesis
        </div>
        <ul className="space-y-1">
          {bullets.slice(0, 3).map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
              <CheckCircle2 className="w-3 h-3 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Empty State */}
      {!hasContract && viewState === "watch" && (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <div className="text-sm text-[var(--text-faint)]">
            Select a contract to build your trade plan
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Price Level Card
// ============================================================================

function PriceLevelCard({
  label,
  value,
  icon,
  color,
  secondary = false,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: "brand" | "positive" | "negative";
  secondary?: boolean;
}) {
  const colorStyles = {
    brand: "text-[var(--brand-primary)]",
    positive: "text-[var(--accent-positive)]",
    negative: "text-[var(--accent-negative)]",
  };

  return (
    <div
      className={cn(
        "p-2 rounded border",
        secondary
          ? "bg-[var(--surface-1)] border-[var(--border-hairline)]"
          : "bg-[var(--surface-2)] border-[var(--border-hairline)]"
      )}
    >
      <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="flex items-center gap-1">
        <span className={colorStyles[color]}>{icon}</span>
        <span className={cn("text-lg font-bold tabular-nums", colorStyles[color])}>
          {value !== null ? `$${value.toFixed(2)}` : "--"}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Management Summary (ENTERED)
// ============================================================================

function ManagementSummary({ trade, className }: { trade: Trade; className?: string }) {
  const liveModel = useActiveTradeLiveModel(trade);

  // Loading state
  if (!liveModel) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-sm text-[var(--text-muted)]">Loading live data...</div>
      </div>
    );
  }

  const pnlStyle = getPnlStyle(liveModel.pnlPercent);

  return (
    <div
      className={cn("h-full flex flex-col p-3 overflow-hidden", className)}
      data-testid="cockpit-management-summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
          <span className="text-sm font-semibold text-[var(--text-high)]">Position Summary</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Clock className="w-3 h-3" />
          {liveModel.holdTimeFormatted}
        </div>
      </div>

      {/* P&L Display */}
      <div className="flex items-center justify-between bg-[var(--surface-2)] rounded p-3 mb-3 flex-shrink-0">
        <div>
          <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">
            Unrealized P&L
          </div>
          <div className={cn("text-2xl font-bold tabular-nums", pnlStyle.className)}>
            {liveModel.pnlPercent >= 0 ? "+" : ""}
            {liveModel.pnlPercent.toFixed(1)}%
          </div>
        </div>
        <div className="text-right">
          <div className={cn("text-lg font-bold tabular-nums", pnlStyle.className)}>
            {liveModel.pnlDollars >= 0 ? "+" : ""}${Math.abs(liveModel.pnlDollars).toFixed(0)}
          </div>
          {liveModel.rMultiple !== null && (
            <div
              className={cn(
                "text-sm font-medium tabular-nums",
                liveModel.rMultiple >= 0
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--accent-negative)]"
              )}
            >
              {liveModel.rMultiple >= 0 ? "+" : ""}
              {liveModel.rMultiple.toFixed(2)}R
            </div>
          )}
        </div>
      </div>

      {/* Progress + Distances */}
      <div className="space-y-2 flex-shrink-0">
        {/* Progress to TP */}
        <div>
          <div className="flex justify-between text-[10px] text-[var(--text-faint)] mb-1">
            <span>Progress to Target</span>
            <span className="tabular-nums">{liveModel.progressToTarget.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                liveModel.progressToTarget >= 100
                  ? "bg-[var(--accent-positive)]"
                  : liveModel.progressToTarget >= 50
                    ? "bg-[var(--brand-primary)]"
                    : "bg-[var(--text-muted)]"
              )}
              style={{ width: `${Math.min(100, Math.max(0, liveModel.progressToTarget))}%` }}
            />
          </div>
        </div>

        {/* Distance to Stop / Target */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between bg-[var(--surface-2)] rounded p-2">
            <div className="flex items-center gap-1 text-[var(--accent-negative)]">
              <Shield className="w-3 h-3" />
              <span>Stop</span>
            </div>
            <span className="tabular-nums text-[var(--text-muted)]">
              ${liveModel.stopPrice?.toFixed(2) ?? "--"}
            </span>
          </div>
          <div className="flex items-center justify-between bg-[var(--surface-2)] rounded p-2">
            <div className="flex items-center gap-1 text-[var(--accent-positive)]">
              <Target className="w-3 h-3" />
              <span>Target</span>
            </div>
            <span className="tabular-nums text-[var(--text-muted)]">
              ${liveModel.targetPrice?.toFixed(2) ?? "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Entry vs Current */}
      <div className="mt-auto pt-2 border-t border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
        <div className="flex justify-between">
          <span>
            Entry:{" "}
            <span className="text-[var(--text-high)] font-medium">
              ${liveModel.entryPrice.toFixed(2)}
            </span>
          </span>
          <span>
            Current:{" "}
            <span className={cn("font-medium", pnlStyle.className)}>
              ${liveModel.effectiveMid.toFixed(2)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Result Summary (EXITED/EXPIRED)
// ============================================================================

function ResultSummary({
  trade,
  viewState,
  className,
}: {
  trade: Trade;
  viewState: CockpitViewState;
  className?: string;
}) {
  const exitPrice = trade.exitPrice ?? trade.contract?.mid ?? 0;
  const entryPrice = trade.entryPrice ?? trade.contract?.mid ?? 0;
  const pnlPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
  const pnlStyle = getPnlStyle(pnlPercent);

  return (
    <div
      className={cn("h-full flex flex-col p-3 overflow-hidden", className)}
      data-testid="cockpit-result-summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          {viewState === "expired" ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[var(--text-muted)]" />
          )}
          <span className="text-sm font-semibold text-[var(--text-high)]">
            {viewState === "expired" ? "Expired Position" : "Trade Complete"}
          </span>
        </div>
      </div>

      {/* Result */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
          Final P&L
        </div>
        <div className={cn("text-4xl font-bold tabular-nums", pnlStyle.className)}>
          {pnlPercent >= 0 ? "+" : ""}
          {pnlPercent.toFixed(1)}%
        </div>
        <div className="mt-2 text-sm text-[var(--text-muted)]">
          ${entryPrice.toFixed(2)} → ${exitPrice.toFixed(2)}
        </div>
      </div>

      {/* Expired Warning */}
      {viewState === "expired" && (
        <div className="mt-auto p-3 bg-amber-500/10 border border-amber-500/30 rounded text-center">
          <div className="text-sm font-medium text-amber-400">Manual Exit Required</div>
          <div className="text-xs text-amber-400/80 mt-1">
            Contract has expired. Click "Full Exit" to close.
          </div>
        </div>
      )}
    </div>
  );
}

export default CockpitPlanPanel;
