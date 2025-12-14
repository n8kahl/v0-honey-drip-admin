/**
 * Trade Thread Store - Zustand store for Trade Threads V1
 *
 * Manages:
 * - Trade threads (admin view)
 * - Member trades ("I took this trade")
 * - Journal entries (completed trades)
 * - Real-time notifications
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  TradeThread,
  TradeThreadUpdate,
  MemberTrade,
  TradeNotification,
  TradeThreadUpdateType,
  TradeThreadUpdatePayload,
  CreateMemberTradeInput,
  calculatePnlPercent,
} from "@/types/tradeThreads";
import {
  getTradeThreads,
  getTradeThread,
  createTradeThread,
  addThreadUpdate,
  getMyTrades,
  takeTrade,
  exitTrade,
  updateMemberTrade,
} from "@/lib/api/tradeThreadApi";
import type { Contract, TradeType } from "@/types";

// ============================================================================
// Store Interface
// ============================================================================

interface TradeThreadStore {
  // State
  threads: TradeThread[];
  openThreads: TradeThread[];
  myTrades: MemberTrade[];
  journalTrades: MemberTrade[];
  currentThreadId: string | null;
  currentThread: TradeThread | null;
  notifications: TradeNotification[];
  unreadCount: number;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // ============== THREAD ACTIONS (Admin) ==============

  /**
   * Load all open trade threads
   */
  loadOpenThreads: () => Promise<void>;

  /**
   * Load a specific thread with updates
   */
  loadThread: (threadId: string) => Promise<TradeThread>;

  /**
   * Create a new trade thread (typically called when admin posts OPEN alert)
   */
  createThread: (input: {
    symbol: string;
    contractId: string;
    contract?: Contract;
    entryPrice?: number;
    targetPrice?: number;
    stopLoss?: number;
    tradeType?: TradeType;
    adminName?: string;
    message?: string;
  }) => Promise<TradeThread>;

  /**
   * Add an update to a thread (UPDATE, STOP_MOVE, TRIM, EXIT, NOTE)
   */
  addUpdate: (
    threadId: string,
    type: TradeThreadUpdateType,
    message?: string,
    payload?: TradeThreadUpdatePayload
  ) => Promise<void>;

  /**
   * Set current thread for viewing
   */
  setCurrentThread: (threadId: string | null) => void;

  // ============== MEMBER TRADE ACTIONS ==============

  /**
   * Load user's active member trades
   */
  loadMyTrades: () => Promise<void>;

  /**
   * Load user's completed trades for journal
   */
  loadJournalTrades: () => Promise<void>;

  /**
   * "I took this trade" - Subscribe to a thread
   */
  takeTrade: (input: CreateMemberTradeInput) => Promise<MemberTrade>;

  /**
   * Exit a member trade
   */
  exitMemberTrade: (memberTradeId: string, exitPrice: number, notes?: string) => Promise<void>;

  /**
   * Update member trade notes
   */
  updateMemberTradeNotes: (memberTradeId: string, notes: string) => Promise<void>;

  /**
   * Get member's subscription for a specific thread
   */
  getMemberTradeForThread: (threadId: string) => MemberTrade | undefined;

  /**
   * Check if user is subscribed to a thread
   */
  isSubscribed: (threadId: string) => boolean;

  // ============== NOTIFICATION ACTIONS ==============

  /**
   * Add a notification (from real-time updates)
   */
  addNotification: (notification: Omit<TradeNotification, "id" | "createdAt">) => void;

  /**
   * Mark notification as read
   */
  markNotificationRead: (notificationId: string) => void;

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: () => void;

  /**
   * Clear all notifications
   */
  clearNotifications: () => void;

  // ============== UTILITY ACTIONS ==============

  /**
   * Calculate P/L for a member trade given current price
   */
  calculateMemberPnl: (memberTradeId: string, currentPrice: number) => number;

  /**
   * Reset store state
   */
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  threads: [],
  openThreads: [],
  myTrades: [],
  journalTrades: [],
  currentThreadId: null,
  currentThread: null,
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useTradeThreadStore = create<TradeThreadStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ============== THREAD ACTIONS (Admin) ==============

      loadOpenThreads: async () => {
        set({ isLoading: true, error: null });
        try {
          const threads = await getTradeThreads({ status: "open" });
          set({ openThreads: threads, isLoading: false });
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to load open threads:", error);
          set({ error: error.message, isLoading: false });
        }
      },

      loadThread: async (threadId: string) => {
        set({ isLoading: true, error: null });
        try {
          const thread = await getTradeThread(threadId);
          set({
            currentThread: thread,
            currentThreadId: threadId,
            isLoading: false,
          });
          return thread;
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to load thread:", error);
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      createThread: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const { thread } = await createTradeThread(input);

          // Add to open threads
          set((state) => ({
            openThreads: [thread, ...state.openThreads],
            threads: [thread, ...state.threads],
            isLoading: false,
          }));

          console.log(`[TradeThreadStore] Thread created: ${thread.id}`);
          return thread;
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to create thread:", error);
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      addUpdate: async (threadId, type, message, payload) => {
        try {
          const { update, threadClosed } = await addThreadUpdate(threadId, type, message, payload);

          // Update local state
          set((state) => {
            const updateThread = (threads: TradeThread[]) =>
              threads.map((t) => {
                if (t.id === threadId) {
                  return {
                    ...t,
                    updates: [...(t.updates || []), update],
                    latestUpdateAt: new Date(),
                    status: threadClosed ? ("closed" as const) : t.status,
                    closedAt: threadClosed ? new Date() : t.closedAt,
                    exitPrice: payload?.exitPrice ?? t.exitPrice,
                    finalPnlPercent: payload?.pnlPercent ?? t.finalPnlPercent,
                  };
                }
                return t;
              });

            const newOpenThreads = threadClosed
              ? state.openThreads.filter((t) => t.id !== threadId)
              : updateThread(state.openThreads);

            return {
              threads: updateThread(state.threads),
              openThreads: newOpenThreads,
              currentThread:
                state.currentThreadId === threadId
                  ? {
                      ...state.currentThread!,
                      updates: [...(state.currentThread?.updates || []), update],
                      status: threadClosed ? ("closed" as const) : state.currentThread?.status,
                    }
                  : state.currentThread,
            };
          });

          console.log(`[TradeThreadStore] Update added to thread ${threadId}: ${type}`);
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to add update:", error);
          set({ error: error.message });
          throw error;
        }
      },

      setCurrentThread: (threadId) => {
        const thread = get().threads.find((t) => t.id === threadId) || null;
        set({ currentThreadId: threadId, currentThread: thread });
      },

      // ============== MEMBER TRADE ACTIONS ==============

      loadMyTrades: async () => {
        set({ isLoading: true, error: null });
        try {
          const trades = await getMyTrades({ status: "active", includeThread: true });
          set({ myTrades: trades, isLoading: false });
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to load my trades:", error);
          set({ error: error.message, isLoading: false });
        }
      },

      loadJournalTrades: async () => {
        set({ isLoading: true, error: null });
        try {
          const trades = await getMyTrades({ status: "exited", includeThread: true });
          set({ journalTrades: trades, isLoading: false });
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to load journal trades:", error);
          set({ error: error.message, isLoading: false });
        }
      },

      takeTrade: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const { memberTrade, thread } = await takeTrade(input);

          // Add to my trades
          set((state) => ({
            myTrades: [{ ...memberTrade, tradeThread: thread }, ...state.myTrades],
            isLoading: false,
          }));

          console.log(`[TradeThreadStore] Took trade: ${memberTrade.id}`);

          // Add notification
          get().addNotification({
            type: "admin_update",
            tradeThreadId: thread.id,
            memberTradeId: memberTrade.id,
            title: `Subscribed to ${thread.symbol}`,
            message: `You're now tracking this trade. Entry: $${memberTrade.entryPrice.toFixed(2)}`,
            read: false,
          });

          return memberTrade;
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to take trade:", error);
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      exitMemberTrade: async (memberTradeId, exitPrice, notes) => {
        try {
          const { memberTrade, pnlPercent } = await exitTrade({
            memberTradeId,
            exitPrice,
            notes,
          });

          // Move from active to journal
          set((state) => ({
            myTrades: state.myTrades.filter((t) => t.id !== memberTradeId),
            journalTrades: [memberTrade, ...state.journalTrades],
          }));

          console.log(`[TradeThreadStore] Exited trade: ${memberTradeId} (${pnlPercent.toFixed(1)}%)`);

          // Add notification
          const outcome = pnlPercent > 0 ? "WIN" : pnlPercent < 0 ? "LOSS" : "BREAKEVEN";
          get().addNotification({
            type: "trade_closed",
            tradeThreadId: memberTrade.tradeThreadId,
            memberTradeId: memberTrade.id,
            title: `Trade Closed: ${outcome}`,
            message: `P/L: ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%`,
            read: false,
          });
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to exit trade:", error);
          set({ error: error.message });
          throw error;
        }
      },

      updateMemberTradeNotes: async (memberTradeId, notes) => {
        try {
          const updated = await updateMemberTrade(memberTradeId, { notes });

          set((state) => ({
            myTrades: state.myTrades.map((t) => (t.id === memberTradeId ? updated : t)),
            journalTrades: state.journalTrades.map((t) => (t.id === memberTradeId ? updated : t)),
          }));
        } catch (error: any) {
          console.error("[TradeThreadStore] Failed to update notes:", error);
          set({ error: error.message });
          throw error;
        }
      },

      getMemberTradeForThread: (threadId) => {
        return get().myTrades.find((t) => t.tradeThreadId === threadId);
      },

      isSubscribed: (threadId) => {
        return get().myTrades.some((t) => t.tradeThreadId === threadId);
      },

      // ============== NOTIFICATION ACTIONS ==============

      addNotification: (notification) => {
        const newNotification: TradeNotification = {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        }));
      },

      markNotificationRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      clearNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      // ============== UTILITY ACTIONS ==============

      calculateMemberPnl: (memberTradeId, currentPrice) => {
        const trade = get().myTrades.find((t) => t.id === memberTradeId);
        if (!trade) return 0;
        return calculatePnlPercent(trade.entryPrice, currentPrice);
      },

      reset: () => {
        set(initialState);
      },
    }),
    { name: "TradeThreadStore" }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get open threads sorted by latest update
 */
export const selectOpenThreads = (state: TradeThreadStore) =>
  [...state.openThreads].sort(
    (a, b) => new Date(b.latestUpdateAt).getTime() - new Date(a.latestUpdateAt).getTime()
  );

/**
 * Get member's active trades with computed P/L
 */
export const selectActiveMemberTrades = (state: TradeThreadStore) => state.myTrades;

/**
 * Get journal trades sorted by exit time
 */
export const selectJournalTrades = (state: TradeThreadStore) =>
  [...state.journalTrades].sort(
    (a, b) =>
      new Date(b.exitTime || b.updatedAt).getTime() - new Date(a.exitTime || a.updatedAt).getTime()
  );

/**
 * Get unread notifications
 */
export const selectUnreadNotifications = (state: TradeThreadStore) =>
  state.notifications.filter((n) => !n.read);
