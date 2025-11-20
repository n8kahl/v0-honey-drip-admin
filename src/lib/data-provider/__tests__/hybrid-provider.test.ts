/**
 * Unit Tests - Hybrid Provider
 * Tests fallback logic and provider selection
 *
 * @module data-provider/__tests__/hybrid-provider.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridOptionsProvider } from '../hybrid-provider';
import type { OptionChainData } from '../types';

// ============================================================================
// MOCKS
// ============================================================================

class MockMassiveProvider {
  getOptionChain = vi.fn();
  getOptionContract = vi.fn();
  getExpirations = vi.fn();
  getFlowData = vi.fn();
  subscribeToOption = vi.fn(() => () => {});
  subscribeToChain = vi.fn(() => () => {});
  subscribeToFlow = vi.fn(() => () => {});
}

class MockTradierProvider {
  getOptionChain = vi.fn();
  getOptionContract = vi.fn();
  getExpirations = vi.fn();
  getFlowData = vi.fn();
  subscribeToOption = vi.fn(() => () => {});
  subscribeToChain = vi.fn(() => () => {});
  subscribeToFlow = vi.fn(() => () => {});
}

const mockChain: OptionChainData = {
  underlying: 'SPY',
  underlyingPrice: 450,
  contracts: [
    {
      ticker: 'SPY   240119C00450000',
      rootSymbol: 'SPY',
      strike: 450,
      expiration: '2024-01-19',
      type: 'call',
      dte: 5,
      quote: {
        bid: 2.5,
        ask: 2.6,
        mid: 2.55,
      },
      greeks: {
        delta: 0.65,
        gamma: 0.02,
        theta: -0.05,
        vega: 0.15,
        iv: 0.22,
      },
      liquidity: {
        volume: 500,
        openInterest: 5000,
        spreadPercent: 0.39,
        spreadPoints: 0.10,
        liquidityQuality: 'excellent',
      },
      quality: {
        source: 'massive',
        isStale: false,
        hasWarnings: false,
        warnings: [],
        confidence: 100,
        updatedAt: Date.now(),
      },
    },
  ],
  quality: {
    source: 'massive',
    isStale: false,
    hasWarnings: false,
    warnings: [],
    confidence: 100,
    updatedAt: Date.now(),
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('HybridOptionsProvider', () => {
  let hybrid: HybridOptionsProvider;
  let massiveProvider: MockMassiveProvider;
  let tradierProvider: MockTradierProvider;

  beforeEach(() => {
    massiveProvider = new MockMassiveProvider();
    tradierProvider = new MockTradierProvider();

    // Cast to any to work around type checking
    hybrid = new HybridOptionsProvider(massiveProvider as any, tradierProvider as any);
  });

  // ===== EXPIRATIONS =====

  describe('getExpirations', () => {
    it('should use Massive as primary provider', async () => {
      massiveProvider.getExpirations.mockResolvedValue(['2024-01-19', '2024-02-16']);

      const result = await hybrid.getExpirations('SPY');

      expect(massiveProvider.getExpirations).toHaveBeenCalledWith('SPY', undefined);
      expect(tradierProvider.getExpirations).not.toHaveBeenCalled();
      expect(result).toEqual(['2024-01-19', '2024-02-16']);
    });

    it('should fallback to Tradier if Massive fails', async () => {
      massiveProvider.getExpirations.mockRejectedValue(new Error('Massive error'));
      tradierProvider.getExpirations.mockResolvedValue(['2024-01-19', '2024-02-16']);

      const result = await hybrid.getExpirations('SPY');

      expect(massiveProvider.getExpirations).toHaveBeenCalled();
      expect(tradierProvider.getExpirations).toHaveBeenCalled();
      expect(result).toEqual(['2024-01-19', '2024-02-16']);
    });

    it('should throw if both providers fail', async () => {
      massiveProvider.getExpirations.mockRejectedValue(new Error('Massive error'));
      tradierProvider.getExpirations.mockRejectedValue(new Error('Tradier error'));

      await expect(hybrid.getExpirations('SPY')).rejects.toThrow(
        'Both providers failed'
      );
    });

    it('should pass options to provider', async () => {
      massiveProvider.getExpirations.mockResolvedValue(['2024-01-19']);

      await hybrid.getExpirations('SPY', {
        minDate: '2024-01-01',
        maxDate: '2024-12-31',
      });

      expect(massiveProvider.getExpirations).toHaveBeenCalledWith('SPY', {
        minDate: '2024-01-01',
        maxDate: '2024-12-31',
      });
    });
  });

  // ===== OPTIONS CHAIN =====

  describe('getOptionChain', () => {
    it('should use Massive as primary provider', async () => {
      massiveProvider.getOptionChain.mockResolvedValue(mockChain);

      const result = await hybrid.getOptionChain('SPY');

      expect(massiveProvider.getOptionChain).toHaveBeenCalledWith('SPY', undefined);
      expect(tradierProvider.getOptionChain).not.toHaveBeenCalled();
      expect(result.quality.source).toBe('massive');
    });

    it('should fallback if Massive returns empty chain', async () => {
      const emptyChain = { ...mockChain, contracts: [] };
      massiveProvider.getOptionChain.mockResolvedValue(emptyChain);
      tradierProvider.getOptionChain.mockResolvedValue(mockChain);

      const result = await hybrid.getOptionChain('SPY');

      expect(tradierProvider.getOptionChain).toHaveBeenCalled();
      expect(result.quality.fallbackReason).toBeDefined();
    });

    it('should fallback if Massive returns poor quality', async () => {
      const poorChain = {
        ...mockChain,
        quality: {
          source: 'massive',
          isStale: true,
          hasWarnings: true,
          warnings: ['Very stale data', 'Missing prices'],
          confidence: 30,
          updatedAt: Date.now() - 60000,
        },
      };
      massiveProvider.getOptionChain.mockResolvedValue(poorChain);
      tradierProvider.getOptionChain.mockResolvedValue(mockChain);

      const result = await hybrid.getOptionChain('SPY');

      expect(tradierProvider.getOptionChain).toHaveBeenCalled();
      expect(result.quality.source).toBe('tradier');
      expect(result.quality.warnings).toContain(
        'Using Tradier fallback due to Massive unavailability'
      );
    });

    it('should fallback if Massive throws', async () => {
      massiveProvider.getOptionChain.mockRejectedValue(new Error('API error'));
      tradierProvider.getOptionChain.mockResolvedValue(mockChain);

      const result = await hybrid.getOptionChain('SPY');

      expect(tradierProvider.getOptionChain).toHaveBeenCalled();
      expect(result.quality.source).toBe('tradier');
    });

    it('should throw if both fail', async () => {
      massiveProvider.getOptionChain.mockRejectedValue(new Error('Massive error'));
      tradierProvider.getOptionChain.mockRejectedValue(new Error('Tradier error'));

      await expect(hybrid.getOptionChain('SPY')).rejects.toThrow(
        'Both providers failed'
      );
    });

    it('should pass query options to providers', async () => {
      massiveProvider.getOptionChain.mockResolvedValue(mockChain);

      await hybrid.getOptionChain('SPY', {
        strikeRange: [440, 460],
        limit: 100,
      });

      expect(massiveProvider.getOptionChain).toHaveBeenCalledWith('SPY', {
        strikeRange: [440, 460],
        limit: 100,
      });
    });
  });

  // ===== SINGLE CONTRACT =====

  describe('getOptionContract', () => {
    it('should fetch from Massive', async () => {
      const contract = mockChain.contracts[0];
      massiveProvider.getOptionContract.mockResolvedValue(contract);

      const result = await hybrid.getOptionContract('SPY', 450, '2024-01-19', 'call');

      expect(massiveProvider.getOptionContract).toHaveBeenCalledWith(
        'SPY',
        450,
        '2024-01-19',
        'call'
      );
      expect(result).toEqual(contract);
    });

    it('should fallback to Tradier', async () => {
      const contract = mockChain.contracts[0];
      massiveProvider.getOptionContract.mockRejectedValue(new Error('Not found'));
      tradierProvider.getOptionContract.mockResolvedValue(contract);

      const result = await hybrid.getOptionContract('SPY', 450, '2024-01-19', 'call');

      expect(result.quality.fallbackReason).toBeDefined();
    });
  });

  // ===== FLOW DATA =====

  describe('getFlowData', () => {
    it('should fetch from Massive if available', async () => {
      const flow = {
        sweepCount: 10,
        blockCount: 5,
        darkPoolPercent: 35,
        flowBias: 'bullish' as const,
        buyPressure: 65,
        unusualActivity: true,
        flowScore: 75,
        updatedAt: Date.now(),
      };

      massiveProvider.getFlowData.mockResolvedValue(flow);

      const result = await hybrid.getFlowData('SPY');

      expect(result.flowScore).toBe(75);
    });

    it('should return synthetic data if no real flow', async () => {
      const syntheticFlow = {
        sweepCount: 0,
        blockCount: 0,
        darkPoolPercent: 0,
        flowBias: 'neutral' as const,
        buyPressure: 50,
        unusualActivity: false,
        flowScore: 0,
        updatedAt: Date.now(),
      };

      massiveProvider.getFlowData.mockResolvedValue(syntheticFlow);

      const result = await hybrid.getFlowData('SPY');

      expect(result.flowScore).toBe(0);
    });
  });

  // ===== HEALTH TRACKING =====

  describe('Health tracking', () => {
    it('should track successful provider calls', async () => {
      massiveProvider.getExpirations.mockResolvedValue(['2024-01-19']);

      await hybrid.getExpirations('SPY');

      const health = hybrid.getHealth();
      expect(health.massive.healthy).toBe(true);
      expect(health.massive.consecutiveErrors).toBe(0);
    });

    it('should track failed provider calls', async () => {
      massiveProvider.getExpirations.mockRejectedValue(new Error('Error'));
      tradierProvider.getExpirations.mockResolvedValue(['2024-01-19']);

      await hybrid.getExpirations('SPY');

      const health = hybrid.getHealth();
      expect(health.massive.consecutiveErrors).toBe(1);
    });

    it('should mark provider as unhealthy after 3 errors', async () => {
      massiveProvider.getExpirations.mockRejectedValue(new Error('Error'));
      tradierProvider.getExpirations.mockResolvedValue(['2024-01-19']);

      for (let i = 0; i < 3; i++) {
        await hybrid.getExpirations('SPY').catch(() => {});
      }

      const health = hybrid.getHealth();
      expect(health.massive.healthy).toBe(false);
    });

    it('should report response time', async () => {
      massiveProvider.getExpirations.mockResolvedValue(['2024-01-19']);

      await hybrid.getExpirations('SPY');

      const health = hybrid.getHealth();
      expect(health.massive.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== SUBSCRIPTIONS =====

  describe('Subscriptions', () => {
    it('should subscribe to Massive chain', () => {
      const callback = vi.fn();
      massiveProvider.subscribeToChain.mockReturnValue(() => {});

      const unsubscribe = hybrid.subscribeToChain('SPY', callback);

      expect(massiveProvider.subscribeToChain).toHaveBeenCalledWith('SPY', callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should subscribe to Massive flow', () => {
      const callback = vi.fn();
      massiveProvider.subscribeToFlow.mockReturnValue(() => {});

      const unsubscribe = hybrid.subscribeToFlow('SPY', callback);

      expect(massiveProvider.subscribeToFlow).toHaveBeenCalledWith('SPY', callback);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
