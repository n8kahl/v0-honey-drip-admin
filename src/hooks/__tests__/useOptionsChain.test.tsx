import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useOptionsChain } from '../useMassiveData';

vi.mock('../../services/options', () => {
  return {
    fetchNormalizedChain: vi.fn(async (_symbol: string, window = 8) => {
      const baseDate = new Date('2025-01-01');
      const mk = (i: number) => ({
        id: `AAPL-${i}`,
        strike: 100 + i,
        expiry: `2025-01-${(i % 28) + 1}`,
        expiryDate: new Date(baseDate.getTime() + i * 86400000),
        daysToExpiry: i,
        type: i % 2 === 0 ? 'C' : 'P',
        mid: 1 + i * 0.1,
        bid: 1 + i * 0.1,
        ask: 1.2 + i * 0.1,
        volume: 0,
        openInterest: 0,
      });
      return Array.from({ length: window * 10 }, (_, i) => mk(i + 1));
    }),
  };
});

function TestComponent({ symbol, window = 8 }: { symbol: string; window?: number }) {
  const { contracts, loading, error, asOf } = useOptionsChain(symbol, window);
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="error">{error || ''}</div>
      <div data-testid="count">{contracts.length}</div>
      <div data-testid="asOf">{asOf ? 'set' : 'unset'}</div>
    </div>
  );
}

describe('useOptionsChain', () => {
  it('fetches normalized contracts with 8+ expirations (window=8)', async () => {
    render(<TestComponent symbol="AAPL" window={8} />);

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    const count = Number(screen.getByTestId('count').textContent);
    expect(count).toBeGreaterThanOrEqual(80);
    expect(screen.getByTestId('asOf').textContent).toBe('set');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('accepts larger window values for more expirations', async () => {
    render(<TestComponent symbol="AAPL" window={12} />);

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    const count = Number(screen.getByTestId('count').textContent);
    expect(count).toBeGreaterThanOrEqual(120);
  });
});
