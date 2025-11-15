// Massive.com WebSocket Client
// Real-time streaming options and indices data
// Documentation: https://massive.com/docs/websocket/quickstart

const MASSIVE_WS_URL_OPTIONS = 'wss://socket.massive.com/options';
const MASSIVE_WS_URL_INDICES = 'wss://socket.massive.com/indices';

async function getEphemeralToken(): Promise<string> {
  try {
    const response = await fetch('/api/massive/ws-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get WS token');
    }
    
    const { token } = await response.json();
    return token;
  } catch (error) {
    console.error('[Massive WS] Failed to get ephemeral token:', error);
    throw error;
  }
}

export type MessageType = 'quote' | 'option' | 'index' | 'trade' | 'error';

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
  symbol: string; // e.g., "I:SPX", "I:NDX"
  value: number;  // Current index value
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
  ticker: string; // Full option ticker like "O:SPY251117P00500000"
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  bidExchange: number;
  askExchange: number;
  timestamp: number;
}

type SubscriptionCallback = (message: WebSocketMessage) => void;

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
  private ephemeralToken: string | null = null;

  constructor() {
    // Defer initialization until first use
    if (typeof window !== 'undefined') {
      // Initialize on next tick to ensure environment is ready
      setTimeout(() => this.initialize(), 0);
    }
  }

  private async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    
    console.log('[Massive WS] Initializing connection...');
    this.connect();
  }

  async connect() {
    if (!this.initialized) {
      this.initialize();
      return;
    }
    
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.isAuthenticated = false;
    this.connectionError = null;

    try {
      this.ephemeralToken = await getEphemeralToken();
      
      const wsUrl = MASSIVE_WS_URL_OPTIONS;
      console.log('[Massive WS] Attempting connection to', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Massive WS] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        if (!this.ephemeralToken) {
          console.error('[Massive WS] No ephemeral token available');
          this.connectionError = 'No authentication token';
          this.ws?.close();
          return;
        }

        console.log('[Massive WS] Authenticating with ephemeral token');
        this.send({ 
          action: 'auth', 
          params: this.ephemeralToken 
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Massive WS] Received message:', data);

          if (data[0]?.ev === 'status') {
            const status = data[0];
            if (status.status === 'auth_success') {
              console.log('[Massive WS] Authentication successful');
              this.isAuthenticated = true;
              this.connectionError = null;

              this.subscriptions.forEach(symbol => {
                this.resubscribe(symbol);
              });

              this.heartbeatInterval = setInterval(() => {
                this.send({ action: 'ping' });
              }, 30000);
            } else if (status.status === 'auth_failed') {
              console.error('[Massive WS] Authentication failed:', status.message);
              this.connectionError = `Authentication failed: ${status.message}`;
              this.ws?.close();
            }
          } else {
            this.handleMessage(data);
          }
        } catch (err) {
          console.error('[Massive WS] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Massive WS] Connection error:', error);
        this.connectionError = 'Connection failed';
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log('[Massive WS] Disconnected - Code:', event.code, 'Reason:', event.reason);
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.cleanup();
        
        if (event.code === 1002 || event.code === 1003 || event.code === 1008) {
          this.connectionError = 'Authentication failed';
          console.error('[Massive WS] Authentication/protocol error - not reconnecting');
        } else {
          this.attemptReconnect();
        }
      };
    } catch (err: any) {
      console.error('[Massive WS] Connection failed:', err);
      this.connectionError = err.message || 'Connection failed';
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Massive WS] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[Massive WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private resubscribe(symbol: string) {
    if (symbol.startsWith('I:')) {
      console.log('[Massive WS] Subscribing to index aggregates:', `A.${symbol}`);
      this.send({ action: 'subscribe', params: `A.${symbol}` });
    } else if (symbol.startsWith('O:')) {
      console.log('[Massive WS] Subscribing to option quotes:', `Q.${symbol}`);
      this.send({ action: 'subscribe', params: `Q.${symbol}` });
    } else {
      console.log('[Massive WS] Subscribing to options aggregates for underlying:', `A.O:${symbol}*`);
      this.send({ action: 'subscribe', params: `A.O:${symbol}*` });
    }
  }

  private handleMessage(data: any) {
    const messages = Array.isArray(data) ? data : [data];

    messages.forEach((msg: any) => {
      const { ev, sym } = msg;

      if (ev === 'Q') {
        const message: WebSocketMessage = {
          type: 'option',
          data: {
            ticker: sym,
            bid: msg.bp || 0,
            ask: msg.ap || 0,
            bidSize: msg.bs || 0,
            askSize: msg.as || 0,
            bidExchange: msg.bx,
            askExchange: msg.ax,
            timestamp: msg.t,
          } as OptionQuoteUpdate,
          timestamp: msg.t,
        };

        this.notifySubscribers('option', sym, message);
        
        const underlyingSymbol = this.extractUnderlyingSymbol(sym);
        if (underlyingSymbol) {
          this.notifySubscribers('quote', underlyingSymbol, message);
        }
      } else if (ev === 'A') {
        const isIndex = sym.startsWith('I:');
        const isOption = sym.startsWith('O:');
        
        let underlyingSymbol = sym;
        if (isOption) {
          underlyingSymbol = this.extractUnderlyingSymbol(sym) || sym;
        }
        
        const message: WebSocketMessage = {
          type: isIndex ? 'index' : 'quote',
          data: {
            symbol: isIndex ? sym : underlyingSymbol,
            last: msg.c,
            open: msg.o,
            high: msg.h,
            low: msg.l,
            volume: msg.v,
            vwap: msg.vw || 0,
            timestamp: msg.e,
          },
          timestamp: msg.e,
        };

        if (isOption) {
          this.notifySubscribers('quote', underlyingSymbol, message);
        } else if (isIndex) {
          this.notifySubscribers('index', sym, message);
        } else {
          this.notifySubscribers('quote', sym, message);
        }
      } else if (ev === 'T') {
        const message: WebSocketMessage = {
          type: 'option',
          data: {
            symbol: sym,
            last: msg.p,
            volume: msg.s,
            timestamp: msg.t,
          },
          timestamp: msg.t,
        };

        this.notifySubscribers('option', sym, message);
        
        const underlyingSymbol = this.extractUnderlyingSymbol(sym);
        if (underlyingSymbol) {
          this.notifySubscribers('quote', underlyingSymbol, message);
        }
      }
    });
  }

  private notifySubscribers(type: MessageType, symbol: string, message: WebSocketMessage) {
    const key = `${type}:${symbol}`;
    const symbolSubscribers = this.subscribers.get(key);
    if (symbolSubscribers) {
      symbolSubscribers.forEach(callback => callback(message));
    }

    const typeSubscribers = this.subscribers.get(type);
    if (typeSubscribers) {
      typeSubscribers.forEach(callback => callback(message));
    }
  }

  private extractUnderlyingSymbol(optionTicker: string): string | null {
    if (!optionTicker.startsWith('O:')) return null;
    
    const withoutPrefix = optionTicker.substring(2);
    const match = withoutPrefix.match(/^([A-Z]+)/);
    return match ? match[1] : null;
  }

  subscribeQuotes(symbols: string[], callback: SubscriptionCallback) {
    symbols.forEach(symbol => {
      const key = `quote:${symbol}`;
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key)!.add(callback);
      this.subscriptions.add(symbol);
    });

    if (this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
      symbols.forEach(symbol => {
        this.resubscribe(symbol);
      });
    }

    return () => {
      symbols.forEach(symbol => {
        const key = `quote:${symbol}`;
        const subs = this.subscribers.get(key);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            this.subscribers.delete(key);
            this.subscriptions.delete(symbol);
            if (this.ws?.readyState === WebSocket.OPEN) {
              const unsubParams = symbol.startsWith('I:') ? `A.${symbol}` : `A.O:${symbol}*`;
              this.send({ action: 'unsubscribe', params: unsubParams });
            }
          }
        }
      });
    };
  }

  subscribeIndices(symbols: string[], callback: SubscriptionCallback) {
    symbols.forEach(symbol => {
      const indexSymbol = symbol.startsWith('I:') ? symbol : `I:${symbol}`;
      const key = `index:${indexSymbol}`;
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key)!.add(callback);
      this.subscriptions.add(indexSymbol);
    });

    if (this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
      symbols.forEach(symbol => {
        const indexSymbol = symbol.startsWith('I:') ? symbol : `I:${symbol}`;
        this.resubscribe(indexSymbol);
      });
    }

    return () => {
      symbols.forEach(symbol => {
        const indexSymbol = symbol.startsWith('I:') ? symbol : `I:${symbol}`;
        const key = `index:${indexSymbol}`;
        const subs = this.subscribers.get(key);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            this.subscribers.delete(key);
            this.subscriptions.delete(indexSymbol);
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.send({ action: 'unsubscribe', params: `A.${indexSymbol}` });
            }
          }
        }
      });
    };
  }

  subscribe(type: MessageType, callback: SubscriptionCallback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);

    return () => {
      const subs = this.subscribers.get(type);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  subscribeOptionQuotes(optionTickers: string[], callback: SubscriptionCallback) {
    optionTickers.forEach(ticker => {
      const key = `option:${ticker}`;
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key)!.add(callback);
      this.subscriptions.add(ticker);
    });

    if (this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
      optionTickers.forEach(ticker => {
        console.log('[Massive WS] Subscribing to option quotes:', ticker);
        this.send({ action: 'subscribe', params: `Q.${ticker}` });
      });
    }

    return () => {
      optionTickers.forEach(ticker => {
        const key = `option:${ticker}`;
        const subs = this.subscribers.get(key);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            this.subscribers.delete(key);
            this.subscriptions.delete(ticker);
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.send({ action: 'unsubscribe', params: `Q.${ticker}` });
            }
          }
        }
      });
    };
  }

  disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getConnectionState(): 'connecting' | 'open' | 'closed' {
    if (this.isConnecting) return 'connecting';
    if (!this.ws) return 'closed';
    
    if (this.ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
      return 'open';
    } else if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      return 'connecting';
    } else {
      return 'closed';
    }
  }

  getConnectionError(): string | null {
    return this.connectionError;
  }
}

export const massiveWS = new MassiveWebSocket();
