import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface WatchlistSkeletonProps {
  count?: number;
}

export function WatchlistSkeleton({ count = 5 }: WatchlistSkeletonProps) {
  return (
    <div className="space-y-px">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ContractGridSkeletonProps {
  count?: number;
}

export function ContractGridSkeleton({ count = 6 }: ContractGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-2)]"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChartSkeletonProps {
  height?: string;
}

export function ChartSkeleton({ height = '400px' }: ChartSkeletonProps) {
  return (
    <div className="w-full p-4 bg-[var(--surface-1)]" style={{ height }}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="relative w-full h-full">
        {/* Simulated chart skeleton */}
        <div className="absolute inset-0 flex items-end gap-1 px-4 pb-8">
          {Array.from({ length: 50 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn('flex-1 rounded-t-sm')}
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
        {/* Y-axis skeleton */}
        <div className="absolute right-0 top-0 bottom-8 flex flex-col justify-between py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-12" />
          ))}
        </div>
        {/* X-axis skeleton */}
        <div className="absolute bottom-0 left-4 right-12 flex justify-between">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-12" />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TradeCardSkeletonProps {
  count?: number;
}

export function TradeCardSkeleton({ count = 3 }: TradeCardSkeletonProps) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-md border border-[var(--border-hairline)] bg-[var(--surface-2)]"
        >
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConnectionSkeleton() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="space-y-3 text-center">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <Skeleton className="h-3 w-32 mx-auto" />
      </div>
    </div>
  );
}
