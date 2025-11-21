import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../../lib/utils';

interface HDCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'compact' | 'interactive';
}

/**
 * HDCard - Unified card component for HoneyDrip Admin
 * 
 * Variants:
 * - default: Standard card with p-4 desktop, p-3 mobile
 * - compact: Tighter spacing with p-3 desktop, p-2 mobile
 * - interactive: Adds hover state for clickable cards
 */
export const HDCard = forwardRef<HTMLDivElement, HDCardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]',
          variant === 'default' && 'p-3 lg:p-4',
          variant === 'compact' && 'p-2 lg:p-3',
          variant === 'interactive' && [
            'p-3 lg:p-4',
            'transition-colors cursor-pointer',
            'hover:bg-[var(--surface-3)] hover:border-[var(--border-focus)]'
          ],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

HDCard.displayName = 'HDCard';
