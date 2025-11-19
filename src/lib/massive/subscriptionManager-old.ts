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
    this.wsIndices.disconnect();
  }

  /**
   * Update watchlist - subscribes to new symbols, unsubscribes from removed ones
   */
  updateWatchlist(symbols: string[]) {
    const newSet = new Set(symbols.map(s => s.toUpperCase()));
    
    // Find additions and removals
    const toAdd = Array.from(newSet).filter(s => !this.watchedSymbols.has(s));
    const toRemove = Array.from(this.watchedSymbols).filter(s => !newSet.has(s));

    if (toAdd.length > 0) {
      console.log('[SubManager] Adding symbols:', toAdd);
      const { optionsChannels, indicesChannels } = this.buildChannelsByType(toAdd);
      
      if (optionsChannels.length > 0) {
        this.wsOptions.subscribe(optionsChannels);
      }
      if (indicesChannels.length > 0) {
        this.wsIndices.subscribe(indicesChannels);
      }
      
      toAdd.forEach(s => this.watchedSymbols.add(s));
    }

    if (toRemove.length > 0) {
      console.log('[SubManager] Removing symbols:', toRemove);
      const { optionsChannels, indicesChannels } = this.buildChannelsByType(toRemove);
      
      if (optionsChannels.length > 0) {
        this.wsOptions.unsubscribe(optionsChannels);
      }
      if (indicesChannels.length > 0) {
        this.wsIndices.unsubscribe(indicesChannels);
      }
      
      toRemove.forEach(s => this.watchedSymbols.delete(s));
    }
  }

  private buildChannelsByType(symbols: string[]): { optionsChannels: string[], indicesChannels: string[] } {
    const optionsChannels: string[] = [];
    const indicesChannels: string[] = [];

    for (const symbol of symbols) {
      if (this.isIndex(symbol)) {
        // Indices channels (use I: prefix)
        const indexTicker = symbol.startsWith('I:') ? symbol : `I:${symbol}`;
        indicesChannels.push(
          `V.${indexTicker}`,    // V = value (real-time index value)
          `AM.${indexTicker}`,   // AM = 1-minute aggregates
        );
      } else if (symbol.startsWith('O:')) {
        // Options contract channels
        optionsChannels.push(
          `Q.${symbol}`,  // Q = quotes
          `T.${symbol}`,  // T = trades
          `A.${symbol}`,  // A = 1-second aggregates
        );
      } else {
        // Equity roots - subscribe to underlying via options channels
        // Note: For real-time root price, we'll use options quotes which include underlying_asset
        // We can't directly subscribe to "SPY" root, but options.quotes returns underlying price
        console.log(`[SubManager] Equity root ${symbol}: will fetch via REST/options snapshot`);
      }
    }

    return { optionsChannels, indicesChannels };
  }

  private isIndex(symbol: string): boolean {
    const cleaned = symbol.replace(/^I:/, '').toUpperCase();
    return INDEX_SYMBOLS.has(cleaned);
  }

  private handleMessage(event: any) {
    const ev = event.ev;
    const sym = event.sym || event.symbol;

    if (!ev || !sym) return;

    switch (ev) {
      case 'V': // Index value
        this.handleIndexValue(event);
        break;
      case 'AM': // 1-minute aggregate
        this.handleAggregate(event, '1m');
        break;
      case 'A': // 1-second aggregate
        this.handleAggregate(event, '1s');
        break;
      case 'Q': // Quote
        this.handleQuote(event);
        break;
      case 'T': // Trade
        this.handleTrade(event);
        break;
      default:
        console.log('[SubManager] Unknown event:', ev, event);
    }
  }

  private handleIndexValue(event: any) {
    // V event: { ev: 'V', sym: 'I:SPX', val: 5000.25, t: 1234567890123, ... }
    const symbol = this.stripIndexPrefix(event.sym);
    const quote = {
      symbol,
      last: event.val || event.value || 0,
      timestamp: event.t || Date.now(),
      change: event.c,
      changePercent: event.cp,
      source: 'ws-index-value',
    };

    this.config.onQuote?.(symbol, quote);
  }

  private handleAggregate(event: any, timeframe: string) {
    // AM event: { ev: 'AM', sym: 'I:SPX', o: 5000, h: 5010, l: 4999, c: 5005, v: 1000, s: ..., e: ... }
    // A event: similar structure for 1-second bars
    const symbol = event.sym.startsWith('I:') ? this.stripIndexPrefix(event.sym) : event.sym;
    
    // ADD LOGGING
    console.log(`[SubManager] 📊 ${event.ev} event:`, {
      symbol,
      timeframe,
      close: event.c,
      time: new Date(event.s || event.t).toISOString(),
    });
    
    const bar = {
      time: event.s || event.t, // start timestamp
      open: event.o,
      high: event.h,
      low: event.l,
      close: event.c,
      volume: event.v || 0,
      vwap: event.vw,
      timestamp: event.e || event.t, // end timestamp
    };

    this.config.onBar?.(symbol, timeframe, bar);
    
    // Also emit as quote (use close as last)
    this.config.onQuote?.(symbol, {
      symbol,
      last: event.c,
      timestamp: event.e || event.t || Date.now(),
      source: `ws-agg-${timeframe}`,
    });
  }

  private handleQuote(event: any) {
    // Q event: { ev: 'Q', sym: 'O:...', bp: ..., ap: ..., ... }
    const quote = {
      symbol: event.sym,
      bid: event.bp || event.bid,
      ask: event.ap || event.ask,
      bidSize: event.bs || event.bidSize,
      askSize: event.as || event.askSize,
      last: event.last || event.lp,
      timestamp: event.t || Date.now(),
      source: 'ws-quote',
    };

    this.config.onQuote?.(event.sym, quote);
  }

  private handleTrade(event: any) {
    // T event: { ev: 'T', sym: 'O:...', p: ..., s: ..., t: ... }
    const trade = {
      symbol: event.sym,
      price: event.p || event.price,
      size: event.s || event.size,
      timestamp: event.t || Date.now(),
      conditions: event.c || event.conditions,
    };

    this.config.onTrade?.(event.sym, trade);
    
    // Also emit as quote
    this.config.onQuote?.(event.sym, {
      symbol: event.sym,
      last: trade.price,
      timestamp: trade.timestamp,
      source: 'ws-trade',
    });
  }

  private stripIndexPrefix(sym: string): string {
    return sym.replace(/^I:/, '');
  }

  isConnected(): boolean {
    return this.optionsReady || this.indicesReady;
  }

  getWatchedSymbols(): string[] {
    return Array.from(this.watchedSymbols);
  }
}
