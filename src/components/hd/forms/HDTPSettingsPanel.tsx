import { useState, useEffect } from "react";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { Slider } from "../../ui/slider";
import { cn } from "../../../lib/utils";
import { useSettingsStore, TPMode, TPSettings } from "../../../stores/settingsStore";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppToast } from "../../../hooks/useAppToast";

interface HDTPSettingsPanelProps {
  className?: string;
}

export function HDTPSettingsPanel({ className }: HDTPSettingsPanelProps) {
  const toast = useAppToast();
  const auth = useAuth();
  const userId = auth?.user?.id;

  const { tpSettings, tpSettingsLoaded, loadTPSettings, saveTPSettings, setTPSettings } =
    useSettingsStore();

  // Local state for editing
  const [localSettings, setLocalSettings] = useState<TPSettings>(tpSettings);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (userId && !tpSettingsLoaded) {
      loadTPSettings(userId);
    }
  }, [userId, tpSettingsLoaded, loadTPSettings]);

  // Sync local state when store updates
  useEffect(() => {
    setLocalSettings(tpSettings);
  }, [tpSettings]);

  const handleModeChange = async (mode: TPMode) => {
    const newSettings = { ...localSettings, tpMode: mode };
    setLocalSettings(newSettings);

    if (userId) {
      setIsSaving(true);
      try {
        await saveTPSettings(userId, { tpMode: mode });
        toast.success(`TP mode set to ${mode === "percent" ? "Percentage" : "Calculated"}`);
      } catch (error) {
        toast.error("Failed to save TP mode");
        setLocalSettings(tpSettings); // Revert on error
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSliderChange = (field: keyof TPSettings, value: number) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSliderCommit = async (field: keyof TPSettings, value: number) => {
    if (userId) {
      setIsSaving(true);
      try {
        await saveTPSettings(userId, { [field]: value });
      } catch (error) {
        toast.error(`Failed to save ${field}`);
        setLocalSettings(tpSettings); // Revert on error
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSwitchChange = async (field: keyof TPSettings, value: boolean) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);

    if (userId) {
      setIsSaving(true);
      try {
        await saveTPSettings(userId, { [field]: value });
      } catch (error) {
        toast.error(`Failed to save setting`);
        setLocalSettings(tpSettings); // Revert on error
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h3 className="text-[var(--text-high)] font-semibold">Take Profit & Stop Loss</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Configure default TP/SL calculation method and values
        </p>
      </div>

      {/* TP Mode Selection */}
      <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <Label className="text-[var(--text-high)] font-medium mb-3 block">Calculation Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleModeChange("percent")}
            disabled={isSaving}
            className={cn(
              "p-3 rounded-[var(--radius)] border transition-all text-left",
              localSettings.tpMode === "percent"
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                : "border-[var(--border-hairline)] hover:border-[var(--border-subtle)]"
            )}
          >
            <div className="font-medium text-sm text-[var(--text-high)]">Percentage</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Fixed % from entry price</div>
          </button>
          <button
            onClick={() => handleModeChange("calculated")}
            disabled={isSaving}
            className={cn(
              "p-3 rounded-[var(--radius)] border transition-all text-left",
              localSettings.tpMode === "calculated"
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                : "border-[var(--border-hairline)] hover:border-[var(--border-subtle)]"
            )}
          >
            <div className="font-medium text-sm text-[var(--text-high)]">Calculated</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">ATR-based / Level-based</div>
          </button>
        </div>
      </div>

      {/* Percentage Settings (only visible in percent mode) */}
      {localSettings.tpMode === "percent" && (
        <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] space-y-6">
          {/* TP Percent */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[var(--text-high)] font-medium">Take Profit</Label>
              <span className="text-sm text-[var(--accent-positive)] font-mono">
                +{localSettings.tpPercent}%
              </span>
            </div>
            <Slider
              value={[localSettings.tpPercent]}
              onValueChange={(v) => handleSliderChange("tpPercent", v[0])}
              onValueCommit={(v) => handleSliderCommit("tpPercent", v[0])}
              min={10}
              max={200}
              step={5}
              disabled={isSaving}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>10%</span>
              <span>200%</span>
            </div>
          </div>

          {/* SL Percent */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[var(--text-high)] font-medium">Stop Loss</Label>
              <span className="text-sm text-[var(--accent-negative)] font-mono">
                -{localSettings.slPercent}%
              </span>
            </div>
            <Slider
              value={[localSettings.slPercent]}
              onValueChange={(v) => handleSliderChange("slPercent", v[0])}
              onValueCommit={(v) => handleSliderCommit("slPercent", v[0])}
              min={5}
              max={50}
              step={5}
              disabled={isSaving}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>
        </div>
      )}

      {/* Calculated Mode Info */}
      {localSettings.tpMode === "calculated" && (
        <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
          <p className="text-sm text-[var(--text-med)]">
            In calculated mode, TP/SL are determined by:
          </p>
          <ul className="text-xs text-[var(--text-muted)] mt-2 space-y-1 list-disc list-inside">
            <li>ATR (Average True Range) multipliers based on DTE</li>
            <li>Key support/resistance levels from chart</li>
            <li>Risk profile (Scalp, Day, Swing, LEAP)</li>
          </ul>
        </div>
      )}

      {/* Near TP Threshold */}
      <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-[var(--text-high)] font-medium">Near TP Threshold</Label>
          <span className="text-sm text-[var(--brand-primary)] font-mono">
            {Math.round(localSettings.tpNearThreshold * 100)}%
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Alert when price reaches this percentage of target
        </p>
        <Slider
          value={[localSettings.tpNearThreshold * 100]}
          onValueChange={(v) => handleSliderChange("tpNearThreshold", v[0] / 100)}
          onValueCommit={(v) => handleSliderCommit("tpNearThreshold", v[0] / 100)}
          min={50}
          max={95}
          step={5}
          disabled={isSaving}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>50%</span>
          <span>95%</span>
        </div>
      </div>

      {/* Auto-Open Trim Toggle */}
      <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-[var(--text-high)] font-medium">Auto-Open Trim Dialog</Label>
            <p className="text-xs text-[var(--text-muted)]">
              Automatically open trim dialog when near TP threshold
            </p>
          </div>
          <Switch
            checked={localSettings.tpAutoOpenTrim}
            onCheckedChange={(checked) => handleSwitchChange("tpAutoOpenTrim", checked)}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Saving Indicator */}
      {isSaving && <div className="text-xs text-[var(--text-muted)] text-center">Saving...</div>}
    </div>
  );
}
