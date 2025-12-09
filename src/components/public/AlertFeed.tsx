/**
 * AlertFeed.tsx - Live Alert Timeline
 *
 * Shows chronological feed of trade alerts (entries, trims, updates, exits).
 * Public view shows last 3 alerts, member view shows full feed.
 */

import { Radio, Lock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

export interface TradeAlert {
  id: string;
  type: "enter" | "trim" | "update" | "update-sl" | "trail-stop" | "add" | "exit";
  message: string;
  price: number;
  pnl_percent: number | null;
  trim_percent: number | null;
  created_at: string;
  trade: {
    id: string;
    ticker: string;
    trade_type: string;
    contract: {
      strike?: number;
      type?: "call" | "put";
    } | null;
    admin_name: string | null;
  };
}

interface AlertFeedProps {
  alerts: TradeAlert[];
  isMember: boolean;
  hasMore?: boolean;
  isLoading?: boolean;
  onJoinDiscord?: () => void;
  onViewTrade?: (tradeId: string) => void;
}

// ============================================================================
// Alert Type Config
// ============================================================================

const ALERT_TYPE_CONFIG: Record<string, {
  emoji: string;
  label: string;
  color: string;
}> = {
  enter: {
    emoji: "🟢",
    label: "ENTRY",
    color: "text-green-400",
  },
  trim: {
    emoji: "🟡",
    label: "TRIM",
    color: "text-yellow-400",
  },
  update: {
    emoji: "📝",
    label: "UPDATE",
    color: "text-blue-400",
  },
  "update-sl": {
    emoji: "🛡️",
    label: "STOP MOVED",
    color: "text-orange-400",
  },
  "trail-stop": {
    emoji: "📈",
    label: "TRAILING",
    color: "text-purple-400",
  },
  add: {
    emoji: "➕",
    label: "ADD",
    color: "text-cyan-400",
  },
  exit: {
    emoji: "🔴",
    label: "EXIT",
    color: "text-red-400",
  },
};

// ============================================================================
// Component
// ============================================================================

export function AlertFeed({
  alerts,
  isMember,
  hasMore,
  isLoading,
  onJoinDiscord,
  onViewTrade,
}: AlertFeedProps) {
  const discordUrl = import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  return (
    <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-[var(--brand-primary)] animate-pulse" />
          <h3 className="font-semibold text-[var(--text-high)]">Live Alert Feed</h3>
        </div>
        {!isMember && (
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Lock className="w-3 h-3" />
            Members Only
          </span>
        )}
      </div>

      {/* Alert List */}
      <div className="divide-y divide-[var(--border-hairline)]">
        {isLoading ? (
          <AlertFeedSkeleton />
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--text-muted)]">No alerts yet today</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onViewTrade={onViewTrade}
            />
          ))
        )}
      </div>

      {/* Gated CTA (for non-members) */}
      {!isMember && hasMore && (
        <div className="p-4 bg-[var(--surface-2)] border-t border-[var(--border-hairline)]">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Lock className="w-4 h-4" />
              <span className="text-sm">
                Join Discord to see full alert history + real-time updates
              </span>
            </div>
            <Button
              onClick={onJoinDiscord || (() => window.open(discordUrl, "_blank"))}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-black font-semibold"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Join Discord
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Alert Item
// ============================================================================

interface AlertItemProps {
  alert: TradeAlert;
  onViewTrade?: (tradeId: string) => void;
}

function AlertItem({ alert, onViewTrade }: AlertItemProps) {
  const config = ALERT_TYPE_CONFIG[alert.type] || ALERT_TYPE_CONFIG.update;
  const time = formatAlertTime(alert.created_at);

  // Format contract display
  const contract = alert.trade.contract;
  const contractDisplay = contract
    ? `$${contract.strike}${contract.type === "call" ? "C" : "P"}`
    : "";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-[var(--surface-2)]/50 transition-colors",
        onViewTrade && "cursor-pointer"
      )}
      onClick={() => onViewTrade?.(alert.trade.id)}
    >
      {/* Time */}
      <div className="w-16 flex-shrink-0 text-xs text-[var(--text-faint)] pt-0.5">
        {time}
      </div>

      {/* Type Badge */}
      <div className="flex-shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold",
            config.color,
            "bg-[var(--surface-2)]"
          )}
        >
          {config.emoji} {config.label}
        </span>
      </div>

      {/* Ticker */}
      <div className="flex-shrink-0 font-semibold text-[var(--text-high)]">
        {alert.trade.ticker} {contractDisplay}
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-muted)] truncate">
          {formatAlertMessage(alert)}
        </p>
      </div>

      {/* P&L (if applicable) */}
      {alert.pnl_percent !== null && (
        <div
          className={cn(
            "flex-shrink-0 text-sm font-mono font-semibold",
            alert.pnl_percent >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {alert.pnl_percent >= 0 ? "+" : ""}
          {alert.pnl_percent.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatAlertTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatAlertMessage(alert: TradeAlert): string {
  // If there's a custom message, use it (truncated)
  if (alert.message) {
    return `"${alert.message}"`;
  }

  // Otherwise, generate a default message based on type
  switch (alert.type) {
    case "enter":
      return `Entry at $${alert.price.toFixed(2)}`;
    case "trim":
      return `Trimmed ${alert.trim_percent || 50}% at $${alert.price.toFixed(2)}`;
    case "exit":
      return `Closed at $${alert.price.toFixed(2)}`;
    case "update-sl":
      return `Stop moved to $${alert.price.toFixed(2)}`;
    case "trail-stop":
      return `Trailing stop at $${alert.price.toFixed(2)}`;
    case "add":
      return `Added at $${alert.price.toFixed(2)}`;
    default:
      return `Update at $${alert.price.toFixed(2)}`;
  }
}

// ============================================================================
// Skeleton
// ============================================================================

function AlertFeedSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="w-16 h-4 bg-[var(--surface-2)] rounded" />
          <div className="w-16 h-5 bg-[var(--surface-2)] rounded" />
          <div className="w-24 h-4 bg-[var(--surface-2)] rounded" />
          <div className="flex-1 h-4 bg-[var(--surface-2)] rounded" />
        </div>
      ))}
    </div>
  );
}

export default AlertFeed;
