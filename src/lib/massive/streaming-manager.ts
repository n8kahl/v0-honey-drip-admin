/**
 * Thin adapter to align legacy StreamingManager import usages
 * with the unified TransportPolicy implementation.
 *
 * All subscriptions are delegated to createTransport();
 * REST fallback, batching, staleness, and reconnection are handled there.
 *
 * DEDUPLICATION: Multiple subscribers to the same symbol share a single transport.
 */
import { createTransport, type TransportCallback } from "./transport-policy";

export type StreamChannel = "quotes" | "agg1s" | "options" | "indices";

export interface StreamData {
  symbol: string;
  data: any;
  timestamp: number;
  source: "websocket" | "rest";
  channel: StreamChannel;
}

type StreamCallback = (data: StreamData) => void;

interface SubscriptionEntry {
  callbacks: Set<StreamCallback>;
  cleanup: (() => void) & { setFetchingBars?: (value: boolean) => void };
  channel: StreamChannel;
  refCount: number;
}

// Global subscription registry for deduplication
const subscriptions = new Map<string, SubscriptionEntry>();

function getSubscriptionKey(symbol: string, channel: StreamChannel): string {
  return `${symbol}:${channel}`;
}

class StreamingManager {
  subscribe(
    symbol: string,
    channels: StreamChannel[],
    callback: StreamCallback,
    options?: { isOption?: boolean; isIndex?: boolean; pollInterval?: number }
  ): () => void {
    const channel: StreamChannel = options?.isIndex
      ? "indices"
      : options?.isOption
        ? "options"
        : channels.includes("agg1s")
          ? "agg1s"
          : "quotes";

    const key = getSubscriptionKey(symbol, channel);

    // Check for existing subscription
    const existing = subscriptions.get(key);
    if (existing) {
      // Add callback to existing subscription
      existing.callbacks.add(callback);
      existing.refCount++;
      // Reusing existing subscription - refCount tracking for cleanup

      // Return unsubscribe function
      return () => {
        existing.callbacks.delete(callback);
        existing.refCount--;
        // Unsubscribed - refCount tracking for cleanup

        // Clean up transport when no more subscribers
        if (existing.refCount <= 0) {
          // Cleaning up transport - no more subscribers
          existing.cleanup();
          subscriptions.delete(key);
        }
      };
    }

    // Create new subscription with multiplexing callback
    const callbackSet = new Set<StreamCallback>([callback]);

    const transportCb: TransportCallback = (quote, source, ts) => {
      const data: StreamData = { symbol, data: quote, timestamp: ts, source, channel };
      // Fan out to all subscribers
      for (const cb of callbackSet) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[StreamingManager] Callback error for ${key}:`, e);
        }
      }
    };

    const cleanup = createTransport(symbol, transportCb, options);

    const entry: SubscriptionEntry = {
      callbacks: callbackSet,
      cleanup,
      channel,
      refCount: 1,
    };

    subscriptions.set(key, entry);
    // Created new subscription

    // Return unsubscribe function
    return () => {
      entry.callbacks.delete(callback);
      entry.refCount--;
      // Unsubscribed - refCount tracking

      // Clean up transport when no more subscribers
      if (entry.refCount <= 0) {
        // Cleaning up transport - no more subscribers
        entry.cleanup();
        subscriptions.delete(key);
      }
    };
  }

  // Legacy helpers kept as no-ops/compatibility
  unsubscribe(handle?: (() => void) | null) {
    if (typeof handle === "function") handle();
  }

  getAllSubscriptions(): string[] {
    return Array.from(subscriptions.keys());
  }

  getSubscriptionCount(): number {
    return subscriptions.size;
  }

  disconnectAll() {
    // Disconnecting all subscriptions
    for (const [_key, entry] of subscriptions) {
      entry.cleanup();
    }
    subscriptions.clear();
  }
}

export const streamingManager = new StreamingManager();
export { StreamingManager as StreamingManagerClass };
