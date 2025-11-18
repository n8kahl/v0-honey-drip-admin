import { useEffect, useMemo, useRef, useState } from 'react';
import type { StrategySignal } from '../types/strategy';
import { subscribeToStrategySignals } from '../lib/strategy/realtime';

export interface StrategySignalsBySymbol {
  [symbol: string]: StrategySignal[];
}

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useStrategySignals(owner: string | null): StrategySignalsBySymbol {
  const [signals, setSignals] = useState<StrategySignalsBySymbol>({});
  const lastSeenBySymbol = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!owner) return;

  const unsubscribe = subscribeToStrategySignals(owner, (sig: StrategySignal) => {
      setSignals((prev) => {
        const list = prev[sig.symbol] ? [...prev[sig.symbol]] : [];
        list.push(sig);
        // prune by age
        const now = Date.now();
        const pruned = list.filter((s) => now - new Date(s.createdAt).getTime() <= MAX_AGE_MS);
        return { ...prev, [sig.symbol]: pruned };
      });
      // track last seen for potential flash effects in UI
      lastSeenBySymbol.current[sig.symbol] = sig.createdAt;
    });

    return () => {
      unsubscribe?.();
      setSignals({});
    };
  }, [owner]);

  // Optionally memoize to avoid re-renders
  return useMemo(() => signals, [signals]);
}

export function useStrategySignalsForSymbol(owner: string | null, symbol: string | null): StrategySignal[] {
  const all = useStrategySignals(owner);
  if (!owner || !symbol) return [];
  return all[symbol] || [];
}
