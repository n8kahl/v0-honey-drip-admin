/**
 * MobileActionFab - Gold Floating Action Button
 *
 * The "Trade [Symbol]" button that appears in the bottom-right corner.
 * Opens a bottom sheet with the trade options chain / quick trade.
 *
 * Design:
 * - Honey Drip Gold background
 * - 56px diameter (large touch target)
 * - Pulsing animation when opportunities exist
 * - Shows active symbol or "Trade" when no symbol selected
 */

import { useState } from "react";
import { Zap, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface MobileActionFabProps {
  symbol?: string | null;
  hasOpportunity?: boolean;
  onTap: () => void;
  disabled?: boolean;
}

export function MobileActionFab({
  symbol,
  hasOpportunity = false,
  onTap,
  disabled = false,
}: MobileActionFabProps) {
  const [isPressed, setIsPressed] = useState(false);

  const label = symbol ? `Trade ${symbol}` : "Trade";

  return (
    <button
      onClick={onTap}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      disabled={disabled}
      className={cn(
        // Base styles
        "fixed bottom-24 right-4 z-50",
        "flex items-center gap-2 px-5 py-4",
        "rounded-full shadow-lg",
        "transition-all duration-200 ease-out",
        // Gold branding
        "bg-[var(--brand-primary)] text-black",
        // Touch feedback
        isPressed && "scale-95",
        !isPressed && "scale-100",
        // Hover/active states
        "active:scale-95 active:shadow-md",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        // Glow effect when opportunity exists
        hasOpportunity && !disabled && "shadow-[0_0_20px_rgba(234,179,8,0.4)]"
      )}
      style={{
        minHeight: "56px",
        minWidth: "56px",
      }}
    >
      {/* Lightning bolt icon */}
      <Zap
        className={cn("w-6 h-6 flex-shrink-0", hasOpportunity && "animate-pulse")}
        fill="currentColor"
      />

      {/* Label */}
      <span className="text-base font-bold uppercase tracking-wide whitespace-nowrap">{label}</span>

      {/* Pulse ring animation when opportunity exists */}
      {hasOpportunity && !disabled && (
        <span className="absolute inset-0 rounded-full bg-[var(--brand-primary)] animate-ping opacity-20" />
      )}
    </button>
  );
}

/**
 * MobileActionFabCollapsed - Compact version (icon only)
 *
 * For use when we want a smaller footprint.
 */
export function MobileActionFabCollapsed({
  hasOpportunity = false,
  onTap,
  disabled = false,
}: Omit<MobileActionFabProps, "symbol">) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onTap}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      disabled={disabled}
      className={cn(
        // Base styles
        "fixed bottom-24 right-4 z-50",
        "flex items-center justify-center",
        "w-14 h-14 rounded-full shadow-lg",
        "transition-all duration-200 ease-out",
        // Gold branding
        "bg-[var(--brand-primary)] text-black",
        // Touch feedback
        isPressed && "scale-95",
        !isPressed && "scale-100",
        // Hover/active states
        "active:scale-95 active:shadow-md",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        // Glow effect when opportunity exists
        hasOpportunity && !disabled && "shadow-[0_0_20px_rgba(234,179,8,0.4)]"
      )}
    >
      <Zap className={cn("w-7 h-7", hasOpportunity && "animate-pulse")} fill="currentColor" />

      {/* Pulse ring animation */}
      {hasOpportunity && !disabled && (
        <span className="absolute inset-0 rounded-full bg-[var(--brand-primary)] animate-ping opacity-20" />
      )}
    </button>
  );
}

export default MobileActionFab;
