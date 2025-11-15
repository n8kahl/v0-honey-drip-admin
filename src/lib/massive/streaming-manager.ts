// Centralized StreamingManager for live market data
// Guarantees streaming-first with 3s REST fallback
// Manages all subscriptions with automatic reconnect and cleanup

import { massiveWS, type WebSocketMessage } from './websocket';
import { massiveClient } from './client';

export type StreamChannel = 'quotes' | 'agg1s' | 'options' | 'indices';

export interface StreamSubscription {
  id: string;
  symbol: string;
  channels: StreamChannel[];
  isOption?: boolean;
  isIndex?: boolean;
  lastUpdate: number;
  source: 'websocket' | 'rest';
}

export interface StreamData {
  symbol: string;
  data: any;
  timestamp: number;
  source: 'websocket' | 'rest';
  channel: StreamChannel;
}

type StreamCallback = (data: StreamData) => void;

export class StreamingManager {
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private callbacks: Map<string, Set<StreamCallback>> = new Map();
  private wsUnsubscribers: Map<string, () => void> = new Map();
  private restPollers: Map<string, any> = new Map();
  private healthCheckers: Map<string, any> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  
  // Configuration
  private readonly POLL_INTERVAL = 3000; // 3 seconds
  private readonly STALE_THRESHOLD = 5000; // 5 seconds
  private readonly HEALTH_CHECK_INTERVAL = 2000; // 2 seconds
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

  /**
   * Subscribe to real-time data for a symbol
   * Returns unsubscribe function
   */
  subscribe(
    symbol: string,
    channels: StreamChannel[],
    callback: StreamCallback,
    options?: { isOption?: boolean; isIndex?: boolean }
  ): () => void {
    const id = this.getSubscriptionId(symbol, options);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 📡 Subscribing: ${id} channels=${channels.join(',')}`);
    }
    
    // Add callback
    if (!this.callbacks.has(id)) {
      this.callbacks.set(id, new Set());
    }
    this.callbacks.get(id)!.add(callback);
    
    // Create or update subscription
    if (!this.subscriptions.has(id)) {
      const sub: StreamSubscription = {
        id,
        symbol,
        channels,
        isOption: options?.isOption || false,
        isIndex: options?.isIndex || false,
        lastUpdate: 0,
        source: 'rest',
      };
      
      this.subscriptions.set(id, sub);
      this.reconnectAttempts.set(id, 0);
      
      // Start streaming
      this.startStreaming(sub);
      this.startHealthCheck(sub);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(id);
      if (callbacks) {
        callbacks.delete(callback);
        
        // If no more callbacks, clean up subscription
        if (callbacks.size === 0) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[StreamingManager] 🔌 Unsubscribing: ${id}`);
          }
          this.cleanup(id);
        }
      }
    };
  }
  
  /**
   * Start streaming for a subscription
   * Tries WebSocket first, falls back to REST if needed
   */
  private startStreaming(sub: StreamSubscription) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 🚀 Starting stream: ${sub.id}`);
    }
    
    // Try WebSocket first
    const wsState = massiveWS.getConnectionState();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] WebSocket state: ${wsState}`);
    }
    
    if (wsState === 'closed') {
      // WebSocket not available, start REST polling immediately
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[StreamingManager] ⚠️ WebSocket closed, starting REST fallback for ${sub.id}`);
      }
      this.startRestPolling(sub);
      this.scheduleReconnect(sub);
    } else {
      // Subscribe to WebSocket
      this.subscribeWebSocket(sub);
    }
  }
  
  /**
   * Subscribe to WebSocket streams
   */
  private subscribeWebSocket(sub: StreamSubscription) {
    if (this.wsUnsubscribers.has(sub.id)) {
      // Already subscribed
      return;
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 🔗 Subscribing to WebSocket: ${sub.id}`);
    }
    
    let unsubscribe: (() => void) | null = null;
    
    if (sub.isOption) {
      // Subscribe to option quotes
      unsubscribe = massiveWS.subscribeOptionQuotes([sub.symbol], (msg) => {
        this.handleWebSocketMessage(sub, msg, 'options');
      });
    } else if (sub.isIndex) {
      // Subscribe to index aggregates
      unsubscribe = massiveWS.subscribeIndices([sub.symbol], (msg) => {
        this.handleWebSocketMessage(sub, msg, 'indices');
      });
    } else {
      // Subscribe to stock quotes/aggregates
      unsubscribe = massiveWS.subscribeQuotes([sub.symbol], (msg) => {
        this.handleWebSocketMessage(sub, msg, sub.channels.includes('agg1s') ? 'agg1s' : 'quotes');
      });
    }
    
    if (unsubscribe) {
      this.wsUnsubscribers.set(sub.id, unsubscribe);
    }
  }
  
  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(sub: StreamSubscription, msg: WebSocketMessage, channel: StreamChannel) {
    if (!this.subscriptions.has(sub.id)) return;
    
    const now = Date.now();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 📨 WebSocket data: ${sub.id} channel=${channel}`);
    }
    
    // Update subscription
    sub.lastUpdate = now;
    sub.source = 'websocket';
    
    // Stop REST polling if active
    if (this.restPollers.has(sub.id)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[StreamingManager] ✅ WebSocket recovered, stopping REST fallback for ${sub.id}`);
      }
      clearInterval(this.restPollers.get(sub.id));
      this.restPollers.delete(sub.id);
    }
    
    // Reset reconnect attempts
    this.reconnectAttempts.set(sub.id, 0);
    
    // Notify callbacks
    this.notifyCallbacks(sub.id, {
      symbol: sub.symbol,
      data: msg.data,
      timestamp: now,
      source: 'websocket',
      channel,
    });
  }
  
  /**
   * Start REST polling as fallback
   */
  private startRestPolling(sub: StreamSubscription) {
    if (this.restPollers.has(sub.id)) {
      // Already polling
      return;
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 🔄 Starting REST polling: ${sub.id} every ${this.POLL_INTERVAL}ms`);
    }
    
    // Poll immediately
    this.pollRest(sub);
    
    // Then poll at interval
    const poller = setInterval(() => {
      this.pollRest(sub);
    }, this.POLL_INTERVAL);
    
    this.restPollers.set(sub.id, poller);
  }
  
  /**
   * Poll REST API for data
   */
  private async pollRest(sub: StreamSubscription) {
    if (!this.subscriptions.has(sub.id)) return;
    
    try {
      const now = Date.now();
      let data: any;
      let channel: StreamChannel = 'quotes';
      
      if (sub.isOption) {
        // Fetch option snapshot
        const response = await massiveClient.getOptionsSnapshot(sub.symbol);
        data = response.results?.[0];
        channel = 'options';
      } else if (sub.isIndex) {
        // Fetch index value
        data = await massiveClient.getIndex(sub.symbol);
        channel = 'indices';
      } else {
        // Fetch stock quote or 1s aggregate
        if (sub.channels.includes('agg1s')) {
          // TODO: Add 1s aggregate endpoint to client
          const quotes = await massiveClient.getQuotes([sub.symbol]);
          data = quotes[0];
          channel = 'agg1s';
        } else {
          const quotes = await massiveClient.getQuotes([sub.symbol]);
          data = quotes[0];
          channel = 'quotes';
        }
      }
      
      if (data) {
        // Update subscription
        sub.lastUpdate = now;
        sub.source = 'rest';
        
        // Notify callbacks
        this.notifyCallbacks(sub.id, {
          symbol: sub.symbol,
          data,
          timestamp: now,
          source: 'rest',
          channel,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[StreamingManager] ❌ REST poll failed for ${sub.id}:`, error);
      }
    }
  }
  
  /**
   * Start health check for a subscription
   */
  private startHealthCheck(sub: StreamSubscription) {
    if (this.healthCheckers.has(sub.id)) {
      return;
    }
    
    const checker = setInterval(() => {
      if (!this.subscriptions.has(sub.id)) {
        clearInterval(checker);
        return;
      }
      
      const wsState = massiveWS.getConnectionState();
      const timeSinceLastUpdate = Date.now() - sub.lastUpdate;
      const isStale = timeSinceLastUpdate > this.STALE_THRESHOLD;
      
      // Check if WebSocket is healthy
      if (wsState === 'closed' || isStale) {
        // WebSocket unhealthy, ensure REST polling is active
        if (!this.restPollers.has(sub.id)) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[StreamingManager] ⚠️ Stream unhealthy (state=${wsState}, stale=${isStale}), activating REST fallback for ${sub.id}`);
          }
          this.startRestPolling(sub);
          
          // Try to reconnect WebSocket
          if (wsState === 'closed' && !this.reconnectAttempts.has(sub.id)) {
            this.scheduleReconnect(sub);
          }
        }
      } else if (wsState === 'open' && !isStale) {
        // WebSocket healthy, ensure we're subscribed
        if (!this.wsUnsubscribers.has(sub.id)) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[StreamingManager] ✅ WebSocket healthy, resubscribing ${sub.id}`);
          }
          this.subscribeWebSocket(sub);
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
    
    this.healthCheckers.set(sub.id, checker);
  }
  
  /**
   * Schedule WebSocket reconnect with exponential backoff
   */
  private scheduleReconnect(sub: StreamSubscription) {
    const attempts = this.reconnectAttempts.get(sub.id) || 0;
    
    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, Math.min(attempts, 5));
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.MAX_RECONNECT_DELAY);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 🔄 Scheduling reconnect for ${sub.id} in ${Math.round(delay)}ms (attempt ${attempts + 1})`);
    }
    
    setTimeout(() => {
      if (!this.subscriptions.has(sub.id)) return;
      
      this.reconnectAttempts.set(sub.id, attempts + 1);
      
      // Try to reconnect
      const wsState = massiveWS.getConnectionState();
      if (wsState === 'closed') {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[StreamingManager] 🔌 Reconnecting WebSocket for ${sub.id}`);
        }
        massiveWS.connect();
      }
      
      // Try to resubscribe
      this.subscribeWebSocket(sub);
      
      // Schedule next reconnect if still needed
      if (massiveWS.getConnectionState() === 'closed') {
        this.scheduleReconnect(sub);
      }
    }, delay);
  }
  
  /**
   * Notify all callbacks for a subscription
   */
  private notifyCallbacks(id: string, data: StreamData) {
    const callbacks = this.callbacks.get(id);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`[StreamingManager] ❌ Callback error for ${id}:`, error);
          }
        }
      });
    }
  }
  
  /**
   * Clean up a subscription
   */
  private cleanup(id: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 🧹 Cleaning up: ${id}`);
    }
    
    // Unsubscribe from WebSocket
    const wsUnsub = this.wsUnsubscribers.get(id);
    if (wsUnsub) {
      wsUnsub();
      this.wsUnsubscribers.delete(id);
    }
    
    // Stop REST polling
    const poller = this.restPollers.get(id);
    if (poller) {
      clearInterval(poller);
      this.restPollers.delete(id);
    }
    
    // Stop health check
    const checker = this.healthCheckers.get(id);
    if (checker) {
      clearInterval(checker);
      this.healthCheckers.delete(id);
    }
    
    // Remove subscription
    this.subscriptions.delete(id);
    this.callbacks.delete(id);
    this.reconnectAttempts.delete(id);
  }
  
  /**
   * Get subscription ID
   */
  private getSubscriptionId(symbol: string, options?: { isOption?: boolean; isIndex?: boolean }): string {
    if (options?.isOption) return `option:${symbol}`;
    if (options?.isIndex) return `index:${symbol}`;
    return `stock:${symbol}`;
  }
  
  /**
   * Get subscription info (for debugging)
   */
  getSubscriptionInfo(symbol: string, options?: { isOption?: boolean; isIndex?: boolean }): StreamSubscription | null {
    const id = this.getSubscriptionId(symbol, options);
    return this.subscriptions.get(id) || null;
  }
  
  /**
   * Get all active subscriptions (for debugging)
   */
  getAllSubscriptions(): StreamSubscription[] {
    return Array.from(this.subscriptions.values());
  }
  
  /**
   * Disconnect all streams
   */
  disconnectAll() {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[StreamingManager] 🔌 Disconnecting all streams`);
    }
    const ids = Array.from(this.subscriptions.keys());
    ids.forEach(id => this.cleanup(id));
  }
}

// Export singleton instance
export const streamingManager = new StreamingManager();

// Export named export for the class itself
export { StreamingManager as StreamingManagerClass };
