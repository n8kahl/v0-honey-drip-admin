/**
 * HDCheckmarkCelebration - Subtle celebration animation for trade entry
 *
 * Features:
 * - SVG checkmark that draws in
 * - Pulse animation after draw completes
 * - Auto-fades out after animation
 * - Can be triggered imperatively via ref
 */

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { cn } from "../../../lib/utils";

export interface HDCheckmarkCelebrationRef {
  trigger: () => void;
}

interface HDCheckmarkCelebrationProps {
  /** Size of the checkmark circle */
  size?: number;
  /** Auto-trigger on mount */
  autoTrigger?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  className?: string;
}

export const HDCheckmarkCelebration = forwardRef<
  HDCheckmarkCelebrationRef,
  HDCheckmarkCelebrationProps
>(({ size = 48, autoTrigger = false, onComplete, className }, ref) => {
  const [isAnimating, setIsAnimating] = useState(autoTrigger);
  const [phase, setPhase] = useState<"idle" | "draw" | "pulse" | "fade">("idle");

  // Expose trigger method via ref
  useImperativeHandle(ref, () => ({
    trigger: () => {
      setIsAnimating(true);
      setPhase("draw");
    },
  }));

  // Auto-trigger on mount if requested
  useEffect(() => {
    if (autoTrigger) {
      setPhase("draw");
    }
  }, [autoTrigger]);

  // Animation sequence
  useEffect(() => {
    if (!isAnimating) return;

    if (phase === "draw") {
      // After draw completes (400ms), start pulse
      const timer = setTimeout(() => setPhase("pulse"), 400);
      return () => clearTimeout(timer);
    }

    if (phase === "pulse") {
      // After pulse (400ms), start fade
      const timer = setTimeout(() => setPhase("fade"), 400);
      return () => clearTimeout(timer);
    }

    if (phase === "fade") {
      // After fade (300ms), complete
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPhase("idle");
        onComplete?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [phase, isAnimating, onComplete]);

  if (!isAnimating) return null;

  const strokeWidth = size / 16;
  const checkPath = `M ${size * 0.28} ${size * 0.52} L ${size * 0.42} ${size * 0.66} L ${size * 0.72} ${size * 0.36}`;

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center pointer-events-none z-50",
        phase === "fade" && "opacity-0 transition-opacity duration-300",
        className
      )}
    >
      <div className={cn("relative", phase === "pulse" && "animate-checkmark-pulse")}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            fill="var(--accent-positive)"
            opacity={0.2}
          />

          {/* Circle border */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            fill="none"
            stroke="var(--accent-positive)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Checkmark path */}
          <path
            d={checkPath}
            fill="none"
            stroke="var(--accent-positive)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={phase === "draw" ? "animate-checkmark-draw" : ""}
            style={{
              strokeDasharray: 50,
              strokeDashoffset: phase === "idle" ? 50 : 0,
            }}
          />
        </svg>
      </div>
    </div>
  );
});

HDCheckmarkCelebration.displayName = "HDCheckmarkCelebration";

/**
 * Hook to trigger celebration animation imperatively
 */
export function useCelebration() {
  const [show, setShow] = useState(false);

  const trigger = () => {
    setShow(true);
  };

  const hide = () => {
    setShow(false);
  };

  return { show, trigger, hide };
}
