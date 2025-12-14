import { describe, it, expect } from "vitest";
import {
  getTradesForChallenge,
  getChallengeStats,
  getFullChallengeStats,
} from "../challengeHelpers";
import type { Trade, Contract } from "../../types";

// Helper to create a minimal valid contract
const createContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: "contract-1",
  strike: 500,
  expiry: "2025-01-17",
  expiryDate: new Date("2025-01-17"),
  daysToExpiry: 5,
  type: "C",
  mid: 5.0,
  bid: 4.95,
  ask: 5.05,
  volume: 1000,
  openInterest: 5000,
  ...overrides,
});

// Helper to create a minimal valid trade
const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: crypto.randomUUID(),
  ticker: "SPY",
  contract: createContract(),
  tradeType: "Scalp",
  state: "ENTERED",
  updates: [],
  discordChannels: [],
  challenges: [],
  ...overrides,
});

describe("challengeHelpers", () => {
  describe("getTradesForChallenge", () => {
    it("returns empty arrays when no trades match the challenge", () => {
      const trades = [
        createTrade({ challenges: ["other-challenge"], state: "ENTERED" }),
        createTrade({ challenges: ["another-challenge"], state: "EXITED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.active).toHaveLength(0);
      expect(result.exited).toHaveLength(0);
    });

    it("returns active trades (ENTERED state) for the challenge", () => {
      const trades = [
        createTrade({ id: "t1", challenges: ["ch1"], state: "ENTERED" }),
        createTrade({ id: "t2", challenges: ["ch1"], state: "ENTERED" }),
        createTrade({ id: "t3", challenges: ["ch2"], state: "ENTERED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.active).toHaveLength(2);
      expect(result.active.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("returns exited trades (EXITED state) for the challenge", () => {
      const trades = [
        createTrade({ id: "t1", challenges: ["ch1"], state: "EXITED" }),
        createTrade({ id: "t2", challenges: ["ch1"], state: "EXITED" }),
        createTrade({ id: "t3", challenges: ["ch1"], state: "ENTERED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.exited).toHaveLength(2);
      expect(result.exited.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("ignores trades with WATCHING state", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "WATCHING" }),
        createTrade({ challenges: ["ch1"], state: "ENTERED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.active).toHaveLength(1);
      expect(result.exited).toHaveLength(0);
    });

    it("ignores trades with LOADED state", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "LOADED" }),
        createTrade({ challenges: ["ch1"], state: "ENTERED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.active).toHaveLength(1);
      expect(result.exited).toHaveLength(0);
    });

    it("handles trades with null challenges gracefully", () => {
      const trades = [
        createTrade({ challenges: null as unknown as string[], state: "ENTERED" }),
        createTrade({ challenges: ["ch1"], state: "ENTERED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.active).toHaveLength(1);
    });

    it("handles trades with undefined challenges gracefully", () => {
      const trades = [
        createTrade({ challenges: undefined as unknown as string[], state: "ENTERED" }),
        createTrade({ challenges: ["ch1"], state: "EXITED" }),
      ];

      const result = getTradesForChallenge("ch1", trades);

      expect(result.exited).toHaveLength(1);
    });

    it("handles trades in multiple challenges", () => {
      const trades = [
        createTrade({ id: "t1", challenges: ["ch1", "ch2"], state: "ENTERED" }),
        createTrade({ id: "t2", challenges: ["ch1"], state: "EXITED" }),
      ];

      const result1 = getTradesForChallenge("ch1", trades);
      const result2 = getTradesForChallenge("ch2", trades);

      expect(result1.active).toHaveLength(1);
      expect(result1.exited).toHaveLength(1);
      expect(result2.active).toHaveLength(1);
      expect(result2.exited).toHaveLength(0);
    });
  });

  describe("getChallengeStats", () => {
    it("returns zero stats when no trades for challenge", () => {
      const trades = [createTrade({ challenges: ["other-challenge"] })];

      const stats = getChallengeStats("ch1", trades);

      expect(stats).toEqual({
        totalTrades: 0,
        activeTrades: 0,
        exitedTrades: 0,
        avgPnL: 0,
        winRate: 0,
      });
    });

    it("calculates win rate correctly (positive movePercent = win)", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: 15 }),
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: -5 }),
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: 10 }),
      ];

      const stats = getChallengeStats("ch1", trades);

      // 2 wins out of 3 trades = 66.67%
      expect(stats.winRate).toBeCloseTo(66.67, 1);
    });

    it("calculates average P&L correctly", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "ENTERED", movePercent: 10 }),
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: 20 }),
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: -5 }),
      ];

      const stats = getChallengeStats("ch1", trades);

      // (10 + 20 + -5) / 3 = 8.33
      expect(stats.avgPnL).toBeCloseTo(8.33, 1);
    });

    it("counts active and exited trades separately", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "ENTERED" }),
        createTrade({ challenges: ["ch1"], state: "ENTERED" }),
        createTrade({ challenges: ["ch1"], state: "EXITED" }),
      ];

      const stats = getChallengeStats("ch1", trades);

      expect(stats.totalTrades).toBe(3);
      expect(stats.activeTrades).toBe(2);
      expect(stats.exitedTrades).toBe(1);
    });

    it("treats missing movePercent as 0", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: undefined }),
        createTrade({ challenges: ["ch1"], state: "EXITED", movePercent: 10 }),
      ];

      const stats = getChallengeStats("ch1", trades);

      // (0 + 10) / 2 = 5
      expect(stats.avgPnL).toBe(5);
      // 1 win (movePercent 10 > 0), movePercent undefined treated as 0 (not a win)
      expect(stats.winRate).toBe(50);
    });
  });

  describe("getFullChallengeStats", () => {
    it("returns zero stats when no trades for challenge", () => {
      const trades = [createTrade({ challenges: ["other-challenge"] })];

      const stats = getFullChallengeStats("ch1", trades);

      expect(stats).toEqual({
        active: [],
        completed: [],
        totalTrades: 0,
        activeTrades: 0,
        completedTrades: 0,
        winRate: 0,
        avgPnL: 0,
        totalPnL: 0,
        dollarPnL: 0,
        avgR: 0,
        bestTrade: null,
        worstTrade: null,
      });
    });

    it("includes LOADED trades in active count", () => {
      const trades = [
        createTrade({ id: "t1", challenges: ["ch1"], state: "LOADED" }),
        createTrade({ id: "t2", challenges: ["ch1"], state: "ENTERED" }),
        createTrade({ id: "t3", challenges: ["ch1"], state: "EXITED" }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      expect(stats.activeTrades).toBe(2); // LOADED + ENTERED
      expect(stats.completedTrades).toBe(1); // EXITED only
      expect(stats.active.map((t) => t.id)).toContain("t1");
      expect(stats.active.map((t) => t.id)).toContain("t2");
    });

    it("calculates dollar P&L with $100 options multiplier", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          entryPrice: 5.0,
          exitPrice: 7.5,
          quantity: 2,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      // (7.5 - 5.0) * 2 contracts * $100 multiplier = $500
      expect(stats.dollarPnL).toBe(500);
    });

    it("calculates dollar P&L for multiple trades", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          entryPrice: 5.0,
          exitPrice: 7.5,
          quantity: 2, // +$500
        }),
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          entryPrice: 10.0,
          exitPrice: 8.0,
          quantity: 1, // -$200
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      // $500 - $200 = $300
      expect(stats.dollarPnL).toBe(300);
    });

    it("skips dollar P&L calculation for trades without entry/exit prices", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          entryPrice: undefined,
          exitPrice: 7.5,
          quantity: 2,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      expect(stats.dollarPnL).toBe(0);
    });

    it("calculates average R-multiple", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          rMultiple: 2.0,
        }),
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          rMultiple: -1.0,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      // (2.0 + -1.0) / 2 = 0.5
      expect(stats.avgR).toBe(0.5);
    });

    it("treats missing rMultiple as 0", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          rMultiple: 3.0,
        }),
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          rMultiple: undefined,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      // (3.0 + 0) / 2 = 1.5
      expect(stats.avgR).toBe(1.5);
    });

    it("finds best trade by movePercent", () => {
      const trades = [
        createTrade({
          ticker: "SPY",
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: 15,
        }),
        createTrade({
          ticker: "QQQ",
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: 25,
        }),
        createTrade({
          ticker: "AAPL",
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: -5,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      expect(stats.bestTrade).toEqual({ ticker: "QQQ", pnl: 25 });
    });

    it("finds worst trade by movePercent", () => {
      const trades = [
        createTrade({
          ticker: "SPY",
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: 15,
        }),
        createTrade({
          ticker: "AAPL",
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: -10,
        }),
        createTrade({
          ticker: "MSFT",
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: -5,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      expect(stats.worstTrade).toEqual({ ticker: "AAPL", pnl: -10 });
    });

    it("returns null for best/worst when no exited trades", () => {
      const trades = [
        createTrade({ challenges: ["ch1"], state: "LOADED" }),
        createTrade({ challenges: ["ch1"], state: "ENTERED" }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      expect(stats.bestTrade).toBeNull();
      expect(stats.worstTrade).toBeNull();
    });

    it("calculates win rate based on exited trades only", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "ENTERED",
          movePercent: 50, // Should not affect win rate
        }),
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: 10, // Win
        }),
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          movePercent: -5, // Loss
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      // 1 win out of 2 exited = 50%
      expect(stats.winRate).toBe(50);
    });

    it("defaults quantity to 1 for dollar P&L calculation", () => {
      const trades = [
        createTrade({
          challenges: ["ch1"],
          state: "EXITED",
          entryPrice: 5.0,
          exitPrice: 6.0,
          quantity: undefined,
        }),
      ];

      const stats = getFullChallengeStats("ch1", trades);

      // (6.0 - 5.0) * 1 contract * $100 = $100
      expect(stats.dollarPnL).toBe(100);
    });
  });
});
