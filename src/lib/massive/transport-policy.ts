// TransportPolicy: Streaming-first data with automatic REST fallback
// Handles WebSocket subscriptions with jittered backoff reconnection
// Falls back to 3s REST polling when WebSocket fails or disconnects

import { massiveWS, type WebSocketMessage } from './websocket';
import { massiveClient } from './client';
import type { MassiveQuote } from './types';

function toNumber(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

function mapMassiveMessageToQuote(data: any, fallbackSymbol: string): MassiveQuote | null {
  if (!data) return null;

  const symbol =
    data.symbol || data.ticker || data.sym || data.underlying_ticker || fallbackSymbol;
  if (!symbol) return null;

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
  private lastMarketStatusCheck = 0;
  private marketOpen = true;

  constructor(config: TransportConfig, callback: TransportCallback) {
    this.config = {
      pollInterval: 3000,
      maxReconnectDelay: 30000,
      ...config,
    };
    this.callback = callback;
    this.basePollInterval = this.config.pollInterval!;
    this.currentPollInterval = this.basePollInterval;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    
    console.log(`[TransportPolicy] Starting for ${this.config.symbol}`);
    
    // Try WebSocket first
    this.tryWebSocket();
    
    // Monitor WebSocket health
    this.startHealthCheck();
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    console.log(`[TransportPolicy] Stopping for ${this.config.symbol}`);
    
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

    const wsState = massiveWS.getConnectionState();
    console.log(`[TransportPolicy] WebSocket state for ${this.config.symbol}:`, wsState);

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
      this.wsUnsubscribe = massiveWS.subscribeOptionQuotes([this.config.symbol], this.handleWsMessage.bind(this));
    } else if (this.config.isIndex) {
      // Index subscription
      this.wsUnsubscribe = massiveWS.subscribeIndices([this.config.symbol], this.handleWsMessage.bind(this));
    } else {
      // Stock/underlying quote subscription
      this.wsUnsubscribe = massiveWS.subscribeQuotes([this.config.symbol], this.handleWsMessage.bind(this));
    }

    console.log(`[TransportPolicy] Subscribed to WebSocket for ${this.config.symbol}`);
  }

  private handleWsMessage(message: WebSocketMessage) {
    if (!this.isActive) return;

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

    console.log(
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

    this.callback(quote, 'websocket', now);
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
    if (!this.isActive) return;
    const wait = typeof delay === 'number' ? delay : this.currentPollInterval;
    this.clearPollTimer();
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollData();
    }, wait);
  }

  private async pollData() {
    if (!this.isActive) return;

    if (this.fetchingBars) {
      console.debug(
        `[TransportPolicy] Skipping REST poll for ${this.config.symbol} while historical bars are loading`
      );
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
        const response = await massiveClient.getOptionsSnapshot(this.config.symbol);
        data = response.results?.[0];
      } else if (this.config.isIndex) {
        data = await massiveClient.getIndex(this.config.symbol);
      } else {
        const quotes = await massiveClient.getQuotes([this.config.symbol]);
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
          this.callback(quote, 'rest', now);
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

      const wsState = massiveWS.getConnectionState();
      const timeSinceLastData = Date.now() - this.lastDataTimestamp;
      const isStale = timeSinceLastData > 10000; // No data for 10 seconds

      // Detect state changes
      if (wsState !== this.lastWsState) {
        console.log(`[TransportPolicy] WebSocket state changed for ${this.config.symbol}: ${this.lastWsState} → ${wsState}`);
        this.lastWsState = wsState;
      }

      if (wsState === 'closed' || isStale) {
        // WebSocket is down or stale, ensure polling is active
        if (!this.pollTimer) {
          console.log(`[TransportPolicy] WebSocket unhealthy (state: ${wsState}, stale: ${isStale}), activating REST fallback for ${this.config.symbol}`);
          this.startPolling();
          
          // Try to reconnect WebSocket if it's closed
          if (wsState === 'closed' && !this.reconnectTimer) {
            this.scheduleReconnect();
          }
        }
      } else if (wsState === 'open' && !isStale) {
        // WebSocket is healthy
        if (!this.wsUnsubscribe) {
          // Not subscribed yet, try subscribing
          console.log(`[TransportPolicy] WebSocket healthy but not subscribed, resubscribing for ${this.config.symbol}`);
          this.tryWebSocket();
        }
      }
    }, 2000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, Math.min(this.reconnectAttempts, 5));
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.config.maxReconnectDelay!);

    console.log(`[TransportPolicy] Scheduling WebSocket reconnect for ${this.config.symbol} in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      
      // Attempt to reconnect the WebSocket
      const wsState = massiveWS.getConnectionState();
      if (wsState === 'closed') {
        console.log(`[TransportPolicy] Attempting to reconnect WebSocket for ${this.config.symbol}`);
        massiveWS.connect();
      }
      
      // Try subscribing again
      if (this.isActive) {
        this.tryWebSocket();
        
        // Schedule another reconnect if still needed
        if (massiveWS.getConnectionState() === 'closed') {
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
      const status = await massiveClient.getMarketStatus();
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
    return !!this.wsUnsubscribe && massiveWS.getConnectionState() === 'open';
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
