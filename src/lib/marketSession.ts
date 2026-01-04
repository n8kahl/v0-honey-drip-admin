// Determines current market session (PRE, OPEN, POST, CLOSED)
// Based on Massive.com market status API

export type MarketSession = "PRE" | "OPEN" | "POST" | "CLOSED";

export interface MarketSessionState {
  session: MarketSession;
  asOf: string; // ISO timestamp of last status check
  source: "Massive";
  isLive: boolean; // Whether market is trading (PRE/OPEN/POST)
  label: string; // Display label
}

export interface MassiveMarketStatusResponse {
  market: "open" | "closed";
  serverTime: string;
  exchanges: {
    nyse: string;
    nasdaq: string;
    otc: string;
  };
  currencies: {
    fx: string;
    crypto: string;
  };
  earlyHours: boolean;
  afterHours: boolean;
}

/**
 * Parse Massive market status response into MarketSession
 */
export function parseMarketSession(data: MassiveMarketStatusResponse): MarketSessionState {
  let session: MarketSession;
  let label: string;
  let isLive: boolean;

  if (data.market === "open") {
    session = "OPEN";
    label = "Regular Session";
    isLive = true;
  } else if (data.earlyHours) {
    session = "PRE";
    label = "Pre-Market";
    isLive = true;
  } else if (data.afterHours) {
    session = "POST";
    label = "After Hours";
    isLive = true;
  } else {
    session = "CLOSED";
    label = "Market Closed";
    isLive = false;
  }

  return {
    session,
    asOf: data.serverTime || new Date().toISOString(),
    source: "Massive",
    isLive,
    label,
  };
}

/**
 * Get fallback session based on time (if API fails)
 * This uses EST/EDT time to determine session
 */
export function getFallbackSession(): MarketSessionState {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // Weekend: always closed
  if (day === 0 || day === 6) {
    return {
      session: "CLOSED",
      asOf: now.toISOString(),
      source: "Massive",
      isLive: false,
      label: "Market Closed (Weekend)",
    };
  }

  // Pre-market: 4:00 AM - 9:30 AM ET
  const preMarketStart = 4 * 60; // 4:00 AM
  const marketOpen = 9 * 60 + 30; // 9:30 AM

  // Regular session: 9:30 AM - 4:00 PM ET
  const marketClose = 16 * 60; // 4:00 PM

  // After-hours: 4:00 PM - 8:00 PM ET
  const afterHoursEnd = 20 * 60; // 8:00 PM

  if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    return {
      session: "PRE",
      asOf: now.toISOString(),
      source: "Massive",
      isLive: true,
      label: "Pre-Market",
    };
  }

  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return {
      session: "OPEN",
      asOf: now.toISOString(),
      source: "Massive",
      isLive: true,
      label: "Regular Session",
    };
  }

  if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
    return {
      session: "POST",
      asOf: now.toISOString(),
      source: "Massive",
      isLive: true,
      label: "After Hours",
    };
  }

  return {
    session: "CLOSED",
    asOf: now.toISOString(),
    source: "Massive",
    isLive: false,
    label: "Market Closed",
  };
}

/**
 * Get display color for session
 */
export function getSessionColor(session: MarketSession): string {
  switch (session) {
    case "OPEN":
      return "text-green-500";
    case "PRE":
      return "text-yellow-500";
    case "POST":
      return "text-blue-500";
    case "CLOSED":
      return "text-red-500";
  }
}

/**
 * Get session description for user
 */
export function getSessionDescription(session: MarketSession): string {
  switch (session) {
    case "OPEN":
      return "Regular trading session - live market data and full trading";
    case "PRE":
      return "Pre-market session - planning mode with live underlying data";
    case "POST":
      return "After-hours session - planning mode with live underlying data";
    case "CLOSED":
      return "Market closed - planning mode using last session data";
  }
}

/**
 * Calculate next market open/close times in ET
 */
export function getNextMarketTimes(
  session: MarketSession,
  serverTime?: string
): { nextOpen: number; nextClose: number } {
  const now = serverTime ? new Date(serverTime) : new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();

  // Helper: Create ET date with specific time
  const createETDate = (daysOffset: number, hours: number, minutes: number = 0): number => {
    const target = new Date(etTime);
    target.setDate(target.getDate() + daysOffset);
    target.setHours(hours, minutes, 0, 0);
    return target.getTime();
  };

  // Weekend: Next open is Monday pre-market
  if (day === 0 || day === 6) {
    const daysUntilMonday = day === 0 ? 1 : 2;
    return {
      nextOpen: createETDate(daysUntilMonday, 4, 0), // Monday 4:00 AM ET
      nextClose: createETDate(daysUntilMonday, 20, 0), // Monday 8:00 PM ET
    };
  }

  // Weekday logic
  switch (session) {
    case "PRE":
      return {
        nextOpen: createETDate(0, 9, 30), // Today 9:30 AM ET (regular open)
        nextClose: createETDate(0, 16, 0), // Today 4:00 PM ET
      };

    case "OPEN":
      return {
        nextOpen: createETDate(1, 4, 0), // Tomorrow 4:00 AM ET (pre-market)
        nextClose: createETDate(0, 16, 0), // Today 4:00 PM ET
      };

    case "POST":
      return {
        nextOpen: createETDate(1, 4, 0), // Tomorrow 4:00 AM ET
        nextClose: createETDate(0, 20, 0), // Today 8:00 PM ET (after-hours end)
      };

    case "CLOSED":
    default: {
      // After 8 PM but before midnight, or very early morning (before 4 AM)
      const timeInMinutes = hour * 60 + minute;
      const isDaysEnd = timeInMinutes >= 20 * 60; // After 8 PM

      if (isDaysEnd) {
        // After 8 PM: Next open is tomorrow pre-market
        const nextDay = day === 5 ? 3 : 1; // Friday → Monday (+3), else next day
        return {
          nextOpen: createETDate(nextDay, 4, 0),
          nextClose: createETDate(nextDay, 20, 0),
        };
      } else {
        // Before 4 AM: Next open is today pre-market
        return {
          nextOpen: createETDate(0, 4, 0),
          nextClose: createETDate(0, 20, 0),
        };
      }
    }
  }
}

/**
 * Enrich Massive market status with timing data
 */
export function enrichMarketStatus(
  data: MassiveMarketStatusResponse
): MarketSessionState & { nextOpen: number; nextClose: number; isWeekend: boolean } {
  const baseSession = parseMarketSession(data);
  const { nextOpen, nextClose } = getNextMarketTimes(baseSession.session, data.serverTime);

  const now = data.serverTime ? new Date(data.serverTime) : new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const isWeekend = etTime.getDay() === 0 || etTime.getDay() === 6;

  return {
    ...baseSession,
    nextOpen,
    nextClose,
    isWeekend,
  };
}
