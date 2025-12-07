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

interface TradeStore {
  // State
  activeTrades: Trade[];
  historyTrades: Trade[];
  currentTrade: Trade | null;
  tradeState: TradeState;
  contracts: Contract[];
  updatedTradeIds: Set<string>;
  isLoading: boolean;
  error: string | null;

  // Actions
  setActiveTrades: (trades: Trade[]) => void;
  setHistoryTrades: (trades: Trade[]) => void;
  setCurrentTrade: (trade: Trade | null) => void;
  setTradeState: (state: TradeState) => void;
  setContracts: (contracts: Contract[]) => void;
  setUpdatedTradeIds: (ids: Set<string>) => void;

  // CRUD operations
  createTrade: (userId: string, trade: Partial<Trade>) => Promise<void>;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => Promise<void>;
  deleteTrade: (tradeId: string) => Promise<void>;
  loadTrades: (userId: string) => Promise<void>;

  // Trade lifecycle transitions
  transitionToLoaded: (contract: Contract) => void;
  transitionToEntered: (entryPrice: number, quantity: number) => void;
  transitionToExited: (exitPrice: number) => void;

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
  getLoadedTrades: () => Trade[];
  getEnteredTrades: () => Trade[];
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

const mapStateToStatus = (state: TradeState): string => {
  return state.toLowerCase();
};

export const useTradeStore = create<TradeStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      activeTrades: [],
      historyTrades: [],
      currentTrade: null,
      tradeState: "WATCHING",
      contracts: [],
      updatedTradeIds: new Set(),
      isLoading: false,
      error: null,

      // Simple setters
      setActiveTrades: (trades) => set({ activeTrades: trades }),
      setHistoryTrades: (trades) => set({ historyTrades: trades }),
      setCurrentTrade: (trade) => set({ currentTrade: trade }),
      setTradeState: (state) => set({ tradeState: state }),
      setContracts: (contracts) => set({ contracts }),
      setUpdatedTradeIds: (ids) => set({ updatedTradeIds: ids }),

      // CRUD operations
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
            state: mapStatusToState(newTrade.status),
            tradeType: "Day" as TradeType,
            updates: [],
            discordChannels: [],
            challenges: newTrade.challenge_id ? [newTrade.challenge_id] : [],
          };

          set((state) => ({
            activeTrades: [...state.activeTrades, mappedTrade],
            isLoading: false,
          }));
        } catch (error) {
          console.error("[TradeStore] Failed to create trade:", error);
          set({ error: "Failed to create trade", isLoading: false });
        }
      },

      updateTrade: async (tradeId, updates) => {
        set({ isLoading: true, error: null });
        try {
          await dbUpdateTrade(tradeId, updates as any);

          set((state) => ({
            activeTrades: state.activeTrades.map((t) =>
              t.id === tradeId ? { ...t, ...updates } : t
            ),
            historyTrades: state.historyTrades.map((t) =>
              t.id === tradeId ? { ...t, ...updates } : t
            ),
            currentTrade:
              state.currentTrade?.id === tradeId
                ? { ...state.currentTrade, ...updates }
                : state.currentTrade,
            isLoading: false,
          }));
        } catch (error) {
          console.error("[TradeStore] Failed to update trade:", error);
          set({ error: "Failed to update trade", isLoading: false });
        }
      },

      deleteTrade: async (tradeId) => {
        set({ isLoading: true, error: null });
        try {
          await dbDeleteTrade(tradeId);

          set((state) => ({
            activeTrades: state.activeTrades.filter((t) => t.id !== tradeId),
            historyTrades: state.historyTrades.filter((t) => t.id !== tradeId),
            currentTrade: state.currentTrade?.id === tradeId ? null : state.currentTrade,
            isLoading: false,
          }));
        } catch (error) {
          console.error("[TradeStore] Failed to delete trade:", error);
          set({ error: "Failed to delete trade", isLoading: false });
        }
      },

      loadTrades: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          const tradesData = await getTrades(userId);
          const mappedTrades: Trade[] = tradesData.map((t) => {
            // Use stored contract if available, otherwise reconstruct from basic fields
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
            const discordChannelRows = (t as any).trades_discord_channels || [];
            const discordChannels = discordChannelRows.map(
              (row: { discord_channel_id: string }) => row.discord_channel_id
            );

            // Extract challenge IDs from junction table data
            const challengeRows = (t as any).trades_challenges || [];
            const challenges = challengeRows.map(
              (row: { challenge_id: string }) => row.challenge_id
            );

            // Map trade_updates from snake_case DB format to camelCase TradeUpdate interface
            const rawUpdates = t.trade_updates || [];
            const mappedUpdates: TradeUpdate[] = rawUpdates.map((u: any) => ({
              id: u.id,
              type: u.type,
              timestamp: u.timestamp ? new Date(u.timestamp) : new Date(u.created_at),
              message: u.message || "",
              price: u.price ? parseFloat(u.price) : 0,
              pnlPercent: u.pnl_percent ? parseFloat(u.pnl_percent) : undefined,
            }));

            // Calculate movePercent from entry/exit prices if not stored in DB
            // This handles legacy trades that were exited before we started storing move_percent
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
              state: mapStatusToState(t.status),
              updates: mappedUpdates,
              tradeType: "Day" as TradeType,
              discordChannels,
              challenges:
                challenges.length > 0 ? challenges : t.challenge_id ? [t.challenge_id] : [],
              // Restore confluence and setup type from database
              setupType: (t as any).setup_type || undefined,
              confluence: (t as any).confluence || undefined,
              confluenceUpdatedAt: (t as any).confluence_updated_at
                ? new Date((t as any).confluence_updated_at)
                : undefined,
            };
          });

          const active = mappedTrades.filter((t) => t.state !== "EXITED");
          const history = mappedTrades.filter((t) => t.state === "EXITED");

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

      // Trade lifecycle transitions
      transitionToLoaded: (contract) => {
        const { currentTrade } = get();
        if (!currentTrade) {
          console.warn("[TradeStore] Cannot transition to LOADED: no current trade");
          return;
        }

        const loadedTrade: Trade = {
          ...currentTrade,
          contract,
          state: "LOADED",
        };

        set((state) => ({
          currentTrade: loadedTrade,
          tradeState: "LOADED",
          activeTrades: [...state.activeTrades.filter((t) => t.id !== loadedTrade.id), loadedTrade],
        }));
      },

      transitionToEntered: (entryPrice, _quantity) => {
        const { currentTrade } = get();
        if (!currentTrade || currentTrade.state !== "LOADED") {
          console.warn("[TradeStore] Cannot transition to ENTERED: invalid state");
          return;
        }

        const updatedTrade: Trade = {
          ...currentTrade,
          entryPrice,
          currentPrice: entryPrice,
          entryTime: new Date(),
          state: "ENTERED",
        };

        set((state) => ({
          currentTrade: updatedTrade,
          tradeState: "ENTERED",
          activeTrades: state.activeTrades.map((t) =>
            t.id === updatedTrade.id ? updatedTrade : t
          ),
        }));
      },

      transitionToExited: (exitPrice) => {
        const { currentTrade } = get();
        if (!currentTrade || currentTrade.state !== "ENTERED") {
          console.warn("[TradeStore] Cannot transition to EXITED: invalid state");
          return;
        }

        const exitTime = new Date();
        const movePercent = currentTrade.entryPrice
          ? ((exitPrice - currentTrade.entryPrice) / currentTrade.entryPrice) * 100
          : 0;

        const exitedTrade: Trade = {
          ...currentTrade,
          exitPrice,
          exitTime,
          movePercent,
          state: "EXITED",
        };

        set((state) => ({
          currentTrade: null,
          tradeState: "WATCHING",
          activeTrades: state.activeTrades.filter((t) => t.id !== exitedTrade.id),
          historyTrades: [exitedTrade, ...state.historyTrades],
        }));
      },

      // Trade updates
      addTradeUpdate: (tradeId, update) => {
        set((state) => ({
          activeTrades: state.activeTrades.map((t) =>
            t.id === tradeId ? { ...t, updates: [...(t.updates || []), update] } : t
          ),
        }));
      },

      // Async: Create trade update in database
      addTradeUpdateToDb: async (userId, tradeId, update) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/updates`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId,
            },
            body: JSON.stringify({
              action: update.type,
              price: update.price,
              notes: update.message || "",
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to create trade update");
          }

          // Update local state after successful DB insert
          const { activeTrades, historyTrades } = get();
          const trade = [...activeTrades, ...historyTrades].find((t) => t.id === tradeId);

          if (trade) {
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
          }
        } catch (error: any) {
          console.error("[TradeStore] Failed to add trade update to DB:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // Async: Link trade to Discord channels
      linkTradeToChannels: async (tradeId, channelIds) => {
        try {
          const promises = channelIds.map((channelId) =>
            fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
              method: "POST",
              headers: {
                "x-user-id": "", // Will be set by hook
              },
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
            currentTrade:
              state.currentTrade?.id === tradeId
                ? {
                    ...state.currentTrade,
                    discordChannels: [
                      ...new Set([
                        ...ensureArray(state.currentTrade.discordChannels),
                        ...channelIds,
                      ]),
                    ],
                  }
                : state.currentTrade,
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to link channels:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // Async: Unlink trade from Discord channel
      unlinkTradeFromChannel: async (tradeId, channelId) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
            method: "DELETE",
            headers: {
              "x-user-id": "", // Will be set by hook
            },
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
            currentTrade:
              state.currentTrade?.id === tradeId
                ? {
                    ...state.currentTrade,
                    discordChannels: ensureArray(state.currentTrade.discordChannels).filter(
                      (c) => c !== channelId
                    ),
                  }
                : state.currentTrade,
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to unlink channel:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // Async: Link trade to challenges
      linkTradeToChallenges: async (tradeId, challengeIds) => {
        try {
          const promises = challengeIds.map((challengeId) =>
            fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
              method: "POST",
              headers: {
                "x-user-id": "", // Will be set by hook
              },
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
            currentTrade:
              state.currentTrade?.id === tradeId
                ? {
                    ...state.currentTrade,
                    challenges: [
                      ...new Set([...ensureArray(state.currentTrade.challenges), ...challengeIds]),
                    ],
                  }
                : state.currentTrade,
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to link challenges:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // Async: Unlink trade from challenge
      unlinkTradeFromChallenge: async (tradeId, challengeId) => {
        try {
          const response = await fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
            method: "DELETE",
            headers: {
              "x-user-id": "", // Will be set by hook
            },
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
            currentTrade:
              state.currentTrade?.id === tradeId
                ? {
                    ...state.currentTrade,
                    challenges: ensureArray(state.currentTrade.challenges).filter(
                      (c) => c !== challengeId
                    ),
                  }
                : state.currentTrade,
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
            currentTrade:
              state.currentTrade?.id === tradeId
                ? { ...state.currentTrade, challenges: challengeIds }
                : state.currentTrade,
          }));
        } catch (error: any) {
          console.error("[TradeStore] Failed to update trade challenges:", error);
          set({ error: error.message });
          throw error;
        }
      },

      // Utilities
      getTradeById: (tradeId) => {
        const { activeTrades, historyTrades } = get();
        return [...activeTrades, ...historyTrades].find((t) => t.id === tradeId);
      },

      getLoadedTrades: () => {
        return get().activeTrades.filter((t) => t.state === "LOADED");
      },

      getEnteredTrades: () => {
        return get().activeTrades.filter((t) => t.state === "ENTERED");
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

      // Reset
      reset: () =>
        set({
          activeTrades: [],
          historyTrades: [],
          currentTrade: null,
          tradeState: "WATCHING",
          contracts: [],
          updatedTradeIds: new Set(),
          isLoading: false,
          error: null,
        }),
    }),
    { name: "TradeStore" }
  )
);
