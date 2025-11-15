import { Mic, X } from 'lucide-react';

/**
 * VOICE COMMAND OVERLAY
 * 
 * Reference implementation showing the three states:
 * 1. Listening (animated waveform)
 * 2. Processing (spinner)
 * 3. Parsed Command Review (action buttons)
 * 
 * See: /docs/ALERT_SYSTEM_SPEC.md Section 5
 */

export function VoiceCommandOverlay() {
  return (
    <div className="w-full max-w-6xl mx-auto p-8 bg-[var(--bg-base)]">
      <h1 className="text-[var(--text-high)] text-2xl font-medium mb-6">Voice Command Overlay States</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* STATE 1: LISTENING */}
        <div>
          <h2 className="text-[var(--text-high)] text-lg mb-4">State 1: Listening</h2>
          <div className="relative w-full h-[400px] bg-black/60 border border-[var(--border-hairline)] rounded-lg flex items-center justify-center">
            <div className="text-center">
              {/* Animated Mic Icon */}
              <div className="w-24 h-24 rounded-full bg-[var(--brand-primary)]/20 border-2 border-[var(--brand-primary)] flex items-center justify-center mb-6 mx-auto relative">
                <Mic className="w-12 h-12 text-[var(--brand-primary)]" />
                {/* Pulse Animation Rings */}
                <div className="absolute inset-0 rounded-full border-2 border-[var(--brand-primary)] animate-ping opacity-20" />
                <div className="absolute inset-0 rounded-full border-2 border-[var(--brand-primary)] animate-pulse opacity-10" />
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-center justify-center gap-1 mb-4">
                {[0.4, 0.8, 0.6, 1, 0.7, 0.5, 0.9, 0.6, 0.8, 0.5].map((height, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-[var(--brand-primary)] rounded-full"
                    style={{
                      height: `${height * 40}px`,
                      animation: `wave 1s ease-in-out ${i * 0.1}s infinite alternate`,
                    }}
                  />
                ))}
              </div>

              <p className="text-[var(--text-high)] text-lg mb-2">Listening...</p>
              <p className="text-[var(--text-muted)] text-sm">Speak your command</p>

              <button className="mt-6 px-6 py-2 bg-[var(--surface-1)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* STATE 2: PROCESSING */}
        <div>
          <h2 className="text-[var(--text-high)] text-lg mb-4">State 2: Processing</h2>
          <div className="relative w-full h-[400px] bg-black/60 border border-[var(--border-hairline)] rounded-lg flex items-center justify-center">
            <div className="text-center max-w-md">
              {/* Spinner */}
              <div className="w-12 h-12 border-4 border-[var(--surface-2)] border-t-[var(--brand-primary)] rounded-full animate-spin mx-auto mb-6" />

              {/* Parsed Text Appearing */}
              <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg mb-4">
                <p className="text-[var(--text-high)] text-sm">
                  "Enter SPX 0DTE 5800C call<span className="animate-pulse">...</span>"
                </p>
              </div>

              <p className="text-[var(--text-muted)] text-sm">Processing your command...</p>
            </div>
          </div>
        </div>

        {/* STATE 3: PARSED COMMAND REVIEW */}
        <div>
          <h2 className="text-[var(--text-high)] text-lg mb-4">State 3: Parsed Command Review</h2>
          <div className="relative w-full h-[500px] bg-black/60 border border-[var(--border-hairline)] rounded-lg flex items-center justify-center">
            <div className="w-full max-w-md mx-auto p-6">
              {/* Close Button */}
              <button className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-1)] transition-colors">
                <X className="w-6 h-6" />
              </button>

              {/* Success Icon */}
              <div className="w-16 h-16 rounded-full bg-[var(--positive)]/20 border-2 border-[var(--positive)] flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">✓</span>
              </div>

              {/* Parsed Command */}
              <div className="mb-6">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Parsed Command
                </label>
                <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
                  <p className="text-[var(--text-high)] text-sm mb-3">
                    "Enter SPX 0DTE 5800C call"
                  </p>
                  <div className="pt-3 border-t border-[var(--border-hairline)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Interpreted as:</p>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--brand-primary)]">→</span>
                      <p className="text-sm text-[var(--text-high)]">
                        Open <strong>ENTER</strong> alert for <strong>SPX $5800C 0DTE</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium rounded-lg transition-colors">
                  Review Alert
                </button>
                <button className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors">
                  Cancel
                </button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-[var(--text-muted)] text-center mt-4">
                💡 "Review Alert" opens the ENTER alert composer prefilled with SPX contract
              </p>
            </div>
          </div>
        </div>

        {/* MOBILE VARIANT */}
        <div>
          <h2 className="text-[var(--text-high)] text-lg mb-4">Mobile Variant (Parsed Review)</h2>
          <div className="w-[390px] h-[844px] mx-auto bg-black/80 border-x border-[var(--border-hairline)] flex items-center justify-center relative">
            <div className="w-full px-4">
              {/* Close Button */}
              <button className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)]">
                <X className="w-6 h-6" />
              </button>

              {/* Success Icon */}
              <div className="w-16 h-16 rounded-full bg-[var(--positive)]/20 border-2 border-[var(--positive)] flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">✓</span>
              </div>

              {/* Parsed Command */}
              <div className="mb-6">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Parsed Command
                </label>
                <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg">
                  <p className="text-[var(--text-high)] text-sm mb-3">
                    "Trim SPX scalp"
                  </p>
                  <div className="pt-3 border-t border-[var(--border-hairline)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Interpreted as:</p>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--brand-primary)]">→</span>
                      <p className="text-sm text-[var(--text-high)]">
                        Open <strong>UPDATE</strong> alert (trim mode) for <strong>SPX $5800C 0DTE</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] font-medium rounded-lg transition-colors">
                  Review Alert
                </button>
                <button className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COMMAND EXAMPLES */}
        <div>
          <h2 className="text-[var(--text-high)] text-lg mb-4">Example Voice Commands</h2>
          <div className="space-y-3 max-w-2xl">
            {[
              { command: '"Load SPX 0DTE 5800 call"', action: 'Opens LOAD alert composer' },
              { command: '"Enter SPX 0DTE 5800C call"', action: 'Opens ENTER alert composer' },
              { command: '"Enter NVDA weekly 485 put at $8.50"', action: 'Opens ENTER composer, prefills entry $8.50' },
              { command: '"Trim SPX scalp"', action: 'Opens UPDATE composer (trim mode)' },
              { command: '"Update stop to breakeven on SPX"', action: 'Opens UPDATE composer (SL mode, breakeven)' },
              { command: '"Update stop to $20 on NVDA"', action: 'Opens UPDATE composer (SL mode, fixed $20)' },
              { command: '"Add to SPX"', action: 'Opens ADD composer' },
              { command: '"Exit NVDA at $29.50"', action: 'Opens EXIT composer, prefills exit $29.50' },
            ].map((example, index) => (
              <div
                key={index}
                className="p-4 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <Mic className="w-4 h-4 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-high)] mb-1">{example.command}</p>
                    <p className="text-xs text-[var(--text-muted)]">→ {example.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg max-w-2xl">
            <p className="text-blue-400 text-sm">
              <strong>🔒 Safety Rule:</strong> Voice commands <em>never</em> auto-send alerts. 
              They only prefill the alert composer for admin review and approval.
            </p>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes wave {
          0% {
            transform: scaleY(0.4);
          }
          100% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
