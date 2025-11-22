import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Trade, TradeState, Contract, TradeUpdate, OptionType, TradeType } from '../types';
import { 
  getTrades, 
  createTrade as dbCreateTrade, 
  updateTrade as dbUpdateTrade, 
  deleteTrade as dbDeleteTrade 
} from '../lib/supabase/database';

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
    case 'watching': return 'WATCHING';
    case 'loaded': return 'LOADED';
    case 'entered': return 'ENTERED';
    case 'exited': return 'EXITED';
    default: return 'WATCHING';
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
      tradeState: 'WATCHING',
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
          const mappedTrade: Trade = {
            id: newTrade.id,
            ticker: newTrade.ticker,
            contract: {
              id: `${newTrade.ticker}-${newTrade.strike}-${newTrade.expiration}`,
              strike: parseFloat(newTrade.strike),
              expiry: newTrade.expiration,
              expiryDate: new Date(newTrade.expiration),
              daysToExpiry: Math.ceil((new Date(newTrade.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              type: (newTrade.contract_type === 'call' ? 'C' : 'P') as OptionType,
              mid: 0,
              bid: 0,
              ask: 0,
              volume: 0,
              openInterest: 0,
            },
            state: mapStatusToState(newTrade.status),
            tradeType: 'Day' as TradeType,
            updates: [],
            discordChannels: [],
            challenges: newTrade.challenge_id ? [newTrade.challenge_id] : [],
          };
          
          set((state) => ({
            activeTrades: [...state.activeTrades, mappedTrade],
            isLoading: false,
          }));
        } catch (error) {
          console.error('[TradeStore] Failed to create trade:', error);
          set({ error: 'Failed to create trade', isLoading: false });
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
            currentTrade: state.currentTrade?.id === tradeId 
              ? { ...state.currentTrade, ...updates } 
              : state.currentTrade,
            isLoading: false,
          }));
        } catch (error) {
          console.error('[TradeStore] Failed to update trade:', error);
          set({ error: 'Failed to update trade', isLoading: false });
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
          console.error('[TradeStore] Failed to delete trade:', error);
          set({ error: 'Failed to delete trade', isLoading: false });
        }
      },

      loadTrades: async (userId) => {
        set({ isLoading: true, error: null });
        try {
          const tradesData = await getTrades(userId);
          const mappedTrades: Trade[] = tradesData.map((t) => ({
            id: t.id,
            ticker: t.ticker,
            contract: {
              id: `${t.ticker}-${t.strike}-${t.expiration}`,
              strike: parseFloat(t.strike),
              expiry: t.expiration,
              expiryDate: new Date(t.expiration),
              daysToExpiry: Math.ceil((new Date(t.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              type: (t.contract_type === 'call' ? 'C' : 'P') as OptionType,
              mid: 0,
              bid: 0,
              ask: 0,
              volume: 0,
              openInterest: 0,
            },
            entryPrice: t.entry_price ? parseFloat(t.entry_price) : undefined,
            exitPrice: t.exit_price ? parseFloat(t.exit_price) : undefined,
            entryTime: t.entry_time ? new Date(t.entry_time) : undefined,
            exitTime: t.exit_time ? new Date(t.exit_time) : undefined,
            currentPrice: t.entry_price ? parseFloat(t.entry_price) : undefined,
            state: mapStatusToState(t.status),
            updates: t.trade_updates || [],
            tradeType: 'Day' as TradeType,
            discordChannels: [],
            challenges: t.challenge_id ? [t.challenge_id] : [],
          }));
          
          const active = mappedTrades.filter((t) => t.state !== 'EXITED');
          const history = mappedTrades.filter((t) => t.state === 'EXITED');
          
          set({
            activeTrades: active,
            historyTrades: history,
            isLoading: false,
          });
        } catch (error) {
          console.error('[TradeStore] Failed to load trades:', error);
          set({ error: 'Failed to load trades', isLoading: false });
        }
      },

      // Trade lifecycle transitions
      transitionToLoaded: (contract) => {
        const { currentTrade } = get();
        if (!currentTrade) {
          console.warn('[TradeStore] Cannot transition to LOADED: no current trade');
          return;
        }

        const loadedTrade: Trade = {
          ...currentTrade,
          contract,
          state: 'LOADED',
        };

        set((state) => ({
          currentTrade: loadedTrade,
          tradeState: 'LOADED',
          activeTrades: [
            ...state.activeTrades.filter((t) => t.id !== loadedTrade.id),
            loadedTrade,
          ],
        }));
      },

      transitionToEntered: (entryPrice, _quantity) => {
        const { currentTrade } = get();
        if (!currentTrade || currentTrade.state !== 'LOADED') {
          console.warn('[TradeStore] Cannot transition to ENTERED: invalid state');
          return;
        }
        
        const updatedTrade: Trade = {
          ...currentTrade,
          entryPrice,
          currentPrice: entryPrice,
          entryTime: new Date(),
          state: 'ENTERED',
        };
        
        set((state) => ({
          currentTrade: updatedTrade,
          tradeState: 'ENTERED',
          activeTrades: state.activeTrades.map((t) =>
            t.id === updatedTrade.id ? updatedTrade : t
          ),
        }));
      },

      transitionToExited: (exitPrice) => {
        const { currentTrade } = get();
        if (!currentTrade || currentTrade.state !== 'ENTERED') {
          console.warn('[TradeStore] Cannot transition to EXITED: invalid state');
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
          state: 'EXITED',
        };
        
        set((state) => ({
          currentTrade: null,
          tradeState: 'WATCHING',
          activeTrades: state.activeTrades.filter((t) => t.id !== exitedTrade.id),
          historyTrades: [exitedTrade, ...state.historyTrades],
        }));
      },

      // Trade updates
      addTradeUpdate: (tradeId, update) => {
        set((state) => ({
          activeTrades: state.activeTrades.map((t) =>
            t.id === tradeId
              ? { ...t, updates: [...(t.updates || []), update] }
              : t
          ),
        }));
      },

      // Utilities
      getTradeById: (tradeId) => {
        const { activeTrades, historyTrades } = get();
        return [...activeTrades, ...historyTrades].find((t) => t.id === tradeId);
      },

      getLoadedTrades: () => {
        return get().activeTrades.filter((t) => t.state === 'LOADED');
      },

      getEnteredTrades: () => {
        return get().activeTrades.filter((t) => t.state === 'ENTERED');
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
          tradeState: 'WATCHING',
          contracts: [],
          updatedTradeIds: new Set(),
          isLoading: false,
          error: null,
        }),
    }),
    { name: 'TradeStore' }
  )
);
