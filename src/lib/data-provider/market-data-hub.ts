/**
 * Market Data Hub
 *
 * Unified real-time market data consolidation layer.
 * Coordinates polling (REST) + WebSocket (real-time) streams.
 * Maintains single source of truth for all market data.
 *
 * @module data-provider/market-data-hub
 */

import type {
  OptionChainData,
  IndexSnapshot,
  EquityQuote,
  OptionFlowData,
  MarketDataTick,
  MarketDataSnapshot,
  MarketDataHubConfig,
  MarketDataCallback,
  SnapshotCallback,
  DataQualityFlags,
} from './types';

import {
  HybridOptionsProvider,
  HybridIndicesProvider,
  HybridBrokerProvider,
} from './hybrid-provider';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_REFRESH_INTERVAL = 5000; // 5 seconds
const BATCH_UPDATE_DELAY = 100; // 100ms to batch WebSocket updates

// ============================================================================
// MARKET DATA HUB
// ============================================================================

export class MarketDataHub {
  // Providers
  private optionsProvider: HybridOptionsProvider;
  private indicesProvider: HybridIndicesProvider;
  private brokerProvider: HybridBrokerProvider;

  // Configuration
  private config: Required<MarketDataHubConfig>;

  // State
  private snapshot: MarketDataSnapshot = {
    timestamp: Date.now(),
    optionChains: new Map(),
    indices: new Map(),
    equities: new Map(),
    flows: new Map(),
    quality: {
      source: 'hybrid',
      isStale: false,
      hasWarnings: false,
      warnings: [],
      confidence: 100,
      updatedAt: Date.now(),
    },
  };

  // Subscriptions
  private tickSubscribers = new Map<string, MarketDataCallback>();
  private snapshotSubscribers = new Map<string, SnapshotCallback>();

  // Polling
  private pollInterval: NodeJS.Timeout | null = null;
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  private pendingUpdates: Map<string, MarketDataTick> = new Map();

  // Lifecycle
  private initialized = false;
  private running = false;

  // Metrics
  private metrics = {
    totalTicks: 0,
    totalSnapshots: 0,
    lastUpdateTime: Date.now(),
    lastPollingTime: Date.now(),
  };

  constructor(
    optionsProvider: HybridOptionsProvider,
    indicesProvider: HybridIndicesProvider,
    brokerProvider: HybridBrokerProvider,
    config: MarketDataHubConfig
  ) {
    this.optionsProvider = optionsProvider;
    this.indicesProvider = indicesProvider;
    this.brokerProvider = brokerProvider;
    this.config = {
      watchlistSymbols: config.watchlistSymbols || [],
      indexTickers: config.indexTickers || ['SPX', 'NDX', 'VIX'],
      refreshIntervalMs: config.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL,
      wsEnabled: config.wsEnabled !== false,
      qualityOptions: config.qualityOptions || {},
      enableLogging: config.enableLogging || false,
      enableMetrics: config.enableMetrics || false,
    };
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Initialize hub - start polling and WebSocket subscriptions
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.log('Initializing Market Data Hub');

    try {
      // Initial fetch of all data
      await Promise.all([
        this.fetchOptionChains(),
        this.fetchIndices(),
        this.fetchEquities(),
      ]);

      // Start polling
      if (this.config.wsEnabled) {
        this.startPolling();
      }

      // Subscribe to WebSocket streams
      this.subscribeToWebSockets();

      this.initialized = true;
      this.running = true;

      this.log('Market Data Hub initialized successfully');
    } catch (error) {
      console.error('[MarketDataHub] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Stop hub - clean up subscriptions and timers
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    this.log('Shutting down Market Data Hub');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
      this.batchUpdateTimer = null;
    }

    this.tickSubscribers.clear();
    this.snapshotSubscribers.clear();

    this.running = false;
    this.initialized = false;

    this.log('Market Data Hub shut down');
  }

  // =========================================================================
  // SUBSCRIPTION METHODS
  // =========================================================================

  /**
   * Subscribe to individual market data ticks
   */
  subscribeTick(id: string, callback: MarketDataCallback): () => void {
    this.tickSubscribers.set(id, callback);

    return () => {
      this.tickSubscribers.delete(id);
    };
  }

  /**
   * Subscribe to consolidated snapshots
   */
  subscribeSnapshot(id: string, callback: SnapshotCallback): () => void {
    this.snapshotSubscribers.set(id, callback);

    return () => {
      this.snapshotSubscribers.delete(id);
    };
  }

  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  /**
   * Get current snapshot
   */
  getSnapshot(): MarketDataSnapshot {
    return {
      ...this.snapshot,
      timestamp: Date.now(),
    };
  }

  /**
   * Get specific option chain
   */
  getOptionChain(underlying: string): OptionChainData | undefined {
    return this.snapshot.optionChains.get(underlying);
  }

  /**
   * Get specific index
   */
  getIndex(ticker: string): IndexSnapshot | undefined {
    return this.snapshot.indices.get(ticker);
  }

  /**
   * Get specific equity
   */
  getEquity(symbol: string): EquityQuote | undefined {
    return this.snapshot.equities.get(symbol);
  }

  /**
   * Get flow data for underlying
   */
  getFlow(underlying: string): OptionFlowData | undefined {
    return this.snapshot.flows.get(underlying);
  }

  // =========================================================================
  // DATA FETCHING (POLLING)
  // =========================================================================

  private async fetchOptionChains(): Promise<void> {
    const promises = this.config.watchlistSymbols.map(symbol =>
      this.optionsProvider
        .getOptionChain(symbol)
        .then(chain => {
          this.snapshot.optionChains.set(symbol, chain);
          this.publishTick({
            timestamp: Date.now(),
            source: chain.quality.source,
            type: 'option',
            optionChain: chain,
            quality: chain.quality,
          });
        })
        .catch(error => {
          console.error(`[MarketDataHub] Failed to fetch chain for ${symbol}:`, error);
        })
    );

    await Promise.allSettled(promises);
  }

  private async fetchIndices(): Promise<void> {
    try {
      const snapshots = await this.indicesProvider.getIndexSnapshot(
        this.config.indexTickers
      );

      for (const [ticker, snapshot] of snapshots.entries()) {
        this.snapshot.indices.set(ticker, snapshot);
        this.publishTick({
          timestamp: Date.now(),
          source: snapshot.quality.source,
          type: 'index',
          index: snapshot,
          quality: snapshot.quality,
        });
      }
    } catch (error) {
      console.error('[MarketDataHub] Failed to fetch indices:', error);
    }
  }

  private async fetchEquities(): Promise<void> {
    // Fetch all watchlist symbols as equities
    const promises = this.config.watchlistSymbols.map(symbol =>
      this.brokerProvider
        .getEquityQuote(symbol)
        .then(quote => {
          this.snapshot.equities.set(symbol, quote);
          this.publishTick({
            timestamp: Date.now(),
            source: 'massive',
            type: 'equity',
            equity: quote,
            quality: {
              source: 'massive',
              isStale: false,
              hasWarnings: false,
              warnings: [],
              confidence: 100,
              updatedAt: Date.now(),
            },
          });
        })
        .catch(error => {
          console.error(`[MarketDataHub] Failed to fetch equity for ${symbol}:`, error);
        })
    );

    await Promise.allSettled(promises);
  }

  // =========================================================================
  // POLLING LOOP
  // =========================================================================

  private startPolling(): void {
    this.log(`Starting polling interval: ${this.config.refreshIntervalMs}ms`);

    this.pollInterval = setInterval(async () => {
      try {
        this.metrics.lastPollingTime = Date.now();

        // Fetch all data in parallel
        await Promise.all([
          this.fetchOptionChains(),
          this.fetchIndices(),
          this.fetchEquities(),
        ]);

        // Publish consolidated snapshot
        this.publishSnapshot();
      } catch (error) {
        console.error('[MarketDataHub] Polling error:', error);
      }
    }, this.config.refreshIntervalMs);
  }

  // =========================================================================
  // WEBSOCKET SUBSCRIPTIONS
  // =========================================================================

  private subscribeToWebSockets(): void {
    // Subscribe to option chains
    for (const symbol of this.config.watchlistSymbols) {
      this.optionsProvider.subscribeToChain(symbol, (chain: OptionChainData) => {
        this.snapshot.optionChains.set(symbol, chain);
        this.batchTick({
          timestamp: Date.now(),
          source: 'massive',
          type: 'option',
          optionChain: chain,
          quality: chain.quality,
        });
      });
    }

    // Subscribe to indices
    for (const ticker of this.config.indexTickers) {
      this.indicesProvider.subscribeToIndex(ticker, (snapshot: IndexSnapshot) => {
        this.snapshot.indices.set(ticker, snapshot);
        this.batchTick({
          timestamp: Date.now(),
          source: 'massive',
          type: 'index',
          index: snapshot,
          quality: snapshot.quality,
        });
      });
    }

    // Subscribe to flow data
    for (const symbol of this.config.watchlistSymbols) {
      this.optionsProvider.subscribeToFlow(symbol, (flow: OptionFlowData) => {
        this.snapshot.flows.set(symbol, flow);
        this.batchTick({
          timestamp: Date.now(),
          source: 'massive',
          type: 'flow',
          flow,
          quality: {
            source: 'massive',
            isStale: false,
            hasWarnings: false,
            warnings: [],
            confidence: 100,
            updatedAt: Date.now(),
          },
        });
      });
    }
  }

  // =========================================================================
  // PUBLISHING
  // =========================================================================

  private publishTick(tick: MarketDataTick): void {
    this.metrics.totalTicks++;
    this.metrics.lastUpdateTime = Date.now();

    for (const callback of this.tickSubscribers.values()) {
      try {
        callback(tick);
      } catch (error) {
        console.error('[MarketDataHub] Subscriber error:', error);
      }
    }
  }

  private batchTick(tick: MarketDataTick): void {
    // Store tick for batching
    const key = this.getTickKey(tick);
    this.pendingUpdates.set(key, tick);

    // Schedule batch publish
    if (!this.batchUpdateTimer) {
      this.batchUpdateTimer = setTimeout(() => {
        this.publishBatchedTicks();
      }, BATCH_UPDATE_DELAY);
    }
  }

  private publishBatchedTicks(): void {
    // Publish all pending ticks
    for (const tick of this.pendingUpdates.values()) {
      this.publishTick(tick);
    }

    this.pendingUpdates.clear();
    this.batchUpdateTimer = null;

    // Publish consolidated snapshot
    this.publishSnapshot();
  }

  private publishSnapshot(): void {
    this.metrics.totalSnapshots++;

    // Update snapshot timestamp and quality
    this.snapshot.timestamp = Date.now();
    this.snapshot.quality = this.calculateOverallQuality();

    for (const callback of this.snapshotSubscribers.values()) {
      try {
        callback(this.snapshot);
      } catch (error) {
        console.error('[MarketDataHub] Snapshot subscriber error:', error);
      }
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private getTickKey(tick: MarketDataTick): string {
    switch (tick.type) {
      case 'option':
        return `option:${tick.optionChain?.underlying}`;
      case 'index':
        return `index:${tick.index?.symbol}`;
      case 'equity':
        return `equity:${tick.equity?.symbol}`;
      case 'flow':
        return `flow:${tick.flow?.updatedAt}`;
      default:
        return `tick:${Date.now()}`;
    }
  }

  private calculateOverallQuality(): DataQualityFlags {
    // Calculate based on all data sources
    const allQuality = [
      ...this.snapshot.optionChains.values(),
      ...this.snapshot.indices.values(),
    ].map(d => d.quality);

    const avgConfidence =
      allQuality.length > 0
        ? allQuality.reduce((sum, q) => sum + q.confidence, 0) / allQuality.length
        : 100;

    const hasWarnings = allQuality.some(q => q.hasWarnings);
    const allWarnings = allQuality.flatMap(q => q.warnings);

    return {
      source: 'hybrid',
      isStale: avgConfidence < 50,
      hasWarnings,
      warnings: [...new Set(allWarnings)], // Deduplicate
      confidence: Math.round(avgConfidence),
      updatedAt: Date.now(),
    };
  }

  private log(message: string, data?: any): void {
    if (!this.config.enableLogging) return;
    console.log(`[MarketDataHub] ${message}`, data ? data : '');
  }

  // =========================================================================
  // METRICS
  // =========================================================================

  getMetrics() {
    return {
      ...this.metrics,
      subscriberCounts: {
        ticks: this.tickSubscribers.size,
        snapshots: this.snapshotSubscribers.size,
      },
      dataCounts: {
        optionChains: this.snapshot.optionChains.size,
        indices: this.snapshot.indices.size,
        equities: this.snapshot.equities.size,
        flows: this.snapshot.flows.size,
      },
      providerHealth: {
        options: (this.optionsProvider as any).getHealth?.(),
        indices: (this.indicesProvider as any).getHealth?.(),
        broker: (this.brokerProvider as any).getHealth?.(),
      },
    };
  }

  /**
   * Update watchlist symbols
   */
  updateWatchlist(symbols: string[]): void {
    // Remove old subscriptions
    const oldSet = new Set(this.config.watchlistSymbols);
    const newSet = new Set(symbols);

    // Added symbols
    for (const symbol of newSet) {
      if (!oldSet.has(symbol)) {
        this.optionsProvider.subscribeToChain(symbol, (chain: OptionChainData) => {
          this.snapshot.optionChains.set(symbol, chain);
          this.publishTick({
            timestamp: Date.now(),
            source: 'massive',
            type: 'option',
            optionChain: chain,
            quality: chain.quality,
          });
        });
      }
    }

    // Fetch new data
    const newSymbols = symbols.filter(s => !oldSet.has(s));
    if (newSymbols.length > 0) {
      Promise.all(
        newSymbols.map(s =>
          this.optionsProvider.getOptionChain(s).then(chain => {
            this.snapshot.optionChains.set(s, chain);
          })
        )
      ).catch(error => {
        console.error('[MarketDataHub] Failed to fetch new watchlist symbols:', error);
      });
    }

    this.config.watchlistSymbols = symbols;
    this.log(`Watchlist updated: ${symbols.join(', ')}`);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create and initialize market data hub
 */
export async function createAndInitializeHub(
  config: MarketDataHubConfig & {
    massiveApiKey: string;
    massiveBaseUrl?: string;
    tradierAccessToken: string;
    tradierBaseUrl?: string;
  }
): Promise<MarketDataHub> {
  const { createDataProviders } = await import('./hybrid-provider');

  const { options, indices, broker } = createDataProviders({
    massiveApiKey: config.massiveApiKey,
    massiveBaseUrl: config.massiveBaseUrl,
    tradierAccessToken: config.tradierAccessToken,
    tradierBaseUrl: config.tradierBaseUrl,
    enableLogging: config.enableLogging,
  });

  const hub = new MarketDataHub(options, indices, broker, config);
  await hub.initialize();
  return hub;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MarketDataHub };
