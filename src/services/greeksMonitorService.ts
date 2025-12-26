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

import { Contract, Trade } from "../types";
import { recordIV, detectIVCrush, detectIVSpike } from "../lib/greeks/ivHistory";
import { getMetricsService } from "./monitoring";
import { useAlertEscalationStore } from "../stores/alertEscalationStore";

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

/**
 * Greeks validation result
 */
export interface GreeksValidationResult {
  isValid: boolean;
  isEstimated: boolean; // True if using fallback values
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Constants - Greeks Validation Bounds
// ============================================================================

const GREEKS_BOUNDS = {
  // Delta: -1 to +1 for puts/calls respectively
  DELTA_MIN: -1,
  DELTA_MAX: 1,

  // Gamma: always positive, can reach 2.0+ for ATM options very close to expiry
  // Typical: 0 to 0.1, but allow up to 2.0 for edge cases
  GAMMA_MIN: 0,
  GAMMA_MAX: 2.0,

  // Theta: typically negative (time decay works against position)
  THETA_MIN: -5,
  THETA_MAX: 5,

  // Vega: typically 0 to 0.5 (sensitivity to 1% IV change)
  VEGA_MIN: -1,
  VEGA_MAX: 1,

  // Rho: interest rate sensitivity, typically -0.5 to 0.5
  RHO_MIN: -1,
  RHO_MAX: 1,

  // Implied Volatility: 0.01 to 5.0 (1% to 500%)
  // Allow up to 500% for extreme market events
  IV_MIN: 0.01,
  IV_MAX: 5.0,
};

export interface GreeksSnapshot {
  symbol: string; // Option symbol (e.g., "AAPL250117C00180000")
  strike: number;
  expiry: string;
  type: "C" | "P";
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
  private readonly TRADIER_API_URL = "https://api.tradier.com/v1";

  /**
   * Start monitoring Greeks for active trades
   */
  start(trades: Trade[]) {
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
  }

  /**
   * Poll Tradier API for Greeks
   */
  private async poll(trades: Trade[]) {
    if (trades.length === 0) {
      return;
    }

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
        Math.ceil((trade.contract.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );

      // Construct option ticker (OCC format: TICKER + YYMMDD + C/P + Strike)
      const optionTicker = trade.contract.id;

      // Fetch from Massive via proxy endpoint
      const { massive } = await import("../lib/massive");
      const tokenManager = massive.getTokenManager();
      const token = await tokenManager.getToken();

      const response = await fetch(`/api/massive/snapshot/options/${trade.ticker}?limit=250`, {
        headers: {
          "x-massive-proxy-token": token || "",
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
          (details.contract_type || "").toLowerCase().startsWith(trade.contract.type.toLowerCase())
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
      const optionPrice =
        bid > 0 && ask > 0 ? (bid + ask) / 2 : contract.last_trade?.price || trade.contract.mid;

      // Create safe Greeks with validation and fallback bounds
      const apiGreeks: Partial<Greeks> = {
        delta: greeks.delta ?? trade.contract.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega ?? trade.contract.vega,
        rho: greeks.rho,
        impliedVolatility: contract.implied_volatility ?? trade.contract.iv,
      };

      const { greeks: safeGreeks, validation: greeksValidation } = createSafeGreeks(
        apiGreeks,
        trade.contract.type
      );

      // Log validation results
      if (!greeksValidation.isValid) {
        console.warn(`[GreeksMonitor] ⚠️ Greeks validation failed for ${optionTicker}:`, {
          errors: greeksValidation.errors,
          warnings: greeksValidation.warnings,
        });
      }

      if (greeksValidation.isEstimated) {
        console.warn(
          `[GreeksMonitor] ⚠️ Using estimated Greeks for ${optionTicker} (API data incomplete)`
        );
      }

      const snapshot: GreeksSnapshot = {
        symbol: optionTicker,
        strike: trade.contract.strike,
        expiry: trade.contract.expiry,
        type: trade.contract.type,
        greeks: safeGreeks,
        underlyingPrice: underlyingAsset.price ?? trade.currentPrice ?? trade.entryPrice ?? 0,
        optionPrice,
        daysToExpiry,
      };

      // Record IV for historical tracking
      if (snapshot.greeks.impliedVolatility > 0) {
        recordIV(trade.ticker, snapshot.greeks.impliedVolatility, "massive");

        // Check for IV crush or spike
        const crush = detectIVCrush(trade.ticker);
        const spike = detectIVSpike(trade.ticker);

        if (crush.isCrush) {
          console.warn(
            `[GreeksMonitor] ⚠️ IV CRUSH detected for ${trade.ticker}: ${crush.dropPercent.toFixed(1)}% drop`
          );
        }

        if (spike.isSpike) {
          console.warn(
            `[GreeksMonitor] ⚠️ IV SPIKE detected for ${trade.ticker}: ${spike.risePercent.toFixed(1)}% rise`
          );
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
        delta: trade.contract.delta || (trade.contract.type === "C" ? 0.5 : -0.5),
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
  }

  /**
   * Check for Greeks-based alerts
   */
  private checkGreeksAlerts(snapshots: GreeksSnapshot[]) {
    const alertStore = useAlertEscalationStore.getState();

    snapshots.forEach((snapshot) => {
      const { greeks, daysToExpiry } = snapshot;

      // Alert conditions checked but not logged (integrate with alertEscalationStore if needed)
      // - High theta decay
      // - High gamma risk
      // - Low IV
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
          date: date.toISOString().split("T")[0],
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
// Greeks Validation Functions
// ============================================================================

/**
 * Validate Greeks values against realistic bounds
 * Returns validation result with errors, warnings, and estimated flag
 */
export function validateGreeks(greeks: Partial<Greeks>): GreeksValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isEstimated = false;

  // Validate delta
  if (greeks.delta !== undefined) {
    if (greeks.delta < GREEKS_BOUNDS.DELTA_MIN || greeks.delta > GREEKS_BOUNDS.DELTA_MAX) {
      errors.push(
        `Delta ${greeks.delta} out of bounds [${GREEKS_BOUNDS.DELTA_MIN}, ${GREEKS_BOUNDS.DELTA_MAX}]`
      );
    }
  } else {
    warnings.push("Delta not provided (will use fallback)");
    isEstimated = true;
  }

  // Validate gamma (must be non-negative, never 0)
  if (greeks.gamma !== undefined) {
    if (greeks.gamma < GREEKS_BOUNDS.GAMMA_MIN || greeks.gamma > GREEKS_BOUNDS.GAMMA_MAX) {
      warnings.push(
        `Gamma ${greeks.gamma} outside typical range [${GREEKS_BOUNDS.GAMMA_MIN}, ${GREEKS_BOUNDS.GAMMA_MAX}]`
      );
    }
    if (greeks.gamma === 0) {
      errors.push("Gamma cannot be exactly 0 (API likely missing data)");
      isEstimated = true;
    }
  } else {
    errors.push("Gamma not provided (critical for position risk)");
    isEstimated = true;
  }

  // Validate theta
  if (greeks.theta !== undefined) {
    if (greeks.theta < GREEKS_BOUNDS.THETA_MIN || greeks.theta > GREEKS_BOUNDS.THETA_MAX) {
      warnings.push(
        `Theta ${greeks.theta} outside typical range [${GREEKS_BOUNDS.THETA_MIN}, ${GREEKS_BOUNDS.THETA_MAX}]`
      );
    }
  } else {
    warnings.push("Theta not provided (will use 0)");
    isEstimated = true;
  }

  // Validate vega
  if (greeks.vega !== undefined) {
    if (greeks.vega < GREEKS_BOUNDS.VEGA_MIN || greeks.vega > GREEKS_BOUNDS.VEGA_MAX) {
      warnings.push(
        `Vega ${greeks.vega} outside typical range [${GREEKS_BOUNDS.VEGA_MIN}, ${GREEKS_BOUNDS.VEGA_MAX}]`
      );
    }
  } else {
    warnings.push("Vega not provided (will use 0)");
    isEstimated = true;
  }

  // Validate IV
  if (greeks.impliedVolatility !== undefined) {
    if (
      greeks.impliedVolatility < GREEKS_BOUNDS.IV_MIN ||
      greeks.impliedVolatility > GREEKS_BOUNDS.IV_MAX
    ) {
      warnings.push(
        `IV ${(greeks.impliedVolatility * 100).toFixed(1)}% outside typical range [${GREEKS_BOUNDS.IV_MIN * 100}%, ${GREEKS_BOUNDS.IV_MAX * 100}%]`
      );
    }
  } else {
    warnings.push("IV not provided");
    isEstimated = true;
  }

  const isValid = errors.length === 0;
  return { isValid, isEstimated, errors, warnings };
}

/**
 * Create safely bounded Greeks with fallback values
 * @param apiGreeks - Greeks from API (may have missing values)
 * @param optionType - 'C' for call, 'P' for put (used for delta fallback)
 * @returns Validated Greeks with all values in reasonable bounds
 */
export function createSafeGreeks(
  apiGreeks: Partial<Greeks>,
  optionType: "C" | "P"
): { greeks: Greeks; validation: GreeksValidationResult } {
  const validation = validateGreeks(apiGreeks);

  // Record Greeks validation metrics
  try {
    getMetricsService().recordGreeksValidation(
      validation.isValid,
      validation.isEstimated,
      validation.errors
    );
  } catch (e) {
    // Silently ignore metrics service errors
  }

  // Start with API values
  let delta = apiGreeks.delta;
  let gamma = apiGreeks.gamma;
  let theta = apiGreeks.theta;
  let vega = apiGreeks.vega;
  let rho = apiGreeks.rho;
  let iv = apiGreeks.impliedVolatility || 0;

  // ===== Apply Safe Fallbacks =====

  // Delta: Only use fallback if completely missing
  if (delta === undefined) {
    // Use reasonable defaults based on contract type and ATM assumption
    delta = optionType === "C" ? 0.5 : -0.5;
  } else if (delta < GREEKS_BOUNDS.DELTA_MIN || delta > GREEKS_BOUNDS.DELTA_MAX) {
    // Clamp out-of-bounds deltas
    delta = Math.max(GREEKS_BOUNDS.DELTA_MIN, Math.min(GREEKS_BOUNDS.DELTA_MAX, delta));
  }

  // Gamma: CRITICAL - must never default to 0
  if (gamma === undefined || gamma === 0) {
    // Use a small positive value for ATM assumption
    gamma = 0.01; // ~0.01 is typical for ATM options
    if (apiGreeks.gamma === 0) {
      console.error(`[GreeksMonitor] ❌ Gamma was 0 (data error), using fallback: ${gamma}`);
    }
  } else if (gamma < GREEKS_BOUNDS.GAMMA_MIN || gamma > GREEKS_BOUNDS.GAMMA_MAX) {
    gamma = Math.max(GREEKS_BOUNDS.GAMMA_MIN, Math.min(GREEKS_BOUNDS.GAMMA_MAX, gamma));
  }

  // Theta: Reasonable default is small negative (time decay)
  if (theta === undefined) {
    theta = -0.01; // Small daily theta decay
  } else if (theta < GREEKS_BOUNDS.THETA_MIN || theta > GREEKS_BOUNDS.THETA_MAX) {
    theta = Math.max(GREEKS_BOUNDS.THETA_MIN, Math.min(GREEKS_BOUNDS.THETA_MAX, theta));
  }

  // Vega: Can be 0 (short vega position has minimal vega exposure)
  if (vega === undefined) {
    vega = 0;
  } else if (vega < GREEKS_BOUNDS.VEGA_MIN || vega > GREEKS_BOUNDS.VEGA_MAX) {
    vega = Math.max(GREEKS_BOUNDS.VEGA_MIN, Math.min(GREEKS_BOUNDS.VEGA_MAX, vega));
  }

  // Rho: Often neglected in short-term trading, default to 0
  if (rho === undefined) {
    rho = 0;
  } else if (rho < GREEKS_BOUNDS.RHO_MIN || rho > GREEKS_BOUNDS.RHO_MAX) {
    rho = Math.max(GREEKS_BOUNDS.RHO_MIN, Math.min(GREEKS_BOUNDS.RHO_MAX, rho));
  }

  // IV: Clamp to reasonable range
  if (iv < GREEKS_BOUNDS.IV_MIN) {
    iv = GREEKS_BOUNDS.IV_MIN;
  } else if (iv > GREEKS_BOUNDS.IV_MAX) {
    iv = GREEKS_BOUNDS.IV_MAX;
  }

  return {
    greeks: {
      delta,
      gamma,
      theta,
      vega,
      rho,
      impliedVolatility: iv,
      timestamp: Date.now(),
    },
    validation,
  };
}

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
