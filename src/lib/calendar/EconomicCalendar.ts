/**
 * EconomicCalendar.ts - Economic Calendar Integration
 *
 * Phase 2.4: Track economic events that impact trading decisions
 * - Federal Reserve events (FOMC, speeches)
 * - Employment data (NFP, unemployment)
 * - Inflation data (CPI, PPI)
 * - GDP and economic indicators
 * - Major earnings events
 */

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

// ============= Service Functions =============

/**
 * Fetch economic calendar from API
 * In production, this would call a real API (investing.com, marketwatch, etc.)
 */
export async function fetchEconomicCalendar(
  startDate: Date,
  endDate: Date,
  config: CalendarConfig = {}
): Promise<EconomicEvent[]> {
  // For now, return mock data based on typical weekly schedule
  // In production, replace with actual API call
  return generateMockCalendarEvents(startDate, endDate, config);
}

/**
 * Fetch earnings calendar
 */
export async function fetchEarningsCalendar(
  startDate: Date,
  endDate: Date,
  symbols?: string[]
): Promise<EarningsEvent[]> {
  // Mock earnings data - in production, call earnings API
  return generateMockEarningsEvents(startDate, endDate, symbols);
}

/**
 * Analyze calendar for trading implications
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

  // Check for NFP/CPI
  const majorDataEvent = eventsNext7d.find(
    (e) => e.name.includes("Non-Farm") || e.name.includes("CPI")
  );
  if (majorDataEvent) {
    recommendations.push(
      `${majorDataEvent.name} on ${majorDataEvent.datetime.toLocaleDateString()} - avoid holding 0DTE through release`
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

// ============= Mock Data Generators =============

function generateMockCalendarEvents(
  startDate: Date,
  endDate: Date,
  config: CalendarConfig
): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();

    // Typical weekly schedule
    if (dayOfWeek === 1) {
      // Monday - sometimes ISM
      if (Math.random() > 0.7) {
        events.push(createEvent("ISM Manufacturing", current, 10, 0));
      }
    } else if (dayOfWeek === 2) {
      // Tuesday - sometimes Fed speech
      if (Math.random() > 0.8) {
        events.push(createEvent("Fed Chair Speech", current, 14, 0));
      }
    } else if (dayOfWeek === 3) {
      // Wednesday - FOMC (every 6 weeks) or ADP
      if (isFirstWednesday(current) && Math.random() > 0.5) {
        events.push(createEvent("FOMC Meeting", current, 14, 0));
      } else {
        events.push(createEvent("ADP Employment", current, 8, 15));
      }
    } else if (dayOfWeek === 4) {
      // Thursday - Jobless Claims
      events.push(createEvent("Initial Jobless Claims", current, 8, 30));
    } else if (dayOfWeek === 5) {
      // Friday - First Friday = NFP
      if (isFirstFriday(current)) {
        events.push(createEvent("Non-Farm Payrolls", current, 8, 30));
        events.push(createEvent("Unemployment Rate", current, 8, 30));
      }
    }

    // Monthly events (CPI, PPI typically mid-month)
    if (current.getDate() >= 10 && current.getDate() <= 15 && dayOfWeek >= 2 && dayOfWeek <= 4) {
      if (Math.random() > 0.7) {
        events.push(createEvent("CPI", current, 8, 30));
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // Apply impact filter if specified
  if (config.impactFilter && config.impactFilter.length > 0) {
    return events.filter((e) => config.impactFilter!.includes(e.impact));
  }

  return events;
}

function generateMockEarningsEvents(
  startDate: Date,
  endDate: Date,
  symbols?: string[]
): EarningsEvent[] {
  const events: EarningsEvent[] = [];
  const majorStocks = symbols || ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"];

  // Randomly assign some stocks to report this week
  const reporting = majorStocks.filter(() => Math.random() > 0.7).slice(0, 3);

  reporting.forEach((symbol, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index + 2); // Spread across week

    events.push({
      symbol,
      name: `${symbol} Inc.`,
      datetime: date,
      timing: Math.random() > 0.5 ? "AMC" : "BMO",
      expectedMove: 3 + Math.random() * 5,
      ivRank: 50 + Math.random() * 40,
      historicalBeatRate: 0.6 + Math.random() * 0.3,
    });
  });

  return events;
}

function createEvent(name: string, date: Date, hour: number, minute: number): EconomicEvent {
  const eventData = MAJOR_ECONOMIC_EVENTS[name] || {
    impact: "LOW" as EventImpact,
    category: "OTHER" as EventCategory,
    affectsSymbols: ["SPY"],
  };

  const datetime = new Date(date);
  datetime.setHours(hour, minute, 0, 0);

  return {
    id: `${name}-${datetime.toISOString()}`,
    name,
    datetime,
    impact: eventData.impact,
    category: eventData.category,
    affectsSymbols: eventData.affectsSymbols,
  };
}

function isFirstFriday(date: Date): boolean {
  return date.getDay() === 5 && date.getDate() <= 7;
}

function isFirstWednesday(date: Date): boolean {
  return date.getDay() === 3 && date.getDate() <= 7;
}

export default {
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  analyzeCalendarForTrading,
  isNearHighImpactEvent,
  getEventsForSymbol,
  formatEventDisplay,
};
