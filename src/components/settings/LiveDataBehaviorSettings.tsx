/**
 * LiveDataBehaviorSettings Component
 * Live data behavior preferences with database persistence
 */

import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { HDCard } from '../hd/common/HDCard';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAppToast } from '../../hooks/useAppToast';

export function LiveDataBehaviorSettings() {
  const { profile, isLoading, updateProfile } = useUserSettings();
  const toast = useAppToast();

  // Local state for optimistic UI
  const [atrMultiTimeframe, setAtrMultiTimeframe] = useState(false);
  const [autoInferTradeType, setAutoInferTradeType] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with profile when loaded
  useEffect(() => {
    if (profile) {
      setAtrMultiTimeframe(profile.atrMultiTimeframe);
      setAutoInferTradeType(profile.autoInferTradeType);
    }
  }, [profile]);

  // Handle toggle with auto-save
  const handleAtrChange = async (checked: boolean) => {
    setAtrMultiTimeframe(checked);
    setIsSaving(true);
    try {
      await updateProfile({ atrMultiTimeframe: checked });
    } catch (err) {
      // Revert on error
      setAtrMultiTimeframe(!checked);
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTradeTypeChange = async (checked: boolean) => {
    setAutoInferTradeType(checked);
    setIsSaving(true);
    try {
      await updateProfile({ autoInferTradeType: checked });
    } catch (err) {
      // Revert on error
      setAutoInferTradeType(!checked);
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section>
        <HDCard>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        </HDCard>
      </section>
    );
  }

  return (
    <section>
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[var(--text-high)] mb-1">Live Data Behavior</h2>
                {isSaving && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                )}
              </div>
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
                onChange={(e) => handleAtrChange(e.target.checked)}
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
                checked={autoInferTradeType}
                onChange={(e) => handleTradeTypeChange(e.target.checked)}
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
