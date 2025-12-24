/**
 * HDSetupTypeBadge - Displays the detected setup/pattern type
 * Shows badges like "Break and Retest", "Momentum", "Reversal", etc.
 */

import { cn } from "../../../lib/utils";
import type { SetupType } from "../../../types";

interface HDSetupTypeBadgeProps {
  setupType: SetupType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Configuration for each setup type
const SETUP_CONFIG: Record<
  SetupType,
  {
    label: string;
    shortLabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string;
    description: string;
  }
> = {
  BREAKOUT: {
    label: "Breakout",
    shortLabel: "BRK",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    icon: "🚀",
    description: "Price breaking through key resistance/support",
  },
  REVERSAL: {
    label: "Reversal",
    shortLabel: "REV",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    icon: "🔄",
    description: "Potential trend reversal at key level",
  },
  MOMENTUM: {
    label: "Momentum",
    shortLabel: "MOM",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    icon: "⚡",
    description: "Strong directional move with volume",
  },
  BREAK_AND_RETEST: {
    label: "Break & Retest",
    shortLabel: "B&R",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    icon: "🎯",
    description: "Price retesting broken level as new support/resistance",
  },
  TREND_CONTINUATION: {
    label: "Trend Continuation",
    shortLabel: "CONT",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    icon: "📈",
    description: "Pullback in established trend",
  },
  RANGE_FADE: {
    label: "Range Fade",
    shortLabel: "FADE",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
    icon: "↔️",
    description: "Fading move at range boundary",
  },
  VWAP_BOUNCE: {
    label: "VWAP Bounce",
    shortLabel: "VWAP",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    icon: "📏",
    description: "Price bouncing off VWAP level",
  },
  GAP_FILL: {
    label: "Gap Fill",
    shortLabel: "GAP",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: "🕳️",
    description: "Price filling overnight gap",
  },
  SQUEEZE_BREAKOUT: {
    label: "Squeeze Breakout",
    shortLabel: "SQZ",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: "💥",
    description: "Volatility expansion after compression",
  },
  DIVERGENCE: {
    label: "Divergence",
    shortLabel: "DIV",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    icon: "↗️",
    description: "Price/indicator divergence signal",
  },
  SUPPORT_BOUNCE: {
    label: "Support Bounce",
    shortLabel: "SUP",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: "⬆️",
    description: "Price bouncing off support level",
  },
  RESISTANCE_REJECTION: {
    label: "Resistance Rejection",
    shortLabel: "RES",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    icon: "⬇️",
    description: "Price rejected at resistance level",
  },
  CUSTOM: {
    label: "Custom",
    shortLabel: "CUS",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    icon: "⚙️",
    description: "Custom setup type",
  },
  // KCU LTP Strategy Types
  KCU_EMA_BOUNCE: {
    label: "KCU EMA Bounce",
    shortLabel: "EMA",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "📊",
    description: "KCU LTP EMA bounce setup",
  },
  KCU_VWAP_STANDARD: {
    label: "KCU VWAP Standard",
    shortLabel: "VWAP",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "📏",
    description: "KCU LTP Standard VWAP setup",
  },
  KCU_VWAP_ADVANCED: {
    label: "KCU VWAP Advanced",
    shortLabel: "ADV",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "🎯",
    description: "KCU LTP Advanced VWAP setup",
  },
  KCU_KING_QUEEN: {
    label: "KCU King/Queen",
    shortLabel: "K/Q",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "👑",
    description: "KCU LTP King/Queen strategy",
  },
  KCU_ORB_BREAKOUT: {
    label: "KCU ORB Breakout",
    shortLabel: "ORB",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "🚀",
    description: "KCU LTP Opening Range Breakout",
  },
  KCU_CLOUD_BOUNCE: {
    label: "KCU Cloud Bounce",
    shortLabel: "CLD",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "☁️",
    description: "KCU LTP Cloud bounce setup",
  },
};

export function HDSetupTypeBadge({ setupType, size = "md", className }: HDSetupTypeBadgeProps) {
  const config = SETUP_CONFIG[setupType] || SETUP_CONFIG.CUSTOM;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius)] border font-medium",
        config.bgColor,
        config.borderColor,
        config.color,
        sizeClasses[size],
        className
      )}
      title={config.description}
    >
      <span>{config.icon}</span>
      <span>{size === "sm" ? config.shortLabel : config.label}</span>
    </span>
  );
}

/**
 * Compact badge for trade rows
 */
export function HDSetupTypeBadgeCompact({
  setupType,
  className,
}: {
  setupType: SetupType;
  className?: string;
}) {
  return <HDSetupTypeBadge setupType={setupType} size="sm" className={className} />;
}

/**
 * Get setup type from opportunity type string
 * Maps CompositeScanner opportunity types to SetupType
 */
export function mapOpportunityToSetupType(opportunityType: string): SetupType {
  const mapping: Record<string, SetupType> = {
    // Direct mappings
    BREAKOUT: "BREAKOUT",
    REVERSAL: "REVERSAL",
    MOMENTUM: "MOMENTUM",
    MOMENTUM_CONTINUATION: "MOMENTUM",
    BREAK_AND_RETEST: "BREAK_AND_RETEST",
    TREND_CONTINUATION: "TREND_CONTINUATION",
    RANGE_FADE: "RANGE_FADE",
    VWAP_BOUNCE: "VWAP_BOUNCE",
    GAP_FILL: "GAP_FILL",
    SQUEEZE_BREAKOUT: "SQUEEZE_BREAKOUT",
    SQUEEZE: "SQUEEZE_BREAKOUT",
    DIVERGENCE: "DIVERGENCE",
    SUPPORT_BOUNCE: "SUPPORT_BOUNCE",
    RESISTANCE_REJECTION: "RESISTANCE_REJECTION",
    // Variations
    SUPPORT: "SUPPORT_BOUNCE",
    RESISTANCE: "RESISTANCE_REJECTION",
    BOUNCE: "SUPPORT_BOUNCE",
    FADE: "RANGE_FADE",
    CONTINUATION: "TREND_CONTINUATION",
    VWAP: "VWAP_BOUNCE",
  };

  return mapping[opportunityType.toUpperCase()] || "CUSTOM";
}
