/**
 * HDInstitutionalRadar - Animated empty state with gold radar
 *
 * Replaces boring "No Data" text with an institutional-themed
 * animated radar visual that communicates "scanning for flow".
 *
 * Usage:
 * - Empty watchlist: "Scanning for opportunities..."
 * - Empty trades: "Waiting for institutional flow..."
 * - Loading states: "Detecting smart money..."
 */

import { cn } from "../../../lib/utils";
import { Radar } from "lucide-react";

interface HDInstitutionalRadarProps {
  /** Primary message displayed below the radar */
  message?: string;
  /** Secondary helper text */
  subMessage?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom class name */
  className?: string;
}

export function HDInstitutionalRadar({
  message = "Waiting for institutional flow...",
  subMessage,
  size = "md",
  className,
}: HDInstitutionalRadarProps) {
  const sizeClasses = {
    sm: {
      container: "py-6",
      radar: "w-8 h-8",
      rings: "w-12 h-12",
      message: "text-xs",
      subMessage: "text-[10px]",
    },
    md: {
      container: "py-10",
      radar: "w-12 h-12",
      rings: "w-20 h-20",
      message: "text-sm",
      subMessage: "text-xs",
    },
    lg: {
      container: "py-16",
      radar: "w-16 h-16",
      rings: "w-28 h-28",
      message: "text-base",
      subMessage: "text-sm",
    },
  };

  const s = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        s.container,
        className
      )}
    >
      {/* Radar Animation Container */}
      <div className="relative mb-4">
        {/* Pulsing rings */}
        <div
          className={cn("absolute inset-0 flex items-center justify-center", s.rings)}
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          {/* Ring 1 */}
          <div
            className="absolute rounded-full border border-[var(--brand-primary)] animate-radar-ring radar-ring-1"
            style={{ width: "100%", height: "100%" }}
          />
          {/* Ring 2 */}
          <div
            className="absolute rounded-full border border-[var(--brand-primary)] animate-radar-ring radar-ring-2"
            style={{ width: "100%", height: "100%" }}
          />
          {/* Ring 3 */}
          <div
            className="absolute rounded-full border border-[var(--brand-primary)] animate-radar-ring radar-ring-3"
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Center radar icon with pulse */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full",
            "bg-[var(--surface-2)] border border-[var(--brand-primary)]",
            "animate-radar-pulse",
            s.rings
          )}
        >
          <Radar className={cn("text-[var(--brand-primary)]", s.radar)} />
        </div>
      </div>

      {/* Message */}
      <p className={cn("font-medium text-[var(--brand-primary)]", s.message)}>{message}</p>

      {/* Sub-message */}
      {subMessage && (
        <p className={cn("mt-1 text-[var(--text-muted)]", s.subMessage)}>{subMessage}</p>
      )}
    </div>
  );
}

export default HDInstitutionalRadar;
