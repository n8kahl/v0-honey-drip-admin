/**
 * HDEconomicEventWarning - Shows warnings for upcoming economic events
 *
 * Displays alerts for high-impact events that could affect options trades
 */

import { cn } from "../../../lib/utils";
import { AlertTriangle, Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";

interface EconomicEvent {
  id: string;
  name: string;
  time: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  actual?: string;
  forecast?: string;
  previous?: string;
}

interface HDEconomicEventWarningProps {
  ticker?: string;
  className?: string;
  compact?: boolean;
}

// Map of tickers to relevant economic events
const TICKER_EVENT_RELEVANCE: Record<string, string[]> = {
  SPY: ["FOMC", "CPI", "NFP", "GDP", "Retail Sales", "ISM"],
  SPX: ["FOMC", "CPI", "NFP", "GDP", "Retail Sales", "ISM"],
  QQQ: ["FOMC", "CPI", "NFP", "GDP", "Tech Earnings"],
  NDX: ["FOMC", "CPI", "NFP", "GDP", "Tech Earnings"],
  IWM: ["FOMC", "CPI", "NFP", "GDP", "ISM Manufacturing"],
  DIA: ["FOMC", "CPI", "NFP", "GDP", "ISM"],
  AAPL: ["Tech Earnings", "FOMC", "CPI"],
  MSFT: ["Tech Earnings", "FOMC", "CPI"],
  NVDA: ["Tech Earnings", "FOMC", "CPI"],
  TSLA: ["EV Sales", "FOMC", "CPI"],
  AMZN: ["Retail Sales", "Tech Earnings", "FOMC"],
  META: ["Tech Earnings", "FOMC", "CPI"],
  GOOGL: ["Tech Earnings", "FOMC", "CPI"],
};

// Known high-impact events (simplified - in production this would come from API)
const KNOWN_EVENTS: EconomicEvent[] = [
  {
    id: "fomc",
    name: "FOMC Rate Decision",
    time: getNextFOMCTime(),
    impact: "CRITICAL",
  },
  {
    id: "cpi",
    name: "CPI Report",
    time: getNextCPITime(),
    impact: "CRITICAL",
  },
  {
    id: "nfp",
    name: "Non-Farm Payrolls",
    time: getNextNFPTime(),
    impact: "CRITICAL",
  },
];

function getNextFOMCTime(): string {
  // FOMC typically meets 8 times per year
  // This is a simplified placeholder - in production, use actual calendar
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15, 14, 0);
  return nextMonth.toISOString();
}

function getNextCPITime(): string {
  // CPI typically released around 13th of each month at 8:30 AM ET
  const now = new Date();
  const thisMonth13th = new Date(now.getFullYear(), now.getMonth(), 13, 8, 30);
  if (thisMonth13th > now) {
    return thisMonth13th.toISOString();
  }
  const nextMonth13th = new Date(now.getFullYear(), now.getMonth() + 1, 13, 8, 30);
  return nextMonth13th.toISOString();
}

function getNextNFPTime(): string {
  // NFP typically released first Friday of each month at 8:30 AM ET
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Find first Friday
  let firstFriday = new Date(year, month, 1, 8, 30);
  while (firstFriday.getDay() !== 5) {
    firstFriday.setDate(firstFriday.getDate() + 1);
  }

  if (firstFriday > now) {
    return firstFriday.toISOString();
  }

  // Get next month's first Friday
  firstFriday = new Date(year, month + 1, 1, 8, 30);
  while (firstFriday.getDay() !== 5) {
    firstFriday.setDate(firstFriday.getDate() + 1);
  }
  return firstFriday.toISOString();
}

function getTimeUntil(eventTime: string): {
  hours: number;
  minutes: number;
  isImminent: boolean;
  isSoon: boolean;
} {
  const now = new Date();
  const event = new Date(eventTime);
  const diffMs = event.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    hours,
    minutes,
    isImminent: hours < 1 && minutes > 0, // Less than 1 hour away
    isSoon: hours < 24 && hours >= 1, // Less than 24 hours away
  };
}

export function HDEconomicEventWarning({
  ticker,
  className,
  compact = false,
}: HDEconomicEventWarningProps) {
  const [events, setEvents] = useState<
    Array<EconomicEvent & { timeUntil: ReturnType<typeof getTimeUntil> }>
  >([]);

  useEffect(() => {
    // Filter events relevant to this ticker
    const relevantEventNames = ticker ? TICKER_EVENT_RELEVANCE[ticker] || [] : [];

    const now = new Date();
    const upcoming = KNOWN_EVENTS.filter((event) => {
      const eventDate = new Date(event.time);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Show events within next 48 hours
      if (hoursUntil < 0 || hoursUntil > 48) return false;

      // If ticker specified, filter by relevance
      if (ticker && relevantEventNames.length > 0) {
        return relevantEventNames.some(
          (name) =>
            event.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(event.name.split(" ")[0].toLowerCase())
        );
      }

      // Show all critical/high impact events
      return event.impact === "CRITICAL" || event.impact === "HIGH";
    })
      .map((event) => ({
        ...event,
        timeUntil: getTimeUntil(event.time),
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    setEvents(upcoming);
  }, [ticker]);

  if (events.length === 0) {
    return null;
  }

  const nextEvent = events[0];
  const isWarning =
    nextEvent.timeUntil.isImminent ||
    (nextEvent.timeUntil.isSoon && nextEvent.impact === "CRITICAL");

  if (compact) {
    // Compact mode - single line warning
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius)] border text-[10px]",
          isWarning
            ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30 text-[var(--accent-negative)]"
            : "bg-amber-500/10 border-amber-500/30 text-amber-400",
          className
        )}
      >
        <AlertTriangle className="w-3 h-3" />
        <span>{nextEvent.name}</span>
        <span className="opacity-75">
          {nextEvent.timeUntil.isImminent
            ? `${nextEvent.timeUntil.minutes}m`
            : `${nextEvent.timeUntil.hours}h`}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-high)] font-semibold uppercase tracking-wide">
        <Calendar className="w-3.5 h-3.5" />
        <span>Economic Calendar</span>
      </div>

      {/* Event List */}
      <div className="space-y-1.5">
        {events.map((event) => {
          const isEventWarning =
            event.timeUntil.isImminent || (event.timeUntil.isSoon && event.impact === "CRITICAL");

          return (
            <div
              key={event.id}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius)] border",
                isEventWarning
                  ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/20"
                  : event.impact === "CRITICAL"
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-[var(--surface-2)] border-[var(--border-hairline)]"
              )}
            >
              <AlertTriangle
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isEventWarning ? "text-[var(--accent-negative)]" : "text-amber-400"
                )}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isEventWarning ? "text-[var(--accent-negative)]" : "text-[var(--text-high)]"
                    )}
                  >
                    {event.name}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] px-1 py-0.5 rounded uppercase font-medium",
                      event.impact === "CRITICAL"
                        ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                        : "bg-amber-500/20 text-amber-400"
                    )}
                  >
                    {event.impact}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--text-muted)]">
                  <Clock className="w-3 h-3" />
                  {event.timeUntil.isImminent ? (
                    <span className="text-[var(--accent-negative)] font-medium animate-pulse">
                      {event.timeUntil.minutes} minutes away
                    </span>
                  ) : event.timeUntil.hours < 24 ? (
                    <span>
                      {event.timeUntil.hours}h {event.timeUntil.minutes}m away
                    </span>
                  ) : (
                    <span>
                      {new Date(event.time).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>

              {isEventWarning && (
                <div className="text-[var(--accent-negative)] animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Warning Message */}
      {nextEvent.timeUntil.isImminent && (
        <div className="px-2.5 py-2 bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/30 rounded-[var(--radius)] text-[10px] text-[var(--accent-negative)]">
          <strong>Warning:</strong> High-impact event imminent. Consider waiting or reducing
          position size. Expect increased volatility and wider spreads.
        </div>
      )}
    </div>
  );
}
