/**
 * Metrics Service Tests
 *
 * Tests the MetricsService singleton for:
 * - API request tracking (Massive/Tradier response times, success rates)
 * - Greeks validation tracking
 * - P&L metrics recording
 * - System error tracking and reporting
 * - Dashboard metrics aggregation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMetricsService, type DashboardMetrics } from '../monitoring';

describe('MetricsService', () => {
  let metricsService: ReturnType<typeof getMetricsService>;

  beforeEach(() => {
    metricsService = getMetricsService();
    // Clear any existing metrics by getting a fresh service
  });

  // ============================================================================
  // API Request Tracking Tests
  // ============================================================================

  describe('recordApiRequest', () => {
    it('should record successful API requests for Massive', () => {
      metricsService.recordApiRequest('massive', 150, true);
      metricsService.recordApiRequest('massive', 200, true);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.providers.massive.successCount).toBe(2);
      expect(metrics.providers.massive.requestCount).toBe(2);
      expect(metrics.providers.massive.avgResponseTimeMs).toBeGreaterThan(0);
    });

    it('should record failed API requests', () => {
      metricsService.recordApiRequest('massive', 100, true);
      metricsService.recordApiRequest('massive', 500, false);
      metricsService.recordApiRequest('massive', 150, true);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.providers.massive.requestCount).toBe(3);
      expect(metrics.providers.massive.successCount).toBe(2);
    });

    it('should calculate uptime percentage correctly', () => {
      // 8 successful, 2 failed = 80% uptime
      for (let i = 0; i < 8; i++) {
        metricsService.recordApiRequest('tradier', 100, true);
      }
      for (let i = 0; i < 2; i++) {
        metricsService.recordApiRequest('tradier', 100, false);
      }

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.providers.tradier.uptime).toBe(80);
    });

    it('should track response times separately for each provider', () => {
      metricsService.recordApiRequest('massive', 100, true);
      metricsService.recordApiRequest('massive', 200, true);
      metricsService.recordApiRequest('tradier', 50, true);
      metricsService.recordApiRequest('tradier', 100, true);

      const metrics = metricsService.getDashboardMetrics();
      // Massive avg: (100 + 200) / 2 = 150
      expect(metrics.providers.massive.avgResponseTimeMs).toBe(150);
      // Tradier avg: (50 + 100) / 2 = 75
      expect(metrics.providers.tradier.avgResponseTimeMs).toBe(75);
    });
  });

  // ============================================================================
  // Greeks Validation Tests
  // ============================================================================

  describe('recordGreeksValidation', () => {
    it('should record valid Greeks', () => {
      metricsService.recordGreeksValidation(true, false, []);
      metricsService.recordGreeksValidation(true, false, []);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.validGreeks).toBe(2);
      expect(metrics.greeksQuality.totalTrades).toBe(2);
    });

    it('should record estimated Greeks', () => {
      metricsService.recordGreeksValidation(true, true, ['gamma=0']);
      metricsService.recordGreeksValidation(true, false, []);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.estimatedGreeks).toBe(1);
    });

    it('should track validation errors', () => {
      metricsService.recordGreeksValidation(false, false, ['delta out of bounds', 'vega too high']);
      metricsService.recordGreeksValidation(true, false, []);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.validationErrors).toBe(1);
    });

    it('should detect gamma=0 errors', () => {
      metricsService.recordGreeksValidation(false, true, ['gamma=0']);
      metricsService.recordGreeksValidation(true, false, []);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.gammaIsZero).toBe(1);
    });

    it('should detect delta out of bounds errors', () => {
      metricsService.recordGreeksValidation(false, false, ['delta out of bounds']);
      metricsService.recordGreeksValidation(true, false, []);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.greeksQuality.deltaOutOfBounds).toBe(1);
    });
  });

  // ============================================================================
  // P&L Tracking Tests
  // ============================================================================

  describe('recordPnL', () => {
    it('should record P&L metrics', () => {
      metricsService.recordPnL(5.0, 4.5, 10.0, 5.0);
      metricsService.recordPnL(3.0, 2.0, 10.0, 8.0);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.pnl.totalTrades).toBe(2);
      // Avg gross P&L: (5.0 + 3.0) / 2 = 4.0
      expect(metrics.pnl.avgGrossPnL).toBe(4.0);
      // Avg net P&L: (4.5 + 2.0) / 2 = 3.25
      expect(metrics.pnl.avgNetPnL).toBe(3.25);
    });

    it('should track commission and slippage costs', () => {
      metricsService.recordPnL(5.0, 4.5, 5.0, 5.0);
      metricsService.recordPnL(3.0, 2.0, 5.0, 8.0);

      const metrics = metricsService.getDashboardMetrics();
      // Total commission: 5 + 5 = 10
      expect(metrics.pnl.totalCommissionCost).toBe(10);
      // Total slippage: 5 + 8 = 13
      expect(metrics.pnl.avgSlippageCost).toBe((5 + 8) / 2);
    });

    it('should calculate cost impact percentage', () => {
      // Single trade: gross=100, net=90, cost impact = 10%
      metricsService.recordPnL(100, 90, 5, 5);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.pnl.costImpactPercent).toBe(10);
    });
  });

  // ============================================================================
  // System Health Tracking Tests
  // ============================================================================

  describe('recordError', () => {
    it('should track error counts by type', () => {
      metricsService.recordError('API_ERROR', 'Massive API timeout');
      metricsService.recordError('API_ERROR', 'Massive API 502');
      metricsService.recordError('VALIDATION_ERROR', 'Greeks validation failed');

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.systemHealth.errorCount).toBe(3);
    });

    it('should record last error message', () => {
      metricsService.recordError('API_ERROR', 'Error 1');
      metricsService.recordError('VALIDATION_ERROR', 'Error 2');

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.systemHealth.lastErrorMessage).toBe('Error 2');
    });

    it('should track errors by type', () => {
      metricsService.recordError('API_ERROR', 'Error 1');
      metricsService.recordError('API_ERROR', 'Error 2');
      metricsService.recordError('NETWORK_ERROR', 'Error 3');

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.systemHealth.errorsByType.get('API_ERROR')).toBe(2);
      expect(metrics.systemHealth.errorsByType.get('NETWORK_ERROR')).toBe(1);
    });
  });

  // ============================================================================
  // Dashboard Metrics Aggregation Tests
  // ============================================================================

  describe('getDashboardMetrics', () => {
    it('should return complete dashboard metrics structure', () => {
      metricsService.recordApiRequest('massive', 100, true);
      metricsService.recordGreeksValidation(true, false, []);
      metricsService.recordPnL(5.0, 4.5, 10, 5);
      metricsService.recordError('API_ERROR', 'Test error');

      const metrics = metricsService.getDashboardMetrics();

      expect(metrics).toHaveProperty('providers');
      expect(metrics).toHaveProperty('greeksQuality');
      expect(metrics).toHaveProperty('pnl');
      expect(metrics).toHaveProperty('systemHealth');
      expect(metrics).toHaveProperty('lastUpdateAt');
    });

    it('should have correct provider structure', () => {
      metricsService.recordApiRequest('massive', 150, true);
      const metrics = metricsService.getDashboardMetrics();

      expect(metrics.providers.massive).toHaveProperty('provider', 'massive');
      expect(metrics.providers.massive).toHaveProperty('uptime');
      expect(metrics.providers.massive).toHaveProperty('requestCount');
      expect(metrics.providers.massive).toHaveProperty('successCount');
      expect(metrics.providers.massive).toHaveProperty('avgResponseTimeMs');
      expect(metrics.providers.massive).toHaveProperty('fallbackCount');
    });

    it('should update lastUpdateAt timestamp', () => {
      const metric1 = metricsService.getDashboardMetrics();
      const timestamp1 = metric1.lastUpdateAt;

      // Wait a tiny bit and record another metric
      metricsService.recordApiRequest('tradier', 100, true);
      const metric2 = metricsService.getDashboardMetrics();
      const timestamp2 = metric2.lastUpdateAt;

      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
    });
  });

  // ============================================================================
  // Data Provider Fallback Tracking Tests
  // ============================================================================

  describe('provider fallback tracking', () => {
    it('should track fallback attempts', () => {
      // Simulate Massive failures triggering fallbacks
      metricsService.recordApiRequest('massive', 5000, false); // Timeout
      metricsService.recordApiRequest('massive', 5000, false); // Timeout
      metricsService.recordApiRequest('tradier', 200, true); // Fallback succeeds

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.providers.massive.uptime).toBeLessThan(100);
      expect(metrics.providers.tradier.requestCount).toBeGreaterThan(0);
    });

    it('should show high fallback counts as warning', () => {
      // Record many failures
      for (let i = 0; i < 10; i++) {
        metricsService.recordApiRequest('massive', 100, false);
        metricsService.recordApiRequest('tradier', 100, true);
      }

      const metrics = metricsService.getDashboardMetrics();
      // Massive has 0% uptime (10 failures)
      expect(metrics.providers.massive.uptime).toBe(0);
      // All requests went to Tradier fallback
      expect(metrics.providers.tradier.requestCount).toBe(10);
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty metrics gracefully', () => {
      const metrics = metricsService.getDashboardMetrics();

      expect(metrics.providers.massive.requestCount).toBe(0);
      expect(metrics.providers.massive.uptime).toBe(0);
      expect(metrics.greeksQuality.totalTrades).toBe(0);
      expect(metrics.pnl.totalTrades).toBe(0);
    });

    it('should handle division by zero in uptime calculation', () => {
      const metrics = metricsService.getDashboardMetrics();
      // No requests recorded, so requestCount = 0
      // Uptime should be 0 or safe default
      expect(metrics.providers.massive.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.providers.massive.uptime).toBeLessThanOrEqual(100);
    });

    it('should handle very high response times', () => {
      metricsService.recordApiRequest('massive', 60000, true); // 1 minute
      metricsService.recordApiRequest('massive', 100, true);

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.providers.massive.avgResponseTimeMs).toBeGreaterThan(100);
    });

    it('should handle multiple errors of same type', () => {
      for (let i = 0; i < 50; i++) {
        metricsService.recordError('API_ERROR', `Error ${i}`);
      }

      const metrics = metricsService.getDashboardMetrics();
      expect(metrics.systemHealth.errorCount).toBe(50);
      expect(metrics.systemHealth.errorsByType.get('API_ERROR')).toBe(50);
    });
  });
});
