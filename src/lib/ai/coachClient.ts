/**
 * Client-side API wrapper for Drip Coach AI service
 *
 * Handles all API communication with the backend coaching endpoints
 */

import type { CoachingResponse, DripCoachSnapshot, TradeType } from "./types";

export interface TradeData {
  symbol: string;
  underlying: string;
  direction: "LONG" | "SHORT";
  tradeType: "Scalp" | "Day" | "Swing" | "LEAP";
  dte: number;
  strike?: number;
  optionType?: "CALL" | "PUT";
  contractSymbol?: string;
  entryPrice: number;
  stopPrice: number;
  targets: {
    t1: number;
    t2?: number;
    t3?: number;
  };
}

export interface StartSessionRequest {
  tradeId: string;
  coachingMode: "scalp" | "day" | "swing" | "leap";
  tradeData: TradeData;
}

export interface StartSessionResponse {
  sessionId: string;
  initialAnalysis: CoachingResponse;
}

export interface UpdateSessionRequest {
  sessionId: string;
  trade: any; // Trade object from tradeStore
  marketData: any; // SymbolData from marketDataStore
  greeks?: any; // Optional Greeks data
}

export interface AskQuestionRequest {
  sessionId: string;
  question: string;
  trade: any;
  market: MarketData;
  greeks?: any;
}

/**
 * Market data for AI coaching - extracted from marketDataStore
 */
export interface MarketData {
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  avgVolume: number;
  vwap: number;
  atr: number;
  rsi: number;
  ema9?: number;
  ema20?: number;
  ema50?: number;
  priorDayHigh: number;
  priorDayLow: number;
  priorDayClose: number;
  orbHigh?: number;
  orbLow?: number;
  swingHigh?: number;
  swingLow?: number;
  mtfTrend?: Record<string, string>;
  confluence?: {
    overall: number;
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
  };
}

export interface SessionStatusResponse {
  active: boolean;
  sessionId: string;
  tradeId: string;
  coachingMode: string;
  updateCount: number;
  tokensUsed: number;
  startTime: string;
  lastUpdateTime?: string;
}

export interface EndSessionResponse {
  summary: string;
  totalUpdates: number;
  tokensUsed: number;
  sessionDuration: number;
}

const API_BASE = "/api/ai";

/**
 * Check if the AI coach service is healthy
 */
export async function checkCoachHealth(): Promise<{ status: string; openai: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Start a new coaching session for a trade
 */
export async function startCoachSession(
  tradeId: string,
  coachingMode: "scalp" | "day" | "swing" | "leap",
  tradeData: TradeData
): Promise<StartSessionResponse> {
  const response = await fetch(`${API_BASE}/coach/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tradeId, coachingMode, tradeData }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to start coaching session");
  }

  return response.json();
}

/**
 * Update a coaching session with new market data
 */
export async function updateCoachSession(
  sessionId: string,
  trade: any,
  marketData: any,
  greeks?: any
): Promise<CoachingResponse | null> {
  const response = await fetch(`${API_BASE}/coach/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, trade, market: marketData, greeks }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to update coaching session");
  }

  const data = await response.json();
  return data.response;
}

/**
 * Force a refresh of coaching analysis
 */
export async function refreshCoachSession(
  sessionId: string,
  trade: any,
  market: MarketData,
  greeks?: any
): Promise<CoachingResponse> {
  const response = await fetch(`${API_BASE}/coach/refresh/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trade, market, greeks }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to refresh coaching session");
  }

  return response.json();
}

/**
 * Ask the coach a question
 */
export async function askCoach(
  sessionId: string,
  question: string,
  trade: any,
  market: MarketData,
  greeks?: any
): Promise<CoachingResponse> {
  const response = await fetch(`${API_BASE}/coach/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, question, trade, market, greeks }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to ask coach");
  }

  return response.json();
}

/**
 * End a coaching session
 */
export async function endCoachSession(sessionId: string): Promise<EndSessionResponse> {
  const response = await fetch(`${API_BASE}/coach/end/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to end coaching session");
  }

  return response.json();
}

/**
 * Get the status of a coaching session
 */
export async function getCoachSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
  const response = await fetch(`${API_BASE}/coach/status/${sessionId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to get session status");
  }

  return response.json();
}

/**
 * Get active coaching session for a trade (if any)
 */
export async function getTradeCoachSession(tradeId: string): Promise<SessionStatusResponse | null> {
  const response = await fetch(`${API_BASE}/coach/trade/${tradeId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to get trade coach session");
  }

  return response.json();
}

/**
 * Derive coaching mode from trade type
 */
export function getCoachingModeFromTradeType(
  tradeType: string
): "scalp" | "day" | "swing" | "leap" {
  switch (tradeType?.toLowerCase()) {
    case "scalp":
      return "scalp";
    case "day":
      return "day";
    case "swing":
      return "swing";
    case "leap":
      return "leap";
    default:
      return "day"; // Default to day trade mode
  }
}
