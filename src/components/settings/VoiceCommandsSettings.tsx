/**
 * VoiceCommandsSettings Component
 * Voice command preferences with database persistence
 */

import { useEffect, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { HDCard } from '../hd/common/HDCard';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAppToast } from '../../hooks/useAppToast';

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

  // Handle toggle with auto-save
  const handleVoiceEnabledChange = async (checked: boolean) => {
    setVoiceEnabled(checked);
    setIsSaving(true);
    try {
      await updateProfile({ voiceEnabled: checked });
    } catch {
      // Revert on error
      setVoiceEnabled(!checked);
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmationChange = async (checked: boolean) => {
    setVoiceRequireConfirmation(checked);
    setIsSaving(true);
    try {
      await updateProfile({ voiceRequireConfirmation: checked });
    } catch {
      // Revert on error
      setVoiceRequireConfirmation(!checked);
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAudioFeedbackChange = async (checked: boolean) => {
    setVoiceAudioFeedback(checked);
    setIsSaving(true);
    try {
      await updateProfile({ voiceAudioFeedback: checked });
    } catch {
      // Revert on error
      setVoiceAudioFeedback(!checked);
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const exampleCommands = [
    { category: 'Wake Word', examples: ['"Hey Honey" – Activate voice listening mode'] },
    {
      category: 'Entry Alerts',
      examples: [
        '"Enter QQQ" – Search best contract and generate entry alert',
        '"Enter SPY at 15 dollars" – Generate alert with specified price',
        '"Go long AAPL" – Generate call entry alert',
      ],
    },
    {
      category: 'Exit & Trims',
      examples: [
        '"Exit SPY" – Generate exit alert for active trade',
        '"Trim current trade" – Generate trim alert (default 30-50%)',
        '"Take profits on QQQ" – Generate profit-taking alert',
      ],
    },
    {
      category: 'Position Management',
      examples: [
        '"Update stop loss" – Generate stop loss update alert',
        '"Add to position" – Add to existing trade',
      ],
    },
    {
      category: 'Watchlist',
      examples: [
        '"Add TSLA to watchlist" – Add ticker to watchlist',
        '"Remove SPY from watchlist" – Remove ticker',
      ],
    },
  ];

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
            {voiceEnabled ? (
              <Mic className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            ) : (
              <MicOff className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[var(--text-high)] mb-1">Voice Commands</h2>
                {isSaving && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                )}
              </div>
              <p className="text-[var(--text-muted)] text-xs">
                Enable hands-free trading with voice controls. Commands trigger the same flows as clicking.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(e) => handleVoiceEnabledChange(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-[var(--text-high)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">
                  Enable voice commands
                </span>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Activate microphone for voice-activated trading controls
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={voiceRequireConfirmation}
                onChange={(e) => handleConfirmationChange(e.target.checked)}
                disabled={!voiceEnabled}
                className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <span
                  className={`text-sm group-hover:text-[var(--brand-primary)] transition-colors ${
                    voiceEnabled ? 'text-[var(--text-high)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Require confirmation for trade actions
                </span>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Show confirmation dialog before executing voice-triggered trades
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={voiceAudioFeedback}
                onChange={(e) => handleAudioFeedbackChange(e.target.checked)}
                disabled={!voiceEnabled}
                className="w-4 h-4 mt-0.5 rounded bg-[var(--surface-1)] border-[var(--border-hairline)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <span
                  className={`text-sm group-hover:text-[var(--brand-primary)] transition-colors ${
                    voiceEnabled ? 'text-[var(--text-high)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  Enable audio feedback (TTS)
                </span>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Voice reads back commands and confirmations
                </p>
              </div>
            </label>
          </div>

          {/* Browser Compatibility */}
          <div className="pt-3 border-t border-[var(--border-hairline)]">
            <div className="flex items-start gap-2 p-3 rounded-[var(--radius)] bg-[var(--surface-1)]">
              <span className="text-xs text-[var(--text-muted)]">
                ℹ️ <strong>Browser Support:</strong> Voice commands require Chrome, Edge, or Safari with
                microphone permissions. Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px]">M</kbd> to
                toggle listening, or say <strong>"Hey Honey"</strong> to activate.
              </span>
            </div>
          </div>

          {/* Example Commands */}
          <div className="pt-3 border-t border-[var(--border-hairline)]">
            <h3 className="text-[var(--text-high)] text-sm mb-3">Command Reference</h3>
            <div className="space-y-4">
              {exampleCommands.map((section, idx) => (
                <div key={idx}>
                  <h4 className="text-[var(--brand-primary)] text-xs font-medium mb-1.5">
                    {section.category}
                  </h4>
                  <div className="space-y-1">
                    {section.examples.map((command, cmdIdx) => (
                      <div key={cmdIdx} className="flex items-start gap-2 text-xs pl-2">
                        <span className="text-[var(--text-muted)] min-w-[4px]">•</span>
                        <span className="text-[var(--text-muted)]">{command}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="pt-3 border-t border-[var(--border-hairline)]">
            <h3 className="text-[var(--text-high)] text-sm mb-2">How It Works</h3>
            <div className="space-y-2 text-xs text-[var(--text-muted)]">
              <p>
                <strong className="text-[var(--text-high)]">1. Activate:</strong> Say "Hey Honey" or press M key
              </p>
              <p>
                <strong className="text-[var(--text-high)]">2. Command:</strong> Speak naturally - the system understands context
              </p>
              <p>
                <strong className="text-[var(--text-high)]">3. Smart Search:</strong> For entries, automatically searches best contracts with reasoning
              </p>
              <p>
                <strong className="text-[var(--text-high)]">4. Confirmation:</strong> Reviews alert with voice readback before sending
              </p>
              <p>
                <strong className="text-[var(--text-high)]">5. Send:</strong> Confirms and sends to your default Discord channels
              </p>
            </div>
          </div>
        </div>
      </HDCard>
    </section>
  );
}
