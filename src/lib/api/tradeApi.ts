/**
 * Trade API Client with Retry Logic
 * Handles all trade-related API calls with exponential backoff retries
 */

import { createClient } from "../supabase/client";

/**
 * Get authentication headers with JWT token from Supabase session
 * This ensures the server can properly authenticate the user
 */
async function getAuthHeaders(userId: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn("[TradeAPI] Failed to get auth session:", err);
  }

  // Keep x-user-id as fallback for development
  headers["x-user-id"] = userId;

  return headers;
}

export interface ApiCallOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: ApiCallOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
};

/**
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make API call with exponential backoff retry
 */
export async function apiCallWithRetry<T>(
  fn: () => Promise<T>,
  options: ApiCallOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries = 3, initialDelayMs = 1000, onRetry } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Don't sleep after last attempt
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error("API call failed after retries");
}

/**
 * Create a trade via API
 */
export async function createTradeApi(userId: string, trade: any): Promise<any> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const response = await fetch("/api/trades", {
      method: "POST",
      headers,
      body: JSON.stringify({ trade }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Update a trade via API
 */
export async function updateTradeApi(userId: string, tradeId: string, updates: any): Promise<any> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Delete a trade via API
 */
export async function deleteTradeApi(userId: string, tradeId: string): Promise<any> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Delete ALL trades for the current user via API (bulk delete)
 * Returns the count of deleted trades
 */
export async function deleteAllTradesApi(userId: string): Promise<{ deletedCount: number }> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Add trade update record via API
 */
export async function addTradeUpdateApi(
  userId: string,
  tradeId: string,
  action: string,
  price: number,
  message?: string,
  pnlPercent?: number
): Promise<any> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}/updates`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: action,
        price,
        message: message || `${action} action`,
        pnl_percent: pnlPercent || null,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Link Discord channels to trade via API
 */
export async function linkChannelsApi(
  userId: string,
  tradeId: string,
  channelIds: string[]
): Promise<void> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const promises = channelIds.map((channelId) =>
      fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
        method: "POST",
        headers,
      })
    );

    const responses = await Promise.all(promises);

    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`Failed to link channel: ${response.status}`);
      }
    }
  });
}

/**
 * Link challenges to trade via API
 */
export async function linkChallengesApi(
  userId: string,
  tradeId: string,
  challengeIds: string[]
): Promise<void> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const promises = challengeIds.map((challengeId) =>
      fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
        method: "POST",
        headers,
      })
    );

    const responses = await Promise.all(promises);

    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`Failed to link challenge: ${response.status}`);
      }
    }
  });
}

/**
 * Unlink a challenge from trade via API
 */
export async function unlinkChallengeApi(
  userId: string,
  tradeId: string,
  challengeId: string
): Promise<void> {
  const headers = await getAuthHeaders(userId);

  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to unlink challenge: ${response.status}`);
    }
  });
}
