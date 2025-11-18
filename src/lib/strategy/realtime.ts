import { createClient } from '../supabase/client';
import type { StrategySignal } from '../../types/strategy';
import { mapStrategySignalRow } from '../../types/strategy';

export type StrategySignalListener = (signal: StrategySignal) => void;

export function subscribeToStrategySignals(owner: string, onSignal: StrategySignalListener): () => void {
  const supabase = createClient();

  // Guard: if realtime disabled or client not available
  const channel = supabase.channel(`strategy_signals:${owner}`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'strategy_signals', filter: `owner=eq.${owner}` },
    (payload: any) => {
      try {
        const row = payload.new;
        if (!row) return;
        const sig = mapStrategySignalRow(row);
        onSignal(sig);
      } catch (e) {
        console.error('[v0] subscribeToStrategySignals handler error', e);
      }
    }
  );

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[v0] Realtime subscribed to strategy_signals for owner', owner);
    }
  });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}
