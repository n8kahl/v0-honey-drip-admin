/**
 * marketDataStore.ts - Single Source of Truth for Market Data
 *
 * Consolidates all market data streams (candles, indicators, signals, confluence)
 * into one Zustand store powered by Massive.com WebSocket (Options + Indices Advanced).
 *
 * Features:
 * - WebSocket streams for indices (AM/A) and options elsewhere
 * - Multi-timeframe candles with automatic aggregation
 * - Lazy indicator calculation (computed once per update)
 * - Strategy signal integration
 * - Confluence scoring from multiple sources
 *
 * All components should read from this store instead of calculating locally.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { produce, enableMapSet } from "immer";
import { Bar } from "../types/shared";
import { massive } from "../lib/massive";

// Enable Immer's MapSet plugin for Set/Map support
enableMapSet();
import {
  calculateEMA,
  calculateVWAP,
  rsiWilder,
  atrWilder,
  calculateBollingerBands,
} from "../lib/indicators";
import {
  rollupBars,
  parseAggregateBar,
  detectTimeframe,
  type MassiveAggregateMessage,
} from "../lib/market/candleAggregation";
import {
  computeIndicatorsFromCandles,
  calculateComprehensiveIndicators,
  calculateMTFTrends,
  determineTrend,
} from "../lib/market/indicatorCalculations";
import {
  calculateConfluence,
  calculateAdvancedConfluence,
} from "../lib/market/confluenceCalculations";

// ============================================================================
// Types
// ============================================================================

export type Timeframe = "1m" | "5m" | "15m" | "60m" | "1D";
export type MTFTrend = "bull" | "bear" | "neutral";
export type MarketStatus = "premarket" | "open" | "afterhours" | "closed";

// Enriched market session with timing data (for TraderHeader, etc.)
export interface EnrichedMarketSession {
  session: "PRE" | "OPEN" | "POST" | "CLOSED";
  isOpen: boolean;
  isWeekend: boolean;
  nextOpen: number; // Unix timestamp ms
  nextClose: number; // Unix timestamp ms
  serverTime: string; // ISO timestamp
  label: string; // Display label
  asOf: string; // ISO timestamp of last update
}

export interface Candle {
  time: number; // Epoch ms - matches Bar interface from indicators.ts
  timestamp?: number; // Alias for compatibility
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface Indicators {
  // Moving averages
  ema9?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;

  // Momentum
  rsi14?: number;
  macd?: { value: number; signal: number; histogram: number };

  // Volatility
  atr14?: number;
  bollingerBands?: { upper: number; middle: number; lower: number };

  // Volume
  vwap?: number;
  vwapUpperBand?: number;
  vwapLowerBand?: number;

  // Trend
  adx?: number;

  // Price action
  pivots?: {
    r3: number;
    r2: number;
    r1: number;
    pivot: number;
    s1: number;
    s2: number;
    s3: number;
  };
}

export interface ConfluenceScore {
  overall: number; // 0-100
  trend: number;
  momentum: number;
  volatility: number;
  volume: number;
  technical: number;
  components: {
    trendAlignment: boolean;
    aboveVWAP: boolean;
    rsiConfirm: boolean;
    volumeConfirm: boolean;
    supportResistance: boolean;
  };
  highlights?: string[]; // Key confluence factors to display
  lastUpdated: number;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
  iv: number; // Implied volatility (0.30 = 30%)
  lastUpdated: number;

  // Optional: Contract being tracked
  contractTicker?: string; // e.g., "SPX250117C05200000"
  strike?: number;
  expiry?: string;
  type?: "C" | "P";

  // Quality indicators
  isFresh: boolean; // Updated in last 30s
  source: "massive" | "cached" | "fallback";
}

export interface FlowMetrics {
  callVolume: number;
  putVolume: number;
  callPremium: number;
  putPremium: number;
  netDelta: number;
  netGamma: number;
  // Additional optional properties used by some components
  timestamp?: number;
  sweepCount?: number;
  blockCount?: number;
}

export interface StrategySignal {
  id: string;
  type: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  message: string;
  timestamp: number;
  // Additional optional properties for compatibility with strategy.ts StrategySignal
  createdAt?: string;
  symbol?: string;
  strategyId?: string;
  owner?: string;
  confidence?: number;
  payload?: Record<string, unknown> | null;
  status?: "ACTIVE" | "ACKED" | "DISMISSED";
  barTimeKey?: string | null;
}

export interface SymbolData {
  symbol: string;

  // Multi-timeframe candles
  candles: Record<Timeframe, Candle[]>;

  // Latest indicators (computed from primary timeframe)
  indicators: Indicators;

  // Multi-timeframe trend
  mtfTrend: Record<Timeframe, MTFTrend>;

  // Confluence scoring
  confluence: ConfluenceScore;

  // Greeks for tracked contract (if monitoring one)
  greeks?: Greeks;

  // Price data (convenience accessors)
  price?: number;
  lastPrice?: number;
  change?: number;
  changePercent?: number;

  // Raw bars for chart rendering
  bars?: Candle[];

  // Strategy signals
  strategySignals?: StrategySignal[];

  // Options flow metrics
  flowMetrics?: FlowMetrics;

  // Metadata
  lastUpdated: number;
  isSubscribed: boolean;
  primaryTimeframe: Timeframe; // Which timeframe to use for indicators
}

export interface WebSocketConnection {
  socket: WebSocket | null;
  status: "disconnected" | "connecting" | "connected" | "authenticated" | "error";
  reconnectAttempts: number;
  lastError?: string;
  lastMessageTime: number;
}

interface MarketDataStore {
  // ========================================================================
  // State
  // ========================================================================

  /** Map of symbol → data (SPY, QQQ, SPX, etc.) */
  symbols: Record<string, SymbolData>;

  /** WebSocket connection (single for stocks) */
  wsConnection: WebSocketConnection;

  /** Global connection state */
  isConnected: boolean;
  lastServerTimestamp: number;

  /** Market status (legacy simple enum) */
  marketStatus: MarketStatus;

  /** Enriched market session with timing data */
  enrichedSession: EnrichedMarketSession | null;

  /** Subscribed symbols */
  subscribedSymbols: Set<string>;

  /** Macro indices to always subscribe */
  macroSymbols: string[];

  /** Loading state */
  isInitializing: boolean;

  /** Last error */
  error: string | null;

  /** Heartbeat interval */
  heartbeatInterval: ReturnType<typeof setInterval> | null;

  /** Unsubscribe fns for active WS subscriptions */
  unsubscribers: Array<() => void>;

  /** Pending subscription changes (for batching) */
  pendingWatchlistUpdate: ReturnType<typeof setTimeout> | null;

  /** REST polling interval for stale data fallback (when WebSocket fails) */
  pollingInterval: ReturnType<typeof setInterval> | null;

  // ========================================================================
  // Actions
  // ========================================================================

  /** Initialize WebSocket connections and subscribe to watchlist */
  initialize: (watchlistSymbols: string[]) => void;

  /** Fetch historical bars for symbols */
  fetchHistoricalBars: (symbols: string[]) => Promise<void>;

  /** Connect to WebSocket */
  connectWebSocket: () => void;

  /** Schedule reconnection with backoff */
  scheduleReconnect: () => void;

  /** Subscribe to all symbols after authentication */
  subscribeToSymbols: () => void;

  /** Handle aggregate bar message */
  handleAggregateBar: (msg: MassiveAggregateMessage) => void;

  /** Handle real-time quote update (price changes without bar close) */
  handleQuoteUpdate: (symbol: string, price: number) => void;

  /** Subscribe to additional symbol */
  subscribe: (symbol: string) => void;

  /** Unsubscribe from symbol */
  unsubscribe: (symbol: string) => void;

  /** Flush pending watchlist updates (debounced batch update) */
  flushWatchlistUpdate: () => void;

  /** Start REST polling fallback for stale data detection */
  startPolling: () => void;

  /** Stop REST polling */
  stopPolling: () => void;

  /** Refresh stale symbols via REST (called by polling) */
  refreshStaleSymbols: () => Promise<void>;

  /** Update candles for a symbol/timeframe */
  updateCandles: (symbol: string, timeframe: Timeframe, candles: Candle[]) => void;

  /** Merge new bar into existing candles (snapshot + delta pattern) */
  mergeBar: (symbol: string, timeframe: Timeframe, bar: Candle) => void;

  /** Recompute indicators for a symbol */
  recomputeIndicators: (symbol: string) => void;

  /** Comprehensive recompute: indicators + MTF trends + confluence + strategies */
  recomputeSymbol: (symbol: string, options?: { force?: boolean }) => void;

  /** Update confluence score */
  updateConfluence: (symbol: string, confluence: Partial<ConfluenceScore>) => void;

  /** Update Greeks for a symbol */
  updateGreeks: (symbol: string, greeks: Greeks) => void;

  /** Clear Greeks for a symbol */
  clearGreeks: (symbol: string) => void;

  /** Update market status (legacy) */
  setMarketStatus: (status: MarketStatus) => void;

  /** Update enriched market session */
  updateMarketSession: (session: EnrichedMarketSession) => void;

  /** Fetch and update market session from Massive API */
  fetchMarketSession: () => Promise<void>;

  /** Cleanup connections */
  cleanup: () => void;

  // ========================================================================
  // Selectors (for React components)
  // ========================================================================

  /** Get all data for a symbol */
  getSymbolData: (symbol: string) => SymbolData | undefined;

  /** Get candles for specific timeframe */
  getCandles: (symbol: string, timeframe: Timeframe) => Candle[];

  /** Get latest indicators */
  getIndicators: (symbol: string) => Indicators;

  /** Get confluence score */
  getConfluence: (symbol: string) => ConfluenceScore | undefined;

  /** Get MTF trend analysis */
  getMTFTrend: (symbol: string) => Record<Timeframe, MTFTrend>;

  /** Get Greeks for a symbol */
  getGreeks: (symbol: string) => Greeks | undefined;

  /** Check if Greeks are stale */
  areGreeksStale: (symbol: string, maxAgeMs?: number) => boolean;

  /** Check if data is stale */
  isStale: (symbol: string, maxAgeMs?: number) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

// Pure indices mode for macro; equities removed
const MACRO_SYMBOLS = ["SPX", "NDX", "VIX"];
const DEFAULT_PRIMARY_TIMEFRAME: Timeframe = "1m";
const MAX_CANDLES_PER_TIMEFRAME = 500; // Memory limit
const STALE_THRESHOLD_MS = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 25000; // 25 seconds

// Stocks socket deprecated in pure options+indices mode

/** Create empty symbol data */
function createEmptySymbolData(symbol: string): SymbolData {
  return {
    symbol,
    candles: {
      "1m": [],
      "5m": [],
      "15m": [],
      "60m": [],
      "1D": [],
    },
    indicators: {},
    mtfTrend: {
      "1m": "neutral",
      "5m": "neutral",
      "15m": "neutral",
      "60m": "neutral",
      "1D": "neutral",
    },
    confluence: {
      overall: 0,
      trend: 0,
      momentum: 0,
      volatility: 0,
      volume: 0,
      technical: 0,
      components: {
        trendAlignment: false,
        aboveVWAP: false,
        rsiConfirm: false,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    },
    lastUpdated: Date.now(),
    isSubscribed: false,
    primaryTimeframe: DEFAULT_PRIMARY_TIMEFRAME,
  };
}

/** Get Massive API key from environment */
function getMassiveApiKey(): string {
  // In production, this would come from a secure token endpoint
  // For now, we'll use the proxy token pattern
  return import.meta.env.VITE_MASSIVE_PROXY_TOKEN || "";
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useMarketDataStore = create<MarketDataStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      symbols: {},
      wsConnection: {
        socket: null,
        status: "disconnected",
        reconnectAttempts: 0,
        lastMessageTime: 0,
      },
      isConnected: false,
      lastServerTimestamp: 0,
      marketStatus: "closed",
      enrichedSession: null,
      subscribedSymbols: new Set(),
      macroSymbols: MACRO_SYMBOLS,
      isInitializing: false,
      error: null,
      heartbeatInterval: null,
      unsubscribers: [],
      pendingWatchlistUpdate: null,
      pollingInterval: null,

      // ======================================================================
      // Actions
      // ======================================================================

      initialize: (watchlistSymbols: string[]) => {
        set({ isInitializing: true, error: null });

        const { macroSymbols } = get();
        // Deduplicate symbols without Set spread
        const allSymbolsSet = new Set<string>();
        watchlistSymbols.forEach((s) => allSymbolsSet.add(s));
        macroSymbols.forEach((s) => allSymbolsSet.add(s));
        const allSymbols = Array.from(allSymbolsSet);

        // Create empty data for all symbols
        const symbols: Record<string, SymbolData> = {};
        allSymbols.forEach((symbol) => {
          const normalized = symbol.toUpperCase();
          symbols[normalized] = createEmptySymbolData(normalized);
        });

        // Convert to Set using Array.from for compatibility
        const subscribedSet = new Set<string>();
        allSymbols.forEach((s) => subscribedSet.add(s));

        set({ symbols, subscribedSymbols: subscribedSet });

        // Initialize WebSocket connection
        get().connectWebSocket();

        // Fetch historical bars for all symbols (async, don't wait)
        get()
          .fetchHistoricalBars(allSymbols)
          .then(() => {
            // Start REST polling as fallback for WebSocket failures
            // This ensures data stays fresh even if WebSocket has 1008 errors
            get().startPolling();
          });

        set({ isInitializing: false });
      },

      /** Fetch historical bars for symbols to populate initial candles */
      fetchHistoricalBars: async (symbols: string[]) => {
        console.log("[v0] 📥 Fetching historical bars for", symbols.length, "symbols");

        // Helper: fetch with retry and exponential backoff
        const fetchWithRetry = async <T>(
          fn: () => Promise<T>,
          label: string,
          maxRetries = 3
        ): Promise<T | null> => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await fn();
            } catch (error) {
              const isLastAttempt = attempt === maxRetries;
              const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s

              if (isLastAttempt) {
                console.error(`[v0] ❌ ${label} failed after ${maxRetries} attempts:`, error);
                return null;
              }

              console.warn(
                `[v0] ⚠️ ${label} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
          return null;
        };

        let successCount = 0;
        let failCount = 0;

        for (const symbol of symbols) {
          const normalized = symbol.toUpperCase();
          let gotData = false;

          // Fetch 1m bars with retry (last 200 bars = ~3 hours of data)
          const bars1m = await fetchWithRetry(
            () => massive.getAggregates(normalized, "1", 200),
            `Fetch 1m bars for ${normalized}`
          );

          if (bars1m && bars1m.length > 0) {
            // Convert to Candle format and update store
            const candles1m: Candle[] = bars1m.map((bar) => ({
              time: bar.t,
              timestamp: bar.t,
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              vwap: bar.vw,
            }));

            // Update candles for 1m timeframe (rollup to 5m, 15m, 60m happens in mergeBar)
            get().updateCandles(normalized, "1m", candles1m);
            gotData = true;
          }

          // Fetch 15m bars with retry (100 bars = ~25 hours of data for EMA50)
          const bars15m = await fetchWithRetry(
            () => massive.getAggregates(normalized, "15", 100),
            `Fetch 15m bars for ${normalized}`
          );

          if (bars15m && bars15m.length > 0) {
            const candles15m: Candle[] = bars15m.map((bar) => ({
              time: bar.t,
              timestamp: bar.t,
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              vwap: bar.vw,
            }));
            get().updateCandles(normalized, "15m", candles15m);
            gotData = true;
          }

          // Fetch 60m/1h bars with retry (100 bars = ~4 days of data for EMA50)
          const bars60m = await fetchWithRetry(
            () => massive.getAggregates(normalized, "60", 100),
            `Fetch 60m bars for ${normalized}`
          );

          if (bars60m && bars60m.length > 0) {
            const candles60m: Candle[] = bars60m.map((bar) => ({
              time: bar.t,
              timestamp: bar.t,
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              vwap: bar.vw,
            }));
            get().updateCandles(normalized, "60m", candles60m);
            gotData = true;
          }

          // Fetch Daily bars with retry (last 200 days = ~6 months of data)
          const barsDaily = await fetchWithRetry(
            () => massive.getAggregates(normalized, "1D", 200),
            `Fetch daily bars for ${normalized}`
          );

          if (barsDaily && barsDaily.length > 0) {
            // Convert to Candle format and update store
            const candlesDaily: Candle[] = barsDaily.map((bar) => ({
              time: bar.t,
              timestamp: bar.t,
              open: bar.o,
              high: bar.h,
              low: bar.l,
              close: bar.c,
              volume: bar.v,
              vwap: bar.vw,
            }));

            // Update candles for Daily timeframe
            get().updateCandles(normalized, "1D", candlesDaily);
            gotData = true;
          }

          // Trigger recompute to calculate indicators and signals
          // Even if only partial data loaded, recompute what we have
          if (gotData) {
            get().recomputeSymbol(normalized);
            successCount++;
          } else {
            failCount++;
          }
        }

        console.log(
          `[v0] 📊 Historical bars fetch complete: ${successCount} success, ${failCount} failed`
        );

        // Set error state if significant failures
        if (failCount > 0 && failCount >= symbols.length / 2) {
          set({ error: `Failed to load data for ${failCount}/${symbols.length} symbols` });
        }
      },

      connectWebSocket: () => {
        const token = import.meta.env.VITE_MASSIVE_PROXY_TOKEN;
        if (!token) {
          console.error("[v0] marketDataStore: No VITE_MASSIVE_PROXY_TOKEN");
          set({ error: "Missing VITE_MASSIVE_PROXY_TOKEN" });
          return;
        }

        // Note: With unified massive API, subscriptions are now handled
        // via massive.subscribeQuotes() and massive.subscribeAggregates()
        // This legacy code path is deprecated but kept for backwards compatibility
        console.log("[v0] marketDataStore: connectWebSocket - using unified massive API");

        // Mark as connected since massive handles connection automatically
        set({
          wsConnection: {
            ...get().wsConnection,
            status: "authenticated",
          },
          isConnected: true,
        });

        // Subscribe to symbols
        get().subscribeToSymbols();
      },

      scheduleReconnect: () => {
        // No-op: massiveWS handles its own reconnection
        return;
      },

      /**
       * Flush pending watchlist updates to massive.com API (debounced)
       * This batches rapid subscription changes into a single WebSocket update
       */
      flushWatchlistUpdate: () => {
        const { pendingWatchlistUpdate, subscribedSymbols } = get();

        // Cancel any pending update
        if (pendingWatchlistUpdate) {
          clearTimeout(pendingWatchlistUpdate);
        }

        // Schedule debounced update (250ms)
        const timer = setTimeout(() => {
          const symbols = Array.from(subscribedSymbols);
          if (symbols.length > 0) {
            console.log(
              "[v0] marketDataStore: Flushing watchlist update:",
              symbols.length,
              "symbols"
            );
            massive.updateWatchlist(symbols);
          }
          set({ pendingWatchlistUpdate: null });
        }, 250);

        set({ pendingWatchlistUpdate: timer });
      },

      /**
       * Start REST polling fallback for stale data detection
       * Polls every 30 seconds and refreshes symbols that haven't been updated
       * This provides resilience when WebSocket connections fail (1008 errors, etc.)
       */
      startPolling: () => {
        const { pollingInterval } = get();

        // Don't start if already running
        if (pollingInterval) {
          return;
        }

        console.log("[v0] marketDataStore: Starting REST polling fallback (30s interval)");

        const interval = setInterval(() => {
          get().refreshStaleSymbols();
        }, 30000); // Poll every 30 seconds

        set({ pollingInterval: interval });
      },

      /**
       * Stop REST polling
       */
      stopPolling: () => {
        const { pollingInterval } = get();

        if (pollingInterval) {
          clearInterval(pollingInterval);
          set({ pollingInterval: null });
          console.log("[v0] marketDataStore: Stopped REST polling");
        }
      },

      /**
       * Refresh symbols that have stale data (>30 seconds since last update)
       * Called periodically by polling interval
       */
      refreshStaleSymbols: async () => {
        const { symbols, subscribedSymbols } = get();
        const now = Date.now();
        const STALE_THRESHOLD = 30000; // 30 seconds

        // Find symbols with stale data
        const staleSymbols: string[] = [];
        for (const symbol of subscribedSymbols) {
          const normalized = symbol.toUpperCase();
          const symbolData = symbols[normalized];
          if (symbolData && now - symbolData.lastUpdated > STALE_THRESHOLD) {
            staleSymbols.push(normalized);
          }
        }

        if (staleSymbols.length === 0) {
          return; // All data is fresh
        }

        console.log(
          `[v0] marketDataStore: Refreshing ${staleSymbols.length} stale symbols via REST`
        );

        // Fetch fresh bars for stale symbols (limit to 5 concurrent to avoid rate limits)
        const BATCH_SIZE = 5;
        for (let i = 0; i < staleSymbols.length; i += BATCH_SIZE) {
          const batch = staleSymbols.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (symbol) => {
              try {
                // Fetch last 5 bars (recent data only for refresh)
                const bars = await massive.getAggregates(symbol, "1", 5);

                if (bars && bars.length > 0) {
                  const latestBar = bars[bars.length - 1];

                  // Create candle and merge
                  const candle: Candle = {
                    time: latestBar.t,
                    timestamp: latestBar.t,
                    open: latestBar.o,
                    high: latestBar.h,
                    low: latestBar.l,
                    close: latestBar.c,
                    volume: latestBar.v,
                    vwap: latestBar.vw,
                  };

                  get().mergeBar(symbol, "1m", candle);
                }
              } catch (error) {
                console.warn(`[v0] Failed to refresh ${symbol}:`, error);
              }
            })
          );

          // Small delay between batches to avoid rate limits
          if (i + BATCH_SIZE < staleSymbols.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      },

      subscribeToSymbols: () => {
        const { subscribedSymbols } = get();

        if (subscribedSymbols.size === 0) {
          console.warn("[v0] marketDataStore: No symbols to subscribe to");
          return;
        }

        const symbols = Array.from(subscribedSymbols);
        // Update watchlist using unified massive API
        massive.updateWatchlist(symbols);
      },

      handleAggregateBar: (msg: MassiveAggregateMessage) => {
        // Extract symbol (remove I: prefix for indices)
        const symbol = msg.sym.replace(/^I:/, "").toUpperCase();

        // Detect timeframe from start/end timestamps
        const timeframe = detectTimeframe(msg.s, msg.e);

        // Parse bar
        const bar = parseAggregateBar(msg, timeframe);

        // Merge bar into store
        get().mergeBar(symbol, timeframe, bar);
      },

      /**
       * Handle real-time quote updates (price changes without bar close)
       * Updates lastUpdated timestamp to prevent false "stale" indicators
       */
      handleQuoteUpdate: (symbol: string, price: number) => {
        const normalized = symbol.toUpperCase();

        set(
          produce((draft) => {
            // Create symbol data if doesn't exist
            if (!draft.symbols[normalized]) {
              draft.symbols[normalized] = createEmptySymbolData(normalized);
            }

            // Update last price and timestamp
            if (draft.symbols[normalized]) {
              draft.symbols[normalized].lastPrice = price;
              draft.symbols[normalized].lastUpdated = Date.now();
            }
          })
        );
      },

      subscribe: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { symbols, subscribedSymbols } = get();

        if (subscribedSymbols.has(normalized)) {
          return;
        }

        // Use Immer's produce for efficient state updates
        set(
          produce((draft) => {
            // Create data structure if doesn't exist
            if (!draft.symbols[normalized]) {
              draft.symbols[normalized] = createEmptySymbolData(normalized);
            }

            // Mark as subscribed
            draft.symbols[normalized].isSubscribed = true;

            // Add to subscribed set (Immer supports Set mutations)
            draft.subscribedSymbols.add(normalized);
          })
        );

        // Fetch initial bars immediately for this symbol (async, don't block)
        (async () => {
          try {
            console.log(`[v0] 🔄 Fetching initial bars for ${normalized}...`);

            // Fetch last 100 1m bars (~2 hours of data)
            const bars1m = await massive.getAggregates(normalized, "1", 100);

            console.log(
              `[v0] 📊 Received ${bars1m?.length || 0} bars for ${normalized}`,
              bars1m?.slice(0, 2)
            );

            if (bars1m && bars1m.length > 0) {
              const candles1m: Candle[] = bars1m.map((bar) => ({
                time: bar.t,
                timestamp: bar.t,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                vwap: bar.vw,
              }));

              get().updateCandles(normalized, "1m", candles1m);
              console.log(`[v0] ✅ Loaded ${candles1m.length} 1m bars for ${normalized}`);
            }

            // Always fetch daily bars for ATR(14) calculation (needs 15+ days)
            console.log(`[v0] 🔄 Fetching daily bars for ${normalized} ATR...`);
            const barsDaily = await massive.getAggregates(normalized, "1D", 20);

            if (barsDaily && barsDaily.length > 0) {
              const candlesDaily: Candle[] = barsDaily.map((bar) => ({
                time: bar.t,
                timestamp: bar.t,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                vwap: bar.vw,
              }));

              get().updateCandles(normalized, "1D", candlesDaily);
              console.log(`[v0] ✅ Loaded ${candlesDaily.length} daily bars for ${normalized}`);
            }

            // Force immediate confluence calculation after data load
            get().recomputeSymbol(normalized, { force: true });
          } catch (error) {
            console.warn(`[v0] ⚠️ Failed to fetch initial bars for ${normalized}:`, error);
          }
        })();

        // Debounced watchlist update (batches rapid subscriptions)
        get().flushWatchlistUpdate();
      },

      unsubscribe: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { macroSymbols, subscribedSymbols } = get();

        // Don't unsubscribe from macro symbols
        if (macroSymbols.includes(normalized)) {
          return;
        }

        if (!subscribedSymbols.has(normalized)) {
          return;
        }

        // Use Immer's produce for efficient state updates
        set(
          produce((draft) => {
            // Remove from subscribed set (Immer supports Set mutations)
            draft.subscribedSymbols.delete(normalized);
          })
        );

        // Debounced watchlist update (batches rapid unsubscriptions)
        get().flushWatchlistUpdate();
      },

      updateCandles: (symbol: string, timeframe: Timeframe, candles: Candle[]) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];

        if (!symbolData) {
          console.warn("[v0] marketDataStore: Symbol not found:", normalized);
          return;
        }

        // Trim to max candles
        const trimmedCandles = candles.slice(-MAX_CANDLES_PER_TIMEFRAME);

        // Auto-rollup higher timeframes when 1m candles are loaded
        let candles5m = symbolData.candles["5m"];
        let candles15m = symbolData.candles["15m"];
        let candles60m = symbolData.candles["60m"];

        if (timeframe === "1m" && trimmedCandles.length > 0) {
          candles5m = rollupBars(trimmedCandles, "5m");
          candles15m = rollupBars(trimmedCandles, "15m");
          candles60m = rollupBars(trimmedCandles, "60m");
          console.log(
            `[v0] Rolled up ${trimmedCandles.length} 1m bars → 5m:${candles5m.length}, 15m:${candles15m.length}, 60m:${candles60m.length}`
          );
        }

        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              candles: {
                ...symbolData.candles,
                [timeframe]: trimmedCandles,
                // Include rolled-up candles when we roll up from 1m
                ...(timeframe === "1m" && {
                  "5m": candles5m,
                  "15m": candles15m,
                  "60m": candles60m,
                }),
              },
              lastUpdated: Date.now(),
            },
          },
        });

        // Recompute indicators if this is the primary timeframe OR if we just rolled up
        if (timeframe === symbolData.primaryTimeframe || timeframe === "1m") {
          get().recomputeIndicators(normalized);
        }
      },

      mergeBar: (symbol: string, timeframe: Timeframe, bar: Candle) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];

        if (!symbolData) {
          console.warn("[v0] marketDataStore: Symbol not found:", normalized);
          return;
        }

        const existingCandles = symbolData.candles[timeframe] || [];
        let updatedCandles = [...existingCandles];

        // Check if this bar updates the last candle (same time/timestamp) or adds new
        const lastCandle = existingCandles[existingCandles.length - 1];
        const barTime = bar.time || bar.timestamp || 0;
        const lastTime = lastCandle ? lastCandle.time || lastCandle.timestamp || 0 : 0;

        if (lastCandle && lastTime === barTime) {
          // Update existing candle (snapshot + delta pattern)
          updatedCandles[updatedCandles.length - 1] = bar;
        } else {
          // New candle
          updatedCandles.push(bar);

          // Trim to max length
          if (updatedCandles.length > MAX_CANDLES_PER_TIMEFRAME) {
            updatedCandles = updatedCandles.slice(-MAX_CANDLES_PER_TIMEFRAME);
          }
        }

        // Auto-rollup higher timeframes from 1m bars
        let candles5m = symbolData.candles["5m"];
        let candles15m = symbolData.candles["15m"];
        let candles60m = symbolData.candles["60m"];

        if (timeframe === "1m") {
          // Roll up to 5m, 15m, 60m automatically
          candles5m = rollupBars(updatedCandles, "5m");
          candles15m = rollupBars(updatedCandles, "15m");
          candles60m = rollupBars(updatedCandles, "60m");
        }

        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              candles: {
                "1m": timeframe === "1m" ? updatedCandles : symbolData.candles["1m"],
                "5m":
                  timeframe === "1m"
                    ? candles5m
                    : timeframe === "5m"
                      ? updatedCandles
                      : symbolData.candles["5m"],
                "15m":
                  timeframe === "1m"
                    ? candles15m
                    : timeframe === "15m"
                      ? updatedCandles
                      : symbolData.candles["15m"],
                "60m":
                  timeframe === "1m"
                    ? candles60m
                    : timeframe === "60m"
                      ? updatedCandles
                      : symbolData.candles["60m"],
                "1D": symbolData.candles["1D"],
              },
              lastUpdated: Date.now(),
            },
          },
        });

        // Recompute comprehensive indicators/signals if this is the primary timeframe
        // Note: recomputeSymbol has built-in conditional logic (only runs on bar close or significant move)
        if (timeframe === symbolData.primaryTimeframe || timeframe === "1m") {
          get().recomputeSymbol(normalized);
        }
      },

      recomputeIndicators: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];

        if (!symbolData) return;

        const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
        if (primaryCandles.length === 0) return;

        // Compute indicators
        const indicators = computeIndicatorsFromCandles(primaryCandles);

        // Compute MTF trends
        const mtfTrend: Record<Timeframe, MTFTrend> = {} as Record<Timeframe, MTFTrend>;
        (["1m", "5m", "15m", "60m", "1D"] as Timeframe[]).forEach((tf) => {
          const tfCandles = symbolData.candles[tf];
          if (tfCandles.length > 0) {
            const tfIndicators = computeIndicatorsFromCandles(tfCandles);
            mtfTrend[tf] = determineTrend(tfCandles, tfIndicators);
          } else {
            mtfTrend[tf] = "neutral";
          }
        });

        // Compute confluence
        const confluence = calculateConfluence(normalized, primaryCandles, indicators, mtfTrend);

        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              indicators,
              mtfTrend,
              confluence,
              lastUpdated: Date.now(),
            },
          },
        });
      },

      /**
       * Recompute all indicators, MTF trends, confluence, and strategies for a symbol
       * Only runs on bar close OR significant price move
       * 0DTE contracts use tighter threshold (0.2%) vs regular (0.5%)
       */
      recomputeSymbol: (symbol: string, options?: { force?: boolean }) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        if (!symbolData) return;

        const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
        if (primaryCandles.length < 2) {
          // If only 1 candle but force=true, still calculate with minimal data
          if (options?.force && primaryCandles.length === 1) {
            console.log(`[v0] 📊 Force calculating confluence for ${normalized} with 1 candle`);
          } else {
            return; // Need at least 2 candles for comparison (unless forced)
          }
        }

        const lastCandle = primaryCandles[primaryCandles.length - 1];
        const prevCandle =
          primaryCandles.length >= 2 ? primaryCandles[primaryCandles.length - 2] : lastCandle;

        // ===== Conditional Execution: Only recompute on bar close or significant move =====

        // Check if this is a new bar (different timestamp from previous)
        const lastTime = lastCandle.time || lastCandle.timestamp || 0;
        const prevTime = prevCandle.time || prevCandle.timestamp || 0;
        const isNewBar = lastTime !== prevTime;

        // Check if we're tracking a 0DTE contract (DTE = 0)
        const is0DTE = symbolData.greeks?.expiry
          ? (() => {
              const expiry = new Date(symbolData.greeks.expiry);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              expiry.setHours(0, 0, 0, 0);
              return expiry.getTime() === today.getTime();
            })()
          : false;

        // Check if price moved significantly
        // 0DTE: 0.1% threshold (tighter for fast-moving 0DTE options)
        // Regular: 0.2% threshold (more sensitive for better responsiveness)
        const priceChange = Math.abs((lastCandle.close - prevCandle.close) / prevCandle.close);
        const threshold = is0DTE ? 0.001 : 0.002; // 0.1% for 0DTE, 0.2% for others (reduced from 0.5%)
        const significantMove = priceChange > threshold;

        // Always update timestamp to prevent false "stale" indicators
        // even if we skip heavy recomputation
        set(
          produce((draft) => {
            if (draft.symbols[normalized]) {
              draft.symbols[normalized].lastUpdated = Date.now();
            }
          })
        );

        // Skip heavy recomputation if neither condition met (unless force=true)
        if (!options?.force && !isNewBar && !significantMove) {
          return;
        }

        // Log why we're computing
        if (options?.force) {
          console.log(`[v0] 🔄 Force recomputing ${normalized}`);
        } else if (isNewBar) {
          console.log(`[v0] 🕐 New bar for ${normalized}, recomputing`);
        } else if (significantMove) {
          console.log(
            `[v0] 📈 Significant move (${(priceChange * 100).toFixed(2)}%) for ${normalized}, recomputing`
          );
        }

        // ===== Step 1: Calculate comprehensive indicators from all timeframes =====
        const indicators = calculateComprehensiveIndicators(symbolData);

        // ===== Step 2: Calculate MTF trends for each timeframe =====
        const mtfTrend = calculateMTFTrends(symbolData);

        // ===== Step 3: Calculate enhanced confluence score =====
        const confluence = calculateAdvancedConfluence(
          normalized,
          symbolData,
          indicators,
          mtfTrend
        );

        // ===== Step 4: Update state immutably using immer =====
        set(
          produce((draft) => {
            const sym = draft.symbols[normalized];
            if (!sym) return;

            // Update indicators
            sym.indicators = indicators;

            // Update MTF trends
            sym.mtfTrend = mtfTrend;

            // Update confluence
            sym.confluence = confluence;

            // Update timestamp
            sym.lastUpdated = Date.now();
          })
        );
      },

      updateConfluence: (symbol: string, confluenceUpdate: Partial<ConfluenceScore>) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];

        if (!symbolData) return;

        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              confluence: {
                ...symbolData.confluence,
                ...confluenceUpdate,
                lastUpdated: Date.now(),
              },
            },
          },
        });
      },

      updateGreeks: (symbol: string, greeks: Greeks) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];

        if (!symbolData) {
          console.warn(
            `[v0] marketDataStore: Cannot update Greeks for unknown symbol ${normalized}`
          );
          return;
        }

        // Check freshness (< 30s = fresh)
        const age = Date.now() - greeks.lastUpdated;
        const isFresh = age < 30000;

        const updatedGreeks: Greeks = {
          ...greeks,
          isFresh,
          lastUpdated: greeks.lastUpdated || Date.now(),
        };

        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              greeks: updatedGreeks,
              lastUpdated: Date.now(),
            },
          },
        });
      },

      clearGreeks: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];

        if (!symbolData) return;

        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              greeks: undefined,
            },
          },
        });
      },

      setMarketStatus: (status: MarketStatus) => {
        set({ marketStatus: status });
      },

      updateMarketSession: (session: EnrichedMarketSession) => {
        set({ enrichedSession: session });

        // Also update legacy marketStatus for backward compatibility
        const legacyStatus: MarketStatus =
          session.session === "PRE"
            ? "premarket"
            : session.session === "OPEN"
              ? "open"
              : session.session === "POST"
                ? "afterhours"
                : "closed";

        set({ marketStatus: legacyStatus });
      },

      fetchMarketSession: async () => {
        try {
          const { enrichMarketStatus } = await import("../lib/marketSession");

          const data = await massive.getMarketStatus();
          const enriched = enrichMarketStatus(data as any);

          const session: EnrichedMarketSession = {
            session: enriched.session,
            isOpen: enriched.isLive,
            isWeekend: enriched.isWeekend,
            nextOpen: enriched.nextOpen,
            nextClose: enriched.nextClose,
            serverTime: enriched.asOf,
            label: enriched.label,
            asOf: enriched.asOf,
          };

          get().updateMarketSession(session);
        } catch (error) {
          console.error("[v0] Failed to fetch market session:", error);

          // Use fallback session based on current time
          const { getFallbackSession, getNextMarketTimes } = await import("../lib/marketSession");
          const fallback = getFallbackSession();
          const { nextOpen, nextClose } = getNextMarketTimes(fallback.session);

          const now = new Date();
          const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
          const isWeekend = etTime.getDay() === 0 || etTime.getDay() === 6;

          const session: EnrichedMarketSession = {
            session: fallback.session,
            isOpen: fallback.isLive,
            isWeekend,
            nextOpen,
            nextClose,
            serverTime: fallback.asOf,
            label: fallback.label,
            asOf: fallback.asOf,
          };

          get().updateMarketSession(session);
        }
      },

      cleanup: () => {
        const { heartbeatInterval, pendingWatchlistUpdate, pollingInterval } = get();

        // Note: massive singleton handles its own connection lifecycle
        // We don't call massive.disconnect() here as it's globally managed

        // Clear heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }

        // Clear pending watchlist update
        if (pendingWatchlistUpdate) {
          clearTimeout(pendingWatchlistUpdate);
        }

        // Stop REST polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }

        set({
          wsConnection: {
            socket: null,
            status: "disconnected",
            reconnectAttempts: 0,
            lastMessageTime: 0,
          },
          isConnected: false,
          heartbeatInterval: null,
          pendingWatchlistUpdate: null,
          pollingInterval: null,
          subscribedSymbols: new Set(),
          unsubscribers: [],
        });
      },

      // ======================================================================
      // Selectors
      // ======================================================================

      getSymbolData: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        return get().symbols[normalized];
      },

      getCandles: (symbol: string, timeframe: Timeframe) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.candles[timeframe] || [];
      },

      getIndicators: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.indicators || {};
      },

      getConfluence: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.confluence;
      },

      getMTFTrend: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return (
          symbolData?.mtfTrend || {
            "1m": "neutral",
            "5m": "neutral",
            "15m": "neutral",
            "60m": "neutral",
            "1D": "neutral",
          }
        );
      },

      getGreeks: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.greeks;
      },

      areGreeksStale: (symbol: string, maxAgeMs = 30000) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        if (!symbolData || !symbolData.greeks) return true;

        const age = Date.now() - symbolData.greeks.lastUpdated;
        return age > maxAgeMs;
      },

      isStale: (symbol: string, maxAgeMs = STALE_THRESHOLD_MS) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        if (!symbolData) return true;

        const age = Date.now() - symbolData.lastUpdated;
        return age > maxAgeMs;
      },
    }),
    { name: "MarketDataStore" }
  )
);

// ============================================================================
// React Hooks (Typed Selectors)
// ============================================================================

/** Get all data for a symbol */
export function useSymbolData(symbol: string) {
  return useMarketDataStore((state) => state.getSymbolData(symbol));
}

/** Get candles for a specific timeframe */
export function useCandles(symbol: string, timeframe: Timeframe) {
  return useMarketDataStore((state) => state.getCandles(symbol, timeframe));
}

/** Get latest indicators */
export function useIndicators(symbol: string) {
  return useMarketDataStore((state) => state.getIndicators(symbol));
}

/** Get confluence score */
export function useConfluence(symbol: string) {
  return useMarketDataStore((state) => state.getConfluence(symbol));
}

/** Get MTF trend analysis */
export function useMTFTrend(symbol: string) {
  return useMarketDataStore((state) => state.getMTFTrend(symbol));
}

/** Get market status (legacy) */
export function useMarketStatus() {
  return useMarketDataStore((state) => state.marketStatus);
}

/** Get enriched market session with timing data */
export function useEnrichedMarketSession() {
  return useMarketDataStore((state) => state.enrichedSession);
}

/** Get market session actions */
export function useMarketSessionActions() {
  return useMarketDataStore((state) => ({
    fetchMarketSession: state.fetchMarketSession,
    updateMarketSession: state.updateMarketSession,
  }));
}

/** Get Greeks for a symbol */
export function useGreeks(symbol: string) {
  return useMarketDataStore((state) => state.getGreeks(symbol));
}

/** Check if Greeks are stale */
export function useAreGreeksStale(symbol: string, maxAgeMs?: number) {
  return useMarketDataStore((state) => state.areGreeksStale(symbol, maxAgeMs));
}

/** Check if symbol data is stale */
export function useIsStale(symbol: string, maxAgeMs?: number) {
  return useMarketDataStore((state) => state.isStale(symbol, maxAgeMs));
}
