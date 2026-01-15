/**
 * NowPanelSymbol - Symbol Analysis View (Definitive Trade Lifecycle UI - WATCHING State)
 *
 * COCKPIT LAYOUT - Fixed grid with no scrolling and no collapsible sections.
 *
 * The canonical "WATCHING" view showing:
 * - CockpitHeader: Symbol, state badge, dual pricing (underlying + contract)
 * - Chart: Reduced height to fit in grid
 * - Confluence Panel: Visual confluence factors, MTF, key levels, flow
 * - Plan Panel: Entry/Stop/Target/R:R (empty until contract selected)
 * - Contract Panel: Bid/Ask/Mid, Spread, IV, OI, Volume, Liquidity rating
 * - Actions Bar: "Select Contract" or "Load Plan" based on state
 *
 * Key Behaviors:
 * - Auto-selects recommended contract on symbol load
 * - Contract selection updates all contract-scoped panels
 * - LOAD STRATEGY button triggers trade creation
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Ticker, Contract, Trade } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { HDLiveChartContextAware } from "../hd/charts/HDLiveChartContextAware";
import { useContractRecommendation } from "../../hooks/useContractRecommendation";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { useLoadedTradeLiveModel } from "../../hooks/useLoadedTradeLiveModel";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Zap, Clock, TrendingUp } from "lucide-react";
import { useMarketDataStore } from "../../stores/marketDataStore";
import { buildChartLevelsForCandidate } from "../../lib/riskEngine/chartLevels";
import type { RiskCalculationInput } from "../../lib/riskEngine/types";

// Cockpit components
import {
  CockpitLayout,
  CockpitHeader,
  CockpitPlanPanel,
  CockpitContractPanel,
  CockpitActionsBar,
  type CockpitViewState,
} from "./cockpit";
import { ConfluencePanelPro } from "./panels/ConfluencePanelPro";

/** Trade type preset options */
type TradeType = "scalp" | "day" | "swing";

/** Risk profiles with target/stop percentages */
const TRADE_TYPE_PROFILES: Record<
  TradeType,
  { target: number; stop: number; label: string; desc: string }
> = {
  scalp: { target: 20, stop: 10, label: "Scalp", desc: "Quick 5-15 min" },
  day: { target: 30, stop: 15, label: "Day", desc: "Intraday hold" },
  swing: { target: 50, stop: 25, label: "Swing", desc: "Multi-day" },
};

interface NowPanelSymbolProps {
  symbol: string;
  activeTicker: Ticker | null;
  contracts: Contract[];
  /** Callback when a contract is selected (preview only, no persistence) */
  onContractSelect: (contract: Contract, options?: { tradeType?: TradeType }) => void;
  /** Callback to load strategy (persists LOADED trade to database) */
  onLoadStrategy?: (contract: Contract, options?: { tradeType?: TradeType }) => void;
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
  onLoadStrategy,
  compositeSignals,
  watchlist = [],
  disableAutoSelect = false,
}: NowPanelSymbolProps) {
  // Manual contract selection state (null = use recommended)
  const [manualContract, setManualContract] = useState<Contract | null>(null);
  // Selected trade type for risk profile
  const [selectedTradeType, setSelectedTradeType] = useState<TradeType>("day");

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

  // Get key levels
  const { keyLevels } = useKeyLevels(symbol);

  // Active contract = manual OR recommended (auto-selected)
  // NOTE: Moved up to enable live model hook
  const activeContract = manualContract || recommendation?.bestContract || null;
  const isUsingRecommended = !manualContract && !!recommendation?.bestContract;

  // Get live model for selected contract (streaming quotes + Greeks)
  const liveModel = useLoadedTradeLiveModel(symbol, activeContract);

  // Reset manual selection when symbol changes (auto-select recommended)
  useEffect(() => {
    setManualContract(null);
  }, [symbol]);

  // NOTE: Removed auto-trigger useEffect that called onContractSelect
  // This was causing a bug where clicking a symbol would auto-create a WATCHING trade
  // and show Contract Preview instead of the options chain.
  // Now users must explicitly click "LOAD STRATEGY" to create a trade.
  // The recommended contract is still HIGHLIGHTED in the chain, just not auto-loaded.

  // Handle manual contract selection from chain
  // NOTE: This ONLY updates local state. Does NOT trigger trade creation.
  // The user must explicitly click "LOAD STRATEGY" to create a trade.
  const handleContractSelect = useCallback((contract: Contract) => {
    setManualContract(contract);
  }, []);

  // Handle revert to recommended
  // NOTE: This ONLY clears local state. Does NOT trigger trade creation.
  const handleRevertToRecommended = useCallback(() => {
    setManualContract(null);
  }, []);

  // Handle load strategy click - persist LOADED trade to database
  const handleLoadStrategy = useCallback(() => {
    if (activeContract) {
      // Use onLoadStrategy if provided, otherwise fall back to onContractSelect
      if (onLoadStrategy) {
        onLoadStrategy(activeContract, { tradeType: selectedTradeType });
      } else {
        onContractSelect(activeContract, { tradeType: selectedTradeType });
      }
    }
  }, [activeContract, onLoadStrategy, onContractSelect, selectedTradeType]);

  // Get current risk profile for visual feedback
  const currentProfile = TRADE_TYPE_PROFILES[selectedTradeType];

  // Compute plan metrics for display
  const planMetrics = useMemo(() => {
    if (!activeContract || !liveModel) return null;

    const optPrice = liveModel.option.mid || activeContract.mid || 0;
    const delta = liveModel.greeks.delta || activeContract.delta || 0.5;
    const stockPrice = currentPrice;
    const profile = currentProfile;

    if (stockPrice <= 0 || optPrice <= 0 || delta === 0) return null;

    const leverage = (stockPrice / optPrice) * Math.abs(delta);
    const underlyingPct = profile.target / 100 / leverage;
    const stopUnderlyingPct = profile.stop / 100 / leverage;
    const isCall = activeContract.type === "C";

    const targetPrice = isCall
      ? stockPrice * (1 + underlyingPct)
      : stockPrice * (1 - underlyingPct);
    const stopPrice = isCall
      ? stockPrice * (1 - stopUnderlyingPct)
      : stockPrice * (1 + stopUnderlyingPct);

    const targetOptPrice = optPrice * (1 + profile.target / 100);
    const stopOptPrice = optPrice * (1 - profile.stop / 100);
    const rr = profile.target / profile.stop;
    const spread =
      activeContract.ask && activeContract.bid
        ? ((activeContract.ask - activeContract.bid) / activeContract.mid) * 100
        : 0;
    const spreadWide = spread > 5;

    return {
      entry: optPrice,
      target: targetOptPrice,
      stop: stopOptPrice,
      targetUnderlying: targetPrice,
      stopUnderlying: stopPrice,
      rr,
      delta,
      spread,
      spreadWide,
      leverage,
      volume: activeContract.volume || 0,
      oi: activeContract.openInterest || 0,
    };
  }, [activeContract, liveModel, currentPrice, currentProfile]);

  // Chart levels using canonical level builder
  const chartLevels = useMemo(() => {
    if (!keyLevels || !activeContract || !liveModel || currentPrice <= 0) {
      // Fallback: basic key levels only
      if (keyLevels) {
        return [
          ...(keyLevels.vwap
            ? [{ price: keyLevels.vwap, label: "VWAP", type: "VWAP" as const }]
            : []),
          ...(keyLevels.priorDayHigh
            ? [{ price: keyLevels.priorDayHigh, label: "PDH", type: "PREV_DAY_HIGH" as const }]
            : []),
          ...(keyLevels.priorDayLow
            ? [{ price: keyLevels.priorDayLow, label: "PDL", type: "PREV_DAY_LOW" as const }]
            : []),
        ];
      }
      return [];
    }

    // Build canonical chart levels using risk engine
    const optPrice = liveModel.option.mid || activeContract.mid || 0;
    const delta = liveModel.greeks.delta || activeContract.delta || 0.5;

    if (optPrice <= 0) {
      return [];
    }

    const riskInput: RiskCalculationInput = {
      entryPrice: optPrice,
      currentUnderlyingPrice: currentPrice,
      currentOptionMid: optPrice,
      keyLevels: keyLevels,
      delta: delta,
      defaults: {
        mode: "calculated",
        tpPercent: currentProfile.target,
        slPercent: currentProfile.stop,
      },
      tradeType:
        selectedTradeType === "scalp" ? "SCALP" : selectedTradeType === "day" ? "DAY" : "SWING",
    };

    return buildChartLevelsForCandidate(symbol, currentPrice, keyLevels, riskInput);
  }, [
    keyLevels,
    activeContract,
    liveModel,
    currentPrice,
    currentProfile,
    selectedTradeType,
    symbol,
  ]);

  // Build a mock trade object for HDLiveChartContextAware
  const mockTrade: Trade | null = useMemo(() => {
    if (!activeContract) return null;
    return {
      id: "preview",
      ticker: symbol,
      state: "WATCHING" as const,
      contract: activeContract,
      entryPrice: planMetrics?.entry,
      targetPrice: planMetrics?.target,
      stopLoss: planMetrics?.stop,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: "",
      tradeType:
        selectedTradeType === "scalp" ? "Scalp" : selectedTradeType === "day" ? "Day" : "Swing",
    } as unknown as Trade;
  }, [activeContract, symbol, planMetrics, selectedTradeType]);

  // Determine cockpit view state
  const viewState: CockpitViewState = activeContract ? "plan" : "watch";

  // "Why" bullets for plan panel
  const whyBullets = useMemo(() => {
    const bullets: string[] = [];
    if (recommendation?.bestContract) {
      bullets.push(
        `Recommended: $${recommendation.bestContract.strike}${recommendation.bestContract.type}`
      );
    }
    if (planMetrics?.rr && planMetrics.rr >= 2) {
      bullets.push(`Strong R:R of ${planMetrics.rr.toFixed(1)}:1`);
    }
    if (planMetrics?.volume && planMetrics.volume > 500) {
      bullets.push(`Good volume: ${planMetrics.volume.toLocaleString()}`);
    }
    if (compositeSignals && compositeSignals.length > 0) {
      bullets.push(`${compositeSignals.length} active signal(s) detected`);
    }
    return bullets.length > 0 ? bullets : undefined;
  }, [recommendation, planMetrics, compositeSignals]);

  // Determine underlying data freshness
  const symbolData = useMarketDataStore((state) => state.symbols[symbol]);
  const lastUpdateTime = symbolData?.lastUpdated ? new Date(symbolData.lastUpdated) : null;
  const isStale = symbolData?.lastUpdated ? Date.now() - symbolData.lastUpdated > 10000 : true;

  return (
    <CockpitLayout
      viewState={viewState}
      symbol={symbol}
      contract={activeContract}
      activeTicker={activeTicker}
      keyLevels={keyLevels}
      data-testid="now-panel-symbol-cockpit"
    >
      {{
        /* ========== HEADER ========== */
        header: (
          <CockpitHeader
            viewState={viewState}
            symbol={symbol}
            contract={activeContract}
            activeTicker={activeTicker}
            underlyingPrice={currentPrice}
            underlyingChange={activeTicker?.changePercent}
            contractBid={liveModel?.option.bid ?? activeContract?.bid}
            contractAsk={liveModel?.option.ask ?? activeContract?.ask}
            contractMid={liveModel?.option.mid ?? activeContract?.mid}
            lastUpdateTime={lastUpdateTime}
            isStale={isStale}
          />
        ),

        /* ========== CHART ========== */
        chart: (
          <div className="h-full w-full relative" data-testid="chart-container">
            <HDLiveChartContextAware
              ticker={symbol}
              tradeState={activeContract ? "LOADED" : "WATCHING"}
              currentTrade={mockTrade}
              activeTicker={activeTicker}
              hasLoadedContract={!!activeContract}
              levels={chartLevels}
              keyLevels={keyLevels}
              height={180}
              singleChart={true}
            />
            {/* Plan active indicator */}
            {activeContract && (
              <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-[var(--brand-primary)]/20 backdrop-blur rounded text-[10px] font-medium text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
                Plan Active
              </div>
            )}
          </div>
        ),

        /* ========== CONFLUENCE PANEL ========== */
        confluence: (
          <ConfluencePanelPro
            symbol={symbol}
            viewState="watch"
            keyLevels={keyLevels}
            currentPrice={currentPrice}
            showDegradationWarnings={false}
            contractIV={activeContract?.iv}
          />
        ),

        /* ========== PLAN PANEL ========== */
        plan: (
          <div className="h-full flex flex-col">
            {/* Trade Type Selector at top of plan */}
            <div className="flex-shrink-0 px-3 pt-2 pb-1 border-b border-[var(--border-hairline)]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase text-[var(--text-faint)] font-medium">
                  Trade Type
                </span>
                <ToggleGroup
                  type="single"
                  value={selectedTradeType}
                  onValueChange={(v) => v && setSelectedTradeType(v as TradeType)}
                  className="h-6"
                >
                  <ToggleGroupItem
                    value="scalp"
                    className="h-6 px-2 text-[10px] data-[state=on]:bg-[var(--accent-positive)] data-[state=on]:text-black"
                  >
                    <Zap className="w-3 h-3 mr-0.5" /> Scalp
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="day"
                    className="h-6 px-2 text-[10px] data-[state=on]:bg-[var(--brand-primary)] data-[state=on]:text-black"
                  >
                    <Clock className="w-3 h-3 mr-0.5" /> Day
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="swing"
                    className="h-6 px-2 text-[10px] data-[state=on]:bg-blue-500 data-[state=on]:text-white"
                  >
                    <TrendingUp className="w-3 h-3 mr-0.5" /> Swing
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Plan content */}
            <div className="flex-1 min-h-0">
              <CockpitPlanPanel
                viewState={viewState}
                symbol={symbol}
                contract={activeContract}
                entryPrice={planMetrics?.entry}
                stopLoss={planMetrics?.stop}
                targetPrice={planMetrics?.target}
                riskReward={planMetrics?.rr}
                confidence={
                  planMetrics
                    ? Math.min(95, 60 + planMetrics.rr * 10 + (planMetrics.volume > 500 ? 10 : 0))
                    : null
                }
                whyBullets={whyBullets}
              />
            </div>
          </div>
        ),

        /* ========== CONTRACT PANEL ========== */
        contractPanel: (
          <CockpitContractPanel
            symbol={symbol}
            contract={activeContract}
            activeTicker={activeTicker}
            underlyingPrice={currentPrice}
            underlyingChange={activeTicker?.changePercent}
            lastQuoteTime={lastUpdateTime}
            onContractSelect={handleContractSelect}
            recommendation={recommendation}
          />
        ),

        /* ========== ACTIONS BAR ========== */
        actions: (
          <CockpitActionsBar
            viewState={viewState}
            contract={activeContract}
            hasDiscordChannels={true}
            onLoadPlan={(sendAlert) => {
              if (activeContract) {
                handleLoadStrategy();
              }
            }}
          />
        ),
      }}
    </CockpitLayout>
  );
}

export default NowPanelSymbol;

// Export type for parent components
export type { TradeType };
