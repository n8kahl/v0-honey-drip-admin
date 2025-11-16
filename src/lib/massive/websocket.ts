const WS_BASE = (() => {
  const http = window.location.origin;
  return http.replace(/^http/, 'ws');
})();

const MASSIVE_PROXY_TOKEN = import.meta.env.VITE_MASSIVE_PROXY_TOKEN || '';
const buildProxyUrl = (path: string) => {
  if (!MASSIVE_PROXY_TOKEN) {
    console.warn('[Massive WS] VITE_MASSIVE_PROXY_TOKEN missing; WS proxy will reject connections');
    return `${WS_BASE}${path}`;
  }
  return `${WS_BASE}${path}?token=${encodeURIComponent(MASSIVE_PROXY_TOKEN)}`;
};

const MASSIVE_WS_URL_OPTIONS = buildProxyUrl('/ws/options');
const MASSIVE_WS_URL_INDICES = buildProxyUrl('/ws/indices');

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
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers: Map<string, Set<SubscriptionCallback>> = new Map();
  private isConnecting = false;
  private isAuthenticated = false;
  private subscriptions: Set<string> = new Set();
  private heartbeatInterval: any = null;
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
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.isAuthenticated = true;
    this.connectionError = null;

    try {
      const wsUrl = MASSIVE_WS_URL_OPTIONS;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.heartbeatInterval = setInterval(() => this.send({ action: 'ping' }), 25_000);
        if (this.subscriptions.size) {
          this.send({ action: 'subscribe', params: Array.from(this.subscriptions).join(',') });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const messages = Array.isArray(data) ? data : [data];
          messages.forEach((msg: any) => this.handleMessage(msg));
        } catch {
          this.broadcast(event.data);
        }
      };

      this.ws.onclose = () => {
        this.isAuthenticated = false;
        this.cleanup();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.connectionError = 'Connection error';
        console.error('[Massive WS] Connection error', error);
        this.cleanup();
        this.attemptReconnect();
      };
    } catch (err) {
      console.error('[Massive WS] Connection failed:', err);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect() {
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('[Massive WS] Max reconnection attempts reached');
      return;
    }
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1);
    setTimeout(() => this.connect(), delay);
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

  private resubscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const params = Array.from(this.subscriptions).join(',');
    if (!params) return;
    this.send({ action: 'subscribe', params });
  }

  private addChannels(channels: string[]) {
    let added = false;
    for (const channel of channels) {
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.add(channel);
        added = true;
      }
    }
    if (added) {
      this.resubscribe();
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
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
    this.addChannels(channels);
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
    this.addChannels(channels);
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
      this.subscriptions.add(symbol);
    });
    this.resubscribe();
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
    if (this.isConnecting) return 'connecting';
    if (!this.ws) return 'closed';
    if (this.ws.readyState === WebSocket.OPEN) return 'open';
    return 'connecting';
  }
}

export const massiveWS = new MassiveWebSocket();
