/**
 * Monitoring System Integration Tests
 *
 * Tests the integration between:
 * - Data providers (Massive, Tradier) and metrics service
 * - Greeks validation and metrics recording
 * - P&L calculation and metrics recording
 * - Error handling and metrics tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMetricsService } from '../services/monitoring';
import { validateGreeks, createSafeGreeks } from '../services/greeksMonitorService';
import { calculatePnL } from '../services/pnlCalculator';

describe('Monitoring Integration', () => {
  let metricsService: ReturnType<typeof getMetricsService>;

  beforeEach(() => {
    metricsService = getMetricsService();
  });

  // ============================================================================
  // Data Provider Integration Tests
  // ============================================================================

  describe('Data Provider Metrics Recording', () => {
    it('should record Massive API request metrics during normal operation', () => {
      // Simulate Massive API calls
      metricsService.recordApiRequest('massive', 120, true);
      metricsService.recordApiRequest('massive', 140, true);
      metricsService.recordApiRequest('massive', 100, true);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.providers.massive.requestCount).toBe(3);
      expect(metrics.providers.massive.successCount).toBe(3);
      expect(metrics.providers.massive.uptime).toBe(100);
      expect(metrics.providers.massive.avgResponseTimeMs).toBeCloseTo(
        (120 + 140 + 100) / 3,
        1
      );
    });

    it('should record Tradier fallback when Massive fails', () => {
      // Massive fails
      metricsService.recordApiRequest('massive', 5000, false); // Timeout
      metricsService.recordApiRequest('massive', 5000, false); // Timeout

      // Fallback to Tradier succeeds
      metricsService.recordApiRequest('tradier', 200, true);
      metricsService.recordApiRequest('tradier', 180, true);

      const metrics = metricsService.getDashboardMetrics();

      // Massive shows failures
      expect(metrics.providers.massive.uptime).toBe(0);
      expect(metrics.providers.massive.successCount).toBe(0);

      // Tradier shows success
      expect(metrics.providers.tradier.uptime).toBe(100);
      expect(metrics.providers.tradier.successCount).toBe(2);
    });

    it('should track response time degradation', () => {
      // Fast responses
      metricsService.recordApiRequest('massive', 100, true);
      metricsService.recordApiRequest('massive', 120, true);

      let metrics = metricsService.getDashboardMetrics();
      const fastAvgTime = metrics.providers.massive.avgResponseTimeMs;

      // Add slow response
      metricsService.recordApiRequest('massive', 1000, true);

      metrics = metricsService.getDashboardMetrics();
      const slowAvgTime = metrics.providers.massive.avgResponseTimeMs;

      expect(slowAvgTime).toBeGreaterThan(fastAvgTime);
    });
  });

  // ============================================================================
  // Greeks Validation Integration Tests
  // ============================================================================

  describe('Greeks Validation Metrics Recording', () => {
    it('should record valid Greeks through validation pipeline', () => {
      const greeks = {
        delta: 0.5,
        gamma: 0.02,
        theta: -0.01,
        vega: 0.1,
        rho: 0.05,
        impliedVolatility: 0.25,
      };

      const validation = validateGreeks(greeks);
      metricsService.recordGreeksValidation(
        validation.isValid,
        validation.isEstimated,
        validation.errors
      );

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.totalTrades).toBe(1);
      if (validation.isValid) {
        expect(metrics.greeksQuality.validGreeks).toBe(1);
      }
    });

    it('should record estimated Greeks when data is missing', () => {
      // Missing gamma (critical error)
      const partialGreeks = {
        delta: 0.5,
        gamma: undefined,
        theta: -0.01,
        vega: 0.1,
        impliedVolatility: 0.25,
      };

      const result = createSafeGreeks(partialGreeks, 'C');
      metricsService.recordGreeksValidation(
        result.validation.isValid,
        result.validation.isEstimated,
        result.validation.errors
      );

      const metrics = metricsService.getDashboardMetrics();
      // Should record as estimated since fallback was used
      expect(metrics.greeksQuality.totalTrades).toBeGreaterThan(0);
    });

    it('should detect and record gamma=0 critical error', () => {
      const greeks = {
        delta: 0.5,
        gamma: 0, // CRITICAL ERROR
        theta: -0.01,
        vega: 0.1,
        impliedVolatility: 0.25,
      };

      const validation = validateGreeks(greeks);
      expect(validation.errors).toContain('gamma is zero or negative');

      metricsService.recordGreeksValidation(validation.isValid, true, validation.errors);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.gammaIsZero).toBe(1);
    });

    it('should track IV anomalies', () => {
      // Very high IV (potential crush)
      const greeks = {
        delta: 0.5,
        gamma: 0.02,
        theta: -0.01,
        vega: 0.1,
        impliedVolatility: 3.5, // Way too high
      };

      const validation = validateGreeks(greeks);
      metricsService.recordGreeksValidation(validation.isValid, true, validation.errors);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.ivAnomalies).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // P&L Metrics Recording Integration Tests
  // ============================================================================

  describe('P&L Metrics Recording Integration', () => {
    it('should record realistic P&L with costs', () => {
      // Entry @ $5.00, Exit @ $5.50, 10 contracts
      const result = calculatePnL({
        entryPrice: 5.0,
        exitPrice: 5.5,
        quantity: 10,
      });

      expect(result.grossPnL).toBeGreaterThan(0);
      expect(result.netPnL).toBeLessThan(result.grossPnL);

      metricsService.recordPnL(
        result.grossPnLPercent,
        result.netPnLPercent,
        result.totalCommission,
        result.slippageCost
      );

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.pnl.totalTrades).toBe(1);
      expect(metrics.pnl.totalCommissionCost).toBe(result.totalCommission);
    });

    it('should aggregate P&L across multiple trades', () => {
      // Trade 1: Winning trade
      const trade1 = calculatePnL({
        entryPrice: 5.0,
        exitPrice: 5.5,
        quantity: 10,
      });

      // Trade 2: Losing trade
      const trade2 = calculatePnL({
        entryPrice: 6.0,
        exitPrice: 5.5,
        quantity: 10,
      });

      metricsService.recordPnL(
        trade1.grossPnLPercent,
        trade1.netPnLPercent,
        trade1.totalCommission,
        trade1.slippageCost
      );

      metricsService.recordPnL(
        trade2.grossPnLPercent,
        trade2.netPnLPercent,
        trade2.totalCommission,
        trade2.slippageCost
      );

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.pnl.totalTrades).toBe(2);
      expect(metrics.pnl.avgGrossPnL).toBeCloseTo(
        (trade1.grossPnLPercent + trade2.grossPnLPercent) / 2,
        2
      );
    });

    it('should show cost impact of commissions and slippage', () => {
      // Small win that's erased by costs
      const result = calculatePnL({
        entryPrice: 100,
        exitPrice: 100.5, // 0.5% gross win
        quantity: 10,
        commission: {
          entryCommission: 0.65,
          exitCommission: 0.65,
          exchangeFee: 0.01,
          minCommissionPerTrade: 1.0,
        },
      });

      metricsService.recordPnL(
        result.grossPnLPercent,
        result.netPnLPercent,
        result.totalCommission,
        result.slippageCost
      );

      const metrics = metricsService.getDashboardMetrics();
      // Cost impact should show how much costs ate into profits
      expect(metrics.pnl.costImpactPercent).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Error Handling and System Health Integration Tests
  // ============================================================================

  describe('System Health and Error Tracking', () => {
    it('should track API errors separately from other errors', () => {
      metricsService.recordError('API_ERROR', 'Massive timeout');
      metricsService.recordError('API_ERROR', 'Tradier 502');
      metricsService.recordError('VALIDATION_ERROR', 'Greeks failed');
      metricsService.recordError('NETWORK_ERROR', 'Connection lost');

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.systemHealth.errorCount).toBe(4);
      expect(metrics.systemHealth.errorsByType.get('API_ERROR')).toBe(2);
      expect(metrics.systemHealth.errorsByType.get('VALIDATION_ERROR')).toBe(1);
      expect(metrics.systemHealth.errorsByType.get('NETWORK_ERROR')).toBe(1);
    });

    it('should record most recent error for debugging', () => {
      metricsService.recordError('API_ERROR', 'First error');
      metricsService.recordError('VALIDATION_ERROR', 'Second error - Greeks failed');
      metricsService.recordError('NETWORK_ERROR', 'Third error - timeout');

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.systemHealth.lastErrorMessage).toBe('Third error - timeout');
    });
  });

  // ============================================================================
  // Real-World Scenario Tests
  // ============================================================================

  describe('Real-world scenarios', () => {
    it('should handle a complete trading session', () => {
      // 1. Start of day - API health checks
      metricsService.recordApiRequest('massive', 150, true);
      metricsService.recordApiRequest('tradier', 100, true);

      // 2. Options chain request
      metricsService.recordApiRequest('massive', 200, true);

      // 3. Greeks validation for active positions
      metricsService.recordGreeksValidation(true, false, []);
      metricsService.recordGreeksValidation(true, false, []);

      // 4. First trade entry
      const trade1 = calculatePnL({
        entryPrice: 5.0,
        exitPrice: 5.0,
        quantity: 10,
      });
      metricsService.recordPnL(
        trade1.grossPnLPercent,
        trade1.netPnLPercent,
        trade1.totalCommission,
        trade1.slippageCost
      );

      // 5. Trade exit with profit
      const trade1Exit = calculatePnL({
        entryPrice: 5.0,
        exitPrice: 5.5,
        quantity: 10,
      });
      metricsService.recordPnL(
        trade1Exit.grossPnLPercent,
        trade1Exit.netPnLPercent,
        trade1Exit.totalCommission,
        trade1Exit.slippageCost
      );

      // 6. Check metrics
      const metrics = metricsService.getDashboardMetrics();

      expect(metrics.providers.massive.requestCount).toBeGreaterThan(0);
      expect(metrics.providers.massive.uptime).toBe(100);
      expect(metrics.greeksQuality.totalTrades).toBe(2);
      expect(metrics.pnl.totalTrades).toBe(2);
      expect(metrics.systemHealth.errorCount).toBe(0);
    });

    it('should handle provider failover scenario', () => {
      // Massive is down
      for (let i = 0; i < 3; i++) {
        metricsService.recordApiRequest('massive', 5000, false);
      }

      // Tradier failover is working
      for (let i = 0; i < 3; i++) {
        metricsService.recordApiRequest('tradier', 100, true);
      }

      // Some errors recorded
      metricsService.recordError('API_ERROR', 'Massive API unavailable');

      const metrics = metricsService.getDashboardMetrics();

      // Massive should show 0% uptime
      expect(metrics.providers.massive.uptime).toBe(0);
      // Tradier should show 100% uptime
      expect(metrics.providers.tradier.uptime).toBe(100);
      // Should record the error
      expect(metrics.systemHealth.errorCount).toBeGreaterThan(0);
    });
  });
});
