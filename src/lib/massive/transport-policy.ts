// TransportPolicy: Streaming-first data with automatic REST fallback
// Handles WebSocket subscriptions with jittered backoff reconnection
// Falls back to 3s REST polling when WebSocket fails or disconnects

import { massive } from ".";
import { type WebSocketMessage } from "./websocket";
import type { MassiveQuote } from "./types";

// ============================================================================
// GLOBAL MARKET STATUS CACHE (Singleton - shared across all transport instances)
// This prevents rate limiting from multiple transports all calling isMarketOpen()
// ============================================================================
let globalMarketOpen = true; // Assume open until we know otherwise
let globalMarketStatusTimestamp = 0;
let globalMarketStatusPromise: Promise<boolean> | null = null;
const MARKET_STATUS_CACHE_MS = 60_000; // Cache for 60 seconds

async function getGlobalMarketStatus(): Promise<boolean> {
  const now = Date.now();

  // Return cached value if still valid
  if (now - globalMarketStatusTimestamp < MARKET_STATUS_CACHE_MS) {
    return globalMarketOpen;
  }

  // Deduplicate concurrent requests - if already fetching, return the same promise
  if (globalMarketStatusPromise) {
    return globalMarketStatusPromise;
  }

  // Fetch fresh status
  globalMarketStatusPromise = (async () => {
    try {
      const status = await massive.getMarketStatus();
      const marketState = status?.market?.toLowerCase?.() ?? "";
      globalMarketOpen = marketState.includes("open");
      globalMarketStatusTimestamp = Date.now();
    } catch (error) {
      console.warn("[TransportPolicy] Failed to fetch market status, assuming open:", error);
      // On error, keep previous value or assume open
    }
    globalMarketStatusPromise = null;
    return globalMarketOpen;
  })();

  return globalMarketStatusPromise;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

function mapMassiveMessageToQuote(data: any, fallbackSymbol: string): MassiveQuote | null {
  if (!data) {
    // console.log('[mapMassiveMessageToQuote] No data received');
    return null;
  }

  // If data is already a properly formatted MassiveQuote (has symbol, last, and all numeric fields), return it directly
  if (
    data.symbol &&
    typeof data.last === "number" &&
    typeof data.change === "number" &&
    typeof data.changePercent === "number"
  ) {
    // console.log(`[mapMassiveMessageToQuote] Data already formatted for ${data.symbol}:`, ...);
    return data as MassiveQuote;
  }

  let symbol = data.symbol || data.ticker || data.sym || data.underlying_ticker || fallbackSymbol;
  if (!symbol) {
    // console.log('[mapMassiveMessageToQuote] No symbol found in data:', data);
    return null;
  }

  // Remove I: prefix from indices (I:SPX → SPX) to match watchlist symbols
  if (symbol.startsWith("I:")) {
    symbol = symbol.substring(2);
  }

  const last = toNumber(data.last ?? data.value ?? data.price ?? data.c ?? 0);
  const change = toNumber(data.change ?? data.delta ?? 0);
  const changePercent = toNumber(
    data.changePercent ?? data.change_percent ?? data.percent_change ?? 0
  );
  const volume = toNumber(data.volume ?? data.v ?? 0);
  const bid = toNumber(data.bid ?? data.bp ?? 0);
  const ask = toNumber(data.ask ?? data.ap ?? 0);
  const high = toNumber(data.high ?? data.h ?? last);
  const low = toNumber(data.low ?? data.l ?? last);
  const open = toNumber(data.open ?? data.o ?? last);
  const previousClose = toNumber(
    data.previousClose ?? data.close ?? data.c ?? data.lastClose ?? last
  );
  const timestamp = toNumber(data.timestamp ?? data.t ?? Date.now());

  // console.log(`[mapMassiveMessageToQuote] Mapped ${symbol}:`, { last, change, changePercent });

  return {
    symbol,
    last,
    change,
    changePercent,
    bid,
    ask,
    volume,
    high,
    low,
    open,
    previousClose,
    timestamp,
  };
}

export interface TransportConfig {
  symbol: string;
  isOption?: boolean;
  isIndex?: boolean;
  pollInterval?: number; // Default: 3000ms
  maxReconnectDelay?: number; // Default: 30000ms
}

export type TransportCallback = (
  data: MassiveQuote,
  source: "websocket" | "rest",
  timestamp: number
) => void;

// Global REST data cache to prevent redundant API calls across multiple transports
const restDataCache = new Map<string, { data: MassiveQuote; timestamp: number }>();
const REST_CACHE_TTL_MS = 3000; // 3 seconds - matches minimum poll interval to prevent duplicate API calls

export class TransportPolicy {
  private config: TransportConfig;
  private callback: TransportCallback;
  private wsUnsubscribe: (() => void) | null = null;
  private pollTimer: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private lastDataTimestamp = 0;
  private isActive = false;
  private lastWsState: "connecting" | "open" | "closed" = "closed";
  private fetchingBars = false;
  private consecutiveNoChange = 0;
  private lastRestPrice: number | null = null;
  private currentPollInterval: number;
  private readonly basePollInterval: number;
  private readonly maxPollInterval = 15000;
  private readonly closedMarketPollInterval = 12000;
  // Health/debounce tuning
  private consecutiveHealthFailures = 0;
  private readonly healthFailureThreshold = 1; // require 1 consecutive failure before switching to REST (faster fallback)
  // Staleness thresholds per architecture: >3s WebSocket, >4s REST
  private readonly wsStaleThresholdMs = 3000; // consider WS data stale after 3s
  private readonly restStaleThresholdMs = 4000; // consider REST data stale after 4s
  private marketOpen = true; // Local cache, updated from global singleton
  // Message batching: accumulate updates and flush every 100ms
  private batchBuffer: Array<{
    quote: MassiveQuote;
    source: "websocket" | "rest";
    timestamp: number;
  }> = [];
  private batchFlushTimer: any = null;
  private readonly BATCH_FLUSH_INTERVAL = 100; // ms
  private isPaused = false;

  constructor(config: TransportConfig, callback: TransportCallback) {
    this.config = {
      pollInterval: 3000,
      maxReconnectDelay: 30000,
      ...config,
    };
    this.callback = callback;
    // Use adaptive interval instead of fixed 3s
    this.basePollInterval = this.getOptimalPollInterval();
    this.currentPollInterval = this.basePollInterval;

    // Add visibility change listener
    this.setupVisibilityListener();
  }

  private setupVisibilityListener() {
    // Check initial state - if page loads hidden, start paused
    if (document.hidden) {
      console.log(
        `[TransportPolicy] Page loaded hidden, starting paused for ${this.config.symbol}`
      );
      this.isPaused = true;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log(`[TransportPolicy] Tab hidden, pausing updates for ${this.config.symbol}`);
        this.pause();
      } else {
        console.log(`[TransportPolicy] Tab visible, resuming updates for ${this.config.symbol}`);
        this.resume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  private pause() {
    this.isPaused = true;
    this.clearPollTimer();
  }

  private resume() {
    this.isPaused = false;
    if (this.isActive) {
      // Fetch immediately on resume
      void this.pollData();
    }
  }

  /**
   * Log state transitions for debugging real-time data issues
   * Provides comprehensive visibility into transport layer health
   */
  private logState(message: string, level: "info" | "warn" | "error" = "info") {
    const stateInfo = {
      symbol: this.config.symbol,
      wsState: this.lastWsState,
      isPolling: !!this.pollTimer,
      failures: this.consecutiveHealthFailures,
      lastUpdate: this.lastDataTimestamp ? new Date(this.lastDataTimestamp).toISOString() : "never",
      staleness:
        this.lastDataTimestamp > 0
          ? `${Math.round((Date.now() - this.lastDataTimestamp) / 1000)}s ago`
          : "n/a",
      isPaused: this.isPaused,
    };

    if (level === "error") {
      console.error(`[TransportPolicy] ${message}`, stateInfo);
    } else if (level === "warn") {
      console.warn(`[TransportPolicy] ${message}`, stateInfo);
    }
    // Info level logging removed to avoid console.log eslint warning
    // State info is captured in warn/error logs which are most relevant
  }

  private getOptimalPollInterval(): number {
    const { isIndex, isOption, symbol } = this.config;

    // Check market hours
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const isPreMarket = hour < 9;
    const isAfterHours = hour >= 16;
    const isMarketClosed = isWeekend || isPreMarket || isAfterHours;

    // Base intervals by asset type
    if (isIndex) {
      // Indices are less volatile, can use longer intervals
      return isMarketClosed ? 10000 : 5000;
    } else if (isOption) {
      // Options are most volatile, need faster fallback
      return isMarketClosed ? 6000 : 2000;
    } else {
      // Stocks are moderate
      return isMarketClosed ? 8000 : 4000;
    }
  }

  private enqueueMessage(quote: MassiveQuote, source: "websocket" | "rest", timestamp: number) {
    this.batchBuffer.push({ quote, source, timestamp });

    // Start flush timer if not already running
    if (!this.batchFlushTimer) {
      this.batchFlushTimer = setTimeout(() => this.flushBatch(), this.BATCH_FLUSH_INTERVAL);
    }
  }

  private flushBatch() {
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }

    if (this.batchBuffer.length === 0) {
      return;
    }

    // Use the most recent message (typically most up-to-date)
    const { quote, source, timestamp } = this.batchBuffer[this.batchBuffer.length - 1];
    this.batchBuffer = [];

    // Single callback invocation per batch
    this.callback(quote, source, timestamp);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    // console.log(`[TransportPolicy] Starting for ${this.config.symbol}`);

    // Try WebSocket first
    this.tryWebSocket();

    // Monitor WebSocket health
    this.startHealthCheck();
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;

    // console.log(`[TransportPolicy] Stopping for ${this.config.symbol}`);

    // Note: In-flight requests will be handled by browser's natural cleanup
    // The unified massive API manages its own connection lifecycle

    // Flush any pending batched messages
    this.flushBatch();
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }

    // Clean up WebSocket
    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }

    // Clean up polling
    this.clearPollTimer();

    // Clean up reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  setFetchingBars(value: boolean) {
    this.fetchingBars = value;
  }

  private tryWebSocket() {
    if (this.wsUnsubscribe) {
      // Already subscribed
      return;
    }

    const wsState = massive.getConnectionState();
    // console.log(`[TransportPolicy] WebSocket state for ${this.config.symbol}:`, wsState);

    if (wsState === "closed") {
      // WebSocket is not connected, fall back to polling immediately
      this.logState("WebSocket closed, starting REST fallback", "warn");
      this.startPolling();
      this.scheduleReconnect();
      return;
    }

    // Subscribe based on symbol type
    if (this.config.isOption) {
      // Options contract quote subscription
      this.wsUnsubscribe = massive.subscribeOptionAggregates(
        [this.config.symbol],
        this.handleWsMessage.bind(this)
      );
    } else {
      // Index and stock/underlying quote subscription (both use subscribeQuotes)
      this.wsUnsubscribe = massive.subscribeQuotes(
        [this.config.symbol],
        this.handleWsMessage.bind(this)
      );
    }

    this.logState("WebSocket subscription created", "warn");
  }

  private handleWsMessage(message: WebSocketMessage) {
    if (!this.isActive || this.isPaused) return;

    const now = Date.now();
    this.lastDataTimestamp = now;

    const quote = mapMassiveMessageToQuote(message.data, this.config.symbol);
    if (!quote) {
      console.debug(
        `[TransportPolicy] Ignoring non-quote websocket message for ${this.config.symbol}:`,
        message.data
      );
      return;
    }

    console.debug(`[TransportPolicy] WebSocket data received for ${this.config.symbol}:`, quote);

    // Stop polling if running
    if (this.pollTimer) {
      this.logState("WebSocket recovered, stopping REST fallback", "warn");
      this.clearPollTimer();
    }

    // Reset reconnect attempts on successful data
    this.reconnectAttempts = 0;

    // Enqueue for batched processing
    this.enqueueMessage(quote, "websocket", now);
  }

  private startPolling() {
    if (this.pollTimer) {
      return;
    }

    this.logState(`Starting REST polling (interval ${this.basePollInterval}ms)`, "warn");
    this.currentPollInterval = this.basePollInterval;
    void this.pollData();
  }

  private clearPollTimer() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleNextPoll(delay?: number) {
    if (!this.isActive || this.isPaused) return;
    const wait = typeof delay === "number" ? delay : this.currentPollInterval;
    this.clearPollTimer();
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollData();
    }, wait);
  }

  private async pollData() {
    if (!this.isActive) return;

    // Allow polling even if paused - resume() will call this explicitly
    // We just won't schedule the next poll if paused
    if (this.isPaused) {
      return;
    }

    if (this.fetchingBars) {
      console.debug(
        `[TransportPolicy] Skipping REST poll for ${this.config.symbol} while historical bars are loading`
      );
      this.scheduleNextPoll();
      return;
    }

    // Check cache first to avoid redundant API calls
    const cached = restDataCache.get(this.config.symbol);
    if (cached && Date.now() - cached.timestamp < REST_CACHE_TTL_MS) {
      console.debug(
        `[TransportPolicy] Using cached REST data for ${this.config.symbol} (${Date.now() - cached.timestamp}ms old)`
      );
      const quote = mapMassiveMessageToQuote(cached.data, this.config.symbol);
      if (quote) {
        this.enqueueMessage(quote, "rest", cached.timestamp);
        this.lastDataTimestamp = cached.timestamp;
      }
      this.scheduleNextPoll();
      return;
    }

    const marketOpen = await this.isMarketOpen();
    if (!marketOpen) {
      this.currentPollInterval = Math.max(this.currentPollInterval, this.closedMarketPollInterval);
    }

    let priceChanged = false;

    try {
      const now = Date.now();
      let data: any;

      if (this.config.isOption) {
        // Options symbol is in OCC format: O:GOOGL250117C00315000
        const fullTicker = this.config.symbol;

        // Check if contract has expired - skip polling if so
        const dateMatch = fullTicker.match(/O:[A-Z]+(\d{6})[CP]/);
        if (dateMatch) {
          const dateStr = dateMatch[1];
          const year = 2000 + parseInt(dateStr.substring(0, 2));
          const month = parseInt(dateStr.substring(2, 4)) - 1;
          const day = parseInt(dateStr.substring(4, 6));
          const expiryDate = new Date(year, month, day);

          if (expiryDate < new Date()) {
            // Contract expired - skip polling
            this.scheduleNextPoll();
            return;
          }
        }

        // FIX: Use underlying snapshot + search FIRST (direct contract lookup returns empty)
        // The Massive API /v3/snapshot/options/{underlying} returns ~10-250 contracts reliably
        // The /v3/snapshot/options/{O:fullTicker} returns 76 bytes empty - doesn't work
        const extractedUnderlying = fullTicker.replace(/^O:/, "").match(/^([A-Z]+)/)?.[1];

        // Index options use special symbols in Massive.com API:
        // SPX options → SPXW (weeklys) or SPX (monthlies)
        // NDX options → NDX or NDXP
        // RUT options → RUT
        const INDEX_OPTIONS_MAP: Record<string, string[]> = {
          SPX: ["SPXW", "SPX"], // Try SPXW first (more common), then SPX
          NDX: ["NDX", "NDXP"],
          RUT: ["RUT", "RUTW"],
          VIX: ["VIX", "VIXW"],
        };

        // For index options, we need to try multiple underlying symbols
        const underlyingsToTry = INDEX_OPTIONS_MAP[extractedUnderlying || ""] || [
          extractedUnderlying,
        ];

        try {
          let foundContract: any = null;
          let successfulUnderlying: string | null = null;

          // Try each possible underlying symbol until we find the contract
          for (const underlying of underlyingsToTry) {
            if (!underlying) continue;

            try {
              const snapshotResponse = await massive.getOptionsSnapshot(underlying);
              const results = snapshotResponse?.results || [];

              foundContract = results.find(
                (c: any) =>
                  c.details?.ticker === fullTicker ||
                  c.ticker === fullTicker ||
                  c.details?.ticker === fullTicker.replace(/^O:/, "") ||
                  c.ticker === fullTicker.replace(/^O:/, "")
              );

              if (foundContract) {
                successfulUnderlying = underlying;
                console.log(`[TransportPolicy] Found ${fullTicker} in ${underlying} snapshot`);
                break;
              }
            } catch (err) {
              // Continue to next underlying
              console.warn(`[TransportPolicy] Snapshot for ${underlying} failed, trying next...`);
            }
          }

          if (
            foundContract &&
            (foundContract.last_quote || foundContract.last_trade || foundContract.day)
          ) {
            data = {
              symbol: fullTicker,
              last:
                foundContract.last_trade?.price ??
                foundContract.last_trade?.p ??
                foundContract.day?.close ??
                0,
              bid: foundContract.last_quote?.bid ?? foundContract.last_quote?.bp ?? 0,
              ask: foundContract.last_quote?.ask ?? foundContract.last_quote?.ap ?? 0,
              volume: foundContract.day?.volume ?? 0,
              change: foundContract.day?.change ?? 0,
              changePercent: foundContract.day?.change_percent ?? 0,
              open: foundContract.day?.open ?? 0,
              high: foundContract.day?.high ?? 0,
              low: foundContract.day?.low ?? 0,
              timestamp:
                foundContract.last_trade?.sip_timestamp ??
                foundContract.last_quote?.sip_timestamp ??
                Date.now(),
            };
            // Successfully found contract
          } else if (extractedUnderlying) {
            // Fallback: Try direct contract snapshot as last resort
            try {
              const directSnapshot = await massive.getContractSnapshot(fullTicker);
              if (directSnapshot?.results?.[0]) {
                const contract = directSnapshot.results[0];
                data = {
                  symbol: fullTicker,
                  last: contract.last_trade?.price ?? contract.day?.close ?? 0,
                  bid: contract.last_quote?.bid ?? 0,
                  ask: contract.last_quote?.ask ?? 0,
                  volume: contract.day?.volume ?? 0,
                  change: contract.day?.change ?? 0,
                  changePercent: contract.day?.change_percent ?? 0,
                  open: contract.day?.open ?? 0,
                  high: contract.day?.high ?? 0,
                  low: contract.day?.low ?? 0,
                  timestamp: contract.last_trade?.sip_timestamp ?? Date.now(),
                };
                console.log(`[TransportPolicy] Found ${fullTicker} via direct contract snapshot`);
              }
            } catch (directErr) {
              console.warn(`[TransportPolicy] Direct contract snapshot failed for ${fullTicker}`);
            }
          }

          if (!data) {
            console.warn(
              `[TransportPolicy] Contract ${fullTicker} not found in any snapshot (tried: ${underlyingsToTry.join(", ")})`
            );
          }
        } catch (snapshotError) {
          console.error(
            `[TransportPolicy] Snapshot lookup failed for ${fullTicker}:`,
            snapshotError
          );
        }
      } else if (this.config.isIndex) {
        data = await massive.getIndex(this.config.symbol);
      } else {
        const quotes = await massive.getQuotes([this.config.symbol]);
        data = quotes[0];
      }

      if (data) {
        // Always update timestamp when we receive data from API (not just on successful mapping)
        // This prevents false "stale" status when data exists but doesn't map to quote
        this.lastDataTimestamp = now;

        const quote = mapMassiveMessageToQuote(data, this.config.symbol);
        if (quote) {
          const previousPrice = this.lastRestPrice;
          priceChanged = previousPrice === null || Math.abs(previousPrice - quote.last) > 1e-6;
          this.lastRestPrice = quote.last;

          // Store in cache to prevent redundant API calls
          restDataCache.set(this.config.symbol, { data: quote, timestamp: now });

          // Enqueue for batched processing
          this.enqueueMessage(quote, "rest", now);
        } else {
          console.debug(
            `[TransportPolicy] Ignoring non-quote REST message for ${this.config.symbol}:`,
            data
          );
        }
      }
    } catch (error) {
      console.error(`[TransportPolicy] REST poll failed for ${this.config.symbol}:`, error);
    } finally {
      this.adjustPollInterval(priceChanged, marketOpen);
      this.scheduleNextPoll();
    }
  }

  private startHealthCheck() {
    // Check WebSocket health every 2 seconds
    const healthCheck = setInterval(() => {
      if (!this.isActive) {
        clearInterval(healthCheck);
        return;
      }

      const wsState = massive.getConnectionState();
      const wsHealth = massive.getHealth();
      const timeSinceLastData = Date.now() - this.lastDataTimestamp;
      const usingRest = !!this.pollTimer;
      const threshold = usingRest ? this.restStaleThresholdMs : this.wsStaleThresholdMs;
      const isStale = timeSinceLastData > threshold; // No data within allowed freshness window

      // DIAGNOSTIC: Log detailed health info every 10 seconds or on issues
      const shouldLogDiagnostics =
        this.consecutiveHealthFailures > 0 ||
        wsState !== "open" ||
        isStale ||
        Date.now() % 10000 < 2000; // Every 10 seconds

      if (shouldLogDiagnostics) {
        console.log(`[TransportPolicy] 📊 Health Diagnostic for ${this.config.symbol}:`, {
          wsState,
          wsAuthenticated: wsHealth?.websocket?.options?.authenticated ?? "unknown",
          wsSubscriptions: wsHealth?.websocket?.options?.activeSubscriptions ?? 0,
          wsLastMessage: wsHealth?.websocket?.options?.lastMessageTime
            ? `${((Date.now() - wsHealth.websocket.options.lastMessageTime) / 1000).toFixed(1)}s ago`
            : "never",
          timeSinceOurLastData: `${(timeSinceLastData / 1000).toFixed(1)}s`,
          threshold: `${threshold / 1000}s`,
          isStale,
          usingRest,
          consecutiveFailures: this.consecutiveHealthFailures,
          hasWsSubscription: !!this.wsUnsubscribe,
          lastRestPrice: this.lastRestPrice,
        });
      }

      // Detect state changes
      if (wsState !== this.lastWsState) {
        console.warn(
          `[TransportPolicy] 🔄 WebSocket state changed for ${this.config.symbol}: ${this.lastWsState} → ${wsState}`
        );
        this.lastWsState = wsState;
      }

      if (wsState === "closed" || isStale) {
        // Increment consecutive failure counter and only activate REST after threshold
        this.consecutiveHealthFailures += 1;
        console.warn(
          `[TransportPolicy] ⚠️ Health check failure #${this.consecutiveHealthFailures} for ${this.config.symbol} (state: ${wsState}, stale: ${isStale})`
        );

        if (this.consecutiveHealthFailures >= this.healthFailureThreshold) {
          // CRITICAL FIX: Force restart polling even if timer exists
          // Old polling may have stopped working, so clear and restart
          if (this.pollTimer) {
            this.logState("Stale detected, forcing REST fallback restart", "warn");
            this.clearPollTimer();
          } else {
            this.logState(
              `WebSocket unhealthy after ${this.consecutiveHealthFailures} checks, activating REST fallback`,
              "warn"
            );
          }
          this.startPolling();

          // Try to reconnect WebSocket if it's closed
          if (wsState === "closed" && !this.reconnectTimer) {
            this.scheduleReconnect();
          }
        }
      } else if (wsState === "open" && !isStale) {
        // WebSocket is healthy: reset failure counter and ensure subscription
        if (this.consecutiveHealthFailures > 0) this.consecutiveHealthFailures = 0;
        if (!this.wsUnsubscribe) {
          console.log(
            `[TransportPolicy] WebSocket healthy but not subscribed, resubscribing for ${this.config.symbol}`
          );
          this.tryWebSocket();
        }
      } else {
        // Reset counters for any other healthy-looking state
        if (this.consecutiveHealthFailures > 0) this.consecutiveHealthFailures = 0;
      }
    }, 2000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    // AGGRESSIVE RECONNECTION: Immediate retry on first failure (attempt 0)
    // This ensures fast recovery from temporary disconnections
    if (this.reconnectAttempts === 0) {
      this.logState("First failure detected, attempting immediate reconnect", "warn");
      this.reconnectAttempts++;

      // Attempt to reconnect the WebSocket immediately
      const wsState = massive.getConnectionState();
      if (wsState === "closed") {
        console.warn(`[TransportPolicy] Reconnecting WebSocket for ${this.config.symbol}`);
        massive.connect();
      }

      // Try subscribing again
      if (this.isActive) {
        this.tryWebSocket();

        // If still closed after immediate attempt, schedule exponential backoff
        if (massive.getConnectionState() === "closed") {
          this.scheduleReconnect();
        }
      }
      return;
    }

    // Exponential backoff with jitter (for subsequent failures)
    const baseDelay = 1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.config.maxReconnectDelay!);

    this.logState(
      `Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1})`,
      "warn"
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;

      // Attempt to reconnect the WebSocket
      const wsState = massive.getConnectionState();
      if (wsState === "closed") {
        this.logState("Reconnect timer fired, attempting WebSocket reconnection", "warn");
        massive.connect();
      }

      // Try subscribing again
      if (this.isActive) {
        this.tryWebSocket();

        // Schedule another reconnect if still needed
        if (massive.getConnectionState() === "closed") {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private adjustPollInterval(priceChanged: boolean, marketOpen: boolean) {
    if (!marketOpen) {
      this.currentPollInterval = Math.max(this.currentPollInterval, this.closedMarketPollInterval);
      this.consecutiveNoChange = 0;
      return;
    }

    if (priceChanged) {
      this.consecutiveNoChange = 0;
      this.currentPollInterval = this.basePollInterval;
      return;
    }

    this.consecutiveNoChange += 1;
    if (this.consecutiveNoChange >= 3) {
      this.currentPollInterval = Math.min(this.maxPollInterval, this.currentPollInterval + 2000);
    }
  }

  private async isMarketOpen(): Promise<boolean> {
    // Use global singleton cache to prevent multiple API calls from different transport instances
    this.marketOpen = await getGlobalMarketStatus();
    return this.marketOpen;
  }

  getLastDataTimestamp(): number {
    return this.lastDataTimestamp;
  }

  isUsingWebSocket(): boolean {
    return !!this.wsUnsubscribe && massive.getConnectionState() === "open";
  }

  isUsingRest(): boolean {
    return !!this.pollTimer;
  }
}

// Helper function to create a transport policy
export function createTransport(
  symbol: string,
  callback: TransportCallback,
  options?: { isOption?: boolean; isIndex?: boolean; pollInterval?: number }
): (() => void) & { setFetchingBars: (value: boolean) => void } {
  const transport = new TransportPolicy(
    {
      symbol,
      isOption: options?.isOption,
      isIndex: options?.isIndex,
      pollInterval: options?.pollInterval,
    },
    callback
  );

  transport.start();

  const cleanup = (() => transport.stop()) as (() => void) & {
    setFetchingBars: (value: boolean) => void;
  };
  cleanup.setFetchingBars = (value) => transport.setFetchingBars(value);
  return cleanup;
}
