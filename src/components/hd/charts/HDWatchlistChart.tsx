/**
 * Watchlist Chart Wrapper
 *
 * Safe wrapper that allows gradual rollout of HDStrategyMiniChart
 * without breaking existing HDMicroChart functionality.
 *
 * Feature flag controls which chart is used.
 * Falls back to HDMicroChart if data unavailable.
 */

import { HDMicroChart } from './HDMicroChart';
import { HDStrategyMiniChart } from './HDStrategyMiniChart';
import { useMarketDataStore } from '../../../stores/marketDataStore';
import { calculateEMA } from '../../../lib/indicators';

interface Props {
  symbol: string;
  currentPrice: number;
  dailyChange?: number;
  volume?: number;
  marketStatus?: 'open' | 'closed' | 'pre' | 'post';
  className?: string;
}

/**
 * Feature flag: Controls which chart component to use
 *
 * Set to:
 * - true: Use new HDStrategyMiniChart (shows strategies + flow)
 * - false: Use old HDMicroChart (simple area chart)
 * - 'auto': Use new chart if data available, otherwise fallback
 */
const USE_STRATEGY_CHART: boolean | 'auto' = 'auto';

export function HDWatchlistChart({ symbol, currentPrice, dailyChange, volume, marketStatus, className }: Props) {
  // Fetch data from marketDataStore
  const marketData = useMarketDataStore((s) => s.symbols[symbol]);

  // Determine which chart to use
  const shouldUseStrategyChart = (() => {
    if (USE_STRATEGY_CHART === false) return false;
    if (USE_STRATEGY_CHART === true) return true;

    // 'auto' mode: use strategy chart only if we have the required data
    if (!marketData?.bars?.['5m'] || marketData.bars['5m'].length < 20) {
      return false; // Not enough bar data
    }

    return true; // Have enough data, use strategy chart
  })();

  // FALLBACK: Use old chart if feature flag off or insufficient data
  if (!shouldUseStrategyChart) {
    return (
      <HDMicroChart
        ticker={symbol}
        currentPrice={currentPrice}
        dailyChange={dailyChange}
        volume={volume}
        marketStatus={marketStatus}
        className={className}
      />
    );
  }

  // NEW: Use strategy-focused chart
  try {
    const bars = marketData.bars['5m'] || [];

    // Calculate EMAs
    const closes = bars.map((b) => b.close);
    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);

    // Map strategy signals to chart markers
    const signals =
      marketData.strategySignals?.map((sig) => {
        const createdAt = new Date(sig.createdAt).getTime() / 1000;

        return {
          time: createdAt,
          price: sig.payload?.entryPrice || currentPrice,
          strategyName: sig.payload?.strategyName || 'Unknown',
          confidence: sig.confidence || 0,
          side: (sig.payload?.side as 'long' | 'short') || 'long',
          entry: sig.payload?.entryPrice,
          stop: sig.payload?.stopLoss,
          targets: sig.payload?.targets,
        };
      }) || [];

    // Map flow metrics to flow bars
    const flow = marketData.flowMetrics
      ? [
          {
            time: marketData.flowMetrics.timestamp / 1000,
            callVolume: marketData.flowMetrics.callVolume,
            putVolume: marketData.flowMetrics.putVolume,
            hasSweep: marketData.flowMetrics.sweepCount > 0,
            hasBlock: marketData.flowMetrics.blockCount > 0,
          },
        ]
      : [];

    return (
      <HDStrategyMiniChart
        symbol={symbol}
        bars={bars}
        ema9={ema9}
        ema21={ema21}
        signals={signals}
        flow={flow}
        className={className}
      />
    );
  } catch (error) {
    // SAFETY: If HDStrategyMiniChart fails, fallback to HDMicroChart
    console.error(`[HDWatchlistChart] Error rendering strategy chart for ${symbol}, falling back to micro chart:`, error);

    return (
      <HDMicroChart
        ticker={symbol}
        currentPrice={currentPrice}
        dailyChange={dailyChange}
        volume={volume}
        marketStatus={marketStatus}
        className={className}
      />
    );
  }
}
