/**
 * HDLiveIndicator - Enhanced Data Freshness Badge
 *
 * Shows connection status and data freshness with visible timestamps:
 * - Live (WebSocket): Green pulsing dot + "1s ago"
 * - Polling (REST fallback): Amber dot + timestamp
 * - Stale (>10s): Red pulsing dot + "12s ago" + warning
 * - Critical (>30s): Red background + prominent timestamp
 *
 * Improvements over original:
 * - Always-visible timestamp (not just in tooltip)
 * - Larger dot for better visibility (2.5px → 6px when stale)
 * - Background color change for critical staleness
 */

import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { Wifi, WifiOff, Clock, AlertTriangle } from "lucide-react";
import { useMemo, useEffect, useState } from "react";

export type DataStatus = "live" | "polling" | "stale" | "critical";

interface HDLiveIndicatorProps {
  status: DataStatus;
  lastUpdate?: number;
  className?: string;
  /** Show text label (LIVE/REST/STALE) */
  showLabel?: boolean;
  /** Show timestamp (e.g., "2s ago") */
  showTimestamp?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Format relative time since timestamp
 */
function formatTimeSince(lastUpdate: number | undefined): string {
  if (!lastUpdate) return "—";
  const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
  if (seconds < 0) return "now";
  if (seconds < 3) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return ">1h";
}

export function HDLiveIndicator({
  status,
  lastUpdate,
  className,
  showLabel = true,
  showTimestamp = true,
  size = "sm",
}: HDLiveIndicatorProps) {
  // Force re-render every second to update timestamp
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeSince = useMemo(() => formatTimeSince(lastUpdate), [lastUpdate]);

  // Size-based styles
  const sizeConfig = {
    sm: {
      dot: "w-1.5 h-1.5",
      dotStale: "w-2 h-2",
      text: "text-[9px]",
      gap: "gap-1",
      padding: "px-1 py-0.5",
    },
    md: {
      dot: "w-2 h-2",
      dotStale: "w-2.5 h-2.5",
      text: "text-[10px]",
      gap: "gap-1.5",
      padding: "px-1.5 py-0.5",
    },
    lg: {
      dot: "w-2.5 h-2.5",
      dotStale: "w-3 h-3",
      text: "text-xs",
      gap: "gap-2",
      padding: "px-2 py-1",
    },
  };

  const sizes = sizeConfig[size];

  const config = {
    live: {
      dotClass: cn("bg-green-500 animate-pulse", sizes.dot),
      textClass: "text-green-500",
      label: "LIVE",
      icon: Wifi,
      tooltip: `WebSocket connected`,
      containerClass: "",
    },
    polling: {
      dotClass: cn("bg-amber-500", sizes.dot),
      textClass: "text-amber-500",
      label: "REST",
      icon: Clock,
      tooltip: `REST polling`,
      containerClass: "",
    },
    stale: {
      dotClass: cn("bg-red-500 animate-pulse", sizes.dotStale),
      textClass: "text-red-500",
      label: "STALE",
      icon: WifiOff,
      tooltip: `Data stale - check connection`,
      containerClass: "bg-red-500/10 rounded",
    },
    critical: {
      dotClass: cn("bg-red-600 animate-pulse", sizes.dotStale),
      textClass: "text-red-400",
      label: "OFFLINE",
      icon: AlertTriangle,
      tooltip: `Critical: No data for ${timeSince}`,
      containerClass: "bg-red-500/20 rounded border border-red-500/30",
    },
  };

  const { dotClass, textClass, label, icon: Icon, tooltip, containerClass } = config[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center cursor-default transition-all",
            sizes.gap,
            containerClass,
            (status === "stale" || status === "critical") && sizes.padding,
            className
          )}
        >
          {/* Dot indicator */}
          <span className={cn("rounded-full flex-shrink-0", dotClass)} />

          {/* Label */}
          {showLabel && (
            <span className={cn("font-medium uppercase tracking-wide", sizes.text, textClass)}>
              {label}
            </span>
          )}

          {/* Timestamp - always visible for stale/critical, optional for live/polling */}
          {showTimestamp && (
            <span
              className={cn(
                "font-mono tabular-nums",
                sizes.text,
                status === "live" || status === "polling" ? "text-[var(--text-faint)]" : textClass
              )}
            >
              {timeSince}
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
          {lastUpdate && (
            <span className="text-[var(--text-faint)]">
              • Last: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
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

/**
 * Hook to derive data status from timestamp
 */
export function useDataStatus(
  lastUpdate: number | undefined,
  thresholds?: { polling?: number; stale?: number; critical?: number }
): DataStatus {
  const { polling = 3000, stale = 10000, critical = 30000 } = thresholds || {};

  // Force re-render every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!lastUpdate) return "critical";

    const age = Date.now() - lastUpdate;

    if (age >= critical) return "critical";
    if (age >= stale) return "stale";
    if (age >= polling) return "polling";
    return "live";
  }, [lastUpdate, polling, stale, critical]);
}
