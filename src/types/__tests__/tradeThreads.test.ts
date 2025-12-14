/**
 * Trade Threads Types Tests
 *
 * Tests for the type utilities and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  calculatePnlPercent,
  determineOutcome,
  formatContractId,
  mapDbRowToTradeThread,
  mapDbRowToMemberTrade,
  mapDbRowToPublicOutcome,
} from "../tradeThreads";

describe("Trade Thread Type Utilities", () => {
  describe("calculatePnlPercent", () => {
    it("should calculate positive P/L correctly", () => {
      expect(calculatePnlPercent(100, 125)).toBeCloseTo(25, 2);
    });

    it("should calculate negative P/L correctly", () => {
      expect(calculatePnlPercent(100, 75)).toBeCloseTo(-25, 2);
    });

    it("should return 0 for breakeven", () => {
      expect(calculatePnlPercent(100, 100)).toBe(0);
    });

    it("should return 0 for invalid entry price", () => {
      expect(calculatePnlPercent(0, 100)).toBe(0);
    });

    it("should handle small price movements", () => {
      expect(calculatePnlPercent(5.5, 5.55)).toBeCloseTo(0.909, 2);
    });
  });

  describe("determineOutcome", () => {
    it("should return WIN for positive P/L above threshold", () => {
      expect(determineOutcome(10)).toBe("win");
      expect(determineOutcome(0.6)).toBe("win");
      expect(determineOutcome(1)).toBe("win");
    });

    it("should return LOSS for negative P/L below threshold", () => {
      expect(determineOutcome(-10)).toBe("loss");
      expect(determineOutcome(-0.6)).toBe("loss");
      expect(determineOutcome(-1)).toBe("loss");
    });

    it("should return BREAKEVEN for P/L within threshold (±0.5)", () => {
      expect(determineOutcome(0)).toBe("breakeven");
      expect(determineOutcome(0.5)).toBe("breakeven");
      expect(determineOutcome(-0.5)).toBe("breakeven");
      expect(determineOutcome(0.1)).toBe("breakeven");
      expect(determineOutcome(-0.1)).toBe("breakeven");
    });
  });

  describe("formatContractId", () => {
    it("should format contract ID in OCC format from contract object", () => {
      const contract = { strike: 600, type: "C" as const, expiry: "2025-01-17" };
      const result = formatContractId("SPY", contract);
      // Format: SYMBOL + YYMMDD + C/P + 8-digit strike (strike * 1000)
      expect(result).toBe("SPY250117C00600000");
    });

    it("should handle put options", () => {
      const contract = { strike: 500, type: "P" as const, expiry: "2025-02-21" };
      const result = formatContractId("QQQ", contract);
      expect(result).toBe("QQQ250221P00500000");
    });

    it("should handle fractional strikes", () => {
      const contract = { strike: 595.5, type: "C" as const, expiry: "2025-03-15" };
      const result = formatContractId("SPY", contract);
      expect(result).toBe("SPY250315C00595500");
    });
  });

  describe("mapDbRowToTradeThread", () => {
    it("should map database row to TradeThread type", () => {
      const dbRow = {
        id: "thread-1",
        admin_id: "admin-1",
        symbol: "SPY",
        contract_id: "SPY_600_C_2025-01-17",
        contract: { strike: 600, type: "call", expiry: "2025-01-17" },
        status: "open",
        entry_price: 5.5,
        target_price: 8.0,
        stop_loss: 4.0,
        exit_price: null,
        final_pnl_percent: null,
        outcome: null,
        trade_type: "Day",
        admin_name: "TestAdmin",
        created_at: "2025-01-15T10:00:00Z",
        closed_at: null,
        latest_update_at: "2025-01-15T10:00:00Z",
        updates: [],
      };

      const result = mapDbRowToTradeThread(dbRow);

      expect(result.id).toBe("thread-1");
      expect(result.adminId).toBe("admin-1");
      expect(result.symbol).toBe("SPY");
      expect(result.status).toBe("open");
      expect(result.entryPrice).toBe(5.5);
      expect(result.tradeType).toBe("Day");
    });

    it("should handle null values gracefully", () => {
      const dbRow = {
        id: "thread-1",
        admin_id: "admin-1",
        symbol: "SPY",
        contract_id: "SPY_600_C",
        status: "open",
        created_at: "2025-01-15T10:00:00Z",
        latest_update_at: "2025-01-15T10:00:00Z",
      };

      const result = mapDbRowToTradeThread(dbRow);

      expect(result.entryPrice).toBeUndefined();
      expect(result.targetPrice).toBeUndefined();
      expect(result.contract).toBeUndefined();
    });
  });

  describe("mapDbRowToMemberTrade", () => {
    it("should map database row to MemberTrade type", () => {
      const dbRow = {
        id: "member-1",
        user_id: "user-1",
        trade_thread_id: "thread-1",
        entry_price: 5.6,
        entry_time: "2025-01-15T10:05:00Z",
        size_contracts: 2,
        stop_price: 4.0,
        targets: [6.0, 7.0, 8.0],
        exit_price: null,
        exit_time: null,
        status: "active",
        notes: "Test trade",
        created_at: "2025-01-15T10:05:00Z",
        updated_at: "2025-01-15T10:05:00Z",
      };

      const result = mapDbRowToMemberTrade(dbRow);

      expect(result.id).toBe("member-1");
      expect(result.userId).toBe("user-1");
      expect(result.tradeThreadId).toBe("thread-1");
      expect(result.entryPrice).toBe(5.6);
      expect(result.sizeContracts).toBe(2);
      expect(result.targets).toEqual([6.0, 7.0, 8.0]);
      expect(result.notes).toBe("Test trade");
    });

    it("should handle exited trade", () => {
      const dbRow = {
        id: "member-1",
        user_id: "user-1",
        trade_thread_id: "thread-1",
        entry_price: 5.6,
        entry_time: "2025-01-15T10:05:00Z",
        exit_price: 7.0,
        exit_time: "2025-01-15T14:30:00Z",
        status: "exited",
        created_at: "2025-01-15T10:05:00Z",
        updated_at: "2025-01-15T14:30:00Z",
      };

      const result = mapDbRowToMemberTrade(dbRow);

      expect(result.exitPrice).toBe(7.0);
      expect(result.status).toBe("exited");
      expect(result.exitTime).toBeDefined();
    });
  });

  describe("mapDbRowToPublicOutcome", () => {
    it("should map database row to PublicTradeOutcome type", () => {
      const dbRow = {
        id: "outcome-1",
        trade_thread_id: "thread-1",
        symbol: "SPY",
        contract_id: "SPY_600_C",
        trade_type: "Day",
        outcome: "win",
        pnl_percent: 45.5,
        admin_id: "admin-1",
        admin_name: "TestAdmin",
        admin_avatar_url: "https://example.com/avatar.png",
        public_comment: "Great trade!",
        entry_price_masked: true,
        trade_opened_at: "2025-01-15T10:00:00Z",
        trade_closed_at: "2025-01-15T14:30:00Z",
        published_at: "2025-01-15T17:00:00Z",
      };

      const result = mapDbRowToPublicOutcome(dbRow);

      expect(result.id).toBe("outcome-1");
      expect(result.symbol).toBe("SPY");
      expect(result.outcome).toBe("win");
      expect(result.pnlPercent).toBe(45.5);
      expect(result.adminName).toBe("TestAdmin");
      expect(result.entryPriceMasked).toBe(true);
      expect(result.publicComment).toBe("Great trade!");
    });
  });
});
