/**
 * TradeTimeline - Timeline of admin updates and member actions
 *
 * Shows chronological timeline of:
 * - Admin OPEN update
 * - All admin updates (UPDATE, STOP_MOVE, TRIM, EXIT, NOTE)
 * - Member entry
 * - Member exit (when they exit)
 */

import { useMemo } from "react";
import {
  PlayCircle,
  AlertTriangle,
  Scissors,
  LogOut,
  StickyNote,
  Target,
  TrendingUp,
  TrendingDown,
  User,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import type { TradeThread, TradeThreadUpdate, MemberTrade } from "@/types/tradeThreads";

interface TradeTimelineProps {
  thread: TradeThread;
  memberTrade?: MemberTrade;
  className?: string;
}

interface TimelineItemData {
  id: string;
  type: "admin" | "member";
  updateType?: TradeThreadUpdate["type"];
  title: string;
  description?: string;
  timestamp: Date;
  icon: React.ReactNode;
  color: string;
  payload?: Record<string, any>;
}

export function TradeTimeline({ thread, memberTrade, className }: TradeTimelineProps) {
  // Build timeline items from thread updates and member trade
  const timelineItems = useMemo(() => {
    const items: TimelineItemData[] = [];

    // Add admin updates
    (thread.updates || []).forEach((update) => {
      const { icon, color, title } = getUpdateDisplay(update.type);
      items.push({
        id: update.id,
        type: "admin",
        updateType: update.type,
        title,
        description: update.message || undefined,
        timestamp: new Date(update.createdAt),
        icon,
        color,
        payload: update.payload,
      });
    });

    // Add member entry
    if (memberTrade) {
      items.push({
        id: `member-entry-${memberTrade.id}`,
        type: "member",
        title: "You Entered",
        description: `Entry price: $${formatPrice(memberTrade.entryPrice)}${
          memberTrade.sizeContracts ? ` · ${memberTrade.sizeContracts} contracts` : ""
        }`,
        timestamp: new Date(memberTrade.entryTime || memberTrade.createdAt),
        icon: <User className="w-4 h-4" />,
        color: "bg-blue-500",
      });

      // Add member exit
      if (memberTrade.status === "exited" && memberTrade.exitPrice) {
        const pnl =
          ((memberTrade.exitPrice - memberTrade.entryPrice) / memberTrade.entryPrice) * 100;
        const isProfit = pnl > 0;
        items.push({
          id: `member-exit-${memberTrade.id}`,
          type: "member",
          title: "You Exited",
          description: `Exit price: $${formatPrice(memberTrade.exitPrice)} · ${isProfit ? "+" : ""}${pnl.toFixed(1)}%`,
          timestamp: new Date(memberTrade.exitTime || memberTrade.updatedAt),
          icon: isProfit ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          ),
          color: isProfit ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]",
        });
      }
    }

    // Sort by timestamp
    items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return items;
  }, [thread.updates, memberTrade]);

  if (timelineItems.length === 0) {
    return (
      <div className={cn("p-4 text-center text-[var(--text-muted)]", className)}>
        No updates yet
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Vertical line */}
      <div className="absolute left-4 top-6 bottom-6 w-px bg-[var(--border-hairline)]" />

      {/* Timeline items */}
      <div className="space-y-4">
        {timelineItems.map((item, index) => (
          <TimelineItem
            key={item.id}
            item={item}
            isFirst={index === 0}
            isLast={index === timelineItems.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({
  item,
  isFirst,
  isLast,
}: {
  item: TimelineItemData;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="relative pl-10">
      {/* Icon bubble */}
      <div
        className={cn(
          "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center",
          "border-2 border-[var(--bg-base)]",
          item.color,
          "text-white"
        )}
      >
        {item.icon}
      </div>

      {/* Content card */}
      <div
        className={cn(
          "p-3 rounded-lg",
          item.type === "admin"
            ? "bg-[var(--surface-1)] border border-[var(--border-hairline)]"
            : "bg-blue-500/10 border border-blue-500/20"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-high)]">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{item.description}</p>
            )}
          </div>
          <span className="text-xs text-[var(--text-faint)] whitespace-nowrap">
            {formatTimestamp(item.timestamp)}
          </span>
        </div>

        {/* Payload details for certain update types */}
        {item.payload && <PayloadDetails payload={item.payload} updateType={item.updateType} />}
      </div>
    </div>
  );
}

function PayloadDetails({
  payload,
  updateType,
}: {
  payload: Record<string, any>;
  updateType?: string;
}) {
  const details: { label: string; value: string; color?: string }[] = [];

  if (payload.entryPrice) {
    details.push({ label: "Entry", value: `$${formatPrice(payload.entryPrice)}` });
  }
  if (payload.exitPrice) {
    details.push({ label: "Exit", value: `$${formatPrice(payload.exitPrice)}` });
  }
  if (payload.stopPrice) {
    details.push({
      label: "Stop",
      value: `$${formatPrice(payload.stopPrice)}`,
      color: "text-[var(--accent-negative)]",
    });
  }
  if (payload.targetPrices && payload.targetPrices.length > 0) {
    details.push({
      label: payload.targetPrices.length === 1 ? "Target" : "Targets",
      value: payload.targetPrices.map((p: number) => `$${formatPrice(p)}`).join(", "),
      color: "text-[var(--accent-positive)]",
    });
  }
  if (payload.pnlPercent !== undefined) {
    const isPositive = payload.pnlPercent > 0;
    details.push({
      label: "P/L",
      value: `${isPositive ? "+" : ""}${payload.pnlPercent.toFixed(1)}%`,
      color: isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]",
    });
  }
  if (payload.trimPercent) {
    details.push({ label: "Trimmed", value: `${payload.trimPercent}%` });
  }

  if (details.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-[var(--border-hairline)]">
      {details.map(({ label, value, color }) => (
        <div key={label} className="text-xs">
          <span className="text-[var(--text-faint)]">{label}:</span>{" "}
          <span className={cn("font-mono", color || "text-[var(--text-high)]")}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function getUpdateDisplay(type: TradeThreadUpdate["type"]): {
  icon: React.ReactNode;
  color: string;
  title: string;
} {
  switch (type) {
    case "OPEN":
      return {
        icon: <PlayCircle className="w-4 h-4" />,
        color: "bg-[var(--brand-primary)]",
        title: "Trade Opened",
      };
    case "UPDATE":
      return {
        icon: <StickyNote className="w-4 h-4" />,
        color: "bg-orange-500",
        title: "Update",
      };
    case "STOP_MOVE":
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        color: "bg-amber-500",
        title: "Stop Moved",
      };
    case "TRIM":
      return {
        icon: <Scissors className="w-4 h-4" />,
        color: "bg-purple-500",
        title: "Position Trimmed",
      };
    case "EXIT":
      return {
        icon: <LogOut className="w-4 h-4" />,
        color: "bg-red-500",
        title: "Trade Closed",
      };
    case "NOTE":
      return {
        icon: <StickyNote className="w-4 h-4" />,
        color: "bg-gray-500",
        title: "Note",
      };
    default:
      return {
        icon: <StickyNote className="w-4 h-4" />,
        color: "bg-gray-500",
        title: type,
      };
  }
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================================
// Member P/L Pill Component (for inline display)
// ============================================================================

interface MemberPnLPillProps {
  entryPrice: number;
  currentPrice: number;
  className?: string;
}

export function MemberPnLPill({ entryPrice, currentPrice, className }: MemberPnLPillProps) {
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  const isPositive = pnlPercent >= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        isPositive
          ? "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]"
          : "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]",
        className
      )}
    >
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? "+" : ""}
      {pnlPercent.toFixed(1)}%
    </span>
  );
}
