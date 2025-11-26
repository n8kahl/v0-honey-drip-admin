/**
 * HDTimeDecayWarning - Time-based warnings for DTE and theta decay
 *
 * Shows contextual warnings based on:
 * - DTE urgency (0DTE, 1DTE, etc.)
 * - Time of day (approaching close)
 * - Theta acceleration
 * - Session timing guidance
 */

import { cn } from "../../../lib/utils";
import { Clock, AlertTriangle, Timer, Sun, Sunset, Moon } from "lucide-react";
import type { Contract } from "../../../types";

interface HDTimeDecayWarningProps {
  contract: Contract;
  className?: string;
  compact?: boolean;
}

interface TimeContext {
  session:
    | "pre_market"
    | "opening_drive"
    | "morning_momentum"
    | "lunch_chop"
    | "afternoon"
    | "power_hour"
    | "after_hours";
  sessionLabel: string;
  minutesToClose: number;
  hoursToClose: number;
  isNearClose: boolean;
  sessionIcon: React.ReactNode;
  guidance: string;
}

function getTimeContext(): TimeContext {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM - 4:00 PM ET (in minutes: 570 - 960)
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const minutesToClose = Math.max(0, marketClose - totalMinutes);
  const hoursToClose = Math.floor(minutesToClose / 60);
  const isNearClose = minutesToClose <= 60;

  let session: TimeContext["session"];
  let sessionLabel: string;
  let sessionIcon: React.ReactNode;
  let guidance: string;

  if (totalMinutes < marketOpen) {
    session = "pre_market";
    sessionLabel = "Pre-Market";
    sessionIcon = <Moon className="w-3.5 h-3.5" />;
    guidance = "Wait for market open for better fills and liquidity";
  } else if (totalMinutes < marketOpen + 30) {
    session = "opening_drive";
    sessionLabel = "Opening Drive";
    sessionIcon = <Sun className="w-3.5 h-3.5" />;
    guidance = "High volatility window - best for momentum plays";
  } else if (totalMinutes < 11 * 60 + 30) {
    session = "morning_momentum";
    sessionLabel = "Morning Momentum";
    sessionIcon = <Sun className="w-3.5 h-3.5" />;
    guidance = "Good liquidity and follow-through on trends";
  } else if (totalMinutes < 14 * 60) {
    session = "lunch_chop";
    sessionLabel = "Lunch Chop";
    sessionIcon = <Timer className="w-3.5 h-3.5" />;
    guidance = "Lower volume, choppy action - be patient";
  } else if (totalMinutes < 15 * 60) {
    session = "afternoon";
    sessionLabel = "Afternoon Session";
    sessionIcon = <Sunset className="w-3.5 h-3.5" />;
    guidance = "Volume returning - watch for trend continuation";
  } else if (totalMinutes < marketClose) {
    session = "power_hour";
    sessionLabel = "Power Hour";
    sessionIcon = <Sunset className="w-3.5 h-3.5" />;
    guidance = "High volume, potential for strong moves - watch theta!";
  } else {
    session = "after_hours";
    sessionLabel = "After Hours";
    sessionIcon = <Moon className="w-3.5 h-3.5" />;
    guidance = "Reduced liquidity - wider spreads expected";
  }

  return {
    session,
    sessionLabel,
    minutesToClose,
    hoursToClose,
    isNearClose,
    sessionIcon,
    guidance,
  };
}

interface DTEContext {
  dte: number;
  urgency: "critical" | "high" | "moderate" | "low";
  thetaMultiplier: number;
  warning: string;
  advice: string;
}

function getDTEContext(contract: Contract): DTEContext {
  const dte = contract.daysToExpiry ?? 0;
  const timeContext = getTimeContext();
  const theta = Math.abs(contract.theta ?? 0);

  let urgency: DTEContext["urgency"];
  let thetaMultiplier: number;
  let warning: string;
  let advice: string;

  if (dte === 0) {
    // 0DTE - Most critical
    if (timeContext.minutesToClose <= 60) {
      urgency = "critical";
      thetaMultiplier = 4.0;
      warning = "FINAL HOUR: Extreme theta decay";
      advice = "Close or trail stop tight. Every minute costs premium.";
    } else if (timeContext.minutesToClose <= 120) {
      urgency = "critical";
      thetaMultiplier = 3.0;
      warning = "0DTE: Accelerated decay active";
      advice = "Take profits aggressively. Theta eating premium fast.";
    } else {
      urgency = "high";
      thetaMultiplier = 2.0;
      warning = "0DTE: Same-day expiration";
      advice = "Quick scalps only. Set tight stops and targets.";
    }
  } else if (dte === 1) {
    if (timeContext.session === "power_hour" || timeContext.session === "afternoon") {
      urgency = "high";
      thetaMultiplier = 1.8;
      warning = "1DTE: Tomorrow expiration";
      advice = "Consider closing before EOD to avoid overnight theta.";
    } else {
      urgency = "moderate";
      thetaMultiplier = 1.5;
      warning = "1DTE: Short-term contract";
      advice = "Watch for overnight holds if market close approaches.";
    }
  } else if (dte <= 3) {
    urgency = "moderate";
    thetaMultiplier = 1.2;
    warning = `${dte}DTE: Elevated theta`;
    advice = "Active management required. Theta visible on daily.";
  } else if (dte <= 7) {
    urgency = "low";
    thetaMultiplier = 1.0;
    warning = `${dte}DTE: Standard decay`;
    advice = "Normal theta profile. Focus on delta/direction.";
  } else {
    urgency = "low";
    thetaMultiplier = 0.8;
    warning = `${dte}DTE: Longer-dated`;
    advice = "Theta less urgent. More time for thesis to play out.";
  }

  return {
    dte,
    urgency,
    thetaMultiplier,
    warning,
    advice,
  };
}

export function HDTimeDecayWarning({
  contract,
  className,
  compact = false,
}: HDTimeDecayWarningProps) {
  const timeContext = getTimeContext();
  const dteContext = getDTEContext(contract);

  const isUrgent = dteContext.urgency === "critical" || dteContext.urgency === "high";

  if (compact) {
    // Compact mode - single line with icon
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius)] border text-[10px]",
          isUrgent
            ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30 text-[var(--accent-negative)]"
            : "bg-amber-500/10 border-amber-500/30 text-amber-400",
          className
        )}
      >
        <Clock className="w-3 h-3" />
        <span>{dteContext.dte}DTE</span>
        {timeContext.isNearClose && <span>• {timeContext.minutesToClose}m to close</span>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Time Analysis
        </h4>
        <div
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
            isUrgent
              ? "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
              : "bg-amber-500/10 text-amber-400"
          )}
        >
          {timeContext.sessionIcon}
          <span>{timeContext.sessionLabel}</span>
        </div>
      </div>

      {/* DTE Warning */}
      <div
        className={cn(
          "p-2.5 rounded-[var(--radius)] border",
          dteContext.urgency === "critical"
            ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30"
            : dteContext.urgency === "high"
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-[var(--surface-2)] border-[var(--border-hairline)]"
        )}
      >
        <div className="flex items-start gap-2">
          {isUrgent && (
            <AlertTriangle
              className={cn(
                "w-4 h-4 flex-shrink-0 mt-0.5",
                dteContext.urgency === "critical"
                  ? "text-[var(--accent-negative)]"
                  : "text-amber-400"
              )}
            />
          )}
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-xs font-medium",
                dteContext.urgency === "critical"
                  ? "text-[var(--accent-negative)]"
                  : dteContext.urgency === "high"
                    ? "text-amber-400"
                    : "text-[var(--text-high)]"
              )}
            >
              {dteContext.warning}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{dteContext.advice}</p>
          </div>
          <div className="flex flex-col items-end text-right">
            <div
              className={cn(
                "text-lg font-bold tabular-nums",
                dteContext.urgency === "critical"
                  ? "text-[var(--accent-negative)]"
                  : dteContext.urgency === "high"
                    ? "text-amber-400"
                    : "text-[var(--text-high)]"
              )}
            >
              {dteContext.dte}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase">DTE</div>
          </div>
        </div>
      </div>

      {/* Session Timing */}
      <div className="p-2.5 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Market Session</span>
          {timeContext.minutesToClose > 0 && timeContext.session !== "after_hours" && (
            <span
              className={cn(
                "text-[10px] font-medium",
                timeContext.isNearClose
                  ? "text-[var(--accent-negative)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              {timeContext.hoursToClose > 0 ? `${timeContext.hoursToClose}h ` : ""}
              {timeContext.minutesToClose % 60}m to close
            </span>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-med)]">{timeContext.guidance}</p>
      </div>

      {/* Theta Impact (if critical) */}
      {dteContext.urgency === "critical" && contract.theta && (
        <div className="p-2.5 bg-[var(--accent-negative)]/10 rounded-[var(--radius)] border border-[var(--accent-negative)]/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Theta Impact</span>
            <span className="text-xs font-medium text-[var(--accent-negative)]">
              {dteContext.thetaMultiplier}x accelerated
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-[var(--accent-negative)] tabular-nums">
              ${Math.abs(contract.theta * dteContext.thetaMultiplier).toFixed(3)}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              per contract per hour (estimated)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
