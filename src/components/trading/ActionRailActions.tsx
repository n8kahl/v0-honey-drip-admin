/**
 * ActionRailActions - State-Dependent Action Buttons
 *
 * Shows different actions based on trade state:
 * - LOADED: Load+Alert, Enter+Alert, Discard
 * - ENTERED: Trim 50%, Move SL to BE, Exit+Alert, Add
 * - EXITED: Share Recap, Duplicate Setup
 */

import React from "react";
import type { Trade, TradeState } from "../../types";
import { cn } from "../../lib/utils";
import {
  Play,
  Trash2,
  Scissors,
  Shield,
  TrendingUp,
  Plus,
  LogOut,
  DollarSign,
  Share2,
  Copy,
  Target,
} from "lucide-react";

interface ActionRailActionsProps {
  tradeState: TradeState;
  currentTrade: Trade | null;
  onEnter?: () => void;
  onUnload: () => void;
  onTrim: () => void;
  onMoveSL: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onExit: () => void;
  onTakeProfit: () => void;
}

export function ActionRailActions({
  tradeState,
  currentTrade,
  onEnter,
  onUnload,
  onTrim,
  onMoveSL,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
}: ActionRailActionsProps) {
  if (!currentTrade) return null;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
        Quick Actions
      </div>

      {/* LOADED State Actions */}
      {tradeState === "LOADED" && (
        <LoadedActions
          onEnter={onEnter}
          onUnload={onUnload}
        />
      )}

      {/* ENTERED State Actions */}
      {tradeState === "ENTERED" && (
        <EnteredActions
          onTrim={onTrim}
          onMoveSL={onMoveSL}
          onTrailStop={onTrailStop}
          onAdd={onAdd}
          onTakeProfit={onTakeProfit}
          onExit={onExit}
        />
      )}

      {/* EXITED State Actions */}
      {tradeState === "EXITED" && (
        <ExitedActions />
      )}
    </div>
  );
}

// ============================================================================
// LOADED State Actions
// ============================================================================

function LoadedActions({
  onEnter,
  onUnload,
}: {
  onEnter?: () => void;
  onUnload: () => void;
}) {
  return (
    <div className="space-y-2 animate-fade-in-up">
      {/* Enter + Alert - Primary action */}
      {onEnter && (
        <button
          onClick={onEnter}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-[var(--accent-positive)] text-white font-medium text-sm hover:bg-[var(--accent-positive)]/90 transition-colors btn-press"
        >
          <Play className="w-4 h-4" />
          Enter + Alert
        </button>
      )}

      {/* Discard - Secondary action */}
      <button
        onClick={onUnload}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] font-medium text-sm hover:bg-[var(--accent-negative)]/10 hover:text-[var(--accent-negative)] transition-colors btn-press"
      >
        <Trash2 className="w-4 h-4" />
        Discard
      </button>
    </div>
  );
}

// ============================================================================
// ENTERED State Actions
// ============================================================================

function EnteredActions({
  onTrim,
  onMoveSL,
  onTrailStop,
  onAdd,
  onTakeProfit,
  onExit,
}: {
  onTrim: () => void;
  onMoveSL: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onTakeProfit: () => void;
  onExit: () => void;
}) {
  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* 2x2 Grid for position management */}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          icon={<Scissors className="w-4 h-4" />}
          label="Trim 50%"
          onClick={onTrim}
          variant="secondary"
        />
        <ActionButton
          icon={<Shield className="w-4 h-4" />}
          label="Move SL"
          onClick={onMoveSL}
          variant="secondary"
        />
        <ActionButton
          icon={<TrendingUp className="w-4 h-4" />}
          label="Trail Stop"
          onClick={onTrailStop}
          variant="secondary"
        />
        <ActionButton
          icon={<Plus className="w-4 h-4" />}
          label="Add"
          onClick={onAdd}
          variant="secondary"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border-hairline)] pt-3">
        <div className="text-xs font-medium text-[var(--text-faint)] uppercase tracking-wide mb-2">
          Exit Position
        </div>

        {/* Take Profit */}
        <button
          onClick={onTakeProfit}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[var(--accent-positive)]/10 text-[var(--accent-positive)] font-medium text-sm hover:bg-[var(--accent-positive)]/20 transition-colors btn-press mb-2"
        >
          <DollarSign className="w-4 h-4" />
          Take Profit
        </button>

        {/* Full Exit */}
        <button
          onClick={onExit}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] font-medium text-sm hover:bg-[var(--accent-negative)]/10 hover:text-[var(--accent-negative)] transition-colors btn-press"
        >
          <LogOut className="w-4 h-4" />
          Full Exit
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EXITED State Actions
// ============================================================================

function ExitedActions() {
  return (
    <div className="space-y-2 animate-fade-in-up">
      {/* Share Recap - Primary */}
      <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-[var(--brand-primary)] text-black font-medium text-sm hover:bg-[var(--brand-primary-hover)] transition-colors btn-press">
        <Share2 className="w-4 h-4" />
        Share Recap
      </button>

      {/* Duplicate Setup - Secondary */}
      <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] font-medium text-sm hover:bg-[var(--surface-3)] transition-colors btn-press">
        <Copy className="w-4 h-4" />
        Duplicate Setup
      </button>
    </div>
  );
}

// ============================================================================
// Action Button Component
// ============================================================================

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "secondary",
  disabled = false,
}: ActionButtonProps) {
  const variantStyles = {
    primary: "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary-hover)]",
    secondary: "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-high)]",
    danger: "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/20",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 p-3 rounded font-medium text-xs transition-all btn-press",
        variantStyles[variant],
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default ActionRailActions;
