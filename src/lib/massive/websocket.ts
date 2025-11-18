type WsEndpoint = 'options' | 'indices';

const WS_BASE = '/ws';

async function fetchWsToken(): Promise<string | null> {
  try {
    const resp = await fetch('/api/ws-token', { method: 'POST' });
    if (!resp.ok) return null;
    const json = await resp.json();
    return String(json?.token || '') || null;
  } catch {
    return null;
  }
}

function wsUrl(endpoint: WsEndpoint, token?: string | null) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const tokenSegment = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${proto}//${host}${WS_BASE}/${endpoint}${tokenSegment}`;
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

  private async connectEndpoint(endpoint: WsEndpoint) {
    if (this.sockets[endpoint]?.readyState === WebSocket.OPEN || this.isConnecting[endpoint]) {
      return;
    }

    this.isConnecting[endpoint] = true;
    this.connectionError = null;
    this.isAuthenticated[endpoint] = false;

    try {
      const token = await fetchWsToken();
      const socket = new WebSocket(wsUrl(endpoint, token));
      this.sockets[endpoint] = socket;

      socket.onopen = () => {
        this.isConnecting[endpoint] = false;
        this.reconnectAttempts[endpoint] = 0;
        this.isAuthenticated[endpoint] = true;
        this.heartbeatIntervals[endpoint] = setInterval(
          () => this.send(endpoint, { action: 'ping' }),
          25_000
        );
        if (this.subscriptions[endpoint].size) {
          this.send(endpoint, { action: 'subscribe', params: Array.from(this.subscriptions[endpoint]).join(',') });
        }
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
    } else if (ev === 'A') {
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
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const params = Array.from(this.subscriptions[endpoint]).join(',');
    if (!params) return;
    this.send(endpoint, { action: 'subscribe', params });
  }

  private addChannels(channels: string[], endpoint: WsEndpoint) {
    let added = false;
    for (const channel of channels) {
      if (!this.subscriptions[endpoint].has(channel)) {
        this.subscriptions[endpoint].add(channel);
        added = true;
      }
    }
    if (added) {
      this.resubscribe(endpoint);
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
    const channels = symbols.map((symbol) => `A.${symbol}`);
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
    const channels = optionTickers.map((ticker) => `Q.${ticker}`);
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
    const channels = optionTickers.map((ticker) => `T.${ticker}`);
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
    const channels = symbols.map((symbol) => {
      const base = `A.${symbol}`;
      const match = base.match(/^(V|AM|A)\.(.+)$/);
      if (!match) return base;
      const [_, ev, sym] = match;
      return sym.startsWith('I:') ? base : `${ev}.I:${sym}`;
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
    // Paid tier: Subscribe to REAL aggregate streams
    // AM.* = 1-minute aggregates, A.* = second-level aggregates
    const prefix = timespan === 'minute' ? 'AM' : 'A';
    const topics = symbols.map(s => `${prefix}.${s}`);
    
    // Ensure connection
    void this.connectEndpoint('options');

    // Wait for connection and subscribe
    const subscribeWhenReady = () => {
      const socket = this.sockets.options;
      if (!socket || socket.readyState !== WebSocket.OPEN || !this.isAuthenticated.options) {
        setTimeout(subscribeWhenReady, 100);
        return;
      }

      const params = topics.join(',');
      socket.send(JSON.stringify({ action: 'subscribe', params }));
      console.log(`[MassiveWS] Subscribed to aggregate stream: ${params}`);
      
      topics.forEach(t => this.subscriptions.options.add(t));
    };

    subscribeWhenReady();

    const handler = (event: MessageEvent) => {
      try {
        const messages = JSON.parse(event.data);
        if (!Array.isArray(messages)) return;

        for (const msg of messages) {
          // Aggregate messages have 'ev' field like 'AM' or 'A'
          if (msg.ev === prefix && symbols.includes(msg.sym)) {
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
              },
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error('[MassiveWS] Error parsing aggregate message:', error);
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
          const params = topics.join(',');
          socket.send(JSON.stringify({ action: 'unsubscribe', params }));
          console.log(`[MassiveWS] Unsubscribed from aggregate stream: ${params}`);
        }
      }
      topics.forEach(t => this.subscriptions.options.delete(t));
    };
  }

  subscribeOptionAggregates(optionTickers: string[], callback: SubscriptionCallback, timespan: 'second' | 'minute' = 'minute') {
    // Paid tier: Subscribe to REAL option aggregate streams
    const prefix = timespan === 'minute' ? 'AM' : 'A';
    const topics = optionTickers.map(t => `${prefix}.${t}`);
    
    // Ensure connection
    this.connectEndpoint('options');

    // Wait for connection and subscribe
    const subscribeWhenReady = () => {
      const socket = this.sockets.options;
      if (!socket || socket.readyState !== WebSocket.OPEN || !this.isAuthenticated.options) {
        setTimeout(subscribeWhenReady, 100);
        return;
      }

      const params = topics.join(',');
      socket.send(JSON.stringify({ action: 'subscribe', params }));
      console.log(`[MassiveWS] Subscribed to option aggregate stream: ${params}`);
      
      topics.forEach(t => this.subscriptions.options.add(t));
    };

    subscribeWhenReady();

    const handler = (event: MessageEvent) => {
      try {
        const messages = JSON.parse(event.data);
        if (!Array.isArray(messages)) return;

        for (const msg of messages) {
          if (msg.ev === prefix && optionTickers.includes(msg.sym)) {
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
          const params = topics.join(',');
          socket.send(JSON.stringify({ action: 'unsubscribe', params }));
          console.log(`[MassiveWS] Unsubscribed from option aggregate stream: ${params}`);
        }
      }
      topics.forEach(t => this.subscriptions.options.delete(t));
    };
  }

  getConnectionState(): 'connecting' | 'open' | 'closed' {
    if (this.isConnecting.options) return 'connecting';
    const socket = this.sockets.options;
    if (!socket) return 'closed';
    if (socket.readyState === WebSocket.OPEN) return 'open';
    return 'connecting';
  }
}

export const massiveWS = new MassiveWebSocket();
