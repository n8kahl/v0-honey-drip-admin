import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { HDCard } from '../hd/HDCard';

export function VoiceCommandsSettings() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceRequireConfirmation, setVoiceRequireConfirmation] = useState(true);

  const exampleCommands = [
    '"Buy call on AAPL" – Enter a call option trade',
    '"Sell half" – Close 50% of the current trade',
    '"Exit" – Close the entire trade position',
    '"Add to watchlist SPY" – Add SPY to your watchlist',
  ];

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
              <h2 className="text-[var(--text-high)] mb-1">Voice Commands</h2>
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
                onChange={(e) => setVoiceEnabled(e.target.checked)}
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
                onChange={(e) => setVoiceRequireConfirmation(e.target.checked)}
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
          </div>

          {/* Example Commands */}
          <div className="pt-3 border-t border-[var(--border-hairline)]">
            <h3 className="text-[var(--text-high)] text-sm mb-2">Example Commands</h3>
            <div className="space-y-1.5">
              {exampleCommands.map((command, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-[var(--text-muted)] min-w-[4px]">•</span>
                  <span className="text-[var(--text-muted)]">{command}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </HDCard>
    </section>
  );
}
