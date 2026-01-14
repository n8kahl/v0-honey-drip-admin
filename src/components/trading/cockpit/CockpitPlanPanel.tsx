/**
 * CockpitPlanPanel - Trade plan display / Management summary
 *
 * For PLAN/LOADED states:
 * - Entry / Stop / TP1 / TP2 / R:R with anchor labels and rationale
 * - Dual price display (Underlying + Premium)
 * - Plan quality warnings if anchors are weak
 * - Confidence score + top 2-3 "WHY" bullets
 *
 * For ENTERED state:
 * - Live P&L, R multiple, distance to stop/TP, time in trade
 * - Replaces planning controls with management summary
 */

import React from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Contract } from "../../../types";
import type { CockpitViewState } from "./CockpitLayout";
import type { TradePlanAnchors, PlanAnchor, TargetAnchor } from "../../../lib/riskEngine/types";
import { getShortAnchorLabel } from "../../../lib/riskEngine/planAnchors";
import { useActiveTradeLiveModel } from "../../../hooks/useActiveTradeLiveModel";
import { getPnlStyle } from "../../../ui/semantics";
import {
  Target,
  Shield,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Info,
  Anchor,
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
  /** Plan anchors with rationale */
  planAnchors?: TradePlanAnchors | null;
  /** Entry underlying price for dual display */
  entryUnderlyingPrice?: number | null;
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
  planAnchors,
  entryUnderlyingPrice,
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
      planAnchors={planAnchors}
      entryUnderlyingPrice={entryUnderlyingPrice}
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
  planAnchors?: TradePlanAnchors | null;
  entryUnderlyingPrice?: number | null;
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
  planAnchors,
  entryUnderlyingPrice,
  className,
}: PlanDetailsProps) {
  // Derive values from trade/contract if not provided
  const effectiveEntry = entryPrice ?? contract?.mid ?? trade?.entryPrice ?? null;
  const effectiveStop = stopLoss ?? trade?.stopLoss ?? null;
  const effectiveTP = targetPrice ?? trade?.targetPrice ?? null;
  // Calculate R:R from entry, stop, target if not provided
  const effectiveRR =
    riskReward ??
    (effectiveEntry && effectiveStop && effectiveTP && effectiveEntry !== effectiveStop
      ? (effectiveTP - effectiveEntry) / (effectiveEntry - effectiveStop)
      : null);

  // Get anchors
  const stopAnchor = planAnchors?.stopAnchor;
  const tp1Anchor = planAnchors?.targets?.[0];
  const tp2Anchor = planAnchors?.targets?.[1];
  const planWarnings = planAnchors?.planQuality?.warnings ?? [];
  const planScore = planAnchors?.planQuality?.score;

  // Default why bullets if not provided
  const defaultBullets = [
    "Select a contract to see trade thesis",
    "Plan will populate with entry/stop/target",
  ];
  const bullets = whyBullets ?? defaultBullets;

  const hasContract = !!contract || !!trade?.contract;
  const hasAnchors = !!planAnchors;

  return (
    <div
      className={cn("h-full flex flex-col p-3 overflow-hidden", className)}
      data-testid="cockpit-plan-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-high)]">Trade Plan</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Plan Quality Score */}
          {planScore !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                planScore >= 70
                  ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                  : planScore >= 50
                    ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
                    : "bg-amber-500/20 text-amber-400"
              )}
            >
              <Anchor className="w-3 h-3" />
              {planScore}%
            </div>
          )}
          {/* Confidence */}
          {confidence !== null && !planScore && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-faint)]">Conf</span>
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
      </div>

      {/* Plan Warnings */}
      {planWarnings.length > 0 && (
        <div className="flex-shrink-0 mb-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-400 leading-tight">{planWarnings[0]}</div>
          </div>
        </div>
      )}

      {/* Price Levels with Anchors */}
      <div className="space-y-2 flex-shrink-0">
        {/* Entry + Stop Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Entry */}
          <AnchoredPriceCard
            label="Entry"
            premiumPrice={effectiveEntry}
            underlyingPrice={entryUnderlyingPrice}
            icon={<Crosshair className="w-3.5 h-3.5" />}
            color="brand"
          />

          {/* Stop Loss */}
          <AnchoredPriceCard
            label="Stop"
            premiumPrice={effectiveStop}
            underlyingPrice={stopAnchor?.underlyingPrice}
            anchor={stopAnchor}
            icon={<Shield className="w-3.5 h-3.5" />}
            color="negative"
          />
        </div>

        {/* Targets Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Target 1 */}
          <AnchoredPriceCard
            label="TP1"
            premiumPrice={effectiveTP}
            underlyingPrice={tp1Anchor?.underlyingPrice}
            anchor={tp1Anchor}
            icon={<Target className="w-3.5 h-3.5" />}
            color="positive"
          />

          {/* R:R or TP2 */}
          {tp2Anchor || tp2Price ? (
            <AnchoredPriceCard
              label="TP2"
              premiumPrice={tp2Price ?? tp2Anchor?.premiumPrice}
              underlyingPrice={tp2Anchor?.underlyingPrice}
              anchor={tp2Anchor}
              icon={<Target className="w-3.5 h-3.5" />}
              color="positive"
              secondary
            />
          ) : (
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
          )}
        </div>
      </div>

      {/* Anchor Reasons (if available) */}
      {hasAnchors && (stopAnchor || tp1Anchor) && (
        <div className="flex-shrink-0 mt-2 space-y-1">
          {stopAnchor && <AnchorReasonRow label="SL" anchor={stopAnchor} color="negative" />}
          {tp1Anchor && <AnchorReasonRow label="TP1" anchor={tp1Anchor} color="positive" />}
        </div>
      )}

      {/* Why Bullets / Trade Thesis */}
      <div className="flex-1 min-h-0 mt-2 overflow-y-auto">
        <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1">
          Trade Thesis
        </div>
        <ul className="space-y-0.5">
          {bullets.slice(0, 3).map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
              <CheckCircle2 className="w-3 h-3 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
              <span className="leading-tight">{bullet}</span>
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
// Anchored Price Card - Dual price with anchor label
// ============================================================================

interface AnchoredPriceCardProps {
  label: string;
  premiumPrice?: number | null;
  underlyingPrice?: number | null;
  anchor?: PlanAnchor | TargetAnchor | null;
  icon: React.ReactNode;
  color: "brand" | "positive" | "negative";
  secondary?: boolean;
}

function AnchoredPriceCard({
  label,
  premiumPrice,
  underlyingPrice,
  anchor,
  icon,
  color,
  secondary = false,
}: AnchoredPriceCardProps) {
  const colorStyles = {
    brand: "text-[var(--brand-primary)]",
    positive: "text-[var(--accent-positive)]",
    negative: "text-[var(--accent-negative)]",
  };

  const anchorLabel = anchor ? getShortAnchorLabel(anchor.type) : null;
  const isFallback = anchor?.isFallback ?? false;

  return (
    <div
      className={cn(
        "p-2 rounded border",
        secondary
          ? "bg-[var(--surface-1)] border-[var(--border-hairline)]"
          : "bg-[var(--surface-2)] border-[var(--border-hairline)]"
      )}
    >
      {/* Label + Anchor Badge */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">{label}</span>
        {anchorLabel && (
          <span
            className={cn(
              "text-[8px] font-medium px-1 py-0.5 rounded",
              isFallback
                ? "bg-amber-500/20 text-amber-400"
                : "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]"
            )}
          >
            {anchorLabel}
          </span>
        )}
      </div>

      {/* Dual Price Display */}
      <div className="flex items-baseline gap-1.5">
        <span className={colorStyles[color]}>{icon}</span>
        <span className={cn("text-base font-bold tabular-nums", colorStyles[color])}>
          {premiumPrice !== null && premiumPrice !== undefined
            ? `$${premiumPrice.toFixed(2)}`
            : "--"}
        </span>
        {underlyingPrice !== null && underlyingPrice !== undefined && (
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            @{underlyingPrice.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Anchor Reason Row - Shows WHY for each anchor
// ============================================================================

interface AnchorReasonRowProps {
  label: string;
  anchor: PlanAnchor | TargetAnchor;
  color: "positive" | "negative";
}

function AnchorReasonRow({ label, anchor, color }: AnchorReasonRowProps) {
  const colorStyles = {
    positive: "text-[var(--accent-positive)]",
    negative: "text-[var(--accent-negative)]",
  };

  const isFallback = anchor.isFallback ?? false;

  return (
    <div className="flex items-start gap-1.5 text-[10px]">
      <span className={cn("font-medium flex-shrink-0", colorStyles[color])}>{label}:</span>
      <span className="text-[var(--text-muted)] leading-tight">
        {isFallback && <span className="text-amber-400 mr-1">[Fallback]</span>}
        {anchor.reason}
      </span>
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
              ${liveModel.stopLoss?.toFixed(2) ?? "--"}
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
