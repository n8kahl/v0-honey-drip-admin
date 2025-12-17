import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks must be defined before importing the store
vi.mock('../../lib/supabase/database', () => {
  return {
    getWatchlist: vi.fn(),
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
  };
});

vi.mock('../../lib/supabase/compositeSignals', () => {
  return {
    dismissSignalsForOwnerSymbol: vi.fn().mockResolvedValue(0),
  };
});

vi.mock('sonner', () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

import { useMarketStore } from '../marketStore';
import * as db from '../../lib/supabase/database';
import { toast } from 'sonner';

const USER_ID = 'user-1';

function getState() {
  return useMarketStore.getState();
}

function resetStore() {
  useMarketStore.setState({
    watchlist: [],
    quotes: new Map(),
    selectedTicker: null,
    isLoading: false,
    error: null,
  });
}

describe('useMarketStore watchlist', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('adds ticker using DB id and uppercases symbol', async () => {
    (db.addToWatchlist as any).mockResolvedValue({ id: 'db-1', symbol: 'aapl' });

    await getState().addTicker(USER_ID, {
      id: 'temp-0',
      symbol: 'aApL',
      last: 0,
      change: 0,
      changePercent: 0,
    });

    const { watchlist } = getState();
    expect(watchlist).toHaveLength(1);
    expect(watchlist[0].id).toBe('db-1');
    expect(watchlist[0].symbol).toBe('AAPL');
    expect((toast.success as any)).toHaveBeenCalled();
  });

  it('prevents duplicate add (client-side) and shows info toast', async () => {
    // Seed state with AAPL
    useMarketStore.setState({
      watchlist: [
        { id: 'db-1', symbol: 'AAPL', last: 0, change: 0, changePercent: 0 },
      ],
    } as any);

    await getState().addTicker(USER_ID, {
      id: 'temp-1',
      symbol: 'AaPl',
      last: 0,
      change: 0,
      changePercent: 0,
    });

    expect(db.addToWatchlist).not.toHaveBeenCalled();
    expect((toast.info as any)).toHaveBeenCalled();
    expect(getState().watchlist).toHaveLength(1);
  });

  it('handles blank symbol with error toast and no call', async () => {
    await getState().addTicker(USER_ID, {
      id: 't-2',
      symbol: '   ',
      last: 0,
      change: 0,
      changePercent: 0,
    });

    expect(db.addToWatchlist).not.toHaveBeenCalled();
    expect((toast.error as any)).toHaveBeenCalled();
    expect(getState().watchlist).toHaveLength(0);
  });

  it('removes ticker by DB id and shows success toast', async () => {
    (db.removeFromWatchlist as any).mockResolvedValue({});

    // Seed with two items
    useMarketStore.setState({
      watchlist: [
        { id: 'db-1', symbol: 'AAPL', last: 0, change: 0, changePercent: 0 },
        { id: 'db-2', symbol: 'SPY', last: 0, change: 0, changePercent: 0 },
      ],
    } as any);

    await getState().removeTicker(USER_ID, 'db-1');

    const { watchlist } = getState();
    expect(watchlist).toHaveLength(1);
    expect(watchlist[0].id).toBe('db-2');
    expect((toast.success as any)).toHaveBeenCalled();
  });

  it('loads watchlist mapping symbol and uppercasing', async () => {
    (db.getWatchlist as any).mockResolvedValue([
      { id: 'x1', symbol: 'spy' },
      { id: 'x2', symbol: 'spx' },
    ]);

    await getState().loadWatchlist(USER_ID);

    const { watchlist } = getState();
    expect(watchlist.map((t) => t.symbol)).toEqual(['SPY', 'SPX']);
  });
});
