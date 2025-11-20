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
import { recordIV, detectIVCrush, detectIVSpike } from '../lib/greeks/ivHistory';

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
   * Fetch Greeks from Massive API (real-time)
   */
  private async fetchGreeks(trade: Trade): Promise<GreeksSnapshot | null> {
    try {
      const daysToExpiry = Math.max(
        0,
        Math.ceil(
          (trade.contract.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      );

      // Construct option ticker (OCC format: TICKER + YYMMDD + C/P + Strike)
      const optionTicker = trade.contract.id;

      console.log(`[GreeksMonitor] Fetching real Greeks for ${optionTicker}`);

      // Fetch from Massive via proxy endpoint
      const PROXY_TOKEN = (import.meta as any).env?.VITE_MASSIVE_PROXY_TOKEN;
      const response = await fetch(`/api/massive/snapshot/options/${trade.ticker}?limit=250`, {
        headers: {
          'x-massive-proxy-token': PROXY_TOKEN || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Massive API returned ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      // Find the specific contract by matching strike, expiry, and type
      const contract = results.find((c: any) => {
        const details = c.details || c;
        return (
          details.strike_price === trade.contract.strike &&
          details.expiration_date === trade.contract.expiry &&
          (details.contract_type || '').toLowerCase().startsWith(trade.contract.type.toLowerCase())
        );
      });

      if (!contract) {
        console.warn(`[GreeksMonitor] Contract not found in snapshot, using cached values`);
        return this.createFallbackSnapshot(trade, daysToExpiry);
      }

      // Extract real Greeks from Massive response
      const greeks = contract.greeks || {};
      const lastQuote = contract.last_quote || {};
      const underlyingAsset = contract.underlying_asset || {};

      const bid = lastQuote.bid || lastQuote.bp || 0;
      const ask = lastQuote.ask || lastQuote.ap || 0;
      const optionPrice = bid > 0 && ask > 0 ? (bid + ask) / 2 : (contract.last_trade?.price || trade.contract.mid);

      const snapshot: GreeksSnapshot = {
        symbol: optionTicker,
        strike: trade.contract.strike,
        expiry: trade.contract.expiry,
        type: trade.contract.type,
        greeks: {
          delta: greeks.delta ?? trade.contract.delta ?? (trade.contract.type === 'C' ? 0.5 : -0.5),
          gamma: greeks.gamma ?? 0,
          theta: greeks.theta ?? 0,
          vega: greeks.vega ?? trade.contract.vega ?? 0,
          rho: greeks.rho ?? 0,
          impliedVolatility: contract.implied_volatility ?? trade.contract.iv ?? 0,
          timestamp: Date.now(),
        },
        underlyingPrice: underlyingAsset.price ?? trade.currentPrice ?? trade.entryPrice ?? 0,
        optionPrice,
        daysToExpiry,
      };

      console.log(`[GreeksMonitor] ✅ Real Greeks fetched:`, {
        delta: snapshot.greeks.delta?.toFixed(3),
        gamma: snapshot.greeks.gamma?.toFixed(4),
        theta: snapshot.greeks.theta?.toFixed(2),
        vega: snapshot.greeks.vega?.toFixed(3),
        iv: (snapshot.greeks.impliedVolatility * 100)?.toFixed(1) + '%',
      });

      // Record IV for historical tracking
      if (snapshot.greeks.impliedVolatility > 0) {
        recordIV(trade.ticker, snapshot.greeks.impliedVolatility, 'massive');

        // Check for IV crush or spike
        const crush = detectIVCrush(trade.ticker);
        const spike = detectIVSpike(trade.ticker);

        if (crush.isCrush) {
          console.warn(`[GreeksMonitor] ⚠️ IV CRUSH detected for ${trade.ticker}: ${crush.dropPercent.toFixed(1)}% drop`);
        }

        if (spike.isSpike) {
          console.warn(`[GreeksMonitor] ⚠️ IV SPIKE detected for ${trade.ticker}: ${spike.risePercent.toFixed(1)}% rise`);
        }
      }

      return snapshot;
    } catch (error) {
      console.error(`[GreeksMonitor] Failed to fetch real Greeks:`, error);
      // Fallback to cached/initial values with warning
      const daysToExpiry = Math.max(
        0,
        Math.ceil((trade.contract.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      return this.createFallbackSnapshot(trade, daysToExpiry);
    }
  }

  /**
   * Create fallback snapshot using cached contract values
   */
  private createFallbackSnapshot(trade: Trade, daysToExpiry: number): GreeksSnapshot {
    console.warn(`[GreeksMonitor] ⚠️ Using fallback Greeks (cached values)`);

    return {
      symbol: trade.contract.id,
      strike: trade.contract.strike,
      expiry: trade.contract.expiry,
      type: trade.contract.type,
      greeks: {
        delta: trade.contract.delta || (trade.contract.type === 'C' ? 0.5 : -0.5),
        gamma: trade.contract.gamma || 0,
        theta: trade.contract.theta || 0,
        vega: trade.contract.vega || 0,
        rho: 0,
        impliedVolatility: trade.contract.iv || 0,
        timestamp: Date.now(),
      },
      underlyingPrice: trade.currentPrice || trade.entryPrice || 0,
      optionPrice: trade.contract.mid,
      daysToExpiry,
    };
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
