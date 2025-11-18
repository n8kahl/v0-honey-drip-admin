import type { MassiveQuote, MassiveOption, MassiveOptionsChain, MassiveIndex } from './types';
import { massiveFetch, withMassiveProxyInit } from './proxy';

const MASSIVE_API_BASE = '/api/massive';
const CONTRACT_TTL_MS = 15 * 60 * 1000;
const AGGREGATES_TTL_MS = 60 * 1000; // 60 seconds for aggregates cache
const contractCache = new Map<string, { t: number; data: any }>();
const aggregatesCache = new Map<string, { t: number; data: MassiveAggregateBar[] }>();

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

export interface MassiveAggregateBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
}

class MassiveClient {
  private baseUrl: string;
  private connected: boolean = false;
  private lastError: string | null = null;
  private abortController: AbortController | null = null;
  private holidaysCache: Map<number, string[]> = new Map();

  constructor(baseUrl: string = MASSIVE_API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Create fresh AbortController for this request
    this.abortController = new AbortController();

    try {
    const response = await massiveFetch(url, {
      ...options,
      signal: this.abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

      if (!response.ok) {
        const errorText = await response.text();
        const error = `Massive API error (${response.status}): ${errorText || response.statusText}`;
        this.lastError = error;
        this.connected = false;
        console.error('[Massive API]', error);
        throw new Error(error);
      }

      this.connected = true;
      this.lastError = null;
      const data = await response.json();
      return data;
    } catch (error: any) {
      // Only log if not an abort
      if (error.name !== 'AbortError') {
        this.connected = false;
        this.lastError = error.message;
        console.error('[Massive API] Request failed:', error);
      }
      throw error;
    }
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async getMarketStatus(): Promise<MassiveMarketStatus> {
    const data = await this.fetch('/v1/marketstatus/now');
    return data;
  }

  /**
   * Fetch market holidays for a given year. Returns an array of ISO date strings.
   * Falls back to an empty array on error and caches per-year results.
   */
  async getMarketHolidays(year?: number): Promise<string[]> {
    const targetYear = typeof year === 'number' ? year : new Date().getFullYear();
    if (this.holidaysCache.has(targetYear)) return this.holidaysCache.get(targetYear)!;

    try {
      const data = await this.fetch(`/v1/market/holidays?year=${encodeURIComponent(String(targetYear))}`);
      const items: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const dates = items
        .map((it: any) => it?.date || it?.holiday_date)
        .filter(Boolean)
        .map((d: any) => String(d));
      this.holidaysCache.set(targetYear, dates);
      return dates;
    } catch (err) {
      // Non-fatal: chart can proceed without holiday gaps. Keep log level low.
      console.debug('[Massive API] Failed to fetch market holidays, proceeding without gaps', err);
      return [];
    }
  }

  async getRSI(optionsTicker: string, params?: {
    timestamp?: string;
    timespan?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    window?: number;
    series_type?: 'close' | 'open' | 'high' | 'low';
    limit?: number;
  }): Promise<{ values: MassiveRSI[] }> {
    let endpoint = `/v1/indicators/rsi/${optionsTicker}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
      const query = queryParams.toString();
      if (query) endpoint += `?${query}`;
    }
    const data = await this.fetch(endpoint);
    return { values: data.results?.values || [] };
  }

  async getQuotes(symbols: string[]): Promise<MassiveQuote[]> {
    // Prefer unified server endpoint (batch + normalized + cached)
    try {
      const tickers = symbols.join(',');
      const resp = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers)}`, {
        // Reuse proxy headers (x-massive-proxy-token)
        headers: withMassiveProxyInit().headers as any,
      } as RequestInit);

      if (resp.ok) {
        const json = await resp.json();
        const items: any[] = Array.isArray(json?.results) ? json.results : [];
        console.log('[MassiveClient] getQuotes response:', items);
        // Map to MassiveQuote shape
        return items.map((it) => {
          const quote = {
            symbol: String(it.symbol ?? ''),
            last: Number(it.last ?? 0),
            change: Number(it.change ?? 0),
            changePercent: Number(it.changePercent ?? 0),
            volume: Number(it.volume ?? 0),
            timestamp: Number(it.asOf ?? Date.now()),
          };
          console.log(`[MassiveClient] Mapped ${it.symbol}: it.last=${it.last} -> quote.last=${quote.last}`);
          return quote;
        }) as MassiveQuote[];
      }
      // If unified endpoint fails, fall through to legacy per-symbol logic
      console.warn('[MassiveClient] /api/quotes returned non-OK, falling back per-symbol');
    } catch (e) {
      console.warn('[MassiveClient] /api/quotes failed, falling back per-symbol', e);
    }

    // Fallback: per-symbol logic (kept for resiliency)
    const quotes: MassiveQuote[] = [];
    for (const symbol of symbols) {
      try {
        const isIndex = symbol.startsWith('I:') || ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol);
        if (isIndex) {
          // Use dedicated index snapshot (single) to avoid shape inconsistencies
          const index = await this.getIndex(symbol);
          quotes.push({
            symbol: (index as any)?.ticker ?? symbol,
            last: Number((index as any)?.value ?? (index as any)?.last ?? 0),
            change: Number((index as any)?.session?.change ?? 0),
            changePercent: Number((index as any)?.session?.change_percent ?? 0),
            volume: 0,
            timestamp: Date.now(),
          } as MassiveQuote);
        } else {
          // Use options snapshot as a last resort to infer underlying price
          const data = await this.fetch(`/v3/snapshot/options/${symbol}?limit=1`);
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
            volume: 0,
            timestamp: Date.now(),
          } as MassiveQuote);
        }
      } catch (error) {
        console.error(`[v0] Failed to fetch quote for ${symbol}:`, error);
        quotes.push({
          symbol,
          last: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          timestamp: Date.now(),
        } as MassiveQuote);
      }
    }
    return quotes;
  }

  async getQuote(symbol: string): Promise<MassiveQuote> {
    const data = await this.fetch(`/v3/snapshot/${symbol}`);
    return data.results?.[0] || data;
  }

  async getOptionsChain(underlyingTicker: string, expirationDate?: string, underlyingPrice?: number): Promise<MassiveOptionsChain> {
    console.log('[MassiveClient] getOptionsChain called for', underlyingTicker, 'with price:', underlyingPrice);
    
    // If underlying price not provided or is 0, fetch it
    let price = underlyingPrice || 0;
    
    if (price === 0) {
      console.log('[MassiveClient] Price is 0, fetching from API...');
      try {
        // For indices like SPX, NDX - use I: prefix
        const isIndex = ['SPX', 'NDX', 'VIX', 'RUT'].includes(underlyingTicker);
        if (isIndex) {
          const indexTicker = `I:${underlyingTicker}`;
          const indexData = await this.fetch(`/v3/snapshot/indices?ticker=${encodeURIComponent(indexTicker)}`);
          console.log('[MassiveClient] Index snapshot result:', indexData);
          if (indexData.value) {
            price = indexData.value;
          }
        } else {
          // For stocks like SPY - try options snapshot first for speed
          const stockData = await this.fetch(`/v3/snapshot/options/${underlyingTicker}?limit=1`);
          console.log('[MassiveClient] Stock snapshot result:', stockData);
          if (stockData.results?.[0]?.underlying_asset?.price) {
            price = stockData.results[0].underlying_asset.price;
          }
        }
      } catch (err) {
        console.warn('[MassiveClient] Could not fetch price:', err);
      }
    }
    
    console.log('[MassiveClient] Final price for', underlyingTicker, ':', price);
    
    // Calculate strike range: ±15% for reasonable ATM range
    const strikeRange = 0.15; // 15%
    const minStrike = price > 0 ? Math.floor(price * (1 - strikeRange)) : undefined;
    const maxStrike = price > 0 ? Math.ceil(price * (1 + strikeRange)) : undefined;
    
    console.log('[MassiveClient] Strike range:', { minStrike, maxStrike });
    
    const contractsData = await getOptionContracts(underlyingTicker, 1000, expirationDate, minStrike, maxStrike);
    
    if (!contractsData || !contractsData.results || contractsData.results.length === 0) {
      return contractsData;
    }
    
    console.log('[MassiveClient] Got contracts:', {
      count: contractsData.results.length,
      sampleStrikes: contractsData.results.slice(0, 10).map((c: any) => c.strike_price),
      sampleDates: [...new Set(contractsData.results.slice(0, 20).map((c: any) => c.expiration_date))],
    });
    
    const filteredContracts = contractsData.results;
    
    const snapshotData = await this.fetch(`/v3/snapshot/options/${underlyingTicker}?limit=250`);
    
    const snapshotMap = new Map();
    if (snapshotData.results) {
      for (const snap of snapshotData.results) {
        if (snap.ticker || snap.details?.ticker) {
          snapshotMap.set(snap.ticker || snap.details.ticker, snap);
        }
      }
    }
    
    const enrichedResults = filteredContracts.map((contract: any) => {
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

  async getOptionsSnapshot(underlyingTicker: string): Promise<any> {
    return this.fetch(`/v3/snapshot/options/${underlyingTicker}`);
  }

  async getOptionContract(optionsTicker: string): Promise<MassiveOption> {
    const data = await this.fetch(`/v3/reference/options/contracts/${optionsTicker}`);
    return data.results || data;
  }

  async getIndex(ticker: string): Promise<MassiveIndex> {
    const finalTicker = ticker.startsWith('I:') ? ticker : `I:${ticker}`;
    const data = await this.fetch(
      `/v3/snapshot/indices?ticker=${encodeURIComponent(finalTicker)}`
    );
    return data.results?.[0] || data;
  }

  async getIndices(tickers: string[]): Promise<MassiveIndex[]> {
    const finalTickers = tickers
      .map((t) => (t.startsWith('I:') ? t : `I:${t}`))
      .join(',');
    const data = await this.fetch(
      `/v3/snapshot/indices?ticker.any_of=${encodeURIComponent(finalTickers)}`
    );
    return data.results || [];
  }

  async getHistoricalData(symbol: string, multiplier: number = 1, timespan: string = 'day', from: string, to: string) {
    return this.fetch(`/v3/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`);
  }

  async getAggregates(symbol: string, timeframe: '1' | '5' | '15' | '60', lookback: number = 200): Promise<MassiveAggregateBar[]> {
    // Normalize timeframe to ensure values like "1/5" fall back to the last segment
    const timeframeSegments = timeframe.split('/');
    const normalizedTimeframe = Number(timeframeSegments[timeframeSegments.length - 1]) || 1;
    const to = new Date();
    const from = new Date(to.getTime() - normalizedTimeframe * lookback * 60 * 1000);
    const formatDay = (date: Date) => date.toISOString().split('T')[0];
    const endpoint = `/v2/aggs/ticker/${symbol}/range/${normalizedTimeframe}/minute/${formatDay(from)}/${formatDay(to)}?adjusted=true&sort=asc&limit=${lookback}`;
    
    // Check cache first
    const cacheKey = `${symbol}:${timeframe}:${lookback}`;
    const cached = aggregatesCache.get(cacheKey);
    if (cached && Date.now() - cached.t < AGGREGATES_TTL_MS) {
      console.log(`[MassiveClient] ✅ Aggregates cache hit for ${cacheKey}`);
      return cached.data;
    }
    
    console.log(`[MassiveClient] 🔄 Fetching aggregates for ${cacheKey}`);
    const data = await this.fetch(endpoint);
    const results: any[] = data.results || data;
    if (!Array.isArray(results)) return [];
    const bars = results.map((bar) => ({
      t: bar.t,
      o: bar.o,
      h: bar.h,
      l: bar.l,
      c: bar.c,
      v: bar.v,
      vw: bar.vw,
    }));
    
    // Cache the result
    aggregatesCache.set(cacheKey, { t: Date.now(), data: bars });
    console.log(`[MassiveClient] ✅ Cached aggregates for ${cacheKey} (${bars.length} bars)`);
    
    return bars;
  }

  async getOptionTrades(
    optionsTicker: string,
    params?: { limit?: number; order?: 'asc' | 'desc'; sort?: string; cursor?: string }
  ): Promise<any[]> {
    const search = new URLSearchParams();
    const limit = params?.limit ?? 50;
    const order = params?.order ?? 'asc';
    const sort = params?.sort ?? 'timestamp';

    if (limit) search.set('limit', String(limit));
    if (order) search.set('order', order);
    if (sort) search.set('sort', sort);
    if (params?.cursor) search.set('cursor', params.cursor);

    const qs = search.toString();
    const endpoint = `/v3/trades/${encodeURIComponent(optionsTicker)}${qs ? `?${qs}` : ''}`;
    const data = await this.fetch(endpoint);
    const results: any[] = data.results || data || [];
    return Array.isArray(results) ? results : [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLastError(): string | null {
    return this.lastError;
  }

}

const buildContractsUrl = (underlying: string, limit: number, expiration?: string, minStrike?: number, maxStrike?: number) => {
  const params = new URLSearchParams({
    underlying_ticker: underlying,
    limit: `${Math.min(limit, 1000)}`,
  });
  if (expiration) {
    params.set('expiration_date', expiration);
  } else {
    // Filter for contracts expiring today or later (includes 0DTE options)
    const today = new Date();
    params.set('expiration_date.gte', today.toISOString().split('T')[0]);
  }
  
  // Add strike price filtering to avoid legacy contracts
  if (minStrike !== undefined) {
    params.set('strike_price.gte', minStrike.toString());
  }
  if (maxStrike !== undefined) {
    params.set('strike_price.lte', maxStrike.toString());
  }
  
  return `/v3/reference/options/contracts?${params.toString()}`;
};

async function fetchContractsRaw(underlying: string, limit: number, expiration?: string, minStrike?: number, maxStrike?: number) {
  const path = buildContractsUrl(underlying, limit, expiration, minStrike, maxStrike);
  const response = await massiveFetch(`${MASSIVE_API_BASE}${path}`);
  return response.json();
}

export async function getOptionContracts(underlying: string, limit = 1000, expiration?: string, minStrike?: number, maxStrike?: number) {
  const key = `${underlying}:${Math.min(limit, 1000)}:${expiration || ''}:${minStrike || ''}:${maxStrike || ''}`;
  const now = Date.now();
  const cached = contractCache.get(key);
  if (cached && now - cached.t < CONTRACT_TTL_MS) {
    return cached.data;
  }
  const data = await fetchContractsRaw(underlying, limit, expiration, minStrike, maxStrike);
  contractCache.set(key, { t: now, data });
  return data;
}

export const massiveClient = new MassiveClient();

let cachedHasKey: boolean | null = null;
let lastCheck = 0;
const HEALTH_TTL = 30_000;

export async function hasApiKey(): Promise<boolean> {
  const now = Date.now();
  if (cachedHasKey !== null && now - lastCheck < HEALTH_TTL) {
    return cachedHasKey;
  }

  try {
    const resp = await fetch('/api/health');
    if (!resp.ok) {
      cachedHasKey = false;
      lastCheck = now;
      return false;
    }
    await resp.json().catch(() => null);
    cachedHasKey = true;
    lastCheck = now;
    return true;
  } catch {
    cachedHasKey = false;
    lastCheck = now;
    return false;
  }
}

export type { MassiveQuote, MassiveOption, MassiveOptionsChain, MassiveIndex };
