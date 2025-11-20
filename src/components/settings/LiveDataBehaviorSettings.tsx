import { useState } from 'react';
import { Activity } from 'lucide-react';
import { HDCard } from '../hd/HDCard';

export function LiveDataBehaviorSettings() {
  const [atrMultiTimeframe, setAtrMultiTimeframe] = useState(false);
  const [tradeTypeInference, setTradeTypeInference] = useState(true);

  return (
    <section>
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-[var(--text-high)] mb-1">Live Data Behavior</h2>
              <p className="text-[var(--text-muted)] text-xs">
                Configure real-time data streaming and analysis options.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={atrMultiTimeframe}
                onChange={(e) => setAtrMultiTimeframe(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                  Multi-timeframe ATR Analysis
                </span>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Analyze ATR across multiple timeframes for more robust stop-loss levels
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={tradeTypeInference}
                onChange={(e) => setTradeTypeInference(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                  Auto-infer Trade Type
                </span>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Automatically classify trades as Scalp/Day/Swing/LEAP based on DTE
                </p>
              </div>
            </label>
          </div>
        </div>
      </HDCard>
    </section>
  );
}
