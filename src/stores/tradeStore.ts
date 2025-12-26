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
import { getEntryUpdate } from "../lib/tradePnl";
import {
  reconcileTradeLists,
  assertTradeListsValid,
  type TradeListsInput,
} from "../domain/tradeLifecycle";
import { fetchBars } from "../services/bars";

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

  // Atomic patch operation - applies updates and ensures trade is in correct list
  applyTradePatch: (tradeId: string, patch: Partial<Trade>) => Trade | null;

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

/**
 * Check if a contract ID is a valid OCC symbol format
 * Valid format: O:SPY250117C00622000 (starts with "O:" followed by symbol, date, type, strike)
 */
function isValidOCCSymbol(id: string | undefined | null): boolean {
  if (!id || typeof id !== "string") return false;
  // OCC symbols start with "O:" and are typically 20+ characters
  return id.startsWith("O:") && id.length >= 18;
}

/**
 * Generate OCC symbol from trade data for legacy trades without contract.id
 * Format: O:SPY250117C00622000 (O:SYMBOL+YYMMDD+C/P+strike*1000 padded to 8 digits)
 */
function generateOCCSymbol(
  ticker: string,
  expiry: string,
  type: "call" | "put" | "C" | "P",
  strike: number
): string {
  // Parse expiry date (expects YYYY-MM-DD format)
  const expiryDate = new Date(expiry);
  const yy = String(expiryDate.getFullYear()).slice(-2);
  const mm = String(expiryDate.getMonth() + 1).padStart(2, "0");
  const dd = String(expiryDate.getDate()).padStart(2, "0");

  // Normalize option type to single char
  const optionType = type === "call" || type === "C" ? "C" : "P";

  // Strike price * 1000, padded to 8 digits
  const strikeInt = Math.round(strike * 1000);
  const strikePadded = String(strikeInt).padStart(8, "0");

  return `O:${ticker}${yy}${mm}${dd}${optionType}${strikePadded}`;
}

const EXPIRATION_CLOSE_TIME_ET = "T16:00:00-05:00";
const EXPIRATION_LOOKBACK_DAYS = 7;

function getExpirationDateTime(expirationISO: string): Date {
  return new Date(`${expirationISO}${EXPIRATION_CLOSE_TIME_ET}`);
}

function isContractExpired(expirationISO: string, now = new Date()): boolean {
  return now >= getExpirationDateTime(expirationISO);
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calculateIntrinsicValue(
  type: OptionType | string | undefined,
  strike: number,
  underlyingPrice: number
): number {
  const isCall = type === "C" || type === "call";
  const raw = isCall ? underlyingPrice - strike : strike - underlyingPrice;
  return Math.max(0, raw);
}

async function getUnderlyingCloseAtOrBefore(
  symbol: string,
  expirationISO: string,
  cache: Map<string, number>
): Promise<number | null> {
  const cacheKey = `${symbol}:${expirationISO}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return Number.isFinite(cached) ? cached : null;
  }

  try {
    const sameDay = await fetchBars(symbol, "day", 1, expirationISO, expirationISO, 5);
    if (sameDay.bars.length > 0) {
      const close = sameDay.bars[sameDay.bars.length - 1].close;
      cache.set(cacheKey, close);
      return close;
    }
  } catch (error) {
    log.warn("Failed to fetch same-day bars for expiration", {
      symbol,
      expirationISO,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const lookback = new Date(expirationISO);
  lookback.setDate(lookback.getDate() - EXPIRATION_LOOKBACK_DAYS);
  const from = formatDateISO(lookback);

  try {
    const rangeBars = await fetchBars(symbol, "day", 1, from, expirationISO, 20);
    if (rangeBars.bars.length > 0) {
      const close = rangeBars.bars[rangeBars.bars.length - 1].close;
      cache.set(cacheKey, close);
      return close;
    }
  } catch (error) {
    log.warn("Failed to fetch lookback bars for expiration", {
      symbol,
      expirationISO,
      from,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  cache.set(cacheKey, NaN);
  return null;
}

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
      // Simple Setters (with invariant validation in dev mode)
      // ========================================
      setActiveTrades: (trades) => {
        set({ activeTrades: trades });
        // Validate invariants in development
        if (process.env.NODE_ENV === "development") {
          const state = get();
          assertTradeListsValid(
            {
              activeTrades: trades,
              historyTrades: state.historyTrades,
              previewTrade: state.previewTrade,
            },
            "setActiveTrades"
          );
        }
      },
      setHistoryTrades: (trades) => {
        set({ historyTrades: trades });
        // Validate invariants in development
        if (process.env.NODE_ENV === "development") {
          const state = get();
          assertTradeListsValid(
            {
              activeTrades: state.activeTrades,
              historyTrades: trades,
              previewTrade: state.previewTrade,
            },
            "setHistoryTrades"
          );
        }
      },
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

          const entryBackfills: Array<{ id: string; entryPrice?: number; entryTime?: Date }> = [];
          const mappedTrades: Trade[] = tradesData.map((t) => {
            // Use stored contract if available
            const storedContract = t.contract as any;
            const strike = parseFloat(t.strike);
            const optionType = (t.contract_type === "call" ? "C" : "P") as OptionType;

            // Generate proper OCC symbol for live P&L tracking
            // ALWAYS generate it - we'll use it if stored ID is missing or invalid
            const generatedOCCSymbol = generateOCCSymbol(
              t.ticker,
              t.expiration,
              optionType,
              strike
            );

            // Use stored ID only if it's a valid OCC symbol, otherwise use generated one
            const storedIdValid = isValidOCCSymbol(storedContract?.id);
            const contractId = storedIdValid ? storedContract.id : generatedOCCSymbol;

            // Debug log for OCC symbol generation
            if (!storedIdValid) {
              log.debug(`[loadTrades] Generated OCC symbol for ${t.ticker}`, {
                storedId: storedContract?.id || "(none)",
                generatedId: generatedOCCSymbol,
                strike,
                expiry: t.expiration,
                type: optionType,
              });
            }

            const contract = storedContract
              ? { ...storedContract, id: contractId }
              : {
                  id: contractId,
                  strike,
                  expiry: t.expiration,
                  expiryDate: new Date(t.expiration),
                  daysToExpiry: Math.ceil(
                    (new Date(t.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  ),
                  type: optionType,
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
              trimPercent: u.trim_percent ? parseFloat(u.trim_percent) : undefined,
            }));
            const entryUpdate = getEntryUpdate(mappedUpdates);
            const entryUpdatePrice = entryUpdate?.price;
            const entryUpdateTime = entryUpdate?.timestamp;
            const entryPriceValue = t.entry_price ? parseFloat(t.entry_price) : undefined;
            const entryTimeValue = t.entry_time ? new Date(t.entry_time) : undefined;
            const entryPrice = entryPriceValue ?? entryUpdatePrice;
            const entryTime = entryTimeValue ?? entryUpdateTime;
            if (
              (entryPriceValue === undefined && entryUpdatePrice) ||
              (entryTimeValue === undefined && entryUpdateTime)
            ) {
              entryBackfills.push({
                id: t.id,
                entryPrice: entryUpdatePrice,
                entryTime: entryUpdateTime,
              });
            }

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

            // FIX: currentPrice should prefer DB current_price, fallback to entry_price
            // Bug was: currentPrice: t.entry_price (always used entry, ignored DB current_price)
            const currentPriceRaw = (t as any).current_price ?? t.entry_price ?? entryPrice;
            const currentPrice = currentPriceRaw ? parseFloat(currentPriceRaw) : undefined;

            return {
              id: t.id,
              ticker: t.ticker,
              contract,
              entryPrice,
              exitPrice: t.exit_price ? parseFloat(t.exit_price) : undefined,
              entryTime,
              exitTime: t.exit_time ? new Date(t.exit_time) : undefined,
              currentPrice,
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
              // NEW: Entry snapshot (immutable)
              entry_bid: (t as any).entry_bid ? parseFloat((t as any).entry_bid) : undefined,
              entry_ask: (t as any).entry_ask ? parseFloat((t as any).entry_ask) : undefined,
              entry_mid: (t as any).entry_mid ? parseFloat((t as any).entry_mid) : undefined,
              entry_timestamp: (t as any).entry_timestamp
                ? new Date((t as any).entry_timestamp)
                : undefined,
              // NEW: Live price tracking (mutable)
              last_option_price: (t as any).last_option_price
                ? parseFloat((t as any).last_option_price)
                : undefined,
              last_option_price_at: (t as any).last_option_price_at
                ? new Date((t as any).last_option_price_at)
                : undefined,
              price_data_source: (t as any).price_data_source as
                | "websocket"
                | "rest"
                | "closing"
                | "snapshot"
                | undefined,
            };
          });

          entryBackfills.forEach((backfill) => {
            const updates: Record<string, any> = {};
            if (backfill.entryPrice !== undefined) {
              updates.entry_price = backfill.entryPrice;
            }
            if (backfill.entryTime) {
              updates.entry_time = backfill.entryTime.toISOString();
            }
            if (Object.keys(updates).length > 0) {
              dbUpdateTrade(backfill.id, updates as any).catch((error) => {
                log.warn("Failed to backfill entry details", {
                  tradeId: backfill.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            }
          });

          const now = new Date();
          const underlyingCloseCache = new Map<string, number>();
          const expiredLoadedTrades: Trade[] = [];
          const expiredEnteredTrades: Trade[] = [];
          const keptTrades: Trade[] = [];

          for (const trade of mappedTrades) {
            const expiration = trade.contract?.expiry || trade.contract?.expiration;
            if (!expiration || !isContractExpired(expiration, now)) {
              keptTrades.push(trade);
              continue;
            }

            if (trade.state === "LOADED") {
              expiredLoadedTrades.push(trade);
              continue;
            }

            if (trade.state === "ENTERED") {
              expiredEnteredTrades.push(trade);
              continue;
            }

            keptTrades.push(trade);
          }

          const expiredEnteredResolved = await Promise.all(
            expiredEnteredTrades.map(async (trade) => {
              const expiration = trade.contract?.expiry || trade.contract?.expiration;
              if (!expiration) return trade;

              const expiryTime = getExpirationDateTime(expiration);
              let exitPrice = trade.exitPrice;
              if (exitPrice === undefined) {
                const underlyingClose = await getUnderlyingCloseAtOrBefore(
                  trade.ticker,
                  expiration,
                  underlyingCloseCache
                );
                if (underlyingClose != null && Number.isFinite(underlyingClose)) {
                  exitPrice = calculateIntrinsicValue(
                    trade.contract.type,
                    trade.contract.strike,
                    underlyingClose
                  );
                } else {
                  log.warn("Unable to resolve intrinsic value for expired trade", {
                    tradeId: trade.id,
                    ticker: trade.ticker,
                    expiration,
                  });
                  exitPrice = 0;
                }
              }

              const movePercent =
                trade.entryPrice && exitPrice !== undefined
                  ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
                  : trade.movePercent;

              return {
                ...trade,
                state: "EXITED",
                exitPrice,
                exitTime: trade.exitTime || expiryTime,
                currentPrice: exitPrice,
                movePercent,
              };
            })
          );

          const mappedTradesFinal = [...keptTrades, ...expiredEnteredResolved];

          if (expiredLoadedTrades.length > 0) {
            expiredLoadedTrades.forEach((trade) => {
              dbDeleteTrade(trade.id).catch((error) => {
                log.warn("Failed to delete expired loaded trade", {
                  tradeId: trade.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            });
          }

          if (expiredEnteredResolved.length > 0) {
            expiredEnteredResolved.forEach((trade) => {
              dbUpdateTrade(trade.id, {
                state: "EXITED",
                exit_price: trade.exitPrice ?? 0,
                exit_time: trade.exitTime ? trade.exitTime.toISOString() : undefined,
                current_price: trade.exitPrice ?? undefined,
                move_percent: trade.movePercent ?? undefined,
              }).catch((error) => {
                log.warn("Failed to sync expired trade exit", {
                  tradeId: trade.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            });
          }

          // Log a snapshot of the loaded state
          log.snapshot("Trades loaded from DB", {
            total: mappedTradesFinal.length,
            byState: {
              WATCHING: mappedTradesFinal.filter((t) => t.state === "WATCHING").length,
              LOADED: mappedTradesFinal.filter((t) => t.state === "LOADED").length,
              ENTERED: mappedTradesFinal.filter((t) => t.state === "ENTERED").length,
              EXITED: mappedTradesFinal.filter((t) => t.state === "EXITED").length,
            },
            tickers: mappedTradesFinal.map((t) => `${t.ticker}:${t.state}`),
          });

          // FIX: Use reconcileTradeLists instead of independent merge
          // OLD BUG (lines 606-608): mergeTradesByIdKeepLatest on activeTrades and historyTrades
          // independently could leave an EXITED trade in activeTrades while also in historyTrades.
          // reconcileTradeLists ensures each trade ID appears in EXACTLY ONE list based on state.
          set((state) => {
            const existingLists: TradeListsInput = {
              activeTrades: state.activeTrades,
              historyTrades: state.historyTrades,
              previewTrade: state.previewTrade,
            };

            const reconciled = reconcileTradeLists(existingLists, mappedTradesFinal);

            // Validate invariants in development
            assertTradeListsValid(reconciled, "loadTrades");

            log.debug("Trade lists reconciled", {
              correlationId,
              activeCount: reconciled.activeTrades.length,
              historyCount: reconciled.historyTrades.length,
              previewCleared:
                existingLists.previewTrade !== null && reconciled.previewTrade === null,
            });

            return {
              activeTrades: reconciled.activeTrades,
              historyTrades: reconciled.historyTrades,
              previewTrade: reconciled.previewTrade,
              isLoading: false,
            };
          });

          log.actionEnd("loadTrades", correlationId, {
            dbTradesCount: mappedTradesFinal.length,
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
      // Atomic Patch Operation
      // ========================================
      /**
       * applyTradePatch - Atomically applies a patch to a trade and moves it to the correct list
       *
       * This is the canonical way to update a trade after a state transition.
       * It ensures:
       * 1. The trade is found (in activeTrades, historyTrades, or previewTrade)
       * 2. The patch is applied
       * 3. The trade is moved to the correct list based on its new state
       * 4. List invariants are validated
       *
       * @param tradeId - The ID of the trade to patch
       * @param patch - Partial trade updates to apply
       * @returns The updated trade, or null if not found
       */
      applyTradePatch: (tradeId: string, patch: Partial<Trade>): Trade | null => {
        const correlationId = log.actionStart("applyTradePatch", {
          tradeId,
          patchFields: Object.keys(patch),
          newState: patch.state,
        });

        const state = get();
        let foundTrade: Trade | null = null;
        let source: "active" | "history" | "preview" | null = null;

        // Find the trade
        const activeIdx = state.activeTrades.findIndex((t) => t.id === tradeId);
        if (activeIdx !== -1) {
          foundTrade = state.activeTrades[activeIdx];
          source = "active";
        } else {
          const historyIdx = state.historyTrades.findIndex((t) => t.id === tradeId);
          if (historyIdx !== -1) {
            foundTrade = state.historyTrades[historyIdx];
            source = "history";
          } else if (state.previewTrade?.id === tradeId) {
            foundTrade = state.previewTrade;
            source = "preview";
          }
        }

        if (!foundTrade || !source) {
          log.warn("applyTradePatch: Trade not found", { tradeId, correlationId });
          return null;
        }

        // Apply the patch
        const updatedTrade: Trade = { ...foundTrade, ...patch };
        const newState = updatedTrade.state;

        log.debug("applyTradePatch: Applying patch", {
          tradeId,
          correlationId,
          oldState: foundTrade.state,
          newState,
          source,
        });

        // Determine target list based on new state
        let targetList: "active" | "history" | "preview";
        if (newState === "WATCHING") {
          targetList = "preview";
        } else if (newState === "EXITED") {
          targetList = "history";
        } else {
          // LOADED, ENTERED
          targetList = "active";
        }

        // Atomically update the store
        set((s) => {
          // Remove from old location
          let newActiveTrades = s.activeTrades;
          let newHistoryTrades = s.historyTrades;
          let newPreviewTrade = s.previewTrade;

          if (source === "active") {
            newActiveTrades = s.activeTrades.filter((t) => t.id !== tradeId);
          } else if (source === "history") {
            newHistoryTrades = s.historyTrades.filter((t) => t.id !== tradeId);
          } else if (source === "preview") {
            newPreviewTrade = null;
          }

          // Add to new location
          if (targetList === "active") {
            // Check if already exists (shouldn't happen, but defensive)
            if (!newActiveTrades.some((t) => t.id === tradeId)) {
              newActiveTrades = [...newActiveTrades, updatedTrade];
            } else {
              newActiveTrades = newActiveTrades.map((t) => (t.id === tradeId ? updatedTrade : t));
            }
          } else if (targetList === "history") {
            if (!newHistoryTrades.some((t) => t.id === tradeId)) {
              newHistoryTrades = [...newHistoryTrades, updatedTrade];
            } else {
              newHistoryTrades = newHistoryTrades.map((t) => (t.id === tradeId ? updatedTrade : t));
            }
          } else if (targetList === "preview") {
            newPreviewTrade = updatedTrade;
          }

          // Validate invariants in development
          if (process.env.NODE_ENV === "development") {
            assertTradeListsValid(
              {
                activeTrades: newActiveTrades,
                historyTrades: newHistoryTrades,
                previewTrade: newPreviewTrade,
              },
              "applyTradePatch"
            );
          }

          return {
            activeTrades: newActiveTrades,
            historyTrades: newHistoryTrades,
            previewTrade: newPreviewTrade,
          };
        });

        log.actionEnd("applyTradePatch", correlationId, {
          tradeId,
          source,
          targetList,
          newState,
        });

        return updatedTrade;
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
