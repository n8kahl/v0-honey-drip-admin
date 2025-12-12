import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Trade, TradeState, Contract, TradeUpdate, OptionType, TradeType } from "../types";
import {
  getTrades,
  createTrade as dbCreateTrade,
  updateTrade as dbUpdateTrade,
  deleteTrade as dbDeleteTrade,
} from "../lib/supabase/database";
import { ensureArray } from "../lib/utils/validation";

// ============================================================================
// TRADE STORE - SINGLE SOURCE OF TRUTH
// ============================================================================
//
// Architecture:
// - Database is THE ultimate source of truth
// - Store mirrors database state + provides derived selectors
// - Components read from store, never maintain duplicate state
// - All mutations go through store actions → database → reload
//
// Key concepts:
// - currentTradeId: Which trade is focused (ID only)
// - previewTrade: Temporary WATCHING trade being previewed (not yet in DB)
// - activeTrades: LOADED + ENTERED trades (from DB)
// - historyTrades: EXITED trades (from DB)
// - Derived selectors compute values from these base states
// ============================================================================

interface TradeStore {
  // State - Single Source of Truth
  activeTrades: Trade[]; // LOADED + ENTERED trades (from DB)
  historyTrades: Trade[]; // EXITED trades (from DB)
  currentTradeId: string | null; // ID of focused trade
  previewTrade: Trade | null; // Temporary trade being previewed (WATCHING state, not yet in DB)
  contracts: Contract[];
  updatedTradeIds: Set<string>;
  isLoading: boolean;
  error: string | null;

  // Derived Selectors (computed from base state)
  getCurrentTrade: () => Trade | null;
  getTradeState: () => TradeState;
  getLoadedTrades: () => Trade[];
  getEnteredTrades: () => Trade[];

  // Actions - State Setters
  setActiveTrades: (trades: Trade[]) => void;
  setHistoryTrades: (trades: Trade[]) => void;
  setCurrentTradeId: (id: string | null) => void;
  setPreviewTrade: (trade: Trade | null) => void;
  setContracts: (contracts: Contract[]) => void;
  setUpdatedTradeIds: (ids: Set<string>) => void;

  // CRUD operations
  createTrade: (userId: string, trade: Partial<Trade>) => Promise<void>;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => Promise<void>;
  deleteTrade: (tradeId: string) => Promise<void>;
  loadTrades: (userId: string) => Promise<void>;

  // Trade updates
  addTradeUpdate: (tradeId: string, update: TradeUpdate) => void;
  addTradeUpdateToDb: (
    userId: string,
    tradeId: string,
    update: Partial<TradeUpdate>
  ) => Promise<void>;

  // Discord/Challenge linking
  linkTradeToChannels: (tradeId: string, channelIds: string[]) => Promise<void>;
  unlinkTradeFromChannel: (tradeId: string, channelId: string) => Promise<void>;
  linkTradeToChallenges: (tradeId: string, challengeIds: string[]) => Promise<void>;
  unlinkTradeFromChallenge: (tradeId: string, challengeId: string) => Promise<void>;
  updateTradeChallenges: (userId: string, tradeId: string, challengeIds: string[]) => Promise<void>;

  // Utilities
  getTradeById: (tradeId: string) => Trade | undefined;
  markTradeAsUpdated: (tradeId: string) => void;
  clearUpdatedFlags: () => void;

  // Reset
  reset: () => void;
}

const mapStatusToState = (status: string): TradeState => {
  switch (status?.toLowerCase()) {
    case "watching":
      return "WATCHING";
    case "loaded":
      return "LOADED";
    case "entered":
      return "ENTERED";
    case "exited":
      return "EXITED";
    default:
      return "WATCHING";
  }
};

export const useTradeStore = create<TradeStore>()(
  devtools(
    (set, get) => ({
      // ========================================
      // Initial State
      // ========================================
      activeTrades: [],
      historyTrades: [],
      currentTradeId: null,
      previewTrade: null,
      contracts: [],
      updatedTradeIds: new Set(),
      isLoading: false,
      error: null,

      // ========================================
      // Derived Selectors
      // ========================================

      // Get the currently focused trade (from activeTrades, historyTrades, or previewTrade)
      getCurrentTrade: () => {
        const { currentTradeId, activeTrades, historyTrades, previewTrade } = get();

        // If we have a preview trade and it matches, return it
        if (previewTrade && (!currentTradeId || previewTrade.id === currentTradeId)) {
          return previewTrade;
        }

        if (!currentTradeId) return null;

        // Look in active trades first
        const activeTrade = activeTrades.find((t) => t.id === currentTradeId);
        if (activeTrade) return activeTrade;

        // Then check history
        return historyTrades.find((t) => t.id === currentTradeId) || null;
      },

      // Get the state of the current trade
      getTradeState: () => {
        const { previewTrade } = get();
        const currentTrade = get().getCurrentTrade();

        // Preview trade is always WATCHING
        if (previewTrade && currentTrade?.id === previewTrade.id) {
          return "WATCHING";
        }

        return currentTrade?.state || "WATCHING";
      },

      // Get all LOADED trades
      getLoadedTrades: () => {
        return get().activeTrades.filter((t) => t.state === "LOADED");
      },

      // Get all ENTERED trades
      getEnteredTrades: () => {
        return get().activeTrades.filter((t) => t.state === "ENTERED");
      },

      // ========================================
      // Simple Setters
      // ========================================
      setActiveTrades: (trades) => set({ activeTrades: trades }),
      setHistoryTrades: (trades) => set({ historyTrades: trades }),
      setCurrentTradeId: (id) => set({ currentTradeId: id }),
      setPreviewTrade: (trade) => set({ previewTrade: trade }),
      setContracts: (contracts) => set({ contracts }),
      setUpdatedTradeIds: (ids) => set({ updatedTradeIds: ids }),

      // ========================================
      // CRUD Operations
      // ========================================
      createTrade: async (userId, tradeData) => {
        set({ isLoading: true, error: null });
        try {
          const newTrade = await dbCreateTrade(userId, tradeData as any);
          // Use stored contract if available, otherwise reconstruct from basic fields
          const storedContract = newTrade.contract as any;
          const contract = storedContract || {
            id: `${newTrade.ticker}-${newTrade.strike}-${newTrade.expiration}`,
            strike: parseFloat(newTrade.strike),
            expiry: newTrade.expiration,
            expiryDate: new Date(newTrade.expiration),
            daysToExpiry: Math.ceil(
              (new Date(newTrade.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
            type: (newTrade.contract_type === "call" ? "C" : "P") as OptionType,
            mid: 0,
            bid: 0,
            ask: 0,
            volume: 0,
            openInterest: 0,
          };

          const mappedTrade: Trade = {
            id: newTrade.id,
            ticker: newTrade.ticker,
            contract,
            state: mapStatusToState(newTrade.state),
            tradeType: "Day" as TradeType,
            updates: [],
            discordChannels: [],
            challenges: newTrade.challenge_id ? [newTrade.challenge_id] : [],
          };

          set((state) => ({
            activeTrades: [...state.activeTrades, mappedTrade],
            currentTradeId: mappedTrade.id, // Focus on the new trade
            previewTrade: null, // Clear preview
            isLoading: false,
          }));
        } catch (error) {
          console.error("[TradeStore] Failed to create trade:", error);
          set({ error: "Failed to create trade", isLoading: false });
        }
      },

      updateTrade: async (tradeId, updates) => {
        console.warn(`[TradeStore] updateTrade called for ${tradeId}:`, updates);
        set({ isLoading: true, error: null });
        try {
          // First update local state
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId ? { ...t, ...updates } : t
            ),
            historyTrades: state.historyTrades.map((t) =>
              t.id === tradeId ? { ...t, ...updates } : t
            ),
            isLoading: false,
          }));

          // Filter updates to only include fields that exist in the database schema
          const dbFields = [
            "entry_price",
            "exit_price",
            "entry_time",
            "exit_time",
            "pnl",
            "pnl_percent",
            "notes",
            "target_price",
            "stop_loss",
            "current_price",
            "move_percent",
            "state",
            "status",
          ];
          const dbUpdates: Record<string, any> = {};
          for (const [key, value] of Object.entries(updates)) {
            // Convert camelCase to snake_case for DB fields
            const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            if (dbFields.includes(snakeKey) && value !== undefined) {
              dbUpdates[snakeKey] = value;
            }
          }

          console.warn(`[TradeStore] DB updates for ${tradeId}:`, dbUpdates);

          // Only try DB update if we have valid fields to update
          if (Object.keys(dbUpdates).length > 0) {
            try {
              await dbUpdateTrade(tradeId, dbUpdates as any);
              console.warn(`[TradeStore] ✅ Trade ${tradeId} successfully updated in database`);
            } catch (dbError: any) {
              console.error(
                `[TradeStore] ❌ CRITICAL: Failed to update trade ${tradeId} in database:`,
                dbError
              );
              set({ error: `Failed to sync trade: ${dbError.message || "Unknown error"}` });
              throw dbError;
            }
          } else {
            console.warn(`[TradeStore] No database fields to update for trade ${tradeId}`);
          }
        } catch (error) {
          console.error("[TradeStore] Failed to update trade:", error);
          set({ error: "Failed to update trade", isLoading: false });
          throw error;
        }
      },

      deleteTrade: async (tradeId) => {
        set({ isLoading: true, error: null });
        try {
          // Clear currentTradeId if it matches
          const { currentTradeId } = get();

          // First remove from local state
          set((state) => ({
            activeTrades: state.activeTrades.filter((t) => t.id !== tradeId),
            historyTrades: state.historyTrades.filter((t) => t.id !== tradeId),
            currentTradeId: currentTradeId === tradeId ? null : currentTradeId,
            previewTrade: state.previewTrade?.id === tradeId ? null : state.previewTrade,
            isLoading: false,
          }));

          // Try to delete from database (may fail for in-memory trades)
          try {
            await dbDeleteTrade(tradeId);
          } catch (dbError: any) {
            // Only log if not a "not found" error
            if (!dbError?.message?.includes("No rows") && !dbError?.code?.includes("PGRST116")) {
              console.warn("[TradeStore] DB delete failed (trade may be in-memory only):", dbError);
            }
          }
        } catch (error) {
          console.error("[TradeStore] Failed to delete trade:", error);
          set({ error: "Failed to delete trade", isLoading: false });
        }
      },

      loadTrades: async (userId) => {
        console.warn(`[TradeStore] loadTrades called for userId: ${userId}`);
        set({ isLoading: true, error: null });
        try {
          const tradesData = await getTrades(userId);
          console.warn(`[TradeStore] Loaded ${tradesData.length} trades from database`);

          const mappedTrades: Trade[] = tradesData.map((t) => {
            // Use stored contract if available
            const storedContract = t.contract as any;
            const contract = storedContract || {
              id: `${t.ticker}-${t.strike}-${t.expiration}`,
              strike: parseFloat(t.strike),
              expiry: t.expiration,
              expiryDate: new Date(t.expiration),
              daysToExpiry: Math.ceil(
                (new Date(t.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              ),
              type: (t.contract_type === "call" ? "C" : "P") as OptionType,
              mid: 0,
              bid: 0,
              ask: 0,
              volume: 0,
              openInterest: 0,
            };

            // Extract discord channel IDs from junction table data
            const discordChannelRows = Array.isArray((t as any).trades_discord_channels)
              ? (t as any).trades_discord_channels
              : [];
            const discordChannels = discordChannelRows
              .map((row: { discord_channel_id: string }) => row?.discord_channel_id)
              .filter((id: string | undefined): id is string => typeof id === "string");

            // Extract challenge IDs from junction table data
            const challengeRows = Array.isArray((t as any).trades_challenges)
              ? (t as any).trades_challenges
              : [];
            const challenges = challengeRows
              .map((row: { challenge_id: string }) => row?.challenge_id)
              .filter((id: string | undefined): id is string => typeof id === "string");

            // Map trade_updates from snake_case to camelCase
            const rawUpdates = Array.isArray(t.trade_updates) ? t.trade_updates : [];
            const mappedUpdates: TradeUpdate[] = rawUpdates.map((u: any) => ({
              id: u.id,
              type: u.type,
              timestamp: u.timestamp ? new Date(u.timestamp) : new Date(u.created_at),
              message: u.message || "",
              price: u.price ? parseFloat(u.price) : 0,
              pnlPercent: u.pnl_percent ? parseFloat(u.pnl_percent) : undefined,
            }));

            // Calculate movePercent
            let movePercent = (t as any).move_percent
              ? parseFloat((t as any).move_percent)
              : undefined;
            if (movePercent === undefined && t.entry_price && t.exit_price) {
              const entry = parseFloat(t.entry_price);
              const exit = parseFloat(t.exit_price);
              if (entry > 0) {
                movePercent = ((exit - entry) / entry) * 100;
              }
            }

            return {
              id: t.id,
              ticker: t.ticker,
              contract,
              entryPrice: t.entry_price ? parseFloat(t.entry_price) : undefined,
              exitPrice: t.exit_price ? parseFloat(t.exit_price) : undefined,
              entryTime: t.entry_time ? new Date(t.entry_time) : undefined,
              exitTime: t.exit_time ? new Date(t.exit_time) : undefined,
              currentPrice: t.entry_price ? parseFloat(t.entry_price) : undefined,
              targetPrice: (t as any).target_price
                ? parseFloat((t as any).target_price)
                : undefined,
              stopLoss: (t as any).stop_loss ? parseFloat((t as any).stop_loss) : undefined,
              movePercent,
              state: mapStatusToState(t.state),
              updates: mappedUpdates,
              tradeType: "Day" as TradeType,
              discordChannels,
              challenges:
                challenges.length > 0 ? challenges : t.challenge_id ? [t.challenge_id] : [],
              setupType: (t as any).setup_type || undefined,
              confluence: (t as any).confluence || undefined,
              confluenceUpdatedAt: (t as any).confluence_updated_at
                ? new Date((t as any).confluence_updated_at)
                : undefined,
            };
          });

          const active = mappedTrades.filter((t) => t.state !== "EXITED");
          const history = mappedTrades.filter((t) => t.state === "EXITED");

          console.warn(`[TradeStore] Mapped trades:`, {
            total: mappedTrades.length,
            active: active.length,
            history: history.length,
            activeStates: active.map((t) => ({ id: t.id, ticker: t.ticker, state: t.state })),
          });

          set({
            activeTrades: active,
            historyTrades: history,
            isLoading: false,
          });
        } catch (error) {
          console.error("[TradeStore] Failed to load trades:", error);
          set({ error: "Failed to load trades", isLoading: false });
        }
      },

      // ========================================
      // Trade Updates
      // ========================================
      addTradeUpdate: (tradeId, update) => {
        set((state) => ({
          activeTrades: state.activeTrades.map((t) =>
            t.id === tradeId ? { ...t, updates: [...(t.updates || []), update] } : t
          ),
        }));
      },

      addTradeUpdateToDb: async (userId, tradeId, update) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/updates`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId,
            },
            body: JSON.stringify({
              type: update.type,
              price: update.price,
              message: update.message || "",
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to create trade update");
          }

          // Update local state after successful DB insert
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    updates: [
                      ...(t.updates || []),
                      {
                        id: crypto.randomUUID(),
                        type: update.type!,
                        timestamp: new Date(),
                        price: update.price || 0,
                        message: update.message || "",
                      },
                    ],
                  }
                : t
            ),
            historyTrades: state.historyTrades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    updates: [
                      ...(t.updates || []),
                      {
                        id: crypto.randomUUID(),
                        type: update.type!,
                        timestamp: new Date(),
                        price: update.price || 0,
                        message: update.message || "",
                      },
                    ],
                  }
                : t
            ),
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to add trade update to DB:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // ========================================
      // Discord/Challenge Linking
      // ========================================
      linkTradeToChannels: async (tradeId, channelIds) => {
        try {
          const promises = channelIds.map((channelId) =>
            fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
              method: "POST",
              headers: { "x-user-id": "" },
            })
          );

          const responses = await Promise.all(promises);

          for (const response of responses) {
            if (!response.ok) {
              throw new Error(`Failed to link channel: ${response.status}`);
            }
          }

          // Update local state
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    discordChannels: [
                      ...new Set([...ensureArray(t.discordChannels), ...channelIds]),
                    ],
                  }
                : t
            ),
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to link channels:", error);
          set({ error: error.message });
          throw error;
        }
      },

      unlinkTradeFromChannel: async (tradeId, channelId) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
            method: "DELETE",
            headers: { "x-user-id": "" },
          });

          if (!response.ok) {
            throw new Error(`Failed to unlink channel: ${response.status}`);
          }

          // Update local state
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    discordChannels: ensureArray(t.discordChannels).filter((c) => c !== channelId),
                  }
                : t
            ),
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to unlink channel:", error);
          set({ error: error.message });
          throw error;
        }
      },

      linkTradeToChallenges: async (tradeId, challengeIds) => {
        try {
          const promises = challengeIds.map((challengeId) =>
            fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
              method: "POST",
              headers: { "x-user-id": "" },
            })
          );

          const responses = await Promise.all(promises);

          for (const response of responses) {
            if (!response.ok) {
              throw new Error(`Failed to link challenge: ${response.status}`);
            }
          }

          // Update local state
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    challenges: [...new Set([...ensureArray(t.challenges), ...challengeIds])],
                  }
                : t
            ),
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to link challenges:", error);
          set({ error: error.message });
          throw error;
        }
      },

      unlinkTradeFromChallenge: async (tradeId, challengeId) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
            method: "DELETE",
            headers: { "x-user-id": "" },
          });

          if (!response.ok) {
            throw new Error(`Failed to unlink challenge: ${response.status}`);
          }

          // Update local state
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    challenges: ensureArray(t.challenges).filter((c) => c !== challengeId),
                  }
                : t
            ),
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to unlink challenge:", error);
          set({ error: error.message });
          throw error;
        }
      },

      updateTradeChallenges: async (userId, tradeId, challengeIds) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/challenges`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId,
            },
            body: JSON.stringify({ challengeIds }),
          });

          if (!response.ok) {
            throw new Error(`Failed to update challenges: ${response.status}`);
          }

          // Update local state
          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId ? { ...t, challenges: challengeIds } : t
            ),
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to update trade challenges:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // ========================================
      // Utilities
      // ========================================
      getTradeById: (tradeId) => {
        const { activeTrades, historyTrades, previewTrade } = get();
        if (previewTrade?.id === tradeId) return previewTrade;
        return [...activeTrades, ...historyTrades].find((t) => t.id === tradeId);
      },

      markTradeAsUpdated: (tradeId) => {
        set((state) => {
          const newSet = new Set(state.updatedTradeIds);
          newSet.add(tradeId);
          return { updatedTradeIds: newSet };
        });
      },

      clearUpdatedFlags: () => {
        set({ updatedTradeIds: new Set() });
      },

      // ========================================
      // Reset
      // ========================================
      reset: () =>
        set({
          activeTrades: [],
          historyTrades: [],
          currentTradeId: null,
          previewTrade: null,
          contracts: [],
          updatedTradeIds: new Set(),
          isLoading: false,
          error: null,
        }),
    }),
    { name: "TradeStore" }
  )
);
