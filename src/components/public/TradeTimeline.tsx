/**
 * TradeTimeline.tsx - Trade Update History Timeline
 *
 * Shows chronological timeline of all updates for a trade:
 * watching → entry → updates → trims → exit
 */

import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface TimelineUpdate {
  id: string;
  type: "enter" | "trim" | "update" | "update-sl" | "trail-stop" | "add" | "exit" | "watching";
  message: string;
  price: number;
  pnl_percent: number | null;
  trim_percent: number | null;
  created_at: string;
}

interface TradeTimelineProps {
  updates: TimelineUpdate[];
  entryPrice?: number | null;
  currentPrice?: number | null;
  className?: string;
}

// ============================================================================
// Update Type Config
// ============================================================================

const UPDATE_TYPE_CONFIG: Record<string, {
  dotColor: string;
  bgColor: string;
  label: string;
  icon: string;
}> = {
  watching: {
    dotColor: "bg-gray-400",
    bgColor: "bg-gray-400/10",
    label: "WATCHING",
    icon: "○",
  },
  enter: {
    dotColor: "bg-green-500",
    bgColor: "bg-green-500/10",
    label: "ENTRY",
    icon: "●",
  },
  trim: {
    dotColor: "bg-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "TRIM",
    icon: "●",
  },
  update: {
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-500/10",
    label: "UPDATE",
    icon: "●",
  },
  "update-sl": {
    dotColor: "bg-orange-500",
    bgColor: "bg-orange-500/10",
    label: "STOP MOVED",
    icon: "●",
  },
  "trail-stop": {
    dotColor: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    label: "TRAILING",
    icon: "●",
  },
  add: {
    dotColor: "bg-cyan-500",
    bgColor: "bg-cyan-500/10",
    label: "ADD",
    icon: "●",
  },
  exit: {
    dotColor: "bg-red-500",
    bgColor: "bg-red-500/10",
    label: "EXIT",
    icon: "●",
  },
};

// ============================================================================
// Component
// ============================================================================

export function TradeTimeline({ updates, className }: TradeTimelineProps) {
  // Sort updates by date (newest first)
  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sortedUpdates.length === 0) {
    return (
      <div className={cn("p-4 text-center text-[var(--text-muted)]", className)}>
        No updates yet
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Vertical line */}
      <div className="absolute left-3 top-4 bottom-4 w-px bg-[var(--border-hairline)]" />

      {/* Timeline items */}
      <div className="space-y-4">
        {sortedUpdates.map((update, index) => (
          <TimelineItem
            key={update.id}
            update={update}
            isFirst={index === 0}
            isLast={index === sortedUpdates.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Timeline Item
// ============================================================================

interface TimelineItemProps {
  update: TimelineUpdate;
  isFirst: boolean;
  isLast: boolean;
}

function TimelineItem({ update, isFirst }: TimelineItemProps) {
  const config = UPDATE_TYPE_CONFIG[update.type] || UPDATE_TYPE_CONFIG.update;
  const time = formatTime(update.created_at);
  const hasPnl = update.pnl_percent !== null;

  return (
    <div className="relative flex gap-4 pl-8">
      {/* Dot */}
      <div
        className={cn(
          "absolute left-0 w-6 h-6 rounded-full flex items-center justify-center text-xs",
          config.bgColor,
          isFirst && "ring-2 ring-[var(--brand-primary)]"
        )}
      >
        <div className={cn("w-2.5 h-2.5 rounded-full", config.dotColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-faint)]">{time}</span>
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded",
                config.bgColor
              )}
            >
              {config.label}
              {update.trim_percent && ` ${update.trim_percent}%`}
            </span>
            {update.price > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                @ ${update.price.toFixed(2)}
              </span>
            )}
          </div>

          {/* P&L */}
          {hasPnl && (
            <span
              className={cn(
                "text-sm font-mono font-semibold",
                update.pnl_percent! >= 0
                  ? "text-[var(--accent-positive)]"
                  : "text-[var(--accent-negative)]"
              )}
            >
              {update.pnl_percent! >= 0 ? "+" : ""}
              {update.pnl_percent!.toFixed(0)}%
            </span>
          )}
        </div>

        {/* Message */}
        {update.message && (
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            "{update.message}"
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    // Include date for older updates
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

// ============================================================================
// Compact Timeline (for cards)
// ============================================================================

interface CompactTimelineProps {
  updates: TimelineUpdate[];
  maxItems?: number;
}

export function CompactTimeline({ updates, maxItems = 3 }: CompactTimelineProps) {
  const sortedUpdates = [...updates]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxItems);

  if (sortedUpdates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {sortedUpdates.map((update) => {
        const config = UPDATE_TYPE_CONFIG[update.type] || UPDATE_TYPE_CONFIG.update;
        return (
          <div
            key={update.id}
            className="flex items-center gap-2 text-xs text-[var(--text-muted)]"
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
            <span className="font-medium">{config.label}</span>
            {update.pnl_percent !== null && (
              <span
                className={cn(
                  "font-mono",
                  update.pnl_percent >= 0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {update.pnl_percent >= 0 ? "+" : ""}
                {update.pnl_percent.toFixed(0)}%
              </span>
            )}
            <span className="text-[var(--text-faint)]">
              {formatTime(update.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default TradeTimeline;
