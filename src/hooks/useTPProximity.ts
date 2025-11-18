import { useEffect, useMemo, useRef, useState } from 'react';
import type { Trade } from '../types';

export interface TPProximity {
  progress: number; // 0..1+ relative progress toward TP
  nearing: boolean; // >= threshold and < 1
  reached: boolean; // >= 1
  threshold: number; // configured threshold (0..1)
  justCrossed: boolean; // became nearing on this render
}

/**
 * Track proximity to Take Profit for an entered trade based on option premium.
 * Falls back to a synthetic TP if trade.targetPrice is undefined.
 */
export function useTPProximity(
  trade: Trade | null,
  currentPrice?: number,
  opts?: { threshold?: number }
): TPProximity {
  const threshold = Math.min(Math.max(opts?.threshold ?? 0.85, 0.5), 0.99);

  const entry = trade?.entryPrice ?? trade?.contract.mid ?? 0;
  const target = trade?.targetPrice ?? (trade ? (trade.contract.mid * 1.5) : 0);

  const denom = Math.max(1e-9, target - entry); // avoid div by zero / negative
  const progress = useMemo(() => {
    if (!trade || !currentPrice || entry <= 0 || target <= 0 || target <= entry) return 0;
    return (currentPrice - entry) / denom;
  }, [trade?.id, currentPrice, entry, target, denom]);

  const nearing = progress >= threshold && progress < 1;
  const reached = progress >= 1;

  const prevNearingRef = useRef(false);
  const [justCrossed, setJustCrossed] = useState(false);

  useEffect(() => {
    if (nearing && !prevNearingRef.current) {
      setJustCrossed(true);
    } else {
      setJustCrossed(false);
    }
    prevNearingRef.current = nearing;
  }, [nearing]);

  return { progress, nearing, reached, threshold, justCrossed };
}
