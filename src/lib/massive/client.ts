import type { MassiveQuote, MassiveOption, MassiveOptionsChain, MassiveIndex } from './types';
import { massiveFetch } from './proxy';

const MASSIVE_API_BASE = '/api/massive';
const CONTRACT_TTL_MS = 15 * 60 * 1000;
const contractCache = new Map<string, { t: number; data: any }>();

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

  constructor(baseUrl: string = MASSIVE_API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
    const response = await massiveFetch(url, {
      ...options,
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
      this.connected = false;
      this.lastError = error.message;
      console.error('[Massive API] Request failed:', error);
      throw error;
    }
  }

  async getMarketStatus(): Promise<MassiveMarketStatus> {
    const data = await this.fetch('/v1/marketstatus/now');
    return data;
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
    const quotes: MassiveQuote[] = [];
    
    for (const symbol of symbols) {
      try {
        const isIndex = symbol.startsWith('I:') || ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol);
        
        if (isIndex) {
          const cleanTicker = symbol.replace('I:', '');
        const data = await this.fetch(`/v3/snapshot/indices?tickers=${cleanTicker}`);
          const indexData = data.results?.[0] || data;
          quotes.push({
            symbol: symbol,
            last: indexData.value || 0,
            change: indexData.session?.change || 0,
            changePercent: indexData.session?.change_percent || 0,
            volume: 0,
            timestamp: Date.now(),
          } as MassiveQuote);
        } else {
          const data = await this.fetch(`/v3/snapshot/options/${symbol}?limit=1`);
          const results = data.results || [];
          
          if (results.length > 0) {
            const underlying = results[0]?.underlying_asset || results[0]?.details?.underlying;
            const underlyingPrice = underlying?.price || underlying?.last_quote?.price || 0;
            const underlyingChange = underlying?.change || underlying?.change_today || 0;
            const underlyingChangePercent = underlying?.change_percent || 0;
            
            quotes.push({
              symbol: symbol,
              last: underlyingPrice,
              change: underlyingChange,
              changePercent: underlyingChangePercent,
              volume: 0,
              timestamp: Date.now(),
            } as MassiveQuote);
          } else {
            console.warn(`[v0] No options data found for ${symbol}, using zero values`);
            quotes.push({
              symbol: symbol,
              last: 0,
              change: 0,
              changePercent: 0,
              volume: 0,
              timestamp: Date.now(),
            } as MassiveQuote);
          }
        }
      } catch (error) {
        console.error(`[v0] Failed to fetch quote for ${symbol}:`, error);
        quotes.push({
          symbol: symbol,
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

  async getOptionsChain(underlyingTicker: string, expirationDate?: string): Promise<MassiveOptionsChain> {
    let currentPrice = 0;
    try {
      const quotes = await this.getQuotes([underlyingTicker]);
      currentPrice = quotes[0]?.last || 0;
    } catch (error) {
      console.error('[v0] Failed to get current price, using fallback');
    }
    
    const contractsData = await getOptionContracts(underlyingTicker, 1000, expirationDate);
    
    if (!contractsData || !contractsData.results || contractsData.results.length === 0) {
      return contractsData;
    }
    
    const allContracts = contractsData.results;
    const contractsByExpiry = new Map<string, any[]>();
    
    for (const contract of allContracts) {
      const expiry = contract.expiration_date;
      if (!contractsByExpiry.has(expiry)) {
        contractsByExpiry.set(expiry, []);
      }
      contractsByExpiry.get(expiry)!.push(contract);
    }
    
    const filteredContracts: any[] = [];
    for (const [expiry, contracts] of contractsByExpiry.entries()) {
      const calls = contracts.filter(c => c.contract_type === 'call').sort((a, b) => a.strike_price - b.strike_price);
      const puts = contracts.filter(c => c.contract_type === 'put').sort((a, b) => a.strike_price - b.strike_price);
      
      const itmCalls = calls.filter(c => c.strike_price < currentPrice).slice(-10);
      const otmCalls = calls.filter(c => c.strike_price >= currentPrice).slice(0, 10);
      
      const itmPuts = puts.filter(c => c.strike_price > currentPrice).slice(0, 10);
      const otmPuts = puts.filter(c => c.strike_price <= currentPrice).slice(-10);
      
      filteredContracts.push(...itmCalls, ...otmCalls, ...itmPuts, ...otmPuts);
    }
    
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
    const cleanTicker = ticker.replace('I:', '');
    const data = await this.fetch(`/v3/snapshot/indices?tickers=${cleanTicker}`);
    return data.results?.[0] || data;
  }

  async getIndices(tickers: string[]): Promise<MassiveIndex[]> {
    const cleanTickers = tickers.map(t => t.replace('I:', '')).join(',');
    const data = await this.fetch(`/v3/snapshot/indices?tickers=${cleanTickers}`);
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
    const data = await this.fetch(endpoint);
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

const buildContractsUrl = (underlying: string, limit: number, expiration?: string) => {
  const params = new URLSearchParams({
    underlying_ticker: underlying,
    limit: `${Math.min(limit, 1000)}`,
  });
  if (expiration) {
    params.set('expiration_date', expiration);
  }
  return `/v3/reference/options/contracts?${params.toString()}`;
};

async function fetchContractsRaw(underlying: string, limit: number, expiration?: string) {
  const path = buildContractsUrl(underlying, limit, expiration);
  const response = await massiveFetch(`${MASSIVE_API_BASE}${path}`);
  return response.json();
}

export async function getOptionContracts(underlying: string, limit = 1000, expiration?: string) {
  const key = `${underlying}:${Math.min(limit, 1000)}:${expiration || ''}`;
  const now = Date.now();
  const cached = contractCache.get(key);
  if (cached && now - cached.t < CONTRACT_TTL_MS) {
    return cached.data;
  }
  const data = await fetchContractsRaw(underlying, limit, expiration);
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
