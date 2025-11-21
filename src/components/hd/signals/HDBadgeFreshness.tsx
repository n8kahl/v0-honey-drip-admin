import { cn } from '../../lib/utils';

interface HDBadgeFreshnessProps {
  stale: boolean;
  className?: string;
}

export function HDBadgeFreshness({ stale, className }: HDBadgeFreshnessProps) {
  if (!stale) return null;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 h-5 rounded-[var(--radius)] text-xs',
        'bg-amber-500/10 text-amber-500 border border-amber-500/30',
        'animate-pulse',
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Stale
    </span>
  );
}
