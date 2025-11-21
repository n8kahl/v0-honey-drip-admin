import { Mic, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { VoiceHUDState, VoiceCommand } from './HDVoiceHUD';

interface HDVoiceDrawerProps {
  state: VoiceHUDState;
  transcript?: string;
  command?: VoiceCommand;
  error?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onSelectOption?: (id: string) => void;
  className?: string;
}

export function HDVoiceDrawer({
  state,
  transcript,
  command,
  error,
  onConfirm,
  onCancel,
  onRetry,
  onSelectOption,
  className
}: HDVoiceDrawerProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface-2)] border-t border-[var(--border-hairline)] shadow-2xl',
        'animate-slide-up',
        className
      )}
    >
      {/* Listening State */}
      {state === 'listening' && (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Mic className="w-5 h-5 text-[var(--brand-primary)]" />
              <div className="absolute inset-0 animate-ping">
                <div className="w-5 h-5 rounded-full bg-[var(--brand-primary)] opacity-30" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--text-high)] font-medium">Listening…</div>
              {transcript && (
                <div className="text-[var(--text-muted)] text-sm truncate mt-0.5">
                  {transcript}
                </div>
              )}
            </div>
            <button
              onClick={onCancel}
              className="text-[var(--text-muted)] hover:text-[var(--text-high)] text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {state === 'processing' && (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[var(--brand-primary)] animate-spin" />
            <div className="flex-1">
              <div className="text-[var(--text-high)] font-medium">Processing…</div>
              {transcript && (
                <div className="text-[var(--text-muted)] text-sm mt-0.5">
                  {transcript}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirming State */}
      {state === 'confirming' && command && (
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[var(--text-high)] font-medium mb-1">
              {command.action}
            </div>
            {command.details && (
              <div className="text-[var(--text-muted)] text-sm">
                {command.details}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              className="flex-1 h-11 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-hover)] transition-colors font-medium"
            >
              Confirm
            </button>
            <button
              onClick={onCancel}
              className="flex-1 h-11 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] active:bg-[var(--surface-3)] transition-colors font-medium border border-[var(--border-hairline)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[var(--accent-negative)] font-medium mb-1">
              Didn't catch that
            </div>
            <div className="text-[var(--text-muted)] text-sm">
              {error || "Try: 'Add TSLA to the watchlist'"}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="flex-1 h-11 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-hover)] transition-colors font-medium"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="flex-1 h-11 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] active:bg-[var(--surface-3)] transition-colors font-medium border border-[var(--border-hairline)]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Ambiguous State */}
      {state === 'ambiguous' && command && command.options && (
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <div className="text-[var(--text-high)] font-medium mb-1">
              Multiple matches found
            </div>
            <div className="text-[var(--text-muted)] text-sm">
              Which one?
            </div>
          </div>

          <div className="space-y-2">
            {command.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onSelectOption?.(option.id)}
                className="w-full text-left px-4 py-3 rounded-[var(--radius)] bg-[var(--surface-1)] active:bg-[var(--surface-3)] transition-colors text-sm text-[var(--text-high)] border border-[var(--border-hairline)]"
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={onCancel}
            className="w-full h-11 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] active:bg-[var(--surface-3)] transition-colors font-medium border border-[var(--border-hairline)]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
