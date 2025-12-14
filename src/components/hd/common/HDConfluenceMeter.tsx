/**
 * HDConfluenceMeter - Compact confluence score display with progress bar
 *
 * Shows a numeric score (0-100) with a thin progress bar.
 * Color-coded: green >= 70, yellow >= 40, gray < 40
 */

import { cn } from "../../../lib/utils";

interface HDConfluenceMeterProps {
  score: number; // 0-100
  size?: "sm" | "md"; // sm for collapsed, md for expanded
  symbol?: string; // for data-testid
  className?: string;
}

export function HDConfluenceMeter({
  score,
  size = "sm",
  symbol,
  className,
}: HDConfluenceMeterProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Color based on score
  const getColorClasses = () => {
    if (normalizedScore >= 70) {
      return {
        text: "text-[var(--accent-positive)]",
        bg: "bg-[var(--accent-positive)]",
        track: "bg-[var(--accent-positive)]/20",
      };
    }
    if (normalizedScore >= 40) {
      return {
        text: "text-yellow-500",
        bg: "bg-yellow-500",
        track: "bg-yellow-500/20",
      };
    }
    return {
      text: "text-zinc-500",
      bg: "bg-zinc-500",
      track: "bg-zinc-700",
    };
  };

  const colors = getColorClasses();

  const sizeClasses = {
    sm: {
      container: "gap-1",
      text: "text-[10px]",
      bar: "h-1 w-10",
    },
    md: {
      container: "gap-1.5",
      text: "text-xs",
      bar: "h-1.5 w-14",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn("flex items-center", sizes.container, className)}
      data-testid={symbol ? `confluence-meter-${symbol}` : "confluence-meter"}
    >
      {/* Score number */}
      <span className={cn("font-mono font-bold tabular-nums", sizes.text, colors.text)}>
        {normalizedScore}
      </span>

      {/* Progress bar */}
      <div className={cn("relative overflow-hidden rounded-full", sizes.bar, colors.track)}>
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
            colors.bg
          )}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
}

export default HDConfluenceMeter;
