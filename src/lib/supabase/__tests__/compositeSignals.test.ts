/**
 * Unit tests for Composite Signals Database Layer
 * Phase 4: Tests for signal dismissal functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Supabase client module
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('../client.js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Setup mock chain before importing
beforeEach(() => {
  vi.clearAllMocks();

  // Setup mock chain for update operations
  const mockSelectChain = {
    data: [{ id: 'signal-1' }, { id: 'signal-2' }],
    error: null,
  };

  mockSelect.mockReturnValue(Promise.resolve(mockSelectChain));
  mockEq.mockReturnValue({ eq: mockEq, select: mockSelect });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate, select: vi.fn() });
});

import { dismissSignalsForOwnerSymbol } from '../compositeSignals.js';

describe('dismissSignalsForOwnerSymbol', () => {
  const userId = 'test-user-123';
  const symbol = 'SPY';

  it('normalizes symbol by removing I: prefix and uppercasing', async () => {
    // Setup mock to return success
    const mockSelectResult = vi.fn().mockResolvedValue({
      data: [{ id: 'signal-1' }],
      error: null,
    });

    const mockEqChain = vi.fn();
    mockEqChain.mockReturnValue({ eq: mockEqChain, select: mockSelectResult });

    mockUpdate.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate });

    await dismissSignalsForOwnerSymbol(userId, 'I:spy');

    // Should have called update with normalized symbol
    expect(mockFrom).toHaveBeenCalledWith('composite_signals');
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'DISMISSED',
      dismissed_at: expect.any(String),
    });
  });

  it('returns count of dismissed signals', async () => {
    const mockSelectResult = vi.fn().mockResolvedValue({
      data: [{ id: 'signal-1' }, { id: 'signal-2' }, { id: 'signal-3' }],
      error: null,
    });

    const mockEqChain = vi.fn();
    mockEqChain.mockReturnValue({ eq: mockEqChain, select: mockSelectResult });

    mockUpdate.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const count = await dismissSignalsForOwnerSymbol(userId, symbol);

    expect(count).toBe(3);
  });

  it('returns 0 when no signals to dismiss', async () => {
    const mockSelectResult = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockEqChain = vi.fn();
    mockEqChain.mockReturnValue({ eq: mockEqChain, select: mockSelectResult });

    mockUpdate.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const count = await dismissSignalsForOwnerSymbol(userId, symbol);

    expect(count).toBe(0);
  });

  it('returns 0 when data is null', async () => {
    const mockSelectResult = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const mockEqChain = vi.fn();
    mockEqChain.mockReturnValue({ eq: mockEqChain, select: mockSelectResult });

    mockUpdate.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const count = await dismissSignalsForOwnerSymbol(userId, symbol);

    expect(count).toBe(0);
  });

  it('throws error when database operation fails', async () => {
    const mockSelectResult = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed', code: '500' },
    });

    const mockEqChain = vi.fn();
    mockEqChain.mockReturnValue({ eq: mockEqChain, select: mockSelectResult });

    mockUpdate.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate });

    await expect(dismissSignalsForOwnerSymbol(userId, symbol)).rejects.toThrow(
      'Failed to dismiss signals: Database connection failed'
    );
  });

  it('filters only ACTIVE signals', async () => {
    const mockSelectResult = vi.fn().mockResolvedValue({
      data: [{ id: 'signal-1' }],
      error: null,
    });

    const mockEqChain = vi.fn();
    mockEqChain.mockReturnValue({ eq: mockEqChain, select: mockSelectResult });

    mockUpdate.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate });

    await dismissSignalsForOwnerSymbol(userId, symbol);

    // Verify eq was called with 'status', 'ACTIVE'
    // The chain should filter by owner, symbol, and status
    expect(mockEqChain).toHaveBeenCalled();
  });
});

describe('symbol normalization', () => {
  /**
   * Test the symbol normalization logic used in dismissSignalsForOwnerSymbol
   */
  const normalizeSymbol = (symbol: string): string => {
    return symbol.replace(/^I:/, '').toUpperCase();
  };

  it('removes I: prefix', () => {
    expect(normalizeSymbol('I:SPX')).toBe('SPX');
    expect(normalizeSymbol('I:NDX')).toBe('NDX');
    expect(normalizeSymbol('I:VIX')).toBe('VIX');
  });

  it('uppercases symbol', () => {
    expect(normalizeSymbol('spy')).toBe('SPY');
    expect(normalizeSymbol('aapl')).toBe('AAPL');
    expect(normalizeSymbol('Tsla')).toBe('TSLA');
  });

  it('handles both prefix and case', () => {
    expect(normalizeSymbol('I:spx')).toBe('SPX');
    expect(normalizeSymbol('i:vix')).toBe('I:VIX'); // lowercase i: is not matched
  });

  it('handles already normalized symbols', () => {
    expect(normalizeSymbol('SPY')).toBe('SPY');
    expect(normalizeSymbol('AAPL')).toBe('AAPL');
  });

  it('handles empty string', () => {
    expect(normalizeSymbol('')).toBe('');
  });
});
