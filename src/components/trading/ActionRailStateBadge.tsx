/**
 * ActionRailStateBadge - Trade State Indicator
 *
 * Large, prominent state badge at top of ActionRail.
 * Uses semantic colors from CSS variables.
 */

import React from "react";
import type { TradeState } from "../../types";
import { getStateStyle } from "../../ui/semantics";
import { cn } from "../../lib/utils";
import { Eye, Package, TrendingUp, CheckCircle2 } from "lucide-react";

interface ActionRailStateBadgeProps {
  state: TradeState;
}

export function ActionRailStateBadge({ state }: ActionRailStateBadgeProps) {
  const style = getStateStyle(state);

  const Icon = getStateIcon(state);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-[var(--border-hairline)]",
        style.bg
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full",
          state === "ENTERED" && "animate-state-pulse",
          style.bg,
          "bg-opacity-50"
        )}
      >
        <Icon className={cn("w-4 h-4", style.text)} />
      </div>
      <div>
        <div className={cn("text-sm font-semibold uppercase tracking-wide", style.text)}>
          {style.label}
        </div>
        <div className="text-[10px] text-[var(--text-faint)]">
          {getStateDescription(state)}
        </div>
      </div>
    </div>
  );
}

function getStateIcon(state: TradeState) {
  switch (state) {
    case "WATCHING":
      return Eye;
    case "LOADED":
      return Package;
    case "ENTERED":
      return TrendingUp;
    case "EXITED":
      return CheckCircle2;
    default:
      return Eye;
  }
}

function getStateDescription(state: TradeState): string {
  switch (state) {
    case "WATCHING":
      return "Analyzing opportunity";
    case "LOADED":
      return "Ready to enter";
    case "ENTERED":
      return "Position active";
    case "EXITED":
      return "Trade complete";
    default:
      return "";
  }
}

export default ActionRailStateBadge;
