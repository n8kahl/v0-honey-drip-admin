import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("../client", () => ({
  createClient: () => mockSupabaseClient,
}));

// Import after mocking
import {
  getTrades,
  getTradesCount,
  createTrade,
  updateTrade,
  deleteTrade,
  GetTradesOptions,
} from "../database";

describe("database - trades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
    mockSupabaseClient.range.mockReturnThis();
  });

  describe("getTrades", () => {
    it("fetches trades with default pagination", async () => {
      const mockTrades = [
        { id: "trade-1", ticker: "SPY", status: "watching" },
        { id: "trade-2", ticker: "QQQ", status: "entered" },
      ];

      mockSupabaseClient.range.mockResolvedValue({
        data: mockTrades,
        error: null,
      });

      const result = await getTrades("user-123");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("trades");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockSupabaseClient.order).toHaveBeenCalledWith("created_at", { ascending: false });
      // Default limit=100, offset=0 -> range(0, 99)
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 99);
      expect(result).toEqual(mockTrades);
    });

    it("applies custom pagination options", async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
      });

      const options: GetTradesOptions = { limit: 25, offset: 50 };
      await getTrades("user-123", options);

      // offset=50, limit=25 -> range(50, 74)
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(50, 74);
    });

    it("filters by status when provided", async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
      });

      await getTrades("user-123", { status: "entered" });

      // Should call eq twice: once for user_id, once for state
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("state", "entered");
    });

    it("returns empty array when no trades found", async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await getTrades("user-123");

      expect(result).toEqual([]);
    });

    it("throws error on database error", async () => {
      const dbError = new Error("Database connection failed");
      mockSupabaseClient.range.mockResolvedValue({
        data: null,
        error: dbError,
      });

      await expect(getTrades("user-123")).rejects.toThrow("Database connection failed");
    });
  });

  describe("getTradesCount", () => {
    it("returns count of trades for user", async () => {
      // For count queries, the result is in `count` field
      mockSupabaseClient.eq.mockResolvedValue({
        count: 42,
        error: null,
      });

      const result = await getTradesCount("user-123");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("trades");
      expect(mockSupabaseClient.select).toHaveBeenCalledWith("*", { count: "exact", head: true });
      expect(result).toBe(42);
    });

    it("filters by status when provided", async () => {
      // First eq() call returns mock for chaining, second resolves with result
      mockSupabaseClient.eq
        .mockReturnValueOnce(mockSupabaseClient) // First call: user_id (chainable)
        .mockResolvedValueOnce({
          // Second call: state (final)
          count: 10,
          error: null,
        });

      await getTradesCount("user-123", "entered");

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("state", "entered");
    });

    it("returns 0 when count is null", async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        count: null,
        error: null,
      });

      const result = await getTradesCount("user-123");

      expect(result).toBe(0);
    });

    it("throws error on database error", async () => {
      const dbError = new Error("Count query failed");
      mockSupabaseClient.eq.mockResolvedValue({
        count: null,
        error: dbError,
      });

      await expect(getTradesCount("user-123")).rejects.toThrow("Count query failed");
    });
  });

  describe("createTrade", () => {
    it("creates trade with contract JSONB", async () => {
      const mockContract = {
        strike: 595,
        type: "call",
        expiry: "2024-01-19",
        bid: 1.5,
        ask: 1.55,
        iv: 0.22,
      };

      const mockCreatedTrade = {
        id: "trade-new",
        ticker: "SPY",
        contract: mockContract,
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockCreatedTrade,
        error: null,
      });

      const result = await createTrade("user-123", {
        ticker: "SPY",
        contract_type: "call",
        strike: 595,
        expiration: "2024-01-19",
        quantity: 1,
        contract: mockContract,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("trades");
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          ticker: "SPY",
          contract: mockContract,
        })
      );
      expect(result).toEqual(mockCreatedTrade);
    });

    it("stores null contract when not provided", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "trade-new" },
        error: null,
      });

      await createTrade("user-123", {
        ticker: "SPY",
        contract_type: "call",
        strike: 595,
        expiration: "2024-01-19",
        quantity: 1,
      });

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contract: null,
        })
      );
    });
  });

  describe("updateTrade", () => {
    it("updates trade with provided fields", async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { id: "trade-1", status: "entered" },
        error: null,
      });

      const result = await updateTrade("trade-1", {
        status: "entered",
        entry_price: 1.55,
        entry_time: "2024-01-15T10:30:00Z",
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("trades");
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: "entered",
        entry_price: 1.55,
        entry_time: "2024-01-15T10:30:00Z",
      });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("id", "trade-1");
    });
  });

  describe("deleteTrade", () => {
    it("deletes trade by id", async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        error: null,
      });

      await deleteTrade("trade-1");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("trades");
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith("id", "trade-1");
    });

    it("throws error on delete failure", async () => {
      const dbError = new Error("Delete failed");
      mockSupabaseClient.eq.mockResolvedValue({
        error: dbError,
      });

      await expect(deleteTrade("trade-1")).rejects.toThrow("Delete failed");
    });
  });
});
