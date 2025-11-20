// TransportPolicy: Streaming-first data with automatic REST fallback
// Handles WebSocket subscriptions with jittered backoff reconnection
// Falls back to 3s REST polling when WebSocket fails or disconnects

import { massive } from '.';
import { type WebSocketMessage } from './websocket';
import type { MassiveQuote } from './types';

function toNumber(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

function mapMassiveMessageToQuote(data: any, fallbackSymbol: string): MassiveQuote | null {
  if (!data) {
    // console.log('[mapMassiveMessageToQuote] No data received');
    return null;
  }

  // If data is already a properly formatted MassiveQuote (has symbol, last, and all numeric fields), return it directly
  if (
    data.symbol &&
    typeof data.last === 'number' &&
    typeof data.change === 'number' &&
    typeof data.changePercent === 'number'
  ) {
    // console.log(`[mapMassiveMessageToQuote] Data already formatted for ${data.symbol}:`, ...);
    return data as MassiveQuote;
  }

  let symbol =
    data.symbol || data.ticker || data.sym || data.underlying_ticker || fallbackSymbol;
  if (!symbol) {
    // console.log('[mapMassiveMessageToQuote] No symbol found in data:', data);
    return null;
  }

  // Remove I: prefix from indices (I:SPX → SPX) to match watchlist symbols
  if (symbol.startsWith('I:')) {
    symbol = symbol.substring(2);
  }

  const last = toNumber(data.last ?? data.value ?? data.price ?? data.c ?? 0);
  const change = toNumber(data.change ?? data.delta ?? 0);
  const changePercent = toNumber(
    data.changePercent ?? data.change_percent ?? data.percent_change ?? 0
  );
  const volume = toNumber(data.volume ?? data.v ?? 0);
  const bid = toNumber(data.bid ?? data.bp ?? 0);
  const ask = toNumber(data.ask ?? data.ap ?? 0);
  const high = toNumber(data.high ?? data.h ?? last);
  const low = toNumber(data.low ?? data.l ?? last);
  const open = toNumber(data.open ?? data.o ?? last);
  const previousClose = toNumber(
    data.previousClose ?? data.close ?? data.c ?? data.lastClose ?? last
  );
  const timestamp = toNumber(data.timestamp ?? data.t ?? Date.now());

  // console.log(`[mapMassiveMessageToQuote] Mapped ${symbol}:`, { last, change, changePercent });

  return {
    symbol,
    last,
    change,
    changePercent,
    bid,
    ask,
    volume,
    high,
    low,
    open,
    previousClose,
    timestamp,
  };
}

export interface TransportConfig {
  symbol: string;
  isOption?: boolean;
  isIndex?: boolean;
  pollInterval?: number; // Default: 3000ms
  maxReconnectDelay?: number; // Default: 30000ms
}

export type TransportCallback = (data: MassiveQuote, source: 'websocket' | 'rest', timestamp: number) => void;

// Global REST data cache to prevent redundant API calls across multiple transports
const restDataCache = new Map<string, { data: MassiveQuote; timestamp: number }>();
const REST_CACHE_TTL_MS = 2000; // 2 seconds - still fresh but reduces duplicate calls

export class TransportPolicy {
  private config: TransportConfig;
  private callback: TransportCallback;
  private wsUnsubscribe: (() => void) | null = null;
  private pollTimer: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private lastDataTimestamp = 0;
  private isActive = false;
  private lastWsState: 'connecting' | 'open' | 'closed' = 'closed';
  private fetchingBars = false;
  private consecutiveNoChange = 0;
  private lastRestPrice: number | null = null;
  private currentPollInterval: number;
  private readonly basePollInterval: number;
  private readonly maxPollInterval = 15000;
  private readonly closedMarketPollInterval = 12000;
  // Health/debounce tuning
  private consecutiveHealthFailures = 0;
  private readonly healthFailureThreshold = 2; // require 2 consecutive failures before switching to REST
  // Staleness thresholds per architecture: >5s WebSocket, >6s REST
  private readonly wsStaleThresholdMs = 5000;  // consider WS data stale after 5s
  private readonly restStaleThresholdMs = 6000; // consider REST data stale after 6s
  private lastMarketStatusCheck = 0;
  private marketOpen = true;
  // Message batching: accumulate updates and flush every 100ms
  private batchBuffer: Array<{ quote: MassiveQuote; source: 'websocket' | 'rest'; timestamp: number }> = [];
  private batchFlushTimer: any = null;
  private readonly BATCH_FLUSH_INTERVAL = 100; // ms
  private isPaused = false;

  constructor(config: TransportConfig, callback: TransportCallback) {
    this.config = {
      pollInterval: 3000,
      maxReconnectDelay: 30000,
      ...config,
    };
    this.callback = callback;
    // Use adaptive interval instead of fixed 3s
    this.basePollInterval = this.getOptimalPollInterval();
    this.currentPollInterval = this.basePollInterval;
    
    // Add visibility change listener
    this.setupVisibilityListener();
  }

  private setupVisibilityListener() {
    // Check initial state - if page loads hidden, start paused
    if (document.hidden) {
      console.log(`[TransportPolicy] Page loaded hidden, starting paused for ${this.config.symbol}`);
      this.isPaused = true;
    }
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log(`[TransportPolicy] Tab hidden, pausing updates for ${this.config.symbol}`);
        this.pause();
      } else {
        console.log(`[TransportPolicy] Tab visible, resuming updates for ${this.config.symbol}`);
        this.resume();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  private pause() {
    this.isPaused = true;
    this.clearPollTimer();
  }

  private resume() {
    this.isPaused = false;
    if (this.isActive) {
      // Fetch immediately on resume
      void this.pollData();
    }
  }

  private getOptimalPollInterval(): number {
    const { isIndex, isOption, symbol } = this.config;
    
    // Check market hours
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const isPreMarket = hour < 9;
    const isAfterHours = hour >= 16;
    const isMarketClosed = isWeekend || isPreMarket || isAfterHours;
    
    // Base intervals by asset type
    if (isIndex) {
      // Indices are less volatile, can use longer intervals
      return isMarketClosed ? 10000 : 5000;
    } else if (isOption) {
      // Options are most volatile, need faster fallback
      return isMarketClosed ? 6000 : 2000;
    } else {
      // Stocks are moderate
      return isMarketClosed ? 8000 : 4000;
    }
  }

  private enqueueMessage(quote: MassiveQuote, source: 'websocket' | 'rest', timestamp: number) {
    this.batchBuffer.push({ quote, source, timestamp });
    
    // Start flush timer if not already running
    if (!this.batchFlushTimer) {
      this.batchFlushTimer = setTimeout(() => this.flushBatch(), this.BATCH_FLUSH_INTERVAL);
    }
  }

  private flushBatch() {
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }

    if (this.batchBuffer.length === 0) {
      return;
    }

    // Use the most recent message (typically most up-to-date)
    const { quote, source, timestamp } = this.batchBuffer[this.batchBuffer.length - 1];
    this.batchBuffer = [];

    // Single callback invocation per batch
    this.callback(quote, source, timestamp);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    // console.log(`[TransportPolicy] Starting for ${this.config.symbol}`);

    // Try WebSocket first
    this.tryWebSocket();
    
    // Monitor WebSocket health
    this.startHealthCheck();
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;

    // console.log(`[TransportPolicy] Stopping for ${this.config.symbol}`);

    // Note: In-flight requests will be handled by browser's natural cleanup
    // The unified massive API manages its own connection lifecycle

    // Flush any pending batched messages
    this.flushBatch();
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
    
    // Clean up WebSocket
    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }
    
    // Clean up polling
    this.clearPollTimer();
    
    // Clean up reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  setFetchingBars(value: boolean) {
    this.fetchingBars = value;
  }

  private tryWebSocket() {
    if (this.wsUnsubscribe) {
      // Already subscribed
      return;
    }

    const wsState = massive.getConnectionState();
    // console.log(`[TransportPolicy] WebSocket state for ${this.config.symbol}:`, wsState);

    if (wsState === 'closed') {
      // WebSocket is not connected, fall back to polling immediately
      console.log(`[TransportPolicy] WebSocket closed, starting REST fallback for ${this.config.symbol}`);
      this.startPolling();
      this.scheduleReconnect();
      return;
    }

    // Subscribe based on symbol type
    if (this.config.isOption) {
      // Options contract quote subscription
      this.wsUnsubscribe = massive.subscribeOptionAggregates([this.config.symbol], this.handleWsMessage.bind(this));
    } else {
      // Index and stock/underlying quote subscription (both use subscribeQuotes)
      this.wsUnsubscribe = massive.subscribeQuotes([this.config.symbol], this.handleWsMessage.bind(this));
    }

    // console.log(`[TransportPolicy] Subscribed to WebSocket for ${this.config.symbol}`);
  }

  private handleWsMessage(message: WebSocketMessage) {
    if (!this.isActive || this.isPaused) return;

    const now = Date.now();
    this.lastDataTimestamp = now;

    const quote = mapMassiveMessageToQuote(message.data, this.config.symbol);
    if (!quote) {
      console.debug(
        `[TransportPolicy] Ignoring non-quote websocket message for ${this.config.symbol}:`,
        message.data
      );
      return;
    }

    console.debug(
      `[TransportPolicy] WebSocket data received for ${this.config.symbol}:`,
      quote
    );

    // Stop polling if running
    if (this.pollTimer) {
      console.log(`[TransportPolicy] WebSocket recovered, stopping REST fallback for ${this.config.symbol}`);
      this.clearPollTimer();
    }

    // Reset reconnect attempts on successful data
    this.reconnectAttempts = 0;

    // Enqueue for batched processing
    this.enqueueMessage(quote, 'websocket', now);
  }

  private startPolling() {
    if (this.pollTimer) {
      return;
    }

    console.log(
      `[TransportPolicy] Starting REST polling for ${this.config.symbol} (interval ${this.basePollInterval}ms)`
    );
    this.currentPollInterval = this.basePollInterval;
    void this.pollData();
  }

  private clearPollTimer() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleNextPoll(delay?: number) {
    if (!this.isActive || this.isPaused) return;
    const wait = typeof delay === 'number' ? delay : this.currentPollInterval;
    this.clearPollTimer();
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollData();
    }, wait);
  }

  private async pollData() {
    if (!this.isActive || this.isPaused) return;

    if (this.fetchingBars) {
      console.debug(
        `[TransportPolicy] Skipping REST poll for ${this.config.symbol} while historical bars are loading`
      );
      this.scheduleNextPoll();
      return;
    }

    // Check cache first to avoid redundant API calls
    const cached = restDataCache.get(this.config.symbol);
    if (cached && Date.now() - cached.timestamp < REST_CACHE_TTL_MS) {
      console.debug(`[TransportPolicy] Using cached REST data for ${this.config.symbol} (${Date.now() - cached.timestamp}ms old)`);
      const quote = mapMassiveMessageToQuote(cached.data, this.config.symbol);
      if (quote) {
        this.enqueueMessage(quote, 'rest', cached.timestamp);
        this.lastDataTimestamp = cached.timestamp;
      }
      this.scheduleNextPoll();
      return;
    }

    const marketOpen = await this.isMarketOpen();
    if (!marketOpen) {
      this.currentPollInterval = Math.max(this.currentPollInterval, this.closedMarketPollInterval);
    }

    let priceChanged = false;

    try {
      const now = Date.now();
      let data: any;

      if (this.config.isOption) {
        const response = await massive.getOptionsSnapshot(this.config.symbol);
        data = response.results?.[0];
      } else if (this.config.isIndex) {
        data = await massive.getIndex(this.config.symbol);
      } else {
        const quotes = await massive.getQuotes([this.config.symbol]);
        data = quotes[0];
      }

      if (data) {
        const quote = mapMassiveMessageToQuote(data, this.config.symbol);
        if (quote) {
          const previousPrice = this.lastRestPrice;
          priceChanged =
            previousPrice === null || Math.abs(previousPrice - quote.last) > 1e-6;
          this.lastRestPrice = quote.last;
          this.lastDataTimestamp = now;
          
          // Store in cache to prevent redundant API calls
          restDataCache.set(this.config.symbol, { data: quote, timestamp: now });
          
          // Enqueue for batched processing
          this.enqueueMessage(quote, 'rest', now);
        } else {
          console.debug(
            `[TransportPolicy] Ignoring non-quote REST message for ${this.config.symbol}:`,
            data
          );
        }
      }
    } catch (error) {
      console.error(`[TransportPolicy] REST poll failed for ${this.config.symbol}:`, error);
    } finally {
      this.adjustPollInterval(priceChanged, marketOpen);
      this.scheduleNextPoll();
    }
  }

  private startHealthCheck() {
    // Check WebSocket health every 2 seconds
    const healthCheck = setInterval(() => {
      if (!this.isActive) {
        clearInterval(healthCheck);
        return;
      }

        const wsState = massive.getConnectionState();
        const timeSinceLastData = Date.now() - this.lastDataTimestamp;
        const usingRest = !!this.pollTimer;
        const threshold = usingRest ? this.restStaleThresholdMs : this.wsStaleThresholdMs;
        const isStale = timeSinceLastData > threshold; // No data within allowed freshness window

      // Detect state changes
      if (wsState !== this.lastWsState) {
        // console.log(`[TransportPolicy] WebSocket state changed for ${this.config.symbol}: ${this.lastWsState} → ${wsState}`);
        this.lastWsState = wsState;
      }

      if (wsState === 'closed' || isStale) {
        // Increment consecutive failure counter and only activate REST after threshold
        this.consecutiveHealthFailures += 1;
        console.debug(`[TransportPolicy] Health check failure #${this.consecutiveHealthFailures} for ${this.config.symbol} (state: ${wsState}, stale: ${isStale})`);

        if (this.consecutiveHealthFailures >= this.healthFailureThreshold) {
          if (!this.pollTimer) {
            console.log(`[TransportPolicy] WebSocket considered unhealthy after ${this.consecutiveHealthFailures} checks; activating REST fallback for ${this.config.symbol}`);
            this.startPolling();
          }

          // Try to reconnect WebSocket if it's closed
          if (wsState === 'closed' && !this.reconnectTimer) {
            this.scheduleReconnect();
          }
        }
      } else if (wsState === 'open' && !isStale) {
        // WebSocket is healthy: reset failure counter and ensure subscription
        if (this.consecutiveHealthFailures > 0) this.consecutiveHealthFailures = 0;
        if (!this.wsUnsubscribe) {
          console.log(`[TransportPolicy] WebSocket healthy but not subscribed, resubscribing for ${this.config.symbol}`);
          this.tryWebSocket();
        }
      } else {
        // Reset counters for any other healthy-looking state
        if (this.consecutiveHealthFailures > 0) this.consecutiveHealthFailures = 0;
      }
    }, 2000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, Math.min(this.reconnectAttempts, 5));
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.config.maxReconnectDelay!);

    // console.log(`[TransportPolicy] Scheduling WebSocket reconnect for ${this.config.symbol} in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      
      // Attempt to reconnect the WebSocket
      const wsState = massive.getConnectionState();
      if (wsState === 'closed') {
        console.log(`[TransportPolicy] Attempting to reconnect WebSocket for ${this.config.symbol}`);
        massive.connect();
      }
      
      // Try subscribing again
      if (this.isActive) {
        this.tryWebSocket();
        
        // Schedule another reconnect if still needed
        if (massive.getConnectionState() === 'closed') {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private adjustPollInterval(priceChanged: boolean, marketOpen: boolean) {
    if (!marketOpen) {
      this.currentPollInterval = Math.max(this.currentPollInterval, this.closedMarketPollInterval);
      this.consecutiveNoChange = 0;
      return;
    }

    if (priceChanged) {
      this.consecutiveNoChange = 0;
      this.currentPollInterval = this.basePollInterval;
      return;
    }

    this.consecutiveNoChange += 1;
    if (this.consecutiveNoChange >= 3) {
      this.currentPollInterval = Math.min(
        this.maxPollInterval,
        this.currentPollInterval + 2000
      );
    }
  }

  private async isMarketOpen(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastMarketStatusCheck < 60_000) {
      return this.marketOpen;
    }

    this.lastMarketStatusCheck = now;
    try {
      const status = await massive.getMarketStatus();
      const marketState = status?.market?.toLowerCase?.() ?? '';
      this.marketOpen = marketState.includes('open');
    } catch (error) {
      // Fall back to recent activity if status endpoint fails
      this.marketOpen = now - this.lastDataTimestamp < 3 * 60 * 1000;
    }
    return this.marketOpen;
  }

  getLastDataTimestamp(): number {
    return this.lastDataTimestamp;
  }

  isUsingWebSocket(): boolean {
    return !!this.wsUnsubscribe && massive.getConnectionState() === 'open';
  }

  isUsingRest(): boolean {
    return !!this.pollTimer;
  }
}

// Helper function to create a transport policy
export function createTransport(
  symbol: string,
  callback: TransportCallback,
  options?: { isOption?: boolean; isIndex?: boolean; pollInterval?: number }
): (() => void) & { setFetchingBars: (value: boolean) => void } {
  const transport = new TransportPolicy(
    {
      symbol,
      isOption: options?.isOption,
      isIndex: options?.isIndex,
      pollInterval: options?.pollInterval,
    },
    callback
  );

  transport.start();

  const cleanup = (() => transport.stop()) as (() => void) & {
    setFetchingBars: (value: boolean) => void;
  };
  cleanup.setFetchingBars = (value) => transport.setFetchingBars(value);
  return cleanup;
}
