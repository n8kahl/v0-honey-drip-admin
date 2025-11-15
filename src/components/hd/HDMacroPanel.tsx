import { useMacroContext } from '../../hooks/useIndicesAdvanced';
import { formatMacroContextPills } from '../../lib/massive/indices-advanced';
import { HDPill } from './HDPill';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

export function HDMacroPanel() {
  const { macro, isLoading, error } = useMacroContext(30000);

  if (isLoading) {
    return (
      <div className="px-4 py-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <div className="text-xs text-[var(--text-muted)]">Loading macro context...</div>
      </div>
    );
  }

  if (error || !macro) {
    return (
      <div className="px-4 py-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <div className="text-xs text-red-500">Failed to load macro context</div>
      </div>
    );
  }

  const pills = formatMacroContextPills(macro);

  return (
    <div className="px-4 py-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-high)]">Macro Context</h3>
        <span className="text-xs text-[var(--text-muted)]">
          as of {new Date(macro.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-[var(--text-muted)]">SPX</div>
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-high)] font-medium">
              {macro.spx.value.toFixed(2)}
            </span>
            {macro.spx.trend === 'bullish' ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : macro.spx.trend === 'bearish' ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <Activity className="w-3 h-3 text-gray-500" />
            )}
          </div>
          <div className={cn(
            "text-[10px]",
            macro.spx.trend === 'bullish' && "text-green-500",
            macro.spx.trend === 'bearish' && "text-red-500",
            macro.spx.trend === 'neutral' && "text-gray-500"
          )}>
            {macro.spx.trendStrength} {macro.spx.trend}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[var(--text-muted)]">VIX</div>
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-high)] font-medium">
              {macro.vix.value.toFixed(2)}
            </span>
            {macro.vix.trend === 'rising' ? (
              <TrendingUp className="w-3 h-3 text-orange-500" />
            ) : macro.vix.trend === 'falling' ? (
              <TrendingDown className="w-3 h-3 text-green-500" />
            ) : (
              <Activity className="w-3 h-3 text-gray-500" />
            )}
          </div>
          <div className={cn(
            "text-[10px]",
            macro.vix.level === 'high' && "text-orange-500",
            macro.vix.level === 'mid' && "text-yellow-500",
            macro.vix.level === 'low' && "text-green-500"
          )}>
            {macro.vix.level} volatility
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[var(--text-muted)]">Regime</div>
          <div className="text-[var(--text-high)] font-medium capitalize">
            {macro.marketRegime}
          </div>
          <div className={cn(
            "text-[10px] capitalize",
            macro.riskBias === 'bullish' && "text-green-500",
            macro.riskBias === 'bearish' && "text-red-500",
            macro.riskBias === 'neutral' && "text-gray-500"
          )}>
            {macro.riskBias} bias
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-hairline)]">
        {pills.map((pill, i) => (
          <HDPill
            key={i}
            label={pill.label}
            variant={pill.variant}
          />
        ))}
      </div>
    </div>
  );
}
