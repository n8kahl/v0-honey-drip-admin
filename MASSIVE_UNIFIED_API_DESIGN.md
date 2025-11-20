# Unified Massive Client API Design

## Executive Summary

This design consolidates 7+ Massive client instances into a **single, unified API** that provides:
- ✅ One REST client (via server proxy)
- ✅ One WebSocket manager (with dual endpoints)
- ✅ One authentication strategy (ephemeral tokens)
- ✅ One caching layer (centralized)
- ✅ One data provider interface (for all consumers)

---

## Design Goals

1. **Eliminate Duplication**: Single implementation for each concern
2. **Simplify Authentication**: One token strategy for all operations
3. **Improve Maintainability**: Clear separation of concerns
4. **Enhance Testability**: Dependency injection via provider pattern
5. **Preserve Functionality**: All existing features maintained
6. **Zero Breaking Changes**: Backwards compatibility via adapter layer

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components/Hooks                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────────┐
│              MassiveDataProvider (Unified API)               │
│  - getQuote(symbol)                                          │
│  - getOptionsChain(underlying)                               │
│  - subscribeQuotes(symbols, callback)                        │
│  - subscribeAggregates(symbols, callback)                    │
└──────────────┬──────────────────────────────────────────────┘
               │
      ┌────────┴─────────┐
      │                  │
      v                  v
┌────────────────┐  ┌──────────────────┐
│ MassiveREST    │  │ MassiveWebSocket │
│ (Singleton)    │  │ (Singleton)      │
└────────────────┘  └──────────────────┘
      │                  │
      │                  │
      └─────────┬────────┘
                │
                v
┌─────────────────────────────────────────────────────────────┐
│               MassiveTransport (Adaptive)                    │
│  - Auto-selects WebSocket (streaming) or REST (fallback)    │
│  - Handles reconnection & failover                           │
└─────────────────────────────────────────────────────────────┘
                │
                v
┌─────────────────────────────────────────────────────────────┐
│                MassiveTokenManager (Auth)                    │
│  - Manages ephemeral tokens                                  │
│  - Auto-refresh before expiry                                │
└─────────────────────────────────────────────────────────────┘
                │
                v
┌─────────────────────────────────────────────────────────────┐
│                  MassiveCache (Caching)                      │
│  - Unified TTL strategy                                      │
│  - Key normalization                                         │
└─────────────────────────────────────────────────────────────┘
                │
                v
┌─────────────────────────────────────────────────────────────┐
│                  Server Proxy Layer                          │
│  - REST: /api/massive/*                                      │
│  - WebSocket: wss://server/ws/options, wss://server/ws/indices│
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. MassiveDataProvider (Primary Interface)

**Purpose**: Single entry point for all Massive data operations

**File**: `/src/lib/massive/provider.ts`

```typescript
export class MassiveDataProvider {
  private rest: MassiveREST;
  private ws: MassiveWebSocket;
  private transport: MassiveTransport;
  private cache: MassiveCache;
  private tokenManager: MassiveTokenManager;

  constructor(config: MassiveConfig) {
    this.tokenManager = new MassiveTokenManager(config);
    this.cache = new MassiveCache();
    this.rest = new MassiveREST(this.tokenManager, this.cache);
    this.ws = new MassiveWebSocket(this.tokenManager);
    this.transport = new MassiveTransport(this.rest, this.ws);
  }

  // === REST Operations (One-off queries) ===

  async getMarketStatus(): Promise<MarketStatus> {
    return this.rest.get('/v1/marketstatus/now');
  }

  async getMarketHolidays(year: number): Promise<Holiday[]> {
    return this.cache.getOrFetch(
      `holidays:${year}`,
      () => this.rest.get(`/v1/market/holidays?year=${year}`),
      Infinity // Cache forever
    );
  }

  async getQuote(symbol: string): Promise<Quote> {
    return this.rest.get(`/v3/snapshot/${symbol}`);
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    // Batch optimization with individual fallback
    try {
      return await this.rest.post('/v3/snapshot', { tickers: symbols });
    } catch (error) {
      console.warn('Batch quotes failed, falling back to individual requests');
      return Promise.all(symbols.map(s => this.getQuote(s)));
    }
  }

  async getOptionsChain(underlying: string, params?: ChainParams): Promise<OptionsChain> {
    const cacheKey = `chain:${underlying}:${JSON.stringify(params)}`;
    return this.cache.getOrFetch(
      cacheKey,
      () => this.rest.get(`/v3/snapshot/options/${underlying}`, params),
      15 * 60 * 1000 // 15 minutes
    );
  }

  async getOptionContract(ticker: string): Promise<OptionContract> {
    const cacheKey = `contract:${ticker}`;
    return this.cache.getOrFetch(
      cacheKey,
      () => this.rest.get(`/v3/reference/options/contracts/${ticker}`),
      15 * 60 * 1000
    );
  }

  async getIndex(ticker: string): Promise<Index> {
    return this.rest.get(`/v3/snapshot/indices/${ticker}`);
  }

  async getIndices(tickers: string[]): Promise<Index[]> {
    return this.rest.get('/v3/snapshot/indices', { tickers: tickers.join(',') });
  }

  async getAggregates(
    symbol: string,
    timeframe: Timeframe,
    from: string,
    to: string
  ): Promise<Aggregate[]> {
    const cacheKey = `aggs:${symbol}:${timeframe}:${from}:${to}`;
    return this.cache.getOrFetch(
      cacheKey,
      () => this.rest.get(`/v2/aggs/ticker/${symbol}/range/${timeframe}/${from}/${to}`),
      60 * 1000 // 60 seconds
    );
  }

  async getRSI(ticker: string, params?: RSIParams): Promise<RSIData> {
    return this.rest.get(`/v1/indicators/rsi/${ticker}`, params);
  }

  async getOptionTrades(ticker: string, params?: TradeParams): Promise<Trade[]> {
    return this.rest.get(`/v3/trades/${ticker}`, params);
  }

  // === Streaming Operations (Real-time subscriptions) ===

  subscribeQuotes(
    symbols: string[],
    callback: (quote: Quote) => void,
    options?: SubscriptionOptions
  ): UnsubscribeFn {
    return this.transport.subscribe('quote', symbols, callback, options);
  }

  subscribeAggregates(
    symbols: string[],
    callback: (aggregate: Aggregate) => void,
    timespan: Timespan = '1m',
    options?: SubscriptionOptions
  ): UnsubscribeFn {
    return this.transport.subscribe('aggregate', symbols, callback, {
      ...options,
      timespan,
    });
  }

  subscribeTrades(
    symbols: string[],
    callback: (trade: Trade) => void,
    options?: SubscriptionOptions
  ): UnsubscribeFn {
    return this.transport.subscribe('trade', symbols, callback, options);
  }

  // === Watchlist Management ===

  updateWatchlist(roots: string[]): void {
    this.ws.updateWatchlist(roots);
  }

  // === Health & Status ===

  getHealth(): HealthStatus {
    return {
      rest: this.rest.getHealth(),
      websocket: this.ws.getHealth(),
      token: this.tokenManager.isValid(),
      cache: this.cache.getStats(),
    };
  }

  // === Lifecycle ===

  async connect(): Promise<void> {
    await this.tokenManager.ensureToken();
    await this.ws.connect();
  }

  disconnect(): void {
    this.ws.disconnect();
  }

  clearCache(pattern?: string): void {
    this.cache.clear(pattern);
  }
}
```

**Usage Example**:
```typescript
// Initialize once globally
const massive = new MassiveDataProvider({
  baseUrl: '/api/massive',
  wsUrl: 'wss://localhost:8080/ws',
});

// Connect on app start
await massive.connect();

// One-off queries
const quote = await massive.getQuote('SPY');
const chain = await massive.getOptionsChain('SPY');

// Real-time subscriptions
const unsubscribe = massive.subscribeQuotes(
  ['SPY', 'AAPL'],
  (quote) => console.log(quote)
);

// Cleanup
unsubscribe();
```

---

### 2. MassiveREST (Unified REST Client)

**Purpose**: Single REST client for all HTTP operations

**File**: `/src/lib/massive/rest.ts`

```typescript
export class MassiveREST {
  private baseUrl: string;
  private tokenManager: MassiveTokenManager;
  private cache: MassiveCache;
  private healthMetrics: HealthMetrics;

  constructor(tokenManager: MassiveTokenManager, cache: MassiveCache) {
    this.baseUrl = '/api/massive';
    this.tokenManager = tokenManager;
    this.cache = cache;
    this.healthMetrics = new HealthMetrics();
  }

  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.fetch(url, { method: 'GET' });
  }

  async post<T>(path: string, body: any): Promise<T> {
    const url = this.buildUrl(path);
    return this.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async fetch<T>(url: string, init: RequestInit): Promise<T> {
    const token = await this.tokenManager.getToken();
    const headers = {
      ...init.headers,
      'x-massive-proxy-token': token,
    };

    const startTime = Date.now();
    let lastError: Error | undefined;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { ...init, headers });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
            await this.sleep(retryAfter * 1000);
            continue;
          }

          if (response.status === 401) {
            // Token expired - refresh and retry
            await this.tokenManager.refreshToken();
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.healthMetrics.recordSuccess(Date.now() - startTime);
        return data;

      } catch (error) {
        lastError = error as Error;
        this.healthMetrics.recordError(error);

        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Request failed after 3 attempts: ${lastError?.message}`);
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(path, `${window.location.origin}${this.baseUrl}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getHealth(): RESTHealth {
    return this.healthMetrics.getSnapshot();
  }
}
```

**Key Features**:
- ✅ Automatic token injection
- ✅ Automatic retry with exponential backoff
- ✅ Rate limit handling (429)
- ✅ Token refresh on 401
- ✅ Health metrics tracking
- ✅ Server proxy routing (no direct Massive.com calls)

---

### 3. MassiveWebSocket (Unified WebSocket Client)

**Purpose**: Single WebSocket manager with dual endpoints

**File**: `/src/lib/massive/websocket.ts` (refactored)

```typescript
export class MassiveWebSocket {
  private connections: Map<Endpoint, WebSocketConnection>;
  private tokenManager: MassiveTokenManager;
  private subscriptions: Map<string, Set<Callback>>;
  private watchlist: Set<string>;

  constructor(tokenManager: MassiveTokenManager) {
    this.tokenManager = tokenManager;
    this.connections = new Map();
    this.subscriptions = new Map();
    this.watchlist = new Set();
  }

  async connect(): Promise<void> {
    // Connect to both endpoints
    await Promise.all([
      this.connectEndpoint('options'),
      this.connectEndpoint('indices'),
    ]);
  }

  private async connectEndpoint(endpoint: Endpoint): Promise<void> {
    const token = await this.tokenManager.getToken();
    const url = `wss://${window.location.host}/ws/${endpoint}?token=${token}`;

    const ws = new WebSocket(url);
    const connection = new WebSocketConnection(ws, endpoint);

    ws.onopen = () => {
      console.log(`[MassiveWS] Connected to ${endpoint}`);
      // Resubscribe if reconnection
      if (this.watchlist.size > 0) {
        this.sendWatchlistUpdate(endpoint);
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(endpoint, message);
    };

    ws.onerror = (error) => {
      console.error(`[MassiveWS] ${endpoint} error:`, error);
    };

    ws.onclose = () => {
      console.warn(`[MassiveWS] ${endpoint} disconnected, reconnecting...`);
      this.reconnect(endpoint);
    };

    this.connections.set(endpoint, connection);
  }

  private reconnect(endpoint: Endpoint): void {
    // Exponential backoff reconnection
    setTimeout(() => this.connectEndpoint(endpoint), 1000);
  }

  subscribeQuotes(symbols: string[], callback: Callback): UnsubscribeFn {
    symbols.forEach(symbol => {
      if (!this.subscriptions.has(symbol)) {
        this.subscriptions.set(symbol, new Set());
      }
      this.subscriptions.get(symbol)!.add(callback);
    });

    // Send subscription to appropriate endpoint
    const endpoint = this.getEndpointForSymbols(symbols);
    this.sendSubscription(endpoint, 'subscribe', symbols);

    // Return unsubscribe function
    return () => {
      symbols.forEach(symbol => {
        this.subscriptions.get(symbol)?.delete(callback);
        if (this.subscriptions.get(symbol)?.size === 0) {
          this.subscriptions.delete(symbol);
          this.sendSubscription(endpoint, 'unsubscribe', [symbol]);
        }
      });
    };
  }

  updateWatchlist(roots: string[]): void {
    this.watchlist = new Set(roots);
    this.sendWatchlistUpdate('options');
  }

  private sendWatchlistUpdate(endpoint: Endpoint): void {
    const connection = this.connections.get(endpoint);
    if (connection?.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify({
        action: 'updateWatchlist',
        roots: Array.from(this.watchlist),
      }));
    }
  }

  private sendSubscription(endpoint: Endpoint, action: string, symbols: string[]): void {
    const connection = this.connections.get(endpoint);
    if (connection?.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify({
        action,
        symbols,
      }));
    }
  }

  private handleMessage(endpoint: Endpoint, message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'Q': // Quote
        this.notifySubscribers(data.symbol, data);
        break;
      case 'A': // Aggregate
      case 'AM':
        this.notifySubscribers(data.symbol, data);
        break;
      case 'T': // Trade
        this.notifySubscribers(data.symbol, data);
        break;
      case 'error':
        console.error(`[MassiveWS] ${endpoint} error:`, data);
        break;
    }
  }

  private notifySubscribers(symbol: string, data: any): void {
    const callbacks = this.subscriptions.get(symbol);
    callbacks?.forEach(callback => callback(data));
  }

  private getEndpointForSymbols(symbols: string[]): Endpoint {
    // Heuristic: if any symbol looks like an option, use options endpoint
    const hasOptions = symbols.some(s => s.includes(':') || s.startsWith('O:'));
    return hasOptions ? 'options' : 'indices';
  }

  disconnect(): void {
    this.connections.forEach((conn, endpoint) => {
      conn.ws.close();
      console.log(`[MassiveWS] Disconnected from ${endpoint}`);
    });
    this.connections.clear();
  }

  getHealth(): WebSocketHealth {
    const health: WebSocketHealth = {};
    this.connections.forEach((conn, endpoint) => {
      health[endpoint] = {
        connected: conn.ws.readyState === WebSocket.OPEN,
        activeSubscriptions: this.subscriptions.size,
        lastMessageTime: conn.lastMessageTime,
      };
    });
    return health;
  }
}
```

**Key Changes**:
- ✅ Watchlist management moved from MassiveSubscriptionManager
- ✅ Direct subscription APIs (no wrapper layer)
- ✅ Automatic reconnection with backoff
- ✅ Health reporting
- ✅ Token-based auth

---

### 4. MassiveTransport (Adaptive Layer)

**Purpose**: Smart transport selection (WebSocket primary, REST fallback)

**File**: `/src/lib/massive/transport.ts`

```typescript
export class MassiveTransport {
  private rest: MassiveREST;
  private ws: MassiveWebSocket;
  private activePolicies: Map<string, TransportPolicy>;

  constructor(rest: MassiveREST, ws: MassiveWebSocket) {
    this.rest = rest;
    this.ws = ws;
    this.activePolicies = new Map();
  }

  subscribe(
    type: 'quote' | 'aggregate' | 'trade',
    symbols: string[],
    callback: Callback,
    options?: SubscriptionOptions
  ): UnsubscribeFn {
    const policy = new TransportPolicy({
      type,
      symbols,
      callback,
      rest: this.rest,
      ws: this.ws,
      options,
    });

    const key = `${type}:${symbols.join(',')}`;
    this.activePolicies.set(key, policy);

    policy.activate();

    return () => {
      policy.deactivate();
      this.activePolicies.delete(key);
    };
  }
}

class TransportPolicy {
  private type: string;
  private symbols: string[];
  private callback: Callback;
  private rest: MassiveREST;
  private ws: MassiveWebSocket;
  private options: SubscriptionOptions;
  private unsubscribeWS?: UnsubscribeFn;
  private fallbackInterval?: NodeJS.Timeout;

  constructor(config: TransportPolicyConfig) {
    Object.assign(this, config);
  }

  activate(): void {
    // Try WebSocket first
    try {
      this.unsubscribeWS = this.ws.subscribeQuotes(this.symbols, this.callback);
    } catch (error) {
      console.warn('[Transport] WebSocket failed, using REST fallback', error);
      this.startRESTFallback();
    }
  }

  deactivate(): void {
    this.unsubscribeWS?.();
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
    }
  }

  private startRESTFallback(): void {
    const pollInterval = this.options?.pollInterval || 3000;
    this.fallbackInterval = setInterval(async () => {
      try {
        for (const symbol of this.symbols) {
          const quote = await this.rest.get(`/v3/snapshot/${symbol}`);
          this.callback(quote);
        }
      } catch (error) {
        console.error('[Transport] REST fallback error:', error);
      }
    }, pollInterval);
  }
}
```

**Features**:
- ✅ Streaming-first strategy
- ✅ Automatic REST fallback on WebSocket failure
- ✅ Per-symbol policy instances
- ✅ Configurable poll intervals

---

### 5. MassiveTokenManager (Unified Auth)

**Purpose**: Single token management strategy

**File**: `/src/lib/massive/token-manager.ts`

```typescript
export class MassiveTokenManager {
  private token?: string;
  private tokenExpiry?: number;
  private refreshPromise?: Promise<string>;

  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.token && this.isTokenValid()) {
      return this.token;
    }

    // If refresh in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Otherwise, fetch new token
    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    this.refreshPromise = this.fetchToken();
    try {
      this.token = await this.refreshPromise;
      return this.token;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private async fetchToken(): Promise<string> {
    const response = await fetch('/api/ws-token', { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.statusText}`);
    }

    const { token, expiresAt } = await response.json();
    this.token = token;
    this.tokenExpiry = expiresAt;

    // Auto-refresh 1 minute before expiry
    const timeUntilRefresh = expiresAt - Date.now() - 60000;
    if (timeUntilRefresh > 0) {
      setTimeout(() => this.refreshToken(), timeUntilRefresh);
    }

    return token;
  }

  private isTokenValid(): boolean {
    if (!this.tokenExpiry) return false;
    // Valid if more than 1 minute remaining
    return this.tokenExpiry - Date.now() > 60000;
  }

  isValid(): boolean {
    return !!this.token && this.isTokenValid();
  }

  async ensureToken(): Promise<void> {
    await this.getToken();
  }
}
```

**Features**:
- ✅ Single token for REST + WebSocket
- ✅ Auto-refresh before expiry
- ✅ Prevents concurrent refresh requests
- ✅ Ephemeral token strategy

---

### 6. MassiveCache (Centralized Caching)

**Purpose**: Unified cache with TTL management

**File**: `/src/lib/massive/cache.ts`

```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MassiveCache {
  private store: Map<string, CacheEntry<any>>;

  constructor() {
    this.store = new Map();
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  getStats(): CacheStats {
    return {
      size: this.store.size,
      hitRate: 0, // TODO: track hits/misses
    };
  }
}
```

**Features**:
- ✅ TTL-based expiration
- ✅ Pattern-based clearing
- ✅ Stats tracking
- ✅ Async-friendly API

---

## Migration Strategy

### Phase 1: Create New Unified API (Non-breaking)

**Week 1**:
1. Create new files:
   - `/src/lib/massive/provider.ts`
   - `/src/lib/massive/rest.ts` (refactored from client.ts)
   - `/src/lib/massive/token-manager.ts`
   - `/src/lib/massive/cache.ts`
   - `/src/lib/massive/transport.ts` (refactored from transport-policy.ts)

2. Refactor `/src/lib/massive/websocket.ts`:
   - Move watchlist logic from subscriptionManager
   - Add token manager integration
   - Keep backward compatibility

3. Create singleton instance:
   ```typescript
   // /src/lib/massive/index.ts
   export const massive = new MassiveDataProvider({
     baseUrl: '/api/massive',
     wsUrl: `wss://${window.location.host}/ws`,
   });

   // Initialize on app start
   massive.connect();
   ```

### Phase 2: Create Compatibility Layer (Backward compatibility)

**Week 2**:

Create adapter to maintain old API:
```typescript
// /src/lib/massive/client.ts (legacy adapter)
import { massive } from './index';

export const massiveClient = {
  getQuote: (symbol: string) => massive.getQuote(symbol),
  getOptionsChain: (underlying: string) => massive.getOptionsChain(underlying),
  // ... map all old methods
};
```

This allows existing code to keep working while migration happens.

### Phase 3: Migrate Consumers Incrementally

**Week 3-4**:

Migrate files one by one:

**Before**:
```typescript
import { massiveClient } from '../lib/massive/client';
import { massiveWS } from '../lib/massive/websocket';

const quote = await massiveClient.getQuote('SPY');
const unsub = massiveWS.subscribeQuotes(['SPY'], callback);
```

**After**:
```typescript
import { massive } from '../lib/massive';

const quote = await massive.getQuote('SPY');
const unsub = massive.subscribeQuotes(['SPY'], callback);
```

**Migration Order**:
1. Migrate hooks first (`useMassiveData`, `useQuotes`)
2. Migrate stores (`marketDataStore`)
3. Migrate components
4. Remove legacy adapters

### Phase 4: Remove Old Code

**Week 5**:
1. Delete old implementations:
   - `/src/lib/massive/client.ts` (old singleton)
   - `/src/lib/massive/subscriptionManager.ts`
   - `/src/lib/massive/websocket-old.ts`
   - `/src/lib/data-provider/massive-provider.ts` (MassiveApiClient)

2. Remove deprecated patterns:
   - Direct `massiveClient` imports
   - `MassiveSubscriptionManager` usage
   - Environment variable tokens

---

## Custom Hooks Integration

### useMassive (Primary Hook)

```typescript
// /src/hooks/useMassive.ts
import { massive } from '../lib/massive';

export function useMassive() {
  return massive;
}
```

### useQuotes (Streaming Hook)

```typescript
// /src/hooks/useQuotes.ts
import { useState, useEffect } from 'react';
import { massive } from '../lib/massive';

export function useQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());

  useEffect(() => {
    const unsubscribe = massive.subscribeQuotes(symbols, (quote) => {
      setQuotes(prev => new Map(prev).set(quote.symbol, quote));
    });

    return unsubscribe;
  }, [symbols.join(',')]);

  return quotes;
}
```

### useOptionsChain (One-off Hook)

```typescript
// /src/hooks/useOptionsChain.ts
import { useState, useEffect } from 'react';
import { massive } from '../lib/massive';

export function useOptionsChain(underlying: string) {
  const [chain, setChain] = useState<OptionsChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const data = await massive.getOptionsChain(underlying);
        if (!cancelled) {
          setChain(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetch();

    return () => { cancelled = true; };
  }, [underlying]);

  return { chain, loading, error };
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// /src/lib/massive/__tests__/provider.test.ts
describe('MassiveDataProvider', () => {
  it('should fetch quotes via REST', async () => {
    const provider = new MassiveDataProvider(mockConfig);
    const quote = await provider.getQuote('SPY');
    expect(quote).toBeDefined();
  });

  it('should subscribe to quotes via WebSocket', () => {
    const provider = new MassiveDataProvider(mockConfig);
    const callback = jest.fn();
    const unsub = provider.subscribeQuotes(['SPY'], callback);

    // Simulate message
    provider.ws.handleMessage('options', { type: 'Q', data: mockQuote });

    expect(callback).toHaveBeenCalledWith(mockQuote);
    unsub();
  });

  it('should cache options chains', async () => {
    const provider = new MassiveDataProvider(mockConfig);

    const chain1 = await provider.getOptionsChain('SPY');
    const chain2 = await provider.getOptionsChain('SPY');

    // Should only fetch once (cached)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

```typescript
// /src/lib/massive/__tests__/integration.test.ts
describe('Massive Integration', () => {
  it('should handle WebSocket failover to REST', async () => {
    // Simulate WebSocket connection failure
    mockWebSocket.onerror(new Error('Connection failed'));

    // Should fall back to REST polling
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/v3/snapshot/SPY');
    });
  });

  it('should refresh token before expiry', async () => {
    jest.useFakeTimers();

    const provider = new MassiveDataProvider(mockConfig);
    await provider.connect();

    // Fast-forward to 1 minute before expiry
    jest.advanceTimersByTime(4 * 60 * 1000);

    // Should auto-refresh
    expect(mockFetch).toHaveBeenCalledWith('/api/ws-token');
  });
});
```

---

## Benefits Summary

### Before (Current State)
❌ 7+ separate Massive instances
❌ 2 independent REST clients with different behavior
❌ 4 different authentication patterns
❌ Multiple uncoordinated cache layers
❌ Confusing subscription management (WebSocket + wrapper)
❌ Data provider pattern exists but unused
❌ Direct singleton imports (hard to test)

### After (Unified API)
✅ 1 unified `MassiveDataProvider` interface
✅ 1 REST client (via server proxy)
✅ 1 WebSocket manager (dual endpoints)
✅ 1 token strategy (ephemeral tokens)
✅ 1 cache layer (centralized TTL)
✅ Clear separation of concerns
✅ Dependency injection (testable)
✅ Backward compatibility during migration

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create `MassiveTokenManager` class
- [ ] Create `MassiveCache` class
- [ ] Refactor `MassiveREST` from existing `client.ts`
- [ ] Refactor `MassiveWebSocket` (add watchlist, token support)
- [ ] Create `MassiveTransport` adapter
- [ ] Create `MassiveDataProvider` main class
- [ ] Export singleton instance in `/src/lib/massive/index.ts`

### Phase 2: Compatibility (Week 2)
- [ ] Create legacy adapters for backward compatibility
- [ ] Add unit tests for all new classes
- [ ] Add integration tests for common workflows
- [ ] Update type definitions

### Phase 3: Migration (Week 3-4)
- [ ] Migrate hooks (`useMassiveData`, `useQuotes`)
- [ ] Migrate stores (`marketDataStore`)
- [ ] Migrate components one by one
- [ ] Update documentation

### Phase 4: Cleanup (Week 5)
- [ ] Remove old `client.ts` (after all migrations)
- [ ] Remove `subscriptionManager.ts`
- [ ] Remove `massive-provider.ts` (MassiveApiClient)
- [ ] Delete deprecated files (`websocket-old.ts`, etc.)
- [ ] Remove environment variable tokens
- [ ] Consolidate test directories

---

## Success Metrics

**Code Quality**:
- Lines of code: -30% (remove duplication)
- Test coverage: >80%
- Type safety: 100% (no `any` types)

**Performance**:
- Token refresh: <100ms
- Cache hit rate: >70%
- WebSocket reconnect: <2s

**Developer Experience**:
- Single import path: `import { massive } from '../lib/massive'`
- IntelliSense support: All methods typed
- Clear API surface: <20 public methods

---

## Open Questions

1. **Server Proxy Dependency**: Should we support direct Massive.com connections for client-side apps?
   - Recommendation: No, always use server proxy for security (API key protection)

2. **Cache Persistence**: Should cache persist across sessions (localStorage)?
   - Recommendation: No for real-time data, but YES for holidays/contracts

3. **Multi-account Support**: How to handle multiple Massive accounts?
   - Recommendation: Single account per app instance, create multiple providers if needed

4. **Error Recovery**: How aggressive should retry logic be?
   - Recommendation: 3 attempts with exponential backoff, then fail (user can retry)

---

## Next Steps

1. **Review this design** with team
2. **Get approval** on API surface and migration strategy
3. **Begin Phase 1 implementation** (foundation classes)
4. **Create PR** with new code (non-breaking)
5. **Start migration** of hooks and components incrementally
