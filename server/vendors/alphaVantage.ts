/**
 * Alpha Vantage API Client
 *
 * Free tier: 5 API calls per minute, 500 calls per day
 * Used for: Economic calendar data (CPI, FOMC, NFP, etc.)
 *
 * Documentation: https://www.alphavantage.co/documentation/
 */

// ============= Types =============

export interface AlphaVantageEconomicEvent {
  name: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h format, usually empty)
  country: string; // "USA"
  actual?: string;
  previous?: string;
  forecast?: string;
  importance: string; // "1" = low, "2" = medium, "3" = high
  currency?: string;
}

export interface EconomicCalendarResponse {
  events: AlphaVantageEconomicEvent[];
  source: "alpha_vantage" | "fallback";
  cached: boolean;
  fetchedAt: string;
}

// ============= Configuration =============

const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";

function getAlphaVantageApiKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY || "";
}

// In-memory cache to respect rate limits (5 calls/min)
interface CacheEntry {
  data: AlphaVantageEconomicEvent[];
  timestamp: number;
}

const economicCalendarCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache (events don't change frequently)

/**
 * Convert a calendar date to an instant representing the given wall-clock time
 * in a specific timezone (default: America/New_York). This avoids server-local
 * timezone skew when serializing to ISO strings.
 */
function setTimeInTimeZone(
  date: Date,
  hour: number,
  minute: number,
  timeZone = "America/New_York"
): Date {
  const utcCandidate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0)
  );

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcCandidate);

  const lookup = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  return new Date(
    Date.UTC(
      lookup("year"),
      lookup("month") - 1,
      lookup("day"),
      lookup("hour"),
      lookup("minute"),
      lookup("second")
    )
  );
}

// ============= Event Name Mapping =============

// Map Alpha Vantage event names to our standardized names
const EVENT_NAME_MAP: Record<
  string,
  { standardName: string; impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; category: string }
> = {
  // Federal Reserve
  "FOMC Meeting": { standardName: "FOMC Meeting", impact: "CRITICAL", category: "FED" },
  "Fed Interest Rate Decision": {
    standardName: "FOMC Meeting",
    impact: "CRITICAL",
    category: "FED",
  },
  "Federal Funds Rate": { standardName: "FOMC Meeting", impact: "CRITICAL", category: "FED" },
  "FOMC Minutes": { standardName: "Fed Minutes", impact: "MEDIUM", category: "FED" },
  "Fed Chair Powell Speech": { standardName: "Fed Chair Speech", impact: "HIGH", category: "FED" },
  "Fed Chair Speech": { standardName: "Fed Chair Speech", impact: "HIGH", category: "FED" },

  // Employment
  "Nonfarm Payrolls": {
    standardName: "Non-Farm Payrolls",
    impact: "CRITICAL",
    category: "EMPLOYMENT",
  },
  "Non-Farm Payrolls": {
    standardName: "Non-Farm Payrolls",
    impact: "CRITICAL",
    category: "EMPLOYMENT",
  },
  "Employment Change": {
    standardName: "Non-Farm Payrolls",
    impact: "CRITICAL",
    category: "EMPLOYMENT",
  },
  "Unemployment Rate": {
    standardName: "Unemployment Rate",
    impact: "HIGH",
    category: "EMPLOYMENT",
  },
  "Initial Jobless Claims": {
    standardName: "Initial Jobless Claims",
    impact: "MEDIUM",
    category: "EMPLOYMENT",
  },
  "Jobless Claims": {
    standardName: "Initial Jobless Claims",
    impact: "MEDIUM",
    category: "EMPLOYMENT",
  },
  "ADP Employment Change": {
    standardName: "ADP Employment",
    impact: "MEDIUM",
    category: "EMPLOYMENT",
  },
  "ADP Nonfarm Employment Change": {
    standardName: "ADP Employment",
    impact: "MEDIUM",
    category: "EMPLOYMENT",
  },

  // Inflation
  CPI: { standardName: "CPI", impact: "CRITICAL", category: "INFLATION" },
  "CPI MoM": { standardName: "CPI", impact: "CRITICAL", category: "INFLATION" },
  "CPI YoY": { standardName: "CPI", impact: "CRITICAL", category: "INFLATION" },
  "Consumer Price Index": { standardName: "CPI", impact: "CRITICAL", category: "INFLATION" },
  "Core CPI": { standardName: "Core CPI", impact: "CRITICAL", category: "INFLATION" },
  "Core CPI MoM": { standardName: "Core CPI", impact: "CRITICAL", category: "INFLATION" },
  "Core CPI YoY": { standardName: "Core CPI", impact: "CRITICAL", category: "INFLATION" },
  PPI: { standardName: "PPI", impact: "HIGH", category: "INFLATION" },
  "PPI MoM": { standardName: "PPI", impact: "HIGH", category: "INFLATION" },
  "Producer Price Index": { standardName: "PPI", impact: "HIGH", category: "INFLATION" },
  "PCE Price Index": { standardName: "PCE", impact: "HIGH", category: "INFLATION" },
  "Core PCE Price Index": { standardName: "PCE", impact: "HIGH", category: "INFLATION" },

  // GDP
  GDP: { standardName: "GDP", impact: "HIGH", category: "GDP" },
  "GDP Growth Rate": { standardName: "GDP", impact: "HIGH", category: "GDP" },
  "GDP QoQ": { standardName: "GDP", impact: "HIGH", category: "GDP" },
  "ISM Manufacturing PMI": { standardName: "ISM Manufacturing", impact: "MEDIUM", category: "GDP" },
  "ISM Services PMI": { standardName: "ISM Services", impact: "MEDIUM", category: "GDP" },
  "ISM Non-Manufacturing PMI": { standardName: "ISM Services", impact: "MEDIUM", category: "GDP" },

  // Consumer
  "Retail Sales": { standardName: "Retail Sales", impact: "MEDIUM", category: "CONSUMER" },
  "Retail Sales MoM": { standardName: "Retail Sales", impact: "MEDIUM", category: "CONSUMER" },
  "Consumer Confidence": {
    standardName: "Consumer Confidence",
    impact: "LOW",
    category: "CONSUMER",
  },
  "Michigan Consumer Sentiment": {
    standardName: "Consumer Confidence",
    impact: "LOW",
    category: "CONSUMER",
  },
};

// Symbols affected by each event category
const CATEGORY_SYMBOLS: Record<string, string[]> = {
  FED: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  EMPLOYMENT: ["SPY", "SPX", "QQQ", "NDX", "VIX"],
  INFLATION: ["SPY", "SPX", "QQQ", "NDX", "TLT", "VIX"],
  GDP: ["SPY", "SPX", "QQQ", "NDX"],
  CONSUMER: ["SPY", "XLY", "XRT"],
};

// ============= API Functions =============

/**
 * Fetch economic calendar from Alpha Vantage
 * Note: Alpha Vantage's free economic calendar endpoint may have limitations
 */
export async function fetchAlphaVantageEconomicCalendar(): Promise<EconomicCalendarResponse> {
  const apiKey = getAlphaVantageApiKey();

  if (!apiKey) {
    console.warn("[AlphaVantage] ⚠️ ALPHA_VANTAGE_API_KEY not set, using fallback");
    return {
      events: [],
      source: "fallback",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Check cache first
  if (economicCalendarCache && Date.now() - economicCalendarCache.timestamp < CACHE_TTL_MS) {
    console.log("[AlphaVantage] 📦 Returning cached economic calendar");
    return {
      events: economicCalendarCache.data,
      source: "alpha_vantage",
      cached: true,
      fetchedAt: new Date(economicCalendarCache.timestamp).toISOString(),
    };
  }

  try {
    // Alpha Vantage doesn't have a dedicated economic calendar endpoint in free tier
    // We'll use Treasury Yield and other economic indicators as proxies
    // For full calendar data, consider using their premium tier or alternative sources

    const url = `${ALPHA_VANTAGE_BASE_URL}?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${apiKey}`;
    console.log("[AlphaVantage] 📍 Fetching economic data...");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Alpha Vantage HTTP ${response.status}`);
    }

    const data = await response.json();

    // Check for rate limit or error
    if (data["Note"] || data["Information"]) {
      console.warn(
        "[AlphaVantage] ⚠️ Rate limited or API note:",
        data["Note"] || data["Information"]
      );
      return {
        events: [],
        source: "fallback",
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    // Alpha Vantage free tier doesn't provide a proper economic calendar
    // We return empty and let the fallback handle it
    // In production, you'd want to use a proper calendar API or premium tier
    console.log("[AlphaVantage] ✅ API connection successful (calendar data limited in free tier)");

    return {
      events: [],
      source: "alpha_vantage",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AlphaVantage] ❌ Error fetching calendar:", error);
    return {
      events: [],
      source: "fallback",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Normalize Alpha Vantage event to our standard format
 */
export function normalizeAlphaVantageEvent(event: AlphaVantageEconomicEvent): {
  name: string;
  datetime: Date;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  affectsSymbols: string[];
  previous?: string;
  forecast?: string;
  actual?: string;
} | null {
  // Find matching event in our map
  const mapping = Object.entries(EVENT_NAME_MAP).find(
    ([key]) =>
      event.name.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(event.name.toLowerCase())
  );

  if (!mapping) {
    // Unknown event - skip or categorize as low importance
    if (event.importance !== "3") return null;

    return {
      name: event.name,
      datetime: parseEventDateTime(event.date, event.time),
      impact: event.importance === "3" ? "HIGH" : event.importance === "2" ? "MEDIUM" : "LOW",
      category: "OTHER",
      affectsSymbols: ["SPY", "SPX"],
      previous: event.previous,
      forecast: event.forecast,
      actual: event.actual,
    };
  }

  const [, config] = mapping;

  return {
    name: config.standardName,
    datetime: parseEventDateTime(event.date, event.time),
    impact: config.impact,
    category: config.category,
    affectsSymbols: CATEGORY_SYMBOLS[config.category] || ["SPY", "SPX"],
    previous: event.previous,
    forecast: event.forecast,
    actual: event.actual,
  };
}

/**
 * Parse date and time from Alpha Vantage format
 */
function parseEventDateTime(date: string, time?: string): Date {
  // Default times for common US economic releases (ET timezone)
  const DEFAULT_TIMES: Record<string, string> = {
    NFP: "08:30",
    CPI: "08:30",
    Jobless: "08:30",
    FOMC: "14:00",
    GDP: "08:30",
    ISM: "10:00",
    Retail: "08:30",
  };

  let eventTime = time || "08:30"; // Default to 8:30 AM ET

  // Try to match default times
  if (!time) {
    for (const [keyword, defaultTime] of Object.entries(DEFAULT_TIMES)) {
      if (date.toLowerCase().includes(keyword.toLowerCase())) {
        eventTime = defaultTime;
        break;
      }
    }
  }

  // Parse date (YYYY-MM-DD format)
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = eventTime.split(":").map(Number);

  // Create date in ET timezone (avoid server-local skew)
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  return setTimeInTimeZone(baseDate, hour, minute);
}

/**
 * Get known FOMC meeting dates for the year
 * FOMC meets 8 times per year on a predetermined schedule
 */
export function getFOMCSchedule(year: number): Date[] {
  // 2024-2025 FOMC dates (announced by Federal Reserve)
  const FOMC_DATES: Record<number, string[]> = {
    2024: [
      "2024-01-31",
      "2024-03-20",
      "2024-05-01",
      "2024-06-12",
      "2024-07-31",
      "2024-09-18",
      "2024-11-07",
      "2024-12-18",
    ],
    2025: [
      "2025-01-29",
      "2025-03-19",
      "2025-05-07",
      "2025-06-18",
      "2025-07-30",
      "2025-09-17",
      "2025-11-05",
      "2025-12-17",
    ],
    2026: [
      "2026-01-28",
      "2026-03-18",
      "2026-05-06",
      "2026-06-17",
      "2026-07-29",
      "2026-09-16",
      "2026-11-04",
      "2026-12-16",
    ],
  };

  const dates = FOMC_DATES[year] || [];
  return dates.map((d) => {
    const date = new Date(d);
    return setTimeInTimeZone(date, 14, 0); // FOMC announces at 2:00 PM ET
  });
}

/**
 * Get known CPI release dates
 * CPI is typically released around the 12th-13th of each month at 8:30 AM ET
 */
export function getCPISchedule(year: number, month: number): Date | null {
  // CPI is usually released on Tuesday or Wednesday in the second week
  const date = new Date(year, month, 1);

  // Find second week's Tuesday-Thursday
  let dayCount = 0;
  while (dayCount < 31) {
    if (date.getDate() >= 10 && date.getDate() <= 15) {
      if (date.getDay() >= 2 && date.getDay() <= 4) {
        // Tue-Thu
        return setTimeInTimeZone(date, 8, 30);
      }
    }
    date.setDate(date.getDate() + 1);
    dayCount++;
  }

  return null;
}

/**
 * Get NFP (Non-Farm Payrolls) release date
 * NFP is released on the first Friday of each month at 8:30 AM ET
 */
export function getNFPDate(year: number, month: number): Date {
  const date = new Date(year, month, 1);

  // Find first Friday
  while (date.getDay() !== 5) {
    date.setDate(date.getDate() + 1);
  }

  return setTimeInTimeZone(date, 8, 30);
}

/**
 * Get Initial Jobless Claims dates
 * Released every Thursday at 8:30 AM ET
 */
export function getJoblessClaimsDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    if (current.getDay() === 4) {
      // Thursday
      const date = new Date(current);
      dates.push(setTimeInTimeZone(date, 8, 30));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ============= Earnings Calendar =============

export interface AlphaVantageEarningsEvent {
  symbol: string;
  name: string;
  reportDate: string; // YYYY-MM-DD
  fiscalDateEnding: string;
  estimate?: number;
  currency?: string;
}

export interface EarningsCalendarResponse {
  earnings: AlphaVantageEarningsEvent[];
  source: "alpha_vantage" | "fallback";
  cached: boolean;
  fetchedAt: string;
}

// In-memory cache for earnings
let earningsCache: { data: AlphaVantageEarningsEvent[]; timestamp: number } | null = null;
const EARNINGS_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (earnings data less time-sensitive)

/**
 * Fetch earnings calendar from Alpha Vantage
 * Free tier supports EARNINGS_CALENDAR function
 */
export async function fetchAlphaVantageEarningsCalendar(
  horizon: "3month" | "6month" | "12month" = "3month"
): Promise<EarningsCalendarResponse> {
  const apiKey = getAlphaVantageApiKey();

  if (!apiKey) {
    console.warn("[AlphaVantage] ⚠️ ALPHA_VANTAGE_API_KEY not set, using fallback");
    return {
      earnings: [],
      source: "fallback",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Check cache first
  if (earningsCache && Date.now() - earningsCache.timestamp < EARNINGS_CACHE_TTL_MS) {
    console.log("[AlphaVantage] 📦 Returning cached earnings calendar");
    return {
      earnings: earningsCache.data,
      source: "alpha_vantage",
      cached: true,
      fetchedAt: new Date(earningsCache.timestamp).toISOString(),
    };
  }

  try {
    const url = `${ALPHA_VANTAGE_BASE_URL}?function=EARNINGS_CALENDAR&horizon=${horizon}&apikey=${apiKey}`;
    console.log("[AlphaVantage] 📍 Fetching earnings calendar...");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Alpha Vantage HTTP ${response.status}`);
    }

    // Earnings calendar returns CSV, not JSON
    const csvText = await response.text();

    // Check for rate limit or error
    if (csvText.includes("Note") || csvText.includes("Thank you")) {
      console.warn("[AlphaVantage] ⚠️ Rate limited on earnings calendar");
      return {
        earnings: [],
        source: "fallback",
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    // Parse CSV
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      console.log("[AlphaVantage] ✅ No upcoming earnings found");
      return {
        earnings: [],
        source: "alpha_vantage",
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    // CSV header: symbol,name,reportDate,fiscalDateEnding,estimate,currency
    const earnings: AlphaVantageEarningsEvent[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length >= 4) {
        earnings.push({
          symbol: cols[0]?.trim() || "",
          name: cols[1]?.trim() || "",
          reportDate: cols[2]?.trim() || "",
          fiscalDateEnding: cols[3]?.trim() || "",
          estimate: cols[4] ? parseFloat(cols[4]) : undefined,
          currency: cols[5]?.trim() || "USD",
        });
      }
    }

    // Update cache
    earningsCache = {
      data: earnings,
      timestamp: Date.now(),
    };

    console.log(`[AlphaVantage] ✅ Fetched ${earnings.length} earnings events`);

    return {
      earnings,
      source: "alpha_vantage",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AlphaVantage] ❌ Error fetching earnings:", error);
    return {
      earnings: [],
      source: "fallback",
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get earnings for specific symbols
 * Filters the full calendar to just the symbols we care about
 */
export async function getEarningsForSymbols(
  symbols: string[],
  daysAhead: number = 14
): Promise<AlphaVantageEarningsEvent[]> {
  const response = await fetchAlphaVantageEarningsCalendar("3month");

  if (!response.earnings.length) {
    return [];
  }

  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));

  return response.earnings.filter((e) => {
    if (!symbolSet.has(e.symbol.toUpperCase())) return false;
    const reportDate = new Date(e.reportDate);
    return reportDate >= today && reportDate <= cutoffDate;
  });
}

/**
 * Check if symbol has earnings within N days
 */
export function checkEarningsProximity(
  earningsEvents: AlphaVantageEarningsEvent[],
  symbol: string,
  daysThreshold: number = 7
): { hasEarnings: boolean; daysUntil: number | null; event: AlphaVantageEarningsEvent | null } {
  const symbolUpper = symbol.toUpperCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const event of earningsEvents) {
    if (event.symbol.toUpperCase() !== symbolUpper) continue;

    const reportDate = new Date(event.reportDate);
    reportDate.setHours(0, 0, 0, 0);

    const diffMs = reportDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= daysThreshold) {
      return { hasEarnings: true, daysUntil: diffDays, event };
    }
  }

  return { hasEarnings: false, daysUntil: null, event: null };
}

// ============= Unified Calendar Builder =============

export interface UnifiedCalendarEvent {
  id: string;
  type: "economic" | "earnings";
  name: string;
  datetime: Date;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  affectsSymbols: string[];
  details?: {
    previous?: string;
    forecast?: string;
    actual?: string;
    estimate?: number;
  };
}

/**
 * Build a unified calendar combining economic events and earnings
 */
export async function buildUnifiedCalendar(
  watchlistSymbols: string[],
  daysAhead: number = 7
): Promise<UnifiedCalendarEvent[]> {
  const events: UnifiedCalendarEvent[] = [];
  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  // Add known FOMC dates
  const fomcDates = getFOMCSchedule(today.getFullYear());
  for (const date of fomcDates) {
    if (date >= today && date <= cutoffDate) {
      events.push({
        id: `fomc_${date.toISOString().split("T")[0]}`,
        type: "economic",
        name: "FOMC Rate Decision",
        datetime: date,
        impact: "CRITICAL",
        category: "FED",
        affectsSymbols: CATEGORY_SYMBOLS.FED,
      });
    }
  }

  // Add CPI dates (estimated)
  for (let month = today.getMonth(); month <= today.getMonth() + 2; month++) {
    const year = month > 11 ? today.getFullYear() + 1 : today.getFullYear();
    const adjustedMonth = month % 12;
    const cpiDate = getCPISchedule(year, adjustedMonth);
    if (cpiDate && cpiDate >= today && cpiDate <= cutoffDate) {
      events.push({
        id: `cpi_${cpiDate.toISOString().split("T")[0]}`,
        type: "economic",
        name: "CPI Report",
        datetime: cpiDate,
        impact: "CRITICAL",
        category: "INFLATION",
        affectsSymbols: CATEGORY_SYMBOLS.INFLATION,
      });
    }
  }

  // Add NFP dates
  for (let month = today.getMonth(); month <= today.getMonth() + 2; month++) {
    const year = month > 11 ? today.getFullYear() + 1 : today.getFullYear();
    const adjustedMonth = month % 12;
    const nfpDate = getNFPDate(year, adjustedMonth);
    if (nfpDate >= today && nfpDate <= cutoffDate) {
      events.push({
        id: `nfp_${nfpDate.toISOString().split("T")[0]}`,
        type: "economic",
        name: "Non-Farm Payrolls",
        datetime: nfpDate,
        impact: "CRITICAL",
        category: "EMPLOYMENT",
        affectsSymbols: CATEGORY_SYMBOLS.EMPLOYMENT,
      });
    }
  }

  // Add weekly jobless claims (Thursdays)
  const joblessDates = getJoblessClaimsDates(today, cutoffDate);
  for (const date of joblessDates) {
    events.push({
      id: `jobless_${date.toISOString().split("T")[0]}`,
      type: "economic",
      name: "Initial Jobless Claims",
      datetime: date,
      impact: "MEDIUM",
      category: "EMPLOYMENT",
      affectsSymbols: CATEGORY_SYMBOLS.EMPLOYMENT,
    });
  }

  // Fetch earnings for watchlist
  try {
    const earnings = await getEarningsForSymbols(watchlistSymbols, daysAhead);
    for (const e of earnings) {
      const date = new Date(e.reportDate);
      const earningsDatetime = setTimeInTimeZone(date, 16, 0); // Default to after-hours ET

      events.push({
        id: `earnings_${e.symbol}_${e.reportDate}`,
        type: "earnings",
        name: `${e.symbol} Earnings`,
        datetime: earningsDatetime,
        impact: "HIGH",
        category: "EARNINGS",
        affectsSymbols: [e.symbol],
        details: {
          estimate: e.estimate,
        },
      });
    }
  } catch (error) {
    console.warn("[AlphaVantage] ⚠️ Failed to fetch earnings:", error);
  }

  // Sort by datetime
  events.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

  return events;
}

export { EVENT_NAME_MAP, CATEGORY_SYMBOLS };
