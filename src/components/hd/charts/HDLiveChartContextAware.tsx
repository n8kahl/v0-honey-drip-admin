/**
 * HDLiveChartContextAware - Context-aware wrapper for HDLiveChart
 * Automatically detects and applies optimal configuration for day traders
 *
 * Detects 3 modes:
 * - BROWSE: Symbol selected, no trade loaded (1m chart, minimal indicators)
 * - LOADED: Contract selected, ready to enter (1m chart with TP/SL levels, contract metrics panel)
 * - ENTERED: Position active (1m focused, P&L panel)
 */

import React, { useMemo } from "react";
import { HDLiveChart } from "./HDLiveChart";
import { HDChartContainer } from "./HDChartContainer";
import { TradeMetricsPanel } from "./TradeMetricsPanel";
import { HDContractMetricsPanelCompact } from "../panels/HDContractMetricsPanelCompact";
import type { Trade, TradeState, Ticker } from "../../../types";
import type { ChartLevel } from "../../../types/tradeLevels";
import type { KeyLevels } from "../../../lib/riskEngine/types";

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
  keyLevels?: Partial<KeyLevels>;
  height?: number;
  className?: string;
  /** Show single chart (Phase 3) instead of dual 1m+5m */
  singleChart?: boolean;
}

export function HDLiveChartContextAware({
  ticker,
  tradeState,
  currentTrade,
  activeTicker,
  hasLoadedContract,
  levels = [],
  keyLevels,
  height = 400,
  className = "",
  singleChart = false,
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

  // Side-by-side layout: both charts get full height (not split)
  // Minimum height of 280px ensures charts render properly
  const chartHeight = useMemo(() => {
    return Math.max(280, height || 400);
  }, [height]);

  // For ENTERED state, reduce chart height to make room for metrics panel
  const finalChartHeight = useMemo(() => {
    if (mode === "ENTERED") {
      return Math.max(260, chartHeight - 60);
    }
    return chartHeight;
  }, [mode, chartHeight]);

  // Compact chart height for single chart mode (reduced by ~50%)
  const compactChartHeight = 180;

  // Single chart mode: Side-by-side chart + compact metrics panel
  if (singleChart) {
    return (
      <div className={className}>
        <HDChartContainer title="📊 Chart" defaultExpanded={true}>
          <div className="flex flex-row gap-4 w-full p-4">
            {/* Left: 1m chart (60% width, reduced height) */}
            <div className="flex-[3] min-w-0">
              <HDLiveChart
                ticker={chartTicker}
                initialTimeframe="1"
                indicators={indicatorConfig}
                events={[]}
                levels={showKeyLevels ? levels : []}
                height={compactChartHeight}
                className="w-full"
                showControls={false}
                showHeader={true}
                loadDelay={0}
              />
            </div>

            {/* Right: Compact metrics panel (40% width) */}
            {(mode === "LOADED" || mode === "BROWSE") && currentTrade?.contract && (
              <div className="flex-[2] min-w-[180px] max-w-[240px]">
                <HDContractMetricsPanelCompact
                  contract={currentTrade.contract}
                  trade={currentTrade}
                  underlyingPrice={activeTicker?.last}
                  keyLevels={keyLevels}
                  className="h-full"
                />
              </div>
            )}
          </div>
        </HDChartContainer>

        {/* Trade Metrics Panel for ENTERED state (P&L tracking) - below chart */}
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

  // Default: Dual 1m+5m side-by-side view
  return (
    <div className={className}>
      {/* Dual 1m+5m side-by-side view for day trading */}
      <HDChartContainer title="📊 Charts" defaultExpanded={true}>
        <div className="flex flex-row gap-4 w-full p-4">
          {/* Left: 1-minute chart for entry precision (50% width) */}
          <div className="flex-1 min-w-0" style={{ minWidth: 0 }}>
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
              loadDelay={0}
            />
          </div>
          {/* Right: 5-minute chart for context (50% width) - staggered load */}
          <div className="flex-1 min-w-0" style={{ minWidth: 0 }}>
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
              loadDelay={500}
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
