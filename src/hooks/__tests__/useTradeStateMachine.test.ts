import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTradeStateMachine } from "../useTradeStateMachine";
import { Trade, Ticker, Contract } from "../../types";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user-123" },
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
  })),
}));

vi.mock("../../lib/riskEngine/calculator", () => ({
  calculateRisk: vi.fn(() => ({
    targetPrice: 5.0,
    stopLoss: 2.0,
  })),
}));

vi.mock("../../lib/riskEngine/profiles", () => ({
  inferTradeTypeByDTE: vi.fn(() => "DAY"),
  DEFAULT_DTE_THRESHOLDS: { scalp: 2, day: 14, swing: 60 },
  RISK_PROFILES: {
    DAY: {
      tfPrimary: "1m",
      tfSecondary: "15m",
      atrTF: "5m",
      atrLen: 14,
      vwap: "session",
      useLevels: ["VWAP", "ORB"],
      levelWeights: { VWAP: 1.0, ORB: 0.8 },
      tpATRFrac: [0.4, 0.8],
      slATRFrac: 0.25,
      trailStep: 0.15,
    },
  },
}));

vi.mock("../../lib/riskEngine/confluenceAdjustment", () => ({
  adjustProfileByConfluence: vi.fn((profile) => profile),
}));

vi.mock("../useDiscord", () => ({
  useDiscord: () => ({
    sendLoadAlert: vi.fn(async () => ({ success: 0, failed: 0 })),
    sendEntryAlert: vi.fn(async () => ({ success: 0, failed: 0 })),
    sendUpdateAlert: vi.fn(async () => ({ success: 0, failed: 0 })),
    sendTrailingStopAlert: vi.fn(async () => ({ success: 0, failed: 0 })),
    sendExitAlert: vi.fn(async () => ({ success: 0, failed: 0 })),
  }),
}));

vi.mock("../../lib/supabase/database", () => ({
  recordAlertHistory: vi.fn(async () => undefined),
}));

vi.mock("../../lib/api/tradeApi", () => ({
  createTradeApi: vi.fn(async (userId, trade) => ({
    id: "db-trade-id-123",
    ...trade,
  })),
  updateTradeApi: vi.fn(async () => ({})),
  addTradeUpdateApi: vi.fn(async () => ({})),
  linkChannelsApi: vi.fn(async () => ({})),
  linkChallengesApi: vi.fn(async () => ({})),
}));

describe("useTradeStateMachine", () => {
  const mockTicker: Ticker = {
    id: "ticker-1",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    last: 450.0,
    changePercent: 0.5,
  };

  const mockContract: Contract = {
    id: "contract-1",
    ticker: "SPY",
    strike: 450,
    expiry: "2025-12-20",
    expiryDate: new Date("2025-12-20"),
    daysToExpiry: 33,
    type: "C",
    bid: 3.0,
    ask: 3.2,
    mid: 3.1,
    iv: 0.25,
    delta: 0.5,
    gamma: 0.02,
    theta: -0.05,
    vega: 0.15,
    volume: 1000,
    openInterest: 5000,
  };

  it("should initialize in WATCHING state", () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    expect(result.current.tradeState).toBe("WATCHING");
    expect(result.current.currentTrade).toBeNull();
    expect(result.current.activeTicker).toBeNull();
  });

  it.skip("should transition WATCHING → LOADED on contract select and load", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });

    expect(result.current.activeTicker).toEqual(mockTicker);

    // Step 1: Contract select creates preview (stays in WATCHING)
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });

    expect(result.current.tradeState).toBe("WATCHING"); // Preview state
    expect(result.current.currentTrade).toBeTruthy();
    expect(result.current.currentTrade?.ticker).toBe("SPY");
    expect(result.current.currentTrade?.contract).toEqual(mockContract);
    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe("load");

    // Step 2: Send "load" alert to persist and transition to LOADED
    await act(async () => {
      await result.current.actions.handleSendAlert(["channel-1"], [], "Loading SPY 450C");
    });

    expect(result.current.tradeState).toBe("LOADED");
    expect(result.current.currentTrade?.state).toBe("LOADED");
  });

  it.skip("should transition LOADED → ENTERED on enter trade", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });

    // Contract select creates preview
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });

    // Load the trade to transition to LOADED state
    await act(async () => {
      await result.current.actions.handleSendAlert(["channel-1"], [], "Loading");
    });

    expect(result.current.tradeState).toBe("LOADED");

    await act(async () => {
      await result.current.actions.handleEnterTrade(["channel-1"], ["challenge-1"], "Test entry");
    });

    expect(result.current.tradeState).toBe("ENTERED");
    expect(result.current.currentTrade?.state).toBe("ENTERED");
    expect(result.current.currentTrade?.entryPrice).toBe(mockContract.mid);
    expect(result.current.currentTrade?.updates).toHaveLength(1);
    expect(result.current.currentTrade?.updates[0].type).toBe("enter");
  });

  it.skip("should add trim update to ENTERED trade", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    // Setup: WATCHING → LOADED → ENTERED
    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade(["channel-1"], ["challenge-1"]);
    });

    expect(result.current.tradeState).toBe("ENTERED");

    // Trigger trim alert
    act(() => {
      result.current.actions.handleTrim();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe("update");

    // Send trim alert
    act(() => {
      result.current.actions.handleSendAlert(["channel-1"], [], "Trimmed 50%");
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe("trim");
  });

  it.skip("should transition ENTERED → EXITED on exit", async () => {
    const onExitedTrade = vi.fn();
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade,
      })
    );

    // Setup: WATCHING → LOADED → ENTERED
    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });
    await act(async () => {
      await result.current.actions.handleSendAlert(["channel-1"], [], "Loading");
    });
    await act(async () => {
      await result.current.actions.handleEnterTrade(["channel-1"], []);
    });

    expect(result.current.tradeState).toBe("ENTERED");

    // Trigger exit alert
    act(() => {
      result.current.actions.handleExit();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe("exit");

    // Send exit alert
    await act(async () => {
      await result.current.actions.handleSendAlert(["channel-1"], [], "Closed position");
    });

    // After exit, currentTrade is cleared and onExitedTrade callback is called
    expect(result.current.currentTrade).toBeNull();
    expect(result.current.tradeState).toBe("WATCHING");
    expect(onExitedTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "EXITED",
        updates: expect.arrayContaining([
          expect.objectContaining({ type: "enter" }),
          expect.objectContaining({ type: "exit" }),
        ]),
      })
    );
  });

  it.skip("should add update-sl alert to ENTERED trade", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    // Setup: WATCHING → LOADED → ENTERED
    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade();
    });

    // Trigger update-sl alert
    act(() => {
      result.current.actions.handleUpdateSL();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertOptions.updateKind).toBe("sl");

    // Send update-sl alert
    act(() => {
      result.current.actions.handleSendAlert(["channel-1"], [], "SL moved to breakeven");
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe("update-sl");
  });

  it.skip("should handle discard from LOADED state", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    // Setup: WATCHING → LOADED
    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });
    await act(async () => {
      await result.current.actions.handleSendAlert(["channel-1"], [], "Loading");
    });

    expect(result.current.tradeState).toBe("LOADED");

    // Discard loaded trade
    act(() => {
      result.current.actions.handleDiscard();
    });

    expect(result.current.tradeState).toBe("WATCHING");
    expect(result.current.currentTrade).toBeNull();
  });

  it.skip("should add trail-stop update to ENTERED trade", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    // Setup: WATCHING → LOADED → ENTERED
    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade();
    });

    // Trigger trail-stop alert
    act(() => {
      result.current.actions.handleTrailStop();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe("trail-stop");

    // Send trail-stop alert
    act(() => {
      result.current.actions.handleSendAlert(["channel-1"], [], "Trailing stop activated");
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe("trail-stop");
  });

  it.skip("should add position (add alert) to ENTERED trade", async () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    // Setup: WATCHING → LOADED → ENTERED
    act(() => {
      result.current.actions.handleTickerClick(mockTicker);
    });
    await act(async () => {
      await result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade();
    });

    // Trigger add alert
    act(() => {
      result.current.actions.handleAdd();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe("add");

    // Send add alert
    act(() => {
      result.current.actions.handleSendAlert(["channel-1"], [], "Added 2 more contracts");
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe("add");
  });

  describe("handleLoadStrategy", () => {
    // Note: These tests require proper Zustand store mocking.
    // The handleLoadStrategy function directly persists to DB and updates the store.
    // Similar to the other .skip tests above, these need full store mocking to pass.

    it("should expose handleLoadStrategy action", () => {
      const { result } = renderHook(() => useTradeStateMachine());

      // Verify the action exists
      expect(result.current.actions.handleLoadStrategy).toBeDefined();
      expect(typeof result.current.actions.handleLoadStrategy).toBe("function");
    });

    it.skip("should directly create LOADED trade from contract select (skipping WATCHING)", async () => {
      // Requires: useTradeStore mock with loadTrades, setCurrentTradeId, setActiveTrades
      // Expected behavior:
      // 1. After handleLoadStrategy(contract): tradeState === "LOADED"
      // 2. currentTrade.state === "LOADED"
      // 3. activeTrades contains the new trade
      const { result } = renderHook(() => useTradeStateMachine());

      act(() => {
        result.current.actions.handleTickerClick(mockTicker);
      });

      await act(async () => {
        result.current.actions.handleLoadStrategy(mockContract, { tradeType: "day" });
      });

      expect(result.current.tradeState).toBe("LOADED");
      expect(result.current.currentTrade?.state).toBe("LOADED");
      expect(result.current.activeTrades).toHaveLength(1);
    });

    it.skip("should persist trade to database via createTradeApi", async () => {
      // Requires: useTradeStore mock, createTradeApi mock verification
      // Expected: createTradeApi called with { state: "LOADED", contract, ticker }
      const { createTradeApi } = await import("../../lib/api/tradeApi");
      const { result } = renderHook(() => useTradeStateMachine());

      act(() => {
        result.current.actions.handleTickerClick(mockTicker);
      });

      await act(async () => {
        result.current.actions.handleLoadStrategy(mockContract);
      });

      expect(createTradeApi).toHaveBeenCalledWith(
        "test-user-123",
        expect.objectContaining({
          ticker: "SPY",
          state: "LOADED",
          contract: mockContract,
        })
      );
    });

    it.skip("should calculate TP/SL using risk engine", async () => {
      // Requires: Full store mock setup
      // Expected: currentTrade has targetPrice and stopLoss defined
      const { result } = renderHook(() => useTradeStateMachine());

      act(() => {
        result.current.actions.handleTickerClick(mockTicker);
      });

      await act(async () => {
        result.current.actions.handleLoadStrategy(mockContract);
      });

      expect(result.current.currentTrade?.targetPrice).toBeDefined();
      expect(result.current.currentTrade?.stopLoss).toBeDefined();
    });

    it.skip("should not show alert dialog after load strategy (silent load)", async () => {
      // Requires: Full store mock setup
      // Expected: showAlert === false (no alert composer shown)
      const { result } = renderHook(() => useTradeStateMachine());

      act(() => {
        result.current.actions.handleTickerClick(mockTicker);
      });

      await act(async () => {
        result.current.actions.handleLoadStrategy(mockContract);
      });

      expect(result.current.showAlert).toBe(false);
    });
  });
});
