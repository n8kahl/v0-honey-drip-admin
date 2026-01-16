/**
 * CockpitActionsBar - State-driven action bar
 *
 * State-specific actions:
 * - WATCH: "Select Contract" disabled until contract selected
 * - PLAN: "Load Plan" primary + "Send Alert" toggle
 * - LOADED: "Enter Trade" primary + "Alert Entry" toggle
 * - ENTERED: "Take Profit", "Move Stop", "Exit Full"
 * - EXPIRED: "Manual Exit Required" + "Exit Full"
 *
 * Always visible, never scrolls away.
 */

import React, { useState } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Contract } from "../../../types";
import type { CockpitViewState } from "./CockpitLayout";
import {
  ChevronRight,
  Crosshair,
  DollarSign,
  Target,
  Shield,
  AlertTriangle,
  MessageSquare,
  Bell,
  Scissors,
  TrendingUp,
  Zap,
} from "lucide-react";

interface CockpitActionsBarProps {
  viewState: CockpitViewState;
  trade?: Trade | null;
  contract?: Contract | null;
  hasDiscordChannels?: boolean;
  // Callbacks
  onSelectContract?: () => void;
  onLoadPlan?: (sendAlert: boolean) => void;
  onEnterTrade?: (sendAlert: boolean) => void;
  onTakeProfit?: (sendAlert: boolean) => void;
  onMoveStop?: () => void;
  onTrim?: (percent: number) => void;
  onExit?: (sendAlert: boolean) => void;
  className?: string;
}

export function CockpitActionsBar({
  viewState,
  trade,
  contract,
  hasDiscordChannels = true,
  onSelectContract,
  onLoadPlan,
  onEnterTrade,
  onTakeProfit,
  onMoveStop,
  onTrim,
  onExit,
  className,
}: CockpitActionsBarProps) {
  const [sendAlert, setSendAlert] = useState(true);

  // Determine if we have a contract selected
  const hasContract = !!(contract ?? trade?.contract);

  // Render state-specific actions
  const renderActions = () => {
    switch (viewState) {
      case "watch":
        return <WatchActions hasContract={hasContract} onSelectContract={onSelectContract} />;
      case "plan":
        return (
          <PlanActions
            hasContract={hasContract}
            hasDiscordChannels={hasDiscordChannels}
            sendAlert={sendAlert}
            onSendAlertChange={setSendAlert}
            onLoadPlan={onLoadPlan}
          />
        );
      case "loaded":
        return (
          <LoadedActions
            hasDiscordChannels={hasDiscordChannels}
            sendAlert={sendAlert}
            onSendAlertChange={setSendAlert}
            onEnterTrade={onEnterTrade}
          />
        );
      case "entered":
        return (
          <EnteredActions
            sendAlert={sendAlert}
            onSendAlertChange={setSendAlert}
            onTakeProfit={onTakeProfit}
            onMoveStop={onMoveStop}
            onTrim={onTrim}
            onExit={onExit}
          />
        );
      case "exited":
        return <ExitedActions />;
      case "expired":
        return <ExpiredActions sendAlert={sendAlert} onExit={onExit} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn("px-4 py-2.5 flex items-center gap-3", className)}
      data-testid="cockpit-actions-bar-content"
    >
      {renderActions()}
    </div>
  );
}

// ============================================================================
// Watch Actions
// ============================================================================

function WatchActions({
  hasContract,
  onSelectContract,
}: {
  hasContract: boolean;
  onSelectContract?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <button
        onClick={onSelectContract}
        disabled={!onSelectContract}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
          "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
          hasContract
            ? "text-[var(--brand-primary)] hover:bg-[var(--surface-3)]"
            : "text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <Crosshair className="w-4 h-4" />
        {hasContract ? "Contract Selected" : "Select Contract from Chain"}
        <ChevronRight className="w-4 h-4 ml-auto" />
      </button>
    </div>
  );
}

// ============================================================================
// Plan Actions
// ============================================================================

function PlanActions({
  hasContract,
  hasDiscordChannels,
  sendAlert,
  onSendAlertChange,
  onLoadPlan,
}: {
  hasContract: boolean;
  hasDiscordChannels: boolean;
  sendAlert: boolean;
  onSendAlertChange: (value: boolean) => void;
  onLoadPlan?: (sendAlert: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Alert Toggle */}
      {hasDiscordChannels && (
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={sendAlert}
            onChange={(e) => onSendAlertChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--brand-primary)]"
          />
          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Bell className="w-3 h-3" />
            Alert
          </span>
        </label>
      )}

      {/* Load Plan Button - Direct action, no modal */}
      <button
        onClick={() => onLoadPlan?.(sendAlert)}
        disabled={!hasContract || !onLoadPlan}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all btn-press",
          hasContract && onLoadPlan
            ? "bg-[var(--brand-primary)] text-black hover:opacity-90"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <Target className="w-4 h-4" />
        {sendAlert ? "Load and Alert" : "Load Plan"}
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    </div>
  );
}

// ============================================================================
// Loaded Actions
// ============================================================================

function LoadedActions({
  hasDiscordChannels,
  sendAlert,
  onSendAlertChange,
  onEnterTrade,
}: {
  hasDiscordChannels: boolean;
  sendAlert: boolean;
  onSendAlertChange: (value: boolean) => void;
  onEnterTrade?: (sendAlert: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Alert Toggle */}
      {hasDiscordChannels && (
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={sendAlert}
            onChange={(e) => onSendAlertChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--brand-primary)]"
          />
          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Bell className="w-3 h-3" />
            Alert
          </span>
        </label>
      )}

      {/* Enter Trade Button */}
      <button
        onClick={() => onEnterTrade?.(sendAlert)}
        disabled={!onEnterTrade}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all btn-press",
          onEnterTrade
            ? "bg-[var(--accent-positive)] text-black hover:opacity-90"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <Zap className="w-4 h-4" />
        Enter Trade
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    </div>
  );
}

// ============================================================================
// Entered Actions
// ============================================================================

function EnteredActions({
  sendAlert,
  onSendAlertChange,
  onTakeProfit,
  onMoveStop,
  onTrim,
  onExit,
}: {
  sendAlert: boolean;
  onSendAlertChange: (value: boolean) => void;
  onTakeProfit?: (sendAlert: boolean) => void;
  onMoveStop?: () => void;
  onTrim?: (percent: number) => void;
  onExit?: (sendAlert: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      {/* Alert Toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          checked={sendAlert}
          onChange={(e) => onSendAlertChange(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--brand-primary)]"
        />
        <MessageSquare className="w-3 h-3 text-[var(--text-muted)]" />
      </label>

      {/* Take Profit */}
      <button
        onClick={() => onTakeProfit?.(sendAlert)}
        disabled={!onTakeProfit}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all btn-press border",
          onTakeProfit
            ? "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)] hover:bg-[var(--accent-positive)]/20"
            : "bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <Target className="w-3.5 h-3.5" />
        TP
      </button>

      {/* Move Stop */}
      <button
        onClick={onMoveStop}
        disabled={!onMoveStop}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all btn-press border",
          onMoveStop
            ? "bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)] hover:bg-[var(--surface-3)]"
            : "bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <Shield className="w-3.5 h-3.5" />
        SL→BE
      </button>

      {/* Trim 50% */}
      <button
        onClick={() => onTrim?.(50)}
        disabled={!onTrim}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all btn-press border",
          onTrim
            ? "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20"
            : "bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <Scissors className="w-3.5 h-3.5" />
        Trim
      </button>

      {/* Trail Stop */}
      <button
        onClick={onMoveStop}
        disabled={!onMoveStop}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-xs transition-all btn-press border",
          onMoveStop
            ? "bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)] hover:bg-[var(--surface-3)]"
            : "bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Trail
      </button>

      {/* Exit Full */}
      <button
        onClick={() => onExit?.(sendAlert)}
        disabled={!onExit}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all btn-press",
          onExit
            ? "bg-[var(--accent-negative)] text-white hover:opacity-90"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <DollarSign className="w-3.5 h-3.5" />
        Exit
      </button>
    </div>
  );
}

// ============================================================================
// Exited Actions
// ============================================================================

function ExitedActions() {
  return (
    <div className="flex items-center justify-center w-full">
      <div className="text-sm text-[var(--text-muted)]">Trade complete - Review results above</div>
    </div>
  );
}

// ============================================================================
// Expired Actions
// ============================================================================

function ExpiredActions({
  sendAlert,
  onExit,
}: {
  sendAlert: boolean;
  onExit?: (sendAlert: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-400">Contract Expired</span>
      </div>

      <button
        onClick={() => onExit?.(sendAlert)}
        disabled={!onExit}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all btn-press",
          onExit
            ? "bg-amber-500 text-black hover:bg-amber-400"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
        )}
      >
        <DollarSign className="w-4 h-4" />
        Manual Exit Required
      </button>
    </div>
  );
}

export default CockpitActionsBar;
