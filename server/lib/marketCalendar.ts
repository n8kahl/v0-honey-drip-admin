// Market calendar and timezone utilities for accurate DTE and session detection

// US market holidays for 2024-2026 (extend as needed)
const US_MARKET_HOLIDAYS = new Set([
  '2024-01-01', // New Year's Day
  '2024-01-15', // MLK Day
  '2024-02-19', // Presidents Day
  '2024-03-29', // Good Friday
  '2024-05-27', // Memorial Day
  '2024-06-19', // Juneteenth
  '2024-07-04', // Independence Day
  '2024-09-02', // Labor Day
  '2024-11-28', // Thanksgiving
  '2024-12-25', // Christmas
  
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
]);

/**
 * Check if a date is a US market holiday
 */
export function isMarketHoliday(date: Date): boolean {
  const dateStr = date.toISOString().slice(0, 10);
  return US_MARKET_HOLIDAYS.has(dateStr);
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Check if market is open on a given date
 */
export function isMarketOpen(date: Date): boolean {
  return !isWeekend(date) && !isMarketHoliday(date);
}

/**
 * Get the next trading day from a given date
 */
export function getNextTradingDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  
  do {
    next.setDate(next.getDate() + 1);
  } while (!isMarketOpen(next));
  
  return next;
}

/**
 * Calculate trading days between two dates (inclusive of start, exclusive of end)
 */
export function getTradingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);
  
  while (current < endNorm) {
    if (isMarketOpen(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Calculate DTE (Days To Expiration) in trading days, timezone-aware
 * For options, expiry is typically 4:00 PM ET on expiration date
 * For indices like SPX/NDX, use CBOE timezone (America/Chicago)
 */
export function calculateDTE(expirationDate: Date, referenceDate = new Date()): number {
  // Normalize to midnight UTC for consistent comparison
  const expiry = new Date(expirationDate);
  expiry.setUTCHours(0, 0, 0, 0);
  
  const ref = new Date(referenceDate);
  ref.setUTCHours(0, 0, 0, 0);
  
  // If expiry is in the past or today, it's 0 DTE
  if (expiry <= ref) {
    return 0;
  }
  
  // Count trading days (calendar days minus weekends/holidays)
  return getTradingDaysBetween(ref, expiry);
}

/**
 * Get current market status
 */
export function getMarketStatus(now = new Date()): {
  isOpen: boolean;
  session: 'premarket' | 'open' | 'afterhours' | 'closed';
  nextOpen?: Date;
} {
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Weekend or holiday
  if (!isMarketOpen(now)) {
    return {
      isOpen: false,
      session: 'closed',
      nextOpen: getNextTradingDay(now),
    };
  }
  
  // Regular trading hours: 9:30 AM - 4:00 PM ET (Eastern Time)
  // Convert to UTC: 14:30 - 21:00 UTC (during standard time) or 13:30 - 20:00 UTC (during daylight time)
  // For simplicity, assume we're working in local server time close to ET
  
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  const preMarketStart = 4 * 60; // 4:00 AM
  const afterHoursEnd = 20 * 60; // 8:00 PM
  
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return { isOpen: true, session: 'open' };
  } else if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    return { isOpen: false, session: 'premarket' };
  } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
    return { isOpen: false, session: 'afterhours' };
  } else {
    return {
      isOpen: false,
      session: 'closed',
      nextOpen: getNextTradingDay(now),
    };
  }
}
