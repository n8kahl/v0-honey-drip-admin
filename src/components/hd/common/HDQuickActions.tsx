import { TradeState } from "../../../types";
import { Target, TrendingUp, Shield, Activity, DollarSign, LogOut } from "lucide-react";

interface HDQuickActionsProps {
  state: TradeState;
  onLoadIdea?: () => void;
  onEnter?: () => void;
  onDiscard?: () => void;
  onTrim?: () => void;
  onUpdate?: () => void;
  onUpdateSL?: () => void;
  onTrailStop?: () => void;
  onAdd?: () => void;
  onTakeProfit?: () => void;
  onExit?: () => void;
}

export function HDQuickActions({
  state,
  onLoadIdea,
  onEnter,
  onDiscard,
  onTrim,
  onUpdateSL,
  onTrailStop,
  onAdd,
  onTakeProfit,
  onExit,
}: HDQuickActionsProps) {
  if (state === "WATCHING") {
    return (
      <div className="space-y-3">
        <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide">
          Quick Actions
        </h3>
        <button
          onClick={onLoadIdea}
          className="w-full py-3 px-4 rounded-lg bg-[var(--brand-primary)] text-[var(--bg-base)] font-medium text-sm hover:bg-[var(--brand-primary)]/90 transition-colors"
        >
          Load Trade Idea
        </button>
      </div>
    );
  }

  if (state === "LOADED") {
    return (
      <div className="space-y-3">
        <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide">
          Quick Actions
        </h3>
        <button
          onClick={onEnter}
          className="w-full py-3 px-4 rounded-lg bg-[var(--brand-primary)] text-[var(--bg-base)] font-medium text-sm hover:bg-[var(--brand-primary)]/90 transition-colors"
        >
          Enter Now
        </button>
        <button
          onClick={onDiscard}
          className="w-full py-2 px-4 rounded-lg bg-[var(--surface-3)] text-[var(--text-high)] text-sm hover:bg-[var(--surface-3)]/80 transition-colors border border-[var(--border-hairline)]"
        >
          Discard
        </button>
      </div>
    );
  }

  if (state === "ENTERED") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide">
          Manage Position
        </h3>

        {/* Position Management - 3 column grid */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onTrim}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[var(--surface-3)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]/80 hover:border-[var(--accent-positive)]/30 transition-colors group"
          >
            <Target className="w-4 h-4 text-[var(--accent-positive)] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-[var(--text-high)]">Trim</span>
          </button>

          <button
            onClick={onAdd}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[var(--surface-3)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]/80 hover:border-purple-500/30 transition-colors group"
          >
            <TrendingUp className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-[var(--text-high)]">Add</span>
          </button>

          <button
            onClick={onUpdateSL}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[var(--surface-3)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]/80 hover:border-yellow-500/30 transition-colors group"
          >
            <Shield className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-[var(--text-high)]">Move SL</span>
          </button>
        </div>

        {/* Trail Stop - full width */}
        <button
          onClick={onTrailStop}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[var(--surface-3)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]/80 hover:border-blue-500/30 transition-colors group"
        >
          <Activity className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium text-[var(--text-high)]">Enable Trail Stop</span>
        </button>

        {/* Divider */}
        <div className="border-t border-[var(--border-hairline)]" />

        {/* Exit Actions */}
        <div className="space-y-2">
          <h4 className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
            Exit Position
          </h4>

          {/* Take Profit - Highlighted as primary partial exit */}
          <button
            onClick={onTakeProfit}
            className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--accent-positive)]/10 border border-[var(--accent-positive)]/30 hover:bg-[var(--accent-positive)]/20 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--accent-positive)]" />
              <span className="text-sm font-medium text-[var(--accent-positive)]">Take Profit</span>
            </div>
            <span className="text-[10px] text-[var(--accent-positive)]/70">Partial Exit</span>
          </button>

          {/* Full Exit - Neutral styling */}
          <button
            onClick={onExit}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[var(--surface-3)] border border-[var(--border-hairline)] hover:bg-[var(--accent-negative)]/10 hover:border-[var(--accent-negative)]/30 transition-colors group"
          >
            <LogOut className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-negative)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--accent-negative)]">
              Full Exit
            </span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
