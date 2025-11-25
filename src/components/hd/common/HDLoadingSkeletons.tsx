/**
 * Loading Skeletons for Trading Panels
 * Phase 1: Stabilization - Improve UX with loading states
 */

import { Skeleton } from "../../ui/skeleton";
import { cn } from "../../../lib/utils";

/**
 * Contract Grid Loading Skeleton
 * Shows placeholder rows for options chain
 */
export function ContractGridSkeleton({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col bg-[var(--surface-1)]", className)}>
      {/* Header skeleton */}
      <div className="px-3 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-2)] flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Toggle buttons skeleton */}
      <div className="flex gap-2 p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <Skeleton className="flex-1 h-8 rounded-[var(--radius)]" />
        <Skeleton className="flex-1 h-8 rounded-[var(--radius)]" />
      </div>

      {/* Column headers skeleton */}
      <div className="flex gap-4 px-3 py-2 border-b border-[var(--border-hairline)]">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Contract rows skeleton */}
      <div className="flex-1 space-y-0">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-4 px-3 py-2 border-b border-[var(--border-hairline)]",
              i % 2 === 1 && "bg-[var(--zebra-stripe)]"
            )}
          >
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Trade Details Loading Skeleton
 * Shows placeholder for trade details panel
 */
export function TradeDetailsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 bg-[var(--surface-1)]", className)}>
      {/* Header with symbol and price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>

      {/* Contract info */}
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>

      {/* Price metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-10 flex-1 rounded-[var(--radius)]" />
        <Skeleton className="h-10 flex-1 rounded-[var(--radius)]" />
      </div>
    </div>
  );
}

/**
 * Chart Loading Skeleton
 * Shows placeholder for price charts
 */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col bg-[var(--surface-1)] p-4", className)}>
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-6 w-8 rounded-sm" />
          <Skeleton className="h-6 w-8 rounded-sm" />
          <Skeleton className="h-6 w-8 rounded-sm" />
        </div>
      </div>

      {/* Chart area with price lines */}
      <div className="flex-1 min-h-[200px] flex items-end gap-1">
        {Array.from({ length: 30 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{
              height: `${Math.random() * 60 + 40}%`,
              opacity: 0.3 + Math.random() * 0.4,
            }}
          />
        ))}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

/**
 * Watchlist Row Loading Skeleton
 * Shows placeholder for watchlist items
 */
export function WatchlistRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

/**
 * Watchlist Panel Loading Skeleton
 * Shows placeholder for entire watchlist panel
 */
export function WatchlistSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--brand-primary)]">
        <Skeleton className="h-4 w-32 bg-black/20" />
        <Skeleton className="h-6 w-6 rounded-[var(--radius)] bg-black/20" />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <WatchlistRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Signal Card Loading Skeleton
 * Shows placeholder for composite signal cards
 */
export function SignalCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "p-3 rounded-[var(--radius)] border border-[var(--border-hairline)] bg-[var(--surface-2)]",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-5 w-10 rounded-sm" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Generic Panel Loading State
 * Wrapper that shows skeleton or content based on loading state
 */
export function LoadingPanel({
  isLoading,
  skeleton,
  children,
  className,
}: {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (isLoading) {
    return <div className={className}>{skeleton}</div>;
  }
  return <>{children}</>;
}
