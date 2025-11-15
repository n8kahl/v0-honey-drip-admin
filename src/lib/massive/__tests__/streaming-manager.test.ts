import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingManager } from '../streaming-manager';

// Mock WebSocket
class MockWebSocket {
  readyState = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: any) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

global.WebSocket = MockWebSocket as any;

describe('StreamingManager', () => {
  let manager: StreamingManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token', expiresAt: Date.now() + 300000 }),
    });

    manager = new StreamingManager();
    mockWs = (manager as any).ws as MockWebSocket;
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('Subscription Management', () => {
    it('should subscribe to quotes and receive updates', () => {
      const callback = vi.fn();
      const handle = manager.subscribe('AAPL', ['quotes'], callback);

      mockWs.simulateOpen();
      mockWs.simulateMessage([{ 
        ev: 'status', 
        status: 'auth_success',
        message: 'authenticated' 
      }]);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('subscribe')
      );

      mockWs.simulateMessage([{
        ev: 'Q',
        sym: 'AAPL',
        bp: 175.0,
        ap: 175.1,
        t: Date.now(),
      }]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'quote',
          symbol: 'AAPL',
        })
      );

      handle.unsubscribe();
    });

    it('should handle multiple subscriptions for the same symbol', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const handle1 = manager.subscribe('AAPL', ['quotes'], callback1);
      const handle2 = manager.subscribe('AAPL', ['quotes'], callback2);

      mockWs.simulateOpen();
      mockWs.simulateMessage([{ ev: 'status', status: 'auth_success' }]);

      mockWs.simulateMessage([{
        ev: 'Q',
        sym: 'AAPL',
        bp: 175.0,
        ap: 175.1,
        t: Date.now(),
      }]);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      handle1.unsubscribe();
      handle2.unsubscribe();
    });

    it('should unsubscribe and stop receiving updates', () => {
      const callback = vi.fn();
      const handle = manager.subscribe('AAPL', ['quotes'], callback);

      mockWs.simulateOpen();
      mockWs.simulateMessage([{ ev: 'status', status: 'auth_success' }]);

      handle.unsubscribe();

      mockWs.simulateMessage([{
        ev: 'Q',
        sym: 'AAPL',
        bp: 175.0,
        ap: 175.1,
        t: Date.now(),
      }]);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Failover to REST', () => {
    it('should start REST polling when WebSocket disconnects', () => {
      const callback = vi.fn();
      manager.subscribe('AAPL', ['quotes'], callback);

      mockWs.simulateOpen();
      mockWs.simulateMessage([{ ev: 'status', status: 'auth_success' }]);

      // Simulate disconnect
      mockWs.simulateClose();

      // Fast-forward to trigger REST polling
      vi.advanceTimersByTime(3000);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/massive')
      );
    });

    it('should stop REST polling when WebSocket reconnects', () => {
      const callback = vi.fn();
      manager.subscribe('AAPL', ['quotes'], callback);

      mockWs.simulateOpen();
      mockWs.simulateMessage([{ ev: 'status', status: 'auth_success' }]);

      // Simulate disconnect and REST polling
      mockWs.simulateClose();
      vi.advanceTimersByTime(3000);

      const restCallCount = (global.fetch as any).mock.calls.length;

      // Simulate reconnect
      mockWs.simulateOpen();
      mockWs.simulateMessage([{ ev: 'status', status: 'auth_success' }]);

      vi.advanceTimersByTime(3000);

      // Should not make more REST calls after reconnect
      expect((global.fetch as any).mock.calls.length).toBe(restCallCount);
    });
  });

  describe('Stale Data Detection', () => {
    it('should detect stale WebSocket data after 5 seconds', () => {
      const callback = vi.fn();
      manager.subscribe('AAPL', ['quotes'], callback);

      mockWs.simulateOpen();
      mockWs.simulateMessage([{ ev: 'status', status: 'auth_success' }]);

      const oldTimestamp = Date.now() - 6000; // 6 seconds ago
      mockWs.simulateMessage([{
        ev: 'Q',
        sym: 'AAPL',
        bp: 175.0,
        ap: 175.1,
        t: oldTimestamp,
      }]);

      const call = callback.mock.calls[0][0];
      expect(call.isStale).toBe(true);
    });

    it('should detect stale REST data after 6 seconds', async () => {
      const callback = vi.fn();
      manager.subscribe('AAPL', ['quotes'], callback);

      // Simulate disconnect to trigger REST
      mockWs.simulateClose();

      const oldData = {
        results: [{
          T: 'AAPL',
          c: 175.0,
          t: Date.now() - 7000, // 7 seconds ago
        }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => oldData,
      });

      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      const call = callback.mock.calls[0][0];
      expect(call.isStale).toBe(true);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection with exponential backoff', () => {
      mockWs.simulateClose();

      // First reconnect after 1s
      vi.advanceTimersByTime(1000);
      expect((manager as any).reconnectAttempts).toBe(1);

      // Fail again
      mockWs.simulateClose();

      // Second reconnect after 2s
      vi.advanceTimersByTime(2000);
      expect((manager as any).reconnectAttempts).toBe(2);
    });

    it('should not reconnect after max attempts', () => {
      for (let i = 0; i < 5; i++) {
        mockWs.simulateClose();
        vi.advanceTimersByTime(10000);
      }

      expect((manager as any).reconnectAttempts).toBe(5);

      // Try once more
      mockWs.simulateClose();
      vi.advanceTimersByTime(10000);

      // Should stop at max attempts
      expect((manager as any).reconnectAttempts).toBe(5);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clean up all subscriptions on destroy', () => {
      const callbacks = Array.from({ length: 10 }, () => vi.fn());
      const handles = callbacks.map(cb => 
        manager.subscribe('AAPL', ['quotes'], cb)
      );

      expect((manager as any).subscriptions.size).toBe(1);

      manager.destroy();

      expect((manager as any).subscriptions.size).toBe(0);
      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should clear all timers on destroy', () => {
      manager.subscribe('AAPL', ['quotes'], vi.fn());
      mockWs.simulateClose(); // Trigger REST polling

      const activeTimers = vi.getTimerCount();
      manager.destroy();

      expect(vi.getTimerCount()).toBeLessThan(activeTimers);
    });
  });
});
