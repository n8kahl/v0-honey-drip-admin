/**
 * TimeDecayThetaTile - Contract-aware theta/DTE context tile
 *
 * Default view: DTE chip + theta chip + 1-liner risk label
 * Expanded view: Detailed theta impact + economic events before expiry
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "../../../lib/utils";
import { Clock, ChevronDown, ChevronUp, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { DTEChip, ThetaChip } from "../common/StatusChip";
import type { Contract } from "../../../types";

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

interface TimeDecayThetaTileProps {
  contract: Contract | null;
  recommendedContract?: Contract | null;
  ticker?: string;
  className?: string;
  defaultExpanded?: boolean;
}

// DTE risk labels
const DTE_RISK_LABELS: Record<string, { label: string; risk: "HIGH" | "MEDIUM" | "LOW" }> = {
  "0": { label: "Rapid decay, tight stops", risk: "HIGH" },
  "1": { label: "Decay accelerating", risk: "HIGH" },
  "2-3": { label: "Manage overnight risk", risk: "MEDIUM" },
  "4-7": { label: "Normal theta", risk: "LOW" },
  "8+": { label: "Low decay, can hold", risk: "LOW" },
};

function getDTERisk(dte: number): { label: string; risk: "HIGH" | "MEDIUM" | "LOW" } {
  if (dte === 0) return DTE_RISK_LABELS["0"];
  if (dte === 1) return DTE_RISK_LABELS["1"];
  if (dte <= 3) return DTE_RISK_LABELS["2-3"];
  if (dte <= 7) return DTE_RISK_LABELS["4-7"];
  return DTE_RISK_LABELS["8+"];
}

function getDTEDetails(dte: number): string {
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

export function TimeDecayThetaTile({
  contract,
  recommendedContract,
  ticker,
  className,
  defaultExpanded = false,
}: TimeDecayThetaTileProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Use provided contract or fall back to recommended
  const activeContract = contract || recommendedContract;

  const dte = activeContract?.daysToExpiry ?? 0;
  const thetaPerHour = calculateThetaPerHour(activeContract?.theta, dte);
  const dteRisk = getDTERisk(dte);
  const details = getDTEDetails(dte);

  // Fetch economic events before expiry
  const fetchEvents = useCallback(async () => {
    if (!expanded || !activeContract) return;
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
  }, [expanded, dte, activeContract]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // No contract state
  if (!activeContract) {
    return (
      <div
        className={cn(
          "p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Time Decay
          </span>
        </div>
        <div className="text-xs text-[var(--text-faint)]">
          Select contract for details
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Time Decay
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Compact View: DTE + Theta + Risk */}
      <div className="flex items-center gap-2 flex-wrap">
        <DTEChip dte={dte} />
        {thetaPerHour !== null && thetaPerHour > 0.03 && (
          <ThetaChip value={thetaPerHour} />
        )}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            dteRisk.risk === "HIGH" && "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]",
            dteRisk.risk === "MEDIUM" && "bg-yellow-500/10 text-yellow-500",
            dteRisk.risk === "LOW" && "bg-[var(--surface-3)] text-[var(--text-muted)]"
          )}
        >
          {dteRisk.risk}
        </span>
      </div>

      {/* One-liner */}
      <p
        className={cn(
          "mt-1.5 text-[11px] leading-relaxed",
          dte <= 1 ? "text-[var(--accent-negative)]" : "text-[var(--text-muted)]"
        )}
      >
        "{dteRisk.label}"
      </p>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] space-y-2 animate-fade-in-up">
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{details}</p>

          {/* Theta impact for urgent DTEs */}
          {dte <= 1 && thetaPerHour !== null && (
            <div className="px-2 py-1.5 rounded bg-[var(--accent-negative)]/10">
              <span className="text-[11px] text-[var(--accent-negative)] font-medium">
                Theta: -${thetaPerHour.toFixed(3)}/hr
              </span>
              <span className="text-[11px] text-[var(--text-muted)]"> per contract (estimated)</span>
            </div>
          )}

          {/* Economic events before expiry */}
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
                    <div key={event.id} className="flex items-center gap-1.5 text-[10px]">
                      <AlertTriangle
                        className={cn(
                          "w-3 h-3",
                          event.impact === "CRITICAL" ? "text-[var(--accent-negative)]" : "text-amber-400"
                        )}
                      />
                      <span className="text-[var(--text-muted)] truncate">{event.name}</span>
                      <span
                        className={cn(
                          "shrink-0 px-1 py-0.5 rounded text-[8px] font-medium uppercase",
                          event.impact === "CRITICAL"
                            ? "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
                            : "bg-amber-500/10 text-amber-400"
                        )}
                      >
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

export default TimeDecayThetaTile;
