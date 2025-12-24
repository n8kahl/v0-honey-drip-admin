/**
 * AICoachTile - Compact AI Coach for ActionRail
 *
 * Displays a summary one-liner with risk flags and refresh button.
 * Updates in real-time based on trade context.
 */

import { useMemo } from "react";
import { cn } from "../../../lib/utils";
import { Brain, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import type { Trade } from "../../../types";
import type { CoachingResponse, RiskFlag, ActionType } from "../../../lib/ai/types";

interface AICoachTileProps {
  trade?: Trade | null;
  latestResponse?: CoachingResponse | null;
  isLoading?: boolean;
  isProcessing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
  // For auto-selected contract context (when no trade exists yet)
  contractContext?: {
    symbol: string;
    contractType: "call" | "put";
    strike: number;
    dte: number;
    delta?: number;
    tradeType: "Scalp" | "Day" | "Swing" | "LEAP";
  } | null;
}

const RISK_FLAG_LABELS: Partial<Record<RiskFlag, string>> = {
  extended_move: "Extended",
  approaching_stop: "Near SL",
  volume_fading: "Vol↓",
  theta_decay: "θ",
  spread_widening: "Spread",
  event_imminent: "Event",
  iv_elevated: "IV↑",
  momentum_divergence: "Div",
  regime_unfavorable: "Regime",
};

const ACTION_LABELS: Partial<Record<ActionType, string>> = {
  scale_out: "Scale Out",
  trail_stop: "Trail",
  move_to_be: "Move BE",
  hold: "Hold",
  take_profit: "Take Profit",
  watch_level: "Watch",
  reduce_size: "Reduce",
  exit: "Exit",
  add_position: "Add",
  wait: "Wait",
};

export function AICoachTile({
  trade,
  latestResponse,
  isLoading = false,
  isProcessing = false,
  error,
  onRefresh,
  className,
  contractContext,
}: AICoachTileProps) {
  // Generate summary text based on available context
  const { summary, subtext, sentiment } = useMemo(() => {
    if (error) {
      return { summary: "Coach error", subtext: null, sentiment: "error" as const };
    }
    if (isLoading && !latestResponse) {
      return { summary: "Analyzing...", subtext: null, sentiment: "neutral" as const };
    }

    // If we have AI response, use it
    if (latestResponse) {
      const firstRec = latestResponse.recommendations[0];
      if (firstRec) {
        const action = ACTION_LABELS[firstRec.action] || firstRec.action.replace(/_/g, " ");
        return {
          summary: action,
          subtext: firstRec.reason?.slice(0, 50) || null,
          sentiment:
            firstRec.action === "exit"
              ? ("negative" as const)
              : ["take_profit", "scale_out"].includes(firstRec.action)
                ? ("positive" as const)
                : ("neutral" as const),
        };
      }
      const text = latestResponse.summary || "";
      return {
        summary: text.length > 30 ? text.slice(0, 27) + "..." : text,
        subtext: null,
        sentiment: "neutral" as const,
      };
    }

    // If we have trade, show ready state
    if (trade) {
      return { summary: "Ready to analyze", subtext: null, sentiment: "neutral" as const };
    }

    // If we have contract context from auto-selection, show helpful info
    if (contractContext) {
      const { symbol, contractType, strike, dte, tradeType } = contractContext;
      const typeLabel = contractType === "call" ? "Call" : "Put";
      const dteLabel = dte === 0 ? "0DTE" : `${dte}DTE`;

      // Generate context-aware suggestion
      let suggestion = "Ready";
      let subline = `${symbol} ${strike}${typeLabel.charAt(0)} · ${dteLabel} · ${tradeType}`;

      if (dte === 0) {
        suggestion = "Quick scalp setup";
        subline = "Tight stops, fast exits";
      } else if (dte <= 3) {
        suggestion = "Day trade setup";
        subline = "Manage theta decay actively";
      } else if (dte <= 14) {
        suggestion = "Swing setup";
        subline = "Watch key levels for entry";
      } else {
        suggestion = "Position trade";
        subline = "Let the thesis play out";
      }

      return {
        summary: suggestion,
        subtext: subline,
        sentiment: "neutral" as const,
      };
    }

    return { summary: "Select contract", subtext: null, sentiment: "neutral" as const };
  }, [latestResponse, isLoading, error, trade, contractContext]);

  // Get risk flags count
  const riskCount = latestResponse?.riskFlags?.length || 0;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            AI Coach
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isProcessing}
            className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Summary Row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-xs font-medium block truncate",
              sentiment === "error" && "text-[var(--accent-negative)]",
              sentiment === "negative" && "text-[var(--accent-negative)]",
              sentiment === "positive" && "text-[var(--accent-positive)]",
              sentiment === "neutral" && "text-[var(--text-high)]"
            )}
          >
            {summary}
          </span>
          {subtext && (
            <span className="text-[10px] text-[var(--text-muted)] block truncate mt-0.5">
              {subtext}
            </span>
          )}
        </div>

        {/* Risk Flags Indicator */}
        {riskCount > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 shrink-0">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-medium text-amber-400 tabular-nums">{riskCount}</span>
          </span>
        )}
      </div>

      {/* Risk Flag Pills (show first 2) */}
      {latestResponse?.riskFlags && latestResponse.riskFlags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {latestResponse.riskFlags.slice(0, 2).map((flag) => (
            <span
              key={flag}
              className="px-1 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400"
            >
              {RISK_FLAG_LABELS[flag] || flag}
            </span>
          ))}
          {latestResponse.riskFlags.length > 2 && (
            <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-[var(--surface-3)] text-[var(--text-faint)]">
              +{latestResponse.riskFlags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default AICoachTile;
