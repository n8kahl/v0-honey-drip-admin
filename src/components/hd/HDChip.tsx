import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface HDChipProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'positive' | 'negative' | 'neutral' | 'scalp' | 'day' | 'swing' | 'leap' | 'custom';
  color?: string; // For custom variant
  bg?: string; // For custom variant
  size?: 'sm' | 'md';
}

/**
 * HDChip - Unified chip/badge component for HoneyDrip Admin
 * 
 * Variants:
 * - positive: Green for profits/gains
 * - negative: Red for losses/risks
 * - neutral: Gray for neutral info
 * - scalp/day/swing/leap: Trade type colors
 * - custom: Use color and bg props
 * 
 * Sizes:
 * - sm: Compact for inline use
 * - md: Standard size
 */
export const HDChip = forwardRef<HTMLDivElement, HDChipProps>(
  ({ className, variant = 'neutral', color, bg, size = 'sm', children, style, ...props }, ref) => {
    const variantStyles = {
      positive: 'bg-[var(--accent-positive-bg)] text-[var(--accent-positive)] border-[var(--accent-positive)]/30',
      negative: 'bg-[var(--accent-negative-bg)] text-[var(--accent-negative)] border-[var(--accent-negative)]/30',
      neutral: 'bg-[var(--surface-3)] text-[var(--text-med)] border-[var(--border-hairline)]',
      scalp: 'bg-[var(--trade-scalp-bg)] text-[var(--trade-scalp)] border-[var(--trade-scalp)]/30',
      day: 'bg-[var(--trade-day-bg)] text-[var(--trade-day)] border-[var(--trade-day)]/30',
      swing: 'bg-[var(--trade-swing-bg)] text-[var(--trade-swing)] border-[var(--trade-swing)]/30',
      leap: 'bg-[var(--trade-leap-bg)] text-[var(--trade-leap)] border-[var(--trade-leap)]/30',
      custom: ''
    };

    const customStyle = variant === 'custom' && color && bg ? {
      color,
      backgroundColor: bg,
      borderColor: color,
      ...style
    } : style;

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-[var(--radius)] border font-medium',
          size === 'sm' && 'px-2 py-0.5 text-micro',
          size === 'md' && 'px-2.5 py-1 text-xs',
          variantStyles[variant],
          className
        )}
        style={customStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);

HDChip.displayName = 'HDChip';
