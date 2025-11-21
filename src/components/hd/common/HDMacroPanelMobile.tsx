import { useMacroContext } from '../../../hooks/useIndicesAdvanced';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { formatPrice, formatPercent, cn } from '../../../lib/utils';

export function HDMacroPanelMobile() {
  const macroContext = useMacroContext();

  if (!macroContext) {
    return null;
  }

  const { spx, vix, regime } = macroContext;

  const regimeColor = {
    bull: 'text-[var(--accent-positive)]',
    bear: 'text-[var(--accent-negative)]',
    choppy: 'text-[var(--text-muted)]',
  }[regime];

  const regimeIcon = {
    bull: TrendingUp,
    bear: TrendingDown,
    choppy: Minus,
  }[regime];

  const RegimeIcon = regimeIcon;

  return (
    <div className="px-4 py-3 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
      <div className="flex items-center justify-between gap-3">
        {/* SPX */}
        <div className="flex-1">
          <div className="text-[var(--text-muted)] text-xs mb-0.5">SPX</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[var(--text-high)] font-medium tabular-nums">
              {formatPrice(spx.price)}
            </span>
            <span
              className={cn(
                'text-xs tabular-nums',
                spx.changePercent >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}
            >
              {formatPercent(spx.changePercent)}
            </span>
          </div>
        </div>

        {/* VIX */}
        <div className="flex-1">
          <div className="text-[var(--text-muted)] text-xs mb-0.5">VIX</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[var(--text-high)] font-medium tabular-nums">
              {formatPrice(vix.price)}
            </span>
            <span className={cn('text-xs', getVixColor(vix.level))}>
              {vix.level}
            </span>
          </div>
        </div>

        {/* Regime */}
        <div className="flex-1">
          <div className="text-[var(--text-muted)] text-xs mb-0.5">Regime</div>
          <div className="flex items-center gap-1.5">
            <RegimeIcon className={cn('w-4 h-4', regimeColor)} />
            <span className={cn('text-sm font-medium capitalize', regimeColor)}>
              {regime}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getVixColor(level: 'low' | 'normal' | 'elevated' | 'high'): string {
  switch (level) {
    case 'low':
      return 'text-[var(--accent-positive)]';
    case 'normal':
      return 'text-[var(--text-med)]';
    case 'elevated':
      return 'text-[var(--accent-warning)]';
    case 'high':
      return 'text-[var(--accent-negative)]';
  }
}
