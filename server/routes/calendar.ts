/**
 * calendar.ts - Economic Calendar API Routes
 *
 * Phase 2.4: Server-side calendar data endpoints
 * Provides economic events and earnings data for trading analysis
 */

import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

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

// ============= Constants =============

const MAJOR_EVENTS_DATA: Record<string, { impact: string; category: string; symbols: string[] }> = {
  "FOMC Meeting": {
    impact: "CRITICAL",
    category: "FED",
    symbols: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  },
  "Fed Chair Speech": {
    impact: "HIGH",
    category: "FED",
    symbols: ["SPY", "SPX", "QQQ", "NDX", "TLT"],
  },
  "Fed Minutes": { impact: "MEDIUM", category: "FED", symbols: ["SPY", "SPX", "TLT"] },
  "Non-Farm Payrolls": {
    impact: "CRITICAL",
    category: "EMPLOYMENT",
    symbols: ["SPY", "SPX", "QQQ", "NDX", "VIX"],
  },
  "Initial Jobless Claims": { impact: "MEDIUM", category: "EMPLOYMENT", symbols: ["SPY", "SPX"] },
  "Unemployment Rate": { impact: "HIGH", category: "EMPLOYMENT", symbols: ["SPY", "SPX", "QQQ"] },
  "ADP Employment": { impact: "MEDIUM", category: "EMPLOYMENT", symbols: ["SPY", "SPX"] },
  CPI: {
    impact: "CRITICAL",
    category: "INFLATION",
    symbols: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  },
  "Core CPI": {
    impact: "CRITICAL",
    category: "INFLATION",
    symbols: ["SPY", "SPX", "QQQ", "NDX", "TLT"],
  },
  PPI: { impact: "HIGH", category: "INFLATION", symbols: ["SPY", "SPX", "QQQ"] },
  PCE: { impact: "HIGH", category: "INFLATION", symbols: ["SPY", "SPX", "QQQ", "TLT"] },
  GDP: { impact: "HIGH", category: "GDP", symbols: ["SPY", "SPX", "QQQ", "NDX"] },
  "ISM Manufacturing": { impact: "MEDIUM", category: "GDP", symbols: ["SPY", "SPX", "XLI"] },
  "ISM Services": { impact: "MEDIUM", category: "GDP", symbols: ["SPY", "SPX"] },
  "Retail Sales": { impact: "MEDIUM", category: "CONSUMER", symbols: ["SPY", "XLY", "XRT"] },
};

// ============= Helper Functions =============

function isFirstFriday(date: Date): boolean {
  return date.getDay() === 5 && date.getDate() <= 7;
}

function isFirstWednesday(date: Date): boolean {
  return date.getDay() === 3 && date.getDate() <= 7;
}

function generateWeeklyEvents(startDate: Date, endDate: Date): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const current = new Date(startDate);
  let eventId = 0;

  while (current <= endDate) {
    const dayOfWeek = current.getDay();

    // Thursday - Jobless Claims
    if (dayOfWeek === 4) {
      const datetime = new Date(current);
      datetime.setHours(8, 30, 0, 0);
      events.push({
        id: `event-${eventId++}`,
        name: "Initial Jobless Claims",
        datetime: datetime.toISOString(),
        impact: "MEDIUM",
        category: "EMPLOYMENT",
        affectsSymbols: MAJOR_EVENTS_DATA["Initial Jobless Claims"].symbols,
      });
    }

    // First Friday - NFP
    if (isFirstFriday(current)) {
      const datetime = new Date(current);
      datetime.setHours(8, 30, 0, 0);
      events.push({
        id: `event-${eventId++}`,
        name: "Non-Farm Payrolls",
        datetime: datetime.toISOString(),
        impact: "CRITICAL",
        category: "EMPLOYMENT",
        affectsSymbols: MAJOR_EVENTS_DATA["Non-Farm Payrolls"].symbols,
      });
      events.push({
        id: `event-${eventId++}`,
        name: "Unemployment Rate",
        datetime: datetime.toISOString(),
        impact: "HIGH",
        category: "EMPLOYMENT",
        affectsSymbols: MAJOR_EVENTS_DATA["Unemployment Rate"].symbols,
      });
    }

    // First Wednesday (sometimes FOMC)
    if (isFirstWednesday(current)) {
      // FOMC meets every 6 weeks approximately
      const weekOfYear = Math.floor(
        (current.getTime() - new Date(current.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      if (weekOfYear % 6 === 0) {
        const datetime = new Date(current);
        datetime.setHours(14, 0, 0, 0);
        events.push({
          id: `event-${eventId++}`,
          name: "FOMC Meeting",
          datetime: datetime.toISOString(),
          impact: "CRITICAL",
          category: "FED",
          affectsSymbols: MAJOR_EVENTS_DATA["FOMC Meeting"].symbols,
        });
      }
    }

    // Mid-month CPI (10th-15th, Tue-Thu)
    if (current.getDate() >= 10 && current.getDate() <= 15 && dayOfWeek >= 2 && dayOfWeek <= 4) {
      // CPI usually comes out once a month
      if (current.getDate() === 12 || current.getDate() === 13) {
        const datetime = new Date(current);
        datetime.setHours(8, 30, 0, 0);
        events.push({
          id: `event-${eventId++}`,
          name: "CPI",
          datetime: datetime.toISOString(),
          impact: "CRITICAL",
          category: "INFLATION",
          affectsSymbols: MAJOR_EVENTS_DATA["CPI"].symbols,
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return events;
}

function generateEarningsEvents(
  startDate: Date,
  endDate: Date,
  symbols?: string[]
): EarningsEvent[] {
  const events: EarningsEvent[] = [];
  const majorStocks = symbols?.length
    ? symbols
    : ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"];

  // For mock data, randomly assign some stocks to report
  const reporting = majorStocks.filter(() => Math.random() > 0.75).slice(0, 3);

  reporting.forEach((symbol, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index + 2);

    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }

    if (date <= endDate) {
      events.push({
        symbol,
        name: `${symbol} Inc.`,
        datetime: date.toISOString(),
        timing: Math.random() > 0.5 ? "AMC" : "BMO",
        expectedMove: Math.round((3 + Math.random() * 5) * 10) / 10,
        ivRank: Math.round(50 + Math.random() * 40),
      });
    }
  });

  return events;
}

// ============= Routes =============

/**
 * GET /api/calendar/events
 * Fetch economic events for a date range
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const { start, end, impact } = req.query;

    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end
      ? new Date(end as string)
      : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    let events = generateWeeklyEvents(startDate, endDate);

    // Filter by impact if specified
    if (impact) {
      const impactLevels = (impact as string).split(",").map((i) => i.toUpperCase());
      events = events.filter((e) => impactLevels.includes(e.impact));
    }

    res.json({
      success: true,
      events,
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        count: events.length,
      },
    });
  } catch (error) {
    console.error("[Calendar] Error fetching events:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch calendar events",
    });
  }
});

/**
 * GET /api/calendar/earnings
 * Fetch earnings events for a date range
 */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    const { start, end, symbols } = req.query;

    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end
      ? new Date(end as string)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const symbolList = symbols ? (symbols as string).split(",") : undefined;

    const events = generateEarningsEvents(startDate, endDate, symbolList);

    res.json({
      success: true,
      earnings: events,
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        count: events.length,
      },
    });
  } catch (error) {
    console.error("[Calendar] Error fetching earnings:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch earnings",
    });
  }
});

/**
 * GET /api/calendar/analysis
 * Get comprehensive calendar analysis for trading
 */
router.get("/analysis", async (req: Request, res: Response) => {
  try {
    const { symbols } = req.query;
    const watchlistSymbols = symbols
      ? (symbols as string).split(",")
      : ["SPY", "SPX", "QQQ", "NDX"];

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const allEvents = generateWeeklyEvents(now, nextWeek);
    const earnings = generateEarningsEvents(now, nextWeek, watchlistSymbols);

    const eventsNext24h = allEvents.filter(
      (e) => new Date(e.datetime) >= now && new Date(e.datetime) <= tomorrow
    );
    const eventsNext7d = allEvents;

    // Generate recommendations
    const recommendations: string[] = [];
    const criticalSoon = eventsNext24h.filter((e) => e.impact === "CRITICAL");
    if (criticalSoon.length > 0) {
      recommendations.push(
        `CAUTION: ${criticalSoon.length} critical event(s) in next 24h - consider reducing position sizes`
      );
    }

    const fomcEvent = eventsNext7d.find((e) => e.name.includes("FOMC"));
    if (fomcEvent) {
      recommendations.push(`FOMC meeting this week - expect elevated VIX leading into event`);
    }

    const highImpactCount = eventsNext7d.filter(
      (e) => e.impact === "CRITICAL" || e.impact === "HIGH"
    ).length;
    if (highImpactCount >= 3) {
      recommendations.push("Busy week ahead - consider shorter DTE to avoid multiple event risks");
    } else if (highImpactCount === 0) {
      recommendations.push("Light calendar week - favorable for swing trades with longer DTE");
    }

    // Determine sentiment
    const criticalCount = eventsNext7d.filter((e) => e.impact === "CRITICAL").length;
    const fedEvents = eventsNext7d.filter((e) => e.category === "FED").length;
    const marketSentiment =
      criticalCount >= 2 || fedEvents >= 2
        ? "risk-off"
        : criticalCount === 0
          ? "risk-on"
          : "neutral";
    const volatilityOutlook =
      highImpactCount >= 3 || earnings.length >= 5
        ? "elevated"
        : highImpactCount === 0
          ? "low"
          : "normal";

    res.json({
      success: true,
      analysis: {
        eventsNext24h,
        eventsNext7d,
        earningsThisWeek: earnings,
        tradingRecommendations: recommendations,
        marketSentiment,
        volatilityOutlook,
        highRiskPeriods: criticalSoon.map((e) => ({
          start: new Date(new Date(e.datetime).getTime() - 60 * 60 * 1000).toISOString(),
          end: new Date(new Date(e.datetime).getTime() + 60 * 60 * 1000).toISOString(),
          reason: e.name,
          riskLevel: e.impact,
        })),
      },
    });
  } catch (error) {
    console.error("[Calendar] Error generating analysis:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate analysis",
    });
  }
});

/**
 * GET /api/calendar/next-event
 * Get the next high-impact event
 */
router.get("/next-event", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = generateWeeklyEvents(now, nextWeek);
    const highImpact = events
      .filter((e) => e.impact === "CRITICAL" || e.impact === "HIGH")
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    const nextEvent = highImpact[0] || null;
    const minutesUntil = nextEvent
      ? Math.round((new Date(nextEvent.datetime).getTime() - now.getTime()) / (1000 * 60))
      : null;

    res.json({
      success: true,
      event: nextEvent,
      minutesUntil,
      isToday: nextEvent
        ? new Date(nextEvent.datetime).toDateString() === now.toDateString()
        : false,
    });
  } catch (error) {
    console.error("[Calendar] Error fetching next event:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch next event",
    });
  }
});

export default router;
