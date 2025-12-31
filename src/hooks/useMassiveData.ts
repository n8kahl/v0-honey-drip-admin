import { useState, useEffect, useCallback, useRef } from "react";
import { produce } from "immer";
import { massive, type MassiveQuote, type MassiveOptionsChain } from "../lib/massive";
import { streamingManager } from "../lib/massive/streaming-manager";
import type { Contract, Trade } from "../types";
import { fetchNormalizedChain } from "../services/options";
import { fetchQuotes as fetchUnifiedQuotes } from "../services/quotes";
import { useMarketDataStore } from "../stores/marketDataStore";
import { useTradeStore } from "../stores/tradeStore";
import { calculateNetPnLPercent } from "../services/pnlCalculator";
import { normalizeOptionTicker } from "../lib/optionsSymbol";

// Group contracts by expiration for backwards compatibility with old MassiveOptionsChain format
function groupContractsByExpiration(contracts: Contract[]): MassiveOptionsChain {
  const expiryMap = new Map<string, any[]>();

  for (const contract of contracts) {
    if (!expiryMap.has(contract.expiry)) {
      expiryMap.set(contract.expiry, []);
    }
    expiryMap.get(contract.expiry)!.push({
      ticker: contract.id,
      strike_price: contract.strike,
      expiration_date: contract.expiry,
      contract_type: contract.type,
      last_price: contract.mid, // Use mid as last price approximation
      bid: contract.bid,
      ask: contract.ask,
      mid: contract.mid,
      volume: contract.volume,
      open_interest: contract.openInterest,
      implied_volatility: contract.iv,
      delta: contract.delta,
      gamma: contract.gamma,
      theta: contract.theta,
      vega: contract.vega,
    });
  }

  return {
    results: Array.from(expiryMap.values()).flat(),
  } as MassiveOptionsChain;
}

// Cache for options chain data with symbol+window as key
const optionsChainCache = new Map<
  string,
  { data: { contracts: Contract[]; chain: MassiveOptionsChain }; timestamp: number }
>();
const CACHE_TTL_MS = 10000; // 10 seconds

export function useOptionsChain(symbol: string | null, window: number = 0) {
  const [optionsChain, setOptionsChain] = useState<MassiveOptionsChain | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);

  useEffect(() => {
    if (!symbol) {
      setOptionsChain(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = `${symbol}-${window || "all"}`;
    const cached = optionsChainCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(
        `[v0] useOptionsChain: Using cached data for ${symbol} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`
      );
      setContracts(cached.data.contracts);
      setOptionsChain(cached.data.chain);
      setAsOf(cached.timestamp);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const fetch = async () => {
      try {
        const USE_UNIFIED =
          ((import.meta as any)?.env?.VITE_USE_UNIFIED_CHAIN ?? "true") === "true";
        let contracts: Contract[] = [];
        if (USE_UNIFIED) {
          const tokenManager = massive.getTokenManager();
          const normalized = await fetchNormalizedChain(symbol, { window, tokenManager });
          contracts = normalized;
        } else {
          const data = await massive.getOptionsChain(symbol);
          contracts = data.results.map((opt: any) => ({
            id: opt.ticker || `${symbol}-${opt.strike}-${opt.expiration}`,
            strike: opt.strike,
            expiry: opt.expiration,
            type: opt.type,
            underlying: symbol,
            ...opt,
          }));
        }
        const chain = groupContractsByExpiration(contracts);
        const now = Date.now();

        // Store in cache
        const cacheKey = `${symbol}-${window || "all"}`;
        optionsChainCache.set(cacheKey, {
          data: { contracts, chain },
          timestamp: now,
        });
        console.log(`[v0] useOptionsChain: Cached fresh data for ${symbol}`);

        setContracts(contracts);
        setOptionsChain(chain);
        setAsOf(now);
        setLoading(false);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch options chain");
        setLoading(false);
      }
    };
    fetch();
  }, [symbol, window]);

  return { optionsChain, contracts, loading, error, asOf };
}

export function useQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<
    Map<string, MassiveQuote & { asOf: number; source: "websocket" | "rest" }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = useCallback(
    (
      update?: MassiveQuote | null,
      source: "websocket" | "rest" = "rest",
      timestamp = Date.now()
    ) => {
      if (!update) return;
      if (!update.symbol) {
        console.warn("[useQuotes] Received quote without symbol, ignoring", update);
        return;
      }
      setQuotes((prev) => {
        const next = new Map(prev);
        next.set(update.symbol, {
          ...update,
          symbol: update.symbol,
          asOf: timestamp,
          source,
        });
        return next;
      });

      // Update marketDataStore timestamp to prevent "stale" status
      // Use Immer's produce to avoid race conditions with concurrent candle updates
      try {
        useMarketDataStore.setState(
          produce((draft: any) => {
            if (draft.symbols[update.symbol]) {
              // Only update timestamp, preserve all other data (especially candles)
              draft.symbols[update.symbol].lastUpdated = Date.now();
            }
          }) as any
        );
      } catch (e) {
        // Ignore if symbol not in store
      }

      setError(null);
    },
    [] // No dependencies - uses Immer produce which reads directly from store
  );

  useEffect(() => {
    if (symbols.length === 0) {
      setLoading(false);
      return;
    }

    console.log("[useQuotes] Starting streaming for symbols:", symbols);

    const unsubscribes: Array<() => void> = [];

    // 1) Immediate batched REST fill for all symbols
    (async () => {
      try {
        const tokenManager = massive.getTokenManager();
        const unified = await fetchUnifiedQuotes(symbols, tokenManager);
        const now = Date.now();
        unified.forEach((q) =>
          handleUpdate(
            {
              symbol: q.symbol,
              last: q.last,
              change: q.change,
              changePercent: q.changePercent,
              bid: 0,
              ask: 0,
              volume: 0,
              high: q.last,
              low: q.last,
              open: q.last,
              previousClose: q.last,
              timestamp: q.asOf || now,
            } as any,
            "rest",
            q.asOf || now
          )
        );
      } catch (e) {
        console.warn("[useQuotes] Initial batch fill failed", e);
      }
    })();

    symbols.forEach((symbol) => {
      const isIndex = symbol.startsWith("I:") || ["SPX", "NDX", "VIX", "RUT"].includes(symbol);

      console.warn(
        `[useQuotes] Creating transport for ${symbol} (isIndex: ${isIndex}, isOption: false)`
      );

      const unsubscribe = streamingManager.subscribe(
        symbol,
        ["quotes"], // Channel for stock/index quotes
        (streamData) => {
          console.log(
            `[useQuotes] Received ${streamData.source} update for ${symbol}:`,
            streamData.data
          );
          handleUpdate(streamData.data, streamData.source, streamData.timestamp);
        },
        {
          isOption: false, // CRITICAL: Explicitly set to false for stock/index quotes
          isIndex,
        }
      );

      unsubscribes.push(unsubscribe);
    });

    setLoading(false);

    return () => {
      console.log("[useQuotes] Cleaning up transports for symbols:", symbols);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [symbols.join(",")]);

  return { quotes, loading, error };
}

export function useActiveTradePnL(
  tradeId: string | null,
  contractTicker: string | null,
  entryPrice: number,
  quantity: number = 1
) {
  const normalizedTicker = normalizeOptionTicker(contractTicker);
  const [currentPrice, setCurrentPrice] = useState(entryPrice);
  const [bid, setBid] = useState(0);
  const [ask, setAsk] = useState(0);
  const [last, setLast] = useState(0);
  const [pnlPercent, setPnlPercent] = useState(0);
  const [pnlDollars, setPnlDollars] = useState(0);
  const [asOf, setAsOf] = useState(Date.now());
  const [source, setSource] = useState<"websocket" | "rest">("rest");
  const lastTickerRef = useRef<string | null>(null);

  // Price stabilization refs - only update state when price actually changes
  // This prevents UI flashing on every REST poll when price is unchanged
  const lastPriceRef = useRef<{ bid: number; ask: number; mid: number }>({
    bid: 0,
    ask: 0,
    mid: 0,
  });
  const PRICE_CHANGE_THRESHOLD = 0.001; // $0.001 minimum change to trigger update

  // Subscribe to store updates from ActiveTradePollingService
  // This ensures we get fresh timestamps even when transport fails
  // FIX: Use primitive values to prevent re-renders from object reference changes
  const storePriceValue = useTradeStore((state) => {
    if (!tradeId) return 0;
    const trade = state.activeTrades.find((t: Trade) => t.id === tradeId);
    return trade?.last_option_price ?? trade?.currentPrice ?? 0;
  });
  const storePriceAsOf = useTradeStore((state) => {
    if (!tradeId) return 0;
    const trade = state.activeTrades.find((t: Trade) => t.id === tradeId);
    return trade?.last_option_price_at ? new Date(trade.last_option_price_at).getTime() : 0;
  });
  const storePriceSource = useTradeStore((state) => {
    if (!tradeId) return "rest";
    const trade = state.activeTrades.find((t: Trade) => t.id === tradeId);
    return trade?.price_data_source ?? "rest";
  });

  // Use store data if it's fresher than local state
  const effectiveAsOf = storePriceAsOf && storePriceAsOf > asOf ? storePriceAsOf : asOf;

  // Stale detection: data older than 10 seconds is considered stale
  const STALE_THRESHOLD_MS = 10_000;
  const isStale = Date.now() - effectiveAsOf > STALE_THRESHOLD_MS;

  // FIX 12: Use store price as fallback when streaming/REST fails
  // This ensures P&L shows non-zero when database has a different price than entry
  useEffect(() => {
    if (storePriceValue > 0 && storePriceValue !== entryPrice) {
      // Store has a valid price different from entry - use it as fallback
      if (currentPrice === entryPrice) {
        setCurrentPrice(storePriceValue);
        setAsOf(storePriceAsOf || Date.now());
        setSource((storePriceSource as "websocket" | "rest") || "rest");

        // Calculate P&L with store price
        if (entryPrice > 0) {
          const pnl = calculateNetPnLPercent(entryPrice, storePriceValue, quantity);
          setPnlPercent(pnl);
          setPnlDollars((storePriceValue - entryPrice) * quantity * 100);
          console.warn(
            `[useActiveTradePnL] Using store fallback price: $${storePriceValue.toFixed(2)}, P&L: ${pnl.toFixed(1)}%`
          );
        }
      }
    }
  }, [storePriceValue, storePriceAsOf, storePriceSource, entryPrice, quantity, currentPrice]);

  // Immediate REST fetch on mount for faster initial data
  // FIX: Use underlying snapshot + search for contract (direct contract endpoint returns empty)
  useEffect(() => {
    if (!normalizedTicker) return;

    const fetchInitialPrice = async () => {
      console.warn(`🔍 [P&L DEBUG] Starting fetch for ${normalizedTicker}`);
      console.warn(`🔍 [P&L DEBUG] Entry price: $${entryPrice}, Quantity: ${quantity}`);

      try {
        // Extract underlying from OCC symbol (e.g., O:SOFI260102P00027000 → SOFI)
        const tickerWithoutPrefix = normalizedTicker.replace(/^O:/, "");
        const underlyingMatch = tickerWithoutPrefix.match(/^([A-Z]{1,6})/);
        const underlying = underlyingMatch?.[1];

        console.warn(`🔍 [P&L DEBUG] Extracted underlying: ${underlying} from ${normalizedTicker}`);

        if (!underlying) {
          console.error(`❌ [P&L DEBUG] Could not extract underlying from ${normalizedTicker}`);
          return;
        }

        // Fetch underlying snapshot (returns ~10-250 contracts)
        const snapshot = await massive.getOptionsSnapshot(underlying);
        const results = snapshot?.results || [];

        console.warn(
          `🔍 [P&L DEBUG] Snapshot returned ${results.length} contracts for ${underlying}`
        );

        // LOG ALL TICKER FORMATS IN RESULTS
        if (results.length > 0) {
          console.warn(
            `🔍 [P&L DEBUG] Sample contract tickers:`,
            results.slice(0, 5).map((c: Record<string, unknown>) => ({
              ticker: c.ticker,
              detailsTicker: (c.details as Record<string, unknown>)?.ticker,
              strike: (c.details as Record<string, unknown>)?.strike_price,
              expiry: (c.details as Record<string, unknown>)?.expiration_date,
            }))
          );
        }

        // Search for our specific contract in the results
        const contract = results.find(
          (c: any) =>
            c.ticker === normalizedTicker ||
            c.details?.ticker === normalizedTicker ||
            c.ticker === tickerWithoutPrefix
        );

        console.warn(`🔍 [P&L DEBUG] Contract search result:`, contract ? "FOUND" : "NOT FOUND");

        if (!contract) {
          console.error(`❌ [P&L DEBUG] Contract ${normalizedTicker} NOT in snapshot!`);
          console.warn(`🔍 [P&L DEBUG] Tried matching:`, {
            normalizedTicker,
            tickerWithoutPrefix,
            availableTickers: results.slice(0, 10).map((c: any) => c.ticker || c.details?.ticker),
          });
          // Fall back to database price (storePrice effect will handle this)
          return;
        }

        // Extract price from various possible fields
        const lastTrade = contract.last_trade || contract.lastTrade;
        const lastQuote = contract.last_quote || contract.lastQuote;
        const day = contract.day;

        console.warn(`🔍 [P&L DEBUG] Contract data:`, { lastTrade, lastQuote, day });

        if (lastTrade || lastQuote || day) {
          const price = lastTrade?.price ?? lastTrade?.p ?? day?.close ?? day?.c ?? 0;
          const fetchedBid = lastQuote?.bid ?? lastQuote?.bp ?? lastQuote?.b ?? 0;
          const fetchedAsk = lastQuote?.ask ?? lastQuote?.ap ?? lastQuote?.a ?? 0;

          console.warn(
            `🔍 [P&L DEBUG] Extracted prices: price=$${price}, bid=$${fetchedBid}, ask=$${fetchedAsk}`
          );

          if (price > 0 || fetchedBid > 0 || fetchedAsk > 0) {
            const mid = fetchedBid > 0 && fetchedAsk > 0 ? (fetchedBid + fetchedAsk) / 2 : price;

            // STABILIZATION: Only update state if price actually changed
            // This prevents UI flashing on every REST poll when price is unchanged
            const priceChanged =
              Math.abs(mid - lastPriceRef.current.mid) > PRICE_CHANGE_THRESHOLD ||
              Math.abs(fetchedBid - lastPriceRef.current.bid) > PRICE_CHANGE_THRESHOLD ||
              Math.abs(fetchedAsk - lastPriceRef.current.ask) > PRICE_CHANGE_THRESHOLD;

            if (priceChanged) {
              // Update refs first
              lastPriceRef.current = { bid: fetchedBid, ask: fetchedAsk, mid };

              // Then update state
              if (mid > 0) setCurrentPrice(mid);
              if (fetchedBid > 0) setBid(fetchedBid);
              if (fetchedAsk > 0) setAsk(fetchedAsk);
              setAsOf(Date.now());
              setSource("rest");

              if (entryPrice > 0 && mid > 0) {
                const pnl = calculateNetPnLPercent(entryPrice, mid, quantity);
                setPnlPercent(pnl);
                setPnlDollars((mid - entryPrice) * quantity * 100);
                console.warn(
                  `✅ [P&L DEBUG] P&L calculated: ${pnl.toFixed(2)}% (entry: $${entryPrice}, mid: $${mid})`
                );
              }
              console.warn(
                `✅ [P&L DEBUG] REST price for ${normalizedTicker}: $${mid.toFixed(2)} (bid: $${fetchedBid.toFixed(2)}, ask: $${fetchedAsk.toFixed(2)})`
              );
            }
            // If price unchanged, silently skip to prevent flashing
          } else {
            console.error(`❌ [P&L DEBUG] Contract found but no price data:`, {
              ticker: normalizedTicker,
              lastTrade,
              lastQuote,
              day,
            });
          }
        } else {
          console.error(`❌ [P&L DEBUG] Contract has no trade/quote/day data:`, contract);
        }
      } catch (error) {
        console.error(`❌ [P&L DEBUG] Initial fetch failed for ${normalizedTicker}:`, error);
      }
    };

    // Fetch immediately on mount
    fetchInitialPrice();
  }, [normalizedTicker, entryPrice, quantity]);

  useEffect(() => {
    if (normalizedTicker !== lastTickerRef.current) {
      lastTickerRef.current = normalizedTicker;
      setCurrentPrice(entryPrice);
      setBid(0);
      setAsk(0);
      setLast(0);
      setPnlPercent(0);
      setPnlDollars(0);
      setAsOf(Date.now());
      setSource("rest");
    }

    if (!normalizedTicker) return;

    console.warn("[useActiveTradePnL] Starting PnL tracking for contract:", normalizedTicker);

    const unsubscribe = streamingManager.subscribe(
      normalizedTicker,
      ["options"], // Channel for options contracts
      (streamData) => {
        const data = streamData.data;
        const transportSource = streamData.source;
        const timestamp = streamData.timestamp;

        // TEMPORARY DEBUG: Remove after confirming data flow
        console.log("[DEBUG useActiveTradePnL] RAW DATA:", {
          ticker: normalizedTicker,
          source: transportSource,
          dataKeys: Object.keys(data),
          bid: data.bid,
          ask: data.ask,
          last: data.last,
          bp: data.bp,
          ap: data.ap,
          p: data.p,
        });

        // FIX #1: Handle multiple field name variants (Massive.com uses abbreviations)
        const nextBid =
          typeof data.bid === "number" ? data.bid : typeof data.bp === "number" ? data.bp : 0;
        const nextAsk =
          typeof data.ask === "number" ? data.ask : typeof data.ap === "number" ? data.ap : 0;
        const nextLast =
          typeof data.last === "number"
            ? data.last
            : typeof data.p === "number"
              ? data.p
              : typeof data.price === "number"
                ? data.price
                : 0;

        const mid = nextBid > 0 && nextAsk > 0 ? (nextBid + nextAsk) / 2 : nextBid || nextAsk || 0;
        const price = mid > 0 ? mid : nextLast;

        // FIX #2: Relax filter - update state whenever we receive ANY valid data
        const hasValidData = nextBid > 0 || nextAsk > 0 || nextLast > 0 || price > 0;

        if (hasValidData) {
          // STABILIZATION: Only update state if price actually changed
          // This prevents UI flashing on every update when price is unchanged
          const priceChanged =
            Math.abs(price - lastPriceRef.current.mid) > PRICE_CHANGE_THRESHOLD ||
            Math.abs(nextBid - lastPriceRef.current.bid) > PRICE_CHANGE_THRESHOLD ||
            Math.abs(nextAsk - lastPriceRef.current.ask) > PRICE_CHANGE_THRESHOLD;

          if (priceChanged) {
            // Update refs first
            lastPriceRef.current = { bid: nextBid, ask: nextAsk, mid: price };

            // Update price only if valid, otherwise keep previous
            if (price > 0) {
              setCurrentPrice(price);
            }

            // Always update bid/ask/last if provided (keeps state fresh)
            setBid((prev) => (nextBid > 0 ? nextBid : prev));
            setAsk((prev) => (nextAsk > 0 ? nextAsk : prev));
            setLast((prev) => (nextLast > 0 ? nextLast : prev));

            // Always update metadata
            setAsOf(timestamp);
            setSource(transportSource);

            // FIX #3: Calculate P&L even if current price is 0 (use entry as fallback)
            const priceForCalc = price > 0 ? price : entryPrice;
            const hasEntry = entryPrice > 0;

            if (hasEntry) {
              // Calculate GROSS P&L percent (for comparison)
              const grossPnl = ((priceForCalc - entryPrice) / entryPrice) * 100;

              // Calculate REALISTIC net P&L accounting for commissions and slippage
              const pnl = calculateNetPnLPercent(entryPrice, priceForCalc, quantity);
              setPnlPercent(pnl);

              // Calculate P&L in dollars: (currentPrice - entryPrice) * quantity * 100
              const dollars = (priceForCalc - entryPrice) * quantity * 100;
              setPnlDollars(dollars);

              // NOTE: Database updates are now handled by ActiveTradePollingService
              // which polls every 2 seconds and updates both store and database.
              // This eliminates duplicate writes and ensures consistent pricing.

              console.warn(
                `[useActiveTradePnL] ${transportSource} update for ${normalizedTicker}:`,
                {
                  price: price > 0 ? `$${price.toFixed(2)}` : "N/A",
                  bid: nextBid > 0 ? `$${nextBid.toFixed(2)}` : "N/A",
                  ask: nextAsk > 0 ? `$${nextAsk.toFixed(2)}` : "N/A",
                  grossPnl: `${grossPnl >= 0 ? "+" : ""}${grossPnl.toFixed(1)}%`,
                  netPnl: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`,
                  dollars: `${dollars >= 0 ? "+" : ""}$${dollars.toFixed(0)}`,
                }
              );
            }
          }
          // If price unchanged, silently skip to prevent UI flashing
        } else {
          // No valid data at all - log warning
          console.warn(`[useActiveTradePnL] Received invalid data for ${normalizedTicker}`, {
            source: transportSource,
            dataKeys: Object.keys(data),
            bid: data.bid,
            ask: data.ask,
            last: data.last,
            bp: data.bp,
            ap: data.ap,
            p: data.p,
          });
        }
      },
      { isOption: true }
    );

    return unsubscribe;
  }, [normalizedTicker, entryPrice, quantity, tradeId]);

  // Return the fresher timestamp (from transport OR store polling service)
  return {
    currentPrice,
    bid,
    ask,
    last,
    pnlPercent,
    pnlDollars,
    asOf: effectiveAsOf,
    source,
    isStale,
  };
}

// Hook for checking API connection status
export function useMarketDataConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [hasApiKeyAvailable, setHasApiKeyAvailable] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const health = massive.getHealth();
      if (cancelled) return;
      setHasApiKeyAvailable(health.rest.healthy || health.token.isValid);
      setIsConnected(massive.isConnected());
      setLastError(health.rest.lastError);
    };

    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { isConnected, hasApiKey: hasApiKeyAvailable, lastError };
}

export function useMassiveClient() {
  return massive;
}
