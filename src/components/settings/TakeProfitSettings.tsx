import { useEffect, useState } from "react";
import { Info, TrendingUp, Loader2 } from "lucide-react";
import { HDCard } from "../hd/common/HDCard";
import { useUserSettings } from "../../hooks/useUserSettings";
import { useAppToast } from "../../hooks/useAppToast";

export function TakeProfitSettings() {
  const { profile, isLoading, updateProfile } = useUserSettings();
  const toast = useAppToast();

  // Local state for optimistic UI
  const [tpMode, setTpMode] = useState<"percent" | "calculated">("percent");
  const [tpPercent, setTpPercent] = useState(50);
  const [slPercent, setSlPercent] = useState(20);
  const [tpNearThreshold, setTpNearThreshold] = useState(85);
  const [autoOpenTrim, setAutoOpenTrim] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with profile when loaded
  useEffect(() => {
    if (profile) {
      setTpMode(profile.tpMode);
      setTpPercent(profile.tpPercent);
      setSlPercent(profile.slPercent);
      setTpNearThreshold(Math.round(profile.tpNearThreshold * 100));
      setAutoOpenTrim(profile.tpAutoOpenTrim);
    }
  }, [profile]);

  const handleSave = async (updates: Partial<typeof profile>) => {
    setIsSaving(true);
    try {
      await updateProfile(updates);
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
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
            <TrendingUp className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[var(--text-high)] mb-1">Take Profit & Stop Loss</h2>
                {isSaving && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                )}
              </div>
              <p className="text-[var(--text-muted)] text-xs">
                Configure default TP/SL calculation strategy and percentages.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* TP/SL Mode */}
            <div>
              <label className="block text-[var(--text-muted)] text-sm mb-2">
                Calculation Mode
              </label>
              <select
                value={tpMode}
                onChange={(e) => {
                  const newMode = e.target.value as "percent" | "calculated";
                  setTpMode(newMode);
                  handleSave({ tpMode: newMode });
                }}
                className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)]"
              >
                <option value="percent">Fixed Percentage</option>
                <option value="calculated">Calculated (ATR-based)</option>
              </select>
              <p className="text-[var(--text-muted)] text-[10px] mt-1.5">
                {tpMode === "percent"
                  ? "Use fixed percentages for TP/SL calculation"
                  : "Use ATR and key levels for dynamic TP/SL calculation"}
              </p>
            </div>

            {/* TP/SL Percentages (only shown in percent mode) */}
            {tpMode === "percent" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--text-muted)] text-sm mb-2">
                    Take Profit (%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={tpPercent}
                    onChange={(e) => setTpPercent(Number(e.target.value))}
                    onBlur={() => handleSave({ tpPercent })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)]"
                  />
                  <p className="text-[var(--text-muted)] text-[10px] mt-1.5">
                    Target profit percentage from entry (e.g., 50 = +50% gain)
                  </p>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] text-sm mb-2">
                    Stop Loss (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={slPercent}
                    onChange={(e) => setSlPercent(Number(e.target.value))}
                    onBlur={() => handleSave({ slPercent })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)]"
                  />
                  <p className="text-[var(--text-muted)] text-[10px] mt-1.5">
                    Maximum loss percentage from entry (e.g., 20 = -20% loss)
                  </p>
                </div>
              </div>
            )}

            {/* TP Near Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--text-muted)] text-sm mb-2">
                  TP Near Threshold (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={tpNearThreshold}
                  onChange={(e) => setTpNearThreshold(Number(e.target.value))}
                  onBlur={() => handleSave({ tpNearThreshold: tpNearThreshold / 100 })}
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
                    checked={autoOpenTrim}
                    onChange={(e) => {
                      setAutoOpenTrim(e.target.checked);
                      handleSave({ tpAutoOpenTrim: e.target.checked });
                    }}
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
        </div>
      </HDCard>
    </section>
  );
}
