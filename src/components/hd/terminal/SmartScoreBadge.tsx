/**
 * SmartScoreBadge - Institutional-grade score visualization
 *
 * Displays a 0-100 score with color-coded ring/pill visualization.
 * Green (>75), Yellow (50-75), Red (<50)
 * Pulse animation when score > 85 (hot signal)
 */

import { cn } from "@/lib/utils";

interface SmartScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
  variant?: "ring" | "pill";
}

const sizeConfig = {
  sm: {
    ring: "w-10 h-10",
    pill: "px-2 py-0.5 text-xs",
    strokeWidth: 3,
    fontSize: "text-xs",
    radius: 16,
  },
  md: {
    ring: "w-14 h-14",
    pill: "px-3 py-1 text-sm",
    strokeWidth: 4,
    fontSize: "text-sm",
    radius: 22,
  },
  lg: {
    ring: "w-20 h-20",
    pill: "px-4 py-1.5 text-base",
    strokeWidth: 5,
    fontSize: "text-lg",
    radius: 32,
  },
};

function getScoreColor(score: number): {
  text: string;
  ring: string;
  bg: string;
  glow: string;
} {
  if (score >= 75) {
    return {
      text: "text-emerald-400",
      ring: "stroke-emerald-500",
      bg: "bg-emerald-500/20",
      glow: "shadow-emerald-500/50",
    };
  } else if (score >= 50) {
    return {
      text: "text-amber-400",
      ring: "stroke-amber-500",
      bg: "bg-amber-500/20",
      glow: "shadow-amber-500/50",
    };
  } else {
    return {
      text: "text-red-400",
      ring: "stroke-red-500",
      bg: "bg-red-500/20",
      glow: "shadow-red-500/50",
    };
  }
}

export function SmartScoreBadge({
  score,
  size = "md",
  label,
  showValue = true,
  variant = "ring",
}: SmartScoreBadgeProps) {
  const config = sizeConfig[size];
  const colors = getScoreColor(score);
  const isHot = score > 85;

  // Normalize score to 0-100 range
  const normalizedScore = Math.max(0, Math.min(100, score));

  if (variant === "pill") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-mono font-semibold border",
          config.pill,
          colors.bg,
          colors.text,
          "border-current/30",
          isHot && "animate-pulse shadow-lg",
          isHot && colors.glow
        )}
      >
        {label && <span className="opacity-70">{label}</span>}
        {showValue && <span>{normalizedScore.toFixed(0)}</span>}
      </div>
    );
  }

  // Ring variant - SVG circular progress
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", config.ring)}>
      {/* Background ring */}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={config.radius}
          fill="none"
          strokeWidth={config.strokeWidth}
          className="stroke-muted/30"
        />
        {/* Progress ring */}
        <circle
          cx="40"
          cy="40"
          r={config.radius}
          fill="none"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(colors.ring, "transition-all duration-500 ease-out")}
        />
      </svg>

      {/* Center content */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center",
          isHot && "animate-pulse"
        )}
      >
        {showValue && (
          <span className={cn("font-mono font-bold leading-none", config.fontSize, colors.text)}>
            {normalizedScore.toFixed(0)}
          </span>
        )}
        {label && (
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {label}
          </span>
        )}
      </div>

      {/* Hot glow effect */}
      {isHot && (
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-md opacity-30 animate-pulse",
            colors.bg
          )}
        />
      )}
    </div>
  );
}

export default SmartScoreBadge;
