import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface HDInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const HDInput = forwardRef<HTMLInputElement, HDInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full h-8 px-3 rounded-[var(--radius)] text-xs',
          'bg-[var(--surface-1)] border border-[var(--border-hairline)]',
          'text-[var(--text-high)] placeholder:text-[var(--text-muted)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--border-focus)]',
          'transition-all',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);

HDInput.displayName = 'HDInput';
