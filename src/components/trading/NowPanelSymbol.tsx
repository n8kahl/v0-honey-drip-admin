/**
 * NowPanelSymbol - Symbol Analysis View (Definitive Trade Lifecycle UI - WATCHING State)
 *
 * The canonical "WATCHING" view showing:
 * - SmartContextStrip: Real-time flow bias, signal score, direction
 * - HDSetupsToWatch: Pre-planned trade scenarios based on key levels
 * - HDLiveChart: Live price chart with indicators
 * - CompactChain: Options chain for contract selection
 * - LOAD STRATEGY button: Transition to LOADED state
 *
 * Key Behaviors:
 * - Auto-selects recommended contract on symbol load
 * - Contract selection updates all contract-scoped panels
 * - LOAD STRATEGY button triggers trade creation
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Ticker, Contract } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { SmartContextStrip } from "../hd/common/SmartContextStrip";
import { HDSetupsToWatch } from "../hd/dashboard/HDSetupsToWatch";
import { HDLiveChart } from "../hd/charts/HDLiveChart";
import { SelectedContractStrip } from "../hd/strips/SelectedContractStrip";
import { CompactChain } from "../hd/common/CompactChain";
import { HDConfluenceDetailPanel } from "../hd/dashboard/HDConfluenceDetailPanel";
import { useContractRecommendation } from "../../hooks/useContractRecommendation";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { useLoadedTradeLiveModel } from "../../hooks/useLoadedTradeLiveModel";
import { cn } from "../../lib/utils";
import { chipStyle } from "../../ui/semantics";
import { FlowDashboard } from "../hd/flow";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Button } from "../ui/button";
import { Zap, Clock, TrendingUp, ArrowRight, Activity, Percent, AlertTriangle } from "lucide-react";
import { useSymbolConfluence } from "../../hooks/useSymbolConfluence";
import { useMarketDataStore } from "../../stores/marketDataStore";
import { MTFHeatmap, type TrendState } from "../hd/viz/MTFHeatmap";
import { RISK_PROFILES } from "../../lib/riskEngine/profiles"; // Import profiles for plan viz

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
  /** Callback when a contract is selected - also used to load strategy with tradeType option */
  onContractSelect: (contract: Contract, options?: { tradeType?: TradeType }) => void;
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

  // Handle load strategy click - pass tradeType to parent
  const handleLoadStrategy = useCallback(() => {
    if (activeContract) {
      onContractSelect(activeContract, { tradeType: selectedTradeType });
    }
  }, [activeContract, onContractSelect, selectedTradeType]);

  // Get current risk profile for visual feedback
  const currentProfile = TRADE_TYPE_PROFILES[selectedTradeType];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ZONE 1: SmartContextStrip - Real-time flow bias + signal summary */}
      <SmartContextStrip symbol={symbol} />

      {/* ZONE 1.5: Technical Context (ATR + MTF) */}
      <TechnicalContextStrip symbol={symbol} />

      {/* ZONE 2: HDLiveChart - Live price chart with indicators + Plan Viz */}
      {/* Container must be strict height to prevent overlap with Greeks below */}
      <div className="flex-shrink-0 h-[320px] border-b border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-hidden relative z-0">
        <HDLiveChart
          ticker={symbol}
          height={320}
          initialTimeframe="5"
          indicators={{
            ema: { periods: [9, 21] },
            vwap: { enabled: true, bands: false },
          }}
          events={[]}
          levels={useMemo(() => {
            // Base levels (VWAP, etc)
            const levels: any[] = keyLevels
              ? [
                  ...(keyLevels.vwap
                    ? [{ price: keyLevels.vwap, label: "VWAP", type: "VWAP" as const }]
                    : []),
                  ...(keyLevels.priorDayHigh
                    ? [
                        {
                          price: keyLevels.priorDayHigh,
                          label: "PDH",
                          type: "PREV_DAY_HIGH" as const,
                        },
                      ]
                    : []),
                  ...(keyLevels.priorDayLow
                    ? [
                        {
                          price: keyLevels.priorDayLow,
                          label: "PDL",
                          type: "PREV_DAY_LOW" as const,
                        },
                      ]
                    : []),
                ]
              : [];

            // Add Plan Visualization if contract selected
            if (activeContract && liveModel) {
              const stockPrice = currentPrice;
              const optPrice = liveModel.option.mid || activeContract.mid || 0;
              const delta = liveModel.greeks.delta || activeContract.delta || 0.5;
              const profile = TRADE_TYPE_PROFILES[selectedTradeType];

              if (stockPrice > 0 && optPrice > 0 && delta !== 0) {
                // Calculate Leverage = (Stock / Option) * Delta
                const leverage = (stockPrice / optPrice) * Math.abs(delta);

                // Option Plan % from Profile (e.g., 30% Target)
                // Underlying % = Option % / Leverage
                const underlyingPct = profile.target / 100 / leverage;
                const stopUnderlyingPct = profile.stop / 100 / leverage;

                // Direction
                const isCall = activeContract.type === "C";
                const targetPrice = isCall
                  ? stockPrice * (1 + underlyingPct)
                  : stockPrice * (1 - underlyingPct);
                const stopPrice = isCall
                  ? stockPrice * (1 - stopUnderlyingPct)
                  : stockPrice * (1 + stopUnderlyingPct);

                levels.push({
                  price: targetPrice,
                  label: `TARGET (+${profile.target}%)`,
                  type: "RESISTANCE", // Visual style
                  color: "#4ade80", // Green
                  lineStyle: "dashed",
                });
                levels.push({
                  price: stopPrice,
                  label: `STOP (-${profile.stop}%)`,
                  type: "SUPPORT", // Visual style
                  color: "#ef4444", // Red
                  lineStyle: "dashed",
                });
              }
            }
            return levels;
          }, [activeContract, liveModel, keyLevels, selectedTradeType, currentPrice])}
          showVolume={true}
          theme="dark"
        />
        {/* Plan Overlay Hint */}
        {activeContract && (
          <div className="absolute top-2 right-16 z-10 px-2 py-1 bg-black/50 backdrop-blur rounded text-[9px] text-[var(--text-muted)] border border-[var(--border-hairline)] pointer-events-none">
            Plan Viz Active
          </div>
        )}
      </div>

      {/* ZONE 3: Content - Setups + Chain */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Contract Selection Zone */}
        <div className="px-3 py-2 flex flex-col gap-2 overflow-hidden flex-1">
          {/* Selected Contract Strip with live data */}
          <SelectedContractStrip
            contract={activeContract}
            isRecommended={isUsingRecommended}
            onRevertToRecommended={handleRevertToRecommended}
            hasRecommendation={!!recommendation?.hasRecommendation}
            liveModel={liveModel}
          />

          {/* Horizontal Split: Options Chain (60%) + Flow (40%) */}
          <div className="flex gap-3 flex-1 overflow-hidden">
            {/* Left: Compact Options Chain */}
            <div className="w-3/5 overflow-y-auto">
              <CompactChain
                contracts={contracts}
                currentPrice={currentPrice}
                ticker={symbol}
                onContractSelect={handleContractSelect}
                recommendation={recommendation}
                selectedContractId={activeContract?.id}
              />
            </div>

            {/* Right: Confluence + Flow Dashboard */}
            <div className="w-2/5 flex flex-col gap-2 overflow-y-auto pr-1">
              {/* Confluence Detail Panel (Setup Quality) */}
              <HDConfluenceDetailPanel
                ticker={symbol}
                direction={activeContract?.type === "P" ? "put" : "call"}
                compact={true}
                className="bg-[var(--surface-1)] p-2 rounded-lg border border-[var(--border-hairline)]"
              />

              {/* Flow Dashboard - institutional flow context */}
              <FlowDashboard symbol={symbol} defaultExpanded={false} compact={true} />

              {/* Active Signals Summary */}
              {compositeSignals && compositeSignals.length > 0 && (
                <div className="px-2 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
                  <div className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1 text-center">
                    Signals ({compositeSignals.length})
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

      {/* ========== SMART ACTIONS BAR ========== */}
      <div className="flex-shrink-0 border-t border-[var(--border-hairline)] bg-[var(--surface-1)] p-3">
        {/* Visual feedback: Target / Stop percentages */}
        {activeContract && (
          <div className="flex items-center justify-center gap-4 mb-3 text-xs">
            <span className="text-[var(--accent-positive)]">Target: ~{currentProfile.target}%</span>
            <span className="text-[var(--text-faint)]">•</span>
            <span className="text-[var(--accent-negative)]">Stop: ~{currentProfile.stop}%</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Risk Profile Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-[var(--text-muted)] font-medium hidden sm:block">
              Risk:
            </span>
            <ToggleGroup
              type="single"
              value={selectedTradeType}
              onValueChange={(v) => v && setSelectedTradeType(v as TradeType)}
            >
              <ToggleGroupItem
                value="scalp"
                aria-label="Scalp"
                className="h-8 px-2.5 text-xs data-[state=on]:bg-[var(--accent-positive)] data-[state=on]:text-black"
              >
                <Zap className="w-3 h-3 mr-1" /> Scalp
              </ToggleGroupItem>
              <ToggleGroupItem
                value="day"
                aria-label="Day"
                className="h-8 px-2.5 text-xs data-[state=on]:bg-[var(--brand-primary)] data-[state=on]:text-black"
              >
                <Clock className="w-3 h-3 mr-1" /> Day
              </ToggleGroupItem>
              <ToggleGroupItem
                value="swing"
                aria-label="Swing"
                className="h-8 px-2.5 text-xs data-[state=on]:bg-blue-500 data-[state=on]:text-white"
              >
                <TrendingUp className="w-3 h-3 mr-1" /> Swing
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Load Button */}
          <Button
            onClick={handleLoadStrategy}
            disabled={!activeContract}
            className={cn(
              "px-6 font-bold",
              activeContract
                ? "bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-black"
                : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
            )}
          >
            LOAD STRATEGY <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Hint when no contract */}
        {!activeContract && (
          <p className="text-[10px] text-[var(--text-faint)] text-center mt-2">
            Select a contract from the options chain to enable loading
          </p>
        )}
      </div>
    </div>
  );
}

export default NowPanelSymbol;

function TechnicalContextStrip({ symbol }: { symbol: string }) {
  const confluence = useSymbolConfluence(symbol);
  const atr = useMarketDataStore((state) => state.symbols[symbol]?.indicators?.atr14);
  const open = useMarketDataStore(
    (state) => state.symbols[symbol]?.candles?.["1D"]?.slice(-1)[0]?.open
  );

  // Calculate ATR % (volatility relative to price)
  const atrPercent = atr && open ? (atr / open) * 100 : 0;

  // Extract Technical Factors (RVOL, RSI, Regime)
  const rvol = confluence?.factors.find((f) => f.name === "rvol");
  const rsi = confluence?.factors.find((f) => f.name === "rsi");
  const regime = confluence?.factors.find((f) => f.name === "regime");

  // Map MTF data for Heatmap
  const mtfData =
    confluence?.mtf.map((item) => ({
      tf: item.timeframe,
      trend: (item.direction === "up"
        ? "bull"
        : item.direction === "down"
          ? "bear"
          : "neutral") as TrendState,
      label: item.label,
    })) || [];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
      {/* Left: Volatility / ATR / Momentum Context */}
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        {/* ATR */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Activity className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
              ATR (14)
            </span>
            <span className="text-xs font-mono font-medium text-[var(--text-high)]">
              {atr ? atr.toFixed(2) : "--"}
            </span>
          </div>
        </div>

        {/* Range % */}
        <div className="flex items-center gap-1.5 pl-4 border-l border-[var(--border-hairline)] flex-shrink-0">
          <Percent className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
              Range
            </span>
            <span
              className={cn(
                "text-xs font-mono font-medium",
                atrPercent > 1.5 ? "text-amber-400" : "text-[var(--text-med)]"
              )}
            >
              {atrPercent ? `${atrPercent.toFixed(2)}%` : "--"}
            </span>
          </div>
        </div>

        {/* RVOL & RSI (New Data) */}
        <div className="flex items-center gap-1.5 pl-4 border-l border-[var(--border-hairline)] flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
              RVOL
            </span>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  rvol && parseFloat(rvol.value as string) >= 2.0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--text-high)]"
                )}
              >
                {rvol?.displayValue || "--"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-4 border-l border-[var(--border-hairline)] flex-shrink-0">
          <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
              RSI
            </span>
            <span
              className={cn(
                "text-xs font-mono font-medium",
                rsi && (rsi.value as number) <= 30
                  ? "text-[var(--accent-positive)]"
                  : rsi && (rsi.value as number) >= 70
                    ? "text-[var(--accent-negative)]"
                    : "text-[var(--text-high)]"
              )}
            >
              {rsi?.displayValue || "--"}
            </span>
          </div>
        </div>

        {/* Regime Badge */}
        {regime && regime.percentComplete > 0 && (
          <div className="flex items-center gap-1.5 pl-4 border-l border-[var(--border-hairline)] hidden md:flex flex-shrink-0">
            <div
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                (regime.value as number) === 1
                  ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20"
                  : "bg-[var(--surface-3)] text-[var(--text-muted)] border-transparent"
              )}
            >
              {regime.displayValue}
            </div>
          </div>
        )}
      </div>

      {/* Right: MTF Analysis */}
      <div className="flex items-center gap-2 flex-shrink-0 pl-2">
        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide mr-1 hidden lg:inline-block">
          Structure
        </span>
        <div className="w-32 sm:w-48">
          <MTFHeatmap timeframes={mtfData} className="h-5" />
        </div>
      </div>
    </div>
  );
}

// Export type for parent components
export type { TradeType };
