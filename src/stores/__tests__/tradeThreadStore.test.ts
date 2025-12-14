/**
 * Trade Thread Store Tests
 *
 * Tests for the Zustand store that manages Trade Threads V1 state.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useTradeThreadStore } from "../tradeThreadStore";
import type { TradeThread, MemberTrade } from "@/types/tradeThreads";

// Mock the API functions
vi.mock("@/lib/api/tradeThreadApi", () => ({
  getTradeThreads: vi.fn(),
  getTradeThread: vi.fn(),
  createTradeThread: vi.fn(),
  addThreadUpdate: vi.fn(),
  getMyTrades: vi.fn(),
  takeTrade: vi.fn(),
  exitTrade: vi.fn(),
  updateMemberTrade: vi.fn(),
}));

// Import mocked functions
import {
  getTradeThreads,
  getTradeThread,
  createTradeThread,
  addThreadUpdate,
  getMyTrades,
  takeTrade,
  exitTrade,
} from "@/lib/api/tradeThreadApi";

// Type cast mocked functions
const mockGetTradeThreads = getTradeThreads as ReturnType<typeof vi.fn>;
const mockGetTradeThread = getTradeThread as ReturnType<typeof vi.fn>;
const mockCreateTradeThread = createTradeThread as ReturnType<typeof vi.fn>;
const mockAddThreadUpdate = addThreadUpdate as ReturnType<typeof vi.fn>;
const mockGetMyTrades = getMyTrades as ReturnType<typeof vi.fn>;
const mockTakeTrade = takeTrade as ReturnType<typeof vi.fn>;
const mockExitTrade = exitTrade as ReturnType<typeof vi.fn>;

// Sample data
const mockThread: TradeThread = {
  id: "thread-1",
  adminId: "admin-1",
  symbol: "SPY",
  contractId: "SPY_600_C_2025-01-17",
  contract: {
    strike: 600,
    type: "call",
    expiry: "2025-01-17",
  },
  status: "open",
  entryPrice: 5.5,
  targetPrice: 8.0,
  stopLoss: 4.0,
  tradeType: "Day",
  adminName: "TestAdmin",
  createdAt: new Date("2025-01-15T10:00:00Z"),
  latestUpdateAt: new Date("2025-01-15T10:00:00Z"),
  updates: [],
};

const mockMemberTrade: MemberTrade = {
  id: "member-trade-1",
  userId: "user-1",
  tradeThreadId: "thread-1",
  entryPrice: 5.6,
  entryTime: new Date("2025-01-15T10:05:00Z"),
  sizeContracts: 2,
  status: "active",
  createdAt: new Date("2025-01-15T10:05:00Z"),
  updatedAt: new Date("2025-01-15T10:05:00Z"),
};

describe("tradeThreadStore", () => {
  beforeEach(() => {
    // Reset store state
    useTradeThreadStore.getState().reset();
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Stop polling if active
    useTradeThreadStore.getState().stopPolling();
  });

  describe("loadOpenThreads", () => {
    it("should load open threads from API", async () => {
      mockGetTradeThreads.mockResolvedValue([mockThread]);

      await useTradeThreadStore.getState().loadOpenThreads();

      expect(mockGetTradeThreads).toHaveBeenCalledWith({ status: "open" });
      expect(useTradeThreadStore.getState().openThreads).toEqual([mockThread]);
      expect(useTradeThreadStore.getState().isLoading).toBe(false);
    });

    it("should set error on API failure", async () => {
      mockGetTradeThreads.mockRejectedValue(new Error("Network error"));

      await useTradeThreadStore.getState().loadOpenThreads();

      expect(useTradeThreadStore.getState().error).toBe("Network error");
      expect(useTradeThreadStore.getState().isLoading).toBe(false);
    });
  });

  describe("loadThread", () => {
    it("should load a specific thread with member count", async () => {
      mockGetTradeThread.mockResolvedValue({ ...mockThread, memberCount: 5 });

      const result = await useTradeThreadStore.getState().loadThread("thread-1");

      expect(mockGetTradeThread).toHaveBeenCalledWith("thread-1");
      expect(result.memberCount).toBe(5);
      expect(useTradeThreadStore.getState().currentThread).toEqual({
        ...mockThread,
        memberCount: 5,
      });
      expect(useTradeThreadStore.getState().currentThreadId).toBe("thread-1");
    });
  });

  describe("createThread", () => {
    it("should create a new thread and add to open threads", async () => {
      const newThread = { ...mockThread, id: "thread-2" };
      mockCreateTradeThread.mockResolvedValue({ thread: newThread, openUpdate: {} });

      const result = await useTradeThreadStore.getState().createThread({
        symbol: "SPY",
        contractId: "SPY_600_C_2025-01-17",
        entryPrice: 5.5,
      });

      expect(result.id).toBe("thread-2");
      expect(useTradeThreadStore.getState().openThreads).toContainEqual(newThread);
    });
  });

  describe("takeTrade", () => {
    it("should create member trade subscription", async () => {
      mockTakeTrade.mockResolvedValue({
        memberTrade: mockMemberTrade,
        thread: mockThread,
      });

      const result = await useTradeThreadStore.getState().takeTrade({
        tradeThreadId: "thread-1",
        entryPrice: 5.6,
        sizeContracts: 2,
      });

      expect(result.id).toBe("member-trade-1");
      expect(useTradeThreadStore.getState().myTrades.length).toBe(1);
      expect(useTradeThreadStore.getState().notifications.length).toBe(1);
    });
  });

  describe("exitMemberTrade", () => {
    it("should exit trade and move to journal", async () => {
      // Setup: add trade to myTrades first
      mockTakeTrade.mockResolvedValue({
        memberTrade: mockMemberTrade,
        thread: mockThread,
      });
      await useTradeThreadStore.getState().takeTrade({
        tradeThreadId: "thread-1",
        entryPrice: 5.6,
      });

      // Clear notifications from take trade
      useTradeThreadStore.getState().clearNotifications();

      const exitedTrade = {
        ...mockMemberTrade,
        exitPrice: 7.0,
        exitTime: new Date(),
        status: "exited" as const,
      };
      mockExitTrade.mockResolvedValue({
        memberTrade: exitedTrade,
        pnlPercent: 25.0,
      });

      await useTradeThreadStore.getState().exitMemberTrade("member-trade-1", 7.0, "Took profit");

      expect(useTradeThreadStore.getState().myTrades.length).toBe(0);
      expect(useTradeThreadStore.getState().journalTrades.length).toBe(1);
      expect(useTradeThreadStore.getState().journalTrades[0].exitPrice).toBe(7.0);
      expect(useTradeThreadStore.getState().notifications.length).toBe(1);
      expect(useTradeThreadStore.getState().notifications[0].title).toContain("WIN");
    });
  });

  describe("isSubscribed", () => {
    it("should return true if user is subscribed to thread", async () => {
      mockTakeTrade.mockResolvedValue({
        memberTrade: mockMemberTrade,
        thread: mockThread,
      });
      await useTradeThreadStore.getState().takeTrade({
        tradeThreadId: "thread-1",
        entryPrice: 5.6,
      });

      expect(useTradeThreadStore.getState().isSubscribed("thread-1")).toBe(true);
      expect(useTradeThreadStore.getState().isSubscribed("thread-2")).toBe(false);
    });
  });

  describe("notifications", () => {
    it("should add notification", () => {
      useTradeThreadStore.getState().addNotification({
        type: "admin_update",
        tradeThreadId: "thread-1",
        title: "Test",
        message: "Test message",
        read: false,
      });

      expect(useTradeThreadStore.getState().notifications.length).toBe(1);
      expect(useTradeThreadStore.getState().unreadCount).toBe(1);
    });

    it("should mark notification as read", () => {
      useTradeThreadStore.getState().addNotification({
        type: "admin_update",
        tradeThreadId: "thread-1",
        title: "Test",
        message: "Test message",
        read: false,
      });

      const notificationId = useTradeThreadStore.getState().notifications[0].id;
      useTradeThreadStore.getState().markNotificationRead(notificationId);

      expect(useTradeThreadStore.getState().notifications[0].read).toBe(true);
      expect(useTradeThreadStore.getState().unreadCount).toBe(0);
    });

    it("should mark all notifications as read", () => {
      useTradeThreadStore.getState().addNotification({
        type: "admin_update",
        tradeThreadId: "thread-1",
        title: "Test 1",
        message: "Message 1",
        read: false,
      });
      useTradeThreadStore.getState().addNotification({
        type: "admin_update",
        tradeThreadId: "thread-1",
        title: "Test 2",
        message: "Message 2",
        read: false,
      });

      expect(useTradeThreadStore.getState().unreadCount).toBe(2);

      useTradeThreadStore.getState().markAllNotificationsRead();

      expect(useTradeThreadStore.getState().unreadCount).toBe(0);
      expect(useTradeThreadStore.getState().notifications.every((n) => n.read)).toBe(true);
    });
  });

  describe("calculateMemberPnl", () => {
    it("should calculate P/L correctly", async () => {
      mockTakeTrade.mockResolvedValue({
        memberTrade: mockMemberTrade,
        thread: mockThread,
      });
      await useTradeThreadStore.getState().takeTrade({
        tradeThreadId: "thread-1",
        entryPrice: 5.6,
      });

      // Current price is 7.0, entry was 5.6
      // P/L = (7.0 - 5.6) / 5.6 * 100 = 25%
      const pnl = useTradeThreadStore.getState().calculateMemberPnl("member-trade-1", 7.0);
      expect(pnl).toBeCloseTo(25, 1);
    });

    it("should return 0 for non-existent trade", () => {
      const pnl = useTradeThreadStore.getState().calculateMemberPnl("non-existent", 7.0);
      expect(pnl).toBe(0);
    });
  });

  describe("polling", () => {
    it("should start and stop polling", async () => {
      vi.useFakeTimers();
      mockGetTradeThreads.mockResolvedValue([mockThread]);
      mockGetMyTrades.mockResolvedValue([mockMemberTrade]);

      useTradeThreadStore.getState().startPolling(1000);

      // Polling interval should be set
      expect(useTradeThreadStore.getState().pollingInterval).not.toBeNull();

      // Advance time to trigger polling
      await vi.advanceTimersByTimeAsync(1000);

      // API should have been called
      expect(mockGetTradeThreads).toHaveBeenCalledWith({ status: "open" });

      // Stop polling
      useTradeThreadStore.getState().stopPolling();
      expect(useTradeThreadStore.getState().pollingInterval).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("addUpdate", () => {
    it("should add update to thread and handle EXIT", async () => {
      // First load the thread
      mockGetTradeThreads.mockResolvedValue([mockThread]);
      await useTradeThreadStore.getState().loadOpenThreads();

      mockAddThreadUpdate.mockResolvedValue({
        update: {
          id: "update-1",
          tradeThreadId: "thread-1",
          adminId: "admin-1",
          type: "EXIT",
          message: "Taking profit",
          payload: { exitPrice: 8.0, pnlPercent: 45.5 },
          createdAt: new Date(),
        },
        threadClosed: true,
      });

      await useTradeThreadStore.getState().addUpdate("thread-1", "EXIT", "Taking profit", {
        exitPrice: 8.0,
        pnlPercent: 45.5,
      });

      // Thread should be removed from openThreads when closed
      expect(
        useTradeThreadStore.getState().openThreads.find((t) => t.id === "thread-1")
      ).toBeUndefined();
    });
  });
});
