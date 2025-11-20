// Dedicated endpoints for Options Advanced and Indices Advanced plans (2025 spec)
const OPTIONS_WS_URL = 'wss://socket.massive.com/options';
const INDICES_WS_URL = 'wss://socket.massive.com/indices';

type WsEndpoint = 'options' | 'indices';

function getToken(): string {
  const token = (import.meta as any)?.env?.VITE_MASSIVE_PROXY_TOKEN as string | undefined;
  return token || '';
}

type SubscriptionCallback = (message: WebSocketMessage) => void;

export type MessageType = 'quote' | 'option' | 'index' | 'trade' | 'error' | 'aggregate';

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
  type: 'C' | 'P';
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

class MassiveWebSocket {
  private sockets: Record<WsEndpoint, WebSocket | null> = { options: null, indices: null };
  private reconnectAttempts: Record<WsEndpoint, number> = { options: 0, indices: 0 };
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers: Map<string, Set<SubscriptionCallback>> = new Map();
  private isConnecting: Record<WsEndpoint, boolean> = { options: false, indices: false };
  private isAuthenticated: Record<WsEndpoint, boolean> = { options: false, indices: false };
  private subscriptions: Record<WsEndpoint, Set<string>> = { options: new Set(), indices: new Set() };
  private heartbeatIntervals: Record<WsEndpoint, any> = { options: null, indices: null };
  private connectionError: string | null = null;
  private initialized = false;
  private watchlistRoots: string[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      setTimeout(() => this.initialize(), 0);
    }
  }

  private async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.connect();
  }

  async connect() {
    // Connect both options and indices sockets
    this.connectEndpoint('options');
    this.connectEndpoint('indices');
  }

  // Connect to specific endpoint (options or indices)
  connectEndpoint(endpoint: WsEndpoint) {
    if (this.sockets[endpoint]?.readyState === WebSocket.OPEN || this.isConnecting[endpoint]) {
      return;
    }

    this.isConnecting[endpoint] = true;
    this.connectionError = null;
    this.isAuthenticated[endpoint] = false;

    try {
      const wsUrl = endpoint === 'options' ? OPTIONS_WS_URL : INDICES_WS_URL;
      const socket = new WebSocket(wsUrl);
      this.sockets[endpoint] = socket;

      socket.onopen = () => {
        // console.log(`[Massive WS] Connected to ${endpoint}, authenticating...`);
        this.isConnecting[endpoint] = false;
        this.reconnectAttempts[endpoint] = 0;
        
        // Auth with token
        const token = getToken();
        this.send(endpoint, { action: 'auth', token });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const messages = Array.isArray(data) ? data : [data];
          messages.forEach((msg: any) => this.handleMessage(msg, endpoint));
        } catch {
          this.broadcast(event.data);
        }
      };

      socket.onclose = (event) => {
        console.error(`[Massive WS] ${endpoint} connection closed. Code: ${event.code}, Reason: ${event.reason || 'no reason'}, Clean: ${event.wasClean}`);
        this.isAuthenticated[endpoint] = false;
        this.cleanup(endpoint);
        this.attemptReconnect(endpoint);
      };

      socket.onerror = (error) => {
        this.connectionError = 'Connection error';
        console.error(`[Massive WS] ${endpoint} connection error`, error);
        this.cleanup(endpoint);
        this.attemptReconnect(endpoint);
      };
    } catch (err) {
      console.error(`[Massive WS] ${endpoint} connection failed:`, err);
      this.isConnecting[endpoint] = false;
      this.attemptReconnect(endpoint);
    }
  }

  private cleanup(endpoint?: WsEndpoint) {
    if (endpoint) {
      if (this.heartbeatIntervals[endpoint]) {
        clearInterval(this.heartbeatIntervals[endpoint]);
        this.heartbeatIntervals[endpoint] = null;
      }
      if (this.sockets[endpoint]) {
        this.sockets[endpoint]?.close();
        this.sockets[endpoint] = null;
      }
    } else {
      // Cleanup all
      Object.keys(this.heartbeatIntervals).forEach(ep => {
        if (this.heartbeatIntervals[ep as WsEndpoint]) {
          clearInterval(this.heartbeatIntervals[ep as WsEndpoint]);
          this.heartbeatIntervals[ep as WsEndpoint] = null;
        }
      });
      Object.keys(this.sockets).forEach(ep => {
        if (this.sockets[ep as WsEndpoint]) {
          this.sockets[ep as WsEndpoint]?.close();
          this.sockets[ep as WsEndpoint] = null;
        }
      });
    }
  }

  private attemptReconnect(endpoint: WsEndpoint) {
    this.reconnectAttempts[endpoint] += 1;
    if (this.reconnectAttempts[endpoint] > this.maxReconnectAttempts) {
      console.error(`[Massive WS] Max reconnection attempts reached for ${endpoint}`);
      return;
    }
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts[endpoint] - 1);
    setTimeout(() => this.connectEndpoint(endpoint), delay);
  }

  private broadcast(payload: any) {
    for (const subs of this.subscribers.values()) {
      subs.forEach((cb) => cb(payload));
    }
  }

  private notifySubscribers(type: MessageType, symbol: string, message: WebSocketMessage) {
    const key = `${type}:${symbol}`;
    const symbolSubs = this.subscribers.get(key);
    if (symbolSubs) {
      symbolSubs.forEach((cb) => cb(message));
    }
    const typeSubs = this.subscribers.get(type);
    if (typeSubs) {
      typeSubs.forEach((cb) => cb(message));
    }
  }

  private handleMessage(msg: any, endpoint: WsEndpoint) {
    const { ev, sym } = msg;

    // Handle auth failure
    if (msg.status === 'auth_failed' || msg.status === 'error' || (msg.status && msg.status !== 'auth_success')) {
      console.error(`[Massive WS] ${endpoint} authentication failed:`, msg);
      this.isAuthenticated[endpoint] = false;
      // Don't reconnect on auth failure - likely a token issue
      this.sockets[endpoint]?.close();
      this.sockets[endpoint] = null;
      return;
    }

    // Handle auth success
    if (msg.status === 'auth_success' || (ev === 'status' && msg.message?.includes('auth'))) {
      console.log(`[Massive WS] ${endpoint} authenticated successfully`);
      this.isAuthenticated[endpoint] = true;

      // Notify marketDataStore of connection
      if (typeof window !== 'undefined') {
        import('../../stores/marketDataStore').then(({ useMarketDataStore }) => {
          const state = useMarketDataStore.getState();
          state.wsConnection = { ...state.wsConnection, status: 'connected', lastMessageTime: Date.now() };
        });
      }

      // Start heartbeat for this endpoint
      this.heartbeatIntervals[endpoint] = setInterval(
        () => this.send(endpoint, { action: 'ping' }),
        25_000
      );

      // Subscribe based on endpoint
      if (endpoint === 'options') {
        this.subscribeOptionsWatchlist();
      } else if (endpoint === 'indices') {
        this.subscribeIndicesFixed();
      }
      return;
    }
    
    // Handle data messages: Q = option quotes, A/AM = aggregates, T = trades
    if (ev === 'Q') {
      const bid = msg.bp || 0;
      const ask = msg.ap || 0;
      const mid = bid && ask ? (bid + ask) / 2 : (bid || ask || 0);
      const message: WebSocketMessage = {
        type: 'option',
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
      this.notifySubscribers('option', sym, message);
    } else if (ev === 'A' || ev === 'AM') {
      // For indices, normalize symbol by removing I: prefix for subscriber lookup
      const isIndex = sym.startsWith('I:');
      const normalizedSym = isIndex ? sym.substring(2) : sym;
      const messageType = isIndex ? 'index' : 'quote';
      
      const message: WebSocketMessage = {
        type: messageType,
        data: {
          symbol: normalizedSym,
          last: msg.c, // underlying price from options.bars 'c' field
          open: msg.o,
          high: msg.h,
          low: msg.l,
          volume: msg.v,
          vwap: msg.vw,
          timestamp: msg.e,
          underlying: msg.c, // For options bars, 'c' contains underlying price
        },
        timestamp: msg.e,
      };
      this.notifySubscribers(messageType, normalizedSym, message);
    } else if (ev === 'T') {
      const message: WebSocketMessage = {
        type: 'trade',
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
      this.notifySubscribers('trade', sym, message);
    }
    this.broadcast(msg);
  }

  // Subscribe to dynamic watchlist roots on options endpoint
  private subscribeOptionsWatchlist() {
    if (!this.sockets.options || !this.isAuthenticated.options) {
      console.log('[Massive WS] Cannot subscribe options: socket not ready');
      return;
    }

    if (this.watchlistRoots.length === 0) {
      console.log('[Massive WS] No watchlist roots configured, skipping options subscription');
      return;
    }

    const roots = this.watchlistRoots.map(root => `${root}*`);
    const channels = [
      `options.bars:1m,5m,15m,60m:${roots.join(',')}`,
      `options.trades:${roots.join(',')}`,
      `options.quotes:${roots.join(',')}`
    ];
    
    console.log('[Massive WS] Subscribing to options watchlist:', channels);
    this.send('options', { action: 'subscribe', channels });
    
    channels.forEach(ch => this.subscriptions.options.add(ch));
  }

  // Subscribe to fixed indices
  private subscribeIndicesFixed() {
    if (!this.sockets.indices || !this.isAuthenticated.indices) {
      return;
    }
    
    const channels = ['indices.bars:1m,5m,15m,60m:I:SPX,I:NDX,I:VIX,I:RVX'];

    // console.log('[Massive WS] Subscribing to indices:', channels);
    this.send('indices', { action: 'subscribe', channels });
    
    channels.forEach(ch => this.subscriptions.indices.add(ch));
  }

  // Update watchlist and resubscribe options only
  updateWatchlist(roots: string[]) {
    const oldRoots = [...this.watchlistRoots];
    this.watchlistRoots = [...roots];
    
    // Only update options endpoint, indices stay fixed
    if (this.sockets.options && this.isAuthenticated.options) {
      // Unsubscribe old channels
      if (oldRoots.length > 0) {
        const oldChannels = [
          `options.bars:1m,5m,15m,60m:${oldRoots.map(r => `${r}*`).join(',')}`,
          `options.trades:${oldRoots.map(r => `${r}*`).join(',')}`,
          `options.quotes:${oldRoots.map(r => `${r}*`).join(',')}`
        ];
        this.send('options', { action: 'unsubscribe', channels: oldChannels });
        oldChannels.forEach(ch => this.subscriptions.options.delete(ch));
      }
      
      // Subscribe to new watchlist
      this.subscribeOptionsWatchlist();
    }
  }

  private resubscribe(endpoint: WsEndpoint) {
    const socket = this.sockets[endpoint];
    if (!socket || socket.readyState !== WebSocket.OPEN || !this.isAuthenticated[endpoint]) return;
    const channels = Array.from(this.subscriptions[endpoint]);
    if (!channels.length) return;
    console.log(`[Massive WS] Resubscribing to ${endpoint}:`, channels);
    this.send(endpoint, { action: 'subscribe', channels });
  }

  private send(endpoint: WsEndpoint, data: any) {
    const socket = this.sockets[endpoint];
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  private deregisterSubscription(key: string, callback: SubscriptionCallback) {
    const subs = this.subscribers.get(key);
    if (!subs) return;
    subs.delete(callback);
    if (subs.size === 0) {
      this.subscribers.delete(key);
    }
  }

  private createSubscriberKey(type: MessageType, symbol: string) {
    return `${type}:${symbol}`;
  }

  // Legacy compatibility methods
  subscribeQuotes(symbols: string[], callback: SubscriptionCallback) {
    symbols.forEach((symbol) => {
      const key = this.createSubscriberKey('quote', symbol);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    return () => {
      symbols.forEach((symbol) => {
        this.deregisterSubscription(this.createSubscriberKey('quote', symbol), callback);
      });
    };
  }

  subscribeAggregates(symbols: string[], callback: SubscriptionCallback, timespan: 'second' | 'minute' = 'minute') {
    symbols.forEach((symbol) => {
      const key = this.createSubscriberKey('quote', symbol);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    return () => {
      symbols.forEach((symbol) => {
        this.deregisterSubscription(this.createSubscriberKey('quote', symbol), callback);
      });
    };
  }

  subscribeOptionAggregates(optionTickers: string[], callback: SubscriptionCallback, timespan: 'second' | 'minute' = 'minute') {
    optionTickers.forEach((ticker) => {
      const key = this.createSubscriberKey('option', ticker);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    return () => {
      optionTickers.forEach((ticker) => {
        this.deregisterSubscription(this.createSubscriberKey('option', ticker), callback);
      });
    };
  }

  getConnectionState(endpoint: WsEndpoint = 'options'): 'connecting' | 'open' | 'closed' {
    if (this.isConnecting[endpoint]) return 'connecting';
    const socket = this.sockets[endpoint];
    if (!socket) return 'closed';
    if (socket.readyState === WebSocket.OPEN && this.isAuthenticated[endpoint]) return 'open';
    return 'connecting';
  }
  
  isConnected(endpoint: WsEndpoint = 'options'): boolean {
    return this.getConnectionState(endpoint) === 'open';
  }
}

export const massiveWS = new MassiveWebSocket();

/**
 * Subscribe to options data for multiple roots using wildcards (2025 format)
 * Example: subscribeOptionsForRoots(['SPY','QQQ','NVDA'], callback)
 */
export function subscribeOptionsForRoots(roots: string[], callback: SubscriptionCallback) {
  massiveWS.updateWatchlist(roots);
  
  // Subscribe to aggregate data for these roots
  const symbols = roots; // Will be converted to wildcards internally
  return massiveWS.subscribeAggregates(symbols, callback);
}