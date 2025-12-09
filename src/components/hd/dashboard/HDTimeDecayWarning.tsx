/**
 * HDTimeDecayWarning - Time-based DTE and theta warnings
 *
 * Compact display: DTE chip + 1-liner + optional theta chip
 * Full details (theta impact, events) behind toggle.
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "../../../lib/utils";
import { ChevronDown, ChevronUp, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { DTEChip, ThetaChip } from "../common/StatusChip";
import type { Contract } from "../../../types";

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

interface HDTimeDecayWarningProps {
  contract: Contract;
  ticker?: string;
  className?: string;
  compact?: boolean;
  defaultExpanded?: boolean;
}

// DTE one-liners
const DTE_ONELINERS: Record<string, string> = {
  "0": "Rapid decay, tight stops",
  "1": "Decay accelerating",
  "2-3": "Manage overnight risk",
  "4-7": "Normal theta",
  "8+": "Low decay, can hold",
};

function getDTEOneLiner(dte: number): string {
  if (dte === 0) return DTE_ONELINERS["0"];
  if (dte === 1) return DTE_ONELINERS["1"];
  if (dte <= 3) return DTE_ONELINERS["2-3"];
  if (dte <= 7) return DTE_ONELINERS["4-7"];
  return DTE_ONELINERS["8+"];
}

function getDTEDetails(dte: number, theta: number | undefined): string {
  if (dte === 0) {
    return "Theta eating premium every minute. Quick scalps only - take profits fast, cut losses faster.";
  }
  if (dte === 1) {
    return "Consider closing before EOD to avoid overnight theta decay. Set clear exit rules.";
  }
  if (dte <= 3) {
    return "Elevated theta visible on daily P&L. Active management required.";
  }
  if (dte <= 7) {
    return "Standard decay profile. Focus on delta/direction over theta concerns.";
  }
  return "Theta less urgent. More time for thesis to play out. Watch vega more than theta.";
}

function calculateThetaPerHour(theta: number | undefined, dte: number): number | null {
  if (!theta) return null;
  // Theta accelerates as DTE decreases
  const multiplier = dte === 0 ? 3.0 : dte === 1 ? 1.8 : dte <= 3 ? 1.2 : 1.0;
  return Math.abs(theta * multiplier) / 6.5; // 6.5 hours in trading day
}

export function HDTimeDecayWarning({
  contract,
  ticker,
  className,
  compact = false,
  defaultExpanded = false,
}: HDTimeDecayWarningProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const dte = contract.daysToExpiry ?? 0;
  const thetaPerHour = calculateThetaPerHour(contract.theta, dte);
  const oneLiner = getDTEOneLiner(dte);
  const details = getDTEDetails(dte, contract.theta);
  const isUrgent = dte <= 1;

  // Fetch economic events
  const fetchEvents = useCallback(async () => {
    if (!expanded) return;
    try {
      setEventsLoading(true);
      const response = await fetch("/api/calendar/events?impact=CRITICAL,HIGH");
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.events) return;

      const now = new Date();
      const expiryDate = new Date(now.getTime() + dte * 24 * 60 * 60 * 1000);

      const relevantEvents = (data.events as EconomicEvent[])
        .filter((event) => {
          const eventDate = new Date(event.datetime);
          return eventDate > now && eventDate < expiryDate;
        })
        .slice(0, 3);

      setEvents(relevantEvents);
    } catch {
      // Silent fail
    } finally {
      setEventsLoading(false);
    }
  }, [expanded, dte]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Mobile/compact: just DTE chip
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <DTEChip dte={dte} />
        {thetaPerHour !== null && thetaPerHour > 0.05 && (
          <ThetaChip value={thetaPerHour} />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Chips + 1-liner */}
      <div className="flex items-center gap-2">
        <DTEChip dte={dte} />
        {thetaPerHour !== null && thetaPerHour > 0.03 && (
          <ThetaChip value={thetaPerHour} />
        )}
        <span className={cn(
          "text-xs truncate",
          isUrgent ? "text-[var(--accent-negative)]" : "text-[var(--text-muted)]"
        )}>
          {oneLiner}
        </span>

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

          {/* Theta impact for urgent DTEs */}
          {isUrgent && thetaPerHour !== null && (
            <div className={cn(
              "px-2 py-1.5 rounded text-[11px]",
              "bg-[var(--accent-negative)]/10"
            )}>
              <span className="text-[var(--accent-negative)] font-medium">
                Theta: -${thetaPerHour.toFixed(3)}/hr
              </span>
              <span className="text-[var(--text-muted)]"> per contract (estimated)</span>
            </div>
          )}

          {/* Economic events */}
          {(events.length > 0 || eventsLoading) && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                <Calendar className="w-3 h-3" />
                <span>Events before expiry</span>
              </div>

              {eventsLoading ? (
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-1">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-1.5 text-[10px]"
                    >
                      <AlertTriangle className={cn(
                        "w-3 h-3",
                        event.impact === "CRITICAL" ? "text-red-400" : "text-amber-400"
                      )} />
                      <span className="text-[var(--text-muted)] truncate">{event.name}</span>
                      <span className={cn(
                        "shrink-0 px-1 py-0.5 rounded text-[8px] font-medium uppercase",
                        event.impact === "CRITICAL"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                      )}>
                        {event.impact}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
