/**
 * HDEconomicCalendar.tsx - Economic Calendar Display Component
 *
 * Phase 2.4: Shows upcoming economic events and their trading implications
 * - Event timeline with impact indicators
 * - Trading recommendations based on calendar
 * - High-risk period warnings
 * - Earnings spotlight
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { ScrollArea } from "../../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { cn } from "../../../lib/utils";
import {
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Bell,
  ChevronRight,
  RefreshCw,
  Zap,
  DollarSign,
} from "lucide-react";

// ============= Types =============

interface EconomicEvent {
  id: string;
  name: string;
  datetime: string;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  previous?: string;
  forecast?: string;
  actual?: string;
  affectsSymbols: string[];
}

interface EarningsEvent {
  symbol: string;
  name: string;
  datetime: string;
  timing: "BMO" | "AMC";
  expectedMove?: number;
  ivRank?: number;
}

interface CalendarAnalysis {
  eventsNext24h: EconomicEvent[];
  eventsNext7d: EconomicEvent[];
  earningsThisWeek: EarningsEvent[];
  tradingRecommendations: string[];
  marketSentiment: "risk-on" | "risk-off" | "neutral";
  volatilityOutlook: "elevated" | "normal" | "low";
  highRiskPeriods: Array<{
    start: string;
    end: string;
    reason: string;
    riskLevel: string;
  }>;
}

// ============= Component =============

interface HDEconomicCalendarProps {
  className?: string;
  watchlistSymbols?: string[];
}

export function HDEconomicCalendar({
  className,
  watchlistSymbols = ["SPY", "SPX", "QQQ", "NDX"],
}: HDEconomicCalendarProps) {
  const [analysis, setAnalysis] = useState<CalendarAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCalendarData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/calendar/analysis?symbols=${watchlistSymbols.join(",")}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || "Failed to fetch calendar data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setIsLoading(false);
    }
  }, [watchlistSymbols]);

  useEffect(() => {
    fetchCalendarData();

    // Refresh every 15 minutes
    const interval = setInterval(fetchCalendarData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCalendarData]);

  if (isLoading && !analysis) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[var(--text-muted)]" />
          <p className="mt-2 text-sm text-[var(--text-muted)]">Loading calendar data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("w-full border-red-500/50", className)}>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <p className="mt-2 text-sm text-red-500">{error}</p>
          <button
            onClick={fetchCalendarData}
            className="mt-4 text-xs text-[var(--accent)] hover:underline"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Market Sentiment */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-high)]">Economic Calendar</h2>
        </div>
        <div className="flex items-center gap-3">
          <SentimentBadge sentiment={analysis.marketSentiment} />
          <VolatilityBadge outlook={analysis.volatilityOutlook} />
          <button
            onClick={fetchCalendarData}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-med)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming ({analysis.eventsNext24h.length})</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 space-y-4">
          {/* Trading Recommendations */}
          {analysis.tradingRecommendations.length > 0 && (
            <Card className="bg-[var(--surface-2)]">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-yellow-500" />
                  Trading Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <div className="space-y-2">
                  {analysis.tradingRecommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-[var(--text-med)]">{rec}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next 24h Events */}
          {analysis.eventsNext24h.length > 0 ? (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Next 24 Hours</CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <EventsList events={analysis.eventsNext24h} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-[var(--text-muted)]">
                <Activity className="h-8 w-8 mx-auto opacity-50" />
                <p className="mt-2 text-sm">No major events in the next 24 hours</p>
                <p className="text-xs mt-1">Clear sailing for active trading</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <Card>
            <CardContent className="py-3">
              <ScrollArea className="h-[400px]">
                <EventsListGrouped events={analysis.eventsNext7d} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          {analysis.earningsThisWeek.length > 0 ? (
            <Card>
              <CardContent className="py-3">
                <EarningsList earnings={analysis.earningsThisWeek} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-[var(--text-muted)]">
                <DollarSign className="h-8 w-8 mx-auto opacity-50" />
                <p className="mt-2 text-sm">No major earnings this week</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-[var(--text-muted)] text-center">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// ============= Sub-Components =============

function SentimentBadge({ sentiment }: { sentiment: "risk-on" | "risk-off" | "neutral" }) {
  const config = {
    "risk-on": {
      icon: TrendingUp,
      color: "text-green-500 bg-green-500/10",
      label: "Risk On",
    },
    "risk-off": {
      icon: TrendingDown,
      color: "text-red-500 bg-red-500/10",
      label: "Risk Off",
    },
    neutral: {
      icon: Activity,
      color: "text-yellow-500 bg-yellow-500/10",
      label: "Neutral",
    },
  };

  const { icon: Icon, color, label } = config[sentiment];

  return (
    <Badge variant="outline" className={cn("gap-1", color)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function VolatilityBadge({ outlook }: { outlook: "elevated" | "normal" | "low" }) {
  const config = {
    elevated: {
      color: "text-red-500 bg-red-500/10",
      label: "High Vol",
    },
    normal: {
      color: "text-yellow-500 bg-yellow-500/10",
      label: "Normal Vol",
    },
    low: {
      color: "text-green-500 bg-green-500/10",
      label: "Low Vol",
    },
  };

  const { color, label } = config[outlook];

  return (
    <Badge variant="outline" className={cn("gap-1", color)}>
      <Zap className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function EventsList({ events }: { events: EconomicEvent[] }) {
  return (
    <div className="space-y-2">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventsListGrouped({ events }: { events: EconomicEvent[] }) {
  // Group events by date
  const grouped = events.reduce(
    (acc, event) => {
      const date = new Date(event.datetime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, EconomicEvent[]>
  );

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([date, dateEvents]) => (
        <div key={date}>
          <div className="text-xs font-medium text-[var(--text-muted)] mb-2 sticky top-0 bg-[var(--surface-1)] py-1">
            {date}
          </div>
          <div className="space-y-2 pl-2">
            {dateEvents.map((event) => (
              <EventRow key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event, compact = false }: { event: EconomicEvent; compact?: boolean }) {
  const impactConfig = {
    CRITICAL: {
      color: "bg-red-500",
      textColor: "text-red-500",
      badge: "destructive" as const,
    },
    HIGH: {
      color: "bg-orange-500",
      textColor: "text-orange-500",
      badge: "default" as const,
    },
    MEDIUM: {
      color: "bg-yellow-500",
      textColor: "text-yellow-500",
      badge: "secondary" as const,
    },
    LOW: {
      color: "bg-green-500",
      textColor: "text-green-500",
      badge: "outline" as const,
    },
  };

  const config = impactConfig[event.impact];
  const time = new Date(event.datetime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg",
        "hover:bg-[var(--surface-2)] transition-colors",
        event.impact === "CRITICAL" && "bg-red-500/5"
      )}
    >
      {/* Impact Indicator */}
      <div className={cn("w-2 h-8 rounded-full", config.color)} />

      {/* Event Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium text-sm", config.textColor)}>{event.name}</span>
          <Badge variant={config.badge} className="text-xs h-5">
            {event.impact}
          </Badge>
        </div>
        {!compact && (
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            Affects: {event.affectsSymbols.slice(0, 4).join(", ")}
            {event.affectsSymbols.length > 4 && ` +${event.affectsSymbols.length - 4} more`}
          </div>
        )}
      </div>

      {/* Time */}
      <div className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
        <Clock className="h-3 w-3" />
        {time}
      </div>
    </div>
  );
}

function EarningsList({ earnings }: { earnings: EarningsEvent[] }) {
  return (
    <div className="space-y-2">
      {earnings.map((earning) => (
        <EarningsRow key={`${earning.symbol}-${earning.datetime}`} earning={earning} />
      ))}
    </div>
  );
}

function EarningsRow({ earning }: { earning: EarningsEvent }) {
  const date = new Date(earning.datetime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-2)]">
      {/* Symbol */}
      <div className="text-center">
        <div className="text-lg font-bold text-[var(--accent)]">{earning.symbol}</div>
        <Badge variant="outline" className="text-xs">
          {earning.timing}
        </Badge>
      </div>

      {/* Company Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--text-high)] truncate">{earning.name}</div>
        <div className="text-xs text-[var(--text-muted)]">{date}</div>
      </div>

      {/* Metrics */}
      <div className="text-right">
        {earning.expectedMove && (
          <div className="text-sm">
            <span className="text-[var(--text-muted)]">Exp. Move: </span>
            <span className="font-medium text-[var(--text-high)]">
              {earning.expectedMove.toFixed(1)}%
            </span>
          </div>
        )}
        {earning.ivRank && (
          <div className="text-xs text-[var(--text-muted)]">
            IV Rank: {earning.ivRank.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default HDEconomicCalendar;
