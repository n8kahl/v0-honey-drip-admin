type WsEndpoint = 'options' | 'indices';

const WS_BASE = '/ws';
const TOKEN = import.meta.env.VITE_MASSIVE_PROXY_TOKEN;

if (!TOKEN) {
  console.warn('[Massive WS] VITE_MASSIVE_PROXY_TOKEN missing; WS proxy will reject connections');
}

function wsUrl(endpoint: WsEndpoint) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const tokenSegment = TOKEN
    ? `?token=${encodeURIComponent(TOKEN)}`
    : '';
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
    this.connectEndpoint('options');
    this.connectEndpoint('indices');
  }

  private connectEndpoint(endpoint: WsEndpoint) {
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
      const message: WebSocketMessage = {
        type: 'quote',
        data: {
          symbol: sym,
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
      this.notifySubscribers('quote', sym, message);
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

  subscribeAggregates(symbols: string[], callback: SubscriptionCallback) {
    return this.subscribeQuotes(symbols, (message) => {
      if (message.type !== 'quote') return;
      const data = message.data as QuoteUpdate;
      callback(this.toAggregateMessage(data.symbol, data.last, data.timestamp, data.volume));
    });
  }

  subscribeOptionAggregates(optionTickers: string[], callback: SubscriptionCallback) {
    return this.subscribeOptionQuotes(optionTickers, (message) => {
      if (message.type !== 'option') return;
      const data = message.data as OptionQuoteUpdate;
      const price = data.mid ?? ((data.bid + data.ask) / 2) ?? data.bid ?? data.ask ?? 0;
      callback({
        type: 'aggregate',
        data: {
          ticker: data.ticker,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: data.volume ?? 0,
          timestamp: data.timestamp,
        },
        timestamp: data.timestamp,
      });
    });
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
