// Determines current market session (PRE, OPEN, POST, CLOSED)
// Based on Massive.com market status API

export type MarketSession = 'PRE' | 'OPEN' | 'POST' | 'CLOSED';

export interface MarketSessionState {
  session: MarketSession;
  asOf: string; // ISO timestamp of last status check
  source: 'Massive';
  isLive: boolean; // Whether market is trading (PRE/OPEN/POST)
  label: string; // Display label
}

export interface MassiveMarketStatusResponse {
  market: 'open' | 'closed';
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
  
  if (data.market === 'open') {
    session = 'OPEN';
    label = 'Regular Session';
    isLive = true;
  } else if (data.earlyHours) {
    session = 'PRE';
    label = 'Pre-Market';
    isLive = true;
  } else if (data.afterHours) {
    session = 'POST';
    label = 'After Hours';
    isLive = true;
  } else {
    session = 'CLOSED';
    label = 'Market Closed';
    isLive = false;
  }
  
  return {
    session,
    asOf: data.serverTime || new Date().toISOString(),
    source: 'Massive',
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
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Weekend: always closed
  if (day === 0 || day === 6) {
    return {
      session: 'CLOSED',
      asOf: now.toISOString(),
      source: 'Massive',
      isLive: false,
      label: 'Market Closed (Weekend)',
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
      session: 'PRE',
      asOf: now.toISOString(),
      source: 'Massive',
      isLive: true,
      label: 'Pre-Market',
    };
  }
  
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return {
      session: 'OPEN',
      asOf: now.toISOString(),
      source: 'Massive',
      isLive: true,
      label: 'Regular Session',
    };
  }
  
  if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
    return {
      session: 'POST',
      asOf: now.toISOString(),
      source: 'Massive',
      isLive: true,
      label: 'After Hours',
    };
  }
  
  return {
    session: 'CLOSED',
    asOf: now.toISOString(),
    source: 'Massive',
    isLive: false,
    label: 'Market Closed',
  };
}

/**
 * Get display color for session
 */
export function getSessionColor(session: MarketSession): string {
  switch (session) {
    case 'OPEN':
      return 'text-green-500';
    case 'PRE':
      return 'text-yellow-500';
    case 'POST':
      return 'text-blue-500';
    case 'CLOSED':
      return 'text-red-500';
  }
}

/**
 * Get session description for user
 */
export function getSessionDescription(session: MarketSession): string {
  switch (session) {
    case 'OPEN':
      return 'Regular trading session - live market data and full trading';
    case 'PRE':
      return 'Pre-market session - planning mode with live underlying data';
    case 'POST':
      return 'After-hours session - planning mode with live underlying data';
    case 'CLOSED':
      return 'Market closed - planning mode using last session data';
  }
}
