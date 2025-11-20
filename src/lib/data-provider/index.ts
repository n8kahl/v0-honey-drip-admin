/**
 * Data Provider Package - Main Exports
 *
 * Production-grade market data system with:
 * - Unified Massive + Tradier provider abstraction
 * - Real-time consolidation hub
 * - Comprehensive validation and quality tracking
 * - React hooks for component integration
 *
 * @module data-provider
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  DataSource,
  DataQualityLevel,
  DataQualityFlags,
  DataQualityOptions,
  OptionGreeks,
  OptionGreeksWithIV,
  OptionQuote,
  OptionLiquidity,
  OptionFlowData,
  OptionContractData,
  OptionChainData,
  ChainFilterOperator,
  ChainFilter,
  ChainQueryOptions,
  IndexQuote,
  IndicatorSet,
  Timeframe,
  Candle,
  EquityQuote,
  Bar,
  OptionsDataProvider,
  IndicesDataProvider,
  BrokerDataProvider,
  MarketDataTickType,
  MarketDataTick,
  MarketDataSnapshot,
  MarketDataHubConfig,
  MarketDataCallback,
  SnapshotCallback,
  CacheEntry,
  CacheStats,
  DataProviderMetrics,
  ProviderHealthStatus,
  ProviderConfig,
} from './types';

export {
  DataProviderError,
  ValidationError,
  type ValidationError as ValidationErrorType,
} from './types';

// ============================================================================
// VALIDATION EXPORTS
// ============================================================================

export {
  validateOptionContract,
  validateOptionChain,
  validateIndexSnapshot,
  createQualityFlags,
  DEFAULT_QUALITY_OPTIONS,
  type ValidationResult,
} from './validation';

// ============================================================================
// PROVIDER EXPORTS
// ============================================================================

export {
  MassiveOptionsProvider,
  MassiveIndicesProvider,
  MassiveBrokerProvider,
} from './massive-provider';

export {
  TradierOptionsProvider,
  TradierBrokerProvider,
} from './tradier-provider';

export {
  HybridOptionsProvider,
  HybridIndicesProvider,
  HybridBrokerProvider,
  createDataProviders,
} from './hybrid-provider';

// ============================================================================
// HUB EXPORTS
// ============================================================================

export {
  MarketDataHub,
  createAndInitializeHub,
} from './market-data-hub';

// ============================================================================
// SINGLETON INSTANCE (OPTIONAL)
// ============================================================================

let globalHub: InstanceType<typeof import('./market-data-hub').MarketDataHub> | null = null;

/**
 * Get or create global market data hub instance
 * Use this for app-wide singleton behavior
 */
export async function getGlobalHub(config: {
  massiveApiKey: string;
  massiveBaseUrl?: string;
  tradierAccessToken: string;
  tradierBaseUrl?: string;
  watchlistSymbols?: string[];
  indexTickers?: string[];
  enableLogging?: boolean;
  enableMetrics?: boolean;
}): Promise<InstanceType<typeof import('./market-data-hub').MarketDataHub>> {
  if (!globalHub) {
    const { createAndInitializeHub } = await import('./market-data-hub');
    globalHub = await createAndInitializeHub({
      massiveApiKey: config.massiveApiKey,
      massiveBaseUrl: config.massiveBaseUrl,
      tradierAccessToken: config.tradierAccessToken,
      tradierBaseUrl: config.tradierBaseUrl,
      watchlistSymbols: config.watchlistSymbols || [],
      indexTickers: config.indexTickers || ['SPX', 'NDX', 'VIX'],
      enableLogging: config.enableLogging,
      enableMetrics: config.enableMetrics,
    });
  }
  return globalHub;
}

/**
 * Shutdown global hub
 */
export async function shutdownGlobalHub(): Promise<void> {
  if (globalHub) {
    await globalHub.shutdown();
    globalHub = null;
  }
}

/**
 * Get current global hub (without initializing)
 */
export function useGlobalHub(): InstanceType<typeof import('./market-data-hub').MarketDataHub> | null {
  return globalHub;
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '1.0.0';
export const API_VERSION = '1.0.0';

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_REFRESH_INTERVAL_MS = 5000;
export const DEFAULT_BATCH_UPDATE_DELAY_MS = 100;
export const PROVIDER_HEALTH_CHECK_INTERVAL_MS = 30000;
export const MAX_CONSECUTIVE_ERRORS = 3;
