/**
 * Tradier API Client for Historical Stock Data
 *
 * Used for stocks (SPY, QQQ, etc.) since Massive.com S3 bucket access is limited to indices.
 *
 * API Limits:
 * - 1-minute bars: ~20 days history
 * - 5-minute bars: ~40 days history
 * - 15-minute bars: ~40 days history
 * - Daily bars: Full company lifetime
 *
 * Rate Limits: 120 requests/minute (free tier), 180 requests/minute (paid)
 *
 * Documentation: https://documentation.tradier.com/brokerage-api/markets/get-history
 */

const TRADIER_BASE_URL = "https://api.tradier.com/v1";

/**
 * Get Tradier API token from environment
 * Read dynamically to support dotenv loading after module import
 */
function getTradierToken(): string | undefined {
  return process.env.TRADIER_ACCESS_TOKEN;
}

export interface TradierBar {
  date: string; // ISO date string or timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradierHistoryResponse {
  history: {
    day: TradierBar[];
  } | null;
}

/**
 * Map Tradier interval names to our internal timeframe names
 */
function mapIntervalToTradier(timeframe: string): string {
  const mapping: Record<string, string> = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "60min", // Note: Tradier doesn't officially support 1h, but 60min might work
    "4h": "daily", // Fall back to daily for 4h (not directly supported)
    day: "daily",
  };
  return mapping[timeframe] || "daily";
}

/**
 * Get maximum lookback days for a given timeframe based on Tradier limits
 */
function getMaxLookbackDays(timeframe: string): number {
  switch (timeframe) {
    case "1m":
      return 20;
    case "5m":
    case "15m":
      return 40;
    default:
      return 365 * 10; // 10 years for daily
  }
}

/**
 * Fetch historical bars from Tradier API
 *
 * @param symbol Stock symbol (e.g., 'SPY', 'QQQ')
 * @param timeframe Timeframe: '1m', '5m', '15m', '1h', 'day'
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @returns Array of bars in normalized format
 */
export async function fetchTradierBars(
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const token = getTradierToken();
  if (!token) {
    throw new Error("TRADIER_ACCESS_TOKEN not configured in environment");
  }

  // Check lookback limits
  const maxDays = getMaxLookbackDays(timeframe);
  const daysDiff = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff > maxDays) {
    console.warn(
      `[TradierAPI] Requested ${daysDiff} days for ${timeframe}, but Tradier limit is ${maxDays} days. Adjusting start date.`
    );
    const adjustedStart = new Date(endDate);
    adjustedStart.setDate(adjustedStart.getDate() - maxDays);
    startDate = adjustedStart.toISOString().split("T")[0];
  }

  const interval = mapIntervalToTradier(timeframe);
  const url = `${TRADIER_BASE_URL}/markets/history`;

  try {
    console.log(
      `[TradierAPI] Fetching ${symbol} ${timeframe} bars from ${startDate} to ${endDate}`
    );

    // Build query string
    const params = new URLSearchParams({
      symbol,
      interval,
      start: startDate,
      end: endDate,
    });

    const fullUrl = `${url}?${params.toString()}`;

    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30000), // 30-second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error("[TradierAPI] Authentication failed. Check TRADIER_ACCESS_TOKEN.");
        throw new Error("Tradier API authentication failed");
      } else if (response.status === 429) {
        console.error("[TradierAPI] Rate limit exceeded. Wait before retrying.");
        throw new Error("Tradier API rate limit exceeded");
      } else {
        const errorText = await response.text();
        console.error(`[TradierAPI] HTTP ${response.status} error:`, errorText);
        throw new Error(`Tradier API error: ${response.status}`);
      }
    }

    const data: TradierHistoryResponse = await response.json();

    if (!data.history || !data.history.day) {
      console.warn(`[TradierAPI] No history data returned for ${symbol}`);
      return [];
    }

    // Normalize to our bar format (matches Massive.com format)
    const bars = data.history.day.map((bar) => {
      // Parse date to timestamp in milliseconds
      const timestamp = new Date(bar.date).getTime();

      return {
        ticker: symbol,
        t: timestamp,
        o: bar.open,
        h: bar.high,
        l: bar.low,
        c: bar.close,
        v: bar.volume,
        vw: bar.close, // Tradier doesn't provide VWAP, use close as fallback
        n: 0, // Number of trades not available
      };
    });

    console.log(`[TradierAPI] ✅ Fetched ${bars.length} bars for ${symbol}`);
    return bars;
  } catch (error) {
    if (error instanceof Error) {
      console.error("[TradierAPI] Error:", error.message);
    } else {
      console.error("[TradierAPI] Unexpected error:", error);
    }

    throw error;
  }
}

/**
 * Batch fetch bars for multiple symbols with rate limit handling
 *
 * @param symbols Array of stock symbols
 * @param timeframe Timeframe
 * @param startDate Start date
 * @param endDate End date
 * @param concurrency Max concurrent requests (default: 5 to respect rate limits)
 * @returns Map of symbol -> bars
 */
export async function fetchTradierBarsBatch(
  symbols: string[],
  timeframe: string,
  startDate: string,
  endDate: string,
  concurrency: number = 5
): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();
  const delayMs = 60000 / 100; // 100 requests/minute safety margin

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);

    console.log(
      `[TradierAPI] Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(symbols.length / concurrency)}`
    );

    const promises = batch.map(async (symbol) => {
      try {
        const bars = await fetchTradierBars(symbol, timeframe, startDate, endDate);
        results.set(symbol, bars);
      } catch (error) {
        console.error(`[TradierAPI] Failed to fetch ${symbol}:`, error);
        results.set(symbol, []);
      }
    });

    await Promise.allSettled(promises);

    // Rate limit delay between batches
    if (i + concurrency < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * concurrency));
    }
  }

  return results;
}

/**
 * Test Tradier API connection
 */
export async function testTradierConnection(): Promise<boolean> {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const bars = await fetchTradierBars(
      "SPY",
      "1m",
      yesterday.toISOString().split("T")[0],
      today.toISOString().split("T")[0]
    );

    console.log(`[TradierAPI] ✅ Connection test passed. Fetched ${bars.length} bars for SPY.`);
    return true;
  } catch (error) {
    console.error("[TradierAPI] ❌ Connection test failed:", error);
    return false;
  }
}
