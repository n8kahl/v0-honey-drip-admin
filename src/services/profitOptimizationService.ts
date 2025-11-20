/**
 * profitOptimizationService.ts - AI-Powered Profit Optimization
 *
 * Generates intelligent trim/exit recommendations based on:
 * - Historical win rate patterns
 * - Confluence deterioration
 * - Technical levels (resistance, support)
 * - Greek decay profiles
 * - Risk/reward ratios
 *
 * Provides probabilistic outcomes and scaling suggestions with one-click approval workflow.
 */

import { Trade } from '../types';
import { useMarketDataStore, ConfluenceScore } from '../stores/marketDataStore';
import { FlowMetrics } from './flowAnalysisService';

// ============================================================================
// Types
// ============================================================================

export type RecommendationType = 'TRIM' | 'EXIT' | 'HOLD' | 'TRAIL_STOP' | 'ADD';
export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ProfitRecommendation {
  id: string;
  tradeId: string;
  ticker: string;
  type: RecommendationType;
  priority: RecommendationPriority;

  // Main recommendation
  title: string;
  reasoning: string;

  // Suggested action
  suggestedPercent?: number; // For trim/add: what % to trim/add
  suggestedPrice?: number; // Recommended execution price
  stopLossUpdate?: number; // New stop loss if applicable

  // Probability analysis
  winProbability?: number; // 0-100: chance of profit if held
  riskRewardRatio?: number; // Current R:R
  expectedValue?: number; // EV of holding vs exiting

  // Supporting data
  confluence: number;
  confluencePrev?: number;
  flowMetrics?: FlowMetrics;
  technicalLevel?: string; // e.g., "Resistance at $450"
  historicalPattern?: string; // e.g., "Similar setups retrace 15% 73% of the time"

  // Metadata
  timestamp: number;
  confidence: number; // 0-100: how confident is this recommendation
  isApproved: boolean;
  isDismissed: boolean;
}

export interface OptimizationContext {
  trade: Trade;
  currentPrice: number;
  confluence: ConfluenceScore;
  confluencePrev?: number;
  flowMetrics?: FlowMetrics;
  technicalLevels?: TechnicalLevels;
  greeks?: GreeksData;
  historicalData?: HistoricalTradeData;
}

export interface TechnicalLevels {
  resistance: number[];
  support: number[];
  nearestResistance?: number;
  nearestSupport?: number;
  distanceToResistancePercent?: number;
  distanceToSupportPercent?: number;
}

export interface GreeksData {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  thetaPerDay: number; // Dollar amount lost per day
  daysToExpiry: number;
}

export interface HistoricalTradeData {
  totalTrades: number;
  winRate: number;
  averageWinPercent: number;
  averageLossPercent: number;
  averageHoldTime: number; // minutes
  similarSetups?: {
    count: number;
    avgReturn: number;
    winRate: number;
    avgHoldTime: number;
  };
}

// ============================================================================
// Profit Optimization Engine
// ============================================================================

class ProfitOptimizationEngine {
  private recommendations: Map<string, ProfitRecommendation[]> = new Map();
  private historicalTrades: HistoricalTradeData = {
    totalTrades: 0,
    winRate: 0,
    averageWinPercent: 0,
    averageLossPercent: 0,
    averageHoldTime: 0,
  };

  /**
   * Generate profit optimization recommendations for a trade
   */
  generateRecommendations(context: OptimizationContext): ProfitRecommendation[] {
    const recommendations: ProfitRecommendation[] = [];

    // Calculate P&L
    const pnlPercent = context.trade.entryPrice
      ? ((context.currentPrice - context.trade.entryPrice) / context.trade.entryPrice) * 100
      : 0;

    // ===== Rule 1: Confluence Deterioration =====
    const confluenceDrop = (context.confluencePrev || 0) - context.confluence.overall;
    if (confluenceDrop >= 15 && context.confluence.overall < 60 && pnlPercent > 10) {
      recommendations.push({
        id: `rec-${Date.now()}-confluence-drop`,
        tradeId: context.trade.id,
        ticker: context.trade.ticker,
        type: 'TRIM',
        priority: confluenceDrop >= 25 ? 'HIGH' : 'MEDIUM',
        title: 'Trim on Confluence Weakness',
        reasoning: `Confluence dropped ${confluenceDrop.toFixed(0)} points to ${context.confluence.overall}. Setup deteriorating - consider taking partial profits.`,
        suggestedPercent: confluenceDrop >= 25 ? 50 : 25,
        suggestedPrice: context.currentPrice,
        confluence: context.confluence.overall,
        confluencePrev: context.confluencePrev,
        winProbability: this.calculateWinProbability(context, 'confluence_drop'),
        confidence: 75,
        timestamp: Date.now(),
        isApproved: false,
        isDismissed: false,
      });
    }

    // ===== Rule 2: Approaching Resistance =====
    if (context.technicalLevels?.nearestResistance) {
      const distPercent = context.technicalLevels.distanceToResistancePercent || 100;
      if (distPercent < 2 && distPercent > 0 && pnlPercent > 15) {
        recommendations.push({
          id: `rec-${Date.now()}-resistance`,
          tradeId: context.trade.id,
          ticker: context.trade.ticker,
          type: 'TRIM',
          priority: 'HIGH',
          title: 'Take Profits at Resistance',
          reasoning: `Price approaching major resistance at $${context.technicalLevels.nearestResistance.toFixed(2)} (${distPercent.toFixed(1)}% away). High probability of rejection.`,
          suggestedPercent: 50,
          suggestedPrice: context.currentPrice,
          technicalLevel: `Resistance at $${context.technicalLevels.nearestResistance.toFixed(2)}`,
          confluence: context.confluence.overall,
          winProbability: 65, // Resistance typically causes pullbacks
          riskRewardRatio: this.calculateRiskReward(context),
          confidence: 80,
          timestamp: Date.now(),
          isApproved: false,
          isDismissed: false,
        });
      }
    }

    // ===== Rule 3: Flow Divergence =====
    if (context.flowMetrics?.divergence.detected) {
      const isBearishDivergence =
        context.flowMetrics.divergence.type === 'bearish' && pnlPercent > 20;

      if (isBearishDivergence) {
        recommendations.push({
          id: `rec-${Date.now()}-flow-div`,
          tradeId: context.trade.id,
          ticker: context.trade.ticker,
          type: 'TRIM',
          priority: 'URGENT',
          title: 'Bearish Flow Divergence',
          reasoning: `Price rising but heavy selling detected (${context.flowMetrics.divergence.strength.toFixed(0)}% strength). Distribution likely - secure profits.`,
          suggestedPercent: 50,
          suggestedPrice: context.currentPrice,
          flowMetrics: context.flowMetrics,
          confluence: context.confluence.overall,
          winProbability: 55, // Divergence is a warning sign
          confidence: 85,
          timestamp: Date.now(),
          isApproved: false,
          isDismissed: false,
        });
      }
    }

    // ===== Rule 4: Strong Profit + Historical Pattern =====
    if (pnlPercent >= 30 && context.historicalData) {
      const avgWin = context.historicalData.averageWinPercent;
      if (pnlPercent >= avgWin * 0.8) {
        // At 80% of average winner
        recommendations.push({
          id: `rec-${Date.now()}-historical`,
          tradeId: context.trade.id,
          ticker: context.trade.ticker,
          type: 'TRIM',
          priority: 'MEDIUM',
          title: 'Historical Pattern Match',
          reasoning: `You're up ${pnlPercent.toFixed(1)}%, approaching your average winner of ${avgWin.toFixed(1)}%. Historical data suggests trimming here increases win rate.`,
          suggestedPercent: 25,
          suggestedPrice: context.currentPrice,
          historicalPattern: `Avg winner: ${avgWin.toFixed(1)}% | Win rate: ${context.historicalData.winRate.toFixed(0)}%`,
          confluence: context.confluence.overall,
          winProbability: context.historicalData.winRate,
          confidence: 70,
          timestamp: Date.now(),
          isApproved: false,
          isDismissed: false,
        });
      }
    }

    // ===== Rule 5: Theta Decay Acceleration =====
    if (context.greeks && context.greeks.thetaPerDay < -300) {
      const daysLeft = context.greeks.daysToExpiry;
      if (daysLeft <= 7 && pnlPercent > 0) {
        recommendations.push({
          id: `rec-${Date.now()}-theta`,
          tradeId: context.trade.id,
          ticker: context.trade.ticker,
          type: 'TRIM',
          priority: daysLeft <= 3 ? 'URGENT' : 'HIGH',
          title: 'Theta Decay Accelerating',
          reasoning: `Losing $${Math.abs(context.greeks.thetaPerDay).toFixed(0)}/day to time decay with only ${daysLeft} days left. Lock in gains before theta erodes profits.`,
          suggestedPercent: daysLeft <= 3 ? 75 : 50,
          suggestedPrice: context.currentPrice,
          confluence: context.confluence.overall,
          confidence: 80,
          timestamp: Date.now(),
          isApproved: false,
          isDismissed: false,
        });
      }
    }

    // ===== Rule 6: Trail Stop Suggestion =====
    if (pnlPercent >= 20 && (!context.trade.stopLoss || context.trade.stopMode !== 'trailing')) {
      const breakEvenPrice = context.trade.entryPrice || context.currentPrice;
      const trailPrice = breakEvenPrice + (context.currentPrice - breakEvenPrice) * 0.5; // 50% retracement

      recommendations.push({
        id: `rec-${Date.now()}-trail`,
        tradeId: context.trade.id,
        ticker: context.trade.ticker,
        type: 'TRAIL_STOP',
        priority: 'MEDIUM',
        title: 'Trail Stop to Breakeven',
        reasoning: `You're up ${pnlPercent.toFixed(1)}% - protect profits by trailing stop to $${trailPrice.toFixed(2)} (50% retracement).`,
        stopLossUpdate: trailPrice,
        suggestedPrice: trailPrice,
        confluence: context.confluence.overall,
        confidence: 75,
        timestamp: Date.now(),
        isApproved: false,
        isDismissed: false,
      });
    }

    // ===== Rule 7: Exit on Major Loss =====
    if (pnlPercent <= -15) {
      recommendations.push({
        id: `rec-${Date.now()}-cut-loss`,
        tradeId: context.trade.id,
        ticker: context.trade.ticker,
        type: 'EXIT',
        priority: 'URGENT',
        title: 'Cut Losses',
        reasoning: `Position down ${Math.abs(pnlPercent).toFixed(1)}% - setup invalidated. Preserve capital and move on.`,
        suggestedPercent: 100,
        suggestedPrice: context.currentPrice,
        confluence: context.confluence.overall,
        winProbability: 20, // Low chance of recovery
        confidence: 90,
        timestamp: Date.now(),
        isApproved: false,
        isDismissed: false,
      });
    }

    // ===== Rule 8: Hold Pattern (No Action Needed) =====
    if (recommendations.length === 0 && pnlPercent > 0 && pnlPercent < 15) {
      recommendations.push({
        id: `rec-${Date.now()}-hold`,
        tradeId: context.trade.id,
        ticker: context.trade.ticker,
        type: 'HOLD',
        priority: 'LOW',
        title: 'Hold Position',
        reasoning: `Setup intact with ${context.confluence.overall} confluence. Let winner run - no action needed yet.`,
        confluence: context.confluence.overall,
        winProbability: this.calculateWinProbability(context, 'hold'),
        confidence: 70,
        timestamp: Date.now(),
        isApproved: false,
        isDismissed: false,
      });
    }

    // Store recommendations
    this.recommendations.set(context.trade.id, recommendations);

    return recommendations;
  }

  /**
   * Calculate win probability based on context
   */
  private calculateWinProbability(
    context: OptimizationContext,
    scenario: string
  ): number {
    const { confluence, flowMetrics } = context;

    // Base probability from confluence
    let probability = confluence.overall;

    // Adjust for flow
    if (flowMetrics?.divergence.detected && flowMetrics.divergence.type === 'bearish') {
      probability -= 15;
    } else if (flowMetrics?.divergence.detected && flowMetrics.divergence.type === 'bullish') {
      probability += 10;
    }

    // Scenario-specific adjustments
    if (scenario === 'confluence_drop') {
      probability -= 20;
    } else if (scenario === 'hold') {
      probability += 5;
    }

    return Math.max(0, Math.min(100, probability));
  }

  /**
   * Calculate current risk/reward ratio
   */
  private calculateRiskReward(context: OptimizationContext): number {
    const { trade, currentPrice } = context;

    if (!trade.entryPrice || !trade.stopLoss || !trade.targetPrice) {
      return 1; // Default
    }

    const potentialReward = trade.targetPrice - currentPrice;
    const potentialRisk = currentPrice - trade.stopLoss;

    if (potentialRisk <= 0) return 10; // Already past stop
    if (potentialReward <= 0) return 0; // Already past target

    return potentialReward / potentialRisk;
  }

  /**
   * Get recommendations for a trade
   */
  getRecommendations(tradeId: string): ProfitRecommendation[] {
    return this.recommendations.get(tradeId) || [];
  }

  /**
   * Approve a recommendation
   */
  approveRecommendation(recommendationId: string) {
    for (const [tradeId, recs] of this.recommendations.entries()) {
      const rec = recs.find((r) => r.id === recommendationId);
      if (rec) {
        rec.isApproved = true;
        console.log('[ProfitOptimization] Recommendation approved:', rec.title);
        return true;
      }
    }
    return false;
  }

  /**
   * Dismiss a recommendation
   */
  dismissRecommendation(recommendationId: string) {
    for (const [tradeId, recs] of this.recommendations.entries()) {
      const rec = recs.find((r) => r.id === recommendationId);
      if (rec) {
        rec.isDismissed = true;
        console.log('[ProfitOptimization] Recommendation dismissed:', rec.title);
        return true;
      }
    }
    return false;
  }

  /**
   * Clear recommendations for a trade
   */
  clearRecommendations(tradeId: string) {
    this.recommendations.delete(tradeId);
  }

  /**
   * Update historical trade data for better recommendations
   */
  updateHistoricalData(data: HistoricalTradeData) {
    this.historicalTrades = data;
    console.log('[ProfitOptimization] Historical data updated:', data);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const profitOptimizationEngine = new ProfitOptimizationEngine();

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate recommendations for a trade
 */
export function generateProfitRecommendations(
  context: OptimizationContext
): ProfitRecommendation[] {
  return profitOptimizationEngine.generateRecommendations(context);
}

/**
 * Get existing recommendations for a trade
 */
export function getTradeRecommendations(tradeId: string): ProfitRecommendation[] {
  return profitOptimizationEngine.getRecommendations(tradeId);
}

/**
 * Approve a recommendation
 */
export function approveRecommendation(recommendationId: string): boolean {
  return profitOptimizationEngine.approveRecommendation(recommendationId);
}

/**
 * Dismiss a recommendation
 */
export function dismissRecommendation(recommendationId: string): boolean {
  return profitOptimizationEngine.dismissRecommendation(recommendationId);
}

/**
 * Clear recommendations for a trade
 */
export function clearTradeRecommendations(tradeId: string) {
  profitOptimizationEngine.clearRecommendations(tradeId);
}

/**
 * Update historical trade performance data
 */
export function updateHistoricalPerformance(data: HistoricalTradeData) {
  profitOptimizationEngine.updateHistoricalData(data);
}

/**
 * Calculate technical levels from market data
 */
export function calculateTechnicalLevels(ticker: string): TechnicalLevels | undefined {
  const marketStore = useMarketDataStore.getState();
  const symbolData = marketStore.getSymbolData(ticker);

  if (!symbolData) return undefined;

  const candles = symbolData.candles[symbolData.primaryTimeframe];
  if (candles.length < 20) return undefined;

  // Simple support/resistance detection (pivot highs/lows)
  const resistance: number[] = [];
  const support: number[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const candle = candles[i];
    const prev1 = candles[i - 1];
    const prev2 = candles[i - 2];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    // Pivot high (local resistance)
    if (
      candle.high > prev1.high &&
      candle.high > prev2.high &&
      candle.high > next1.high &&
      candle.high > next2.high
    ) {
      resistance.push(candle.high);
    }

    // Pivot low (local support)
    if (
      candle.low < prev1.low &&
      candle.low < prev2.low &&
      candle.low < next1.low &&
      candle.low < next2.low
    ) {
      support.push(candle.low);
    }
  }

  // Find nearest levels
  const lastPrice = candles[candles.length - 1].close;
  const nearestResistance = resistance
    .filter((r) => r > lastPrice)
    .sort((a, b) => a - b)[0];
  const nearestSupport = support
    .filter((s) => s < lastPrice)
    .sort((a, b) => b - a)[0];

  const distanceToResistancePercent = nearestResistance
    ? ((nearestResistance - lastPrice) / lastPrice) * 100
    : undefined;
  const distanceToSupportPercent = nearestSupport
    ? ((lastPrice - nearestSupport) / lastPrice) * 100
    : undefined;

  return {
    resistance: resistance.slice(-5), // Keep last 5
    support: support.slice(-5),
    nearestResistance,
    nearestSupport,
    distanceToResistancePercent,
    distanceToSupportPercent,
  };
}
