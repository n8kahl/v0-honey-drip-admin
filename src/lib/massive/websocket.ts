type WsEndpoint = 'options' | 'indices';

// Official 2025 Massive WebSocket URLs for Options + Indices Advanced
const WS_URLS: Record<WsEndpoint, string> = {
  options: 'wss://socket.massive.com/options',
  indices: 'wss://socket.massive.com/indices',
};

function getToken(): string {
  const token = (import.meta as any)?.env?.VITE_MASSIVE_PROXY_TOKEN as string | undefined;
  if (!token) {
    console.warn('[v0] VITE_MASSIVE_PROXY_TOKEN not set, WebSocket auth will fail');
    return '';
  }
  return token;
}

function wsUrl(endpoint: WsEndpoint): string {
  return WS_URLS[endpoint];
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
  private sockets: Record<WsEndpoint, WebSocket | null> = {
    options: null,
    indices: null,
  };
  private reconnectAttempts: Record<WsEndpoint, number> = {
    options: 0,
    indices: 0,
  };
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers: Map<string, Set<SubscriptionCallback>> = new Map();
  private isConnecting: Record<WsEndpoint, boolean> = {
    options: false,
    indices: false,
  };
  private isAuthenticated: Record<WsEndpoint, boolean> = {
    options: false,
    indices: false,
  };
  private subscriptions: Record<WsEndpoint, Set<string>> = {
    options: new Set(),
    indices: new Set(),
  };
  private heartbeatIntervals: Record<WsEndpoint, any> = {
    options: null,
    indices: null,
  };
  private connectionError: string | null = null;
  private initialized = false;

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
    void this.connectEndpoint('options');
    void this.connectEndpoint('indices');
  }

  // Public for external wildcard subscriptions
  connectEndpoint(endpoint: WsEndpoint) {
    if (this.sockets[endpoint]?.readyState === WebSocket.OPEN || this.isConnecting[endpoint]) {
      return;
    }

    this.isConnecting[endpoint] = true;
    this.connectionError = null;
    this.isAuthenticated[endpoint] = false;

    try {
      const socket = new WebSocket(wsUrl(endpoint));
      this.sockets[endpoint] = socket;

      socket.onopen = () => {
        console.log(`[Massive WS] Connected to ${endpoint}, authenticating...`);
        this.isConnecting[endpoint] = false;
        this.reconnectAttempts[endpoint] = 0;
        
        // Auth with token field (2025 format)
        const token = getToken();
        this.send(endpoint, { action: 'auth', token });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const messages = Array.isArray(data) ? data : [data];
          messages.forEach((msg: any) => this.handleMessage(msg));
        } catch {
          this.broadcast(event.data);
        }
      };

      socket.onclose = () => {
        this.isAuthenticated[endpoint] = false;
        this.cleanup(endpoint);
        this.attemptReconnect(endpoint);
      };

      socket.onerror = (error) => {
        this.connectionError = 'Connection error';
        console.error('[Massive WS] Connection error', error);
        this.cleanup(endpoint);
        this.attemptReconnect(endpoint);
      };
    } catch (err) {
      console.error('[Massive WS] Connection failed:', err);
      this.isConnecting[endpoint] = false;
      this.attemptReconnect(endpoint);
    }
  }

  private cleanup(endpoint: WsEndpoint) {
    if (this.heartbeatIntervals[endpoint]) {
      clearInterval(this.heartbeatIntervals[endpoint]);
      this.heartbeatIntervals[endpoint] = null;
    }
    if (this.sockets[endpoint]) {
      this.sockets[endpoint]?.close();
      this.sockets[endpoint] = null;
    }
  }

  private attemptReconnect(endpoint: WsEndpoint) {
    this.reconnectAttempts[endpoint] += 1;
    if (this.reconnectAttempts[endpoint] > this.maxReconnectAttempts) {
      console.error('[Massive WS] Max reconnection attempts reached');
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

  private handleMessage(msg: any) {
    const { ev, sym } = msg;
    
    // Handle auth success - check both sockets since we don't know which sent it
    if (msg.status === 'auth_success' || (ev === 'status' && msg.message?.includes('auth'))) {
      // Find which endpoint this came from
      let endpoint: WsEndpoint | null = null;
      if (this.sockets.options?.readyState === WebSocket.OPEN && !this.isAuthenticated.options) {
        endpoint = 'options';
      } else if (this.sockets.indices?.readyState === WebSocket.OPEN && !this.isAuthenticated.indices) {
        endpoint = 'indices';
      }
      
      if (endpoint) {
        console.log(`[Massive WS] Authenticated to ${endpoint} successfully`);
        this.isAuthenticated[endpoint] = true;
        
        // Start heartbeat
        this.heartbeatIntervals[endpoint] = setInterval(
          () => this.send(endpoint!, { action: 'ping' }),
          25_000
        );
        
        // Resubscribe if needed
        if (this.subscriptions[endpoint]?.size) {
          this.resubscribe(endpoint);
        }
      }
      return;
    }
    
    // 2025: Q = option quotes, A = aggregates, T = trades, AM = minute bars
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
          last: msg.c,
          open: msg.o,
          high: msg.h,
          low: msg.l,
          volume: msg.v,
          vwap: msg.vw,
          timestamp: msg.e,
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

  private resubscribe(endpoint: WsEndpoint) {
    const socket = this.sockets[endpoint];
    if (!socket || socket.readyState !== WebSocket.OPEN || !this.isAuthenticated[endpoint]) return;
    const channels = Array.from(this.subscriptions[endpoint]);
    if (!channels.length) return;
    console.log(`[Massive WS] Resubscribing to ${endpoint}:`, channels);
    this.send(endpoint, { action: 'subscribe', channels });
  }

  private addChannels(channels: string[], endpoint: WsEndpoint) {
    let added = false;
    for (const channel of channels) {
      if (!this.subscriptions[endpoint].has(channel)) {
        this.subscriptions[endpoint].add(channel);
        added = true;
      }
    }
    if (added && this.isAuthenticated[endpoint]) {
      // Send subscribe immediately if already authenticated
      const socket = this.sockets[endpoint];
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'subscribe', channels }));
        console.log(`[Massive WS] Added and subscribed to ${endpoint} channels:`, channels);
      }
    }
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

  subscribeQuotes(symbols: string[], callback: SubscriptionCallback) {
    symbols.forEach((symbol) => {
      const key = this.createSubscriberKey('quote', symbol);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    // 2025 format: quotes channel for options
    const channels = symbols.map((symbol) => `quotes:${symbol}`);
    this.addChannels(channels, 'options');
    return () => {
      symbols.forEach((symbol) => {
        this.deregisterSubscription(this.createSubscriberKey('quote', symbol), callback);
      });
    };
  }

  subscribeOptionQuotes(optionTickers: string[], callback: SubscriptionCallback) {
    optionTickers.forEach((ticker) => {
      const key = this.createSubscriberKey('option', ticker);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    // 2025 format: options.quotes:TICKER or use wildcard like options.quotes:SPY*
    const channels = optionTickers.map((ticker) => `options.quotes:${ticker}`);
    this.addChannels(channels, 'options');
    return () => {
      optionTickers.forEach((ticker) => {
        this.deregisterSubscription(this.createSubscriberKey('option', ticker), callback);
      });
    };
  }

  subscribeOptionTrades(optionTickers: string[], callback: SubscriptionCallback) {
    optionTickers.forEach((ticker) => {
      const key = this.createSubscriberKey('trade', ticker);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    // 2025 format: options.trades:TICKER or use wildcard like options.trades:SPY*
    const channels = optionTickers.map((ticker) => `options.trades:${ticker}`);
    this.addChannels(channels, 'options');
    return () => {
      optionTickers.forEach((ticker) => {
        this.deregisterSubscription(this.createSubscriberKey('trade', ticker), callback);
      });
    };
  }

  subscribeIndices(symbols: string[], callback: SubscriptionCallback) {
    symbols.forEach((symbol) => {
      const key = this.createSubscriberKey('index', symbol);
      if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
      this.subscribers.get(key)!.add(callback);
    });
    // 2025 format: indices.bars:1m,5m:SPX,NDX,VIX (no I: prefix needed)
    const channels = symbols.map((symbol) => {
      const clean = symbol.replace(/^I:/, '');
      return `indices.bars:1m:${clean}`;
    });
    this.addChannels(channels, 'indices');
    return () => {
      symbols.forEach((symbol) => {
        this.deregisterSubscription(this.createSubscriberKey('index', symbol), callback);
      });
    };
  }

  private toAggregateMessage(symbol: string, price: number, timestamp: number, volume: number = 0) {
    return {
      type: 'aggregate' as MessageType,
      data: {
        ticker: symbol,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
        timestamp,
      },
      timestamp,
    };
  }

  subscribeAggregates(symbols: string[], callback: SubscriptionCallback, timespan: 'second' | 'minute' = 'minute') {
    // 2025: Route indices to indices socket, everything else to options
    const isIndices = symbols.some(s => s.startsWith('I:') || ['SPX','NDX','VIX','RVX','RUT','DJI'].includes(s.replace(/^I:/, '')));
    const endpoint: WsEndpoint = isIndices ? 'indices' : 'options';
    const tf = timespan === 'minute' ? '1m' : '1s';
    
    // Clean symbols (remove I: prefix if present)
    const cleanSymbols = symbols.map(s => s.replace(/^I:/, ''));
    
    // 2025 format: indices.bars:1m:SPX,NDX or options.bars:1m:SPY*,QQQ*
    const channel = isIndices 
      ? `indices.bars:${tf}:${cleanSymbols.join(',')}`
      : `options.bars:${tf}:${cleanSymbols.join(',')}`;
    
    console.log(`[MassiveWS] Subscribing to ${endpoint} aggregates:`, channel);
    
    // Ensure connection
    void this.connectEndpoint(endpoint);

    // Wait for connection and subscribe
    const subscribeWhenReady = () => {
      const socket = this.sockets[endpoint];
      if (!socket || socket.readyState !== WebSocket.OPEN || !this.isAuthenticated[endpoint]) {
        setTimeout(subscribeWhenReady, 100);
        return;
      }

      socket.send(JSON.stringify({ action: 'subscribe', channels: [channel] }));
      console.log(`[MassiveWS] Subscribed to ${endpoint} aggregate stream`);
      
      this.subscriptions[endpoint].add(channel);
    };

    subscribeWhenReady();

    const handler = (event: MessageEvent) => {
      try {
        const messages = JSON.parse(event.data);
        if (!Array.isArray(messages)) return;

        for (const msg of messages) {
          // 2025: Aggregate messages have 'ev' field like 'AM' or 'A'
          if ((msg.ev === 'AM' || msg.ev === 'A') && cleanSymbols.some(s => msg.sym?.includes(s) || msg.sym === s)) {
            callback({
              type: 'aggregate',
              data: {
                ticker: msg.sym,
                open: msg.o,
                high: msg.h,
                low: msg.l,
                close: msg.c,
                volume: msg.v,
                vwap: msg.vw,
                timestamp: msg.s, // start timestamp
                underlying: msg.underlying, // options bars include underlying price
              },
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error('[MassiveWS] Error parsing aggregate message:', error);
      }
    };

    const socket = this.sockets[endpoint];
    if (socket) {
      socket.addEventListener('message', handler);
    }

    return () => {
      const socket = this.sockets[endpoint];
      if (socket) {
        socket.removeEventListener('message', handler);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'unsubscribe', channels: [channel] }));
          console.log(`[MassiveWS] Unsubscribed from ${endpoint} aggregate stream`);
        }
      }
      this.subscriptions[endpoint].delete(channel);
    };
  }

  subscribeOptionAggregates(optionTickers: string[], callback: SubscriptionCallback, timespan: 'second' | 'minute' = 'minute') {
    // 2025: options.bars:1m:O:SPY* format
    const tf = timespan === 'minute' ? '1m' : '1s';
    const channel = `options.bars:${tf}:${optionTickers.join(',')}`;
    
    console.log('[MassiveWS] Subscribing to option aggregates:', channel);
    
    // Ensure connection
    this.connectEndpoint('options');

    // Wait for connection and subscribe
    const subscribeWhenReady = () => {
      const socket = this.sockets.options;
      if (!socket || socket.readyState !== WebSocket.OPEN || !this.isAuthenticated.options) {
        setTimeout(subscribeWhenReady, 100);
        return;
      }

      socket.send(JSON.stringify({ action: 'subscribe', channels: [channel] }));
      console.log('[MassiveWS] Subscribed to option aggregate stream');
      
      this.subscriptions.options.add(channel);
    };

    subscribeWhenReady();

    const handler = (event: MessageEvent) => {
      try {
        const messages = JSON.parse(event.data);
        if (!Array.isArray(messages)) return;

        for (const msg of messages) {
          if ((msg.ev === 'AM' || msg.ev === 'A') && optionTickers.some(t => msg.sym?.includes(t) || msg.sym === t)) {
            callback({
              type: 'aggregate',
              data: {
                ticker: msg.sym,
                open: msg.o,
                high: msg.h,
                low: msg.l,
                close: msg.c,
                volume: msg.v,
                vwap: msg.vw,
                timestamp: msg.s,
                underlying: msg.underlying, // 2025: options bars include underlying price!
              },
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error('[MassiveWS] Error parsing option aggregate message:', error);
      }
    };

    const socket = this.sockets.options;
    if (socket) {
      socket.addEventListener('message', handler);
    }

    return () => {
      const socket = this.sockets.options;
      if (socket) {
        socket.removeEventListener('message', handler);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'unsubscribe', channels: [channel] }));
          console.log('[MassiveWS] Unsubscribed from option aggregate stream');
        }
      }
      this.subscriptions.options.delete(channel);
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
  // Build wildcard patterns: SPY* matches all SPY options
  const wildcards = roots.map(r => `${r}*`);
  
  // Subscribe to multiple feeds at once
  const channels = [
    `options.bars:1m,5m,15m,60m:${wildcards.join(',')}`,
    `options.trades:${wildcards.join(',')}`,
    `options.quotes:${wildcards.join(',')}`
  ];
  
  console.log('[MassiveWS] Subscribing to options for roots:', roots);
  
  massiveWS.connectEndpoint('options');
  
  const subscribeWhenReady = () => {
    const socket = (massiveWS as any).sockets.options;
    if (!socket || socket.readyState !== WebSocket.OPEN || !(massiveWS as any).isAuthenticated.options) {
      setTimeout(subscribeWhenReady, 100);
      return;
    }
    
    socket.send(JSON.stringify({ action: 'subscribe', channels }));
    console.log('[MassiveWS] Subscribed to options channels');
    
    channels.forEach(c => (massiveWS as any).subscriptions.options.add(c));
  };
  
  subscribeWhenReady();
  
  return () => {
    const socket = (massiveWS as any).sockets.options;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'unsubscribe', channels }));
    }
    channels.forEach(c => (massiveWS as any).subscriptions.options.delete(c));
  };
}
