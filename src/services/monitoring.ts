/**
 * Monitoring & Metrics Service
 *
 * Core metrics collection for production monitoring:
 * 1. Data Provider Health (Massive/Tradier availability, response times)
 * 2. Greeks/IV Quality (validation rates, bounds violations)
 * 3. P&L Accuracy (backtest vs live variance, commission impact)
 * 4. System Health (API times, errors, WebSocket stability)
 *
 * @module services/monitoring
 */

// ============================================================================
// Types
// ============================================================================

export interface ProviderMetrics {
  provider: 'massive' | 'tradier';
  requestCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs: number;
  fallbackCount: number; // Times we switched providers
  lastUpdateAt: number;
  uptime: number; // Percentage (0-100)
}

export interface GreeksQualityMetrics {
  totalTrades: number;
  validGreeks: number; // Trades with real Greeks from API
  estimatedGreeks: number; // Trades with fallback values
  validationErrors: number; // Bounds violations
  deltaOutOfBounds: number;
  gammaIsZero: number; // Critical error indicator
  ivAnomalies: number; // IV format errors
  lastUpdateAt: number;
}

export interface PnLMetrics {
  totalTrades: number;
  avgGrossPnL: number; // Percent
  avgNetPnL: number; // Percent after costs
  totalCommissionCost: number; // Total dollars lost to commissions
  avgSlippageCost: number; // Per trade
  costImpactPercent: number; // (Gross - Net) / Gross * 100
  backtestVariance: number; // Backtest vs live %, ideally <5%
  lastUpdateAt: number;
}

export interface SystemHealthMetrics {
  apiAvgResponseTimeMs: number;
  webSocketConnected: boolean;
  webSocketLatencyMs: number;
  errorCount: number;
  errorsByType: Map<string, number>;
  uptime: number; // Seconds
  lastErrorAt?: number;
  lastErrorMessage?: string;
}

export interface DashboardMetrics {
  providers: {
    massive: ProviderMetrics;
    tradier: ProviderMetrics;
  };
  greeksQuality: GreeksQualityMetrics;
  pnl: PnLMetrics;
  systemHealth: SystemHealthMetrics;
  lastUpdateAt: number;
}

// ============================================================================
// Metrics Service
// ============================================================================

class MetricsService {
  private providerMetrics = new Map<string, ProviderMetrics>();
  private greeksQuality: GreeksQualityMetrics = {
    totalTrades: 0,
    validGreeks: 0,
    estimatedGreeks: 0,
    validationErrors: 0,
    deltaOutOfBounds: 0,
    gammaIsZero: 0,
    ivAnomalies: 0,
    lastUpdateAt: Date.now(),
  };
  private pnlMetrics: PnLMetrics = {
    totalTrades: 0,
    avgGrossPnL: 0,
    avgNetPnL: 0,
    totalCommissionCost: 0,
    avgSlippageCost: 0,
    costImpactPercent: 0,
    backtestVariance: 0,
    lastUpdateAt: Date.now(),
  };
  private systemHealth: SystemHealthMetrics = {
    apiAvgResponseTimeMs: 0,
    webSocketConnected: false,
    webSocketLatencyMs: 0,
    errorCount: 0,
    errorsByType: new Map(),
    uptime: 0,
  };
  private startTime = Date.now();

  constructor() {
    // Initialize provider metrics
    this.providerMetrics.set('massive', {
      provider: 'massive',
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTimeMs: 0,
      fallbackCount: 0,
      lastUpdateAt: Date.now(),
      uptime: 100,
    });

    this.providerMetrics.set('tradier', {
      provider: 'tradier',
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTimeMs: 0,
      fallbackCount: 0,
      lastUpdateAt: Date.now(),
      uptime: 100,
    });
  }

  /**
   * Record API request (call after fetch completes)
   */
  recordApiRequest(provider: 'massive' | 'tradier', responseTimeMs: number, success: boolean) {
    const metrics = this.providerMetrics.get(provider);
    if (!metrics) return;

    metrics.requestCount++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    // Update average response time
    const totalTime = metrics.avgResponseTimeMs * (metrics.requestCount - 1) + responseTimeMs;
    metrics.avgResponseTimeMs = Math.round(totalTime / metrics.requestCount);
    metrics.uptime = Math.round((metrics.successCount / metrics.requestCount) * 100);
    metrics.lastUpdateAt = Date.now();
  }

  /**
   * Record fallback event (when primary provider failed, switched to secondary)
   */
  recordFallback(primaryProvider: 'massive' | 'tradier') {
    const metrics = this.providerMetrics.get(primaryProvider);
    if (!metrics) return;
    metrics.fallbackCount++;
  }

  /**
   * Record Greeks validation result
   */
  recordGreeksValidation(isValid: boolean, isEstimated: boolean, errors?: string[]) {
    this.greeksQuality.totalTrades++;
    if (isValid && !isEstimated) {
      this.greeksQuality.validGreeks++;
    } else {
      this.greeksQuality.estimatedGreeks++;
    }

    if (errors && errors.length > 0) {
      this.greeksQuality.validationErrors++;
      errors.forEach((err) => {
        if (err.includes('Delta')) this.greeksQuality.deltaOutOfBounds++;
        if (err.includes('Gamma')) this.greeksQuality.gammaIsZero++;
      });
    }

    this.greeksQuality.lastUpdateAt = Date.now();
  }

  /**
   * Record IV format anomaly
   */
  recordIVAnomaly() {
    this.greeksQuality.ivAnomalies++;
  }

  /**
   * Record P&L data point
   */
  recordPnL(grossPnL: number, netPnL: number, commissionCost: number, slippageCost: number) {
    this.pnlMetrics.totalTrades++;

    // Update running averages
    const prevGross = this.pnlMetrics.avgGrossPnL * (this.pnlMetrics.totalTrades - 1);
    this.pnlMetrics.avgGrossPnL = (prevGross + grossPnL) / this.pnlMetrics.totalTrades;

    const prevNet = this.pnlMetrics.avgNetPnL * (this.pnlMetrics.totalTrades - 1);
    this.pnlMetrics.avgNetPnL = (prevNet + netPnL) / this.pnlMetrics.totalTrades;

    this.pnlMetrics.totalCommissionCost += commissionCost;

    const prevSlippage = this.pnlMetrics.avgSlippageCost * (this.pnlMetrics.totalTrades - 1);
    this.pnlMetrics.avgSlippageCost = (prevSlippage + slippageCost) / this.pnlMetrics.totalTrades;

    // Calculate cost impact
    if (this.pnlMetrics.avgGrossPnL !== 0) {
      this.pnlMetrics.costImpactPercent =
        Math.abs((this.pnlMetrics.avgGrossPnL - this.pnlMetrics.avgNetPnL) /
        this.pnlMetrics.avgGrossPnL) * 100;
    }

    this.pnlMetrics.lastUpdateAt = Date.now();
  }

  /**
   * Set backtest variance (how much live trading differs from backtest)
   */
  setBacktestVariance(variancePercent: number) {
    this.pnlMetrics.backtestVariance = variancePercent;
  }

  /**
   * Record API response time for system health
   */
  recordResponseTime(timeMs: number) {
    const prevCount = this.systemHealth.apiAvgResponseTimeMs > 0 ? 100 : 0; // Rough estimate
    this.systemHealth.apiAvgResponseTimeMs = Math.round(
      (this.systemHealth.apiAvgResponseTimeMs * prevCount + timeMs) / (prevCount + 1)
    );
  }

  /**
   * Record WebSocket status
   */
  setWebSocketStatus(connected: boolean, latencyMs?: number) {
    this.systemHealth.webSocketConnected = connected;
    if (latencyMs !== undefined) {
      this.systemHealth.webSocketLatencyMs = latencyMs;
    }
  }

  /**
   * Record error
   */
  recordError(errorType: string, message?: string) {
    this.systemHealth.errorCount++;
    this.systemHealth.lastErrorAt = Date.now();
    if (message) this.systemHealth.lastErrorMessage = message;

    const count = this.systemHealth.errorsByType.get(errorType) || 0;
    this.systemHealth.errorsByType.set(errorType, count + 1);
  }

  /**
   * Get all metrics as dashboard object
   */
  getDashboardMetrics(): DashboardMetrics {
    return {
      providers: {
        massive: this.providerMetrics.get('massive')!,
        tradier: this.providerMetrics.get('tradier')!,
      },
      greeksQuality: { ...this.greeksQuality },
      pnl: { ...this.pnlMetrics },
      systemHealth: {
        ...this.systemHealth,
        uptime: Math.round((Date.now() - this.startTime) / 1000), // Uptime in seconds
        errorsByType: new Map(this.systemHealth.errorsByType), // Clone map
      },
      lastUpdateAt: Date.now(),
    };
  }

  /**
   * Reset all metrics (useful for testing or daily reset)
   */
  reset() {
    this.greeksQuality = {
      totalTrades: 0,
      validGreeks: 0,
      estimatedGreeks: 0,
      validationErrors: 0,
      deltaOutOfBounds: 0,
      gammaIsZero: 0,
      ivAnomalies: 0,
      lastUpdateAt: Date.now(),
    };

    this.pnlMetrics = {
      totalTrades: 0,
      avgGrossPnL: 0,
      avgNetPnL: 0,
      totalCommissionCost: 0,
      avgSlippageCost: 0,
      costImpactPercent: 0,
      backtestVariance: 0,
      lastUpdateAt: Date.now(),
    };

    this.systemHealth.errorsByType.clear();
    this.systemHealth.errorCount = 0;
    this.startTime = Date.now();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let metricsInstance: MetricsService | null = null;

export function getMetricsService(): MetricsService {
  if (!metricsInstance) {
    metricsInstance = new MetricsService();
  }
  return metricsInstance;
}

export function resetMetrics() {
  if (metricsInstance) {
    metricsInstance.reset();
  }
}
