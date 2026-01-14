/**
 * AlertAuditLog - Trade Alert History Display
 *
 * Displays a chronological log of all alerts and actions taken on a trade.
 * Shows intent, timestamp, price, and status for each action.
 *
 * Features:
 * - Chronological timeline view
 * - Color-coded by action type
 * - Price and P&L display
 * - Compact design for rail placement
 */

import { useMemo } from "react";
import { cn, formatPrice } from "../../../lib/utils";
import type { Trade, TradeUpdate } from "../../../types";
import {
  ArrowDownCircle,
  Target,
  Shield,
  Activity,
  Scissors,
  Plus,
  LogOut,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface AlertAuditLogProps {
  /** Trade to show audit log for */
  trade: Trade;
  /** Maximum number of entries to show (default: 10) */
  maxEntries?: number;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon for update type
 */
function getUpdateIcon(type: TradeUpdate["type"]) {
  switch (type) {
    case "enter":
      return ArrowDownCircle;
    case "exit":
      return LogOut;
    case "trim":
      return Scissors;
    case "add":
      return Plus;
    case "update-sl":
      return Shield;
    case "trail-stop":
      return Activity;
    case "tp_near":
      return Target;
    default:
      return AlertTriangle;
  }
}

/**
 * Get color classes for update type
 */
function getUpdateColors(type: TradeUpdate["type"], pnlPercent?: number) {
  switch (type) {
    case "enter":
      return {
        bg: "bg-[var(--accent-positive)]/10",
        text: "text-[var(--accent-positive)]",
        border: "border-[var(--accent-positive)]/30",
      };
    case "exit": {
      const isPositive = pnlPercent !== undefined && pnlPercent >= 0;
      return {
        bg: isPositive ? "bg-[var(--accent-positive)]/10" : "bg-[var(--accent-negative)]/10",
        text: isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]",
        border: isPositive
          ? "border-[var(--accent-positive)]/30"
          : "border-[var(--accent-negative)]/30",
      };
    }
    case "trim":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
      };
    case "add":
      return {
        bg: "bg-[var(--brand-primary)]/10",
        text: "text-[var(--brand-primary)]",
        border: "border-[var(--brand-primary)]/30",
      };
    case "update-sl":
    case "trail-stop":
      return {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        border: "border-orange-500/30",
      };
    case "tp_near":
      return {
        bg: "bg-purple-500/10",
        text: "text-purple-400",
        border: "border-purple-500/30",
      };
    default:
      return {
        bg: "bg-[var(--surface-2)]",
        text: "text-[var(--text-muted)]",
        border: "border-[var(--border-hairline)]",
      };
  }
}

/**
 * Get human-readable label for update type
 */
function getUpdateLabel(type: TradeUpdate["type"]): string {
  switch (type) {
    case "enter":
      return "ENTRY";
    case "exit":
      return "EXIT";
    case "trim":
      return "TRIM";
    case "add":
      return "ADD";
    case "update-sl":
      return "SL UPDATE";
    case "trail-stop":
      return "TRAIL";
    case "tp_near":
      return "TP NEAR";
    default:
      return "UPDATE";
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date, showDate: boolean = false): string {
  const d = new Date(date);
  if (showDate) {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================================
// Component
// ============================================================================

export function AlertAuditLog({
  trade,
  maxEntries = 10,
  showTimestamps = true,
  compact = false,
  className,
}: AlertAuditLogProps) {
  // Sort updates by timestamp (newest first)
  const sortedUpdates = useMemo(() => {
    if (!trade.updates || trade.updates.length === 0) return [];

    return [...trade.updates]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxEntries);
  }, [trade.updates, maxEntries]);

  // Empty state
  if (sortedUpdates.length === 0) {
    return (
      <div className={cn("p-4 text-center", className)}>
        <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--text-faint)]" />
        <p className="text-sm text-[var(--text-muted)]">No actions recorded yet</p>
        <p className="text-xs text-[var(--text-faint)] mt-1">
          Actions will appear here as you manage the trade
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Alert History
        </span>
        <span className="text-[10px] text-[var(--text-faint)]">
          {sortedUpdates.length} action{sortedUpdates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {sortedUpdates.map((update, index) => {
          const Icon = getUpdateIcon(update.type);
          const colors = getUpdateColors(update.type, update.pnlPercent);
          const isFirst = index === 0;

          return (
            <div
              key={update.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg border transition-colors",
                colors.bg,
                colors.border,
                isFirst && "ring-1 ring-[var(--brand-primary)]/30"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                  colors.bg
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", colors.text)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Type + Price Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-bold uppercase", colors.text)}>
                    {getUpdateLabel(update.type)}
                  </span>
                  {update.price > 0 && (
                    <span className="text-xs font-mono text-[var(--text-high)]">
                      ${formatPrice(update.price)}
                    </span>
                  )}
                </div>

                {/* Message Row */}
                {update.message && !compact && (
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                    {update.message}
                  </p>
                )}

                {/* Timestamp + P&L Row */}
                <div className="flex items-center justify-between gap-2 mt-1">
                  {showTimestamps && (
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {formatTimestamp(update.timestamp, true)}
                    </span>
                  )}
                  {update.pnlPercent !== undefined && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        update.pnlPercent >= 0
                          ? "text-[var(--accent-positive)]"
                          : "text-[var(--accent-negative)]"
                      )}
                    >
                      {update.pnlPercent >= 0 ? "+" : ""}
                      {update.pnlPercent.toFixed(1)}%
                    </span>
                  )}
                  {update.trimPercent !== undefined && (
                    <span className="text-[10px] text-amber-400">
                      {update.trimPercent}% trimmed
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more indicator */}
      {trade.updates && trade.updates.length > maxEntries && (
        <div className="text-center py-1">
          <span className="text-[10px] text-[var(--text-faint)]">
            +{trade.updates.length - maxEntries} more actions
          </span>
        </div>
      )}
    </div>
  );
}

export default AlertAuditLog;
