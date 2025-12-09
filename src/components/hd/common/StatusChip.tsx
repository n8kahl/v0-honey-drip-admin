/**
 * StatusChip - Compact status indicator chip
 *
 * Used for entry checklist conditions, session status, DTE warnings.
 * Three states: pass (green), warn (yellow), fail (red), neutral (gray).
 */

import { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { Check, AlertTriangle, X } from "lucide-react";

export type StatusChipStatus = "pass" | "warn" | "fail" | "neutral";

interface StatusChipProps {
  label: string;
  status: StatusChipStatus;
  icon?: ReactNode;
  showIcon?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

const statusStyles: Record<StatusChipStatus, string> = {
  pass: "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)] border-[var(--accent-positive)]/20",
  warn: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  fail: "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)] border-[var(--accent-negative)]/20",
  neutral: "bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border-hairline)]",
};

const defaultIcons: Record<StatusChipStatus, ReactNode> = {
  pass: <Check className="w-2.5 h-2.5" />,
  warn: <AlertTriangle className="w-2.5 h-2.5" />,
  fail: <X className="w-2.5 h-2.5" />,
  neutral: null,
};

/**
 * StatusChip - Compact status indicator
 *
 * @param label - Short label (e.g., "Trend", "VWAP", "Vol")
 * @param status - pass | warn | fail | neutral
 * @param icon - Custom icon (overrides default status icon)
 * @param showIcon - Whether to show icon (default: true for non-neutral)
 * @param size - xs (micro) or sm (default)
 */
export function StatusChip({
  label,
  status,
  icon,
  showIcon = status !== "neutral",
  size = "sm",
  className,
}: StatusChipProps) {
  const statusIcon = icon ?? defaultIcons[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-medium",
        size === "xs" && "px-1.5 py-0.5 text-[10px]",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        statusStyles[status],
        className
      )}
    >
      {showIcon && statusIcon}
      {label}
    </span>
  );
}

// ============================================================================
// Specialized Chips
// ============================================================================

interface SessionChipProps {
  session: string;
  className?: string;
}

const sessionColors: Record<string, { bg: string; text: string }> = {
  PRE: { bg: "bg-blue-500/10", text: "text-blue-400" },
  OPEN_DRIVE: { bg: "bg-orange-500/10", text: "text-orange-400" },
  MORNING: { bg: "bg-[var(--accent-positive)]/10", text: "text-[var(--accent-positive)]" },
  LUNCH: { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  AFTERNOON: { bg: "bg-[var(--brand-primary)]/10", text: "text-[var(--brand-primary)]" },
  POWER_HOUR: { bg: "bg-purple-500/10", text: "text-purple-400" },
  AFTER_HOURS: { bg: "bg-[var(--surface-3)]", text: "text-[var(--text-muted)]" },
};

const sessionLabels: Record<string, string> = {
  PRE: "Pre-Market",
  OPEN_DRIVE: "Opening Drive",
  MORNING: "Morning",
  LUNCH: "Lunch Chop",
  AFTERNOON: "Afternoon",
  POWER_HOUR: "Power Hour",
  AFTER_HOURS: "After Hours",
};

/**
 * SessionChip - Session-specific styling
 */
export function SessionChip({ session, className }: SessionChipProps) {
  const colors = sessionColors[session] || sessionColors.MORNING;
  const label = sessionLabels[session] || session;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
        colors.bg,
        colors.text,
        className
      )}
    >
      {label}
    </span>
  );
}

interface DTEChipProps {
  dte: number;
  className?: string;
}

/**
 * DTEChip - Days to expiration with urgency coloring
 */
export function DTEChip({ dte, className }: DTEChipProps) {
  let urgency: StatusChipStatus = "neutral";
  if (dte === 0) urgency = "fail";
  else if (dte === 1) urgency = "warn";
  else if (dte <= 3) urgency = "warn";
  else if (dte >= 8) urgency = "pass";

  const label = dte === 0 ? "0DTE" : `${dte}DTE`;

  return (
    <StatusChip
      label={label}
      status={urgency}
      showIcon={false}
      size="xs"
      className={className}
    />
  );
}

interface TargetChipProps {
  level: "T1" | "T2" | "T3" | "SL";
  price?: number;
  pct?: number;
  hit?: boolean;
  className?: string;
}

/**
 * TargetChip - Profit target or stop loss chip
 */
export function TargetChip({ level, price, pct, hit, className }: TargetChipProps) {
  const isStop = level === "SL";
  const baseStyle = isStop
    ? "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)] border-[var(--accent-negative)]/20"
    : hit
    ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border-[var(--accent-positive)]/30"
    : "bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border-hairline)]";

  const priceStr = price != null ? `$${price.toFixed(2)}` : "";
  const pctStr = pct != null ? `(${pct > 0 ? "+" : ""}${pct}%)` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium tabular-nums",
        baseStyle,
        hit && "ring-1 ring-[var(--accent-positive)]/30",
        className
      )}
    >
      <span className="font-semibold">{level}</span>
      {priceStr && <span>{priceStr}</span>}
      {pctStr && <span className="text-[10px] opacity-75">{pctStr}</span>}
    </span>
  );
}

interface ThetaChipProps {
  value: number; // Theta per hour (negative)
  className?: string;
}

/**
 * ThetaChip - Time decay indicator
 */
export function ThetaChip({ value, className }: ThetaChipProps) {
  const absValue = Math.abs(value);
  let urgency: StatusChipStatus = "neutral";
  if (absValue >= 0.1) urgency = "fail";
  else if (absValue >= 0.05) urgency = "warn";

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums",
        statusStyles[urgency],
        className
      )}
    >
      θ: -${absValue.toFixed(2)}/hr
    </span>
  );
}

export default StatusChip;
