/**
 * HDWeeklyCalendar - Weekly economic calendar widget
 *
 * Displays upcoming economic events for the week from Alpha Vantage API
 * Shows FOMC, CPI, NFP, Jobless Claims, and earnings releases
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "../../../lib/utils";
import {
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  Building2,
  DollarSign,
  Users,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

interface HDWeeklyCalendarProps {
  className?: string;
  compact?: boolean;
  maxEvents?: number;
}

// Category icons
const categoryIcons: Record<string, React.ReactNode> = {
  "Federal Reserve": <Building2 className="w-3.5 h-3.5" />,
  "Interest Rates": <Building2 className="w-3.5 h-3.5" />,
  Inflation: <DollarSign className="w-3.5 h-3.5" />,
  Employment: <Users className="w-3.5 h-3.5" />,
  Earnings: <TrendingUp className="w-3.5 h-3.5" />,
};

// Impact colors
const impactStyles: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  HIGH: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  MEDIUM: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  LOW: {
    bg: "bg-[var(--surface-2)]",
    text: "text-[var(--text-muted)]",
    border: "border-[var(--border-hairline)]",
  },
};

function formatEventTime(datetime: string): {
  date: string;
  time: string;
  isToday: boolean;
  isTomorrow: boolean;
} {
  const eventDate = new Date(datetime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const isToday = eventDay.getTime() === today.getTime();
  const isTomorrow = eventDay.getTime() === tomorrow.getTime();

  const date = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : eventDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

  const time = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return { date, time, isToday, isTomorrow };
}

function getTimeUntil(datetime: string): { text: string; isImminent: boolean; isSoon: boolean } {
  const eventDate = new Date(datetime);
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs < 0) {
    return { text: "Past", isImminent: false, isSoon: false };
  }

  if (diffHours < 1) {
    return { text: `${diffMinutes}m`, isImminent: true, isSoon: false };
  }

  if (diffHours < 24) {
    return { text: `${diffHours}h ${diffMinutes}m`, isImminent: false, isSoon: true };
  }

  const diffDays = Math.floor(diffHours / 24);
  return { text: `${diffDays}d`, isImminent: false, isSoon: false };
}

export function HDWeeklyCalendar({
  className,
  compact = false,
  maxEvents = 10,
}: HDWeeklyCalendarProps) {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchCalendar = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/calendar/unified");

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load calendar");
      }

      // Filter to next 7 days and sort by datetime
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const upcomingEvents = (data.events as EconomicEvent[])
        .filter((event) => {
          const eventDate = new Date(event.datetime);
          return eventDate >= now && eventDate <= weekFromNow;
        })
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        .slice(0, maxEvents);

      setEvents(upcomingEvents);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[HDWeeklyCalendar] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setIsLoading(false);
    }
  }, [maxEvents]);

  useEffect(() => {
    fetchCalendar();

    // Refresh every 15 minutes
    const interval = setInterval(fetchCalendar, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCalendar]);

  // Group events by day
  const eventsByDay = events.reduce(
    (acc, event) => {
      const { date } = formatEventTime(event.datetime);
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, EconomicEvent[]>
  );

  // Count critical/high events
  const criticalCount = events.filter((e) => e.impact === "CRITICAL").length;
  const highCount = events.filter((e) => e.impact === "HIGH").length;

  if (compact && !isExpanded) {
    // Compact collapsed view
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl",
          "bg-[var(--surface-1)] border border-[var(--border-hairline)]",
          "hover:bg-[var(--surface-2)] transition-colors",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[var(--brand-primary)]" />
          <span className="font-medium text-[var(--text-high)]">Economic Calendar</span>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400">
              {highCount} High
            </span>
          )}
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--brand-primary)]" />
          <h3 className="font-semibold text-[var(--text-high)]">Economic Calendar</h3>
          <span className="text-xs text-[var(--text-muted)]">via Alpha Vantage</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Impact badges */}
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400">
              {highCount} High
            </span>
          )}

          {/* Refresh button */}
          <button
            onClick={fetchCalendar}
            disabled={isLoading}
            className="p-1.5 rounded hover:bg-[var(--surface-2)] transition-colors"
            title={lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()}` : "Refresh"}
          >
            <RefreshCw
              className={cn("w-4 h-4 text-[var(--text-muted)]", isLoading && "animate-spin")}
            />
          </button>

          {/* Collapse button (compact mode) */}
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded hover:bg-[var(--surface-2)] transition-colors"
            >
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading && events.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">{error}</p>
            <button
              onClick={fetchCalendar}
              className="mt-2 text-sm text-[var(--brand-primary)] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)]">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events this week</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(eventsByDay).map(([day, dayEvents]) => (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      day === "Today"
                        ? "text-[var(--brand-primary)]"
                        : day === "Tomorrow"
                          ? "text-amber-400"
                          : "text-[var(--text-muted)]"
                    )}
                  >
                    {day}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border-hairline)]" />
                </div>

                {/* Events for this day */}
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const { time, isToday } = formatEventTime(event.datetime);
                    const timeUntil = getTimeUntil(event.datetime);
                    const styles = impactStyles[event.impact];
                    const icon = categoryIcons[event.category] || (
                      <Calendar className="w-3.5 h-3.5" />
                    );

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border",
                          styles.bg,
                          styles.border,
                          timeUntil.isImminent && "animate-pulse"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn("mt-0.5", styles.text)}>{icon}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-sm font-medium", styles.text)}>
                              {event.name}
                            </span>
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold",
                                styles.bg,
                                styles.text
                              )}
                            >
                              {event.impact}
                            </span>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                            <Clock className="w-3 h-3" />
                            <span>{time}</span>
                            {isToday && timeUntil.text !== "Past" && (
                              <span
                                className={cn(
                                  "font-medium",
                                  timeUntil.isImminent && "text-red-400",
                                  timeUntil.isSoon && !timeUntil.isImminent && "text-amber-400"
                                )}
                              >
                                ({timeUntil.text})
                              </span>
                            )}
                          </div>

                          {/* Previous/Forecast values if available */}
                          {(event.previous || event.forecast) && (
                            <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                              {event.previous && (
                                <span className="text-[var(--text-muted)]">
                                  Prev:{" "}
                                  <span className="font-medium text-[var(--text-med)]">
                                    {event.previous}
                                  </span>
                                </span>
                              )}
                              {event.forecast && (
                                <span className="text-[var(--text-muted)]">
                                  Fcst:{" "}
                                  <span className="font-medium text-[var(--text-med)]">
                                    {event.forecast}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Affected symbols */}
                          {event.affectsSymbols && event.affectsSymbols.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {event.affectsSymbols.slice(0, 5).map((symbol) => (
                                <span
                                  key={symbol}
                                  className="text-[9px] px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]"
                                >
                                  {symbol}
                                </span>
                              ))}
                              {event.affectsSymbols.length > 5 && (
                                <span className="text-[9px] text-[var(--text-muted)]">
                                  +{event.affectsSymbols.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Imminent warning */}
                        {timeUntil.isImminent && (
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HDWeeklyCalendar;
