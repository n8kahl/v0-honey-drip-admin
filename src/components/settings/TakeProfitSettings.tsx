import { Info } from 'lucide-react';
import { HDCard } from '../hd/common/HDCard';
import { useTPSettings, saveTPSettings } from '../../hooks/useTPSettings';
import { useAuth } from '../../contexts/AuthContext';

export function TakeProfitSettings() {
  const { user } = useAuth();
  const { tpNearThreshold, autoOpenTrim } = useTPSettings();

  const tpNearPct = Math.round((tpNearThreshold ?? 0.85) * 100);

  const handleTPChange = (value: number) => {
    if (user?.id) {
      saveTPSettings(user.id, {
        tpNearThreshold: Math.min(Math.max(value / 100, 0.5), 0.99),
        autoOpenTrim,
      });
    }
  };

  const handleAutoTrimChange = (checked: boolean) => {
    if (user?.id) {
      saveTPSettings(user.id, {
        tpNearThreshold: tpNearThreshold ?? 0.85,
        autoOpenTrim: checked,
      });
    }
  };

  return (
    <section>
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-[var(--text-high)] mb-1">Take Profit</h2>
              <p className="text-[var(--text-muted)] text-xs">
                Control TP-near alerts and auto-open Trim behavior.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--text-muted)] text-sm mb-2">TP Near Threshold (%)</label>
              <input
                type="number"
                min={50}
                max={99}
                value={tpNearPct}
                onChange={(e) => handleTPChange(Math.max(50, Math.min(99, Number(e.target.value))))}
                className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)]"
              />
              <p className="text-[var(--text-muted)] text-[10px] mt-1.5">
                Alert when target profit reaches this threshold (50–99%)
              </p>
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer group h-full">
                <input
                  type="checkbox"
                  checked={!!autoOpenTrim}
                  onChange={(e) => handleAutoTrimChange(e.target.checked)}
                  className="w-4 h-4 mt-2 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
                />
                <div className="flex-1 pt-1">
                  <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                    Auto-open Trim
                  </span>
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">
                    Automatically open Trim sheet when TP is near
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </HDCard>
    </section>
  );
}
