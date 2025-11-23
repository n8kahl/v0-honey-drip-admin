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
    <div className={className}>
      {/* Single chart for BROWSE and ENTERED modes */}
      {(mode === "BROWSE" || mode === "ENTERED") && (
        <div className="w-full">
          <HDLiveChart
            ticker={ticker}
            initialTimeframe={timeframe}
            indicators={indicatorConfig}
            events={mode === "ENTERED" ? [] : []}
            levels={config.showKeyLevels ? levels : []}
            height={finalChartHeight}
            className="w-full"
            showControls={mode === "BROWSE"}
            showHeader={true}
          />
        </div>
      )}

      {/* Dual Timeframe View in LOADED mode - 5m (left) + 1m (right) */}
      {mode === "LOADED" && config.dualTimeframeView && (
        <div className="flex gap-6 w-full">
          {/* Left: 5-minute chart (50% width) */}
          <div className="flex-1 min-w-0">
            <HDLiveChart
              ticker={ticker}
              initialTimeframe="5"
              indicators={indicatorConfig}
              events={[]}
              levels={config.showKeyLevels ? levels : []}
              height={finalChartHeight}
              className="w-full"
              showControls={false}
              showHeader={true}
            />
          </div>
          {/* Right: 1-minute chart for entry precision (50% width) */}
          <div className="flex-1 min-w-0">
            <HDLiveChart
              ticker={ticker}
              initialTimeframe="1"
              indicators={indicatorConfig}
              events={[]}
              levels={config.showKeyLevels ? levels : []}
              height={finalChartHeight}
              className="w-full"
              showControls={false}
              showHeader={true}
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
