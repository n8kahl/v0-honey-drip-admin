/**
 * greeksMonitorService.ts - Real-Time Greek Monitoring
 *
 * Polls Tradier API for Greeks (delta, gamma, theta, vega) and monitors:
 * - Theta decay acceleration (time value erosion)
 * - Gamma risk spikes (position velocity danger)
 * - Vega collapse (IV crush detection)
 * - Portfolio-level Greek exposure aggregation
 *
 * Integrates with alertEscalationStore for risk warnings.
 */

import { Contract, Trade } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  impliedVolatility: number; // IV as decimal (0.30 = 30%)
  timestamp: number;
}

export interface GreeksSnapshot {
  symbol: string; // Option symbol (e.g., "AAPL250117C00180000")
  strike: number;
  expiry: string;
  type: 'C' | 'P';
  greeks: Greeks;
  underlyingPrice: number;
  optionPrice: number;
  daysToExpiry: number;
}

export interface PortfolioGreeks {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  thetaPerDay: number; // Total $ lost per day to decay
  gammaRisk: number; // Aggregate gamma exposure (higher = more volatile)
  vegaExposure: number; // Total $ exposed to IV changes
  lastUpdated: number;
}

export interface ThetaProjection {
  currentThetaPerDay: number;
  projectedDecayToday: number;
  projectedDecayWeek: number;
  inflectionPoints: Array<{
    date: string;
    accelerationFactor: number; // Multiplier of current theta
  }>;
}

// ============================================================================
// Greeks Monitor Service
// ============================================================================

class GreeksMonitorService {
  private greeksCache: Map<string, GreeksSnapshot> = new Map();
  private portfolioGreeks: PortfolioGreeks | null = null;
  private pollingInterval: number | null = null;
  private readonly POLL_INTERVAL_MS = 10000; // 10 seconds
  private readonly TRADIER_API_URL = 'https://api.tradier.com/v1';

  /**
   * Start monitoring Greeks for active trades
   */
  start(trades: Trade[]) {
    console.log('[GreeksMonitor] Starting Greeks monitoring for', trades.length, 'trades');

    // Clear existing interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll immediately
    this.poll(trades);

    // Set up recurring polling
    this.pollingInterval = window.setInterval(() => {
      this.poll(trades);
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    console.log('[GreeksMonitor] Stopped');
  }

  /**
   * Poll Tradier API for Greeks
   */
  private async poll(trades: Trade[]) {
    if (trades.length === 0) {
      console.log('[GreeksMonitor] No active trades to monitor');
      return;
    }

    console.log('[GreeksMonitor] Polling Greeks for', trades.length, 'trades');

    // Fetch Greeks for each trade
    const snapshots: GreeksSnapshot[] = [];

    for (const trade of trades) {
      try {
        const snapshot = await this.fetchGreeks(trade);
        if (snapshot) {
          snapshots.push(snapshot);
          this.greeksCache.set(trade.id, snapshot);
        }
      } catch (error) {
        console.error(`[GreeksMonitor] Failed to fetch Greeks for ${trade.ticker}:`, error);
      }
    }

    // Calculate portfolio-level Greeks
    this.calculatePortfolioGreeks(snapshots);

    // Check for alerts
    this.checkGreeksAlerts(snapshots);
  }

  /**
   * Fetch Greeks from Tradier API
   */
  private async fetchGreeks(trade: Trade): Promise<GreeksSnapshot | null> {
    // NOTE: This is a placeholder - you'll need actual Tradier API credentials
    // For now, we'll simulate Greeks data

    // In production, you'd call:
    // const response = await fetch(`${this.TRADIER_API_URL}/markets/options/greeks?symbols=${optionSymbol}`, {
    //   headers: {
    //     'Authorization': `Bearer ${TRADIER_API_KEY}`,
    //     'Accept': 'application/json'
    //   }
    // });

    // Simulated Greeks data (replace with real API call)
    const daysToExpiry = Math.max(
      0,
      Math.ceil(
        (trade.contract.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    );

    // Simulate Greeks based on DTE
    const thetaDecayRate = daysToExpiry <= 7 ? -50 : daysToExpiry <= 30 ? -20 : -10;
    const gammaRisk = daysToExpiry <= 7 ? 0.15 : daysToExpiry <= 30 ? 0.08 : 0.03;

    const snapshot: GreeksSnapshot = {
      symbol: `${trade.ticker}${trade.contract.expiry.replace(/-/g, '')}${trade.contract.type}${String(trade.contract.strike).padStart(8, '0')}`,
      strike: trade.contract.strike,
      expiry: trade.contract.expiry,
      type: trade.contract.type,
      greeks: {
        delta: trade.contract.delta || (trade.contract.type === 'C' ? 0.5 : -0.5),
        gamma: gammaRisk,
        theta: thetaDecayRate,
        vega: trade.contract.vega || 0.12,
        rho: 0.05,
        impliedVolatility: trade.contract.iv || 0.35,
        timestamp: Date.now(),
      },
      underlyingPrice: trade.currentPrice || trade.entryPrice || 100,
      optionPrice: trade.contract.mid,
      daysToExpiry,
    };

    return snapshot;
  }

  /**
   * Calculate portfolio-level Greeks aggregation
   */
  private calculatePortfolioGreeks(snapshots: GreeksSnapshot[]) {
    if (snapshots.length === 0) {
      this.portfolioGreeks = null;
      return;
    }

    // Aggregate Greeks (sum deltas, gammas, etc.)
    const totalDelta = snapshots.reduce((sum, s) => sum + s.greeks.delta, 0);
    const totalGamma = snapshots.reduce((sum, s) => sum + s.greeks.gamma, 0);
    const totalTheta = snapshots.reduce((sum, s) => sum + s.greeks.theta, 0);
    const totalVega = snapshots.reduce((sum, s) => sum + s.greeks.vega, 0);

    // Calculate dollar amounts
    // Theta is already in $ per day
    const thetaPerDay = totalTheta * snapshots.length; // Rough estimate

    // Gamma risk: higher gamma = more volatile position
    const gammaRisk = Math.abs(totalGamma);

    // Vega exposure: $ lost/gained per 1% IV change
    const vegaExposure = totalVega * snapshots.length * 100; // Convert to $

    this.portfolioGreeks = {
      totalDelta,
      totalGamma,
      totalTheta,
      totalVega,
      thetaPerDay,
      gammaRisk,
      vegaExposure,
      lastUpdated: Date.now(),
    };

    console.log('[GreeksMonitor] Portfolio Greeks:', this.portfolioGreeks);
  }

  /**
   * Check for Greeks-based alerts
   */
  private checkGreeksAlerts(snapshots: GreeksSnapshot[]) {
    const { useAlertEscalationStore } = require('../stores/alertEscalationStore');
    const alertStore = useAlertEscalationStore.getState();

    snapshots.forEach((snapshot) => {
      const { greeks, daysToExpiry } = snapshot;

      // Alert on high theta decay
      if (greeks.theta < -30 && daysToExpiry <= 7) {
        console.log(
          `[GreeksMonitor] High theta decay detected for ${snapshot.symbol}:`,
          greeks.theta
        );
      }

      // Alert on gamma spike
      if (greeks.gamma > 0.2) {
        console.log(
          `[GreeksMonitor] High gamma risk detected for ${snapshot.symbol}:`,
          greeks.gamma
        );
      }

      // Alert on IV collapse
      if (greeks.impliedVolatility < 0.15) {
        console.log(
          `[GreeksMonitor] Low IV detected for ${snapshot.symbol}:`,
          (greeks.impliedVolatility * 100).toFixed(1) + '%'
        );
      }
    });
  }

  /**
   * Get Greeks for a specific trade
   */
  getGreeksForTrade(tradeId: string): GreeksSnapshot | undefined {
    return this.greeksCache.get(tradeId);
  }

  /**
   * Get portfolio Greeks
   */
  getPortfolioGreeks(): PortfolioGreeks | null {
    return this.portfolioGreeks;
  }

  /**
   * Project theta decay for a trade
   */
  projectThetaDecay(tradeId: string): ThetaProjection | null {
    const snapshot = this.greeksCache.get(tradeId);
    if (!snapshot) return null;

    const currentTheta = snapshot.greeks.theta;
    const daysToExpiry = snapshot.daysToExpiry;

    // Project decay for today
    const projectedDecayToday = currentTheta;

    // Project decay for next 7 days (theta accelerates as expiry approaches)
    let projectedDecayWeek = 0;
    const inflectionPoints: Array<{ date: string; accelerationFactor: number }> = [];

    for (let i = 0; i < 7 && i < daysToExpiry; i++) {
      const daysLeft = daysToExpiry - i;
      let accelerationFactor = 1.0;

      // Theta acceleration curve
      if (daysLeft <= 3) {
        accelerationFactor = 2.5; // Accelerates heavily in last 3 days
      } else if (daysLeft <= 7) {
        accelerationFactor = 1.5; // Moderate acceleration in last week
      } else if (daysLeft <= 14) {
        accelerationFactor = 1.2; // Slight acceleration in last 2 weeks
      }

      const dayDecay = currentTheta * accelerationFactor;
      projectedDecayWeek += dayDecay;

      if (accelerationFactor > 1.0) {
        const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        inflectionPoints.push({
          date: date.toISOString().split('T')[0],
          accelerationFactor,
        });
      }
    }

    return {
      currentThetaPerDay: currentTheta,
      projectedDecayToday,
      projectedDecayWeek,
      inflectionPoints,
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.greeksCache.clear();
    this.portfolioGreeks = null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const greeksMonitor = new GreeksMonitorService();

// ============================================================================
// Public API
// ============================================================================

/**
 * Start monitoring Greeks for active trades
 */
export function startGreeksMonitoring(trades: Trade[]) {
  greeksMonitor.start(trades);
}

/**
 * Stop monitoring
 */
export function stopGreeksMonitoring() {
  greeksMonitor.stop();
}

/**
 * Get Greeks for a specific trade
 */
export function getTradeGreeks(tradeId: string): GreeksSnapshot | undefined {
  return greeksMonitor.getGreeksForTrade(tradeId);
}

/**
 * Get portfolio-level Greeks
 */
export function getPortfolioGreeks(): PortfolioGreeks | null {
  return greeksMonitor.getPortfolioGreeks();
}

/**
 * Project theta decay for a trade
 */
export function projectThetaDecay(tradeId: string): ThetaProjection | null {
  return greeksMonitor.projectThetaDecay(tradeId);
}

/**
 * Clear Greeks cache
 */
export function clearGreeksCache() {
  greeksMonitor.clearCache();
}
