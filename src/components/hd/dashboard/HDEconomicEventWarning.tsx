/**
 * HDEconomicEventWarning - Shows warnings for upcoming economic events
 *
 * Displays alerts for high-impact events that could affect options trades
 * Now fetches real data from Alpha Vantage calendar API
 */

import { cn } from "../../../lib/utils";
import { AlertTriangle, Calendar, Clock, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  affectsSymbols: string[];
  actual?: string;
  forecast?: string;
  previous?: string;
}

interface HDEconomicEventWarningProps {
  ticker?: string;
  className?: string;
  compact?: boolean;
}

function getTimeUntil(eventTime: string): {
  hours: number;
  minutes: number;
  isImminent: boolean;
  isSoon: boolean;
  isPast: boolean;
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
    isPast: diffMs < 0,
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendarEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch from our calendar API
      const response = await fetch("/api/calendar/events?impact=CRITICAL,HIGH");

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.events) {
        throw new Error("Invalid calendar response");
      }

      const now = new Date();
      const upcoming = (data.events as EconomicEvent[])
        .filter((event) => {
          const eventDate = new Date(event.datetime);
          const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

          // Show events within next 48 hours and not past
          if (hoursUntil < 0 || hoursUntil > 48) return false;

          // If ticker specified, filter by relevance
          if (ticker) {
            return event.affectsSymbols?.some(
              (symbol) => symbol.toUpperCase() === ticker.toUpperCase()
            );
          }

          // Show all critical/high impact events
          return event.impact === "CRITICAL" || event.impact === "HIGH";
        })
        .map((event) => ({
          ...event,
          timeUntil: getTimeUntil(event.datetime),
        }))
        .filter((event) => !event.timeUntil.isPast)
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

      setEvents(upcoming);
    } catch (err) {
      console.error("[HDEconomicEventWarning] Error fetching calendar:", err);
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setIsLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchCalendarEvents();

    // Refresh every 5 minutes
    const interval = setInterval(fetchCalendarEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCalendarEvents]);

  // Update time countdown every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setEvents((prev) =>
        prev
          .map((event) => ({
            ...event,
            timeUntil: getTimeUntil(event.datetime),
          }))
          .filter((event) => !event.timeUntil.isPast)
      );
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // Loading state
  if (isLoading && events.length === 0) {
    if (compact) return null;
    return (
      <div className={cn("flex items-center gap-2 text-xs text-[var(--text-muted)]", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading calendar...</span>
      </div>
    );
  }

  // Error state (silent in compact mode)
  if (error && events.length === 0) {
    if (compact) return null;
    return null; // Don't show error, just hide component
  }

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
        <span className="text-[var(--text-muted)] font-normal normal-case ml-auto text-[10px]">
          via Alpha Vantage
        </span>
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
                      {new Date(event.datetime).toLocaleDateString("en-US", {
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
