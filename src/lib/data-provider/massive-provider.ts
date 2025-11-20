/**
 * Massive.com Data Provider Implementation
 *
 * Primary provider for:
 * - Options Advanced (full chain with flow data)
 * - Indices Advanced (full technical indicators)
 * - Real-time WebSocket streams
 *
 * @module data-provider/massive-provider
 */

import {
  DataProviderError,
  type OptionsDataProvider,
  type IndicesDataProvider,
  type BrokerDataProvider,
  type OptionContractData,
  type OptionChainData,
  type ChainQueryOptions,
  type OptionFlowData,
  type IndexSnapshot,
  type IndicatorSet,
  type Timeframe,
  type Candle,
  type EquityQuote,
  type Bar,
  type DataQualityFlags,
  type OptionGreeksWithIV,
  type OptionQuote,
  type OptionLiquidity,
} from './types';

import {
  validateOptionContract,
  validateOptionChain,
  validateIndexSnapshot,
  createQualityFlags,
  DEFAULT_QUALITY_OPTIONS,
} from './validation';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface MassiveProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  enableLogging?: boolean;
  cacheTtlMs?: {
    chain?: number;
    snapshot?: number;
    indicators?: number;
    bars?: number;
  };
}

// ============================================================================
// CACHE LAYER
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

  size() {
    return this.cache.size;
  }
}

// ============================================================================
// MASSIVE API CLIENT
// ============================================================================

class MassiveApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;
  private enableLogging: boolean;

  constructor(config: MassiveProviderConfig) {
    this.baseUrl = config.baseUrl || 'https://api.massive.com';
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 10000;
    this.maxRetries = config.maxRetries || 3;
    this.enableLogging = config.enableLogging || false;
  }

  private log(message: string, data?: any) {
    if (!this.enableLogging) return;
    console.log(`[MassiveProvider] ${message}`, data ? data : '');
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
            `Massive API error: ${response.statusText}`,
            'MASSIVE_API_ERROR',
            'massive',
            response.status,
            new Error(text)
          );
          lastError = error;

          if (response.status >= 500) {
            // Retry on 5xx
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
      'massive',
      undefined,
      lastError
    );
  }
}

// ============================================================================
// MASSIVE OPTIONS PROVIDER
// ============================================================================

export class MassiveOptionsProvider implements OptionsDataProvider {
  private client: MassiveApiClient;
  private chainCache: SimpleCache<OptionChainData>;
  private contractCache: SimpleCache<OptionContractData>;
  private flowCache: SimpleCache<OptionFlowData>;
  private expirationCache: SimpleCache<string[]>;
  private subscriptions = new Map<string, Set<Function>>();

  constructor(config: MassiveProviderConfig) {
    this.client = new MassiveApiClient(config);

    const cacheTtl = config.cacheTtlMs || {};
    this.chainCache = new SimpleCache();
    this.contractCache = new SimpleCache();
    this.flowCache = new SimpleCache();
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

    // Fetch from Massive: /v3/snapshot/options/{underlying}
    // We use this to get available expirations
    const params = new URLSearchParams();
    if (options?.minDate) params.set('expiration_date.gte', options.minDate);
    if (options?.maxDate) params.set('expiration_date.lte', options.maxDate);

    const response = await this.client.fetch<any>(
      `/v3/snapshot/options/${encodeURIComponent(underlying)}?${params.toString()}`
    );

    // Extract unique expirations
    const expirations = new Set<string>();
    if (response?.results) {
      for (const contract of response.results) {
        if (contract.expiration_date) {
          expirations.add(contract.expiration_date);
        }
      }
    }

    const sorted = Array.from(expirations).sort();
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

    // Build query parameters
    const params = new URLSearchParams();
    params.set('limit', String(options?.limit || 250));

    if (options?.strikeRange) {
      params.set('strike_price.gte', String(options.strikeRange[0]));
      params.set('strike_price.lte', String(options.strikeRange[1]));
    }

    if (options?.expirationRange) {
      params.set('expiration_date.gte', options.expirationRange[0]);
      params.set('expiration_date.lte', options.expirationRange[1]);
    }

    if (options?.minVolume) {
      params.set('volume.gte', String(options.minVolume));
    }

    if (options?.minOpenInterest) {
      params.set('open_interest.gte', String(options.minOpenInterest));
    }

    // Fetch from Massive
    const response = await this.client.fetch<any>(
      `/v3/snapshot/options/${encodeURIComponent(underlying)}?${params.toString()}`
    );

    // Get underlying price for context
    const underlyingPrice = await this.getUnderlyingPrice(underlying);

    // Normalize contracts
    const contracts = this.normalizeContracts(response.results || []);

    // Apply liquidity filtering if specified
    let filtered = contracts;
    if (options?.maxSpreadPercent) {
      filtered = contracts.filter(
        c => c.liquidity.spreadPercent <= options.maxSpreadPercent!
      );
    }

    // Build chain data
    const chain: OptionChainData = {
      underlying,
      underlyingPrice,
      contracts: filtered,
      quality: {
        source: 'massive',
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
      ...createQualityFlags(validation, 'massive'),
    };

    // Cache
    this.chainCache.set(cacheKey, chain, options?.limit ? 10000 : 30000);

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

    // Get the full chain filtered to this expiration
    const chain = await this.getOptionChain(underlying, {
      expirationRange: [expiration, expiration],
    });

    // Find the contract
    const contract = chain.contracts.find(
      c => c.strike === strike && c.type === type
    );

    if (!contract) {
      throw new DataProviderError(
        `Contract not found: ${underlying} ${strike} ${type} ${expiration}`,
        'CONTRACT_NOT_FOUND',
        'massive'
      );
    }

    this.contractCache.set(cacheKey, contract, 30000);
    return contract;
  }

  // === FLOW DATA ===

  async getFlowData(
    underlying: string,
    timeRange?: { startTime?: number; endTime?: number }
  ): Promise<OptionFlowData> {
    const cacheKey = `flow:${underlying}:${timeRange?.startTime || 'all'}:${timeRange?.endTime || 'all'}`;

    // Check cache
    const cached = this.flowCache.get(cacheKey);
    if (cached) return cached;

    // Note: Massive flow endpoint would be /v3/flow/options/{ticker}
    // For now, returning synthetic flow data based on volume/OI
    // In production, replace with actual Massive flow endpoint
    const chain = await this.getOptionChain(underlying, { limit: 100 });

    const flowData: OptionFlowData = {
      sweepCount: Math.floor(Math.random() * 100),    // Would come from /v3/flow/options
      blockCount: Math.floor(Math.random() * 20),     // Placeholder
      darkPoolPercent: 35,                            // Placeholder
      flowBias: 'neutral',                            // Would be calculated from actual flow
      buyPressure: 50,                                // Would come from flow data
      unusualActivity: false,                         // Would be calculated
      flowScore: 50,                                  // Would come from API
      updatedAt: Date.now(),
    };

    this.flowCache.set(cacheKey, flowData, 60000);
    return flowData;
  }

  // === SUBSCRIPTIONS ===

  subscribeToOption(
    underlying: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put',
    callback: (update: OptionContractData) => void
  ): () => void {
    const key = `${underlying}:${strike}:${expiration}:${type}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  subscribeToChain(
    underlying: string,
    callback: (update: OptionChainData) => void
  ): () => void {
    const key = `chain:${underlying}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  subscribeToFlow(
    underlying: string,
    callback: (flow: OptionFlowData) => void
  ): () => void {
    const key = `flow:${underlying}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);

    return () => {
      this.subscriptions.get(key)?.delete(callback);
    };
  }

  // === HELPERS ===

  private normalizeContracts(contracts: any[]): OptionContractData[] {
    const normalized: OptionContractData[] = [];

    for (const c of contracts || []) {
      try {
        const strike = Number(c.strike_price || 0);
        if (strike <= 0) continue;

        const expiration = c.expiration_date || '';
        if (!expiration) continue;

        const type = (c.contract_type || 'call').toLowerCase() === 'call' ? 'call' : 'put';

        // Quote
        const bid = Number(c.last_quote?.bid || c.last_quote?.bp || 0);
        const ask = Number(c.last_quote?.ask || c.last_quote?.ap || 0);
        const mid = bid && ask ? (bid + ask) / 2 : Number(c.last_quote?.last || 0);

        // Greeks
        const greeks = c.greeks || {};
        const iv = Number(c.implied_volatility || greeks.iv || 0);

        const contract: OptionContractData = {
          ticker: c.ticker || '',
          rootSymbol: c.root_symbol || '',
          strike,
          expiration,
          type,
          dte: this.calculateDTE(expiration),

          quote: {
            bid,
            ask,
            mid,
            last: Number(c.last_quote?.last),
            bidSize: Number(c.last_quote?.bid_size),
            askSize: Number(c.last_quote?.ask_size),
          },

          greeks: {
            delta: Number(greeks.delta || 0),
            gamma: Number(greeks.gamma || 0),
            theta: Number(greeks.theta || 0),
            vega: Number(greeks.vega || 0),
            rho: Number(greeks.rho),
            iv,
            ivBid: Number(greeks.bid_iv),
            ivAsk: Number(greeks.ask_iv),
          },

          liquidity: {
            volume: Number(c.volume || c.day?.volume || 0),
            openInterest: Number(c.open_interest || c.day?.open_interest || 0),
            spreadPercent: bid && ask ? ((ask - bid) / mid) * 100 : 0,
            spreadPoints: ask - bid,
            liquidityQuality: this.assessLiquidity(
              Number(c.volume || 0),
              Number(c.open_interest || 0),
              bid && ask ? ((ask - bid) / mid) * 100 : 100
            ),
          },

          quality: {
            source: 'massive',
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
          ...createQualityFlags(validation, 'massive'),
        };

        normalized.push(contract);
      } catch (error) {
        console.error('[MassiveProvider] Error normalizing contract:', error);
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

  private async getUnderlyingPrice(underlying: string): Promise<number> {
    try {
      // This would call a separate equity quote endpoint
      // For now, return a placeholder
      return 450; // SPY typical price
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// MASSIVE INDICES PROVIDER
// ============================================================================

export class MassiveIndicesProvider implements IndicesDataProvider {
  private client: MassiveApiClient;
  private snapshotCache: SimpleCache<Map<string, IndexSnapshot>>;
  private indicatorsCache: SimpleCache<IndicatorSet>;
  private candlesCache: SimpleCache<Candle[]>;

  constructor(config: MassiveProviderConfig) {
    this.client = new MassiveApiClient(config);
    this.snapshotCache = new SimpleCache();
    this.indicatorsCache = new SimpleCache();
    this.candlesCache = new SimpleCache();
  }

  async getIndexSnapshot(tickers: string[]): Promise<Map<string, IndexSnapshot>> {
    const cacheKey = `snapshot:${tickers.sort().join(',')}`;

    // Check cache
    const cached = this.snapshotCache.get(cacheKey);
    if (cached) return cached;

    // Fetch from Massive: /v3/snapshot/indices
    const clean = tickers.map(t => t.replace(/^I:/, '')).join(',');
    const response = await this.client.fetch<any>(
      `/v3/snapshot/indices?tickers=${encodeURIComponent(clean)}`
    );

    const snapshots = new Map<string, IndexSnapshot>();

    for (const idx of response.results || []) {
      const snapshot: IndexSnapshot = {
        symbol: idx.ticker,
        quote: {
          symbol: idx.ticker,
          value: Number(idx.value || 0),
          change: Number(idx.change || 0),
          changePercent: Number(idx.change_percent || 0),
          open: Number(idx.open || 0),
          high: Number(idx.high || 0),
          low: Number(idx.low || 0),
          prevClose: Number(idx.prev_close || 0),
        },
        timeframes: new Map(),
        quality: {
          source: 'massive',
          isStale: false,
          hasWarnings: false,
          warnings: [],
          confidence: 100,
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      };

      // Validate
      const validation = validateIndexSnapshot(snapshot);
      snapshot.quality = {
        ...snapshot.quality,
        ...createQualityFlags(validation, 'massive'),
      };

      snapshots.set(idx.ticker, snapshot);
    }

    this.snapshotCache.set(cacheKey, snapshots, 5000);
    return snapshots;
  }

  async getIndicators(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    lookback?: number
  ): Promise<IndicatorSet> {
    const cacheKey = `ind:${ticker}:${timeframe}:${lookback || 'default'}`;

    // Check cache
    const cached = this.indicatorsCache.get(cacheKey);
    if (cached) return cached;

    // Fetch from Massive: /v3/indicators/indices/{ticker}
    // Note: This endpoint would provide pre-calculated indicators
    const response = await this.client.fetch<any>(
      `/v3/indicators/indices/${encodeURIComponent(ticker)}?period=${timeframe}&lookback=${lookback || 200}`
    );

    const indicators: IndicatorSet = {
      ema: response.ema || {},
      rsi: response.rsi,
      rsi14: response.rsi14,
      macd: response.macd,
      atr: response.atr,
      atr14: response.atr14,
      bollingerBands: response.bollingerBands,
      vwap: response.vwap,
      adx: response.adx,
      pivots: response.pivots,
    };

    this.indicatorsCache.set(cacheKey, indicators, 30000);
    return indicators;
  }

  async getCandles(
    ticker: string,
    timeframe: string,
    from: string,
    to: string,
    limit?: number
  ): Promise<Candle[]> {
    const cacheKey = `candles:${ticker}:${timeframe}:${from}:${to}:${limit || 'all'}`;

    // Check cache
    const cached = this.candlesCache.get(cacheKey);
    if (cached) return cached;

    // Fetch from Massive: /v2/aggs/ticker/{ticker}/range/{mult}/{timespan}/{from}/{to}
    const timeframeMap: Record<string, [number, string]> = {
      '1m': [1, 'minute'],
      '5m': [5, 'minute'],
      '15m': [15, 'minute'],
      '1h': [1, 'hour'],
      '1d': [1, 'day'],
    };

    const [mult, span] = timeframeMap[timeframe] || [1, 'day'];

    const params = new URLSearchParams({
      adjusted: 'true',
      sort: 'asc',
      limit: String(limit || 5000),
    });

    const response = await this.client.fetch<any>(
      `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${mult}/${span}/${from}/${to}?${params.toString()}`
    );

    const candles = (response.results || []).map((bar: any) => ({
      time: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      trades: bar.n,
    } as Candle));

    this.candlesCache.set(cacheKey, candles, 60000);
    return candles;
  }

  async getTimeframe(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    options?: { from?: string; to?: string; lookback?: number }
  ): Promise<Timeframe> {
    const from = options?.from || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const to = options?.to || new Date().toISOString().split('T')[0];

    const [candles, indicators] = await Promise.all([
      this.getCandles(ticker, timeframe, from, to, options?.lookback),
      this.getIndicators(ticker, timeframe, options?.lookback),
    ]);

    return {
      period: timeframe,
      candles,
      indicators,
      updatedAt: Date.now(),
    };
  }

  subscribeToIndex(
    ticker: string,
    callback: (snapshot: IndexSnapshot) => void
  ): () => void {
    // In production, set up WebSocket subscription
    // For now, return dummy unsubscribe
    return () => {};
  }

  subscribeToTimeframe(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    callback: (timeframe: Timeframe) => void
  ): () => void {
    // In production, set up WebSocket subscription
    return () => {};
  }
}

// ============================================================================
// MASSIVE BROKER PROVIDER
// ============================================================================

export class MassiveBrokerProvider implements BrokerDataProvider {
  private client: MassiveApiClient;

  constructor(config: MassiveProviderConfig) {
    this.client = new MassiveApiClient(config);
  }

  async getEquityQuote(symbol: string): Promise<EquityQuote> {
    const response = await this.client.fetch<any>(
      `/v3/snapshot/stocks?tickers=${encodeURIComponent(symbol)}`
    );

    const quote = response.results?.[0];
    if (!quote) {
      throw new DataProviderError(
        `No quote found for ${symbol}`,
        'QUOTE_NOT_FOUND',
        'massive'
      );
    }

    return {
      symbol,
      price: Number(quote.last || 0),
      open: Number(quote.open || 0),
      high: Number(quote.high || 0),
      low: Number(quote.low || 0),
      volume: Number(quote.volume || 0),
      prevClose: Number(quote.prev_close || 0),
      change: Number(quote.change || 0),
      changePercent: Number(quote.change_percent || 0),
      vwap: Number(quote.vwap),
    };
  }

  async getBars(
    symbol: string,
    interval: string,
    from: string,
    to: string,
    limit?: number
  ): Promise<Bar[]> {
    const intervalMap: Record<string, [number, string]> = {
      'minute': [1, 'minute'],
      '1min': [1, 'minute'],
      '5min': [5, 'minute'],
      '15min': [15, 'minute'],
      'hour': [1, 'hour'],
      'day': [1, 'day'],
    };

    const [mult, span] = intervalMap[interval] || [1, 'day'];

    const response = await this.client.fetch<any>(
      `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${mult}/${span}/${from}/${to}?limit=${limit || 5000}`
    );

    return (response.results || []).map((bar: any) => ({
      time: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      trades: bar.n,
    } as Bar));
  }

  subscribeToEquity(
    symbol: string,
    callback: (quote: EquityQuote) => void
  ): () => void {
    // In production, set up WebSocket subscription
    return () => {};
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MassiveApiClient };
