import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTradeStateMachine } from '../useTradeStateMachine';
import { Trade, Ticker, Contract } from '../../types';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/riskEngine/calculator', () => ({
  calculateRisk: vi.fn(() => ({
    targetPrice: 5.0,
    stopLoss: 2.0,
  })),
}));

vi.mock('../../lib/riskEngine/profiles', () => ({
  inferTradeTypeByDTE: vi.fn(() => 'DAY'),
  DEFAULT_DTE_THRESHOLDS: { scalp: 2, day: 14, swing: 60 },
  RISK_PROFILES: {
    DAY: {
      tfPrimary: '1m',
      tfSecondary: '15m',
      atrTF: '5m',
      atrLen: 14,
      vwap: 'session',
      useLevels: ['VWAP', 'ORB'],
      levelWeights: { VWAP: 1.0, ORB: 0.8 },
      tpATRFrac: [0.4, 0.8],
      slATRFrac: 0.25,
      trailStep: 0.15,
    },
  },
}));

vi.mock('../../lib/riskEngine/confluenceAdjustment', () => ({
  adjustProfileByConfluence: vi.fn((profile) => profile),
}));

describe('useTradeStateMachine', () => {
  const mockTicker: Ticker = {
    id: 'ticker-1',
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    last: 450.0,
    changePercent: 0.5,
  };

  const mockContract: Contract = {
    id: 'contract-1',
    ticker: 'SPY',
    strike: 450,
    expiry: '2025-12-20',
    expiryDate: new Date('2025-12-20'),
    daysToExpiry: 33,
    type: 'C',
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

  it('should initialize in WATCHING state', () => {
    const { result } = renderHook(() =>
      useTradeStateMachine({
        hotTrades: [],
        onTradesChange: vi.fn(),
        onExitedTrade: vi.fn(),
      })
    );

    expect(result.current.tradeState).toBe('WATCHING');
    expect(result.current.currentTrade).toBeNull();
    expect(result.current.activeTicker).toBeNull();
  });

  it('should transition WATCHING → LOADED on contract select', () => {
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

    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });

    expect(result.current.tradeState).toBe('LOADED');
    expect(result.current.currentTrade).toBeTruthy();
    expect(result.current.currentTrade?.ticker).toBe('SPY');
    expect(result.current.currentTrade?.contract).toEqual(mockContract);
  });

  it('should transition LOADED → ENTERED on enter trade', () => {
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

    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });

    expect(result.current.tradeState).toBe('LOADED');

    act(() => {
      result.current.actions.handleEnterTrade(['channel-1'], ['challenge-1'], 'Test entry');
    });

    expect(result.current.tradeState).toBe('ENTERED');
    expect(result.current.currentTrade?.state).toBe('ENTERED');
    expect(result.current.currentTrade?.entryPrice).toBe(mockContract.mid);
    expect(result.current.currentTrade?.updates).toHaveLength(1);
    expect(result.current.currentTrade?.updates[0].type).toBe('enter');
  });

  it('should add trim update to ENTERED trade', () => {
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
    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade(['channel-1'], ['challenge-1']);
    });

    expect(result.current.tradeState).toBe('ENTERED');

    // Trigger trim alert
    act(() => {
      result.current.actions.handleTrim();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe('update');

    // Send trim alert
    act(() => {
      result.current.actions.handleSendAlert(['channel-1'], [], 'Trimmed 50%');
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe('trim');
  });

  it('should transition ENTERED → EXITED on exit', () => {
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
    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade(['channel-1'], []);
    });

    expect(result.current.tradeState).toBe('ENTERED');

    // Trigger exit alert
    act(() => {
      result.current.actions.handleExit();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe('exit');

    // Send exit alert
    act(() => {
      result.current.actions.handleSendAlert(['channel-1'], [], 'Closed position');
    });

    expect(result.current.currentTrade?.state).toBe('EXITED');
    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe('exit');
    expect(onExitedTrade).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'EXITED' })
    );
  });

  it('should add update-sl alert to ENTERED trade', () => {
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
    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade();
    });

    // Trigger update-sl alert
    act(() => {
      result.current.actions.handleUpdateSL();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertOptions.updateKind).toBe('sl');

    // Send update-sl alert
    act(() => {
      result.current.actions.handleSendAlert(['channel-1'], [], 'SL moved to breakeven');
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe('update-sl');
  });

  it('should handle discard from LOADED state', () => {
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
    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });

    expect(result.current.tradeState).toBe('LOADED');

    // Discard loaded trade
    act(() => {
      result.current.actions.handleDiscard();
    });

    expect(result.current.tradeState).toBe('WATCHING');
    expect(result.current.currentTrade).toBeNull();
  });

  it('should add trail-stop update to ENTERED trade', () => {
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
    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade();
    });

    // Trigger trail-stop alert
    act(() => {
      result.current.actions.handleTrailStop();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe('trail-stop');

    // Send trail-stop alert
    act(() => {
      result.current.actions.handleSendAlert(['channel-1'], [], 'Trailing stop activated');
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe('trail-stop');
  });

  it('should add position (add alert) to ENTERED trade', () => {
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
    act(() => {
      result.current.actions.handleContractSelect(mockContract);
    });
    act(() => {
      result.current.actions.handleEnterTrade();
    });

    // Trigger add alert
    act(() => {
      result.current.actions.handleAdd();
    });

    expect(result.current.showAlert).toBe(true);
    expect(result.current.alertType).toBe('add');

    // Send add alert
    act(() => {
      result.current.actions.handleSendAlert(['channel-1'], [], 'Added 2 more contracts');
    });

    expect(result.current.currentTrade?.updates).toHaveLength(2);
    expect(result.current.currentTrade?.updates[1].type).toBe('add');
  });
});
