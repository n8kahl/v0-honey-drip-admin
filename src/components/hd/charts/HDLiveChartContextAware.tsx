/**
 * HDLiveChartContextAware - Context-aware wrapper for HDLiveChart
 * Automatically detects and applies optimal configuration for day traders
 *
 * Detects 3 modes:
 * - BROWSE: Symbol selected, no trade loaded (5m, minimal indicators)
 * - LOADED: Contract selected, ready to enter (1m + 5m, key levels)
 * - ENTERED: Position active (1m focused, P&L panel)
 */

import React, { useMemo } from "react";
import { HDLiveChart } from "./HDLiveChart";
import { TradeMetricsPanel } from "./TradeMetricsPanel";
import type { Trade, TradeState, Ticker } from "../../../types";
import type { ChartLevel } from "../../../types/tradeLevels";
import {
  detectChartMode,
  getChartModeConfig,
  getSafeTimeframe,
} from "../../../lib/chartUtils/chartStateDetector";

interface HDLiveChartContextAwareProps {
  ticker: string;
  tradeState: TradeState;
  currentTrade: Trade | null;
  activeTicker: Ticker | null;
  hasLoadedContract: boolean;
  levels?: ChartLevel[];
  height?: number;
  className?: string;
}

export function HDLiveChartContextAware({
  ticker,
  tradeState,
  currentTrade,
  activeTicker,
  hasLoadedContract,
  levels = [],
  height = 400,
  className = "",
}: HDLiveChartContextAwareProps) {
  // Detect which mode we're in
  const mode = useMemo(
    () => detectChartMode(tradeState, currentTrade, hasLoadedContract),
    [tradeState, currentTrade, hasLoadedContract]
  );

  // Get optimized config for this mode
  const config = useMemo(() => getChartModeConfig(mode, ticker), [mode, ticker]);

  // Determine safe timeframe (undefined to get mode default)
  const timeframe = getSafeTimeframe(undefined, mode, config);

  // Get current price for P&L calculation
  const currentPrice = useMemo(() => {
    if (currentTrade?.contract?.mid) {
      return currentTrade.contract.mid;
    }
    return activeTicker?.last || 0;
  }, [currentTrade, activeTicker]);

  // Build indicator config based on mode
  const indicatorConfig = useMemo(
    () => ({
      ema: { periods: config.indicators.ema },
      vwap: { enabled: config.indicators.vwap, bands: false },
    }),
    [config.indicators]
  );

  // Determine chart height for dual view in LOADED mode
  const chartHeight = useMemo(() => {
    // In LOADED mode with dual view, use smaller height to fit both charts
    if (mode === "LOADED" && config.dualTimeframeView) {
      return height ? Math.floor(height / 2) - 10 : 180;
    }
    return height;
  }, [mode, config.dualTimeframeView, height]);

  // For ENTERED state, reduce chart height to make room for metrics panel
  const finalChartHeight = useMemo(() => {
    if (mode === "ENTERED") {
      return Math.max(200, chartHeight - 40);
    }
    return chartHeight;
  }, [mode, chartHeight]);

  return (
    <div
      className={`flex ${mode === "LOADED" && config.dualTimeframeView ? "flex-row gap-2" : "flex-col gap-0"} ${className}`}
    >
      {/* Main Chart */}
      <div className={mode === "LOADED" && config.dualTimeframeView ? "flex-1 min-w-0" : "w-full"}>
        <HDLiveChart
          ticker={ticker}
          initialTimeframe={timeframe}
          indicators={indicatorConfig}
          events={mode === "ENTERED" ? [] : []} // Events handled by TradingWorkspace
          levels={config.showKeyLevels ? levels : []}
          height={finalChartHeight}
          className="flex-shrink-0"
          showControls={mode !== "ENTERED"} // Hide controls in trading mode
        />
      </div>

      {/* Dual Timeframe View in LOADED mode - 5m for context/trend */}
      {mode === "LOADED" && config.dualTimeframeView && (
        <div className="flex-1 min-w-0 border-l border-gray-700 relative">
          <div className="absolute top-0 left-0 right-0 text-xs text-gray-500 px-3 py-1 bg-gray-900/50 z-10">
            1-minute view for entry precision
          </div>
          <div className="pt-7">
            <HDLiveChart
              ticker={ticker}
              initialTimeframe="1"
              indicators={indicatorConfig}
              events={[]}
              levels={levels}
              height={finalChartHeight}
              className="flex-shrink-0"
              showControls={false}
            />
          </div>
        </div>
      )}

      {/* Trade Metrics Panel below chart in ENTERED mode */}
      {mode === "ENTERED" && currentTrade && currentTrade.contract && (
        <TradeMetricsPanel
          trade={currentTrade}
          contract={currentTrade.contract}
          currentPrice={currentPrice}
          isExpanded={false}
        />
      )}
    </div>
  );
}
