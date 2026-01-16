/**
 * HDStaleBanner - Critical Staleness Alert Banner
 *
 * A prominent banner displayed at the top of the cockpit when data
 * becomes critically stale (>10 seconds without update).
 *
 * Features:
 * - Pulsing red background for urgency
 * - Shows time since last update
 * - Retry button to force refresh
 * - Dismissible (but auto-reappears if still stale)
 *
 * Design Philosophy:
 * - Stale data in trading is dangerous - traders need to KNOW
 * - This banner cannot be missed
 * - Provides clear action (retry) to resolve the issue
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "../../../lib/utils";
import { AlertTriangle, RefreshCw, X, WifiOff, Clock } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type StaleLevel = "live" | "delayed" | "stale" | "critical";

export interface HDStaleBannerProps {
  /** Last update timestamp (ms since epoch) */
  lastUpdateTime: number | null;
  /** Current stale level */
  staleLevel: StaleLevel;
  /** What data source is stale */
  dataSource?: string;
  /** Callback to retry/refresh data */
  onRetry?: () => void;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after N seconds (0 = never) */
  autoDismissSeconds?: number;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format relative time from timestamp
 */
function formatTimeSince(timestamp: number | null): string {
  if (!timestamp) return "unknown";

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return "over a day ago";
}

/**
 * Get visual config based on stale level
 */
function getStaleConfig(level: StaleLevel) {
  switch (level) {
    case "critical":
      return {
        bgClass: "bg-[var(--accent-negative)]",
        textClass: "text-white",
        iconClass: "text-white",
        animate: true,
        message: "CRITICAL: Data connection lost",
        icon: WifiOff,
      };
    case "stale":
      return {
        bgClass: "bg-[var(--accent-negative)]/90",
        textClass: "text-white",
        iconClass: "text-white",
        animate: true,
        message: "Data is stale",
        icon: AlertTriangle,
      };
    case "delayed":
      return {
        bgClass: "bg-[var(--accent-warning)]",
        textClass: "text-black",
        iconClass: "text-black",
        animate: false,
        message: "Data delayed",
        icon: Clock,
      };
    default:
      return {
        bgClass: "bg-[var(--accent-positive)]",
        textClass: "text-white",
        iconClass: "text-white",
        animate: false,
        message: "Live",
        icon: Clock,
      };
  }
}

// ============================================================================
// Component
// ============================================================================

export function HDStaleBanner({
  lastUpdateTime,
  staleLevel,
  dataSource = "Market data",
  onRetry,
  onDismiss,
  autoDismissSeconds = 0,
  className,
}: HDStaleBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [timeSince, setTimeSince] = useState(() => formatTimeSince(lastUpdateTime));

  // Update time since display every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSince(formatTimeSince(lastUpdateTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // Reset dismiss state if stale level escalates
  useEffect(() => {
    if (staleLevel === "critical") {
      setIsDismissed(false);
    }
  }, [staleLevel]);

  // Auto-dismiss timer
  useEffect(() => {
    if (autoDismissSeconds <= 0 || isDismissed) return;

    const timeout = setTimeout(() => {
      setIsDismissed(true);
      onDismiss?.();
    }, autoDismissSeconds * 1000);

    return () => clearTimeout(timeout);
  }, [autoDismissSeconds, isDismissed, onDismiss]);

  // Handle retry click
  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      // Reset after a short delay to show the spinner
      setTimeout(() => setIsRetrying(false), 1000);
    }
  }, [onRetry, isRetrying]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  // Don't show for live data or if dismissed (except critical)
  if (staleLevel === "live") return null;
  if (isDismissed && staleLevel !== "critical") return null;

  const config = getStaleConfig(staleLevel);
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 transition-all duration-300",
        config.bgClass,
        config.animate && "animate-pulse",
        className
      )}
      role="alert"
      data-testid="stale-banner"
      data-stale-level={staleLevel}
    >
      {/* Left: Icon + Message */}
      <div className="flex items-center gap-2">
        <IconComponent className={cn("w-4 h-4 flex-shrink-0", config.iconClass)} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className={cn("text-sm font-semibold", config.textClass)}>{config.message}</span>
          <span className={cn("text-xs opacity-80", config.textClass)}>
            {dataSource} • Last update: {timeSince}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Retry button */}
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              staleLevel === "critical" || staleLevel === "stale"
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-black/10 hover:bg-black/20 text-black"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRetrying && "animate-spin")} />
            <span className="hidden sm:inline">Retry</span>
          </button>
        )}

        {/* Dismiss button (not for critical) */}
        {staleLevel !== "critical" && onDismiss && (
          <button
            onClick={handleDismiss}
            className={cn(
              "p-1 rounded transition-colors",
              staleLevel === "stale"
                ? "hover:bg-white/20 text-white/70 hover:text-white"
                : "hover:bg-black/10 text-black/50 hover:text-black"
            )}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Hook: useStaleLevel
// ============================================================================

/**
 * Hook to calculate stale level from last update timestamp
 */
export function useStaleLevel(
  lastUpdateTime: number | null,
  thresholds?: {
    delayed?: number;
    stale?: number;
    critical?: number;
  }
): StaleLevel {
  const { delayed = 5000, stale = 10000, critical = 30000 } = thresholds || {};

  return useMemo(() => {
    if (!lastUpdateTime) return "critical";

    const age = Date.now() - lastUpdateTime;

    if (age >= critical) return "critical";
    if (age >= stale) return "stale";
    if (age >= delayed) return "delayed";
    return "live";
  }, [lastUpdateTime, delayed, stale, critical]);
}

export default HDStaleBanner;
