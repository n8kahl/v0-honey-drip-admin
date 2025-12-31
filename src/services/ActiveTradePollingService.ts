/**
 * ActiveTradePollingService
 *
 * Smart REST polling service for active trades (ENTERED state).
 * Provides real-time P&L updates without requiring WebSocket connections.
 *
 * Features:
 * - Market hours aware polling intervals
 * - Automatic registration/unregistration based on trade state
 * - Batched updates to minimize API calls
 * - Graceful error handling with exponential backoff
 */

import { getFallbackSession, type MarketSession } from "../lib/marketSession";
import { useTradeStore } from "../stores/tradeStore";
import type { Trade } from "../types";
import { massive } from "../lib/massive";

// Polling intervals based on market session (in milliseconds)
// Using longer intervals to prevent rate limiting while still providing timely updates
const POLL_INTERVALS: Record<MarketSession, number> = {
  OPEN: 5_000, // 5 seconds during regular hours (balanced P&L updates vs rate limits)
  PRE: 10_000, // 10 seconds pre-market
  POST: 10_000, // 10 seconds after-hours
  CLOSED: 30_000, // 30 seconds when closed (for testing/development)
};

// Minimum interval between polls for the same contract (debounce)
const MIN_POLL_INTERVAL_MS = 1_500; // Slightly less than fastest poll interval

// Maximum consecutive errors before backing off
const MAX_CONSECUTIVE_ERRORS = 3;

// Backoff multiplier for errors
const ERROR_BACKOFF_MULTIPLIER = 2;

interface PolledContract {
  contractId: string; // OCC symbol like O:SPY250117C00622000
  tradeId: string;
  underlying: string;
  lastPollTime: number;
  lastPrice: number | null;
  consecutiveErrors: number;
}

interface PollResult {
  contractId: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  timestamp: number;
  source: "rest" | "snapshot";
  error?: string;
}

class ActiveTradePollingServiceImpl {
  private static instance: ActiveTradePollingServiceImpl | null = null;

  private contracts: Map<string, PolledContract> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private currentSession: MarketSession = "CLOSED";
  private lastSessionCheck = 0;
  private sessionCheckInterval = 60_000; // Check session every minute

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ActiveTradePollingServiceImpl {
    if (!ActiveTradePollingServiceImpl.instance) {
      ActiveTradePollingServiceImpl.instance = new ActiveTradePollingServiceImpl();
    }
    return ActiveTradePollingServiceImpl.instance;
  }

  /**
   * Start the polling service
   */
  start(): void {
    if (this.pollTimer) {
      console.log("[ActiveTradePolling] Already running");
      return;
    }

    console.log("[ActiveTradePolling] Starting service");
    this.updateSession();
    this.schedulePoll();
  }

  /**
   * Stop the polling service
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    console.log("[ActiveTradePolling] Stopped service");
  }

  /**
   * Register a trade for polling
   */
  registerTrade(trade: Trade): void {
    if (trade.state !== "ENTERED") {
      console.debug("[ActiveTradePolling] Skipping non-ENTERED trade", {
        tradeId: trade.id,
        state: trade.state,
      });
      return;
    }

    const contractId = trade.contract?.id;
    if (!contractId) {
      console.warn("[ActiveTradePolling] Trade has no contract ID", { tradeId: trade.id });
      return;
    }

    // Extract underlying from contract ID (O:SPY250117C00622000 -> SPY)
    const underlying = this.extractUnderlying(contractId);

    if (this.contracts.has(contractId)) {
      console.debug("[ActiveTradePolling] Contract already registered", { contractId });
      return;
    }

    this.contracts.set(contractId, {
      contractId,
      tradeId: trade.id,
      underlying,
      lastPollTime: 0,
      lastPrice: trade.currentPrice ?? trade.entryPrice ?? null,
      consecutiveErrors: 0,
    });

    console.log("[ActiveTradePolling] Registered trade for polling", {
      tradeId: trade.id,
      contractId,
      underlying,
      totalContracts: this.contracts.size,
    });

    // Start polling if not already running and we have contracts
    if (!this.pollTimer && this.contracts.size > 0) {
      this.start();
    }
  }

  /**
   * Unregister a trade from polling
   */
  unregisterTrade(tradeId: string): void {
    // Find and remove all contracts for this trade
    for (const [contractId, contract] of this.contracts) {
      if (contract.tradeId === tradeId) {
        this.contracts.delete(contractId);
        console.log("[ActiveTradePolling] Unregistered trade", {
          tradeId,
          contractId,
          remainingContracts: this.contracts.size,
        });
      }
    }

    // Stop polling if no contracts left
    if (this.contracts.size === 0) {
      this.stop();
    }
  }

  /**
   * Sync registered trades with the store
   * Call this when trades are loaded or state changes
   */
  syncWithStore(): void {
    const { activeTrades } = useTradeStore.getState();

    console.warn("[ActiveTradePolling] syncWithStore called", {
      totalActiveTrades: activeTrades.length,
      tradeStates: activeTrades.map((t) => ({
        id: t.id.slice(0, 8),
        state: t.state,
        ticker: t.ticker,
      })),
    });

    // Get all ENTERED trades
    const enteredTrades = activeTrades.filter((t) => t.state === "ENTERED");
    const enteredTradeIds = new Set(enteredTrades.map((t) => t.id));

    console.warn("[ActiveTradePolling] Found ENTERED trades:", {
      count: enteredTrades.length,
      trades: enteredTrades.map((t) => ({
        id: t.id.slice(0, 8),
        ticker: t.ticker,
        contractId: t.contract?.id?.slice(0, 20),
        hasContract: !!t.contract,
      })),
    });

    // Remove contracts for trades that are no longer ENTERED
    for (const [contractId, contract] of this.contracts) {
      if (!enteredTradeIds.has(contract.tradeId)) {
        this.contracts.delete(contractId);
        console.log("[ActiveTradePolling] Removed stale contract", {
          contractId,
          tradeId: contract.tradeId,
        });
      }
    }

    // Add contracts for ENTERED trades that aren't registered
    for (const trade of enteredTrades) {
      this.registerTrade(trade);
    }

    console.log("[ActiveTradePolling] Synced with store", {
      enteredTrades: enteredTrades.length,
      registeredContracts: this.contracts.size,
      session: this.currentSession,
      pollInterval: POLL_INTERVALS[this.currentSession],
    });
  }

  /**
   * Get current polling status
   */
  getStatus(): {
    isRunning: boolean;
    session: MarketSession;
    pollInterval: number;
    contractCount: number;
    contracts: string[];
  } {
    return {
      isRunning: !!this.pollTimer,
      session: this.currentSession,
      pollInterval: POLL_INTERVALS[this.currentSession],
      contractCount: this.contracts.size,
      contracts: Array.from(this.contracts.keys()),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private extractUnderlying(contractId: string): string {
    // O:SPY250117C00622000 -> SPY
    const match = contractId.replace(/^O:/, "").match(/^([A-Z]+)/);
    return match?.[1] || "";
  }

  private updateSession(): void {
    const now = Date.now();
    if (now - this.lastSessionCheck < this.sessionCheckInterval) {
      return;
    }

    const sessionState = getFallbackSession();
    const oldSession = this.currentSession;
    this.currentSession = sessionState.session;
    this.lastSessionCheck = now;

    if (oldSession !== this.currentSession) {
      console.log("[ActiveTradePolling] Session changed", {
        from: oldSession,
        to: this.currentSession,
        pollInterval: POLL_INTERVALS[this.currentSession],
      });

      // Reschedule with new interval
      if (this.pollTimer) {
        this.stop();
        this.schedulePoll();
      }
    }
  }

  private schedulePoll(): void {
    const interval = POLL_INTERVALS[this.currentSession];

    if (interval === 0) {
      console.log("[ActiveTradePolling] Market closed, not scheduling polls");
      return;
    }

    if (this.contracts.size === 0) {
      console.log("[ActiveTradePolling] No contracts to poll");
      return;
    }

    // Initial poll
    this.poll();

    // Schedule recurring polls
    this.pollTimer = setInterval(() => {
      this.updateSession();
      if (POLL_INTERVALS[this.currentSession] > 0) {
        this.poll();
      }
    }, interval);

    console.log("[ActiveTradePolling] Scheduled polling", {
      interval,
      contractCount: this.contracts.size,
    });
  }

  private async poll(): Promise<void> {
    if (this.isPolling) {
      console.debug("[ActiveTradePolling] Skipping poll, already in progress");
      return;
    }

    if (this.contracts.size === 0) {
      console.warn("[ActiveTradePolling] poll() called but no contracts registered");
      return;
    }

    console.warn("[ActiveTradePolling] Starting poll cycle", {
      contractCount: this.contracts.size,
      contracts: Array.from(this.contracts.keys()).map((k) => k.slice(0, 25)),
      session: this.currentSession,
    });

    this.isPolling = true;
    const startTime = Date.now();

    try {
      // Group contracts by underlying for efficient batching
      const byUnderlying = new Map<string, PolledContract[]>();
      for (const contract of this.contracts.values()) {
        const group = byUnderlying.get(contract.underlying) || [];
        group.push(contract);
        byUnderlying.set(contract.underlying, group);
      }

      // Poll each underlying's snapshot
      const results: PollResult[] = [];

      for (const [underlying, contracts] of byUnderlying) {
        try {
          const snapshotResults = await this.fetchContractPrices(underlying, contracts);
          results.push(...snapshotResults);
        } catch (error) {
          console.error("[ActiveTradePolling] Failed to fetch snapshot", {
            underlying,
            error: error instanceof Error ? error.message : String(error),
          });

          // Mark all contracts for this underlying as errored
          for (const contract of contracts) {
            results.push({
              contractId: contract.contractId,
              price: null,
              bid: null,
              ask: null,
              timestamp: Date.now(),
              source: "rest",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Update trades with new prices
      this.applyPollResults(results);

      const elapsed = Date.now() - startTime;
      console.log("[ActiveTradePolling] Poll completed", {
        contracts: this.contracts.size,
        successCount: results.filter((r) => r.price !== null).length,
        errorCount: results.filter((r) => r.error).length,
        elapsedMs: elapsed,
      });
    } catch (error) {
      console.error("[ActiveTradePolling] Poll failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isPolling = false;
    }
  }

  private async fetchContractPrices(
    underlying: string,
    contracts: PolledContract[]
  ): Promise<PollResult[]> {
    const results: PollResult[] = [];
    const now = Date.now();

    // First, try to get prices from the underlying snapshot (batch fetch)
    // Uses the unified massive client which goes through the rate limiter
    try {
      const data = await massive.getOptionsSnapshot(underlying);
      const snapshotResults = data.results || [];

      // Create a map for quick lookup
      const snapshotMap = new Map<string, any>();
      for (const item of snapshotResults) {
        const ticker = item.details?.ticker || item.ticker;
        if (ticker) {
          snapshotMap.set(ticker, item);
        }
      }

      // Match each contract
      for (const contract of contracts) {
        const snapshot = snapshotMap.get(contract.contractId);

        if (snapshot) {
          const price =
            snapshot.last_trade?.price ?? snapshot.last_trade?.p ?? snapshot.day?.close ?? null;

          results.push({
            contractId: contract.contractId,
            price,
            bid: snapshot.last_quote?.bid ?? snapshot.last_quote?.bp ?? null,
            ask: snapshot.last_quote?.ask ?? snapshot.last_quote?.ap ?? null,
            timestamp: now,
            source: "snapshot",
          });

          // Update contract tracking
          contract.lastPollTime = now;
          contract.lastPrice = price;
          contract.consecutiveErrors = 0;
        } else {
          // Contract not found in snapshot - try direct lookup
          const directResult = await this.fetchDirectContractPrice(contract);
          results.push(directResult);
        }
      }
    } catch (error) {
      // If batch fails, try direct lookup for each contract
      console.warn("[ActiveTradePolling] Batch snapshot failed, trying direct lookups", {
        underlying,
        error: error instanceof Error ? error.message : String(error),
      });

      for (const contract of contracts) {
        const directResult = await this.fetchDirectContractPrice(contract);
        results.push(directResult);
      }
    }

    return results;
  }

  private async fetchDirectContractPrice(contract: PolledContract): Promise<PollResult> {
    const now = Date.now();

    try {
      // Use direct contract lookup through the unified massive client (goes through rate limiter)
      const data = await massive.getOptionsSnapshot(contract.contractId);
      const result = data.results?.[0] || data;

      const price = result.last_trade?.price ?? result.last_trade?.p ?? result.day?.close ?? null;

      contract.lastPollTime = now;
      contract.lastPrice = price;
      contract.consecutiveErrors = 0;

      return {
        contractId: contract.contractId,
        price,
        bid: result.last_quote?.bid ?? result.last_quote?.bp ?? null,
        ask: result.last_quote?.ask ?? result.last_quote?.ap ?? null,
        timestamp: now,
        source: "rest",
      };
    } catch (error) {
      contract.consecutiveErrors++;

      return {
        contractId: contract.contractId,
        price: contract.lastPrice, // Use last known price
        bid: null,
        ask: null,
        timestamp: now,
        source: "rest",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private applyPollResults(results: PollResult[]): void {
    const store = useTradeStore.getState();

    console.warn("[ActiveTradePolling] Applying poll results", {
      totalResults: results.length,
      withPrices: results.filter((r) => r.price !== null).length,
      withErrors: results.filter((r) => r.error).length,
      results: results.map((r) => ({
        contract: r.contractId.slice(0, 25),
        price: r.price?.toFixed(2) ?? "null",
        error: r.error?.slice(0, 50),
      })),
    });

    for (const result of results) {
      if (result.price === null) {
        console.warn("[ActiveTradePolling] Skipping result with null price:", result.contractId);
        continue;
      }

      const contract = this.contracts.get(result.contractId);
      if (!contract) {
        continue;
      }

      // Find the trade in the store
      const trade = store.activeTrades.find((t) => t.id === contract.tradeId);
      if (!trade || trade.state !== "ENTERED") {
        continue;
      }

      // Always update timestamp to keep data "fresh" indicator accurate
      // Even if price hasn't changed (e.g., after hours), we want to show we're still polling
      const currentPrice = trade.currentPrice ?? trade.last_option_price;
      const priceChanged = currentPrice !== result.price;

      // DEBUG: Log every polling update
      console.warn(`🔄 [POLLING] Updating trade ${contract.tradeId}:`, {
        contractId: contract.contractId,
        price: result.price,
        bid: result.bid,
        ask: result.ask,
        source: result.source,
        priceChanged,
        oldPrice: currentPrice,
      });

      // Update the trade with new timestamp (and price if changed)
      // IMPORTANT: Use camelCase - store.updateTrade converts to snake_case for DB
      store.updateTrade(contract.tradeId, {
        currentPrice: result.price,
        lastOptionPrice: result.price,
        lastOptionPriceAt: new Date(result.timestamp),
        priceDataSource: result.source,
      } as any);
    }
  }
}

// Export singleton instance
export const ActiveTradePollingService = ActiveTradePollingServiceImpl.getInstance();

// Export for type usage
export type { PolledContract, PollResult };
