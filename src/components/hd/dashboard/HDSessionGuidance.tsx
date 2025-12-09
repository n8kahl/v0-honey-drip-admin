/**
 * HDSessionGuidance - Smart session-aware trading guidance
 *
 * Compact display: Session chip + 1-liner summary
 * Full guidance available behind toggle.
 */

import { useState } from "react";
import { cn } from "../../../lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SessionChip } from "../common/StatusChip";
import type { Contract } from "../../../types";

interface HDSessionGuidanceProps {
  ticker: string;
  direction: "call" | "put";
  contract?: Contract;
  tradeType?: "Scalp" | "Day" | "Swing";
  className?: string;
  compact?: boolean;
  defaultExpanded?: boolean;
}

type MarketSession =
  | "PRE"
  | "OPEN_DRIVE"
  | "MORNING"
  | "LUNCH"
  | "AFTERNOON"
  | "POWER_HOUR"
  | "AFTER_HOURS";

interface SessionInfo {
  session: MarketSession;
  minutesToClose: number;
}

// Session one-liners (max 40 chars)
const SESSION_ONELINERS: Record<MarketSession, string> = {
  PRE: "Set levels, wait for open",
  OPEN_DRIVE: "Wide spreads, fast action",
  MORNING: "Good liquidity, trends run",
  LUNCH: "Low vol, high fakeouts",
  AFTERNOON: "Moderate activity",
  POWER_HOUR: "Volume spike, watch reversals",
  AFTER_HOURS: "Review only, no trades",
};

// Full guidance text
const SESSION_DETAILS: Record<MarketSession, string> = {
  PRE: "Review news catalysts, set key levels. Spreads are wide - wait for the opening bell for better fills.",
  OPEN_DRIVE: "First 30 minutes are volatile with widest spreads. Use smaller size, quick decisions. Prime scalping window.",
  MORNING: "Liquidity is strong, trends tend to continue. Look for pullback entries with proper stops.",
  LUNCH: "Volume drops, price action gets noisy. False breakouts are common. Consider sitting out or use wide stops.",
  AFTERNOON: "Volume returning. Watch for continuation of morning trends or new setups forming.",
  POWER_HOUR: "Strong moves possible. Theta accelerating for short-dated options. Take profits into close.",
  AFTER_HOURS: "Market closed. Options don't trade AH. Review positions and plan for tomorrow.",
};

function getCurrentSession(): SessionInfo {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const minutesToClose = Math.max(0, marketClose - totalMinutes);

  let session: MarketSession;

  if (totalMinutes < marketOpen) {
    session = "PRE";
  } else if (totalMinutes < marketOpen + 30) {
    session = "OPEN_DRIVE";
  } else if (totalMinutes < 11 * 60 + 30) {
    session = "MORNING";
  } else if (totalMinutes < 14 * 60) {
    session = "LUNCH";
  } else if (totalMinutes < 15 * 60) {
    session = "AFTERNOON";
  } else if (totalMinutes < marketClose) {
    session = "POWER_HOUR";
  } else {
    session = "AFTER_HOURS";
  }

  return { session, minutesToClose };
}

function getContextHints(
  session: MarketSession,
  dte: number,
  tradeType: string,
  direction: "call" | "put"
): string[] {
  const hints: string[] = [];

  // DTE hints
  if (dte === 0) {
    hints.push("0DTE: Quick scalps only, cut losses fast");
  } else if (dte === 1 && (session === "AFTERNOON" || session === "POWER_HOUR")) {
    hints.push("1DTE: Consider closing before EOD");
  }

  // Style hints
  if (tradeType === "Scalp" && session === "LUNCH") {
    hints.push("Scalp style: Consider sitting out lunch chop");
  }
  if (tradeType === "Swing" && dte < 7) {
    hints.push("Swing: Short DTE, consider longer expiry");
  }

  return hints;
}

export function HDSessionGuidance({
  ticker,
  direction,
  contract,
  tradeType = "Day",
  className,
  compact = false,
  defaultExpanded = false,
}: HDSessionGuidanceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { session, minutesToClose } = getCurrentSession();
  const dte = contract?.daysToExpiry ?? 0;
  const oneLiner = SESSION_ONELINERS[session];
  const details = SESSION_DETAILS[session];
  const hints = getContextHints(session, dte, tradeType, direction);

  // Mobile/compact: just chip
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <SessionChip session={session} />
        {session === "POWER_HOUR" && minutesToClose > 0 && (
          <span className="text-[10px] text-[var(--text-faint)] tabular-nums">
            {minutesToClose}m left
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Chip + 1-liner */}
      <div className="flex items-center gap-2">
        <SessionChip session={session} />
        <span className="text-xs text-[var(--text-muted)] truncate">{oneLiner}</span>

        {/* Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto flex items-center text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="pt-1.5 border-t border-[var(--border-hairline)] animate-fade-in-up space-y-2">
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{details}</p>

          {/* Context hints */}
          {hints.length > 0 && (
            <div className="space-y-1">
              {hints.map((hint, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[10px] text-[var(--data-stale)]"
                >
                  <span className="shrink-0">•</span>
                  <span>{hint}</span>
                </div>
              ))}
            </div>
          )}

          {/* Time to close */}
          {session !== "PRE" && session !== "AFTER_HOURS" && (
            <div className="text-[10px] text-[var(--text-faint)] tabular-nums">
              {minutesToClose > 60
                ? `${Math.floor(minutesToClose / 60)}h ${minutesToClose % 60}m to close`
                : `${minutesToClose}m to close`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
