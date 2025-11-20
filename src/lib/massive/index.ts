/**
 * Massive API Unified Interface
 *
 * Single entry point for all Massive data operations.
 * Exports singleton instance and all types.
 */

// Export unified provider (singleton)
export { massive, MassiveDataProvider } from './provider';

// Export component classes (for advanced usage)
export { MassiveTokenManager } from './token-manager';
export { MassiveCache } from './cache';
export { MassiveREST } from './rest';
export { MassiveWebSocket } from './websocket';

// Export types
export type {
  MassiveQuote,
  MassiveOption,
  MassiveOptionsChain,
  MassiveIndex,
} from './types';

export type {
  MassiveRSI,
  MassiveMarketStatus,
  EnrichedMarketStatus,
  MassiveAggregateBar,
  RESTHealth,
} from './rest';

export type {
  MessageType,
  WebSocketMessage,
  QuoteUpdate,
  IndexUpdate,
  OptionUpdate,
  OptionQuoteUpdate,
  TradeUpdate,
  WebSocketHealth,
} from './websocket';

export type { HealthStatus } from './provider';

// Re-export legacy exports for backward compatibility during migration
import { massive } from './provider';

/**
 * Legacy compatibility: massive
 * @deprecated Use `massive` instead
 */
export const massive = {
  getMarketStatus: () => massive.getMarketStatus(),
  getMarketHolidays: (year?: number) => massive.getMarketHolidays(year),
  getRSI: (ticker: string, params?: any) => massive.getRSI(ticker, params),
  getQuote: (symbol: string) => massive.getQuote(symbol),
  getQuotes: (symbols: string[]) => massive.getQuotes(symbols),
  getOptionsChain: (underlying: string, expiration?: string, price?: number) =>
    massive.getOptionsChain(underlying, expiration, price),
  getOptionsSnapshot: (underlying: string) => massive.getOptionsSnapshot(underlying),
  getOptionContract: (ticker: string) => massive.getOptionContract(ticker),
  getIndex: (ticker: string) => massive.getIndex(ticker),
  getIndices: (tickers: string[]) => massive.getIndices(tickers),
  getHistoricalData: (symbol: string, mult?: number, span?: string, from?: string, to?: string) =>
    massive.getHistoricalData(symbol, mult, span, from, to),
  getAggregates: (symbol: string, timeframe: '1' | '5' | '15' | '60' | '1D', lookback?: number) =>
    massive.getAggregates(symbol, timeframe, lookback),
  getOptionTrades: (ticker: string, params?: any) => massive.getOptionTrades(ticker, params),
  isConnected: () => massive.isConnected(),
  getLastError: () => null,
  cancel: () => {},
};

/**
 * Legacy compatibility: massive
 * @deprecated Use `massive` instead
 */
export const massive = {
  connect: () => massive.connect(),
  connectEndpoint: (endpoint: 'options' | 'indices') => Promise.resolve(),
  updateWatchlist: (roots: string[]) => massive.updateWatchlist(roots),
  subscribeQuotes: (symbols: string[], callback: any) => massive.subscribeQuotes(symbols, callback),
  subscribeAggregates: (symbols: string[], callback: any, timespan?: any) =>
    massive.subscribeAggregates(symbols, callback, timespan),
  subscribeOptionAggregates: (tickers: string[], callback: any, timespan?: any) =>
    massive.subscribeOptionAggregates(tickers, callback, timespan),
  getConnectionState: (endpoint?: 'options' | 'indices') =>
    massive.getConnectionState(endpoint || 'options'),
  isConnected: (endpoint?: 'options' | 'indices') => massive.isConnected(endpoint || 'options'),
};

/**
 * Legacy compatibility: getOptionContracts
 * @deprecated Use `massive.getOptionContracts()` instead
 */
export async function getOptionContracts(
  underlying: string,
  limit?: number,
  expiration?: string,
  minStrike?: number,
  maxStrike?: number
) {
  return massive.getOptionContracts(underlying, limit, expiration, minStrike, maxStrike);
}

/**
 * Legacy compatibility: hasApiKey
 * @deprecated Use `massive.getHealth()` instead
 */
export async function hasApiKey(): Promise<boolean> {
  try {
    const resp = await fetch('/api/health');
    return resp.ok;
  } catch {
    return false;
  }
}
