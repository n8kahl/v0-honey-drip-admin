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
import { chipStyle, fmtPrice, fmtDelta, fmtSpread } from "../../ui/semantics";
import { FlowDashboard } from "../hd/flow";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Button } from "../ui/button";
import { Zap, Clock, TrendingUp, ArrowRight, Activity, Percent, AlertTriangle, ChevronDown, ChevronUp, Target, Shield, Layers } from "lucide-react";
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

  // Collapsible state for options chain section
  const [chainExpanded, setChainExpanded] = useState(false);
  const [confluenceExpanded, setConfluenceExpanded] = useState(false);

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
    const spread = activeContract.ask && activeContract.bid
      ? ((activeContract.ask - activeContract.bid) / activeContract.mid * 100)
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

  // Chart levels with plan visualization
  const chartLevels = useMemo(() => {
    const levels: any[] = keyLevels
      ? [
          ...(keyLevels.vwap
            ? [{ price: keyLevels.vwap, label: "VWAP", type: "VWAP" as const }]
            : []),
          ...(keyLevels.priorDayHigh
            ? [{ price: keyLevels.priorDayHigh, label: "PDH", type: "PREV_DAY_HIGH" as const }]
            : []),
          ...(keyLevels.priorDayLow
            ? [{ price: keyLevels.priorDayLow, label: "PDL", type: "PREV_DAY_LOW" as const }]
            : []),
        ]
      : [];

    if (planMetrics) {
      levels.push({
        price: planMetrics.targetUnderlying,
        label: `T +${currentProfile.target}%`,
        type: "RESISTANCE",
        color: "#4ade80",
        lineStyle: "dashed",
      });
      levels.push({
        price: planMetrics.stopUnderlying,
        label: `S -${currentProfile.stop}%`,
        type: "SUPPORT",
        color: "#ef4444",
        lineStyle: "dashed",
      });
    }
    return levels;
  }, [keyLevels, planMetrics, currentProfile]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ========== ABOVE THE FOLD: Chart + Plan Summary ========== */}
      <div className="flex-shrink-0 flex flex-col">
        {/* ZONE 1: Big Chart - Dominant visual (400px) */}
        <div className="h-[360px] lg:h-[400px] border-b border-[var(--border-hairline)] bg-[var(--surface-0)] overflow-hidden relative">
          <HDLiveChart
            ticker={symbol}
            height={400}
            initialTimeframe="5"
            indicators={{
              ema: { periods: [9, 21] },
              vwap: { enabled: true, bands: false },
            }}
            events={[]}
            levels={chartLevels}
          />
          {/* Plan active indicator */}
          {activeContract && (
            <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-[var(--brand-primary)]/20 backdrop-blur rounded text-[10px] font-medium text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
              Plan Active
            </div>
          )}
        </div>

        {/* ZONE 2: Plan Summary Card - Key metrics above the fold */}
        <div className="px-3 py-3 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
          {activeContract && planMetrics ? (
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Entry */}
              <PlanMetricBox
                label="Entry"
                value={fmtPrice(planMetrics.entry)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              />
              {/* Target */}
              <PlanMetricBox
                label="Target"
                value={fmtPrice(planMetrics.target)}
                subValue={`+${currentProfile.target}%`}
                variant="success"
                icon={<Target className="w-3.5 h-3.5" />}
              />
              {/* Stop */}
              <PlanMetricBox
                label="Stop"
                value={fmtPrice(planMetrics.stop)}
                subValue={`-${currentProfile.stop}%`}
                variant="danger"
                icon={<Shield className="w-3.5 h-3.5" />}
              />
              {/* R:R */}
              <PlanMetricBox
                label="R:R"
                value={planMetrics.rr.toFixed(1)}
                variant={planMetrics.rr >= 2 ? "success" : "neutral"}
              />
              {/* Spread */}
              <PlanMetricBox
                label="Spread"
                value={`${planMetrics.spread.toFixed(1)}%`}
                variant={planMetrics.spreadWide ? "warning" : "neutral"}
              />
              {/* Liquidity */}
              <PlanMetricBox
                label="Vol/OI"
                value={`${planMetrics.volume > 1000 ? (planMetrics.volume / 1000).toFixed(1) + "K" : planMetrics.volume}`}
                subValue={planMetrics.oi > 1000 ? `${(planMetrics.oi / 1000).toFixed(1)}K OI` : `${planMetrics.oi} OI`}
                variant={planMetrics.volume > 500 ? "success" : "neutral"}
                icon={<Layers className="w-3.5 h-3.5" />}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-4 text-sm text-[var(--text-muted)]">
              <Layers className="w-4 h-4 mr-2" />
              Select a contract to see plan summary
            </div>
          )}
        </div>
      </div>

      {/* ========== SCROLLABLE: Collapsible Sections ========== */}
      <div className="flex-1 overflow-y-auto">
        {/* Selected Contract Strip */}
        <div className="px-3 py-2 border-b border-[var(--border-hairline)]">
          <SelectedContractStrip
            contract={activeContract}
            isRecommended={isUsingRecommended}
            onRevertToRecommended={handleRevertToRecommended}
            hasRecommendation={!!recommendation?.hasRecommendation}
            liveModel={liveModel}
          />
        </div>

        {/* Collapsible: Options Chain */}
        <CollapsibleSection
          title="Options Chain"
          subtitle={contracts.length > 0 ? `${contracts.length} contracts` : undefined}
          expanded={chainExpanded}
          onToggle={() => setChainExpanded(!chainExpanded)}
          icon={<Layers className="w-4 h-4" />}
        >
          <div className="max-h-[300px] overflow-y-auto">
            <CompactChain
              contracts={contracts}
              currentPrice={currentPrice}
              ticker={symbol}
              onContractSelect={handleContractSelect}
              recommendation={recommendation}
              selectedContractId={activeContract?.id}
            />
          </div>
        </CollapsibleSection>

        {/* Collapsible: Confluence & Flow */}
        <CollapsibleSection
          title="Confluence & Flow"
          subtitle="Setup quality analysis"
          expanded={confluenceExpanded}
          onToggle={() => setConfluenceExpanded(!confluenceExpanded)}
          icon={<Activity className="w-4 h-4" />}
        >
          <div className="space-y-3 p-3">
            <HDConfluenceDetailPanel
              ticker={symbol}
              direction={activeContract?.type === "P" ? "put" : "call"}
              compact={true}
              className="bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border-hairline)]"
            />
            <FlowDashboard symbol={symbol} defaultExpanded={false} compact={true} />
            {/* Active Signals */}
            {compositeSignals && compositeSignals.length > 0 && (
              <div className="px-2 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
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
        </CollapsibleSection>
      </div>

      {/* ========== STICKY BOTTOM: Primary CTA ========== */}
      <div
        className="flex-shrink-0 sticky bottom-0 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]/95 backdrop-blur-sm p-3 z-10"
        data-testid="primary-cta-bar"
      >
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
                className="h-9 px-3 text-xs font-medium data-[state=on]:bg-[var(--accent-positive)] data-[state=on]:text-black"
              >
                <Zap className="w-3.5 h-3.5 mr-1" /> Scalp
              </ToggleGroupItem>
              <ToggleGroupItem
                value="day"
                aria-label="Day"
                className="h-9 px-3 text-xs font-medium data-[state=on]:bg-[var(--brand-primary)] data-[state=on]:text-black"
              >
                <Clock className="w-3.5 h-3.5 mr-1" /> Day
              </ToggleGroupItem>
              <ToggleGroupItem
                value="swing"
                aria-label="Swing"
                className="h-9 px-3 text-xs font-medium data-[state=on]:bg-blue-500 data-[state=on]:text-white"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1" /> Swing
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Load Button - Larger, more prominent */}
          <Button
            onClick={handleLoadStrategy}
            disabled={!activeContract}
            size="lg"
            className={cn(
              "px-8 py-3 text-base font-bold",
              activeContract
                ? "bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-black shadow-lg"
                : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
            )}
            data-testid="load-strategy-btn"
          >
            LOAD STRATEGY <ArrowRight className="w-5 h-5 ml-2" />
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

// ============================================================================
// Helper Components
// ============================================================================

/** Plan metric box with large value display */
function PlanMetricBox({
  label,
  value,
  subValue,
  variant = "neutral",
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  variant?: "neutral" | "success" | "danger" | "warning";
  icon?: React.ReactNode;
}) {
  const variantStyles = {
    neutral: "text-[var(--text-high)]",
    success: "text-[var(--accent-positive)]",
    danger: "text-[var(--accent-negative)]",
    warning: "text-amber-400",
  };

  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-1 text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </div>
      <div className={cn("text-lg font-bold tabular-nums", variantStyles[variant])}>
        {value}
      </div>
      {subValue && (
        <div className={cn("text-[10px] tabular-nums", variantStyles[variant])}>
          {subValue}
        </div>
      )}
    </div>
  );
}

/** Collapsible section component */
function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border-hairline)]">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
          <span className="text-sm font-medium text-[var(--text-high)]">{title}</span>
          {subtitle && (
            <span className="text-xs text-[var(--text-faint)]">· {subtitle}</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>
      {expanded && (
        <div className="animate-expand bg-[var(--surface-1)]">{children}</div>
      )}
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
