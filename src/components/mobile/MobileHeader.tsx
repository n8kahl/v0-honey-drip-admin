import { Mic, MicOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { branding } from "../../lib/config/branding";

interface MobileHeaderProps {
  isListening?: boolean;
  isProcessing?: boolean;
  waitingForWakeWord?: boolean;
  onToggleVoice?: () => void;
  rightContent?: React.ReactNode;
}

export function MobileHeader({
  isListening = false,
  isProcessing = false,
  waitingForWakeWord = false,
  onToggleVoice,
  rightContent,
}: MobileHeaderProps) {
  const voiceActive = isListening || isProcessing || waitingForWakeWord;

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-center justify-between px-4 pt-safe z-50">
      {/* Logo + Brand */}
      <div className="flex items-center gap-2">
        <img src={branding.logoUrl} alt={branding.appName} className="w-8 h-8 object-contain" />
        <span className="text-[var(--text-high)] font-semibold text-sm">{branding.appName}</span>
      </div>

      {/* Right side: Status + Voice */}
      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Live</span>
        </div>

        {/* Voice button */}
        {onToggleVoice && (
          <button
            onClick={onToggleVoice}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full transition-all",
              "min-h-[44px] min-w-[44px]", // Touch target
              voiceActive
                ? "bg-[var(--brand-primary)] text-black"
                : "bg-[var(--surface-2)] text-[var(--text-muted)]",
              isProcessing && "animate-pulse"
            )}
          >
            {voiceActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
        )}

        {rightContent}
      </div>
    </header>
  );
}
