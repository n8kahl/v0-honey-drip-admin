import { Challenge } from '../../types';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface HDRowChallengeProps {
  challenge: Challenge;
  pnl: number;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function HDRowChallenge({
  challenge,
  pnl,
  active = false,
  onClick,
  onRemove
}: HDRowChallengeProps) {
  return (
    <div
      className={cn(
        'w-full flex items-center justify-between p-3 border-b border-[var(--border-hairline)] group',
        'hover:bg-[var(--surface-1)] transition-colors',
        active && 'bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)]'
      )}
    >
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-high)] font-medium">
            {challenge.name}
          </span>
          {challenge.scope === 'honeydrip-wide' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide flex-shrink-0">
              HD
            </span>
          )}
        </div>
        <span
          className={cn(
            'tabular-nums min-w-[60px] text-right',
            pnl >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
          )}
        >
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
        </span>
      </button>
      
      {/* Remove button - appears on hover */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-2 w-6 h-6 flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all"
          title="Remove challenge"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
