import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Trade, TradeState, Contract, TradeUpdate, OptionType, TradeType } from "../types";
import {
  getTrades,
  createTrade as dbCreateTrade,
  updateTrade as dbUpdateTrade,
  deleteTrade as dbDeleteTrade,
} from "../lib/supabase/database";
import { createClient } from "../lib/supabase/client";
import { ensureArray } from "../lib/utils/validation";
import { tradeStoreLogger as log } from "../lib/utils/logger";

/**
 * Get authentication headers for API calls
 * Uses JWT from Supabase session for proper authentication
 */
async function getApiHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    log.warn("Failed to get auth session for API headers");
  }

  return headers;
}

/**
 * Merge trades by ID, keeping the most advanced state.
 * This prevents duplicates when optimistic updates race with loadTrades().
 *
 * State priority: WATCHING < LOADED < ENTERED < EXITED
 * If incoming state >= existing state, incoming wins (DB is source of truth)
 */
function mergeTradesByIdKeepLatest(existing: Trade[], incoming: Trade[]): Trade[] {
  const stateOrder: Record<string, number> = {
    WATCHING: 0,
    LOADED: 1,
    ENTERED: 2,
    EXITED: 3,
  };
  const map = new Map<string, Trade>();

  // Add existing first
  for (const trade of existing) {
    map.set(trade.id, trade);
  }

  // Merge incoming - keep more advanced state, or update if same/newer state
  for (const trade of incoming) {
    const current = map.get(trade.id);
    if (!current) {
      map.set(trade.id, trade);
    } else {
      const currentOrder = stateOrder[current.state] ?? 0;
      const incomingOrder = stateOrder[trade.state] ?? 0;
      // Keep the more advanced state, OR update if same state (DB is source of truth)
      if (incomingOrder >= currentOrder) {
        map.set(trade.id, trade);
      }
    }
  }

  return Array.from(map.values());
}

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

  // UI State (centralized to prevent race conditions)
  ui: {
    isTransitioning: boolean; // True when a state transition is in progress
  };

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

  // Atomic action to set focused trade (prevents race conditions)
  setFocusedTrade: (trade: Trade | null) => void;

  // UI State setters
  setIsTransitioning: (value: boolean) => void;

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

      // UI State (centralized)
      ui: {
        isTransitioning: false,
      },

      // ========================================
      // Derived Selectors
      // ========================================

      // Get the currently focused trade (from activeTrades, historyTrades, or previewTrade)
      getCurrentTrade: () => {
        const { currentTradeId, activeTrades, historyTrades, previewTrade } = get();

        // If we have a currentTradeId, look it up in persisted trades FIRST
        // This ensures that clicking an active trade shows the correct (LOADED/ENTERED) state
        // rather than falling back to a stale preview trade
        if (currentTradeId) {
          const activeTrade = activeTrades.find((t) => t.id === currentTradeId);
          if (activeTrade) return activeTrade;

          const historyTrade = historyTrades.find((t) => t.id === currentTradeId);
          if (historyTrade) return historyTrade;
        }

        // Only fall back to previewTrade if no persisted trade found with that ID
        if (previewTrade && (!currentTradeId || previewTrade.id === currentTradeId)) {
          return previewTrade;
        }

        return null;
      },

      // Get the state of the current trade
      // Priority: persisted trades first (LOADED/ENTERED/EXITED), then preview trade
      // FIX: Only return WATCHING if previewTrade IS the current trade
      getTradeState: () => {
        const { previewTrade, currentTradeId, activeTrades, historyTrades } = get();

        // Priority 1: Check persisted trades first - their state is authoritative
        if (currentTradeId) {
          const activeTrade = activeTrades.find((t) => t.id === currentTradeId);
          if (activeTrade) return activeTrade.state;

          const historyTrade = historyTrades.find((t) => t.id === currentTradeId);
          if (historyTrade) return historyTrade.state;
        }

        // Priority 2: Only return WATCHING if previewTrade IS the current trade
        // This prevents showing WATCHING buttons when currentTradeId points to a persisted trade
        // that hasn't loaded into activeTrades yet
        if (previewTrade) {
          // If no currentTradeId is set, previewTrade is authoritative
          if (!currentTradeId) return "WATCHING";

          // If currentTradeId matches previewTrade, it's still a preview
          if (previewTrade.id === currentTradeId) return "WATCHING";

          // If currentTradeId is set to something else, DON'T return WATCHING
          // The trade may be loading - safer to check previewTrade's state or default
          // to a transitional state that won't show setup buttons
          return previewTrade.state || "WATCHING";
        }

        // Default - no trade focused
        return "WATCHING";
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

      // Atomic action to set focused trade - updates BOTH previewTrade and currentTradeId
      // in a single set() call to prevent race conditions where they diverge
      setFocusedTrade: (trade) => {
        if (trade) {
          // If it's a WATCHING trade (preview), set as previewTrade
          if (trade.state === "WATCHING") {
            log.debug("setFocusedTrade: Setting preview trade", {
              tradeId: trade.id,
              ticker: trade.ticker,
            });
            set({ previewTrade: trade, currentTradeId: trade.id });
          } else {
            // For persisted trades (LOADED, ENTERED, EXITED), clear preview and set currentTradeId
            log.debug("setFocusedTrade: Setting persisted trade focus", {
              tradeId: trade.id,
              state: trade.state,
            });
            set({ previewTrade: null, currentTradeId: trade.id });
          }
        } else {
          // Clear focus
          log.debug("setFocusedTrade: Clearing focus");
          set({ previewTrade: null, currentTradeId: null });
        }
      },

      // UI State setter - centralized to prevent race conditions
      setIsTransitioning: (value) => {
        log.debug("setIsTransitioning", { value });
        set((state) => ({ ui: { ...state.ui, isTransitioning: value } }));
      },

      // ========================================
      // CRUD Operations
      // ========================================
      createTrade: async (userId, tradeData) => {
        const correlationId = log.actionStart("createTrade", {
          ticker: tradeData.ticker,
          state: tradeData.state,
        });
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

          log.actionEnd("createTrade", correlationId, {
            tradeId: mappedTrade.id,
            ticker: mappedTrade.ticker,
            state: mappedTrade.state,
          });
        } catch (error) {
          log.actionFail("createTrade", correlationId, error, { ticker: tradeData.ticker });
          set({ error: "Failed to create trade", isLoading: false });
        }
      },

      updateTrade: async (tradeId, updates) => {
        const correlationId = log.actionStart("updateTrade", {
          tradeId,
          updateFields: Object.keys(updates),
          newState: updates.state,
        });
        set({ isLoading: true, error: null });
        try {
          // Log state transition if state is changing
          if (updates.state) {
            const currentTrade = get().getTradeById(tradeId);
            if (currentTrade && currentTrade.state !== updates.state) {
              log.transition(currentTrade.state, updates.state, {
                tradeId,
                ticker: currentTrade.ticker,
              });
            }
          }

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

          log.debug("DB updates prepared", { tradeId, dbUpdates, correlationId });

          // Only try DB update if we have valid fields to update
          if (Object.keys(dbUpdates).length > 0) {
            try {
              await dbUpdateTrade(tradeId, dbUpdates as any);
              log.actionEnd("updateTrade", correlationId, {
                tradeId,
                fieldsUpdated: Object.keys(dbUpdates),
              });
            } catch (dbError: any) {
              log.actionFail("updateTrade", correlationId, dbError, { tradeId });
              set({ error: `Failed to sync trade: ${dbError.message || "Unknown error"}` });
              throw dbError;
            }
          } else {
            log.debug("No database fields to update", { tradeId, correlationId });
            log.actionEnd("updateTrade", correlationId, { tradeId, fieldsUpdated: [] });
          }
        } catch (error) {
          log.actionFail("updateTrade", correlationId, error, { tradeId });
          set({ error: "Failed to update trade", isLoading: false });
          throw error;
        }
      },

      deleteTrade: async (tradeId) => {
        const correlationId = log.actionStart("deleteTrade", { tradeId });
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
            log.actionEnd("deleteTrade", correlationId, { tradeId });
          } catch (dbError: unknown) {
            const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
            const errCode = (dbError as { code?: string })?.code;
            // Only log if not a "not found" error
            if (!errMsg?.includes("No rows") && !errCode?.includes("PGRST116")) {
              log.warn("DB delete failed (trade may be in-memory only)", {
                tradeId,
                error: errMsg,
              });
            } else {
              log.debug("Trade was in-memory only, no DB delete needed", { tradeId });
            }
          }
        } catch (error) {
          log.actionFail("deleteTrade", correlationId, error, { tradeId });
          set({ error: "Failed to delete trade", isLoading: false });
        }
      },

      loadTrades: async (userId) => {
        // GUARD: Skip if already loading to prevent race conditions from concurrent loads
        if (get().isLoading) {
          log.debug("loadTrades skipped: already loading");
          return;
        }

        const correlationId = log.actionStart("loadTrades", { userId });
        set({ isLoading: true, error: null });
        try {
          const tradesData = await getTrades(userId);
          log.debug("Raw trades loaded from database", { count: tradesData.length, correlationId });

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

          // Log a snapshot of the loaded state
          log.snapshot("Trades loaded", {
            total: mappedTrades.length,
            active: active.length,
            history: history.length,
            activeByState: {
              WATCHING: active.filter((t) => t.state === "WATCHING").length,
              LOADED: active.filter((t) => t.state === "LOADED").length,
              ENTERED: active.filter((t) => t.state === "ENTERED").length,
            },
            activeTickers: active.map((t) => `${t.ticker}:${t.state}`),
          });

          // Use merge to prevent race conditions with optimistic updates
          // This ensures trades added by handleLoadAndAlert don't get lost/duplicated
          set((state) => ({
            activeTrades: mergeTradesByIdKeepLatest(state.activeTrades, active),
            historyTrades: mergeTradesByIdKeepLatest(state.historyTrades, history),
            isLoading: false,
          }));

          log.actionEnd("loadTrades", correlationId, {
            activeCount: active.length,
            historyCount: history.length,
          });
        } catch (error) {
          log.actionFail("loadTrades", correlationId, error, { userId });
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
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error("Failed to add trade update to DB", { tradeId, error: errMsg });
          set({ error: errMsg });
          throw error;
        }
      },

      // ========================================
      // Discord/Challenge Linking
      // ========================================
      linkTradeToChannels: async (tradeId, channelIds) => {
        log.debug("Linking trade to channels", { tradeId, channelIds });
        try {
          const headers = await getApiHeaders();
          const promises = channelIds.map((channelId) =>
            fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
              method: "POST",
              headers,
            }).then((response) => ({ channelId, response }))
          );

          // Use Promise.allSettled to handle partial failures gracefully
          const results = await Promise.allSettled(promises);

          const succeeded: string[] = [];
          const failed: string[] = [];

          for (const result of results) {
            if (result.status === "fulfilled" && result.value.response.ok) {
              succeeded.push(result.value.channelId);
            } else {
              const channelId = result.status === "fulfilled" ? result.value.channelId : "unknown";
              failed.push(channelId);
            }
          }

          if (failed.length > 0) {
            log.warn("Some channel links failed", { tradeId, succeeded, failed });
          }

          // Update local state with successfully linked channels
          if (succeeded.length > 0) {
            set((state) => ({
              activeTrades: state.activeTrades.map((t) =>
                t.id === tradeId
                  ? {
                      ...t,
                      discordChannels: [
                        ...new Set([...ensureArray(t.discordChannels), ...succeeded]),
                      ],
                    }
                  : t
              ),
            }));
          }

          // Only throw if ALL links failed
          if (succeeded.length === 0 && channelIds.length > 0) {
            throw new Error(`Failed to link any channels`);
          }
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error("Failed to link channels", { tradeId, channelIds, error: errMsg });
          set({ error: errMsg });
          throw error;
        }
      },

      unlinkTradeFromChannel: async (tradeId, channelId) => {
        log.debug("Unlinking trade from channel", { tradeId, channelId });
        try {
          const headers = await getApiHeaders();
          const response = await fetch(`/api/trades/${tradeId}/channels/${channelId}`, {
            method: "DELETE",
            headers,
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
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error("Failed to unlink channel", { tradeId, channelId, error: errMsg });
          set({ error: errMsg });
          throw error;
        }
      },

      linkTradeToChallenges: async (tradeId, challengeIds) => {
        log.debug("Linking trade to challenges", { tradeId, challengeIds });
        try {
          const headers = await getApiHeaders();
          const promises = challengeIds.map((challengeId) =>
            fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
              method: "POST",
              headers,
            }).then((response) => ({ challengeId, response }))
          );

          // Use Promise.allSettled to handle partial failures gracefully
          const results = await Promise.allSettled(promises);

          const succeeded: string[] = [];
          const failed: string[] = [];

          for (const result of results) {
            if (result.status === "fulfilled" && result.value.response.ok) {
              succeeded.push(result.value.challengeId);
            } else {
              const challengeId =
                result.status === "fulfilled" ? result.value.challengeId : "unknown";
              failed.push(challengeId);
            }
          }

          if (failed.length > 0) {
            log.warn("Some challenge links failed", { tradeId, succeeded, failed });
          }

          // Update local state with successfully linked challenges
          if (succeeded.length > 0) {
            set((state) => ({
              activeTrades: state.activeTrades.map((t) =>
                t.id === tradeId
                  ? {
                      ...t,
                      challenges: [...new Set([...ensureArray(t.challenges), ...succeeded])],
                    }
                  : t
              ),
            }));
          }

          // Only throw if ALL links failed
          if (succeeded.length === 0 && challengeIds.length > 0) {
            throw new Error(`Failed to link any challenges`);
          }
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error("Failed to link challenges", { tradeId, challengeIds, error: errMsg });
          set({ error: errMsg });
          throw error;
        }
      },

      unlinkTradeFromChallenge: async (tradeId, challengeId) => {
        log.debug("Unlinking trade from challenge", { tradeId, challengeId });
        try {
          const headers = await getApiHeaders();
          const response = await fetch(`/api/trades/${tradeId}/challenges/${challengeId}`, {
            method: "DELETE",
            headers,
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
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error("Failed to unlink challenge", { tradeId, challengeId, error: errMsg });
          set({ error: errMsg });
          throw error;
        }
      },

      updateTradeChallenges: async (_userId, tradeId, challengeIds) => {
        log.debug("Updating trade challenges", { tradeId, challengeIds });
        try {
          const headers = await getApiHeaders();
          const response = await fetch(`/api/trades/${tradeId}/challenges`, {
            method: "PUT",
            headers,
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
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          log.error("Failed to update trade challenges", { tradeId, challengeIds, error: errMsg });
          set({ error: errMsg });
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
          ui: {
            isTransitioning: false,
          },
        }),
    }),
    { name: "TradeStore" }
  )
);
