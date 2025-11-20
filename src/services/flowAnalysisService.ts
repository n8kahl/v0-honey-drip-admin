/**
 * flowAnalysisService.ts - Intelligent Flow Anomaly Detection
 *
 * Analyzes real-time options flow data to detect:
 * - Flow velocity (acceleration/deceleration of buying/selling)
 * - Smart money divergence (institutional vs retail)
 * - Flow exhaustion signals (buyers/sellers running out of steam)
 * - Block trade detection (whale activity)
 *
 * Integrates with marketDataStore and triggers alertEscalationStore
 */

import { useMarketDataStore } from '../stores/marketDataStore';
import { useAlertEscalationStore } from '../stores/alertEscalationStore';

// ============================================================================
// Types
// ============================================================================

export interface FlowSnapshot {
  timestamp: number;
  symbol: string;
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  buyVolume: number;
  sellVolume: number;
  largeTradeCount: number; // Trades > $100k
  averageTradeSize: number;
  blockTradeDetected: boolean;
  blockTradeSize?: number;
}

export interface FlowMetrics {
  symbol: string;

  // Current state
  current: FlowSnapshot;

  // Historical baseline (rolling average over last 20 bars)
  baseline: {
    buyPressure: number;
    sellPressure: number;
    buyVolume: number;
    sellVolume: number;
    largeTradeCount: number;
    averageTradeSize: number;
  };

  // Velocity (rate of change)
  velocity: {
    buyPressure: number; // Multiplier (1.0 = normal, 2.0 = 2x, etc.)
    sellPressure: number;
    volume: number;
  };

  // Divergence detection
  divergence: {
    detected: boolean;
    type: 'bullish' | 'bearish' | null; // Price down but buying, or price up but selling
    strength: number; // 0-100
  };

  // Exhaustion signals
  exhaustion: {
    detected: boolean;
    type: 'buying' | 'selling' | null;
    confidence: number; // 0-100
  };

  lastUpdated: number;
}

// ============================================================================
// Flow Analysis Engine
// ============================================================================

class FlowAnalysisEngine {
  private flowHistory: Map<string, FlowSnapshot[]> = new Map();
  private readonly HISTORY_LENGTH = 20; // Keep last 20 snapshots for baseline
  private readonly BLOCK_TRADE_THRESHOLD = 100000; // $100k minimum for block trades
  private readonly LARGE_TRADE_THRESHOLD = 50000; // $50k minimum for large trades

  /**
   * Analyze current market data and generate flow metrics
   */
  analyzeFlow(symbol: string): FlowMetrics | null {
    const marketStore = useMarketDataStore.getState();
    const symbolData = marketStore.getSymbolData(symbol);

    if (!symbolData) {
      console.warn(`[FlowAnalysis] No data for ${symbol}`);
      return null;
    }

    // Get latest candles (primary timeframe)
    const candles = symbolData.candles[symbolData.primaryTimeframe];
    if (candles.length < 2) {
      console.warn(`[FlowAnalysis] Not enough candles for ${symbol}`);
      return null;
    }

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    // ===== Create Current Snapshot =====
    const currentSnapshot = this.createSnapshot(symbol, lastCandle, prevCandle);

    // ===== Update History =====
    if (!this.flowHistory.has(symbol)) {
      this.flowHistory.set(symbol, []);
    }
    const history = this.flowHistory.get(symbol)!;
    history.push(currentSnapshot);

    // Trim history to max length
    if (history.length > this.HISTORY_LENGTH) {
      history.shift();
    }

    // ===== Calculate Baseline =====
    const baseline = this.calculateBaseline(history);

    // ===== Calculate Velocity =====
    const velocity = this.calculateVelocity(currentSnapshot, baseline);

    // ===== Detect Divergence =====
    const divergence = this.detectDivergence(symbol, currentSnapshot, candles);

    // ===== Detect Exhaustion =====
    const exhaustion = this.detectExhaustion(currentSnapshot, history);

    return {
      symbol,
      current: currentSnapshot,
      baseline,
      velocity,
      divergence,
      exhaustion,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Create flow snapshot from candle data
   */
  private createSnapshot(
    symbol: string,
    candle: any,
    prevCandle: any
  ): FlowSnapshot {
    // Derive buy/sell pressure from price action and volume
    const priceChange = candle.close - prevCandle.close;
    const priceChangePercent = (priceChange / prevCandle.close) * 100;

    // Simple heuristic: if price up, assume buying pressure; if down, selling
    // In reality, you'd get this from actual order flow data
    let buyPressure = 50;
    let sellPressure = 50;

    if (priceChangePercent > 0) {
      // Price up = more buying
      buyPressure = Math.min(100, 50 + priceChangePercent * 10);
      sellPressure = 100 - buyPressure;
    } else if (priceChangePercent < 0) {
      // Price down = more selling
      sellPressure = Math.min(100, 50 + Math.abs(priceChangePercent) * 10);
      buyPressure = 100 - sellPressure;
    }

    // Estimate buy/sell volume split
    const totalVolume = candle.volume;
    const buyVolume = (buyPressure / 100) * totalVolume;
    const sellVolume = (sellPressure / 100) * totalVolume;

    // Detect large trades (simplified - would need tick data in reality)
    const averageTradeSize = totalVolume / (candle.trades || 100);
    const largeTradeCount = candle.trades
      ? Math.floor((totalVolume / averageTradeSize) * 0.05)
      : 0; // Assume 5% are large

    // Block trade detection (very large single prints)
    const blockTradeDetected = averageTradeSize * candle.close > this.BLOCK_TRADE_THRESHOLD;
    const blockTradeSize = blockTradeDetected ? averageTradeSize * candle.close : undefined;

    return {
      timestamp: candle.time || candle.timestamp || Date.now(),
      symbol,
      buyPressure,
      sellPressure,
      buyVolume,
      sellVolume,
      largeTradeCount,
      averageTradeSize,
      blockTradeDetected,
      blockTradeSize,
    };
  }

  /**
   * Calculate baseline metrics from historical snapshots
   */
  private calculateBaseline(history: FlowSnapshot[]) {
    if (history.length === 0) {
      return {
        buyPressure: 50,
        sellPressure: 50,
        buyVolume: 0,
        sellVolume: 0,
        largeTradeCount: 0,
        averageTradeSize: 0,
      };
    }

    const sum = history.reduce(
      (acc, snapshot) => ({
        buyPressure: acc.buyPressure + snapshot.buyPressure,
        sellPressure: acc.sellPressure + snapshot.sellPressure,
        buyVolume: acc.buyVolume + snapshot.buyVolume,
        sellVolume: acc.sellVolume + snapshot.sellVolume,
        largeTradeCount: acc.largeTradeCount + snapshot.largeTradeCount,
        averageTradeSize: acc.averageTradeSize + snapshot.averageTradeSize,
      }),
      {
        buyPressure: 0,
        sellPressure: 0,
        buyVolume: 0,
        sellVolume: 0,
        largeTradeCount: 0,
        averageTradeSize: 0,
      }
    );

    const count = history.length;

    return {
      buyPressure: sum.buyPressure / count,
      sellPressure: sum.sellPressure / count,
      buyVolume: sum.buyVolume / count,
      sellVolume: sum.sellVolume / count,
      largeTradeCount: sum.largeTradeCount / count,
      averageTradeSize: sum.averageTradeSize / count,
    };
  }

  /**
   * Calculate velocity (rate of change vs baseline)
   */
  private calculateVelocity(
    current: FlowSnapshot,
    baseline: { buyPressure: number; sellPressure: number; buyVolume: number; sellVolume: number }
  ) {
    const buyPressureVelocity = baseline.buyPressure > 0
      ? current.buyPressure / baseline.buyPressure
      : 1;

    const sellPressureVelocity = baseline.sellPressure > 0
      ? current.sellPressure / baseline.sellPressure
      : 1;

    const totalVolume = current.buyVolume + current.sellVolume;
    const baselineVolume = baseline.buyVolume + baseline.sellVolume;
    const volumeVelocity = baselineVolume > 0
      ? totalVolume / baselineVolume
      : 1;

    return {
      buyPressure: buyPressureVelocity,
      sellPressure: sellPressureVelocity,
      volume: volumeVelocity,
    };
  }

  /**
   * Detect divergence between price action and flow
   */
  private detectDivergence(
    symbol: string,
    current: FlowSnapshot,
    candles: any[]
  ): { detected: boolean; type: 'bullish' | 'bearish' | null; strength: number } {
    if (candles.length < 2) {
      return { detected: false, type: null, strength: 0 };
    }

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    const priceChange = lastCandle.close - prevCandle.close;
    const priceBullish = priceChange > 0;

    // Flow is bullish if buy pressure > sell pressure significantly
    const flowBullish = current.buyPressure > current.sellPressure + 10;
    const flowBearish = current.sellPressure > current.buyPressure + 10;

    // Divergence: price and flow disagree
    if (priceBullish && flowBearish) {
      // Price up but heavy selling = bearish divergence (distribution)
      const strength = Math.min(100, current.sellPressure);
      return {
        detected: true,
        type: 'bearish',
        strength,
      };
    } else if (!priceBullish && flowBullish) {
      // Price down but heavy buying = bullish divergence (accumulation)
      const strength = Math.min(100, current.buyPressure);
      return {
        detected: true,
        type: 'bullish',
        strength,
      };
    }

    return { detected: false, type: null, strength: 0 };
  }

  /**
   * Detect flow exhaustion (buying/selling running out of steam)
   */
  private detectExhaustion(
    current: FlowSnapshot,
    history: FlowSnapshot[]
  ): { detected: boolean; type: 'buying' | 'selling' | null; confidence: number } {
    if (history.length < 5) {
      return { detected: false, type: null, confidence: 0 };
    }

    // Check last 5 snapshots for trend
    const recent = history.slice(-5);

    // Buying exhaustion: buy pressure was high but declining
    const buyPressures = recent.map((s) => s.buyPressure);
    const buyTrend = this.calculateTrend(buyPressures);

    if (buyPressures[0] > 70 && buyTrend < -5) {
      // Was high, now declining
      return {
        detected: true,
        type: 'buying',
        confidence: Math.min(100, Math.abs(buyTrend) * 10),
      };
    }

    // Selling exhaustion: sell pressure was high but declining
    const sellPressures = recent.map((s) => s.sellPressure);
    const sellTrend = this.calculateTrend(sellPressures);

    if (sellPressures[0] > 70 && sellTrend < -5) {
      return {
        detected: true,
        type: 'selling',
        confidence: Math.min(100, Math.abs(sellTrend) * 10),
      };
    }

    return { detected: false, type: null, confidence: 0 };
  }

  /**
   * Calculate simple linear trend (slope)
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ...
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Clear history for a symbol (e.g., when trade exits)
   */
  clearHistory(symbol: string) {
    this.flowHistory.delete(symbol);
  }

  /**
   * Clear all history
   */
  clearAllHistory() {
    this.flowHistory.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const flowAnalysisEngine = new FlowAnalysisEngine();

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze flow for a symbol and trigger alerts if anomalies detected
 */
export function analyzeAndAlertFlow(symbol: string, tradeId?: string): FlowMetrics | null {
  const metrics = flowAnalysisEngine.analyzeFlow(symbol);

  if (!metrics) return null;

  // ===== Trigger Alerts Based on Flow Anomalies =====
  const alertStore = useAlertEscalationStore.getState();

  // Flow velocity alert
  if (metrics.velocity.buyPressure > 2 || metrics.velocity.sellPressure > 2) {
    console.log(
      `[FlowAnalysis] ${symbol} flow velocity spike:`,
      metrics.velocity.buyPressure > 2 ? 'BULLISH' : 'BEARISH',
      `${Math.max(metrics.velocity.buyPressure, metrics.velocity.sellPressure).toFixed(1)}x`
    );
  }

  // Divergence alert
  if (metrics.divergence.detected) {
    console.log(
      `[FlowAnalysis] ${symbol} divergence detected:`,
      metrics.divergence.type?.toUpperCase(),
      `strength ${metrics.divergence.strength}`
    );
  }

  // Exhaustion alert
  if (metrics.exhaustion.detected) {
    console.log(
      `[FlowAnalysis] ${symbol} exhaustion detected:`,
      metrics.exhaustion.type?.toUpperCase(),
      `confidence ${metrics.exhaustion.confidence}%`
    );
  }

  // Block trade alert
  if (metrics.current.blockTradeDetected) {
    console.log(
      `[FlowAnalysis] ${symbol} BLOCK TRADE DETECTED:`,
      `$${(metrics.current.blockTradeSize || 0).toFixed(0)}`
    );
  }

  return metrics;
}

/**
 * Get flow metrics for multiple symbols
 */
export function analyzeBatchFlow(symbols: string[]): Map<string, FlowMetrics> {
  const results = new Map<string, FlowMetrics>();

  symbols.forEach((symbol) => {
    const metrics = flowAnalysisEngine.analyzeFlow(symbol);
    if (metrics) {
      results.set(symbol, metrics);
    }
  });

  return results;
}

/**
 * Clear flow history for a symbol
 */
export function clearFlowHistory(symbol: string) {
  flowAnalysisEngine.clearHistory(symbol);
}

/**
 * Clear all flow history
 */
export function clearAllFlowHistory() {
  flowAnalysisEngine.clearAllHistory();
}
