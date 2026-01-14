/**
 * Unit Tests for commitAlertDraft and sendTradeAlertFromDraft
 *
 * Tests validation logic including:
 * - Price > 0 validation for ENTER/EXIT intents
 * - Required field validation per intent
 * - Channel validation when sendAlert is enabled
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlertDraft } from "../../alertDraft";
import type { Trade, Contract } from "../../../types";
import {
  validateAlertDraft,
  validateAlertDraftForSend,
} from "../commitAlertDraft";

// ============================================================================
// Test Fixtures
// ============================================================================

const mockContract: Contract = {
  id: "contract-1",
  strike: 600,
  expiry: "2025-01-17",
  expiryDate: new Date("2025-01-17"),
  daysToExpiry: 5,
  type: "C",
  mid: 5.0,
  bid: 4.95,
  ask: 5.05,
  volume: 1000,
  openInterest: 5000,
};

const mockTrade: Trade = {
  id: "trade-1",
  ticker: "SPY",
  contract: mockContract,
  tradeType: "Day",
  state: "LOADED",
  updates: [],
  discordChannels: [],
  challenges: [],
};

function createDraft(overrides: Partial<AlertDraft> = {}): AlertDraft {
  return {
    intent: "ENTER",
    trade: mockTrade,
    editablePrices: {
      entry: 5.0,
      current: 5.0,
      target: 7.5,
      stop: 4.0,
    },
    fieldToggles: {
      showEntry: true,
      showCurrent: true,
      showTarget: true,
      showStop: true,
      showPnL: false,
      showRiskReward: true,
      showDTE: true,
      showGreeks: true,
      showConfluence: false,
      showUnderlying: true,
      showSetupType: true,
      showGainsImage: false,
    },
    channels: ["channel-1"],
    challenges: [],
    comment: "",
    sendAlert: true,
    ...overrides,
  };
}

// ============================================================================
// validateAlertDraft Tests
// ============================================================================

describe("validateAlertDraft", () => {
  describe("ENTER intent validation", () => {
    it("passes validation with all required fields", () => {
      const draft = createDraft({ intent: "ENTER" });
      const errors = validateAlertDraft(draft);
      expect(errors).toHaveLength(0);
    });

    it("fails when entry price is missing", () => {
      const draft = createDraft({
        intent: "ENTER",
        editablePrices: {
          current: 5.0,
          target: 7.5,
          stop: 4.0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Entry price is required for ENTER action");
    });

    it("fails when entry price is $0.00", () => {
      const draft = createDraft({
        intent: "ENTER",
        editablePrices: {
          entry: 0,
          current: 5.0,
          target: 7.5,
          stop: 4.0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Entry price must be greater than $0.00");
    });

    it("fails when entry price is negative", () => {
      const draft = createDraft({
        intent: "ENTER",
        editablePrices: {
          entry: -1.0,
          current: 5.0,
          target: 7.5,
          stop: 4.0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Entry price must be greater than $0.00");
    });

    it("fails when target price is missing or zero", () => {
      const draft = createDraft({
        intent: "ENTER",
        editablePrices: {
          entry: 5.0,
          current: 5.0,
          stop: 4.0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Target price is required and must be positive");
    });

    it("fails when stop loss is missing or zero", () => {
      const draft = createDraft({
        intent: "ENTER",
        editablePrices: {
          entry: 5.0,
          current: 5.0,
          target: 7.5,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Stop loss is required and must be positive");
    });
  });

  describe("EXIT intent validation", () => {
    it("passes validation with all required fields", () => {
      const draft = createDraft({
        intent: "EXIT",
        trade: { ...mockTrade, state: "ENTERED" },
        editablePrices: {
          current: 6.5,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toHaveLength(0);
    });

    it("fails when exit price is missing", () => {
      const draft = createDraft({
        intent: "EXIT",
        trade: { ...mockTrade, state: "ENTERED" },
        editablePrices: {},
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Exit price is required for EXIT action");
    });

    it("fails when exit price is $0.00", () => {
      const draft = createDraft({
        intent: "EXIT",
        trade: { ...mockTrade, state: "ENTERED" },
        editablePrices: {
          current: 0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Exit price must be greater than $0.00");
    });

    it("fails when exit price is negative", () => {
      const draft = createDraft({
        intent: "EXIT",
        trade: { ...mockTrade, state: "ENTERED" },
        editablePrices: {
          current: -1.5,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Exit price must be greater than $0.00");
    });
  });

  describe("LOAD intent validation", () => {
    it("passes validation with all required fields", () => {
      const draft = createDraft({
        intent: "LOAD",
        trade: { ...mockTrade, state: "WATCHING" },
        editablePrices: {
          current: 5.0,
          target: 7.5,
          stop: 4.0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toHaveLength(0);
    });

    it("fails when target price is missing", () => {
      const draft = createDraft({
        intent: "LOAD",
        trade: { ...mockTrade, state: "WATCHING" },
        editablePrices: {
          current: 5.0,
          stop: 4.0,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Target price is required and must be positive");
    });

    it("fails when stop loss is missing", () => {
      const draft = createDraft({
        intent: "LOAD",
        trade: { ...mockTrade, state: "WATCHING" },
        editablePrices: {
          current: 5.0,
          target: 7.5,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Stop loss is required and must be positive");
    });
  });

  describe("UPDATE_SL intent validation", () => {
    it("passes validation when stop price is provided", () => {
      const draft = createDraft({
        intent: "UPDATE_SL",
        trade: { ...mockTrade, state: "ENTERED" },
        editablePrices: {
          stop: 4.5,
        },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toHaveLength(0);
    });

    it("fails when stop price is missing", () => {
      const draft = createDraft({
        intent: "UPDATE_SL",
        trade: { ...mockTrade, state: "ENTERED" },
        editablePrices: {},
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Stop loss price is required for UPDATE_SL action");
    });
  });

  describe("Channel validation", () => {
    it("fails when sendAlert is true but no channels selected", () => {
      const draft = createDraft({
        channels: [],
        sendAlert: true,
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("At least one Discord channel required when sending alerts");
    });

    it("passes when sendAlert is false and no channels selected", () => {
      const draft = createDraft({
        channels: [],
        sendAlert: false,
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Trade ID validation", () => {
    it("fails when trade ID is missing for UPDATE_SL", () => {
      const draft = createDraft({
        intent: "UPDATE_SL",
        trade: { ...mockTrade, id: "", state: "ENTERED" },
        editablePrices: { stop: 4.5 },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Trade must have an ID for this action");
    });

    it("passes when trade ID is missing for LOAD (allowed)", () => {
      const draft = createDraft({
        intent: "LOAD",
        trade: { ...mockTrade, id: "", state: "WATCHING" },
        editablePrices: { current: 5.0, target: 7.5, stop: 4.0 },
      });
      const errors = validateAlertDraft(draft);
      expect(errors.includes("Trade must have an ID for this action")).toBe(false);
    });

    it("passes when trade ID is missing for ENTER (allowed)", () => {
      const draft = createDraft({
        intent: "ENTER",
        trade: { ...mockTrade, id: "", state: "WATCHING" },
      });
      const errors = validateAlertDraft(draft);
      expect(errors.includes("Trade must have an ID for this action")).toBe(false);
    });
  });

  describe("Contract validation", () => {
    it("fails when trade has no contract", () => {
      const draft = createDraft({
        trade: { ...mockTrade, contract: undefined as any },
      });
      const errors = validateAlertDraft(draft);
      expect(errors).toContain("Trade must have a contract");
    });
  });
});

// ============================================================================
// validateAlertDraftForSend Tests
// ============================================================================

describe("validateAlertDraftForSend", () => {
  it("returns valid: true when draft passes all validation", () => {
    const draft = createDraft();
    const result = validateAlertDraftForSend(draft);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid: false with errors when validation fails", () => {
    const draft = createDraft({
      intent: "ENTER",
      editablePrices: {
        entry: 0, // Invalid: $0.00
        current: 5.0,
        target: 7.5,
        stop: 4.0,
      },
    });
    const result = validateAlertDraftForSend(draft);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toContain("Entry price must be greater than $0.00");
  });

  it("accumulates multiple validation errors", () => {
    const draft = createDraft({
      intent: "ENTER",
      editablePrices: {
        entry: 0, // Invalid
        // target missing
        // stop missing
      },
      channels: [], // Invalid when sendAlert is true
      sendAlert: true,
    });
    const result = validateAlertDraftForSend(draft);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
