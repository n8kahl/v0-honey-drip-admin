import { createClient } from "@supabase/supabase-js";

/**
 * Historical Options Provider
 *
 * Server-side provider for fetching historical options data from Massive.com.
 * Used by BacktestEngine to simulate trades with accurate pricing.
 *
 * NOTE: This module is intended for server-side use only.
 */

export interface OptionCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export interface OptionTrade {
  timestamp: number;
  price: number;
  size: number;
  exchange: number;
  conditions: number[];
  id?: string;
}

export class HistoricalOptionsProvider {
  private apiKey: string;
  private baseUrl: string = "https://api.massive.com";

  constructor(apiKey?: string) {
    // Browser-safe environment variable access
    const env =
      typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env as Record<string, string | undefined>)
        : {};
    const processEnv = typeof process !== "undefined" && process.env ? process.env : {};

    this.apiKey = apiKey || env.VITE_MASSIVE_API_KEY || processEnv.MASSIVE_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[HistoricalOptionsProvider] No API key provided or found in environment");
    }
  }

  /**
   * Fetch historical candles for a specific option contract
   *
   * @param symbol - Full option ticker (e.g., "O:SPY251219C00650000")
   * @param from - Start date (YYYY-MM-DD)
   * @param to - End date (YYYY-MM-DD)
   * @param timeframe - Timeframe (1m, 5m, 1h, day)
   */
  async getOptionCandles(
    symbol: string,
    from: string,
    to: string,
    timeframe: "1m" | "5m" | "15m" | "1h" | "day" = "1m"
  ): Promise<OptionCandle[]> {
    const timeframeMap: Record<string, string> = {
      "1m": "minute",
      "5m": "minute",
      "15m": "minute",
      "1h": "hour",
      day: "day",
    };

    const multiplierMap: Record<string, number> = {
      "1m": 1,
      "5m": 5,
      "15m": 15,
      "1h": 1,
      day: 1,
    };

    const timespan = timeframeMap[timeframe] || "minute";
    const multiplier = multiplierMap[timeframe] || 1;

    // Ensure ticker has O: prefix if it's an option
    const ticker = symbol.startsWith("O:") ? symbol : `O:${symbol}`;

    const url = `${this.baseUrl}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Massive API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.results) {
        return [];
      }

      return data.results.map((bar: any) => ({
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        vwap: bar.vw,
      }));
    } catch (error) {
      console.error(`[HistoricalOptionsProvider] Failed to fetch candles for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Fetch historical trades for a specific option contract
   * Used for backtesting flow analysis
   */
  async getOptionTrades(symbol: string, date: string): Promise<OptionTrade[]> {
    // Ensure ticker has O: prefix
    const ticker = symbol.startsWith("O:") ? symbol : `O:${symbol}`;

    // Helper to fetch paginated trades
    const fetchPage = async (cursor?: string): Promise<any> => {
      let url = `${this.baseUrl}/v3/trades/${ticker}?timestamp=${date}&limit=50000`;
      if (cursor) {
        url += `&cursor=${cursor}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Massive API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    try {
      const allTrades: OptionTrade[] = [];
      const cursor: string | undefined = undefined;

      // Fetch first page to see if we have results
      // Note: Full pagination might be heavy, implementing single page for now
      // TODO: Implement full pagination loop if needed for high volume
      const data = await fetchPage();
      const results = data.results || [];

      return results.map((t: any) => ({
        timestamp: t.t,
        price: t.p,
        size: t.s,
        exchange: t.x,
        conditions: t.c || [],
        id: t.i,
      }));
    } catch (error) {
      console.error(`[HistoricalOptionsProvider] Failed to fetch trades for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Find option contracts for an underlying
   * Used to find the correct historical contract symbol (e.g. ATM Call for a specific date)
   */
  async getContracts(
    underlying: string,
    params?: {
      expiration?: string; // YYYY-MM-DD
      minStrike?: number;
      maxStrike?: number;
      limit?: number;
    }
  ): Promise<any[]> {
    const queryParams = new URLSearchParams();
    queryParams.set("underlying_ticker", underlying);
    if (params?.expiration) queryParams.set("expiration_date", params.expiration);
    if (params?.minStrike) queryParams.set("strike_price.gte", String(params.minStrike));
    if (params?.maxStrike) queryParams.set("strike_price.lte", String(params.maxStrike));
    queryParams.set("limit", String(params?.limit || 100));

    // For historical lookup, we might need expired contracts.
    // Ensure the API call includes expired contracts if the API supports a flag for it,
    // or rely on the fact that reference data usually persists.
    // Massive API /v3/reference/options/contracts typically includes expired if queried by date range or specific parameters.

    const url = `${this.baseUrl}/v3/reference/options/contracts?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Massive API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error(
        `[HistoricalOptionsProvider] Failed to fetch contracts for ${underlying}:`,
        error
      );
      return [];
    }
  }
}
