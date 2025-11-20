import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  /**
   * Icon component to display
   */
  icon?: LucideIcon;

  /**
   * Main heading text
   */
  title: string;

  /**
   * Descriptive subtitle
   */
  description?: string;

  /**
   * Call-to-action button
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };

  /**
   * Custom className for wrapper
   */
  className?: string;

  /**
   * Minimum height for the container
   * @default "min-h-96"
   */
  minHeight?: string;
}

/**
 * EmptyState - Empty state component
 *
 * Shows a friendly message when a list/section is empty.
 * Includes optional icon, title, description, and CTA button.
 *
 * Usage:
 *   <EmptyState
 *     icon={InboxIcon}
 *     title="No trades yet"
 *     description="Your closed trades will appear here."
 *     action={{
 *       label: "Start trading",
 *       onClick: () => nav.goToActiveTrades()
 *     }}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  minHeight = 'min-h-96',
}: EmptyStateProps) {
  return (
    <div className={cn('flex items-center justify-center bg-[var(--bg-base)]', minHeight, className)}>
      <div className="text-center p-6 max-w-sm">
        {/* Icon */}
        {Icon && (
          <div className="mb-4 flex justify-center">
            <Icon className="w-12 h-12 text-[var(--text-muted)] opacity-50" />
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-medium text-[var(--text-high)] mb-2">{title}</h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-[var(--text-muted)] mb-6">{description}</p>
        )}

        {/* Action Button */}
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] text-sm font-medium transition-all',
              action.variant === 'secondary'
                ? 'bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)] hover:bg-[var(--surface-3)]'
                : 'bg-[var(--brand-primary)] text-[var(--bg-base)] hover:opacity-90'
            )}
          >
            <Plus className="w-4 h-4" />
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
