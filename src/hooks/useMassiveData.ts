import { useState, useEffect, useCallback, useRef } from "react";
import { massive, type MassiveQuote, type MassiveOptionsChain } from "../lib/massive";
import { MassiveError } from "../lib/massive/proxy";
import { createTransport } from "../lib/massive/transport-policy";
import type { Contract } from "../types";
import { fetchNormalizedChain } from "../services/options";
import { fetchQuotes as fetchUnifiedQuotes } from "../services/quotes";
import { useMarketDataStore } from "../stores/marketDataStore";
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

  // Get marketDataStore setter to keep symbol timestamps in sync
  const setSymbolTimestamp = useMarketDataStore((state) => state.symbols);

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
      try {
        const symbolData = setSymbolTimestamp[update.symbol];
        if (symbolData) {
          useMarketDataStore.setState((state) => ({
            symbols: {
              ...state.symbols,
              [update.symbol]: {
                ...symbolData,
                lastUpdated: Date.now(),
              },
            },
          }));
        }
      } catch (e) {
        // Ignore if symbol not in store
      }

      setError(null);
    },
    [setSymbolTimestamp]
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

      const unsubscribe = createTransport(
        symbol,
        (data, source, timestamp) => {
          console.log(`[useQuotes] Received ${source} update for ${symbol}:`, data);
          handleUpdate(data, source, timestamp);
        },
        {
          isOption: false, // CRITICAL: Explicitly set to false for stock/index quotes
          isIndex,
          pollInterval: 3000,
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
  const lastDbUpdateRef = useRef<number>(0); // Track last database write time (NEW - for P&L accuracy)

  // Stale detection: data older than 10 seconds is considered stale
  const STALE_THRESHOLD_MS = 10_000;
  const isStale = Date.now() - asOf > STALE_THRESHOLD_MS;

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

    console.log("[useActiveTradePnL] Starting PnL tracking for contract:", normalizedTicker);

    const unsubscribe = createTransport(
      normalizedTicker,
      (data, transportSource, timestamp) => {
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

            // NEW: Update database with latest price (debounced to every 10 seconds)
            // Only update if we have a real trade ID (skip for WATCHING state previews)
            const now = Date.now();
            if (tradeId && now - lastDbUpdateRef.current > 10000) {
              lastDbUpdateRef.current = now;
              // Dynamic import to avoid circular dependency
              import("../stores/tradeStore").then(({ useTradeStore }) => {
                useTradeStore
                  .getState()
                  .updateTrade(tradeId, {
                    // IMPORTANT: Use camelCase - store.updateTrade converts to snake_case for DB
                    lastOptionPrice: price > 0 ? price : undefined, // Only persist if valid
                    lastOptionPriceAt: new Date(timestamp),
                    priceDataSource: transportSource,
                  })
                  .catch((err) =>
                    console.warn(`[useActiveTradePnL] DB update failed for trade ${tradeId}:`, err)
                  );
              });
            }

            console.log(`[useActiveTradePnL] ${transportSource} update for ${normalizedTicker}:`, {
              price: price > 0 ? `$${price.toFixed(2)}` : "N/A",
              bid: nextBid > 0 ? `$${nextBid.toFixed(2)}` : "N/A",
              ask: nextAsk > 0 ? `$${nextAsk.toFixed(2)}` : "N/A",
              grossPnl: `${grossPnl >= 0 ? "+" : ""}${grossPnl.toFixed(1)}%`,
              netPnl: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`,
              dollars: `${dollars >= 0 ? "+" : ""}$${dollars.toFixed(0)}`,
            });
          }
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
      { isOption: true, pollInterval: 3000 }
    );

    return unsubscribe;
  }, [normalizedTicker, entryPrice, quantity, tradeId]);

  return { currentPrice, bid, ask, last, pnlPercent, pnlDollars, asOf, source, isStale };
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
