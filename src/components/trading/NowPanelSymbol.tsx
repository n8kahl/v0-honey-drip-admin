/**
 * NowPanelSymbol - Symbol Analysis View (Operator-Grade Setup Cockpit)
 *
 * Stacked 4-Zone Layout:
 * ZONE 1: HeaderRow (Ticker/Price + Confluence) - via SetupWorkspace
 * ZONE 2: EventsStrip (thin row) - via SetupWorkspace
 * ZONE 3: DecisionViz (full width, A/B/C tabs) - via SetupWorkspace
 * ZONE 4: SelectedContractStrip + CompactChain
 *
 * Key Behaviors:
 * - Auto-selects recommended contract on symbol load
 * - NO CTAs in center column (Load/Enter are in right ActionRail only)
 * - Contract selection updates all contract-scoped panels
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Ticker, Contract } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { SetupWorkspace, type DataHealth } from "../hd/viz/SetupWorkspace";
import { SelectedContractStrip } from "../hd/strips/SelectedContractStrip";
import { CompactChain } from "../hd/common/CompactChain";
import { useContractRecommendation } from "../../hooks/useContractRecommendation";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { useLoadedTradeLiveModel } from "../../hooks/useLoadedTradeLiveModel";
import {
  useCandles,
  useIndicators,
  useMTFTrend,
  useSymbolData,
} from "../../stores/marketDataStore";
import { cn } from "../../lib/utils";
import { chipStyle } from "../../ui/semantics";
import { FlowDashboard } from "../hd/flow";

interface NowPanelSymbolProps {
  symbol: string;
  activeTicker: Ticker | null;
  contracts: Contract[];
  onContractSelect: (contract: Contract) => void;
  compositeSignals?: CompositeSignal[];
  watchlist?: Ticker[];
  /** If true, disable auto-selection of contracts (e.g., when a trade is already loaded) */
  disableAutoSelect?: boolean;
}

export function NowPanelSymbol({
  symbol,
  activeTicker,
  contracts,
  onContractSelect,
  compositeSignals,
  watchlist = [],
  disableAutoSelect = false,
}: NowPanelSymbolProps) {
  // Manual contract selection state (null = use recommended)
  const [manualContract, setManualContract] = useState<Contract | null>(null);

  // Get market data from store
  const candles = useCandles(symbol, "1m");
  const indicators = useIndicators(symbol);
  const mtfTrend = useMTFTrend(symbol);
  const symbolData = useSymbolData(symbol);

  // Get current price from watchlist or activeTicker
  const currentPrice = useMemo(() => {
    const fromWatchlist = watchlist.find((t) => t.symbol === symbol);
    return fromWatchlist?.last || activeTicker?.last || 0;
  }, [symbol, watchlist, activeTicker]);

  // Calculate % change
  const calculatedChangePercent = useMemo(() => {
    if (activeTicker?.changePercent && activeTicker.changePercent !== 0) {
      return activeTicker.changePercent;
    }
    const watchlistTicker = watchlist.find((t) => t.symbol === symbol);
    if (watchlistTicker?.changePercent && watchlistTicker.changePercent !== 0) {
      return watchlistTicker.changePercent;
    }
    if (candles.length > 0 && currentPrice > 0) {
      const firstCandle = candles[0];
      if (firstCandle?.open && firstCandle.open > 0) {
        return ((currentPrice - firstCandle.open) / firstCandle.open) * 100;
      }
    }
    return 0;
  }, [activeTicker?.changePercent, watchlist, symbol, candles, currentPrice]);

  // Get contract recommendation
  const recommendation = useContractRecommendation({
    symbol,
    contracts,
    activeSignals: compositeSignals || [],
    currentPrice,
    changePercent: activeTicker?.changePercent,
  });

  // Get key levels
  const { keyLevels } = useKeyLevels(symbol);

  // Active contract = manual OR recommended (auto-selected)
  // NOTE: Moved up to enable live model hook
  const activeContract = manualContract || recommendation?.bestContract || null;
  const isUsingRecommended = !manualContract && !!recommendation?.bestContract;

  // Get live model for selected contract (streaming quotes + Greeks)
  const liveModel = useLoadedTradeLiveModel(symbol, activeContract);

  // Calculate data health
  const dataHealth = useMemo((): DataHealth => {
    if (!symbolData) return "stale";
    const age = Date.now() - symbolData.lastUpdated;
    if (age < 5000) return "live";
    if (age < 30000) return "delayed";
    return "stale";
  }, [symbolData?.lastUpdated]);

  // Reset manual selection when symbol changes (auto-select recommended)
  useEffect(() => {
    setManualContract(null);
  }, [symbol]);

  // Auto-trigger onContractSelect when recommendation loads (for right rail)
  // GUARD: Skip if disableAutoSelect is true (prevents re-triggering after trade loads)
  useEffect(() => {
    if (disableAutoSelect) return;
    if (recommendation?.bestContract && !manualContract) {
      // Notify parent that a contract is active (for right rail to populate)
      onContractSelect(recommendation.bestContract);
    }
  }, [recommendation?.bestContract, manualContract, onContractSelect, disableAutoSelect]);

  // Handle manual contract selection from chain
  const handleContractSelect = useCallback(
    (contract: Contract) => {
      setManualContract(contract);
      onContractSelect(contract);
    },
    [onContractSelect]
  );

  // Handle revert to recommended
  const handleRevertToRecommended = useCallback(() => {
    setManualContract(null);
    if (recommendation?.bestContract) {
      onContractSelect(recommendation.bestContract);
    }
  }, [recommendation?.bestContract, onContractSelect]);

  // Retry handler for data refresh
  const handleRetry = useCallback(() => {
    console.log(`[NowPanelSymbol] Retry requested for ${symbol}`);
  }, [symbol]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ZONES 1-3: SetupWorkspace (HeaderRow + Events + DecisionViz) */}
      <SetupWorkspace
        symbol={symbol}
        candles={candles}
        keyLevels={keyLevels}
        indicators={indicators}
        mtfTrend={mtfTrend}
        dataHealth={dataHealth}
        currentPrice={currentPrice}
        changePercent={calculatedChangePercent}
        symbolData={symbolData}
        onRetry={handleRetry}
      />

      {/* ZONE 4: Contract Selection */}
      <div className="px-3 pb-3 flex flex-col gap-2 overflow-hidden flex-1">
        {/* Selected Contract Strip with live data */}
        <SelectedContractStrip
          contract={activeContract}
          isRecommended={isUsingRecommended}
          onRevertToRecommended={handleRevertToRecommended}
          hasRecommendation={!!recommendation?.hasRecommendation}
          liveModel={liveModel}
        />

        {/* Horizontal Split: Options Chain (50%) + Logo (50%) */}
        <div className="flex gap-3 flex-1 overflow-hidden">
          {/* Left: Compact Options Chain (~50%) */}
          <div className="w-1/2 overflow-y-auto">
            <CompactChain
              contracts={contracts}
              currentPrice={currentPrice}
              ticker={symbol}
              onContractSelect={handleContractSelect}
              recommendation={recommendation}
              selectedContractId={activeContract?.id}
            />
          </div>

          {/* Right: Flow Dashboard + Active Signals (~50%) */}
          <div className="w-1/2 flex flex-col gap-3 overflow-y-auto">
            {/* Flow Dashboard - institutional flow context */}
            <FlowDashboard symbol={symbol} defaultExpanded={true} compact={false} />

            {/* Active Signals Summary */}
            {compositeSignals && compositeSignals.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                <div className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5 text-center">
                  Active Signals ({compositeSignals.length})
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {compositeSignals.slice(0, 3).map((signal, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        chipStyle(signal.direction === "LONG" ? "success" : "fail"),
                        "text-[8px] px-1.5 py-0.5"
                      )}
                    >
                      {signal.opportunityType.replace(/_/g, " ")}
                    </span>
                  ))}
                  {compositeSignals.length > 3 && (
                    <span className={cn(chipStyle("neutral"), "text-[8px] px-1.5 py-0.5")}>
                      +{compositeSignals.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NowPanelSymbol;
