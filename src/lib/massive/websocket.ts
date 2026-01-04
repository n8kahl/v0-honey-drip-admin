/**
 * MassiveWebSocket
 *
 * Unified WebSocket manager for real-time Massive data.
 * Handles dual endpoints (options + indices), watchlist management, and automatic reconnection.
 */

import { MassiveTokenManager } from "./token-manager";
import { getMetricsService } from "../../services/monitoring";

const WS_BASE =
  typeof window !== "undefined"
    ? (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host
    : "ws://localhost:8080";

const OPTIONS_WS_URL = `${WS_BASE}/ws/options`;
const INDICES_WS_URL = `${WS_BASE}/ws/indices`;

type WsEndpoint = "options" | "indices";
type SubscriptionCallback = (message: WebSocketMessage) => void;
type UnsubscribeFn = () => void;

export type MessageType = "quote" | "option" | "index" | "trade" | "error" | "aggregate";

export interface WebSocketMessage {
  type: MessageType;
  data: any;
  timestamp: number;
}

export interface QuoteUpdate {
  symbol: string;
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  vwap: number;
  timestamp: number;
}

export interface IndexUpdate {
  symbol: string;
  value: number;
  open: number;
  high: number;
  low: number;
  timestamp: number;
}

export interface OptionUpdate {
  symbol: string;
  strike: number;
  expiry: string;
  type: "C" | "P";
  bid: number;
  ask: number;
  mid: number;
  last: number;
  volume: number;
  iv?: number;
  delta?: number;
  timestamp: number;
}

export interface OptionQuoteUpdate {
  ticker: string;
  bid: number;
  ask: number;
  mid: number;
  bidSize: number;
  askSize: number;
  bidExchange: number;
  askExchange: number;
  timestamp: number;
  volume?: number;
}

export interface TradeUpdate {
  ticker: string;
  price: number;
  size: number;
  exchange: number;
  conditions: number[];
  timestamp: number;
}

export interface WebSocketHealth {
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
}

/**
 * Unified WebSocket manager with dual endpoints
 */
export class MassiveWebSocket {
  private tokenManager: MassiveTokenManager;
  private sockets: Record<WsEndpoint, WebSocket | null> = { options: null, indices: null };
  private reconnectAttempts: Record<WsEndpoint, number> = { options: 0, indices: 0 };
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers: Map<string, Set<SubscriptionCallback>> = new Map();
  private isConnecting: Record<WsEndpoint, boolean> = { options: false, indices: false };
  private isAuthenticated: Record<WsEndpoint, boolean> = { options: false, indices: false };
  private subscriptions: Record<WsEndpoint, Set<string>> = {
    options: new Set(),
    indices: new Set(),
  };
  private heartbeatIntervals: Record<WsEndpoint, NodeJS.Timeout | null> = {
    options: null,
    indices: null,
  };
  private watchlistRoots: string[] = [];
  private lastMessageTime: Record<WsEndpoint, number | null> = { options: null, indices: null };
  // Queue for pending subscriptions when WebSocket is not yet authenticated
  private pendingOptionSubscriptions: string[] = [];

  constructor(tokenManager: MassiveTokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Connect to both WebSocket endpoints
   */
  async connect(): Promise<void> {
    console.log("[MassiveWS] Initializing WebSocket connections");
    console.log("[MassiveWS] WS_BASE:", WS_BASE);

    // Ensure we have a valid token
    await this.tokenManager.ensureToken();

    // Connect both endpoints
    await Promise.all([this.connectEndpoint("options"), this.connectEndpoint("indices")]);
  }

  /**
   * Connect to specific endpoint
   */
  async connectEndpoint(endpoint: WsEndpoint): Promise<void> {
    if (this.sockets[endpoint]?.readyState === WebSocket.OPEN || this.isConnecting[endpoint]) {
      return;
    }

    this.isConnecting[endpoint] = true;
    this.isAuthenticated[endpoint] = false;

    try {
      // Get auth token
      const token = await this.tokenManager.getToken();
      const baseUrl = endpoint === "options" ? OPTIONS_WS_URL : INDICES_WS_URL;
      const wsUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;

      console.log(`[MassiveWS] Connecting to ${endpoint} endpoint`);

      const socket = new WebSocket(wsUrl);
      this.sockets[endpoint] = socket;

      socket.onopen = () => {
        console.log(`[MassiveWS] ${endpoint} connected`);
        this.isConnecting[endpoint] = false;
        this.reconnectAttempts[endpoint] = 0;
        this.isAuthenticated[endpoint] = true;

        // Update monitoring
        try {
          const isConnected = this.isConnected("options") || this.isConnected("indices");
          getMetricsService().setWebSocketStatus(isConnected);
        } catch (e) {
          // Ignore monitoring errors
        }

        // Subscribe based on endpoint
        if (endpoint === "options") {
          this.subscribeOptionsWatchlist();

          // Process any pending option subscriptions that were queued while disconnected
          if (this.pendingOptionSubscriptions.length > 0) {
            console.warn(
              `[MassiveWS] Processing ${this.pendingOptionSubscriptions.length} pending option subscriptions`
            );
            const channels = [
              `options.quotes:${this.pendingOptionSubscriptions.join(",")}`,
              `options.trades:${this.pendingOptionSubscriptions.join(",")}`,
            ];
            this.send("options", { action: "subscribe", params: channels });
            channels.forEach((ch) => this.subscriptions.options.add(ch));
            this.pendingOptionSubscriptions = []; // Clear queue
          }
        } else if (endpoint === "indices") {
          this.subscribeIndicesFixed();
        }

        // Start heartbeat
        this.startHeartbeat(endpoint);
      };

      socket.onmessage = (event) => {
        const now = Date.now();
        this.lastMessageTime[endpoint] = now;

        try {
          const data = JSON.parse(event.data);
          const messages = Array.isArray(data) ? data : [data];
          messages.forEach((msg: any) => this.handleMessage(msg, endpoint));

          // Update monitoring latency (estimate as time since last message)
          try {
            const lastTime = this.lastMessageTime[endpoint === "options" ? "indices" : "options"];
            const latency = lastTime ? now - lastTime : 0;
            if (latency > 0 && latency < 60000) {
              // Only if reasonable (< 1 min)
              getMetricsService().setWebSocketStatus(true, latency);
            }
          } catch (e) {
            // Ignore monitoring errors
          }
        } catch (err) {
          console.error(`[MassiveWS] Failed to parse ${endpoint} message:`, err);
        }
      };

      socket.onclose = (event) => {
        console.warn(
          `[MassiveWS] ${endpoint} connection closed (code: ${event.code}, reason: ${event.reason || "none"})`
        );
        this.isAuthenticated[endpoint] = false;

        // Update monitoring
        try {
          const isConnected = this.isConnected("options") || this.isConnected("indices");
          getMetricsService().setWebSocketStatus(isConnected);
        } catch (e) {
          // Ignore monitoring errors
        }

        this.cleanup(endpoint);
        this.attemptReconnect(endpoint);
      };

      socket.onerror = (error) => {
        console.error(`[MassiveWS] ${endpoint} connection error:`, error);
        this.cleanup(endpoint);
        this.attemptReconnect(endpoint);
      };
    } catch (err) {
      console.error(`[MassiveWS] Failed to connect ${endpoint}:`, err);
      this.isConnecting[endpoint] = false;
      this.attemptReconnect(endpoint);
    }
  }

  /**
   * Disconnect from all endpoints
   */
  disconnect(): void {
    console.log("[MassiveWS] Disconnecting all endpoints");
    this.cleanup();
  }

  /**
   * Update watchlist roots (options only)
   */
  updateWatchlist(roots: string[]): void {
    const oldRoots = [...this.watchlistRoots];
    this.watchlistRoots = [...roots];

    if (this.sockets.options && this.isAuthenticated.options) {
      // Unsubscribe old channels
      if (oldRoots.length > 0) {
        const oldChannels = this.buildOptionsChannels(oldRoots);
        // FIX: Send params as array to avoid comma-splitting issues in hub.ts
        this.send("options", { action: "unsubscribe", params: oldChannels });
        oldChannels.forEach((ch) => this.subscriptions.options.delete(ch));
      }

      // Subscribe to new watchlist
      this.subscribeOptionsWatchlist();
    }

    console.log("[MassiveWS] Watchlist updated:", roots);
  }

  /**
   * Subscribe to quotes (compatibility API)
   */
  subscribeQuotes(symbols: string[], callback: SubscriptionCallback): UnsubscribeFn {
    symbols.forEach((symbol) => {
      const key = this.createSubscriberKey("quote", symbol);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });

    return () => {
      symbols.forEach((symbol) => {
        this.deregisterSubscription(this.createSubscriberKey("quote", symbol), callback);
      });
    };
  }

  /**
   * Subscribe to aggregates (compatibility API)
   */
  subscribeAggregates(
    symbols: string[],
    callback: SubscriptionCallback,
    timespan: "second" | "minute" = "minute"
  ): UnsubscribeFn {
    symbols.forEach((symbol) => {
      const key = this.createSubscriberKey("quote", symbol);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });

    return () => {
      symbols.forEach((symbol) => {
        this.deregisterSubscription(this.createSubscriberKey("quote", symbol), callback);
      });
    };
  }

  /**
   * Subscribe to option aggregates (compatibility API)
   * FIX: Now actually sends WebSocket subscriptions for individual option tickers
   */
  subscribeOptionAggregates(
    optionTickers: string[],
    callback: SubscriptionCallback,
    timespan: "second" | "minute" = "minute"
  ): UnsubscribeFn {
    // Register local callbacks for message routing
    optionTickers.forEach((ticker) => {
      const key = this.createSubscriberKey("option", ticker);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });

    // DIAGNOSTIC: Log subscription attempt details
    const socketState = this.sockets.options?.readyState;
    const socketStateStr =
      socketState === WebSocket.OPEN
        ? "OPEN"
        : socketState === WebSocket.CONNECTING
          ? "CONNECTING"
          : socketState === WebSocket.CLOSING
            ? "CLOSING"
            : socketState === WebSocket.CLOSED
              ? "CLOSED"
              : "NO_SOCKET";

    console.log(`[MassiveWS] 📊 Subscription attempt for options:`, {
      tickers: optionTickers,
      socketExists: !!this.sockets.options,
      socketReadyState: socketStateStr,
      isAuthenticated: this.isAuthenticated.options,
      currentSubscriptions: Array.from(this.subscriptions.options).slice(0, 5),
      totalSubscriptions: this.subscriptions.options.size,
    });

    // FIX: Send actual WebSocket subscription if connection is ready
    // This ensures we receive data for these specific option contracts
    if (this.sockets.options && this.isAuthenticated.options) {
      const channels = [
        `options.quotes:${optionTickers.join(",")}`,
        `options.trades:${optionTickers.join(",")}`,
      ];

      console.warn(
        `[MassiveWS] ✅ Subscribing to individual option contracts:`,
        optionTickers,
        "channels:",
        channels
      );
      this.send("options", { action: "subscribe", params: channels });

      // Track these subscriptions
      channels.forEach((ch) => this.subscriptions.options.add(ch));
    } else {
      // Queue subscriptions for when WebSocket becomes authenticated
      const newTickers = optionTickers.filter((t) => !this.pendingOptionSubscriptions.includes(t));
      if (newTickers.length > 0) {
        this.pendingOptionSubscriptions.push(...newTickers);
        console.warn(
          `[MassiveWS] ⏳ Queued ${newTickers.length} option subscriptions for when WebSocket connects`,
          { queued: newTickers, totalPending: this.pendingOptionSubscriptions.length }
        );
      }
      console.warn(
        `[MassiveWS] ❌ Cannot subscribe to options ${optionTickers.join(",")} - WebSocket not ready`,
        { socketState: socketStateStr, isAuthenticated: this.isAuthenticated.options }
      );
    }

    return () => {
      // Remove local callbacks
      optionTickers.forEach((ticker) => {
        this.deregisterSubscription(this.createSubscriberKey("option", ticker), callback);
      });

      // Unsubscribe from WebSocket if still connected
      if (this.sockets.options && this.isAuthenticated.options) {
        const channels = [
          `options.quotes:${optionTickers.join(",")}`,
          `options.trades:${optionTickers.join(",")}`,
        ];

        this.send("options", { action: "unsubscribe", params: channels });

        // Remove from tracked subscriptions
        channels.forEach((ch) => this.subscriptions.options.delete(ch));
      }
    };
  }

  /**
   * Get connection state for endpoint
   */
  getConnectionState(endpoint: WsEndpoint = "options"): "connecting" | "open" | "closed" {
    if (this.isConnecting[endpoint]) return "connecting";
    const socket = this.sockets[endpoint];
    if (!socket) return "closed";
    if (socket.readyState === WebSocket.OPEN && this.isAuthenticated[endpoint]) return "open";
    return "connecting";
  }

  /**
   * Check if endpoint is connected
   */
  isConnected(endpoint: WsEndpoint = "options"): boolean {
    return this.getConnectionState(endpoint) === "open";
  }

  /**
   * Get health status
   */
  getHealth(): WebSocketHealth {
    return {
      options: {
        connected: this.isConnected("options"),
        authenticated: this.isAuthenticated.options,
        activeSubscriptions: this.subscriptions.options.size,
        lastMessageTime: this.lastMessageTime.options,
        reconnectAttempts: this.reconnectAttempts.options,
      },
      indices: {
        connected: this.isConnected("indices"),
        authenticated: this.isAuthenticated.indices,
        activeSubscriptions: this.subscriptions.indices.size,
        lastMessageTime: this.lastMessageTime.indices,
        reconnectAttempts: this.reconnectAttempts.indices,
      },
    };
  }

  /**
   * Subscribe to dynamic options watchlist
   */
  private subscribeOptionsWatchlist(): void {
    if (!this.sockets.options || !this.isAuthenticated.options) {
      console.log("[MassiveWS] Cannot subscribe options: socket not ready");
      return;
    }

    if (this.watchlistRoots.length === 0) {
      console.log("[MassiveWS] No watchlist roots configured");
      return;
    }

    const channels = this.buildOptionsChannels(this.watchlistRoots);
    console.log("[MassiveWS] Subscribing to options:", channels);

    // FIX: Send params as array to avoid comma-splitting issues in hub.ts
    this.send("options", { action: "subscribe", params: channels });
    channels.forEach((ch) => this.subscriptions.options.add(ch));
  }

  /**
   * Subscribe to fixed indices
   */
  private subscribeIndicesFixed(): void {
    if (!this.sockets.indices || !this.isAuthenticated.indices) {
      return;
    }

    const channels = ["indices.bars:1m,5m,15m,60m:I:SPX,I:NDX,I:VIX,I:RVX"];
    console.log("[MassiveWS] Subscribing to indices:", channels);

    // FIX: Send params as array to avoid comma-splitting issues in hub.ts
    this.send("indices", { action: "subscribe", params: channels });
    channels.forEach((ch) => this.subscriptions.indices.add(ch));
  }

  /**
   * Build options subscription channels
   */
  private buildOptionsChannels(roots: string[]): string[] {
    const wildcards = roots.map((root) => `${root}*`);
    return [
      `options.bars:1m,5m,15m,60m:${wildcards.join(",")}`,
      `options.trades:${wildcards.join(",")}`,
      `options.quotes:${wildcards.join(",")}`,
    ];
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(msg: any, endpoint: WsEndpoint): void {
    const { ev, sym } = msg;

    // Update market data store
    if (typeof window !== "undefined" && ev) {
      import("../../stores/marketDataStore").then(({ useMarketDataStore }) => {
        const state = useMarketDataStore.getState();
        state.wsConnection = {
          ...state.wsConnection,
          status: "connected",
          lastMessageTime: Date.now(),
        };
      });
    }

    // Handle different message types
    if (ev === "Q") {
      // Option quote
      const bid = msg.bp || 0;
      const ask = msg.ap || 0;
      const mid = bid && ask ? (bid + ask) / 2 : bid || ask || 0;

      const message: WebSocketMessage = {
        type: "option",
        data: {
          ticker: sym,
          bid,
          ask,
          mid,
          bidSize: msg.bs || 0,
          askSize: msg.as || 0,
          bidExchange: msg.bx ?? 0,
          askExchange: msg.ax ?? 0,
          timestamp: msg.t,
          volume: msg.v ?? 0,
        } as OptionQuoteUpdate,
        timestamp: msg.t,
      };

      this.notifySubscribers("option", sym, message);

      // Update marketDataStore timestamp for quote updates
      if (typeof window !== "undefined") {
        import("../../stores/marketDataStore").then(({ useMarketDataStore }) => {
          const state = useMarketDataStore.getState();
          state.handleQuoteUpdate(sym, mid);
        });
      }
    } else if (ev === "A" || ev === "AM") {
      // Aggregate (bar)
      const isIndex = sym.startsWith("I:");
      const normalizedSym = isIndex ? sym.substring(2) : sym;
      const messageType = isIndex ? "index" : "quote";

      const message: WebSocketMessage = {
        type: messageType,
        data: {
          symbol: normalizedSym,
          last: msg.c,
          open: msg.o,
          high: msg.h,
          low: msg.l,
          volume: msg.v,
          vwap: msg.vw,
          timestamp: msg.e,
          underlying: msg.c,
        },
        timestamp: msg.e,
      };

      this.notifySubscribers(messageType, normalizedSym, message);

      // Update marketDataStore with the full bar data (not just quote update)
      // This triggers candle merge, rollup, and confluence recalculation
      if (typeof window !== "undefined") {
        import("../../stores/marketDataStore").then(({ useMarketDataStore }) => {
          const state = useMarketDataStore.getState();

          // Call handleAggregateBar with the raw message to update candles
          // This is the critical fix - previously only handleQuoteUpdate was called
          // which only updated lastPrice/lastUpdated but NOT the candle data
          state.handleAggregateBar({
            ev: "AM",
            sym: msg.sym,
            o: msg.o,
            h: msg.h,
            l: msg.l,
            c: msg.c,
            v: msg.v || 0,
            vw: msg.vw || msg.c,
            s: msg.s || msg.e - 60000, // start timestamp (1 min before end if not provided)
            e: msg.e, // end timestamp
            av: msg.av || msg.v || 0,
            op: msg.op || msg.o,
            a: msg.a || msg.vw || msg.c,
            n: msg.n || 0,
          });

          // Also update quote for immediate price display
          state.handleQuoteUpdate(normalizedSym, msg.c);
        });
      }
    } else if (ev === "T") {
      // Trade
      const message: WebSocketMessage = {
        type: "trade",
        data: {
          ticker: sym,
          price: msg.p || 0,
          size: msg.s || 0,
          exchange: msg.x ?? 0,
          conditions: Array.isArray(msg.c) ? msg.c : [],
          timestamp: msg.t,
        } as TradeUpdate,
        timestamp: msg.t,
      };

      this.notifySubscribers("trade", sym, message);
    }
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(type: MessageType, symbol: string, message: WebSocketMessage): void {
    // Notify symbol-specific subscribers
    const key = `${type}:${symbol}`;
    const symbolSubs = this.subscribers.get(key);
    if (symbolSubs) {
      symbolSubs.forEach((cb) => cb(message));
    }

    // Notify type-wide subscribers
    const typeSubs = this.subscribers.get(type);
    if (typeSubs) {
      typeSubs.forEach((cb) => cb(message));
    }
  }

  /**
   * Send message to endpoint
   */
  private send(endpoint: WsEndpoint, data: any): void {
    const socket = this.sockets[endpoint];
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    } else {
      console.warn(`[MassiveWS] Cannot send to ${endpoint}: socket not open`);
    }
  }

  /**
   * Create subscriber key
   */
  private createSubscriberKey(type: MessageType, symbol: string): string {
    return `${type}:${symbol}`;
  }

  /**
   * Deregister subscription
   */
  private deregisterSubscription(key: string, callback: SubscriptionCallback): void {
    const subs = this.subscribers.get(key);
    if (!subs) return;
    subs.delete(callback);
    if (subs.size === 0) {
      this.subscribers.delete(key);
    }
  }

  /**
   * Start heartbeat for endpoint
   */
  private startHeartbeat(endpoint: WsEndpoint): void {
    if (this.heartbeatIntervals[endpoint]) {
      clearInterval(this.heartbeatIntervals[endpoint]!);
    }

    this.heartbeatIntervals[endpoint] = setInterval(() => {
      if (this.sockets[endpoint]?.readyState === WebSocket.OPEN) {
        this.send(endpoint, { action: "ping" });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Cleanup endpoint resources
   */
  private cleanup(endpoint?: WsEndpoint): void {
    if (endpoint) {
      if (this.heartbeatIntervals[endpoint]) {
        clearInterval(this.heartbeatIntervals[endpoint]!);
        this.heartbeatIntervals[endpoint] = null;
      }
      if (this.sockets[endpoint]) {
        this.sockets[endpoint]?.close();
        this.sockets[endpoint] = null;
      }
    } else {
      // Cleanup all endpoints
      (Object.keys(this.heartbeatIntervals) as WsEndpoint[]).forEach((ep) => {
        if (this.heartbeatIntervals[ep]) {
          clearInterval(this.heartbeatIntervals[ep]!);
          this.heartbeatIntervals[ep] = null;
        }
      });
      (Object.keys(this.sockets) as WsEndpoint[]).forEach((ep) => {
        if (this.sockets[ep]) {
          this.sockets[ep]?.close();
          this.sockets[ep] = null;
        }
      });
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(endpoint: WsEndpoint): void {
    this.reconnectAttempts[endpoint] += 1;

    if (this.reconnectAttempts[endpoint] > this.maxReconnectAttempts) {
      console.error(`[MassiveWS] Max reconnection attempts reached for ${endpoint}`);
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts[endpoint] - 1);
    console.log(
      `[MassiveWS] Reconnecting ${endpoint} in ${delay}ms (attempt ${this.reconnectAttempts[endpoint]})`
    );

    setTimeout(() => this.connectEndpoint(endpoint), delay);
  }
}
