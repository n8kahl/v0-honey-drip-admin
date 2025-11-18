/**
 * Thin adapter to align legacy StreamingManager import usages
 * with the unified TransportPolicy implementation.
 *
 * All subscriptions are delegated to createTransport();
 * REST fallback, batching, staleness, and reconnection are handled there.
 */
import { createTransport, type TransportCallback } from './transport-policy';

export type StreamChannel = 'quotes' | 'agg1s' | 'options' | 'indices';

export interface StreamData {
  symbol: string;
  data: any;
  timestamp: number;
  source: 'websocket' | 'rest';
  channel: StreamChannel;
}

type StreamCallback = (data: StreamData) => void;

class StreamingManager {
  subscribe(
    symbol: string,
    channels: StreamChannel[],
    callback: StreamCallback,
    options?: { isOption?: boolean; isIndex?: boolean; pollInterval?: number }
  ): () => void {
    const channel: StreamChannel = options?.isIndex
      ? 'indices'
      : options?.isOption
      ? 'options'
      : channels.includes('agg1s')
      ? 'agg1s'
      : 'quotes';

    const transportCb: TransportCallback = (quote, source, ts) => {
      callback({ symbol, data: quote, timestamp: ts, source, channel });
    };

    return createTransport(symbol, transportCb, options);
  }

  // Legacy helpers kept as no-ops/compatibility
  unsubscribe(handle?: (() => void) | null) {
    if (typeof handle === 'function') handle();
  }

  getAllSubscriptions(): any[] {
    return [];
  }

  disconnectAll() {
    // No central registry in transport-policy; NOP.
  }
}

export const streamingManager = new StreamingManager();
export { StreamingManager as StreamingManagerClass };
