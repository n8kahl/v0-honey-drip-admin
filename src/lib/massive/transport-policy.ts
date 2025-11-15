// TransportPolicy: Streaming-first data with automatic REST fallback
// Handles WebSocket subscriptions with jittered backoff reconnection
// Falls back to 3s REST polling when WebSocket fails or disconnects

import { massiveWS, type WebSocketMessage } from './websocket';
import { massiveClient } from './client';

export interface TransportConfig {
  symbol: string;
  isOption?: boolean;
  isIndex?: boolean;
  pollInterval?: number; // Default: 3000ms
  maxReconnectDelay?: number; // Default: 30000ms
}

export type TransportCallback = (data: any, source: 'websocket' | 'rest', timestamp: number) => void;

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

  constructor(config: TransportConfig, callback: TransportCallback) {
    this.config = {
      pollInterval: 3000,
      maxReconnectDelay: 30000,
      ...config,
    };
    this.callback = callback;
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
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    // Clean up reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

    console.log(`[TransportPolicy] WebSocket data received for ${this.config.symbol}:`, message.data);

    // Stop polling if running
    if (this.pollTimer) {
      console.log(`[TransportPolicy] WebSocket recovered, stopping REST fallback for ${this.config.symbol}`);
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Reset reconnect attempts on successful data
    this.reconnectAttempts = 0;

    this.callback(message.data, 'websocket', now);
  }

  private startPolling() {
    if (this.pollTimer) {
      // Already polling
      return;
    }

    console.log(`[TransportPolicy] Starting REST polling for ${this.config.symbol} every ${this.config.pollInterval}ms`);

    // Poll immediately
    this.pollData();

    // Then poll at interval
    this.pollTimer = setInterval(() => {
      this.pollData();
    }, this.config.pollInterval);
  }

  private async pollData() {
    if (!this.isActive) return;

    try {
      const now = Date.now();
      let data: any;

      if (this.config.isOption) {
        // Fetch option snapshot
        const response = await massiveClient.getOptionsSnapshot(this.config.symbol);
        data = response.results?.[0];
      } else if (this.config.isIndex) {
        // Fetch index value
        data = await massiveClient.getIndex(this.config.symbol);
      } else {
        // Fetch stock quote
        const quotes = await massiveClient.getQuotes([this.config.symbol]);
        data = quotes[0];
      }

      if (data) {
        this.lastDataTimestamp = now;
        this.callback(data, 'rest', now);
      }
    } catch (error) {
      console.error(`[TransportPolicy] REST poll failed for ${this.config.symbol}:`, error);
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
): () => void {
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

  return () => transport.stop();
}
