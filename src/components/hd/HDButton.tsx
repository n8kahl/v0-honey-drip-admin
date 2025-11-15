import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HDButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}

export const HDButton = forwardRef<HTMLButtonElement, HDButtonProps>(
  ({ className, variant = 'primary', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 px-4 h-8 rounded-[var(--radius)] transition-all font-medium',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variant === 'primary' && [
            'bg-[var(--brand-primary)] text-[var(--bg-base)] shadow-sm',
            'hover:bg-[var(--brand-primary-hover)] hover:shadow-md',
            'active:bg-[var(--brand-primary-pressed)] active:shadow-sm'
          ],
          variant === 'secondary' && [
            'bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)]',
            'hover:bg-[var(--surface-3)] hover:border-[var(--border-focus)]',
            'active:bg-[var(--surface-2)]'
          ],
          variant === 'ghost' && [
            'text-[var(--text-muted)]',
            'hover:text-[var(--text-high)] hover:bg-[var(--surface-2)]',
            'active:bg-[var(--surface-3)]'
          ],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);

HDButton.displayName = 'HDButton';
