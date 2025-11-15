/**
 * TOAST NOTIFICATIONS - All Alert Types
 * 
 * Reference implementation showing toast variants for each alert type.
 * Demonstrates desktop (bottom-right) and mobile (bottom-center) positioning.
 * 
 * See: /docs/ALERT_SYSTEM_SPEC.md Section 4
 */

export function ToastExamples() {
  const toasts = [
    { type: 'LOADED', emoji: '📋', channels: '#options-signals' },
    { type: 'ENTERED', emoji: '🎯', channels: '#options-signals, #spx-room' },
    { type: 'UPDATE', emoji: '📊', channels: '#options-signals, #spx-room' },
    { type: 'ADDED', emoji: '➕', channels: '#options-signals' },
    { type: 'EXITED', emoji: '🏁', channels: '#options-signals, #spx-room, #scalp-challenge' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-8 bg-[var(--bg-base)]">
      <h1 className="text-[var(--text-high)] text-2xl font-medium mb-6">Toast Notification Examples</h1>

      {/* DESKTOP POSITIONING DEMO */}
      <div className="mb-12">
        <h2 className="text-[var(--text-high)] text-lg mb-4">Desktop Position (Bottom-Right)</h2>
        <div className="relative w-full h-[600px] bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg overflow-hidden">
          {/* Simulated App Content */}
          <div className="p-6">
            <div className="h-8 w-48 bg-[var(--surface-2)] rounded mb-4" />
            <div className="h-4 w-full bg-[var(--surface-2)] rounded mb-2" />
            <div className="h-4 w-3/4 bg-[var(--surface-2)] rounded mb-2" />
            <div className="h-4 w-5/6 bg-[var(--surface-2)] rounded" />
          </div>

          {/* Toast Stack - Bottom Right */}
          <div className="absolute bottom-6 right-6 space-y-2 w-80">
            {toasts.slice(0, 3).map((toast, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] border border-[var(--brand-primary)]/50 rounded-lg shadow-lg"
                style={{
                  animation: `slideInRight 0.3s ease-out ${index * 0.1}s both`,
                }}
              >
                <span className="text-xl flex-shrink-0">{toast.emoji}</span>
                <span className="text-sm text-[var(--text-high)] flex-1">
                  <strong>{toast.type}</strong> alert sent to {toast.channels}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          💡 Toasts stack vertically with 8px gap. Most recent appears on top. Auto-dismiss after 4 seconds.
        </p>
      </div>

      {/* MOBILE POSITIONING DEMO */}
      <div className="mb-12">
        <h2 className="text-[var(--text-high)] text-lg mb-4">Mobile Position (Bottom-Center)</h2>
        <div className="relative w-[390px] h-[844px] mx-auto bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-2xl overflow-hidden">
          {/* Simulated App Content */}
          <div className="p-4">
            <div className="h-6 w-32 bg-[var(--surface-2)] rounded mb-4" />
            <div className="h-3 w-full bg-[var(--surface-2)] rounded mb-2" />
            <div className="h-3 w-3/4 bg-[var(--surface-2)] rounded" />
          </div>

          {/* Bottom Nav (for context) */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-center justify-around">
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
            <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          </div>

          {/* Toast - Above Bottom Nav */}
          <div className="absolute bottom-20 left-4 right-4">
            <div
              className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] border border-[var(--brand-primary)]/50 rounded-lg shadow-2xl"
              style={{
                animation: 'slideInUp 0.3s ease-out',
              }}
            >
              <span className="text-xl flex-shrink-0">📊</span>
              <span className="text-sm text-[var(--text-high)] flex-1">
                <strong>UPDATE</strong> sent to #options-signals, #spx-room
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
          💡 Mobile toasts appear 16px above bottom nav. Can swipe left/right to dismiss.
        </p>
      </div>

      {/* ALL TOAST VARIANTS */}
      <div>
        <h2 className="text-[var(--text-high)] text-lg mb-4">All Toast Variants</h2>
        <div className="space-y-3 max-w-md">
          {toasts.map((toast, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] border border-[var(--brand-primary)]/50 rounded-lg"
            >
              <span className="text-xl flex-shrink-0">{toast.emoji}</span>
              <span className="text-sm text-[var(--text-high)] flex-1">
                <strong>{toast.type}</strong> alert sent to {toast.channels}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CSS Animation Examples */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
