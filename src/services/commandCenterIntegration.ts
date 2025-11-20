/**
 * commandCenterIntegration.ts - Command Center Integration Service
 *
 * Orchestrates all Phase 1 services:
 * - Monitors active trades continuously
 * - Runs flow analysis for each trade
 * - Generates profit optimization recommendations
 * - Polls Greeks from Tradier
 * - Checks alert escalation rules
 * - Auto position management (with approval)
 *
 * This is the "brain" that connects everything together.
 */

import { Trade } from '../types';
import { useTradeStore } from '../stores/tradeStore';
import { useMarketDataStore } from '../stores/marketDataStore';
import { useAlertEscalationStore, EscalationContext, calculateDistanceToStop, calculateDistanceToTarget } from '../stores/alertEscalationStore';
import { analyzeAndAlertFlow } from './flowAnalysisService';
import { generateProfitRecommendations, calculateTechnicalLevels } from './profitOptimizationService';
import { startGreeksMonitoring, stopGreeksMonitoring, getTradeGreeks } from './greeksMonitorService';
import { checkAutoRules } from './autoPositionService';

// ============================================================================
// Integration Service
// ============================================================================

class CommandCenterIntegrationService {
  private monitoringInterval: number | null = null;
  private readonly MONITOR_INTERVAL_MS = 5000; // Check every 5 seconds
  private previousConfluence: Map<string, number> = new Map();
  private isRunning = false;

  /**
   * Start monitoring active trades
   */
  start() {
    if (this.isRunning) {
      console.log('[CommandCenter] Already running');
      return;
    }

    console.log('[CommandCenter] Starting monitoring...');
    this.isRunning = true;

    // Get active trades
    const activeTrades = useTradeStore.getState().getEnteredTrades();

    // Start Greeks monitoring
    if (activeTrades.length > 0) {
      startGreeksMonitoring(activeTrades);
    }

    // Run initial check
    this.monitorTrades();

    // Set up recurring monitoring
    this.monitoringInterval = window.setInterval(() => {
      this.monitorTrades();
    }, this.MONITOR_INTERVAL_MS);

    console.log('[CommandCenter] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;

    console.log('[CommandCenter] Stopping monitoring...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Stop Greeks monitoring
    stopGreeksMonitoring();

    this.isRunning = false;
    console.log('[CommandCenter] Monitoring stopped');
  }

  /**
   * Main monitoring loop - checks all active trades
   */
  private monitorTrades() {
    const activeTrades = useTradeStore.getState().getEnteredTrades();

    if (activeTrades.length === 0) {
      // No trades to monitor
      return;
    }

    console.log(`[CommandCenter] Monitoring ${activeTrades.length} active trades`);

    activeTrades.forEach((trade) => {
      this.monitorTrade(trade);
    });
  }

  /**
   * Monitor a single trade
   */
  private monitorTrade(trade: Trade) {
    try {
      // Get current market data
      const symbolData = useMarketDataStore.getState().getSymbolData(trade.ticker);
      if (!symbolData) {
        console.warn(`[CommandCenter] No market data for ${trade.ticker}`);
        return;
      }

      const candles = symbolData.candles[symbolData.primaryTimeframe];
      if (candles.length === 0) return;

      const currentPrice = candles[candles.length - 1].close;
      const confluence = symbolData.confluence;

      // Get previous confluence for comparison
      const prevConfluence = this.previousConfluence.get(trade.id) || confluence.overall;
      this.previousConfluence.set(trade.id, confluence.overall);

      // Calculate P&L
      const pnlPercent = trade.entryPrice
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : 0;

      // ===== 1. Flow Analysis =====
      const flowMetrics = analyzeAndAlertFlow(trade.ticker, trade.id);

      // ===== 2. Greeks Monitoring =====
      const greeksSnapshot = getTradeGreeks(trade.id);

      // ===== 3. Alert Escalation Check =====
      const escalationContext: EscalationContext = {
        tradeId: trade.id,
        ticker: trade.ticker,
        currentPrice,
        entryPrice: trade.entryPrice || 0,
        stopLoss: trade.stopLoss,
        targetPrice: trade.targetPrice,
        pnlPercent,
        confluence: confluence.overall,
        confluencePrev: prevConfluence,
        flowVelocity: flowMetrics?.velocity.buyPressure || flowMetrics?.velocity.sellPressure,
        flowPressure: flowMetrics?.current.buyPressure,
        thetaPerDay: greeksSnapshot?.greeks.theta,
        gammaRisk: greeksSnapshot?.greeks.gamma,
        vegaExposure: greeksSnapshot ? greeksSnapshot.greeks.vega * 100 : undefined,
        distanceToStopPercent: trade.stopLoss
          ? calculateDistanceToStop(currentPrice, trade.stopLoss)
          : undefined,
        distanceToTargetPercent: trade.targetPrice
          ? calculateDistanceToTarget(currentPrice, trade.targetPrice)
          : undefined,
      };

      useAlertEscalationStore.getState().checkEscalation(escalationContext);

      // ===== 4. Profit Optimization =====
      const technicalLevels = calculateTechnicalLevels(trade.ticker);

      generateProfitRecommendations({
        trade,
        currentPrice,
        confluence,
        confluencePrev: prevConfluence,
        flowMetrics: flowMetrics || undefined,
        technicalLevels,
        greeks: greeksSnapshot
          ? {
              delta: greeksSnapshot.greeks.delta,
              gamma: greeksSnapshot.greeks.gamma,
              theta: greeksSnapshot.greeks.theta,
              vega: greeksSnapshot.greeks.vega,
              thetaPerDay: greeksSnapshot.greeks.theta,
              daysToExpiry: greeksSnapshot.daysToExpiry,
            }
          : undefined,
      });

      // ===== 5. Auto Position Management =====
      checkAutoRules(trade, currentPrice, confluence, prevConfluence);

    } catch (error) {
      console.error(`[CommandCenter] Error monitoring trade ${trade.ticker}:`, error);
    }
  }

  /**
   * Restart monitoring (useful when trades change)
   */
  restart() {
    this.stop();
    this.start();
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTrades: useTradeStore.getState().getEnteredTrades().length,
      lastCheck: Date.now(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const commandCenterIntegration = new CommandCenterIntegrationService();

// ============================================================================
// Public API
// ============================================================================

/**
 * Start Command Center monitoring
 */
export function startCommandCenter() {
  commandCenterIntegration.start();
}

/**
 * Stop Command Center monitoring
 */
export function stopCommandCenter() {
  commandCenterIntegration.stop();
}

/**
 * Restart Command Center (useful when trades change)
 */
export function restartCommandCenter() {
  commandCenterIntegration.restart();
}

/**
 * Get Command Center status
 */
export function getCommandCenterStatus() {
  return commandCenterIntegration.getStatus();
}

// ============================================================================
// Auto-start on module load (if there are active trades)
// ============================================================================

// Auto-start when first loaded if trades exist
if (typeof window !== 'undefined') {
  // Wait for stores to initialize
  setTimeout(() => {
    const activeTrades = useTradeStore.getState().getEnteredTrades();
    if (activeTrades.length > 0) {
      console.log('[CommandCenter] Auto-starting monitoring for existing trades');
      startCommandCenter();
    }
  }, 2000);

  // Listen for trade changes
  useTradeStore.subscribe((state) => {
    const enteredTrades = state.activeTrades.filter((t) => t.state === 'ENTERED');

    if (enteredTrades.length > 0 && !commandCenterIntegration.getStatus().isRunning) {
      console.log('[CommandCenter] Trades detected, starting monitoring');
      startCommandCenter();
    } else if (enteredTrades.length === 0 && commandCenterIntegration.getStatus().isRunning) {
      console.log('[CommandCenter] No active trades, stopping monitoring');
      stopCommandCenter();
    }
  });
}
