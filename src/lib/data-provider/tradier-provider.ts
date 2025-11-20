/**
 * Tradier Data Provider Implementation
 *
 * Fallback provider for:
 * - Options chains (when Massive fails)
 * - Equity quotes (always available)
 * - Historical bars (robust implementation)
 *
 * @module data-provider/tradier-provider
 */

import {
  DataProviderError,
  type OptionsDataProvider,
  type BrokerDataProvider,
  type OptionContractData,
  type OptionChainData,
  type ChainQueryOptions,
  type OptionFlowData,
  type EquityQuote,
  type Bar,
  type DataQualityFlags,
} from './types';

import {
  validateOptionContract,
  validateOptionChain,
  createQualityFlags,
} from './validation';

import {
  normalizeIV,
  clampIV,
} from './iv-utils';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface TradierProviderConfig {
  accessToken: string;
  baseUrl?: string;
  accountId?: string;
  timeoutMs?: number;
  maxRetries?: number;
  enableLogging?: boolean;
}

// ============================================================================
// SIMPLE CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttlMs: number) {
    this.cache.set(key, { data, timestamp: Date.now(), ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
  }
}

// ============================================================================
// TRADIER API CLIENT
// ============================================================================

class TradierApiClient {
  private baseUrl: string;
  private accessToken: string;
  private timeoutMs: number;
  private maxRetries: number;
  private enableLogging: boolean;

  constructor(config: TradierProviderConfig) {
    this.baseUrl = config.baseUrl || 'https://api.tradier.com/v1';
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs || 10000;
    this.maxRetries = config.maxRetries || 3;
    this.enableLogging = config.enableLogging || false;
  }

  private log(message: string, data?: any) {
    if (!this.enableLogging) return;
    console.log(`[TradierProvider] ${message}`, data ? data : '');
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    this.log(`Fetching: ${url}`);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          ...init,
          headers: { ...this.buildHeaders(), ...init?.headers },
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After') || '1');
          this.log(`Rate limited, retrying after ${retryAfter}s`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          const error = new DataProviderError(
            `Tradier API error: ${response.statusText}`,
            'TRADIER_API_ERROR',
            'tradier',
            response.status,
            new Error(text)
          );
          lastError = error;

          if (response.status >= 500) {
            await new Promise(r => setTimeout(r, Math.min(100 * Math.pow(2, attempt), 2000)));
            continue;
          }
          throw error;
        }

        const data = await response.json() as T;
        this.log(`Success from ${path}`);
        return data;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          const delayMs = Math.min(100 * Math.pow(2, attempt), 2000);
          this.log(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    throw new DataProviderError(
      'All retry attempts exhausted',
      'MAX_RETRIES_EXCEEDED',
      'tradier',
      undefined,
      lastError
    );
  }
}

// ============================================================================
// TRADIER OPTIONS PROVIDER
// ============================================================================

export class TradierOptionsProvider implements OptionsDataProvider {
  private client: TradierApiClient;
  private chainCache: SimpleCache<OptionChainData>;
  private contractCache: SimpleCache<OptionContractData>;
  private expirationCache: SimpleCache<string[]>;

  constructor(config: TradierProviderConfig) {
    this.client = new TradierApiClient(config);
    this.chainCache = new SimpleCache();
    this.contractCache = new SimpleCache();
    this.expirationCache = new SimpleCache();
  }

  // === EXPIRATIONS ===

  async getExpirations(
    underlying: string,
    options?: { minDate?: string; maxDate?: string }
  ): Promise<string[]> {
    const cacheKey = `exp:${underlying}:${options?.minDate || 'all'}:${options?.maxDate || 'all'}`;

    // Check cache
    const cached = this.expirationCache.get(cacheKey);
    if (cached) return cached;

    // Fetch from Tradier
    const symbol = underlying.replace(/^I:/, '');
    const response = await this.client.fetch<any>(
      `/markets/options/expirations?symbol=${encodeURIComponent(symbol)}&includeAllRoots=true&strikes=false`
    );

    // Parse expirations
    const dates = response?.expirations?.date || [];
    const arr: string[] = Array.isArray(dates) ? dates : (dates ? [dates] : []);

    // Filter by date range
    let filtered = arr;
    if (options?.minDate || options?.maxDate) {
      filtered = arr.filter(d => {
        if (options.minDate && d < options.minDate) return false;
        if (options.maxDate && d > options.maxDate) return false;
        return true;
      });
    }

    const sorted = filtered.sort();
    this.expirationCache.set(cacheKey, sorted, 300000); // 5 minutes
    return sorted;
  }

  // === OPTIONS CHAIN ===

  async getOptionChain(
    underlying: string,
    options?: ChainQueryOptions
  ): Promise<OptionChainData> {
    const cacheKey = `chain:${underlying}:${JSON.stringify(options || {})}`;

    // Check cache
    const cached = this.chainCache.get(cacheKey);
    if (cached) return cached;

    // Get underlying price
    const symbol = underlying.replace(/^I:/, '');
    const underlyingPrice = await this.getUnderlyingPrice(symbol);

    // Get expirations
    let expirations = await this.getExpirations(underlying, {
      minDate: options?.expirationRange?.[0],
      maxDate: options?.expirationRange?.[1],
    });

    // Limit expirations fetched
    if (expirations.length > (options?.limit ? Math.ceil(options.limit / 10) : 5)) {
      expirations = expirations.slice(0, options?.limit ? Math.ceil(options.limit / 10) : 5);
    }

    // Fetch chains for each expiration in parallel
    const chainPromises = expirations.map(exp =>
      this.client.fetch<any>(
        `/markets/options/chains?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(exp)}&greeks=true`
      ).then(data => this.normalizeChainResponse(data, underlying, exp))
        .catch((error) => {
          console.error(`Failed to fetch expiration ${exp}:`, error);
          return [];
        })
    );

    const allContracts = await Promise.all(chainPromises);
    let contracts = allContracts.flat();

    // Apply filters
    if (options?.strikeRange) {
      contracts = contracts.filter(
        c => c.strike >= options.strikeRange![0] && c.strike <= options.strikeRange![1]
      );
    }

    if (options?.maxSpreadPercent) {
      contracts = contracts.filter(
        c => c.liquidity.spreadPercent <= options.maxSpreadPercent!
      );
    }

    if (options?.minVolume) {
      contracts = contracts.filter(c => c.liquidity.volume >= options.minVolume!);
    }

    if (options?.minOpenInterest) {
      contracts = contracts.filter(c => c.liquidity.openInterest >= options.minOpenInterest!);
    }

    // Limit results
    if (options?.limit && contracts.length > options.limit) {
      contracts = contracts.slice(0, options.limit);
    }

    // Build chain
    const chain: OptionChainData = {
      underlying,
      underlyingPrice,
      contracts,
      quality: {
        source: 'tradier',
        isStale: false,
        hasWarnings: false,
        warnings: [],
        confidence: 100,
        updatedAt: Date.now(),
      },
    };

    // Validate
    const validation = validateOptionChain(chain);
    chain.quality = {
      ...chain.quality,
      ...createQualityFlags(validation, 'tradier'),
    };

    // Cache
    this.chainCache.set(cacheKey, chain, 30000);

    return chain;
  }

  // === SINGLE CONTRACT ===

  async getOptionContract(
    underlying: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put'
  ): Promise<OptionContractData> {
    const cacheKey = `contract:${underlying}:${strike}:${expiration}:${type}`;

    // Check cache
    const cached = this.contractCache.get(cacheKey);
    if (cached) return cached;

    // Get full chain for this expiration
    const chain = await this.getOptionChain(underlying, {
      expirationRange: [expiration, expiration],
    });

    // Find contract
    const contract = chain.contracts.find(
      c => c.strike === strike && c.type === type
    );

    if (!contract) {
      throw new DataProviderError(
        `Contract not found: ${underlying} ${strike} ${type} ${expiration}`,
        'CONTRACT_NOT_FOUND',
        'tradier'
      );
    }

    this.contractCache.set(cacheKey, contract, 30000);
    return contract;
  }

  // === FLOW DATA (NOT AVAILABLE FROM TRADIER) ===

  async getFlowData(
    underlying: string,
    timeRange?: { startTime?: number; endTime?: number }
  ): Promise<OptionFlowData> {
    // Tradier doesn't provide flow data
    // Return synthetic/zero data
    return {
      sweepCount: 0,
      blockCount: 0,
      darkPoolPercent: 0,
      flowBias: 'neutral',
      buyPressure: 50,
      unusualActivity: false,
      flowScore: 0,
      updatedAt: Date.now(),
    };
  }

  // === SUBSCRIPTIONS (NOT IMPLEMENTED) ===

  subscribeToOption(): () => void {
    return () => {};
  }

  subscribeToChain(): () => void {
    return () => {};
  }

  subscribeToFlow(): () => void {
    return () => {};
  }

  // === HELPERS ===

  private normalizeChainResponse(
    response: any,
    underlying: string,
    expiration: string
  ): OptionContractData[] {
    const normalized: OptionContractData[] = [];

    const options = response?.options?.option || [];
    const list = Array.isArray(options) ? options : (options ? [options] : []);

    for (const c of list) {
      try {
        const strike = Number(c.strike || 0);
        if (strike <= 0) continue;

        const type = ((c.option_type || c.type || '').toUpperCase()) === 'CALL' ? 'call' : 'put';

        const bid = Number(c.bid || 0);
        const ask = Number(c.ask || 0);
        const last = Number(c.last || 0);
        const mid = bid && ask && bid > 0 && ask > 0 ? (bid + ask) / 2 : last;

        const greeks = c.greeks || {};
        // Tradier returns IV as percentage (35 = 35%), normalize to decimal (0.35)
        const rawIV = Number(greeks.mid_iv || greeks.iv || 0);
        const iv = normalizeIV(rawIV, 'tradier');
        const normalizedIV = clampIV(iv);

        if (iv !== normalizedIV) {
          this.log(`IV clamped from ${iv.toFixed(4)} to ${normalizedIV.toFixed(4)}`);
        }

        const contract: OptionContractData = {
          ticker: c.symbol || c.option_symbol || '',
          rootSymbol: underlying.replace(/^I:/, ''),
          strike,
          expiration,
          type,
          dte: this.calculateDTE(expiration),

          quote: {
            bid,
            ask,
            mid: mid || 0,
            last,
            bidSize: Number(c.bid_size),
            askSize: Number(c.ask_size),
          },

          greeks: {
            delta: Number(greeks.delta || 0),
            gamma: Number(greeks.gamma || 0),
            theta: Number(greeks.theta || 0),
            vega: Number(greeks.vega || 0),
            rho: Number(greeks.rho),
            iv: normalizedIV,
            ivBid: clampIV(normalizeIV(Number(greeks.bid_iv), 'tradier')),
            ivAsk: clampIV(normalizeIV(Number(greeks.ask_iv), 'tradier')),
          },

          liquidity: {
            volume: Number(c.volume || 0),
            openInterest: Number(c.open_interest || 0),
            spreadPercent: bid && ask && bid > 0 && ask > 0 ? ((ask - bid) / mid) * 100 : 0,
            spreadPoints: ask - bid,
            liquidityQuality: this.assessLiquidity(
              Number(c.volume || 0),
              Number(c.open_interest || 0),
              bid && ask && bid > 0 && ask > 0 ? ((ask - bid) / mid) * 100 : 100
            ),
          },

          quality: {
            source: 'tradier',
            isStale: false,
            hasWarnings: false,
            warnings: [],
            confidence: 100,
            updatedAt: Date.now(),
          },
        };

        // Validate
        const validation = validateOptionContract(contract);
        contract.quality = {
          ...contract.quality,
          ...createQualityFlags(validation, 'tradier'),
        };

        normalized.push(contract);
      } catch (error) {
        console.error('[TradierProvider] Error normalizing contract:', error);
      }
    }

    return normalized;
  }

  private assessLiquidity(volume: number, oi: number, spreadPercent: number) {
    if (spreadPercent > 5) return 'poor';
    if (volume < 10 || oi < 10) return 'fair';
    if (volume < 100 || oi < 100) return 'good';
    return 'excellent';
  }

  private calculateDTE(expiration: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiration);
    expDate.setHours(0, 0, 0, 0);
    const diff = expDate.getTime() - today.getTime();
    return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
  }

  private async getUnderlyingPrice(symbol: string): Promise<number> {
    try {
      const response = await this.client.fetch<any>(
        `/markets/quotes?symbols=${encodeURIComponent(symbol)}`
      );

      const quotes = response?.quotes?.quote || [];
      const quote = Array.isArray(quotes) ? quotes[0] : quotes;

      if (quote) {
        return Number(quote.last || quote.close || quote.bid || 0);
      }
      return 0;
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// TRADIER BROKER PROVIDER
// ============================================================================

export class TradierBrokerProvider implements BrokerDataProvider {
  private client: TradierApiClient;

  constructor(config: TradierProviderConfig) {
    this.client = new TradierApiClient(config);
  }

  async getEquityQuote(symbol: string): Promise<EquityQuote> {
    const clean = symbol.replace(/^I:/, '');

    const response = await this.client.fetch<any>(
      `/markets/quotes?symbols=${encodeURIComponent(clean)}`
    );

    const quotes = response?.quotes?.quote || [];
    const quote = Array.isArray(quotes) ? quotes[0] : quotes;

    if (!quote) {
      throw new DataProviderError(
        `No quote found for ${symbol}`,
        'QUOTE_NOT_FOUND',
        'tradier'
      );
    }

    return {
      symbol: clean,
      price: Number(quote.last || quote.close || 0),
      open: Number(quote.open || 0),
      high: Number(quote.high || 0),
      low: Number(quote.low || 0),
      volume: Number(quote.volume || 0),
      prevClose: Number(quote.prev_close || quote.close || 0),
      change: Number(quote.change || 0),
      changePercent: Number(quote.change_percent || 0),
    };
  }

  async getBars(
    symbol: string,
    interval: string,
    from: string,
    to: string,
    limit?: number
  ): Promise<Bar[]> {
    const clean = symbol.replace(/^I:/, '');
    const isIntraday = ['1min', '5min', '15min'].includes(interval);

    let path: string;

    if (isIntraday) {
      const params = new URLSearchParams({
        symbol: clean,
        interval,
        start: from,
        end: to,
      });
      path = `/markets/timesales?${params.toString()}`;
    } else {
      const params = new URLSearchParams({
        symbol: clean,
        interval,
        start: from,
        end: to,
      });
      path = `/markets/history?${params.toString()}`;
    }

    const response = await this.client.fetch<any>(path);

    // Parse response
    let bars: any[] = [];

    if (isIntraday) {
      bars = response?.series?.data || [];
    } else {
      bars = response?.history?.day || [];
    }

    if (!Array.isArray(bars)) bars = [];

    // Normalize
    return bars.map((bar: any) => {
      let time: number;

      if (bar.timestamp) {
        time = Math.floor(new Date(bar.timestamp).getTime());
      } else if (bar.time) {
        time = Math.floor(new Date(bar.time).getTime());
      } else if (bar.date) {
        time = Math.floor(new Date(bar.date).getTime());
      } else {
        time = 0;
      }

      return {
        time,
        open: Number(bar.open || 0),
        high: Number(bar.high || 0),
        low: Number(bar.low || 0),
        close: Number(bar.close || 0),
        volume: Number(bar.volume || 0),
      } as Bar;
    });
  }

  subscribeToEquity(): () => void {
    return () => {};
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TradierApiClient };
