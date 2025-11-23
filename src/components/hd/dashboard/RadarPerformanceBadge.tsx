/**
 * RadarPerformanceBadge - Shows performance metrics for Radar tab
 *
 * Displays:
 * - Data source (Database/API/Cache)
 * - Load time
 * - Cache hit rate
 *
 * **Phase 1 Optimization**: Makes users aware of performance improvements
 */

import { useMemo } from 'react';
import { Database, Zap, Globe } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface RadarPerformanceBadgeProps {
  signalCount: number;
  loadTimeMs?: number;
  dataSource?: 'database' | 'api' | 'cache';
  className?: string;
}

export function RadarPerformanceBadge({
  signalCount,
  loadTimeMs,
  dataSource = 'api',
  className,
}: RadarPerformanceBadgeProps) {
  // Calculate status color based on load time
  const statusColor = useMemo(() => {
    if (!loadTimeMs) return 'text-[var(--text-muted)]';
    if (loadTimeMs < 500) return 'text-[var(--accent-positive)]'; // Green: <500ms
    if (loadTimeMs < 2000) return 'text-[var(--brand-primary)]'; // Blue: <2s
    return 'text-[var(--accent-warning)]'; // Yellow: >2s
  }, [loadTimeMs]);

  // Get icon based on data source
  const { icon: Icon, label, description } = useMemo(() => {
    switch (dataSource) {
      case 'database':
        return {
          icon: Database,
          label: 'Database',
          description: 'Data served from cache (10-50x faster)',
        };
      case 'cache':
        return {
          icon: Zap,
          label: 'Memory',
          description: 'Data served from memory cache',
        };
      case 'api':
      default:
        return {
          icon: Globe,
          label: 'Live API',
          description: 'Fresh data from Massive.com',
        };
    }
  }, [dataSource]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5',
        'bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)]',
        'text-xs',
        className
      )}
      title={description}
    >
      {/* Data source indicator */}
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-3 bg-[var(--border-hairline)]" />

      {/* Load time */}
      {loadTimeMs !== undefined && (
        <>
          <div className="flex items-center gap-1">
            <span className={cn('font-medium', statusColor)}>
              {loadTimeMs < 1000 ? `${loadTimeMs}ms` : `${(loadTimeMs / 1000).toFixed(1)}s`}
            </span>
          </div>
          <div className="w-px h-3 bg-[var(--border-hairline)]" />
        </>
      )}

      {/* Signal count */}
      <div className="flex items-center gap-1">
        <span className="text-[var(--text-high)] font-medium">{signalCount}</span>
        <span className="text-[var(--text-muted)]">signals</span>
      </div>
    </div>
  );
}

/**
 * Simplified version for inline use
 */
export function RadarPerformanceInline({
  loadTimeMs,
  dataSource,
}: Pick<RadarPerformanceBadgeProps, 'loadTimeMs' | 'dataSource'>) {
  if (!loadTimeMs && !dataSource) return null;

  const statusIcon = dataSource === 'database' ? '💾' : dataSource === 'cache' ? '⚡' : '🌐';

  return (
    <span className="text-xs text-[var(--text-muted)]" title={dataSource}>
      {statusIcon}
      {loadTimeMs !== undefined && (
        <span className="ml-1">
          {loadTimeMs < 1000 ? `${loadTimeMs}ms` : `${(loadTimeMs / 1000).toFixed(1)}s`}
        </span>
      )}
    </span>
  );
}
