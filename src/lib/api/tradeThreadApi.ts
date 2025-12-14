/**
 * Trade Threads API Client
 *
 * Frontend API functions for Trade Threads V1
 */

import {
  TradeThread,
  TradeThreadUpdate,
  MemberTrade,
  PublicTradeOutcome,
  CreateMemberTradeInput,
  ExitMemberTradeInput,
  TradeThreadUpdateType,
  TradeThreadUpdatePayload,
  mapDbRowToTradeThread,
  mapDbRowToMemberTrade,
  mapDbRowToPublicOutcome,
} from "@/types/tradeThreads";
import { Contract, TradeType } from "@/types";

// Get auth token from Supabase session
async function getAuthHeaders(): Promise<HeadersInit> {
  // Try to get from localStorage (Supabase stores session there)
  try {
    const storageKey = Object.keys(localStorage).find(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
    );
    if (storageKey) {
      const session = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (session.access_token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        };
      }
    }
  } catch (e) {
    console.warn("[TradeThreadApi] Failed to get auth token:", e);
  }

  return { "Content-Type": "application/json" };
}

// ============================================================================
// TRADE THREAD API (Admin)
// ============================================================================

export interface CreateTradeThreadInput {
  symbol: string;
  contractId: string;
  contract?: Contract;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  tradeType?: TradeType;
  adminName?: string;
  message?: string;
}

/**
 * Create a new trade thread
 */
export async function createTradeThread(
  input: CreateTradeThreadInput
): Promise<{ thread: TradeThread; openUpdate: TradeThreadUpdate }> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/trade-threads", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to create trade thread");
  }

  const data = await response.json();
  return {
    thread: mapDbRowToTradeThread(data.thread),
    openUpdate: data.openUpdate,
  };
}

/**
 * Get all trade threads (with optional filters)
 */
export async function getTradeThreads(options?: {
  status?: "open" | "closed";
  symbol?: string;
  adminId?: string;
  limit?: number;
  offset?: number;
}): Promise<TradeThread[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.symbol) params.set("symbol", options.symbol);
  if (options?.adminId) params.set("adminId", options.adminId);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const response = await fetch(`/api/trade-threads?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to fetch trade threads");
  }

  const data = await response.json();
  return (data.threads || []).map(mapDbRowToTradeThread);
}

/**
 * Get a single trade thread by ID
 */
export async function getTradeThread(
  threadId: string
): Promise<TradeThread & { memberCount: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/trade-threads/${threadId}`, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Thread not found");
  }

  const data = await response.json();
  return {
    ...mapDbRowToTradeThread(data),
    memberCount: data.memberCount || 0,
  };
}

/**
 * Add an update to a trade thread
 */
export async function addThreadUpdate(
  threadId: string,
  type: TradeThreadUpdateType,
  message?: string,
  payload?: TradeThreadUpdatePayload
): Promise<{ update: TradeThreadUpdate; threadClosed: boolean }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/trade-threads/${threadId}/updates`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type, message, payload }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to add update");
  }

  return response.json();
}

/**
 * Add an update to a trade thread by symbol (looks up the active thread)
 * This is useful when you don't have the threadId but know the symbol
 */
export async function addThreadUpdateBySymbol(
  symbol: string,
  type: TradeThreadUpdateType,
  message?: string,
  payload?: TradeThreadUpdatePayload
): Promise<{ update: TradeThreadUpdate; threadClosed: boolean } | null> {
  try {
    // First, find the active thread for this symbol
    const threads = await getTradeThreads({ symbol, status: "open", limit: 1 });
    if (threads.length === 0) {
      console.warn(`[TradeThreadApi] No active thread found for symbol: ${symbol}`);
      return null;
    }

    const threadId = threads[0].id;
    return addThreadUpdate(threadId, type, message, payload);
  } catch (error) {
    console.warn(`[TradeThreadApi] Failed to add update for ${symbol}:`, error);
    return null;
  }
}

/**
 * Publish a thread to public wins
 */
export async function publishThread(
  threadId: string,
  publicComment?: string,
  adminAvatarUrl?: string
): Promise<PublicTradeOutcome> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/trade-threads/${threadId}/publish`, {
    method: "POST",
    headers,
    body: JSON.stringify({ publicComment, adminAvatarUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to publish");
  }

  const data = await response.json();
  return mapDbRowToPublicOutcome(data.outcome);
}

// ============================================================================
// MEMBER TRADE API
// ============================================================================

/**
 * "I took this trade" - Subscribe to a trade thread
 */
export async function takeTrade(input: CreateMemberTradeInput): Promise<{
  memberTrade: MemberTrade;
  thread: TradeThread;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/member-trades", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to take trade");
  }

  const data = await response.json();
  return {
    memberTrade: mapDbRowToMemberTrade(data.memberTrade),
    thread: mapDbRowToTradeThread(data.thread),
  };
}

/**
 * Get current user's member trades
 */
export async function getMyTrades(options?: {
  status?: "active" | "exited";
  includeThread?: boolean;
}): Promise<MemberTrade[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.includeThread) params.set("includeThread", "true");

  const response = await fetch(`/api/member-trades?${params.toString()}`, { headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to fetch member trades");
  }

  const data = await response.json();
  return (data.memberTrades || []).map(mapDbRowToMemberTrade);
}

/**
 * Exit a member trade
 */
export async function exitTrade(input: ExitMemberTradeInput): Promise<{
  memberTrade: MemberTrade;
  pnlPercent: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/member-trades/${input.memberTradeId}/exit`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ exitPrice: input.exitPrice, notes: input.notes }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to exit trade");
  }

  const data = await response.json();
  return {
    memberTrade: mapDbRowToMemberTrade(data.memberTrade),
    pnlPercent: data.pnlPercent,
  };
}

/**
 * Update member trade notes/stop/targets
 */
export async function updateMemberTrade(
  memberTradeId: string,
  updates: { notes?: string; stopPrice?: number; targets?: number[] }
): Promise<MemberTrade> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/member-trades/${memberTradeId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to update trade");
  }

  const data = await response.json();
  return mapDbRowToMemberTrade(data.memberTrade);
}

// ============================================================================
// PUBLIC WINS API
// ============================================================================

/**
 * Get public trade outcomes feed
 */
export async function getPublicWins(options?: {
  page?: number;
  pageSize?: number;
  outcome?: "win" | "loss" | "breakeven";
  adminId?: string;
  date?: string;
}): Promise<{
  outcomes: PublicTradeOutcome[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", options.page.toString());
  if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
  if (options?.outcome) params.set("outcome", options.outcome);
  if (options?.adminId) params.set("adminId", options.adminId);
  if (options?.date) params.set("date", options.date);

  const response = await fetch(`/api/public/wins?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to fetch wins");
  }

  const data = await response.json();
  return {
    outcomes: (data.outcomes || []).map(mapDbRowToPublicOutcome),
    total: data.total || 0,
    page: data.page || 1,
    pageSize: data.pageSize || 20,
    hasMore: data.hasMore || false,
  };
}

/**
 * Admin: Trigger EOD publish
 */
export async function publishEOD(): Promise<{ published: number; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/admin/publish-eod", {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Failed to publish EOD");
  }

  return response.json();
}
