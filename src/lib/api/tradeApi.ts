/**
 * Trade API Client with Retry Logic
 * Handles all trade-related API calls with exponential backoff retries
 */

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
  return apiCallWithRetry(async () => {
    const response = await fetch("/api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
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
  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
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
  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
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
  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}/updates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
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
  return apiCallWithRetry(async () => {
    const promises = channelIds.map((channelId) =>
      fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
        method: "POST",
        headers: {
          "x-user-id": userId,
        },
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
  return apiCallWithRetry(async () => {
    const promises = challengeIds.map((challengeId) =>
      fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
        method: "POST",
        headers: {
          "x-user-id": userId,
        },
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
  return apiCallWithRetry(async () => {
    const response = await fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
      method: "DELETE",
      headers: {
        "x-user-id": userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to unlink challenge: ${response.status}`);
    }
  });
}
