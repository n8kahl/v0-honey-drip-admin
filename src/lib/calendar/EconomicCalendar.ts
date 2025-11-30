/**
 * EconomicCalendar.ts - Economic Calendar Integration
 *
 * Phase 3: Real API integration using Alpha Vantage
 * - Federal Reserve events (FOMC, speeches)
 * - Employment data (NFP, unemployment)
 * - Inflation data (CPI, PPI)
 * - GDP and economic indicators
 * - Major earnings events (from Alpha Vantage)
 */

import { buildApiUrl, isTestEnv } from "../env";

// ============= Types =============

export type EventImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EventCategory =
  | "FED"
  | "EMPLOYMENT"
  | "INFLATION"
  | "GDP"
  | "EARNINGS"
  | "HOUSING"
  | "CONSUMER"
  | "OTHER";
export type EarningsTiming = "BMO" | "AMC"; // Before Market Open / After Market Close

export interface EconomicEvent {
  id: string;
  name: string;
  datetime: Date;
  impact: EventImpact;
  category: EventCategory;
  previous?: string;
  forecast?: string;
  actual?: string;
  affectsSymbols: string[]; // Which symbols this impacts
  description?: string;
}

export interface EarningsEvent {
  symbol: string;
  name: string;
  datetime: Date;
  timing: EarningsTiming;
  expectedMove?: number; // Implied move from options pricing
  ivRank?: number;
  historicalBeatRate?: number;
  estimate?: number;
}

export interface HighRiskPeriod {
  start: Date;
  end: Date;
  reason: string;
  events: string[];
  riskLevel: EventImpact;
}

export interface CalendarAnalysis {
  eventsNext24h: EconomicEvent[];
  eventsNext7d: EconomicEvent[];
  earningsThisWeek: EarningsEvent[];
  tradingRecommendations: string[];
  highRiskPeriods: HighRiskPeriod[];
  marketSentiment: "risk-on" | "risk-off" | "neutral";
  volatilityOutlook: "elevated" | "normal" | "low";
}

export interface CalendarConfig {
  watchlistSymbols?: string[];
  includeEarnings?: boolean;
  impactFilter?: EventImpact[];
  lookAheadDays?: number;
}

// ============= Constants =============

/**
 * Known recurring events with their typical impact
 */
export const MAJOR_ECONOMIC_EVENTS: Record<
  string,
  { impact: EventImpact; category: EventCategory; affectsSymbols: string[] }
> = {
  // Federal Reserve
  "FOMC Meeting": {
    impact: "CRITICAL",
    category: "FED",
    affectsSymbols: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  },
  "FOMC Rate Decision": {
    impact: "CRITICAL",
    category: "FED",
    affectsSymbols: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  },
  "Fed Chair Speech": {
    impact: "HIGH",
    category: "FED",
    affectsSymbols: ["SPY", "SPX", "QQQ", "NDX", "TLT"],
  },
  "Fed Minutes": { impact: "MEDIUM", category: "FED", affectsSymbols: ["SPY", "SPX", "TLT"] },

  // Employment
  "Non-Farm Payrolls": {
    impact: "CRITICAL",
    category: "EMPLOYMENT",
    affectsSymbols: ["SPY", "SPX", "QQQ", "NDX", "VIX"],
  },
  "Initial Jobless Claims": {
    impact: "MEDIUM",
    category: "EMPLOYMENT",
    affectsSymbols: ["SPY", "SPX"],
  },
  "Unemployment Rate": {
    impact: "HIGH",
    category: "EMPLOYMENT",
    affectsSymbols: ["SPY", "SPX", "QQQ"],
  },
  "ADP Employment": { impact: "MEDIUM", category: "EMPLOYMENT", affectsSymbols: ["SPY", "SPX"] },

  // Inflation
  CPI: {
    impact: "CRITICAL",
    category: "INFLATION",
    affectsSymbols: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  },
  "Core CPI": {
    impact: "CRITICAL",
    category: "INFLATION",
    affectsSymbols: ["SPY", "SPX", "QQQ", "NDX", "TLT"],
  },
  PPI: { impact: "HIGH", category: "INFLATION", affectsSymbols: ["SPY", "SPX", "QQQ"] },
  PCE: { impact: "HIGH", category: "INFLATION", affectsSymbols: ["SPY", "SPX", "QQQ", "TLT"] },

  // GDP & Economic
  GDP: { impact: "HIGH", category: "GDP", affectsSymbols: ["SPY", "SPX", "QQQ", "NDX"] },
  "ISM Manufacturing": { impact: "MEDIUM", category: "GDP", affectsSymbols: ["SPY", "SPX", "XLI"] },
  "ISM Services": { impact: "MEDIUM", category: "GDP", affectsSymbols: ["SPY", "SPX"] },

  // Consumer
  "Retail Sales": { impact: "MEDIUM", category: "CONSUMER", affectsSymbols: ["SPY", "XLY", "XRT"] },
  "Consumer Confidence": { impact: "LOW", category: "CONSUMER", affectsSymbols: ["SPY", "XLY"] },

  // Housing
  "Housing Starts": { impact: "LOW", category: "HOUSING", affectsSymbols: ["XHB", "ITB"] },
  "Existing Home Sales": { impact: "LOW", category: "HOUSING", affectsSymbols: ["XHB", "ITB"] },
};

/**
 * Time buffers around events (in minutes)
 */
const EVENT_BUFFER = {
  CRITICAL: 60, // 1 hour before/after
  HIGH: 30,
  MEDIUM: 15,
  LOW: 5,
};

const IS_TEST = isTestEnv();

// ============= API Functions =============

/**
 * Fetch economic calendar from our server API (powered by Alpha Vantage)
 */
export async function fetchEconomicCalendar(
  startDate: Date,
  endDate: Date,
  config: CalendarConfig = {}
): Promise<EconomicEvent[]> {
  // In test env, return deterministic stub data without network calls
  if (IS_TEST) {
    const stub: EconomicEvent[] = [
      {
        id: "evt-1",
        name: "CPI",
        datetime: new Date(startDate.getTime() + 6 * 60 * 60 * 1000),
        impact: "CRITICAL",
        category: "INFLATION",
        affectsSymbols: ["SPY", "SPX"],
      },
      {
        id: "evt-2",
        name: "Initial Jobless Claims",
        datetime: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        impact: "MEDIUM",
        category: "EMPLOYMENT",
        affectsSymbols: ["SPY"],
      },
    ];
    return stub.filter((e) => {
      const inRange = e.datetime >= startDate && e.datetime <= endDate;
      const impactOk =
        !config.impactFilter?.length || config.impactFilter.includes(e.impact as EventImpact);
      return inRange && impactOk;
    });
  }

  try {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    if (config.impactFilter?.length) {
      params.set("impact", config.impactFilter.join(","));
    }

    const response = await fetch(buildApiUrl(`/api/calendar/events?${params}`));

    if (!response.ok) {
      console.error("[EconomicCalendar] API error:", response.status);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.events) {
      return [];
    }

    // Convert API response to our format
    return data.events.map((e: any) => ({
      id: e.id,
      name: e.name,
      datetime: new Date(e.datetime),
      impact: e.impact as EventImpact,
      category: (e.category || "OTHER") as EventCategory,
      affectsSymbols: e.affectsSymbols || ["SPY", "SPX"],
      previous: e.previous,
      forecast: e.forecast,
      actual: e.actual,
    }));
  } catch (error) {
    console.error("[EconomicCalendar] Failed to fetch:", error);
    return [];
  }
}

/**
 * Fetch earnings calendar from our server API (powered by Alpha Vantage)
 */
export async function fetchEarningsCalendar(
  startDate: Date,
  endDate: Date,
  symbols?: string[]
): Promise<EarningsEvent[]> {
  // In test env, return deterministic stub data without network calls
  if (IS_TEST) {
    const stub: EarningsEvent[] = [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        datetime: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        timing: "AMC",
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corp.",
        datetime: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        timing: "BMO",
      },
    ];
    const filtered = stub.filter((e) => e.datetime >= startDate && e.datetime <= endDate);
    if (symbols?.length) {
      return filtered.filter((e) => symbols.includes(e.symbol));
    }
    return filtered;
  }

  try {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    if (symbols?.length) {
      params.set("symbols", symbols.join(","));
    }

    const response = await fetch(buildApiUrl(`/api/calendar/earnings?${params}`));

    if (!response.ok) {
      console.error("[EconomicCalendar] Earnings API error:", response.status);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.earnings) {
      return [];
    }

    // Convert API response to our format
    return data.earnings.map((e: any) => ({
      symbol: e.symbol,
      name: e.name || `${e.symbol} Inc.`,
      datetime: new Date(e.datetime),
      timing: (e.timing || "AMC") as EarningsTiming,
      expectedMove: e.expectedMove,
      ivRank: e.ivRank,
      estimate: e.estimate,
    }));
  } catch (error) {
    console.error("[EconomicCalendar] Failed to fetch earnings:", error);
    return [];
  }
}

/**
 * Fetch full calendar analysis from server
 */
export async function fetchCalendarAnalysis(
  watchlistSymbols: string[]
): Promise<CalendarAnalysis | null> {
  try {
    const params = new URLSearchParams({
      symbols: watchlistSymbols.join(","),
    });

    const response = await fetch(`/api/calendar/analysis?${params}`);

    if (!response.ok) {
      console.error("[EconomicCalendar] Analysis API error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.analysis) {
      return null;
    }

    const analysis = data.analysis;

    // Convert dates in response
    return {
      eventsNext24h: analysis.eventsNext24h.map((e: any) => ({
        ...e,
        datetime: new Date(e.datetime),
      })),
      eventsNext7d: analysis.eventsNext7d.map((e: any) => ({
        ...e,
        datetime: new Date(e.datetime),
      })),
      earningsThisWeek: analysis.earningsThisWeek.map((e: any) => ({
        ...e,
        datetime: new Date(e.datetime),
      })),
      tradingRecommendations: analysis.tradingRecommendations,
      highRiskPeriods: analysis.highRiskPeriods.map((p: any) => ({
        ...p,
        start: new Date(p.start),
        end: new Date(p.end),
      })),
      marketSentiment: analysis.marketSentiment,
      volatilityOutlook: analysis.volatilityOutlook,
    };
  } catch (error) {
    console.error("[EconomicCalendar] Failed to fetch analysis:", error);
    return null;
  }
}

// ============= Analysis Functions =============

/**
 * Analyze calendar for trading implications (client-side)
 */
export function analyzeCalendarForTrading(
  events: EconomicEvent[],
  earnings: EarningsEvent[],
  watchlistSymbols: string[]
): CalendarAnalysis {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filter events by timeframe
  const eventsNext24h = events.filter((e) => e.datetime >= now && e.datetime <= tomorrow);
  const eventsNext7d = events.filter((e) => e.datetime >= now && e.datetime <= nextWeek);

  // Filter earnings
  const earningsThisWeek = earnings.filter((e) => e.datetime >= now && e.datetime <= nextWeek);

  // Generate high-risk periods
  const highRiskPeriods = identifyHighRiskPeriods(events, earnings);

  // Generate trading recommendations
  const tradingRecommendations = generateTradingRecommendations(
    eventsNext24h,
    eventsNext7d,
    earningsThisWeek,
    watchlistSymbols
  );

  // Determine market sentiment based on upcoming events
  const marketSentiment = determineMarketSentiment(eventsNext7d);
  const volatilityOutlook = determineVolatilityOutlook(eventsNext7d, earningsThisWeek);

  return {
    eventsNext24h,
    eventsNext7d,
    earningsThisWeek,
    tradingRecommendations,
    highRiskPeriods,
    marketSentiment,
    volatilityOutlook,
  };
}

/**
 * Check if current time is near a high-impact event
 */
export function isNearHighImpactEvent(
  events: EconomicEvent[],
  bufferMinutes: number = 30
): { isNear: boolean; event: EconomicEvent | null; minutesUntil: number } {
  const now = new Date();

  for (const event of events) {
    if (event.impact === "CRITICAL" || event.impact === "HIGH") {
      const minutesUntil = (event.datetime.getTime() - now.getTime()) / (1000 * 60);

      if (minutesUntil >= -bufferMinutes && minutesUntil <= bufferMinutes) {
        return { isNear: true, event, minutesUntil };
      }
    }
  }

  return { isNear: false, event: null, minutesUntil: Infinity };
}

/**
 * Get events affecting a specific symbol
 */
export function getEventsForSymbol(events: EconomicEvent[], symbol: string): EconomicEvent[] {
  const normalizedSymbol = symbol.toUpperCase();
  return events.filter(
    (e) => e.affectsSymbols.includes(normalizedSymbol) || e.affectsSymbols.includes("SPY") // Major events affect all equities
  );
}

/**
 * Format event for display
 */
export function formatEventDisplay(event: EconomicEvent): string {
  const impactEmoji = {
    CRITICAL: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  const timeStr = event.datetime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${impactEmoji[event.impact]} ${timeStr} - ${event.name}`;
}

// ============= Helper Functions =============

function identifyHighRiskPeriods(
  events: EconomicEvent[],
  earnings: EarningsEvent[]
): HighRiskPeriod[] {
  const periods: HighRiskPeriod[] = [];

  // Group critical/high events that are close together
  const criticalEvents = events.filter((e) => e.impact === "CRITICAL" || e.impact === "HIGH");

  criticalEvents.forEach((event) => {
    const buffer = EVENT_BUFFER[event.impact];
    const start = new Date(event.datetime.getTime() - buffer * 60 * 1000);
    const end = new Date(event.datetime.getTime() + buffer * 60 * 1000);

    periods.push({
      start,
      end,
      reason: event.name,
      events: [event.name],
      riskLevel: event.impact,
    });
  });

  // Add earnings periods
  earnings.forEach((earning) => {
    const start = new Date(earning.datetime.getTime() - 60 * 60 * 1000);
    const end = new Date(earning.datetime.getTime() + 60 * 60 * 1000);

    periods.push({
      start,
      end,
      reason: `${earning.symbol} Earnings`,
      events: [`${earning.symbol} Earnings (${earning.timing})`],
      riskLevel: "HIGH",
    });
  });

  return periods.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function generateTradingRecommendations(
  eventsNext24h: EconomicEvent[],
  eventsNext7d: EconomicEvent[],
  earnings: EarningsEvent[],
  watchlistSymbols: string[]
): string[] {
  const recommendations: string[] = [];

  // Check for critical events in next 24h
  const criticalSoon = eventsNext24h.filter((e) => e.impact === "CRITICAL");
  if (criticalSoon.length > 0) {
    recommendations.push(
      `CAUTION: ${criticalSoon.length} critical event(s) in next 24h - consider reducing position sizes`
    );
  }

  // Check for FOMC
  const fomcEvent = eventsNext7d.find((e) => e.name.includes("FOMC"));
  if (fomcEvent) {
    recommendations.push(
      `FOMC meeting on ${fomcEvent.datetime.toLocaleDateString()} - expect elevated VIX leading into event`
    );
  }

  // Check for CPI
  const cpiEvent = eventsNext7d.find((e) => e.name === "CPI");
  if (cpiEvent) {
    recommendations.push(
      `CPI release on ${cpiEvent.datetime.toLocaleDateString()} - inflation data drives Fed expectations`
    );
  }

  // Check for NFP
  const nfpEvent = eventsNext7d.find((e) => e.name.includes("Non-Farm") || e.name.includes("NFP"));
  if (nfpEvent) {
    recommendations.push(
      `Jobs report on ${nfpEvent.datetime.toLocaleDateString()} - avoid holding 0DTE through release`
    );
  }

  // Earnings warnings for watchlist
  const watchlistEarnings = earnings.filter((e) => watchlistSymbols.includes(e.symbol));
  if (watchlistEarnings.length > 0) {
    recommendations.push(
      `${watchlistEarnings.length} watchlist stock(s) reporting earnings this week - IV likely elevated`
    );
  }

  // General advice based on event density
  const highImpactCount = eventsNext7d.filter(
    (e) => e.impact === "CRITICAL" || e.impact === "HIGH"
  ).length;
  if (highImpactCount >= 3) {
    recommendations.push("Busy week ahead - consider shorter DTE to avoid multiple event risks");
  } else if (highImpactCount === 0) {
    recommendations.push("Light calendar week - favorable for swing trades with longer DTE");
  }

  return recommendations;
}

function determineMarketSentiment(events: EconomicEvent[]): "risk-on" | "risk-off" | "neutral" {
  const criticalCount = events.filter((e) => e.impact === "CRITICAL").length;
  const fedEvents = events.filter((e) => e.category === "FED").length;

  if (criticalCount >= 2 || fedEvents >= 2) {
    return "risk-off";
  }
  if (criticalCount === 0 && fedEvents === 0) {
    return "risk-on";
  }
  return "neutral";
}

function determineVolatilityOutlook(
  events: EconomicEvent[],
  earnings: EarningsEvent[]
): "elevated" | "normal" | "low" {
  const highImpactEvents = events.filter(
    (e) => e.impact === "CRITICAL" || e.impact === "HIGH"
  ).length;
  const majorEarnings = earnings.length;

  if (highImpactEvents >= 3 || majorEarnings >= 5) {
    return "elevated";
  }
  if (highImpactEvents === 0 && majorEarnings <= 1) {
    return "low";
  }
  return "normal";
}

export default {
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  fetchCalendarAnalysis,
  analyzeCalendarForTrading,
  isNearHighImpactEvent,
  getEventsForSymbol,
  formatEventDisplay,
};
