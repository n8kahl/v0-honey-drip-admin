/**
 * MassiveREST
 *
 * Unified REST client for all Massive API operations.
 * Handles authentication, retry logic, rate limiting, and error handling.
 */

import { MassiveTokenManager } from './token-manager';
import { MassiveCache } from './cache';
import { getMetricsService } from '../../services/monitoring';
import type {
  MassiveQuote,
  MassiveOption,
  MassiveOptionsChain,
  MassiveIndex,
} from './types';

const MASSIVE_API_BASE = '/api/massive';
const CONTRACT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const AGGREGATES_TTL_MS = 60 * 1000; // 60 seconds

export interface MassiveRSI {
  timestamp: number;
  value: number;
}

export interface MassiveMarketStatus {
  market: string;
  serverTime: string;
  exchanges: {
    nasdaq: string;
    nyse: string;
    otc: string;
  };
  afterHours: boolean;
  earlyHours: boolean;
}

export interface EnrichedMarketStatus {
  session: 'PRE' | 'OPEN' | 'POST' | 'CLOSED';
  isOpen: boolean;
  tradingDay: string;
  nextOpen: number;
  nextClose: number;
  serverTime: string;
  label: string;
}

export interface MassiveAggregateBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
}

export interface RESTHealth {
  healthy: boolean;
  lastSuccess: number | null;
  lastError: string | null;
  consecutiveErrors: number;
  responseTimeMs: number;
}

/**
 * Unified REST client for Massive API
 */
export class MassiveREST {
  private baseUrl: string;
  private tokenManager: MassiveTokenManager;
  private cache: MassiveCache;
  private health: RESTHealth;

  constructor(tokenManager: MassiveTokenManager, cache: MassiveCache) {
    this.baseUrl = MASSIVE_API_BASE;
    this.tokenManager = tokenManager;
    this.cache = cache;
    this.health = {
      healthy: true,
      lastSuccess: null,
      lastError: null,
      consecutiveErrors: 0,
      responseTimeMs: 0,
    };
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    return this.fetchWithRetry(url, { method: 'GET' });
  }

  /**
   * Generic POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Get current market status
   */
  async getMarketStatus(): Promise<MassiveMarketStatus> {
    return this.get('/v1/marketstatus/now');
  }

  /**
   * Get market holidays for a year (cached indefinitely)
   */
  async getMarketHolidays(year?: number): Promise<string[]> {
    const targetYear = year ?? new Date().getFullYear();
    const cacheKey = `holidays:${targetYear}`;

    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        try {
          const data = await this.get<any>(`/v1/market/holidays?year=${targetYear}`);
          const items: any[] = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
            ? data
            : [];
          const dates = items
            .map((it: any) => it?.date || it?.holiday_date)
            .filter(Boolean)
            .map((d: any) => String(d));
          return dates;
        } catch (err) {
          console.debug('[MassiveREST] Failed to fetch market holidays', err);
          return [];
        }
      },
      Infinity // Cache forever
    );
  }

  /**
   * Get RSI indicator for an options ticker
   */
  async getRSI(
    optionsTicker: string,
    params?: {
      timestamp?: string;
      timespan?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
      window?: number;
      series_type?: 'close' | 'open' | 'high' | 'low';
      limit?: number;
    }
  ): Promise<{ values: MassiveRSI[] }> {
    const data = await this.get<any>(`/v1/indicators/rsi/${optionsTicker}`, params);
    return { values: data.results?.values || [] };
  }

  /**
   * Get single quote
   */
  async getQuote(symbol: string): Promise<MassiveQuote> {
    const data = await this.get<any>(`/v3/snapshot/${symbol}`);
    return data.results?.[0] || data;
  }

  /**
   * Get batch quotes (optimized with fallback)
   */
  async getQuotes(symbols: string[]): Promise<MassiveQuote[]> {
    // Try unified server endpoint first
    try {
      const tickers = symbols.join(',');
      const token = await this.tokenManager.getToken();
      const resp = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers)}`, {
        headers: {
          'x-massive-proxy-token': token,
        },
      });

      if (resp.ok) {
        const json = await resp.json();
        const items: any[] = Array.isArray(json?.results) ? json.results : [];
        return items.map((it) => ({
          symbol: String(it.symbol ?? ''),
          last: Number(it.last ?? 0),
          change: Number(it.change ?? 0),
          changePercent: Number(it.changePercent ?? 0),
          bid: Number(it.bid ?? 0),
          ask: Number(it.ask ?? 0),
          volume: Number(it.volume ?? 0),
          high: Number(it.high ?? 0),
          low: Number(it.low ?? 0),
          open: Number(it.open ?? 0),
          previousClose: Number(it.previousClose ?? 0),
          timestamp: Number(it.asOf ?? Date.now()),
        })) as MassiveQuote[];
      }

      console.warn('[MassiveREST] /api/quotes returned non-OK, falling back per-symbol');
    } catch (e) {
      console.warn('[MassiveREST] /api/quotes failed, falling back per-symbol', e);
    }

    // Fallback: per-symbol requests
    const quotes: MassiveQuote[] = [];
    for (const symbol of symbols) {
      try {
        const isIndex = symbol.startsWith('I:') || ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol);
        if (isIndex) {
          const index = await this.getIndex(symbol);
          quotes.push({
            symbol: (index as any)?.ticker ?? symbol,
            last: Number((index as any)?.value ?? (index as any)?.last ?? 0),
            change: Number((index as any)?.session?.change ?? 0),
            changePercent: Number((index as any)?.session?.change_percent ?? 0),
            bid: 0,
            ask: 0,
            volume: 0,
            high: 0,
            low: 0,
            open: 0,
            previousClose: 0,
            timestamp: Date.now(),
          } as MassiveQuote);
        } else {
          const data = await this.get<any>(`/v3/snapshot/options/${symbol}?limit=1`);
          const r = (data?.results || [])[0] || {};
          const underlying = r?.underlying_asset || r?.details?.underlying || {};
          const last = Number(
            underlying?.price ?? r?.last_trade?.p ?? r?.last_quote?.ap ?? r?.last_quote?.bp ?? 0
          );
          quotes.push({
            symbol,
            last,
            change: Number(underlying?.change ?? 0),
            changePercent: Number(underlying?.change_percent ?? 0),
            bid: 0,
            ask: 0,
            volume: 0,
            high: 0,
            low: 0,
            open: 0,
            previousClose: 0,
            timestamp: Date.now(),
          } as MassiveQuote);
        }
      } catch (error) {
        console.error(`[MassiveREST] Failed to fetch quote for ${symbol}:`, error);
        quotes.push({
          symbol,
          last: 0,
          change: 0,
          changePercent: 0,
          bid: 0,
          ask: 0,
          volume: 0,
          high: 0,
          low: 0,
          open: 0,
          previousClose: 0,
          timestamp: Date.now(),
        } as MassiveQuote);
      }
    }
    return quotes;
  }

  /**
   * Get options chain with enrichment
   */
  async getOptionsChain(
    underlyingTicker: string,
    expirationDate?: string,
    underlyingPrice?: number
  ): Promise<MassiveOptionsChain> {
    // Get or fetch underlying price
    let price = underlyingPrice || 0;

    if (price === 0) {
      try {
        const isIndex = ['SPX', 'NDX', 'VIX', 'RUT'].includes(underlyingTicker);
        if (isIndex) {
          const indexTicker = `I:${underlyingTicker}`;
          const indexData = await this.get<any>(`/v3/snapshot/indices?ticker=${indexTicker}`);
          if (indexData.value) {
            price = indexData.value;
          }
        } else {
          const stockData = await this.get<any>(`/v3/snapshot/options/${underlyingTicker}?limit=1`);
          if (stockData.results?.[0]?.underlying_asset?.price) {
            price = stockData.results[0].underlying_asset.price;
          }
        }
      } catch (err) {
        console.warn('[MassiveREST] Could not fetch price:', err);
      }
    }

    // Calculate strike range: ±15%
    const strikeRange = 0.15;
    const minStrike = price > 0 ? Math.floor(price * (1 - strikeRange)) : undefined;
    const maxStrike = price > 0 ? Math.ceil(price * (1 + strikeRange)) : undefined;

    // Get contracts
    const contractsData = await this.getOptionContracts(
      underlyingTicker,
      1000,
      expirationDate,
      minStrike,
      maxStrike
    );

    if (!contractsData || !contractsData.results || contractsData.results.length === 0) {
      return contractsData;
    }

    // Get snapshots for enrichment
    const snapshotData = await this.get<any>(`/v3/snapshot/options/${underlyingTicker}?limit=250`);

    const snapshotMap = new Map();
    if (snapshotData.results) {
      for (const snap of snapshotData.results) {
        if (snap.ticker || snap.details?.ticker) {
          snapshotMap.set(snap.ticker || snap.details.ticker, snap);
        }
      }
    }

    // Enrich contracts with snapshot data
    const enrichedResults = contractsData.results.map((contract: any) => {
      const snapshot = snapshotMap.get(contract.ticker);
      return {
        ...contract,
        day: snapshot?.day,
        last_quote: snapshot?.last_quote,
        last_trade: snapshot?.last_trade,
        greeks: snapshot?.greeks,
        implied_volatility: snapshot?.implied_volatility,
        open_interest: snapshot?.open_interest,
      };
    });

    return {
      ...contractsData,
      results: enrichedResults,
    };
  }

  /**
   * Get options snapshot
   */
  async getOptionsSnapshot(underlyingTicker: string): Promise<any> {
    return this.get(`/v3/snapshot/options/${underlyingTicker}`);
  }

  /**
   * Get option contract details (cached)
   */
  async getOptionContract(optionsTicker: string): Promise<MassiveOption> {
    const cacheKey = `contract:${optionsTicker}`;

    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        const data = await this.get<any>(`/v3/reference/options/contracts/${optionsTicker}`);
        return data.results || data;
      },
      CONTRACT_TTL_MS
    );
  }

  /**
   * Get option contracts with filters (cached)
   */
  async getOptionContracts(
    underlying: string,
    limit = 1000,
    expiration?: string,
    minStrike?: number,
    maxStrike?: number
  ): Promise<any> {
    const cacheKey = `contracts:${underlying}:${limit}:${expiration || ''}:${minStrike || ''}:${maxStrike || ''}`;

    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        const params: Record<string, any> = {
          underlying_ticker: underlying,
          limit: Math.min(limit, 1000),
        };

        if (expiration) {
          params['expiration_date'] = expiration;
        } else {
          // Filter for contracts expiring today or later
          const today = new Date().toISOString().split('T')[0];
          params['expiration_date.gte'] = today;
        }

        if (minStrike !== undefined) {
          params['strike_price.gte'] = minStrike;
        }
        if (maxStrike !== undefined) {
          params['strike_price.lte'] = maxStrike;
        }

        return this.get('/v3/reference/options/contracts', params);
      },
      CONTRACT_TTL_MS
    );
  }

  /**
   * Get single index
   */
  async getIndex(ticker: string): Promise<MassiveIndex> {
    const finalTicker = ticker.startsWith('I:') ? ticker : `I:${ticker}`;
    const data = await this.get<any>(`/v3/snapshot/indices?ticker=${finalTicker}`);
    return data.results?.[0] || data;
  }

  /**
   * Get multiple indices
   */
  async getIndices(tickers: string[]): Promise<MassiveIndex[]> {
    const finalTickers = tickers.map((t) => (t.startsWith('I:') ? t : `I:${t}`)).join(',');
    const data = await this.get<any>(`/v3/snapshot/indices?ticker.any_of=${finalTickers}`);
    return data.results || [];
  }

  /**
   * Get historical data
   */
  async getHistoricalData(
    symbol: string,
    multiplier: number = 1,
    timespan: string = 'day',
    from: string,
    to: string
  ): Promise<any> {
    return this.get(`/v3/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`);
  }

  /**
   * Get aggregates (cached)
   */
  async getAggregates(
    symbol: string,
    timeframe: '1' | '5' | '15' | '60' | '1D',
    lookback: number = 200
  ): Promise<MassiveAggregateBar[]> {
    const cacheKey = `aggs:${symbol}:${timeframe}:${lookback}`;

    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        const to = new Date();
        const formatDay = (date: Date) => date.toISOString().split('T')[0];

        // Handle daily timeframe
        if (timeframe === '1D') {
          const from = new Date(to.getTime() - lookback * 24 * 60 * 60 * 1000);
          const endpointV2 = `/v2/aggs/ticker/${symbol}/range/1/day/${formatDay(from)}/${formatDay(to)}?adjusted=true&sort=asc&limit=${lookback}`;
          const endpointV3 = `/v3/aggs/ticker/${symbol}/range/1/day/${formatDay(from)}/${formatDay(to)}?adjusted=true&sort=asc&limit=${lookback}`;

          let data: any;
          try {
            data = await this.get(endpointV2);
          } catch (e: any) {
            const msg = String(e?.message || '');
            if (/403|forbidden/i.test(msg) || /Massive API error/.test(msg)) {
              console.warn('[MassiveREST] v2 daily aggregates forbidden, trying v3');
              data = await this.get(endpointV3);
            } else {
              throw e;
            }
          }

          const results: any[] = data.results || data;
          if (!Array.isArray(results)) return [];

          return results.map((bar) => ({
            t: bar.t,
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c,
            v: bar.v,
            vw: bar.vw,
          }));
        }

        // Handle intraday timeframes
        const timeframeSegments = timeframe.split('/');
        const normalizedTimeframe = Number(timeframeSegments[timeframeSegments.length - 1]) || 1;
        const from = new Date(to.getTime() - normalizedTimeframe * lookback * 60 * 1000);
        const endpointV2 = `/v2/aggs/ticker/${symbol}/range/${normalizedTimeframe}/minute/${formatDay(from)}/${formatDay(to)}?adjusted=true&sort=asc&limit=${lookback}`;
        const endpointV3 = `/v3/aggs/ticker/${symbol}/range/${normalizedTimeframe}/minute/${formatDay(from)}/${formatDay(to)}?adjusted=true&sort=asc&limit=${lookback}`;

        let data: any;
        try {
          data = await this.get(endpointV2);
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (/403|forbidden/i.test(msg) || /Massive API error/.test(msg)) {
            console.warn('[MassiveREST] v2 aggregates forbidden, trying v3');
            data = await this.get(endpointV3);
          } else {
            throw e;
          }
        }

        const results: any[] = data.results || data;
        if (!Array.isArray(results)) return [];

        return results.map((bar) => ({
          t: bar.t,
          o: bar.o,
          h: bar.h,
          l: bar.l,
          c: bar.c,
          v: bar.v,
          vw: bar.vw,
        }));
      },
      AGGREGATES_TTL_MS
    );
  }

  /**
   * Get option trades
   */
  async getOptionTrades(
    optionsTicker: string,
    params?: { limit?: number; order?: 'asc' | 'desc'; sort?: string; cursor?: string }
  ): Promise<any[]> {
    const queryParams: Record<string, any> = {
      limit: params?.limit ?? 50,
      order: params?.order ?? 'asc',
      sort: params?.sort ?? 'timestamp',
    };

    if (params?.cursor) {
      queryParams.cursor = params.cursor;
    }

    const data = await this.get<any>(`/v3/trades/${optionsTicker}`, queryParams);
    const results: any[] = data.results || data || [];
    return Array.isArray(results) ? results : [];
  }

  /**
   * Get health status
   */
  getHealth(): RESTHealth {
    return { ...this.health };
  }

  /**
   * Build full URL with query params
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    // Remove leading slash from endpoint if present to avoid path replacement
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    // Ensure base URL ends with slash for proper path joining
    const baseWithSlash = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(cleanEndpoint, `${window.location.origin}${baseWithSlash}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Fetch with retry logic and health tracking
   */
  private async fetchWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = await this.tokenManager.getToken();
        const headers = {
          ...init.headers,
          'x-massive-proxy-token': token,
        };

        const response = await fetch(url, { ...init, headers });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
            console.warn(`[MassiveREST] Rate limited, waiting ${retryAfter}s`);
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 401) {
            // Token expired - refresh and retry
            console.warn('[MassiveREST] Token expired, refreshing');
            await this.tokenManager.refreshToken();
            continue;
          }

          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const data = await response.json();

        // Update health metrics (success)
        const responseTime = Date.now() - startTime;
        this.health.healthy = true;
        this.health.lastSuccess = Date.now();
        this.health.lastError = null;
        this.health.consecutiveErrors = 0;
        this.health.responseTimeMs = responseTime;

        // Record monitoring metrics
        try {
          getMetricsService().recordApiRequest('massive', responseTime, true);
          getMetricsService().recordResponseTime(responseTime);
        } catch (e) {
          // Ignore monitoring errors
        }

        return data;
      } catch (error) {
        lastError = error as Error;

        // Update health metrics (error)
        this.health.lastError = lastError.message;
        this.health.consecutiveErrors++;
        if (this.health.consecutiveErrors >= 3) {
          this.health.healthy = false;
        }

        // Record monitoring metrics (only on final failure)
        if (attempt >= 2) {
          try {
            const responseTime = Date.now() - startTime;
            getMetricsService().recordApiRequest('massive', responseTime, false);
            getMetricsService().recordError('MassiveREST', lastError.message);
          } catch (e) {
            // Ignore monitoring errors
          }
        }

        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(`[MassiveREST] Request failed (attempt ${attempt + 1}/3), retrying in ${backoffMs}ms`);
          await this.sleep(backoffMs);
        }
      }
    }

    console.error('[MassiveREST] Request failed after 3 attempts:', lastError);
    throw new Error(`Request failed after 3 attempts: ${lastError?.message}`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
