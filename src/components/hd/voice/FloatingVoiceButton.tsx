/**
 * FloatingVoiceButton
 *
 * Global floating action button for voice commands.
 * Always visible, shows voice state, press M or click to activate.
 */

import { Mic, MicOff } from "lucide-react";
import { cn } from "../../../lib/utils";

export interface FloatingVoiceButtonProps {
  isListening: boolean;
  isProcessing?: boolean;
  waitingForWakeWord?: boolean;
  onToggle: () => void;
  className?: string;
}

export function FloatingVoiceButton({
  isListening,
  isProcessing,
  waitingForWakeWord,
  onToggle,
  className,
}: FloatingVoiceButtonProps) {
  const getButtonState = () => {
    if (isProcessing) {
      return {
        icon: Mic,
        label: "Processing...",
        color: "bg-[var(--brand-primary)]/80",
        pulse: false,
      };
    }

    if (isListening && waitingForWakeWord) {
      return {
        icon: Mic,
        label: 'Say "Hey Honey"',
        color: "bg-[var(--brand-primary)]",
        pulse: true,
      };
    }

    if (isListening) {
      return {
        icon: Mic,
        label: "Listening...",
        color: "bg-[var(--brand-primary)]",
        pulse: true,
      };
    }

    return {
      icon: MicOff,
      label: "Voice (Press M)",
      color: "bg-[var(--surface-2)] hover:bg-[var(--surface-3)]",
      pulse: false,
    };
  };

  const state = getButtonState();
  const Icon = state.icon;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "fixed bottom-20 md:bottom-6 right-6 z-40",
        "w-14 h-14 rounded-full shadow-lg",
        "flex items-center justify-center",
        "transition-all duration-200",
        "border border-[var(--border-hairline)]",
        state.color,
        "group",
        className
      )}
      title={state.label}
      aria-label={state.label}
    >
      {state.pulse && (
        <div className="absolute inset-0 rounded-full">
          <div className="absolute inset-0 rounded-full animate-ping bg-[var(--brand-primary)] opacity-40" />
        </div>
      )}

      <Icon
        className={cn(
          "w-6 h-6 relative z-10",
          isListening ? "text-white" : "text-[var(--text-high)]",
          state.pulse && "animate-pulse"
        )}
      />

      {/* Tooltip */}
      <div
        className={cn(
          "absolute right-full mr-3 px-3 py-2 rounded-[var(--radius)]",
          "bg-[var(--surface-1)] border border-[var(--border-hairline)] shadow-lg",
          "text-xs text-[var(--text-high)] whitespace-nowrap",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200",
          "pointer-events-none"
        )}
      >
        {state.label}
      </div>
    </button>
  );
}
