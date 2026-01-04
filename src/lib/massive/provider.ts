/**
 * MassiveDataProvider
 *
 * Unified entry point for all Massive API operations.
 * Provides REST and WebSocket access through a single, coherent interface.
 */

import { MassiveTokenManager } from "./token-manager";
import { MassiveCache } from "./cache";
import { MassiveREST } from "./rest";
import { MassiveWebSocket } from "./websocket";
import type { MassiveQuote, MassiveOption, MassiveOptionsChain, MassiveIndex } from "./types";
import type { MassiveAggregateBar, MassiveMarketStatus, MassiveRSI } from "./rest";
import type { WebSocketMessage } from "./websocket";

export interface MassiveConfig {
  baseUrl?: string;
  wsUrl?: string;
}

export interface HealthStatus {
  rest: {
    healthy: boolean;
    lastSuccess: number | null;
    lastError: string | null;
    consecutiveErrors: number;
    responseTimeMs: number;
  };
  websocket: {
    options: {
      connected: boolean;
      authenticated: boolean;
      activeSubscriptions: number;
      lastMessageTime: number | null;
      reconnectAttempts: number;
    };
    indices: {
      connected: boolean;
      authenticated: boolean;
      activeSubscriptions: number;
      lastMessageTime: number | null;
      reconnectAttempts: number;
    };
  };
  token: {
    hasToken: boolean;
    expiresAt: number | null;
    isValid: boolean;
  };
  cache: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
}

type UnsubscribeFn = () => void;

/**
 * Unified Massive data provider
 */
export class MassiveDataProvider {
  private tokenManager: MassiveTokenManager;
  private cache: MassiveCache;
  private rest: MassiveREST;
  private ws: MassiveWebSocket;
  private initialized: boolean = false;

  constructor(config?: MassiveConfig) {
    this.tokenManager = new MassiveTokenManager();
    this.cache = new MassiveCache();
    this.rest = new MassiveREST(this.tokenManager, this.cache);
    this.ws = new MassiveWebSocket(this.tokenManager);
  }

  /**
   * Initialize and connect (call once on app start)
   */
  async connect(): Promise<void> {
    if (this.initialized) {
      console.warn("[MassiveProvider] Already initialized");
      return;
    }

    console.log("[MassiveProvider] Initializing...");

    // Ensure token is available
    await this.tokenManager.ensureToken();

    // Connect WebSocket endpoints
    await this.ws.connect();

    this.initialized = true;
    console.log("[MassiveProvider] Initialized successfully");
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.ws.disconnect();
    this.initialized = false;
    console.log("[MassiveProvider] Disconnected");
  }

  /**
   * Get token manager (for legacy endpoints that need ephemeral tokens)
   */
  getTokenManager(): MassiveTokenManager {
    return this.tokenManager;
  }

  // ==================== REST OPERATIONS ====================

  /**
   * Get current market status
   */
  async getMarketStatus(): Promise<MassiveMarketStatus> {
    return this.rest.getMarketStatus();
  }

  /**
   * Get market holidays for a year
   */
  async getMarketHolidays(year?: number): Promise<string[]> {
    return this.rest.getMarketHolidays(year);
  }

  /**
   * Get RSI indicator
   */
  async getRSI(
    optionsTicker: string,
    params?: {
      timestamp?: string;
      timespan?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
      window?: number;
      series_type?: "close" | "open" | "high" | "low";
      limit?: number;
    }
  ): Promise<{ values: MassiveRSI[] }> {
    return this.rest.getRSI(optionsTicker, params);
  }

  /**
   * Get single quote
   */
  async getQuote(symbol: string): Promise<MassiveQuote> {
    return this.rest.getQuote(symbol);
  }

  /**
   * Get batch quotes
   */
  async getQuotes(symbols: string[]): Promise<MassiveQuote[]> {
    return this.rest.getQuotes(symbols);
  }

  /**
   * Get options chain
   */
  async getOptionsChain(
    underlyingTicker: string,
    expirationDate?: string,
    underlyingPrice?: number
  ): Promise<MassiveOptionsChain> {
    return this.rest.getOptionsChain(underlyingTicker, expirationDate, underlyingPrice);
  }

  /**
   * Get options snapshot
   * @param options.limit - Max contracts to return (default 250, max 250)
   * @param options.expirationDate - Filter by expiration date (YYYY-MM-DD)
   */
  async getOptionsSnapshot(
    underlyingTicker: string,
    options?: { limit?: number; expirationDate?: string }
  ): Promise<any> {
    return this.rest.getOptionsSnapshot(underlyingTicker, options);
  }

  /**
   * Get specific option contract snapshot (for individual contract prices)
   * Works 24/7 even when market is closed
   */
  async getContractSnapshot(optionContract: string): Promise<any> {
    return this.rest.getContractSnapshot(optionContract);
  }

  /**
   * Get option contract
   */
  async getOptionContract(optionsTicker: string): Promise<MassiveOption> {
    return this.rest.getOptionContract(optionsTicker);
  }

  /**
   * Get option contracts with filters
   */
  async getOptionContracts(
    underlying: string,
    limit?: number,
    expiration?: string,
    minStrike?: number,
    maxStrike?: number
  ): Promise<any> {
    return this.rest.getOptionContracts(underlying, limit, expiration, minStrike, maxStrike);
  }

  /**
   * Get single index
   */
  async getIndex(ticker: string): Promise<MassiveIndex> {
    return this.rest.getIndex(ticker);
  }

  /**
   * Get multiple indices
   */
  async getIndices(tickers: string[]): Promise<MassiveIndex[]> {
    return this.rest.getIndices(tickers);
  }

  /**
   * Get historical data
   */
  async getHistoricalData(
    symbol: string,
    multiplier?: number,
    timespan?: string,
    from?: string,
    to?: string
  ): Promise<any> {
    return this.rest.getHistoricalData(symbol, multiplier, timespan, from!, to!);
  }

  /**
   * Get aggregates
   */
  async getAggregates(
    symbol: string,
    timeframe: "1" | "5" | "15" | "60" | "1D",
    lookback?: number
  ): Promise<MassiveAggregateBar[]> {
    return this.rest.getAggregates(symbol, timeframe, lookback);
  }

  /**
   * Get option trades
   */
  async getOptionTrades(
    optionsTicker: string,
    params?: { limit?: number; order?: "asc" | "desc"; sort?: string; cursor?: string }
  ): Promise<any[]> {
    return this.rest.getOptionTrades(optionsTicker, params);
  }

  // ==================== WEBSOCKET OPERATIONS ====================

  /**
   * Subscribe to quote updates
   */
  subscribeQuotes(symbols: string[], callback: (message: WebSocketMessage) => void): UnsubscribeFn {
    return this.ws.subscribeQuotes(symbols, callback);
  }

  /**
   * Subscribe to aggregate updates
   */
  subscribeAggregates(
    symbols: string[],
    callback: (message: WebSocketMessage) => void,
    timespan: "second" | "minute" = "minute"
  ): UnsubscribeFn {
    return this.ws.subscribeAggregates(symbols, callback, timespan);
  }

  /**
   * Subscribe to option aggregate updates
   */
  subscribeOptionAggregates(
    optionTickers: string[],
    callback: (message: WebSocketMessage) => void,
    timespan: "second" | "minute" = "minute"
  ): UnsubscribeFn {
    return this.ws.subscribeOptionAggregates(optionTickers, callback, timespan);
  }

  /**
   * Update options watchlist
   */
  updateWatchlist(roots: string[]): void {
    this.ws.updateWatchlist(roots);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(endpoint: "options" | "indices" = "options"): boolean {
    return this.ws.isConnected(endpoint);
  }

  /**
   * Get WebSocket connection state
   */
  getConnectionState(
    endpoint: "options" | "indices" = "options"
  ): "connecting" | "open" | "closed" {
    return this.ws.getConnectionState(endpoint);
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Clear cache
   */
  clearCache(pattern?: string): void {
    this.cache.clear(pattern);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
    return this.cache.getStats();
  }

  // ==================== HEALTH & STATUS ====================

  /**
   * Get overall health status
   */
  getHealth(): HealthStatus {
    return {
      rest: this.rest.getHealth(),
      websocket: this.ws.getHealth(),
      token: this.tokenManager.getInfo(),
      cache: this.cache.getStats(),
    };
  }

  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Create and export singleton instance
export const massive = new MassiveDataProvider();

// Auto-connect on module load (browser only)
if (typeof window !== "undefined") {
  massive.connect().catch((err) => {
    console.error("[MassiveProvider] Auto-connect failed:", err);
  });
}
