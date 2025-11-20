import React from 'react';
import { cn } from '../../lib/utils';

export interface PageLoaderProps {
  /**
   * Custom loading message
   * @default "Loading..."
   */
  message?: string;

  /**
   * Show skeleton cards for context
   * @default true
   */
  showSkeleton?: boolean;

  /**
   * Number of skeleton rows to show
   * @default 3
   */
  skeletonCount?: number;

  /**
   * Custom className for wrapper
   */
  className?: string;
}

/**
 * PageLoader - Loading state component
 *
 * Shows a professional loading indicator with optional skeleton placeholders.
 * Used during data fetching transitions.
 *
 * Usage:
 *   <PageLoader message="Loading trades..." />
 *   <PageLoader showSkeleton={true} skeletonCount={5} />
 */
export function PageLoader({
  message = 'Loading...',
  showSkeleton = true,
  skeletonCount = 3,
  className,
}: PageLoaderProps) {
  return (
    <div className={cn('w-full bg-[var(--bg-base)]', className)}>
      {showSkeleton ? (
        // Skeleton card layout
        <div className="p-4 space-y-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4 space-y-3 animate-pulse">
              {/* Header skeleton */}
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--surface-2)] rounded w-3/4"></div>
                  <div className="h-3 bg-[var(--surface-2)] rounded w-1/2"></div>
                </div>
                <div className="h-8 bg-[var(--surface-2)] rounded w-12"></div>
              </div>

              {/* Content skeleton */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
                <div className="h-3 bg-[var(--surface-2)] rounded w-full"></div>
                <div className="h-3 bg-[var(--surface-2)] rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Simple loading message
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            {/* Animated spinner */}
            <div className="mb-4 flex justify-center">
              <div className="w-8 h-8 border-3 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
            </div>
            <p className="text-[var(--text-muted)] text-sm">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
