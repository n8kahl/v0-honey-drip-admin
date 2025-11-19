/**
 * Unified Massive Subscription Manager
 * 
 * Manages dynamic subscriptions based on watchlist symbols.
 * Converts equity roots (SPY, QQQ) to options channels.
 * Converts index symbols (SPX, NDX, VIX) to indices channels.
 */

import { UnifiedMassiveWebSocket } from './unifiedWebSocket';

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
  private ws: UnifiedMassiveWebSocket;
  private config: SubscriptionManagerConfig;
  private watchedSymbols = new Set<string>();

  constructor(config: SubscriptionManagerConfig) {
    this.config = config;

    this.ws = new UnifiedMassiveWebSocket({
      token: config.token,
      onMessage: this.handleMessage.bind(this),
      onStatus: (status) => {
        console.log('[SubManager] Status:', status);
        config.onStatus?.(status);
      },
    });
  }

  connect() {
    this.ws.connect();
  }

  disconnect() {
    this.ws.disconnect();
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
      const channels = this.buildChannelsForSymbols(toAdd);
      this.ws.subscribe(channels);
      toAdd.forEach(s => this.watchedSymbols.add(s));
    }

    if (toRemove.length > 0) {
      console.log('[SubManager] Removing symbols:', toRemove);
      const channels = this.buildChannelsForSymbols(toRemove);
      this.ws.unsubscribe(channels);
      toRemove.forEach(s => this.watchedSymbols.delete(s));
    }
  }

  private buildChannelsForSymbols(symbols: string[]): string[] {
    const channels: string[] = [];

    for (const symbol of symbols) {
      if (this.isIndex(symbol)) {
        // Indices channels (use I: prefix)
        const indexTicker = symbol.startsWith('I:') ? symbol : `I:${symbol}`;
        channels.push(
          `V.${indexTicker}`,    // V = value (real-time index value)
          `AM.${indexTicker}`,   // AM = 1-minute aggregates
        );
      } else if (symbol.startsWith('O:')) {
        // Options contract channels
        channels.push(
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

    return channels;
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
    return this.ws.isConnected();
  }

  getWatchedSymbols(): string[] {
    return Array.from(this.watchedSymbols);
  }
}
