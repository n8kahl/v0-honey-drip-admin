/**
 * VoiceCommandsSettings Component
 *
 * Compact voice command preferences with database persistence.
 * Full command reference moved to docs/VOICE_COMMANDS.md
 */

import { useEffect, useState } from 'react';
import { Mic, MicOff, Loader2, ExternalLink } from 'lucide-react';
import { HDCard } from '../hd/common/HDCard';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAppToast } from '../../hooks/useAppToast';

const EXAMPLE_COMMANDS = ['"Enter SPY"', '"Take profit"', '"Add NVDA"'];

export function VoiceCommandsSettings() {
  const { profile, isLoading, updateProfile } = useUserSettings();
  const toast = useAppToast();

  // Local state for optimistic UI
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceRequireConfirmation, setVoiceRequireConfirmation] = useState(true);
  const [voiceAudioFeedback, setVoiceAudioFeedback] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with profile when loaded
  useEffect(() => {
    if (profile) {
      setVoiceEnabled(profile.voiceEnabled);
      setVoiceRequireConfirmation(profile.voiceRequireConfirmation);
      setVoiceAudioFeedback(profile.voiceAudioFeedback);
    }
  }, [profile]);

  // Generic toggle handler
  const handleToggle = async (
    field: 'voiceEnabled' | 'voiceRequireConfirmation' | 'voiceAudioFeedback',
    checked: boolean,
    setter: (v: boolean) => void
  ) => {
    setter(checked);
    setIsSaving(true);
    try {
      await updateProfile({ [field]: checked });
    } catch {
      setter(!checked);
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
          {/* Header */}
          <div className="flex items-center gap-3">
            {voiceEnabled ? (
              <Mic className="w-5 h-5 text-[var(--brand-primary)]" />
            ) : (
              <MicOff className="w-5 h-5 text-[var(--text-muted)]" />
            )}
            <div className="flex-1 flex items-center gap-2">
              <h2 className="text-[var(--text-high)]">Voice Commands</h2>
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <Toggle
              checked={voiceEnabled}
              onChange={(c) => handleToggle('voiceEnabled', c, setVoiceEnabled)}
              label="Enable voice commands"
            />
            <Toggle
              checked={voiceRequireConfirmation}
              onChange={(c) => handleToggle('voiceRequireConfirmation', c, setVoiceRequireConfirmation)}
              disabled={!voiceEnabled}
              label="Require confirmation"
            />
            <Toggle
              checked={voiceAudioFeedback}
              onChange={(c) => handleToggle('voiceAudioFeedback', c, setVoiceAudioFeedback)}
              disabled={!voiceEnabled}
              label="Audio feedback (TTS)"
            />
          </div>

          {/* Activation hint */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Say</span>
            <kbd className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px] font-medium">
              "Hey Honey"
            </kbd>
            <span>or press</span>
            <kbd className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px] font-medium">M</kbd>
          </div>

          {/* Example commands */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_COMMANDS.map((cmd) => (
              <span
                key={cmd}
                className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--border-hairline)]"
              >
                {cmd}
              </span>
            ))}
          </div>

          {/* Link to full docs */}
          <a
            href="/docs/VOICE_COMMANDS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline"
          >
            View all commands
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Browser compatibility */}
          <p className="text-[10px] text-[var(--text-faint)]">
            Requires Chrome, Edge, or Safari with microphone permissions.
          </p>
        </div>
      </HDCard>
    </section>
  );
}

/** Compact toggle component */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />
      <span
        className={`text-xs ${
          disabled ? 'text-[var(--text-muted)]' : 'text-[var(--text-high)] group-hover:text-[var(--brand-primary)]'
        } transition-colors`}
      >
        {label}
      </span>
    </label>
  );
}
