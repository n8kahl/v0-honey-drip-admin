/**
 * HDLiveIndicator - Data freshness badge
 *
 * Shows connection status and data freshness:
 * - Live (WebSocket): Green pulsing dot
 * - Polling (REST fallback): Amber dot
 * - Stale (>30s): Red pulsing dot with warning
 */

import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { Wifi, WifiOff, Clock } from "lucide-react";

export type DataStatus = "live" | "polling" | "stale";

interface HDLiveIndicatorProps {
  status: DataStatus;
  lastUpdate?: number;
  className?: string;
  showLabel?: boolean;
}

export function HDLiveIndicator({
  status,
  lastUpdate,
  className,
  showLabel = true,
}: HDLiveIndicatorProps) {
  // Calculate time since last update
  const getTimeSince = () => {
    if (!lastUpdate) return "Unknown";
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 3) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return "Stale";
  };

  const config = {
    live: {
      dotClass: "bg-green-500 animate-pulse",
      textClass: "text-green-500",
      label: "LIVE",
      icon: Wifi,
      tooltip: `WebSocket connected • ${getTimeSince()}`,
    },
    polling: {
      dotClass: "bg-amber-500",
      textClass: "text-amber-500",
      label: "REST",
      icon: Clock,
      tooltip: `REST polling • ${getTimeSince()}`,
    },
    stale: {
      dotClass: "bg-red-500 animate-pulse",
      textClass: "text-red-500",
      label: "STALE",
      icon: WifiOff,
      tooltip: `Connection issue • ${getTimeSince()}`,
    },
  };

  const { dotClass, textClass, label, icon: Icon, tooltip } = config[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1 cursor-default", className)}>
          {/* Dot indicator */}
          <span className={cn("w-1.5 h-1.5 rounded-full", dotClass)} />

          {/* Label */}
          {showLabel && (
            <span className={cn("text-[9px] font-medium uppercase tracking-wide", textClass)}>
              {label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="text-xs bg-[var(--surface-2)] border-[var(--border-hairline)]"
      >
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3" />
          <span>{tooltip}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Compact confluence badge - just the score number
 */
interface HDConfluenceBadgeProps {
  score: number | undefined;
  className?: string;
}

export function HDConfluenceBadge({ score, className }: HDConfluenceBadgeProps) {
  if (score === undefined || score === null) {
    return (
      <span className={cn("text-[10px] font-mono text-[var(--text-faint)]", className)}>--</span>
    );
  }

  const rounded = Math.round(score);

  // Color based on score
  const colorClass =
    rounded >= 80
      ? "text-emerald-400"
      : rounded >= 60
        ? "text-amber-400"
        : "text-[var(--text-muted)]";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("text-[11px] font-mono font-medium tabular-nums", colorClass, className)}
        >
          {rounded}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="text-xs bg-[var(--surface-2)] border-[var(--border-hairline)]"
      >
        Confluence Score: {rounded}/100
      </TooltipContent>
    </Tooltip>
  );
}
