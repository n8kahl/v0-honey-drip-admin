/**
 * Demo Chart Showcase
 *
 * Displays the new HDStrategyMiniChart for all demo symbols
 * Only visible when demo mode is active
 */

import { useDemoMode } from '../../contexts/DemoModeContext';
import { useMarketDataStore } from '../../stores/marketDataStore';
import { HDStrategyMiniChart } from '../hd/HDStrategyMiniChart';
import { calculateEMA } from '../../lib/indicators';
import { X } from 'lucide-react';
import { useState } from 'react';

export function DemoChartShowcase() {
  const { isDemoMode } = useDemoMode();
  const [isExpanded, setIsExpanded] = useState(true);
  const symbols = useMarketDataStore((s) => Object.keys(s.symbols || {}));

  // Only show in demo mode
  if (!isDemoMode || symbols.length === 0) {
    return null;
  }

  // If collapsed, show minimal bar
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors text-sm font-medium"
        >
          📊 Show Strategy Charts ({symbols.length})
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md max-h-[600px] overflow-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h3 className="text-sm font-semibold text-zinc-100">Strategy Charts Demo</h3>
          <span className="text-xs text-zinc-500">({symbols.length} symbols)</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          title="Minimize"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Charts Grid */}
      <div className="p-4 space-y-4">
        {symbols.slice(0, 6).map((symbol) => {
          const marketData = useMarketDataStore((s) => s.symbols[symbol]);

          if (!marketData?.bars?.['5m'] || marketData.bars['5m'].length < 20) {
            return (
              <div key={symbol} className="p-4 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-sm text-zinc-400">
                  {symbol} - Loading data...
                </div>
              </div>
            );
          }

          const bars = marketData.bars['5m'];
          const closes = bars.map((b) => b.close);
          const ema9 = calculateEMA(closes, 9);
          const ema21 = calculateEMA(closes, 21);

          const signals =
            marketData.strategySignals?.map((sig) => ({
              time: new Date(sig.createdAt).getTime() / 1000,
              price: sig.payload?.entryPrice || bars[bars.length - 1].close,
              strategyName: sig.payload?.strategyName || 'Unknown',
              confidence: sig.confidence || 0,
              side: (sig.payload?.side as 'long' | 'short') || 'long',
              entry: sig.payload?.entryPrice,
              stop: sig.payload?.stopLoss,
              targets: sig.payload?.targets,
            })) || [];

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
            <div key={symbol} className="bg-zinc-800/30 rounded-lg border border-zinc-700 overflow-hidden">
              <HDStrategyMiniChart
                symbol={symbol}
                bars={bars}
                ema9={ema9}
                ema21={ema21}
                signals={signals}
                flow={flow}
                className="w-full"
              />
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-700 px-4 py-2">
        <div className="text-xs text-zinc-500">
          These charts show strategy signals, flow data, and entry/stop/targets automatically
        </div>
      </div>
    </div>
  );
}
