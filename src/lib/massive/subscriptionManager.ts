/**
 * Massive Subscription Manager for Options Advanced + Indices Advanced
 * 
 * Manages dynamic subscriptions using dedicated endpoints:
 * - Options: wss://socket.massive.com/options (dynamic watchlist roots)
 * - Indices: wss://socket.massive.com/indices (fixed SPX/NDX/VIX/RVX)
 */

import { massiveWS } from './websocket';

interface SubscriptionManagerConfig {
  token: string;
  onQuote?: (symbol: string, data: any) => void;
  onBar?: (symbol: string, timeframe: string, data: any) => void;
  onTrade?: (symbol: string, data: any) => void;
  onStatus?: (status: string) => void;
}

// Index symbols that use I: prefix
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'VIX', 'RVX', 'TICK', 'TRIN', 'VXN']);

export class MassiveSubscriptionManager {
  private config: SubscriptionManagerConfig;
  private watchedSymbols = new Set<string>();
  private unsubscribeCallbacks: Map<string, () => void> = new Map();

  constructor(config: SubscriptionManagerConfig) {
    this.config = config;
  }

  private updateGlobalStatus() {
    const optionsReady = massiveWS.isConnected('options');
    const indicesReady = massiveWS.isConnected('indices');
    
    if (optionsReady && indicesReady) {
      this.config.onStatus?.('authenticated');
    } else if (optionsReady || indicesReady) {
      this.config.onStatus?.('connected');
    } else {
      this.config.onStatus?.('disconnected');
    }
  }

  connect() {
    // The massiveWS connects automatically on initialization
    massiveWS.connect();
    
    // Check status periodically
    setInterval(() => this.updateGlobalStatus(), 1000);
  }

  disconnect() {
    // Clean up all subscriptions
    this.unsubscribeCallbacks.forEach(unsub => unsub());
    this.unsubscribeCallbacks.clear();
    this.watchedSymbols.clear();
  }

  updateWatchlist(symbols: string[]) {
    console.log('[SubscriptionManager] Updating watchlist:', symbols);
    
    // Clear existing subscriptions
    this.unsubscribeCallbacks.forEach(unsub => unsub());
    this.unsubscribeCallbacks.clear();
    this.watchedSymbols.clear();

    // Separate equity roots from indices
    const equityRoots: string[] = [];
    const indexSymbols: string[] = [];

    symbols.forEach(symbol => {
      if (this.isIndex(symbol)) {
        indexSymbols.push(symbol);
      } else {
        // Treat as equity root for options
        equityRoots.push(symbol);
      }
    });

    // Update options watchlist (equity roots become wildcards)
    if (equityRoots.length > 0) {
      massiveWS.updateWatchlist(equityRoots);
      
      // Subscribe to aggregates for underlying prices
      const unsubAggregates = massiveWS.subscribeAggregates(equityRoots, (message) => {
        if (message.type === 'quote' || message.type === 'aggregate') {
          this.config.onBar?.(message.data.symbol, '1m', message.data);
          this.config.onQuote?.(message.data.symbol, {
            ...message.data,
            price: message.data.last || message.data.close
          });
        }
      });
      this.unsubscribeCallbacks.set('aggregates', unsubAggregates);
    }

    // Subscribe to quotes for both equity and index symbols
    if (symbols.length > 0) {
      const unsubQuotes = massiveWS.subscribeQuotes(symbols, (message) => {
        if (message.type === 'quote' || message.type === 'index') {
          this.config.onQuote?.(message.data.symbol, {
            ...message.data,
            price: message.data.last || message.data.value
          });
        }
      });
      this.unsubscribeCallbacks.set('quotes', unsubQuotes);
    }

    // Update internal state
    symbols.forEach(s => this.watchedSymbols.add(s));
    
    console.log(`[SubscriptionManager] Subscribed to ${equityRoots.length} equity roots and ${indexSymbols.length} indices`);
  }

  private isIndex(symbol: string): boolean {
    return INDEX_SYMBOLS.has(symbol) || symbol.startsWith('I:');
  }

  getWatchedSymbols(): string[] {
    return Array.from(this.watchedSymbols);
  }

  isReady(): boolean {
    return massiveWS.isConnected('options') && massiveWS.isConnected('indices');
  }
}

// Export singleton instance
export const subscriptionManager = new MassiveSubscriptionManager({
  token: (import.meta as any)?.env?.VITE_MASSIVE_PROXY_TOKEN || '',
  onQuote: (symbol, data) => {
    // Forward to marketDataStore or other handlers
    console.log('[SubManager] Quote:', symbol, data);
  },
  onBar: (symbol, timeframe, data) => {
    console.log('[SubManager] Bar:', symbol, timeframe, data);
  },
  onStatus: (status) => {
    console.log('[SubManager] Status:', status);
  }
});