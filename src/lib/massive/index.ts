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
