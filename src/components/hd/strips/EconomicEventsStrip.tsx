/**
 * EconomicEventsStrip - Symbol-scoped economic events strip
 *
 * Always visible above options chain. Shows event count + next 1-2 events.
 * Expands to show full event list on click.
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "../../../lib/utils";
import { Calendar, AlertTriangle, ChevronDown, ChevronUp, Clock, Loader2 } from "lucide-react";

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  affectsSymbols: string[];
}

interface EconomicEventsStripProps {
  symbol: string;
  className?: string;
}

function getTimeUntil(eventTime: string): {
  hours: number;
  minutes: number;
  text: string;
  isImminent: boolean;
  isSoon: boolean;
} {
  const now = new Date();
  const event = new Date(eventTime);
  const diffMs = event.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let text: string;
  if (hours < 1) {
    text = `${minutes}m`;
  } else if (hours < 24) {
    text = `${hours}h ${minutes}m`;
  } else {
    const days = Math.floor(hours / 24);
    text = days === 1 ? "tomorrow" : `${days}d`;
  }

  return {
    hours,
    minutes,
    text,
    isImminent: hours < 1 && minutes > 0,
    isSoon: hours < 24 && hours >= 1,
  };
}

export function EconomicEventsStrip({ symbol, className }: EconomicEventsStripProps) {
  const [events, setEvents] = useState<
    Array<EconomicEvent & { timeUntil: ReturnType<typeof getTimeUntil> }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/calendar/events?impact=CRITICAL,HIGH");

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.events) {
        setEvents([]);
        return;
      }

      const now = new Date();
      const upcoming = (data.events as EconomicEvent[])
        .filter((event) => {
          const eventDate = new Date(event.datetime);
          const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

          // Show events within next 48 hours and not past
          if (hoursUntil < 0 || hoursUntil > 48) return false;

          // If symbol specified, check relevance
          if (symbol) {
            const isRelevant =
              event.affectsSymbols?.some(
                (s) => s.toUpperCase() === symbol.toUpperCase()
              ) ||
              event.affectsSymbols?.includes("ALL") ||
              event.impact === "CRITICAL";
            return isRelevant;
          }

          return true;
        })
        .map((event) => ({
          ...event,
          timeUntil: getTimeUntil(event.datetime),
        }))
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

      setEvents(upcoming);
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Update time countdown every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setEvents((prev) =>
        prev.map((event) => ({
          ...event,
          timeUntil: getTimeUntil(event.datetime),
        }))
      );
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // Loading state
  if (isLoading && events.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]",
          className
        )}
      >
        <Loader2 className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">Loading events...</span>
      </div>
    );
  }

  // No events state
  if (events.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]",
          className
        )}
      >
        <Calendar className="w-3.5 h-3.5 text-[var(--text-faint)]" />
        <span className="text-xs text-[var(--text-faint)]">EVENTS: none today</span>
      </div>
    );
  }

  const hasWarning = events.some(
    (e) => e.timeUntil.isImminent || (e.timeUntil.isSoon && e.impact === "CRITICAL")
  );

  return (
    <div
      className={cn(
        "border-b border-[var(--border-hairline)]",
        hasWarning ? "bg-amber-500/5" : "bg-[var(--surface-1)]",
        className
      )}
    >
      {/* Compact Strip */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <Calendar
          className={cn(
            "w-3.5 h-3.5",
            hasWarning ? "text-amber-400" : "text-[var(--text-muted)]"
          )}
        />
        <span className="text-xs font-medium text-[var(--text-muted)]">
          EVENTS: {events.length}
        </span>

        {/* Next 1-2 events inline */}
        <div className="flex-1 flex items-center gap-3 overflow-hidden">
          {events.slice(0, 2).map((event, idx) => (
            <span
              key={event.id}
              className={cn(
                "text-xs truncate",
                event.impact === "CRITICAL" ? "text-[var(--accent-negative)]" : "text-amber-400"
              )}
            >
              {event.name}
              <span className="opacity-60 ml-1">
                ({event.impact})
              </span>
              <span className="ml-1 opacity-75">
                {event.timeUntil.isImminent ? (
                  <span className="animate-pulse">in {event.timeUntil.text}</span>
                ) : (
                  `in ${event.timeUntil.text}`
                )}
              </span>
            </span>
          ))}
        </div>

        <span className="text-[var(--text-faint)]">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Expanded Event List */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 animate-fade-in-up">
          {events.map((event) => {
            const isWarning =
              event.timeUntil.isImminent ||
              (event.timeUntil.isSoon && event.impact === "CRITICAL");

            return (
              <div
                key={event.id}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded border",
                  isWarning
                    ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/20"
                    : event.impact === "CRITICAL"
                      ? "bg-amber-500/10 border-amber-500/20"
                      : "bg-[var(--surface-2)] border-[var(--border-hairline)]"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isWarning
                      ? "text-[var(--accent-negative)]"
                      : event.impact === "CRITICAL"
                        ? "text-amber-400"
                        : "text-[var(--text-muted)]"
                  )}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isWarning ? "text-[var(--accent-negative)]" : "text-[var(--text-high)]"
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
                      <span>{event.timeUntil.text}</span>
                    )}
                    {symbol && (
                      <span className="text-[var(--text-faint)]">
                        • Affects: {event.affectsSymbols?.includes("ALL") ? "ALL" : symbol}
                      </span>
                    )}
                  </div>
                </div>

                {isWarning && (
                  <div className="text-[var(--accent-negative)] animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Warning message for imminent events */}
          {events.some((e) => e.timeUntil.isImminent) && (
            <div className="px-2.5 py-2 bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/30 rounded text-[10px] text-[var(--accent-negative)]">
              <strong>Warning:</strong> High-impact event imminent. Consider waiting or reducing
              position size.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EconomicEventsStrip;
