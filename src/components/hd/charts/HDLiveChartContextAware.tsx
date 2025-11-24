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
import { HDChartContainer } from "./HDChartContainer";
import { TradeMetricsPanel } from "./TradeMetricsPanel";
import type { Trade, TradeState, Ticker } from "../../../types";
import type { ChartLevel } from "../../../types/tradeLevels";

// Chart mode detection (inline - no longer using chartStateDetector)
type ChartMode = "BROWSE" | "LOADED" | "ENTERED";

function detectChartMode(
  tradeState: TradeState,
  currentTrade: Trade | null,
  hasLoadedContract: boolean
): ChartMode {
  if (tradeState === "ENTERED") return "ENTERED";
  if (tradeState === "LOADED" || hasLoadedContract) return "LOADED";
  return "BROWSE";
}

/**
 * Extract underlying symbol from options ticker
 * Options format: O:SPY241123C00660000 → SPY
 * Stocks/Indices: SPY or I:SPX → unchanged
 */
function extractUnderlyingSymbol(ticker: string): string {
  if (!ticker) return ticker;

  // Options ticker format: O:SYMBOL241123C00660000
  if (ticker.startsWith("O:")) {
    // Extract symbol between "O:" and the date (6 digits YYMMDD)
    const match = ticker.match(/^O:([A-Z]+)\d{6}/);
    if (match) {
      return match[1]; // Return underlying symbol (e.g., "SPY", "SPX")
    }
  }

  // For stocks/indices, return as-is
  return ticker;
}

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
  // Extract underlying symbol from options ticker
  // When viewing options, we show the underlying's chart (has historical data)
  const chartTicker = useMemo(() => extractUnderlyingSymbol(ticker), [ticker]);

  // Detect which mode we're in
  const mode = useMemo(
    () => detectChartMode(tradeState, currentTrade, hasLoadedContract),
    [tradeState, currentTrade, hasLoadedContract]
  );

  // Get current price for P&L calculation
  const currentPrice = useMemo(() => {
    if (currentTrade?.contract?.mid) {
      return currentTrade.contract.mid;
    }
    return activeTicker?.last || 0;
  }, [currentTrade, activeTicker]);

  // Simple indicator config - show key indicators
  const indicatorConfig = useMemo(
    () => ({
      ema: { periods: [9, 21] },
      vwap: { enabled: true, bands: false },
    }),
    []
  );

  // Show key levels when in LOADED or ENTERED mode
  const showKeyLevels = mode === "LOADED" || mode === "ENTERED";

  // Always use dual view on desktop - split height equally between 1m and 5m charts
  const chartHeight = useMemo(() => {
    // Always show dual 1m+5m view, split the height
    return height ? Math.floor(height / 2) - 10 : 180;
  }, [height]);

  // For ENTERED state, reduce chart height to make room for metrics panel
  const finalChartHeight = useMemo(() => {
    if (mode === "ENTERED") {
      return Math.max(200, chartHeight - 40);
    }
    return chartHeight;
  }, [mode, chartHeight]);

  return (
    <div className={className}>
      {/* Always show dual 1m+5m view wrapped in collapsible container */}
      <HDChartContainer title="📊 Charts" defaultExpanded={true}>
        <div className="flex gap-6 w-full p-4">
          {/* Left: 5-minute chart (50% width) */}
          <div className="flex-1 min-w-0">
            <HDLiveChart
              ticker={chartTicker}
              initialTimeframe="5"
              indicators={indicatorConfig}
              events={[]}
              levels={showKeyLevels ? levels : []}
              height={finalChartHeight}
              className="w-full"
              showControls={false}
              showHeader={true}
            />
          </div>
          {/* Right: 1-minute chart for entry precision (50% width) */}
          <div className="flex-1 min-w-0">
            <HDLiveChart
              ticker={chartTicker}
              initialTimeframe="1"
              indicators={indicatorConfig}
              events={[]}
              levels={showKeyLevels ? levels : []}
              height={finalChartHeight}
              className="w-full"
              showControls={false}
              showHeader={true}
            />
          </div>
        </div>
      </HDChartContainer>

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
