/**
 * calendar.ts - Economic Calendar API Routes
 *
 * Phase 3: Real API integration using Alpha Vantage
 * Provides economic events and earnings data for trading analysis
 */

import { Router } from "express";
import type { Request, Response } from "express";
import {
  buildUnifiedCalendar,
  getFOMCSchedule,
  getCPISchedule,
  getNFPDate,
  getJoblessClaimsDates,
  fetchAlphaVantageEarningsCalendar,
  getEarningsForSymbols,
  checkEarningsProximity,
  CATEGORY_SYMBOLS,
  type UnifiedCalendarEvent,
} from "../vendors/alphaVantage.js";

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
  estimate?: number;
}

// ============= Constants =============

const MAJOR_EVENTS_DATA: Record<string, { impact: string; category: string; symbols: string[] }> = {
  "FOMC Meeting": {
    impact: "CRITICAL",
    category: "FED",
    symbols: CATEGORY_SYMBOLS.FED,
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
    symbols: CATEGORY_SYMBOLS.EMPLOYMENT,
  },
  "Initial Jobless Claims": { impact: "MEDIUM", category: "EMPLOYMENT", symbols: ["SPY", "SPX"] },
  "Unemployment Rate": { impact: "HIGH", category: "EMPLOYMENT", symbols: ["SPY", "SPX", "QQQ"] },
  "ADP Employment": { impact: "MEDIUM", category: "EMPLOYMENT", symbols: ["SPY", "SPX"] },
  CPI: {
    impact: "CRITICAL",
    category: "INFLATION",
    symbols: CATEGORY_SYMBOLS.INFLATION,
  },
  "Core CPI": {
    impact: "CRITICAL",
    category: "INFLATION",
    symbols: ["SPY", "SPX", "QQQ", "NDX", "TLT"],
  },
  PPI: { impact: "HIGH", category: "INFLATION", symbols: ["SPY", "SPX", "QQQ"] },
  PCE: { impact: "HIGH", category: "INFLATION", symbols: ["SPY", "SPX", "QQQ", "TLT"] },
  GDP: { impact: "HIGH", category: "GDP", symbols: CATEGORY_SYMBOLS.GDP },
  "ISM Manufacturing": { impact: "MEDIUM", category: "GDP", symbols: ["SPY", "SPX", "XLI"] },
  "ISM Services": { impact: "MEDIUM", category: "GDP", symbols: ["SPY", "SPX"] },
  "Retail Sales": { impact: "MEDIUM", category: "CONSUMER", symbols: CATEGORY_SYMBOLS.CONSUMER },
};

// ============= Helper Functions =============

/**
 * Generate economic events using real schedule data
 * Uses known FOMC dates, calculates NFP/CPI dates, etc.
 */
function generateRealEconomicEvents(startDate: Date, endDate: Date): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  let eventId = 0;

  // Add FOMC dates (real schedule from Federal Reserve)
  const year = startDate.getFullYear();
  const fomcDates = [
    ...getFOMCSchedule(year),
    ...(year !== endDate.getFullYear() ? getFOMCSchedule(endDate.getFullYear()) : []),
  ];

  for (const date of fomcDates) {
    if (date >= startDate && date <= endDate) {
      events.push({
        id: `fomc-${eventId++}`,
        name: "FOMC Rate Decision",
        datetime: date.toISOString(),
        impact: "CRITICAL",
        category: "FED",
        affectsSymbols: MAJOR_EVENTS_DATA["FOMC Meeting"].symbols,
      });
    }
  }

  // Add NFP dates (first Friday of each month)
  let current = new Date(startDate);
  while (current <= endDate) {
    const nfpDate = getNFPDate(current.getFullYear(), current.getMonth());
    if (nfpDate >= startDate && nfpDate <= endDate) {
      // Check if we haven't already added this date
      const exists = events.some(
        (e) =>
          e.name === "Non-Farm Payrolls" &&
          new Date(e.datetime).toDateString() === nfpDate.toDateString()
      );
      if (!exists) {
        events.push({
          id: `nfp-${eventId++}`,
          name: "Non-Farm Payrolls",
          datetime: nfpDate.toISOString(),
          impact: "CRITICAL",
          category: "EMPLOYMENT",
          affectsSymbols: MAJOR_EVENTS_DATA["Non-Farm Payrolls"].symbols,
        });
        events.push({
          id: `unemp-${eventId++}`,
          name: "Unemployment Rate",
          datetime: nfpDate.toISOString(),
          impact: "HIGH",
          category: "EMPLOYMENT",
          affectsSymbols: MAJOR_EVENTS_DATA["Unemployment Rate"].symbols,
        });
      }
    }
    current.setMonth(current.getMonth() + 1);
  }

  // Add CPI dates (mid-month)
  current = new Date(startDate);
  while (current <= endDate) {
    const cpiDate = getCPISchedule(current.getFullYear(), current.getMonth());
    if (cpiDate && cpiDate >= startDate && cpiDate <= endDate) {
      const exists = events.some(
        (e) => e.name === "CPI" && new Date(e.datetime).toDateString() === cpiDate.toDateString()
      );
      if (!exists) {
        events.push({
          id: `cpi-${eventId++}`,
          name: "CPI",
          datetime: cpiDate.toISOString(),
          impact: "CRITICAL",
          category: "INFLATION",
          affectsSymbols: MAJOR_EVENTS_DATA["CPI"].symbols,
        });
      }
    }
    current.setMonth(current.getMonth() + 1);
  }

  // Add weekly jobless claims (Thursdays)
  const joblessDates = getJoblessClaimsDates(startDate, endDate);
  for (const date of joblessDates) {
    events.push({
      id: `jobless-${eventId++}`,
      name: "Initial Jobless Claims",
      datetime: date.toISOString(),
      impact: "MEDIUM",
      category: "EMPLOYMENT",
      affectsSymbols: MAJOR_EVENTS_DATA["Initial Jobless Claims"].symbols,
    });
  }

  // Sort by datetime
  return events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

/**
 * Convert Alpha Vantage earnings to our format
 */
async function getRealEarningsEvents(
  startDate: Date,
  endDate: Date,
  symbols?: string[]
): Promise<EarningsEvent[]> {
  try {
    const watchlistSymbols = symbols || ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"];
    const daysAhead = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const alphaEarnings = await getEarningsForSymbols(watchlistSymbols, daysAhead);

    return alphaEarnings
      .map((e) => {
        const reportDate = new Date(e.reportDate);
        // Guess timing based on common patterns
        const timing: "BMO" | "AMC" = ["AAPL", "MSFT", "GOOGL", "META", "AMZN"].includes(
          e.symbol.toUpperCase()
        )
          ? "AMC"
          : "BMO";

        return {
          symbol: e.symbol,
          name: e.name || `${e.symbol} Inc.`,
          datetime: reportDate.toISOString(),
          timing,
          estimate: e.estimate,
          // IV rank would need options chain data - leave as undefined
          // Expected move would need IV data - leave as undefined
        };
      })
      .filter((e) => {
        const dt = new Date(e.datetime);
        return dt >= startDate && dt <= endDate;
      });
  } catch (error) {
    console.warn("[Calendar] Error fetching real earnings, returning empty:", error);
    return [];
  }
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

    let events = generateRealEconomicEvents(startDate, endDate);

    // Filter by impact if specified
    if (impact) {
      const impactLevels = (impact as string).split(",").map((i) => i.toUpperCase());
      events = events.filter((e) => impactLevels.includes(e.impact));
    }

    res.json({
      success: true,
      events,
      source: "alpha_vantage_schedule",
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
 * Fetch earnings events for a date range (uses Alpha Vantage)
 */
router.get("/earnings", async (req: Request, res: Response) => {
  try {
    const { start, end, symbols } = req.query;

    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end
      ? new Date(end as string)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const symbolList = symbols ? (symbols as string).split(",") : undefined;

    const events = await getRealEarningsEvents(startDate, endDate, symbolList);

    res.json({
      success: true,
      earnings: events,
      source: "alpha_vantage",
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
 * GET /api/calendar/unified
 * Get unified calendar with both economic events and earnings
 */
router.get("/unified", async (req: Request, res: Response) => {
  try {
    const { symbols, days } = req.query;
    const watchlistSymbols = symbols
      ? (symbols as string).split(",")
      : ["SPY", "SPX", "QQQ", "NDX", "AAPL", "MSFT", "NVDA"];
    const daysAhead = days ? parseInt(days as string, 10) : 7;

    const events = await buildUnifiedCalendar(watchlistSymbols, daysAhead);

    res.json({
      success: true,
      events: events.map((e) => ({
        ...e,
        datetime: e.datetime.toISOString(),
      })),
      source: "alpha_vantage",
      meta: {
        daysAhead,
        symbolCount: watchlistSymbols.length,
        eventCount: events.length,
      },
    });
  } catch (error) {
    console.error("[Calendar] Error building unified calendar:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to build unified calendar",
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

    const allEvents = generateRealEconomicEvents(now, nextWeek);
    const earnings = await getRealEarningsEvents(now, nextWeek, watchlistSymbols);

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

    const cpiEvent = eventsNext7d.find((e) => e.name === "CPI");
    if (cpiEvent) {
      recommendations.push(`CPI release this week - inflation data drives Fed expectations`);
    }

    const nfpEvent = eventsNext7d.find((e) => e.name === "Non-Farm Payrolls");
    if (nfpEvent) {
      recommendations.push(`Jobs report this week - expect volatility around release`);
    }

    const highImpactCount = eventsNext7d.filter(
      (e) => e.impact === "CRITICAL" || e.impact === "HIGH"
    ).length;
    if (highImpactCount >= 3) {
      recommendations.push("Busy week ahead - consider shorter DTE to avoid multiple event risks");
    } else if (highImpactCount === 0) {
      recommendations.push("Light calendar week - favorable for swing trades with longer DTE");
    }

    // Check for earnings proximity warnings
    if (earnings.length > 0) {
      const earningsSymbols = earnings.map((e) => e.symbol).join(", ");
      recommendations.push(`Earnings this week: ${earningsSymbols} - elevated IV expected`);
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
      source: "alpha_vantage",
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

    const events = generateRealEconomicEvents(now, nextWeek);
    const highImpact = events
      .filter((e) => e.impact === "CRITICAL" || e.impact === "HIGH")
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    const nextEvent = highImpact[0] || null;
    const minutesUntil = nextEvent
      ? Math.round((new Date(nextEvent.datetime).getTime() - now.getTime()) / (1000 * 60))
      : null;

    res.json({
      success: true,
      source: "alpha_vantage_schedule",
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

/**
 * GET /api/calendar/earnings-check
 * Check if a specific symbol has earnings coming up
 */
router.get("/earnings-check", async (req: Request, res: Response) => {
  try {
    const { symbol, days } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: "Symbol parameter required",
      });
    }

    const daysThreshold = days ? parseInt(days as string, 10) : 7;

    // Get earnings calendar
    const response = await fetchAlphaVantageEarningsCalendar("3month");
    const result = checkEarningsProximity(response.earnings, symbol as string, daysThreshold);

    res.json({
      success: true,
      source: response.source,
      symbol: symbol as string,
      hasEarnings: result.hasEarnings,
      daysUntil: result.daysUntil,
      event: result.event
        ? {
            reportDate: result.event.reportDate,
            estimate: result.event.estimate,
            name: result.event.name,
          }
        : null,
    });
  } catch (error) {
    console.error("[Calendar] Error checking earnings:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check earnings",
    });
  }
});

export default router;
