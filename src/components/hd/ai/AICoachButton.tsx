/**
 * AICoachButton - "Manage with AI" button for trade cards
 *
 * Appears on trade cards to start/resume AI coaching sessions
 */

import { cn } from "../../../lib/utils";
import { Brain, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import type { TradeType } from "../../../lib/ai/types";

interface AICoachButtonProps {
  onClick: () => void;
  isActive?: boolean;
  isLoading?: boolean;
  coachingMode?: TradeType | null;
  disabled?: boolean;
  variant?: "default" | "compact" | "icon";
  className?: string;
}

export function AICoachButton({
  onClick,
  isActive = false,
  isLoading = false,
  coachingMode,
  disabled = false,
  variant = "default",
  className,
}: AICoachButtonProps) {
  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={disabled || isLoading}
        className={cn("h-7 w-7 p-0", isActive && "text-[var(--brand-primary)]", className)}
        title={isActive ? "AI Coach Active" : "Start AI Coach"}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Brain className={cn("w-4 h-4", isActive && "animate-pulse")} />
        )}
      </Button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius)] text-[10px] font-medium transition-colors",
          isActive
            ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30"
            : "bg-[var(--surface-1)] text-[var(--text-med)] hover:bg-[var(--surface-2)] border border-[var(--border-hairline)]",
          (disabled || isLoading) && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Brain className={cn("w-3 h-3", isActive && "animate-pulse")} />
        )}
        <span>{isActive ? "AI Active" : "AI Coach"}</span>
      </button>
    );
  }

  // Default variant
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "gap-2",
        isActive
          ? "bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90"
          : "bg-[var(--surface-1)] text-[var(--text-med)] hover:bg-[var(--surface-2)] border border-[var(--border-hairline)]",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Brain className={cn("w-4 h-4", isActive && "animate-pulse")} />
      )}
      <span>
        {isActive ? `AI Coach (${coachingMode?.toUpperCase() || "Active"})` : "Manage with AI"}
      </span>
    </Button>
  );
}

export default AICoachButton;
