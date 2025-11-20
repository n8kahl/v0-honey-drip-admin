/**
 * Data Provider Type Definitions
 *
 * Production-grade unified interface for all market data sources.
 * Supports Massive.com (primary) and Tradier (fallback) with:
 * - Full field coverage for options, indices, and equities
 * - Real-time quality tracking and staleness detection
 * - Comprehensive error handling and fallback logic
 * - Data validation and normalization
 *
 * @module data-provider/types
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DataProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public source: 'massive' | 'tradier' | 'hybrid',
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DataProviderError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any,
    public errors: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// QUALITY FLAGS & TRACKING
// ============================================================================

export type DataSource = 'massive' | 'tradier' | 'hybrid';
export type DataQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Tracks data freshness, validity, and source.
 * Used by all downstream consumers to make intelligent decisions about data usage.
 */
export interface DataQualityFlags {
  /** True if data is > 5 seconds old */
  isStale: boolean;

  /** Milliseconds since last update */
  staleSinceMs?: number;

  /** Whether there are quality warnings */
  hasWarnings: boolean;

  /** Human-readable quality warnings */
  warnings: string[];

  /** Data origin (useful for debugging hybrid calls) */
  source: DataSource;

  /** Unix timestamp (ms) of last update */
  updatedAt: number;

  /** Overall quality assessment */
  quality: DataQualityLevel;

  /** If using fallback, what was the primary error? */
  fallbackReason?: string;

  /** Confidence score 0-100 (considers age, validation, source) */
  confidence: number;
}

export interface DataQualityOptions {
  maxAgeMsForGood?: number;      // Default: 5000ms
  maxAgeMsForFair?: number;      // Default: 15000ms
  maxAgeMsForAcceptable?: number; // Default: 30000ms
  minConfidenceScore?: number;   // Default: 60
}

// ============================================================================
// OPTIONS DATA
// ============================================================================

export interface OptionGreeks {
  delta: number;      // Rate of change vs underlying
  gamma: number;      // Rate of change of delta
  theta: number;      // Daily decay (typically negative)
  vega: number;       // IV sensitivity
  rho?: number;       // Interest rate sensitivity
}

export interface OptionGreeksWithIV extends OptionGreeks {
  iv: number;         // Implied volatility (mid)
  ivBid?: number;     // Bid-side IV
  ivAsk?: number;     // Ask-side IV
}

export interface OptionQuote {
  bid: number;
  ask: number;
  mid: number;        // Calculated (bid + ask) / 2
  last?: number;      // Last traded price
  bidSize?: number;   // Bid depth (number of contracts)
  askSize?: number;   // Ask depth (number of contracts)
}

export interface OptionLiquidity {
  volume: number;              // Today's volume
  openInterest: number;        // Total open interest
  spreadPercent: number;       // (ask - bid) / mid * 100
  spreadPoints: number;        // ask - bid
  liquidityQuality: DataQualityLevel;
}

export interface OptionFlowData {
  /** Smart money sweep count (>100k notional across exchanges) */
  sweepCount: number;

  /** Institutional block trades (>$100k notional) */
  blockCount: number;

  /** Percentage of volume on dark pools */
  darkPoolPercent: number;

  /** Directional bias from flow analysis */
  flowBias: 'bullish' | 'bearish' | 'neutral';

  /** Buy pressure 0-100 */
  buyPressure: number;

  /** Total unusual volume indicator */
  unusualActivity: boolean;

  /** Smart money indicator: 0-100 */
  flowScore: number;

  /** Timestamp of flow data */
  updatedAt: number;
}

/**
 * Normalized option contract data.
 * Single source of truth for all option-related information.
 */
export interface OptionContractData {
  // Identifiers
  ticker: string;           // OCC symbol (e.g., "SPY   240119C00450000")
  rootSymbol: string;       // Underlying (e.g., "SPY")
  strike: number;
  expiration: string;       // ISO date (YYYY-MM-DD)
  type: 'call' | 'put';
  dte: number;              // Days to expiration

  // Quote
  quote: OptionQuote;

  // Greeks
  greeks: OptionGreeksWithIV;

  // Liquidity
  liquidity: OptionLiquidity;

  // Flow (optional, only from Massive Advanced)
  flow?: OptionFlowData;

  // Data quality
  quality: DataQualityFlags;

  // Metadata
  bid_exchange?: number;     // CBOE, etc.
  ask_exchange?: number;
  vwap?: number;             // Volume-weighted average price
}

export interface OptionChainData {
  underlying: string;
  underlyingPrice: number;
  contracts: OptionContractData[];
  quality: DataQualityFlags;
}

export type ChainFilterOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq';

export interface ChainFilter {
  field: 'strike_price' | 'expiration_date' | 'implied_volatility' | 'open_interest' | 'volume';
  operator: ChainFilterOperator;
  value: number | string;
}

export interface ChainQueryOptions {
  strikeRange?: [number, number];    // [min, max]
  expirationRange?: [string, string]; // [from, to] ISO dates
  limit?: number;
  minVolume?: number;
  minOpenInterest?: number;
  maxSpreadPercent?: number;
  includeFlow?: boolean;
  includeFlowData?: boolean;
}

// ============================================================================
// INDICES DATA
// ============================================================================

export interface IndexQuote {
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
}

export interface IndicatorSet {
  ema?: Record<number, number>;      // e.g., { 8: 4500.5, 21: 4498.2, 50: 4490.1, 200: 4475.3 }
  rsi?: number;                      // 0-100
  rsi14?: number;
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  atr?: number;
  atr14?: number;
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  vwap?: number;
  adx?: number;
  pivots?: {
    r3: number;
    r2: number;
    r1: number;
    pivot: number;
    s1: number;
    s2: number;
    s3: number;
  };
}

export interface Timeframe {
  period: '1m' | '5m' | '15m' | '1h' | '1d';
  candles: Candle[];
  indicators: IndicatorSet;
  updatedAt: number;
}

export interface Candle {
  time: number;          // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface IndexSnapshot {
  symbol: string;
  quote: IndexQuote;
  timeframes: Map<string, Timeframe>;  // '1m' -> Timeframe
  quality: DataQualityFlags;
  updatedAt: number;
}

// ============================================================================
// BROKER DATA (Equity/Underlying)
// ============================================================================

export interface EquityQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prevClose: number;
  change: number;
  changePercent: number;
  vwap?: number;
}

export interface Bar {
  time: number;        // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

// ============================================================================
// DATA PROVIDER INTERFACES
// ============================================================================

/**
 * Unified interface for options data
 */
export interface OptionsDataProvider {
  // === QUERY METHODS ===

  /**
   * Get entire options chain for an underlying
   */
  getOptionChain(
    underlying: string,
    options?: ChainQueryOptions
  ): Promise<OptionChainData>;

  /**
   * Get single contract with full details
   */
  getOptionContract(
    underlying: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put'
  ): Promise<OptionContractData>;

  /**
   * Get available expirations
   */
  getExpirations(
    underlying: string,
    options?: {
      minDate?: string;
      maxDate?: string;
    }
  ): Promise<string[]>;

  /**
   * Get flow data for underlying
   */
  getFlowData(
    underlying: string,
    timeRange?: {
      startTime?: number;
      endTime?: number;
    }
  ): Promise<OptionFlowData>;

  // === SUBSCRIPTION METHODS ===

  /**
   * Subscribe to real-time option updates
   */
  subscribeToOption(
    underlying: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put',
    callback: (update: OptionContractData) => void
  ): () => void; // unsubscribe function

  /**
   * Subscribe to options chain updates (all strikes)
   */
  subscribeToChain(
    underlying: string,
    callback: (update: OptionChainData) => void
  ): () => void;

  /**
   * Subscribe to flow updates
   */
  subscribeToFlow(
    underlying: string,
    callback: (flow: OptionFlowData) => void
  ): () => void;
}

/**
 * Unified interface for indices data
 */
export interface IndicesDataProvider {
  // === QUERY METHODS ===

  /**
   * Get index snapshot with all metrics
   */
  getIndexSnapshot(
    tickers: string[]
  ): Promise<Map<string, IndexSnapshot>>;

  /**
   * Get indicators for specific timeframe
   */
  getIndicators(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    lookback?: number
  ): Promise<IndicatorSet>;

  /**
   * Get candles/bars for timeframe
   */
  getCandles(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    from: string,     // ISO date
    to: string,       // ISO date
    limit?: number
  ): Promise<Candle[]>;

  /**
   * Get historical data with indicators
   */
  getTimeframe(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    options?: {
      from?: string;
      to?: string;
      lookback?: number;
    }
  ): Promise<Timeframe>;

  // === SUBSCRIPTION METHODS ===

  /**
   * Subscribe to index updates
   */
  subscribeToIndex(
    ticker: string,
    callback: (snapshot: IndexSnapshot) => void
  ): () => void;

  /**
   * Subscribe to timeframe updates
   */
  subscribeToTimeframe(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    callback: (timeframe: Timeframe) => void
  ): () => void;
}

/**
 * Unified interface for broker/equity data
 */
export interface BrokerDataProvider {
  /**
   * Get equity quote
   */
  getEquityQuote(symbol: string): Promise<EquityQuote>;

  /**
   * Get historical bars
   */
  getBars(
    symbol: string,
    interval: 'minute' | 'hour' | 'day' | '1min' | '5min' | '15min',
    from: string,
    to: string,
    limit?: number
  ): Promise<Bar[]>;

  /**
   * Subscribe to equity quote updates
   */
  subscribeToEquity(
    symbol: string,
    callback: (quote: EquityQuote) => void
  ): () => void;
}

// ============================================================================
// MARKET DATA HUB (UNIFIED REAL-TIME FEED)
// ============================================================================

export type MarketDataTickType = 'option' | 'index' | 'equity' | 'flow';

export interface MarketDataTick {
  timestamp: number;
  source: DataSource;
  type: MarketDataTickType;

  // One of these will be populated
  option?: OptionContractData;
  optionChain?: OptionChainData;
  index?: IndexSnapshot;
  equity?: EquityQuote;
  flow?: OptionFlowData;

  quality: DataQualityFlags;
}

export interface MarketDataSnapshot {
  timestamp: number;
  optionChains: Map<string, OptionChainData>;   // underlying -> chain
  indices: Map<string, IndexSnapshot>;          // ticker -> snapshot
  equities: Map<string, EquityQuote>;           // symbol -> quote
  flows: Map<string, OptionFlowData>;          // underlying -> flow
  quality: DataQualityFlags;
}

export interface MarketDataHubConfig {
  watchlistSymbols: string[];
  indexTickers: string[];
  refreshIntervalMs?: number;
  wsEnabled?: boolean;
  qualityOptions?: DataQualityOptions;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

export type MarketDataCallback = (tick: MarketDataTick) => void;
export type SnapshotCallback = (snapshot: MarketDataSnapshot) => void;

// ============================================================================
// CACHING & STORAGE
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// ============================================================================
// MONITORING & METRICS
// ============================================================================

export interface DataProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  lastErrorTime?: number;
  lastError?: string;
  cacheStats: CacheStats;
  uptime: number;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  latestCheckTime: number;
  responseTimeMs: number;
  lastSuccessTime: number;
  consecutiveErrors: number;
  statusMessage: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ProviderConfig {
  massiveApiKey: string;
  massiveBaseUrl: string;
  tradierToken: string;
  tradierBaseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  cacheTtlMs: Record<string, number>;
  enableFallback: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
}
