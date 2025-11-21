import { Mic, X, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type VoiceHUDState = 'listening' | 'processing' | 'confirming' | 'error' | 'ambiguous';

export interface VoiceCommand {
  transcript: string;
  action: string;
  details?: string;
  options?: Array<{ id: string; label: string }>;
}

interface HDVoiceHUDProps {
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

export function HDVoiceHUD({
  state,
  transcript,
  command,
  error,
  onConfirm,
  onCancel,
  onRetry,
  onSelectOption,
  className
}: HDVoiceHUDProps) {
  return (
    <div
      className={cn(
        'fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4',
        className
      )}
    >
      <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] shadow-lg overflow-hidden">
        {/* Listening State */}
        {state === 'listening' && (
          <div className="flex items-center gap-3 p-4">
            <div className="relative">
              <Mic className="w-5 h-5 text-[var(--brand-primary)]" />
              <div className="absolute inset-0 animate-ping">
                <div className="w-5 h-5 rounded-full bg-[var(--brand-primary)] opacity-30" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[var(--text-high)] font-medium mb-1">Listening…</div>
              {transcript && (
                <div className="text-[var(--text-muted)] text-sm truncate">
                  {transcript}
                </div>
              )}
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="flex items-center gap-3 p-4">
            <Loader2 className="w-5 h-5 text-[var(--brand-primary)] animate-spin" />
            <div className="flex-1">
              <div className="text-[var(--text-high)] font-medium">Processing…</div>
              {transcript && (
                <div className="text-[var(--text-muted)] text-sm mt-1">
                  {transcript}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirming State */}
        {state === 'confirming' && command && (
          <div className="p-4 space-y-3">
            <div>
              <div className="text-[var(--text-high)] font-medium mb-1">
                Voice command understood
              </div>
              <div className="text-[var(--text-muted)] text-sm">
                "{command.transcript}"
              </div>
            </div>
            
            <div className="bg-[var(--surface-1)] rounded-[var(--radius)] p-3">
              <div className="text-[var(--text-high)] font-medium mb-1">
                {command.action}
              </div>
              {command.details && (
                <div className="text-[var(--text-muted)] text-xs">
                  {command.details}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                className="flex-1 h-9 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] transition-colors font-medium text-sm"
              >
                Confirm
              </button>
              <button
                onClick={onCancel}
                className="flex-1 h-9 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium text-sm border border-[var(--border-hairline)]"
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
                className="flex-1 h-9 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] transition-colors font-medium text-sm"
              >
                Try Again
              </button>
              <button
                onClick={onCancel}
                className="flex-1 h-9 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium text-sm border border-[var(--border-hairline)]"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Ambiguous State */}
        {state === 'ambiguous' && command && command.options && (
          <div className="p-4 space-y-3">
            <div>
              <div className="text-[var(--text-high)] font-medium mb-1">
                Multiple matches found
              </div>
              <div className="text-[var(--text-muted)] text-sm">
                {command.transcript}
              </div>
            </div>

            <div className="space-y-1">
              {command.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onSelectOption?.(option.id)}
                  className="w-full text-left px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)] transition-colors text-sm text-[var(--text-high)] border border-[var(--border-hairline)]"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              onClick={onCancel}
              className="w-full h-9 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium text-sm border border-[var(--border-hairline)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
