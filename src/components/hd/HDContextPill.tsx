import { cn } from '../../lib/utils';

export type PillVariant = 'positive' | 'negative' | 'neutral' | 'warning';

interface HDContextPillProps {
  label: string;
  variant?: PillVariant;
  className?: string;
}

const variantStyles: Record<PillVariant, { dot: string; container: string; text: string }> = {
  positive: {
    dot: 'bg-[var(--accent-positive)]',
    container: 'bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30',
    text: 'text-[var(--accent-positive)]',
  },
  negative: {
    dot: 'bg-[var(--accent-negative)]',
    container: 'bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30',
    text: 'text-[var(--accent-negative)]',
  },
  warning: {
    dot: 'bg-orange-500',
    container: 'bg-orange-500/10 border-orange-500/30',
    text: 'text-orange-500',
  },
  neutral: {
    dot: 'bg-gray-500',
    container: 'bg-[var(--surface-2)] border-[var(--border-hairline)]',
    text: 'text-[var(--text-med)]',
  },
};

export function HDContextPill({ label, variant = 'neutral', className }: HDContextPillProps) {
  const v = variantStyles[variant];
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 h-7 rounded-[var(--radius)] border text-xs',
        v.container,
        className
      )}
      title={label}
      aria-label={label}
    >
      <span className={cn('w-2 h-2 rounded-full', v.dot)} />
      <span className={cn('font-medium', v.text)}>{label}</span>
    </div>
  );
}
