/**
 * NowPanelSymbol - Symbol Analysis View (Operator-Grade Setup Cockpit)
 *
 * Layout (per plan spec):
 * 1. Top4Grid (2x2): Ticker/Price, Confluence, Events, ATR/Range/MTF
 * 2. SelectedContractStrip: Shows active contract (recommended or manual)
 * 3. CompactChain: ATM ±2 strikes, expandable
 *
 * Key Behaviors:
 * - Auto-selects recommended contract on symbol load
 * - NO CTAs in center column (Load/Enter are in right ActionRail only)
 * - Contract selection updates all contract-scoped panels
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Ticker, Contract } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { Top4Grid, type DataHealth } from "../hd/viz/Top4Grid";
import { SelectedContractStrip } from "../hd/strips/SelectedContractStrip";
import { CompactChain } from "../hd/common/CompactChain";
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

  // Calculate data health
  const dataHealth = useMemo((): DataHealth => {
    if (!symbolData) return "stale";
    const age = Date.now() - symbolData.lastUpdated;
    if (age < 5000) return "live";
    if (age < 30000) return "delayed";
    return "stale";
  }, [symbolData?.lastUpdated]);

  // Active contract = manual OR recommended (auto-selected)
  const activeContract = manualContract || recommendation?.bestContract || null;
  const isUsingRecommended = !manualContract && !!recommendation?.bestContract;

  // Reset manual selection when symbol changes (auto-select recommended)
  useEffect(() => {
    setManualContract(null);
  }, [symbol]);

  // Auto-trigger onContractSelect when recommendation loads (for right rail)
  useEffect(() => {
    if (recommendation?.bestContract && !manualContract) {
      // Notify parent that a contract is active (for right rail to populate)
      onContractSelect(recommendation.bestContract);
    }
  }, [recommendation?.bestContract, manualContract, onContractSelect]);

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

  // Confluence data from MTF trend and indicators
  const confluenceData = useMemo(() => {
    const bullCount = Object.values(mtfTrend).filter((t) => t === "bull").length;
    const bearCount = Object.values(mtfTrend).filter((t) => t === "bear").length;
    const total = bullCount + bearCount;

    let direction: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
    let score = 50;

    if (total >= 2) {
      if (bullCount >= bearCount * 2) {
        direction = "LONG";
        score = 60 + (bullCount / 4) * 30;
      } else if (bearCount >= bullCount * 2) {
        direction = "SHORT";
        score = 60 + (bearCount / 4) * 30;
      }
    }

    // Adjust based on RSI
    if (indicators.rsi14 !== undefined) {
      if (indicators.rsi14 >= 70) {
        score = Math.max(score - 15, 30);
        if (direction === "LONG") direction = "NEUTRAL";
      } else if (indicators.rsi14 <= 30) {
        score = Math.max(score - 15, 30);
        if (direction === "SHORT") direction = "NEUTRAL";
      }
    }

    return {
      score: Math.min(Math.round(score), 95),
      direction,
      drivers: [
        { label: "RSI(14)", value: indicators.rsi14?.toFixed(0) ?? "—" },
        { label: "ATR(14)", value: indicators.atr14?.toFixed(2) ?? "—" },
        { label: "MTF", value: `${bullCount}↑ ${bearCount}↓` },
      ],
    };
  }, [mtfTrend, indicators]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-crossfade">
      {/* Top: 2x2 Decision Grid */}
      <Top4Grid
        symbol={symbol}
        candles={candles}
        keyLevels={keyLevels}
        indicators={indicators}
        mtfTrend={mtfTrend}
        dataHealth={dataHealth}
        currentPrice={currentPrice}
        changePercent={calculatedChangePercent}
        onRetry={handleRetry}
        confluenceScore={confluenceData.score}
        confluenceDirection={confluenceData.direction}
        confluenceDrivers={confluenceData.drivers}
      />

      {/* Middle: Selected Contract Strip */}
      <div className="px-3 py-2">
        <SelectedContractStrip
          contract={activeContract}
          isRecommended={isUsingRecommended}
          onRevertToRecommended={handleRevertToRecommended}
          hasRecommendation={!!recommendation?.hasRecommendation}
        />
      </div>

      {/* Bottom: Compact Options Chain (scrollable) */}
      <div className="flex-1 overflow-hidden px-3 pb-3">
        <div className="h-full overflow-y-auto">
          <CompactChain
            contracts={contracts}
            currentPrice={currentPrice}
            ticker={symbol}
            onContractSelect={handleContractSelect}
            recommendation={recommendation}
            selectedContractId={activeContract?.id}
            className="h-full"
          />

          {/* Active Signals Summary (below chain) */}
          {compositeSignals && compositeSignals.length > 0 && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
              <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Active Signals ({compositeSignals.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {compositeSignals.slice(0, 4).map((signal, idx) => (
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
                {compositeSignals.length > 4 && (
                  <span className={chipStyle("neutral")}>+{compositeSignals.length - 4}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NowPanelSymbol;
