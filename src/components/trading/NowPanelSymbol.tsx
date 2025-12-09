/**
 * NowPanelSymbol - Symbol Analysis View (Operator-Grade Cockpit)
 *
 * Three-Panel Cockpit Layout:
 * 1. DecisionVizGrid (top) - Collapsible 4-box visualization grid
 * 2. EconomicEventsStrip - Always visible events strip
 * 3. Options Chain (left) + ActionRail (right) - Lower section
 */

import React, { useState, useMemo, useCallback } from "react";
import type { Ticker, Contract } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { HDContractGrid } from "../hd/common/HDContractGrid";
import { DecisionVizGrid, type DataHealth } from "../hd/viz/DecisionVizGrid";
import { EconomicEventsStrip } from "../hd/strips/EconomicEventsStrip";
import { ActionRail } from "../hd/tiles/ActionRail";
import { useContractRecommendation } from "../../hooks/useContractRecommendation";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import {
  useCandles,
  useIndicators,
  useMTFTrend,
  useSymbolData,
} from "../../stores/marketDataStore";
import { cn } from "../../lib/utils";
import { chipStyle } from "../../ui/semantics";
import { ChevronDown, ChevronUp } from "lucide-react";

interface NowPanelSymbolProps {
  symbol: string;
  activeTicker: Ticker | null;
  contracts: Contract[];
  onContractSelect: (contract: Contract) => void;
  compositeSignals?: CompositeSignal[];
  watchlist?: Ticker[];
}

export function NowPanelSymbol({
  symbol,
  activeTicker,
  contracts,
  onContractSelect,
  compositeSignals,
  watchlist = [],
}: NowPanelSymbolProps) {
  // Options chain expanded by default
  const [chainExpanded, setChainExpanded] = useState(true);

  // Selected contract state (manual selection from grid)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Get current price from watchlist or activeTicker
  const currentPrice = useMemo(() => {
    const fromWatchlist = watchlist.find((t) => t.symbol === symbol);
    return fromWatchlist?.last || activeTicker?.last || 0;
  }, [symbol, watchlist, activeTicker]);

  // Get contract recommendation
  const recommendation = useContractRecommendation({
    symbol,
    contracts,
    activeSignals: compositeSignals || [],
    currentPrice,
    changePercent: activeTicker?.changePercent,
  });

  // Get key levels for chart
  const { keyLevels } = useKeyLevels(symbol);

  // Get market data from store for DecisionViz
  const candles = useCandles(symbol, "1m");
  const indicators = useIndicators(symbol);
  const mtfTrend = useMTFTrend(symbol);
  const symbolData = useSymbolData(symbol);

  // Calculate data health based on last update time
  const dataHealth = useMemo((): DataHealth => {
    if (!symbolData) return "stale";
    const age = Date.now() - symbolData.lastUpdated;
    if (age < 5000) return "live"; // < 5 seconds
    if (age < 30000) return "delayed"; // < 30 seconds
    return "stale"; // > 30 seconds
  }, [symbolData?.lastUpdated]);

  // Retry handler for DecisionViz
  const handleRetry = useCallback(() => {
    console.log(`[NowPanelSymbol] Retry requested for ${symbol}`);
  }, [symbol]);

  // Active contract = manual selection OR recommended
  const activeContract = selectedContract || recommendation?.bestContract || null;

  // Infer trade type based on DTE
  const inferredTradeType = useMemo((): "Scalp" | "Day" | "Swing" | "LEAP" => {
    const dte = activeContract?.daysToExpiry ?? 0;
    if (dte === 0) return "Scalp";
    if (dte <= 3) return "Day";
    if (dte <= 14) return "Swing";
    return "LEAP";
  }, [activeContract?.daysToExpiry]);

  // Handle contract selection from grid
  const handleContractSelect = useCallback((contract: Contract) => {
    setSelectedContract(contract);
  }, []);

  // Handle "Load & Alert" from ActionRail
  const handleLoadContract = useCallback(
    (contract: Contract) => {
      onContractSelect(contract);
    },
    [onContractSelect]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-crossfade">
      {/* Top: DecisionVizGrid (Collapsible 4-box layout) */}
      <DecisionVizGrid
        symbol={symbol}
        candles={candles}
        keyLevels={keyLevels}
        indicators={indicators}
        mtfTrend={mtfTrend}
        dataHealth={dataHealth}
        currentPrice={currentPrice}
        onRetry={handleRetry}
        defaultExpanded={true}
      />

      {/* Economic Events Strip (Always Visible) */}
      <EconomicEventsStrip symbol={symbol} />

      {/* Lower Section: Options Chain + ActionRail */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Options Chain Section */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border-hairline)]">
          {/* Chain Header */}
          <button
            onClick={() => setChainExpanded(!chainExpanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border-hairline)]"
          >
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Options Chain
            </span>
            <span className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
              {contracts.length} contracts
              {chainExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>

          {/* Chain Content */}
          {chainExpanded && (
            <div className="flex-1 overflow-y-auto animate-fade-in-up">
              <HDContractGrid
                contracts={contracts}
                currentPrice={currentPrice}
                ticker={symbol}
                onContractSelect={handleContractSelect}
                recommendation={recommendation}
              />

              {/* Active Signals Summary */}
              {compositeSignals && compositeSignals.length > 0 && (
                <div className="px-4 py-3 border-t border-[var(--border-hairline)]">
                  <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
                    Active Signals
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {compositeSignals.slice(0, 5).map((signal, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          chipStyle(signal.direction === "LONG" ? "success" : "fail"),
                          "hover-lift-sm"
                        )}
                      >
                        {signal.opportunityType.replace(/_/g, " ")}
                      </span>
                    ))}
                    {compositeSignals.length > 5 && (
                      <span className={chipStyle("neutral")}>
                        +{compositeSignals.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: ActionRail */}
        <ActionRail
          symbol={symbol}
          contract={selectedContract}
          recommendedContract={recommendation?.bestContract}
          entryPrice={activeContract?.mid}
          tradeType={inferredTradeType}
          onLoadContract={handleLoadContract}
        />
      </div>
    </div>
  );
}

export default NowPanelSymbol;
