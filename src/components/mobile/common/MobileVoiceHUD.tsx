import { cn } from "../../../lib/utils";
import { Mic, Check, X, Loader2 } from "lucide-react";

type VoiceState = "listening" | "processing" | "success" | "error" | "confirming";

interface MobileVoiceHUDProps {
  state: VoiceState;
  transcript?: string;
  command?: {
    action: string;
    ticker?: string;
    contract?: string;
  };
  error?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function MobileVoiceHUD({
  state,
  transcript,
  command,
  error,
  onConfirm,
  onCancel,
}: MobileVoiceHUDProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-6">
      {/* Status icon */}
      <div
        className={cn(
          "w-24 h-24 rounded-full flex items-center justify-center mb-6",
          state === "listening" && "bg-[var(--brand-primary)] animate-pulse",
          state === "processing" && "bg-[var(--brand-primary)]/50",
          state === "success" && "bg-[var(--accent-positive)]",
          state === "error" && "bg-[var(--accent-negative)]",
          state === "confirming" && "bg-[var(--brand-primary)]"
        )}
      >
        {state === "listening" && <Mic className="w-12 h-12 text-black" />}
        {state === "processing" && <Loader2 className="w-12 h-12 text-black animate-spin" />}
        {state === "success" && <Check className="w-12 h-12 text-white" />}
        {state === "error" && <X className="w-12 h-12 text-white" />}
        {state === "confirming" && <Mic className="w-12 h-12 text-black" />}
      </div>

      {/* Status text */}
      <div className="text-center mb-6">
        {state === "listening" && <p className="text-[var(--text-high)] text-lg">Listening...</p>}
        {state === "processing" && <p className="text-[var(--text-high)] text-lg">Processing...</p>}
        {state === "success" && command && (
          <p className="text-[var(--text-high)] text-lg">
            {command.action} {command.ticker}
          </p>
        )}
        {state === "error" && (
          <p className="text-[var(--accent-negative)] text-lg">
            {error || "Command not recognized"}
          </p>
        )}
        {state === "confirming" && command && (
          <>
            <p className="text-[var(--text-high)] text-lg font-semibold mb-1">{command.action}</p>
            {command.ticker && (
              <p className="text-[var(--text-med)]">
                {command.ticker} {command.contract}
              </p>
            )}
          </>
        )}
      </div>

      {/* Transcript */}
      {transcript && state !== "success" && (
        <div className="bg-[var(--surface-1)] rounded-lg px-4 py-2 mb-6 max-w-[280px]">
          <p className="text-[var(--text-muted)] text-sm text-center">"{transcript}"</p>
        </div>
      )}

      {/* Confirm/Cancel buttons for confirming state */}
      {state === "confirming" && (
        <div className="flex gap-3 w-full max-w-[300px]">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-[var(--surface-1)] text-[var(--text-high)] font-medium min-h-[48px]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-[var(--brand-primary)] text-black font-medium min-h-[48px]"
          >
            Confirm
          </button>
        </div>
      )}

      {/* Tap to cancel hint */}
      {(state === "listening" || state === "processing") && (
        <p className="text-[var(--text-muted)] text-sm">Tap anywhere to cancel</p>
      )}
    </div>
  );
}
