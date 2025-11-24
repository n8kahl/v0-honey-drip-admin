import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Ticker } from "../types";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "../lib/supabase/database";
import { toast } from "sonner";

export interface MarketQuote {
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  asOf?: number;
  source?: "websocket" | "rest";
}

interface MarketStore {
  // State
  watchlist: Ticker[];
  quotes: Map<string, MarketQuote>;
  selectedTicker: Ticker | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setWatchlist: (tickers: Ticker[]) => void;
  setQuotes: (quotes: Map<string, MarketQuote>) => void;
  setSelectedTicker: (ticker: Ticker | null) => void;

  // Watchlist operations
  addTicker: (userId: string, ticker: Ticker) => Promise<void>;
  removeTicker: (tickerId: string) => Promise<void>;
  loadWatchlist: (userId: string) => Promise<void>;

  // Quote operations
  updateQuotes: (quotes: Map<string, MarketQuote>) => void;
  updateQuote: (symbol: string, quote: MarketQuote) => void;
  getQuote: (symbol: string) => MarketQuote | undefined;

  // Utilities
  getWatchlistSymbols: () => string[];
  findTickerBySymbol: (symbol: string) => Ticker | undefined;

  // Reset
  reset: () => void;
}

export const useMarketStore = create<MarketStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      watchlist: [],
      quotes: new Map(),
      selectedTicker: null,
      isLoading: false,
      error: null,

      // Simple setters
      setWatchlist: (watchlist) => set({ watchlist }),
      setQuotes: (quotes) => set({ quotes }),
      setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),

      // Watchlist operations
      addTicker: async (userId, ticker) => {
        // Normalize and guard
        const raw = (ticker?.symbol ?? "").trim();
        if (!raw) {
          set({ error: "Symbol is required" });
          toast.error("Please enter a symbol");
          return;
        }
        const symbol = raw.toUpperCase();

        // Duplicate check
        const exists = get().watchlist.some((t) => t.symbol === symbol);
        if (exists) {
          toast.info(`${symbol} is already in your watchlist`);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          // Insert into DB; use returned row to ensure real id
          const row = await addToWatchlist(userId, symbol);

          const newTicker: Ticker = {
            id: row.id,
            symbol: (row.symbol ?? row.ticker ?? symbol).toUpperCase(),
            last: 0,
            change: 0,
            changePercent: 0,
          };

          set((state) => ({
            watchlist: [...state.watchlist, newTicker],
            isLoading: false,
          }));
          toast.success(`${newTicker.symbol} added to watchlist`);
        } catch (error: unknown) {
          console.error("[MarketStore] Failed to add ticker:", error);
          const err = error as { code?: string; status?: string; name?: string; message?: string };
          const code = err?.code || err?.status || err?.name;
          if (code === "23505") {
            // Unique violation
            toast.info(`${symbol} is already in your watchlist`);
            set({ isLoading: false });
            return;
          }
          set({ error: "Failed to add ticker", isLoading: false });
          toast.error("Failed to add ticker");
        }
      },

      removeTicker: async (tickerId) => {
        set({ isLoading: true, error: null });
        try {
          await removeFromWatchlist(tickerId);

          set((state) => ({
            watchlist: state.watchlist.filter((t) => t.id !== tickerId),
            isLoading: false,
          }));
          toast.success("Removed from watchlist");
        } catch (error) {
          console.error("[MarketStore] Failed to remove ticker:", error);
          set({ error: "Failed to remove ticker", isLoading: false });
          toast.error("Failed to remove ticker");
        }
      },

      loadWatchlist: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          const watchlistData = await getWatchlist(userId);
          const tickers: Ticker[] = watchlistData.map((w) => ({
            id: w.id,
            symbol: (w.symbol ?? w.ticker ?? "").toUpperCase(),
            last: 0,
            change: 0,
            changePercent: 0,
          }));

          set({ watchlist: tickers, isLoading: false });
        } catch (error) {
          console.error("[MarketStore] Failed to load watchlist:", error);
          set({ error: "Failed to load watchlist", isLoading: false });
        }
      },

      // Quote operations
      updateQuotes: (quotes) => {
        console.log("[MarketStore] updateQuotes called with", quotes.size, "quotes");
        quotes.forEach((q, symbol) => {
          console.log(
            `[MarketStore]   ${symbol}: last=$${q.last}, change=${q.change}, changePercent=${q.changePercent}%`
          );
        });

        // Combine both updates into a single state mutation
        set((state) => ({
          quotes,
          // Sync quote data to watchlist tickers
          watchlist: state.watchlist.map((ticker) => {
            const quote = quotes.get(ticker.symbol);
            if (quote) {
              console.log(
                `[MarketStore] Updating ${ticker.symbol}: $${ticker.last} → $${quote.last} (${quote.changePercent}%)`
              );
              return {
                ...ticker,
                last: quote.last,
                change: quote.change,
                changePercent: quote.changePercent,
              };
            }
            return ticker;
          }),
        }));
      },

      updateQuote: (symbol, quote) => {
        set((state) => {
          const newQuotes = new Map(state.quotes);
          newQuotes.set(symbol, quote);

          return {
            quotes: newQuotes,
            watchlist: state.watchlist.map((ticker) =>
              ticker.symbol === symbol
                ? {
                    ...ticker,
                    last: quote.last,
                    change: quote.change,
                    changePercent: quote.changePercent,
                  }
                : ticker
            ),
          };
        });
      },

      getQuote: (symbol) => {
        return get().quotes.get(symbol);
      },

      // Utilities
      getWatchlistSymbols: () => {
        return get().watchlist.map((t) => t.symbol);
      },

      findTickerBySymbol: (symbol) => {
        return get().watchlist.find((t) => t.symbol === symbol);
      },

      // Reset
      reset: () =>
        set({
          watchlist: [],
          quotes: new Map(),
          selectedTicker: null,
          isLoading: false,
          error: null,
        }),
    }),
    { name: "MarketStore" }
  )
);
