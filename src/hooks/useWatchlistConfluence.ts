/**
 * useWatchlistConfluence.ts - Aggregate confluence for all watchlist symbols
 *
 * Maps over the user's watchlist, calculates confluence for each symbol,
 * and returns sorted results with "hot" symbol detection.
 *
 * NOTE: This hook works even when marketDataStore doesn't have candle data.
 * It falls back to displaying watchlist symbols with placeholder confluence data.
 */

import { useMemo } from "react";
import { useMarketStore } from "../stores/marketStore";
import { useMarketDataStore } from "../stores/marketDataStore";
import { type SymbolConfluence } from "./useSymbolConfluence";

// ============================================================================
// Types
// ============================================================================

export type SortMode = "score" | "alphabetical" | "change" | "hot";
export type FilterMode = "all" | "hot" | "scalp" | "day" | "swing";

export interface WatchlistConfluenceOptions {
  sortBy?: SortMode;
  filterBy?: FilterMode;
  includeIndices?: boolean; // Include SPX, NDX, VIX even if not in watchlist
}

export interface WatchlistConfluenceResult {
  symbols: SymbolConfluence[];
  hotSymbols: string[];
  readySymbols: string[];
  avgScore: number;
  isLoading: boolean;
  lastUpdated: number;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useWatchlistConfluence(
  options: WatchlistConfluenceOptions = {}
): WatchlistConfluenceResult {
  const { sortBy = "score", filterBy = "all", includeIndices = true } = options;

  // Get watchlist from marketStore (includes quotes/prices)
  const watchlist = useMarketStore((state) => state.watchlist);
  const isWatchlistLoading = useMarketStore((state) => state.isLoading);
  const hasLoadedWatchlist = useMarketStore((state) => state.hasLoadedWatchlist);

  // Get all symbol data from marketDataStore (candles, indicators, confluence)
  const allSymbolsData = useMarketDataStore((state) => state.symbols);
  const macroSymbols = useMarketDataStore((state) => state.macroSymbols);

  // Calculate confluence for all symbols
  const result = useMemo(() => {
    // Build symbol list from watchlist (primary source) + indices
    const symbolsToProcess = new Map<
      string,
      { price: number; change: number; changePercent: number }
    >();

    // Add watchlist symbols with their quote data
    watchlist.forEach((ticker) => {
      const symbol = ticker.symbol.toUpperCase();
      symbolsToProcess.set(symbol, {
        price: ticker.last || 0,
        change: ticker.change || 0,
        changePercent: ticker.changePercent || 0,
      });
    });

    // Add macro/index symbols if requested AND we have at least one watchlist symbol
    // This prevents showing only indices when the watchlist hasn't loaded yet
    if (includeIndices && watchlist.length > 0) {
      macroSymbols.forEach((symbol) => {
        if (!symbolsToProcess.has(symbol)) {
          // Try to get price from marketDataStore
          const symbolData = allSymbolsData[symbol];
          const candles1m = symbolData?.candles?.["1m"] || [];
          const lastCandle = candles1m[candles1m.length - 1];
          symbolsToProcess.set(symbol, {
            price: lastCandle?.close || 0,
            change: 0,
            changePercent: 0,
          });
        }
      });
    }

    const symbols: SymbolConfluence[] = [];
    let totalScore = 0;
    let symbolCount = 0;
    let latestUpdate = 0;

    symbolsToProcess.forEach((quoteData, symbol) => {
      const symbolData = allSymbolsData[symbol];

      // Get price - prefer candle data if available, fallback to watchlist quote
      let price = quoteData.price;
      let change = quoteData.change;
      let changePercent = quoteData.changePercent;

      // If we have candle data, use it for more accurate price
      if (symbolData?.candles?.["1m"]?.length > 0) {
        const candles1m = symbolData.candles["1m"];
        const lastCandle = candles1m[candles1m.length - 1];
        const prevCandle = candles1m.length > 1 ? candles1m[candles1m.length - 2] : null;
        if (lastCandle) {
          price = lastCandle.close;
          if (prevCandle) {
            change = price - prevCandle.close;
            changePercent = prevCandle.close > 0 ? (change / prevCandle.close) * 100 : 0;
          }
        }
      }

      // Use store confluence score if available, otherwise calculate a placeholder
      const storeConfluence = symbolData?.confluence;
      const overallScore = storeConfluence?.overall || 0;

      // Determine threshold
      const isIndex = ["SPX", "NDX", "VIX"].includes(symbol);
      const threshold = isIndex ? 80 : 75;

      // Count MTF alignment (default to neutral if no data)
      const mtfTrend = symbolData?.mtfTrend || {
        "1m": "neutral",
        "5m": "neutral",
        "15m": "neutral",
        "60m": "neutral",
      };
      const bullCount = Object.values(mtfTrend).filter((t) => t === "bull").length;
      const bearCount = Object.values(mtfTrend).filter((t) => t === "bear").length;
      const mtfAligned = Math.max(bullCount, bearCount);

      // Determine best style based on timeframe alignment
      let bestStyle: "scalp" | "day" | "swing" = "day";
      if (mtfTrend["1m"] !== "neutral" && mtfTrend["5m"] !== "neutral") {
        bestStyle = "scalp";
      } else if (mtfTrend["15m"] !== "neutral" && mtfTrend["60m"] !== "neutral") {
        bestStyle = "swing";
      }

      const confluence: SymbolConfluence = {
        symbol,
        price,
        change,
        changePercent,
        factors: [], // Populated by useSymbolConfluence when row is expanded
        mtf: (["1m", "5m", "15m", "60m"] as const).map((tf) => ({
          timeframe: tf,
          direction: mtfTrend[tf] === "bull" ? "up" : mtfTrend[tf] === "bear" ? "down" : "neutral",
          label: tf,
        })),
        mtfAligned,
        mtfTotal: 4,
        overallScore,
        threshold,
        isHot: overallScore >= threshold * 0.9,
        isReady: overallScore >= threshold,
        bestStyle,
        styleScores: {
          scalp: bestStyle === "scalp" ? overallScore * 1.1 : overallScore * 0.9,
          day: overallScore,
          swing: bestStyle === "swing" ? overallScore * 1.1 : overallScore * 0.9,
        },
        lastUpdated: symbolData?.lastUpdated || Date.now(),
      };

      symbols.push(confluence);
      totalScore += overallScore;
      symbolCount++;
      if (symbolData?.lastUpdated) {
        latestUpdate = Math.max(latestUpdate, symbolData.lastUpdated);
      }
    });

    // Apply filter
    let filteredSymbols = symbols;
    switch (filterBy) {
      case "hot":
        filteredSymbols = symbols.filter((s) => s.isHot);
        break;
      case "scalp":
        filteredSymbols = symbols.filter((s) => s.bestStyle === "scalp");
        break;
      case "day":
        filteredSymbols = symbols.filter((s) => s.bestStyle === "day");
        break;
      case "swing":
        filteredSymbols = symbols.filter((s) => s.bestStyle === "swing");
        break;
    }

    // Apply sort
    switch (sortBy) {
      case "score":
        filteredSymbols.sort((a, b) => b.overallScore - a.overallScore);
        break;
      case "alphabetical":
        filteredSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
      case "change":
        filteredSymbols.sort((a, b) => b.changePercent - a.changePercent);
        break;
      case "hot":
        // Hot first, then by score
        filteredSymbols.sort((a, b) => {
          if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
          if (a.isHot !== b.isHot) return a.isHot ? -1 : 1;
          return b.overallScore - a.overallScore;
        });
        break;
    }

    const hotSymbols = symbols.filter((s) => s.isHot).map((s) => s.symbol);
    const readySymbols = symbols.filter((s) => s.isReady).map((s) => s.symbol);
    const avgScore = symbolCount > 0 ? totalScore / symbolCount : 0;

    return {
      symbols: filteredSymbols,
      hotSymbols,
      readySymbols,
      avgScore,
      // Show loading if:
      // 1. Watchlist is currently being fetched from Supabase
      // 2. OR watchlist hasn't been fetched yet (first load pending)
      // 3. OR we have watchlist items but no symbol data processed yet
      isLoading:
        isWatchlistLoading || !hasLoadedWatchlist || (watchlist.length > 0 && symbolCount === 0),
      lastUpdated: latestUpdate || Date.now(),
    };
  }, [
    watchlist,
    allSymbolsData,
    macroSymbols,
    sortBy,
    filterBy,
    includeIndices,
    isWatchlistLoading,
    hasLoadedWatchlist,
  ]);

  return result;
}

/**
 * Hook to get just the hot symbols for badge indicators
 */
export function useHotSymbols(): string[] {
  const allSymbolsData = useMarketDataStore((state) => state.symbols);

  return useMemo(() => {
    const hotSymbols: string[] = [];

    Object.entries(allSymbolsData).forEach(([symbol, data]) => {
      const isIndex = ["SPX", "NDX", "VIX"].includes(symbol);
      const threshold = isIndex ? 80 : 75;
      const score = data.confluence?.overall || 0;

      if (score >= threshold * 0.9) {
        hotSymbols.push(symbol);
      }
    });

    return hotSymbols;
  }, [allSymbolsData]);
}

/**
 * Hook to check if a specific symbol is hot
 */
export function useIsSymbolHot(symbol: string): boolean {
  const symbolData = useMarketDataStore((state) => state.symbols[symbol?.toUpperCase()]);

  return useMemo(() => {
    if (!symbolData) return false;

    const isIndex = ["SPX", "NDX", "VIX"].includes(symbol.toUpperCase());
    const threshold = isIndex ? 80 : 75;
    const score = symbolData.confluence?.overall || 0;

    return score >= threshold * 0.9;
  }, [symbol, symbolData]);
}

export default useWatchlistConfluence;
