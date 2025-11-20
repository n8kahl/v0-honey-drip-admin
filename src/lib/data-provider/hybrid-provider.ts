/**
 * Hybrid Data Provider
 *
 * Intelligently routes requests between Massive (primary) and Tradier (fallback).
 * Ensures data quality, handles failures gracefully, and maintains consistency.
 *
 * @module data-provider/hybrid-provider
 */

import {
  DataProviderError,
  type OptionsDataProvider,
  type IndicesDataProvider,
  type BrokerDataProvider,
  type OptionContractData,
  type OptionChainData,
  type ChainQueryOptions,
  type OptionFlowData,
  type IndexSnapshot,
  type IndicatorSet,
  type Timeframe,
  type EquityQuote,
  type Bar,
} from './types';

import { MassiveOptionsProvider, MassiveIndicesProvider, MassiveBrokerProvider } from './massive-provider';
import { TradierOptionsProvider, TradierBrokerProvider } from './tradier-provider';

// ============================================================================
// HEALTH TRACKING
// ============================================================================

interface ProviderHealth {
  healthy: boolean;
  lastSuccess: number;
  lastError?: string;
  consecutiveErrors: number;
  responseTimeMs: number;
}

// ============================================================================
// HYBRID OPTIONS PROVIDER
// ============================================================================

export class HybridOptionsProvider implements OptionsDataProvider {
  private massive: MassiveOptionsProvider;
  private tradier: TradierOptionsProvider;
  private massiveHealth: ProviderHealth = {
    healthy: true,
    lastSuccess: Date.now(),
    consecutiveErrors: 0,
    responseTimeMs: 0,
  };
  private tradierHealth: ProviderHealth = {
    healthy: true,
    lastSuccess: Date.now(),
    consecutiveErrors: 0,
    responseTimeMs: 0,
  };

  constructor(
    massiveConfig: any,
    tradierConfig: any
  ) {
    this.massive = new MassiveOptionsProvider(massiveConfig);
    this.tradier = new TradierOptionsProvider(tradierConfig);
  }

  // === EXPIRATIONS ===

  async getExpirations(
    underlying: string,
    options?: { minDate?: string; maxDate?: string }
  ): Promise<string[]> {
    // Try Massive first
    try {
      const start = Date.now();
      const result = await this.massive.getExpirations(underlying, options);
      this.recordSuccess('massive', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('massive', error);
      console.warn('[HybridProvider] Massive expirations failed, trying Tradier');
    }

    // Fallback to Tradier
    try {
      const start = Date.now();
      const result = await this.tradier.getExpirations(underlying, options);
      this.recordSuccess('tradier', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('tradier', error);
      throw new DataProviderError(
        'Both providers failed to fetch expirations',
        'ALL_PROVIDERS_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  // === OPTIONS CHAIN ===

  async getOptionChain(
    underlying: string,
    options?: ChainQueryOptions
  ): Promise<OptionChainData> {
    // Try Massive first
    try {
      const start = Date.now();
      const result = await this.massive.getOptionChain(underlying, options);
      const responseTime = Date.now() - start;

      this.recordSuccess('massive', responseTime);

      // Validate result quality
      const quality = result.quality;
      if (quality.quality === 'poor' && quality.confidence < 40) {
        console.warn(
          `[HybridProvider] Massive returned poor quality (confidence: ${quality.confidence}), trying Tradier`
        );
        throw new Error('Poor quality result');
      }

      if (result.contracts.length === 0) {
        console.warn('[HybridProvider] Massive returned empty chain, trying Tradier');
        throw new Error('Empty chain');
      }

      return result;
    } catch (error) {
      this.recordError('massive', error);
      console.warn('[HybridProvider] Massive chain failed, trying Tradier');
    }

    // Fallback to Tradier
    try {
      const start = Date.now();
      const result = await this.tradier.getOptionChain(underlying, options);
      const responseTime = Date.now() - start;

      this.recordSuccess('tradier', responseTime);

      // Mark as fallback
      result.quality = {
        ...result.quality,
        warnings: [
          ...result.quality.warnings,
          'Using Tradier fallback due to Massive unavailability',
        ],
        hasWarnings: true,
        fallbackReason: 'Massive provider failed or returned poor quality',
      };

      return result;
    } catch (error) {
      this.recordError('tradier', error);
      throw new DataProviderError(
        'Both providers failed to fetch option chain',
        'ALL_PROVIDERS_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  // === SINGLE CONTRACT ===

  async getOptionContract(
    underlying: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put'
  ): Promise<OptionContractData> {
    // Try Massive first
    try {
      const start = Date.now();
      const result = await this.massive.getOptionContract(
        underlying,
        strike,
        expiration,
        type
      );
      this.recordSuccess('massive', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('massive', error);
      console.warn('[HybridProvider] Massive contract fetch failed, trying Tradier');
    }

    // Fallback to Tradier
    try {
      const start = Date.now();
      const result = await this.tradier.getOptionContract(
        underlying,
        strike,
        expiration,
        type
      );
      this.recordSuccess('tradier', Date.now() - start);

      result.quality = {
        ...result.quality,
        warnings: [
          ...result.quality.warnings,
          'Using Tradier fallback due to Massive unavailability',
        ],
        hasWarnings: true,
        fallbackReason: 'Massive provider failed',
      };

      return result;
    } catch (error) {
      this.recordError('tradier', error);
      throw new DataProviderError(
        'Both providers failed to fetch contract',
        'ALL_PROVIDERS_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  // === FLOW DATA ===

  async getFlowData(
    underlying: string,
    timeRange?: { startTime?: number; endTime?: number }
  ): Promise<OptionFlowData> {
    // Try Massive first (has flow data)
    try {
      const start = Date.now();
      const result = await this.massive.getFlowData(underlying, timeRange);
      this.recordSuccess('massive', Date.now() - start);

      // Check if result is meaningful
      if (result.flowScore > 0) {
        return result;
      }
    } catch (error) {
      console.warn('[HybridProvider] Massive flow data failed');
    }

    // Tradier doesn't have flow data
    // Return synthetic data
    return {
      sweepCount: 0,
      blockCount: 0,
      darkPoolPercent: 0,
      flowBias: 'neutral',
      buyPressure: 50,
      unusualActivity: false,
      flowScore: 0,
      updatedAt: Date.now(),
    };
  }

  // === SUBSCRIPTIONS ===

  subscribeToOption(
    underlying: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put',
    callback: (update: OptionContractData) => void
  ): () => void {
    // Subscribe to Massive (primary)
    return this.massive.subscribeToOption(underlying, strike, expiration, type, callback);
  }

  subscribeToChain(
    underlying: string,
    callback: (update: OptionChainData) => void
  ): () => void {
    // Subscribe to Massive (primary)
    return this.massive.subscribeToChain(underlying, callback);
  }

  subscribeToFlow(
    underlying: string,
    callback: (flow: OptionFlowData) => void
  ): () => void {
    // Subscribe to Massive (primary)
    return this.massive.subscribeToFlow(underlying, callback);
  }

  // === HEALTH METHODS ===

  getHealth() {
    return {
      massive: this.massiveHealth,
      tradier: this.tradierHealth,
      primaryHealthy: this.massiveHealth.healthy,
      canFallback: this.tradierHealth.healthy,
    };
  }

  private recordSuccess(provider: 'massive' | 'tradier', responseTimeMs: number) {
    const health = provider === 'massive' ? this.massiveHealth : this.tradierHealth;
    health.healthy = true;
    health.lastSuccess = Date.now();
    health.consecutiveErrors = 0;
    health.responseTimeMs = responseTimeMs;
  }

  private recordError(provider: 'massive' | 'tradier', error: any) {
    const health = provider === 'massive' ? this.massiveHealth : this.tradierHealth;
    health.consecutiveErrors++;
    health.lastError = String(error?.message || error);

    // Mark as unhealthy after 3 consecutive errors
    if (health.consecutiveErrors >= 3) {
      health.healthy = false;
    }
  }
}

// ============================================================================
// HYBRID INDICES PROVIDER
// ============================================================================

export class HybridIndicesProvider implements IndicesDataProvider {
  private massive: MassiveIndicesProvider;
  private massiveHealth: ProviderHealth = {
    healthy: true,
    lastSuccess: Date.now(),
    consecutiveErrors: 0,
    responseTimeMs: 0,
  };

  constructor(massiveConfig: any) {
    this.massive = new MassiveIndicesProvider(massiveConfig);
  }

  async getIndexSnapshot(tickers: string[]): Promise<Map<string, IndexSnapshot>> {
    try {
      const start = Date.now();
      const result = await this.massive.getIndexSnapshot(tickers);
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (error) {
      this.recordError(error);
      throw new DataProviderError(
        'Failed to fetch index snapshots',
        'INDEX_FETCH_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  async getIndicators(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    lookback?: number
  ): Promise<IndicatorSet> {
    try {
      const start = Date.now();
      const result = await this.massive.getIndicators(ticker, timeframe, lookback);
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (error) {
      this.recordError(error);
      throw new DataProviderError(
        'Failed to fetch indicators',
        'INDICATORS_FETCH_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  async getCandles(
    ticker: string,
    timeframe: string,
    from: string,
    to: string,
    limit?: number
  ): Promise<import('./types').Candle[]> {
    try {
      const start = Date.now();
      const result = await this.massive.getCandles(ticker, timeframe, from, to, limit);
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (error) {
      this.recordError(error);
      throw new DataProviderError(
        'Failed to fetch candles',
        'CANDLES_FETCH_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  async getTimeframe(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    options?: { from?: string; to?: string; lookback?: number }
  ): Promise<Timeframe> {
    try {
      const start = Date.now();
      const result = await this.massive.getTimeframe(ticker, timeframe, options);
      this.recordSuccess(Date.now() - start);
      return result;
    } catch (error) {
      this.recordError(error);
      throw new DataProviderError(
        'Failed to fetch timeframe',
        'TIMEFRAME_FETCH_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  subscribeToIndex(
    ticker: string,
    callback: (snapshot: IndexSnapshot) => void
  ): () => void {
    return this.massive.subscribeToIndex(ticker, callback);
  }

  subscribeToTimeframe(
    ticker: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d',
    callback: (timeframe: Timeframe) => void
  ): () => void {
    return this.massive.subscribeToTimeframe(ticker, timeframe, callback);
  }

  getHealth() {
    return { massive: this.massiveHealth };
  }

  private recordSuccess(responseTimeMs: number) {
    this.massiveHealth.healthy = true;
    this.massiveHealth.lastSuccess = Date.now();
    this.massiveHealth.consecutiveErrors = 0;
    this.massiveHealth.responseTimeMs = responseTimeMs;
  }

  private recordError(error: any) {
    this.massiveHealth.consecutiveErrors++;
    this.massiveHealth.lastError = String(error?.message || error);

    if (this.massiveHealth.consecutiveErrors >= 3) {
      this.massiveHealth.healthy = false;
    }
  }
}

// ============================================================================
// HYBRID BROKER PROVIDER
// ============================================================================

export class HybridBrokerProvider implements BrokerDataProvider {
  private massive: MassiveBrokerProvider;
  private tradier: TradierBrokerProvider;
  private massiveHealth: ProviderHealth = {
    healthy: true,
    lastSuccess: Date.now(),
    consecutiveErrors: 0,
    responseTimeMs: 0,
  };
  private tradierHealth: ProviderHealth = {
    healthy: true,
    lastSuccess: Date.now(),
    consecutiveErrors: 0,
    responseTimeMs: 0,
  };

  constructor(massiveConfig: any, tradierConfig: any) {
    this.massive = new MassiveBrokerProvider(massiveConfig);
    this.tradier = new TradierBrokerProvider(tradierConfig);
  }

  async getEquityQuote(symbol: string): Promise<EquityQuote> {
    // Try Massive first
    try {
      const start = Date.now();
      const result = await this.massive.getEquityQuote(symbol);
      this.recordSuccess('massive', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('massive', error);
      console.warn('[HybridProvider] Massive quote failed, trying Tradier');
    }

    // Fallback to Tradier
    try {
      const start = Date.now();
      const result = await this.tradier.getEquityQuote(symbol);
      this.recordSuccess('tradier', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('tradier', error);
      throw new DataProviderError(
        'Both providers failed to fetch quote',
        'ALL_PROVIDERS_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  async getBars(
    symbol: string,
    interval: string,
    from: string,
    to: string,
    limit?: number
  ): Promise<Bar[]> {
    // Try Massive first
    try {
      const start = Date.now();
      const result = await this.massive.getBars(symbol, interval, from, to, limit);
      this.recordSuccess('massive', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('massive', error);
      console.warn('[HybridProvider] Massive bars failed, trying Tradier');
    }

    // Fallback to Tradier
    try {
      const start = Date.now();
      const result = await this.tradier.getBars(symbol, interval, from, to, limit);
      this.recordSuccess('tradier', Date.now() - start);
      return result;
    } catch (error) {
      this.recordError('tradier', error);
      throw new DataProviderError(
        'Both providers failed to fetch bars',
        'ALL_PROVIDERS_FAILED',
        'hybrid',
        undefined,
        error as Error
      );
    }
  }

  subscribeToEquity(
    symbol: string,
    callback: (quote: EquityQuote) => void
  ): () => void {
    // Subscribe to Massive (primary)
    return this.massive.subscribeToEquity(symbol, callback);
  }

  getHealth() {
    return {
      massive: this.massiveHealth,
      tradier: this.tradierHealth,
      primaryHealthy: this.massiveHealth.healthy,
      canFallback: this.tradierHealth.healthy,
    };
  }

  private recordSuccess(provider: 'massive' | 'tradier', responseTimeMs: number) {
    const health = provider === 'massive' ? this.massiveHealth : this.tradierHealth;
    health.healthy = true;
    health.lastSuccess = Date.now();
    health.consecutiveErrors = 0;
    health.responseTimeMs = responseTimeMs;
  }

  private recordError(provider: 'massive' | 'tradier', error: any) {
    const health = provider === 'massive' ? this.massiveHealth : this.tradierHealth;
    health.consecutiveErrors++;
    health.lastError = String(error?.message || error);

    if (health.consecutiveErrors >= 3) {
      health.healthy = false;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create all providers with shared config
 */
export function createDataProviders(config: {
  massiveApiKey: string;
  massiveBaseUrl?: string;
  tradierAccessToken: string;
  tradierBaseUrl?: string;
  enableLogging?: boolean;
}) {
  const massiveConfig = {
    apiKey: config.massiveApiKey,
    baseUrl: config.massiveBaseUrl,
    enableLogging: config.enableLogging,
  };

  const tradierConfig = {
    accessToken: config.tradierAccessToken,
    baseUrl: config.tradierBaseUrl,
    enableLogging: config.enableLogging,
  };

  return {
    options: new HybridOptionsProvider(massiveConfig, tradierConfig),
    indices: new HybridIndicesProvider(massiveConfig),
    broker: new HybridBrokerProvider(massiveConfig, tradierConfig),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  HybridOptionsProvider,
  HybridIndicesProvider,
  HybridBrokerProvider,
};
