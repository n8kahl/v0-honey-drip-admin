import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTransport } from "../transport-policy";

// Mocks
vi.mock("../websocket", () => {
  const subscribers: Record<string, (msg: any) => void> = {};
  return {
    massive: {
      getConnectionState: vi.fn(() => "open" as const),
      subscribeQuotes: vi.fn((symbols: string[], cb: any) => {
        // store per-symbol callback for tests
        symbols.forEach((s) => {
          subscribers[`quote:${s}`] = cb;
        });
        return () => {
          symbols.forEach((s) => delete subscribers[`quote:${s}`]);
        };
      }),
      subscribeOptionQuotes: vi.fn((symbols: string[], cb: any) => {
        symbols.forEach((s) => {
          subscribers[`option:${s}`] = cb;
        });
        return () => {
          symbols.forEach((s) => delete subscribers[`option:${s}`]);
        };
      }),
      subscribeIndices: vi.fn((symbols: string[], cb: any) => {
        symbols.forEach((s) => {
          subscribers[`index:${s}`] = cb;
        });
        return () => {
          symbols.forEach((s) => delete subscribers[`index:${s}`]);
        };
      }),
      connect: vi.fn(),
      // helper to emit messages in tests
      __emit(symbol: string, payload: any, type: "quote" | "option" | "index" = "quote") {
        const key = `${type}:${symbol}`;
        const cb = subscribers[key];
        if (cb) {
          cb({ type, data: payload, timestamp: Date.now() });
        }
      },
    },
  };
});

vi.mock("../client", () => {
  return {
    massive: {
      cancel: vi.fn(),
      getQuotes: vi.fn(async (symbols: string[]) => {
        return symbols.map((s) => ({
          symbol: s,
          last: 123.45,
          change: 1.23,
          changePercent: 1.0,
          volume: 1000,
          timestamp: Date.now(),
        }));
      }),
      getOptionsSnapshot: vi.fn(async (_ticker: string) => ({
        results: [
          {
            symbol: _ticker,
            last: 2.5,
            change: 0.1,
            changePercent: 4.0,
            bid: 2.4,
            ask: 2.6,
            volume: 100,
            timestamp: Date.now(),
          },
        ],
      })),
      getIndex: vi.fn(async (sym: string) => ({
        symbol: sym.replace(/^I:/, ""),
        value: 5000,
        open: 4990,
        high: 5010,
        low: 4980,
        timestamp: Date.now(),
      })),
      getMarketStatus: vi.fn(async () => ({ market: "open" })),
    },
  };
});

// Import after mocks
import { massive } from "../websocket";
import { massive as massiveClient } from "../client";

const flushPromises = async () => new Promise((r) => setTimeout(r, 0));

describe("TransportPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T14:00:00Z"));
    vi.mocked(massive.getConnectionState).mockReturnValue("open");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("delivers websocket updates (batched to last message)", async () => {
    const received: any[] = [];
    const unsubscribe = createTransport(
      "AAPL",
      (quote, source, ts) => {
        received.push({ quote, source, ts });
      },
      {}
    );

    // Emit two quick WS messages
    const now = Date.now();
    // @ts-expect-error test helper on mock
    massive.__emit("AAPL", {
      symbol: "AAPL",
      last: 100,
      change: 1,
      changePercent: 1,
      timestamp: now,
    });
    // @ts-expect-error test helper on mock
    massive.__emit("AAPL", {
      symbol: "AAPL",
      last: 101,
      change: 2,
      changePercent: 2,
      timestamp: now + 10,
    });

    // Batch flush interval is 100ms
    vi.advanceTimersByTime(120);
    await flushPromises();

    expect(received.length).toBe(1);
    expect(received[0].source).toBe("websocket");
    expect(received[0].quote.last).toBe(101);

    unsubscribe();
  });

  it("falls back to REST when websocket is closed", async () => {
    vi.mocked(massive.getConnectionState).mockReturnValue("closed");

    const received: any[] = [];
    const unsubscribe = createTransport(
      "SPY",
      (quote, source) => {
        received.push({ quote, source });
      },
      {}
    );

    // pollData runs immediately; let promises flush
    await flushPromises();

    expect(massive.getQuotes).toHaveBeenCalledWith(["SPY"]);
    expect(received.length).toBe(1);
    expect(received[0].source).toBe("rest");
    expect(received[0].quote.symbol).toBe("SPY");

    unsubscribe();
  });

  it("switches to REST on staleness (health check)", async () => {
    // Start with WS open but never emit; health check every 2s, threshold 2 failures -> activate REST
    const received: any[] = [];
    const unsubscribe = createTransport("AAPL", (quote, source) => {
      received.push({ quote, source });
    });

    // No WS messages -> health check will consider stale after two cycles
    vi.advanceTimersByTime(4000);
    await flushPromises();

    // A REST poll should have occurred
    expect(massive.getQuotes).toHaveBeenCalled();
    const hasRest = received.some((r) => r.source === "rest");
    expect(hasRest).toBe(true);

    unsubscribe();
  });

  it("handles indices subscription normalization (I: prefix stripping)", async () => {
    const received: any[] = [];
    const unsubscribe = createTransport(
      "SPX",
      (quote, source) => received.push({ quote, source }),
      { isIndex: true }
    );

    // Emit index update with A message shape
    // @ts-expect-error test helper on mock
    massive.__emit(
      "SPX",
      { symbol: "SPX", last: 5001, open: 5000, high: 5005, low: 4995, timestamp: Date.now() },
      "index"
    );

    vi.advanceTimersByTime(120);
    await flushPromises();

    expect(received.length).toBe(1);
    expect(received[0].source).toBe("websocket");
    expect(received[0].quote.symbol).toBe("SPX");

    unsubscribe();
  });

  it("stops REST polling after websocket recovery", async () => {
    // Start with WS closed to trigger REST
    vi.mocked(massive.getConnectionState).mockReturnValue("closed");

    const received: any[] = [];
    const unsubscribe = createTransport("MSFT", (quote, source) =>
      received.push({ quote, source })
    );

    await flushPromises();
    expect(massive.getQuotes).toHaveBeenCalledTimes(1);

    // Now WS becomes open and emits an update; REST should stop
    vi.mocked(massive.getConnectionState).mockReturnValue("open");
    // @ts-expect-error test helper on mock
    massive.__emit(
      "MSFT",
      { symbol: "MSFT", last: 222, change: 2, changePercent: 0.9, timestamp: Date.now() },
      "quote"
    );
    vi.advanceTimersByTime(150);
    await flushPromises();

    const callsAfter = vi.mocked(massive.getQuotes).mock.calls.length;
    // Advance time well beyond polling interval
    vi.advanceTimersByTime(6000);
    await flushPromises();
    expect(vi.mocked(massive.getQuotes).mock.calls.length).toBe(callsAfter);

    unsubscribe();
  });

  it("unsubscribe cleans up and cancels in-flight requests", async () => {
    const unsubscribe = createTransport("QQQ", () => {});

    unsubscribe();

    // Advance timers to ensure no callbacks or polls scheduled
    vi.advanceTimersByTime(10000);
    expect(massive.cancel).toHaveBeenCalled();
  });
});
