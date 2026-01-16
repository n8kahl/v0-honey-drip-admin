/**
 * CockpitRightPanel - Unified Right Panel for All Trade States
 *
 * Combines all right-side data into a single organized panel:
 * - PLAN/LOADED: Risk/Reward Hero + Key Levels + Flow + Contract Activity
 * - ENTERED: P&L Display + Key Levels (collapsible) + Flow + Contract Activity
 *
 * This eliminates data duplication across the center column and provides
 * a consistent experience across all trade states.
 */

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "../../../lib/utils";
import type { Trade, Contract } from "../../../types";
import type { KeyLevels } from "../../../lib/riskEngine/types";
import type { FlowContextState } from "../../../hooks/useFlowContext";
import type { CockpitViewState } from "./CockpitLayout";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { HDRiskRewardHero } from "../../hd/signals/HDRiskRewardHero";
import { FlowCompact } from "../../hd/flow/FlowCompact";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart2,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  MinusCircle,
  Users,
  Settings2,
} from "lucide-react";
import { getLiquidityGrade } from "../../../lib/market/contractQuality";
import { ContractPicker, ContractPickerTrigger } from "./ContractPicker";

// ============================================================================
// Types
// ============================================================================

export interface CockpitRightPanelProps {
  viewState: CockpitViewState;
  symbol: string;
  trade?: Trade | null;
  contract?: Contract | null;
  keyLevels?: KeyLevels | null;
  currentPrice?: number | null;
  underlyingPrice?: number | null;
  lastQuoteTime?: Date | null;
  flowContext?: FlowContextState | null;
  /** For ENTERED state - P&L data */
  pnl?: {
    percent: number;
    dollars: number;
    rMultiple?: number;
    /** Progress toward target (0-100%), where 0% = at stop, 100% = at target */
    progressToTarget?: number;
    /** Target price (option premium) */
    targetPrice?: number;
    /** Stop loss price (option premium) */
    stopLoss?: number;
    /** Current mid price (option premium) */
    currentMid?: number;
  } | null;
  /** For contract picker */
  onContractSelect?: (contract: Contract) => void;
  recommendation?: ContractRecommendation | null;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function CockpitRightPanel({
  viewState,
  symbol,
  trade,
  contract,
  keyLevels,
  currentPrice,
  underlyingPrice,
  lastQuoteTime,
  flowContext,
  pnl,
  onContractSelect,
  recommendation,
  className,
}: CockpitRightPanelProps) {
  const [activityExpanded, setActivityExpanded] = useState(true);
  // BUGFIX: Lift pickerOpen state to parent so "Change Contract" button can use it
  const [pickerOpen, setPickerOpen] = useState(false);

  const effectiveContract = contract ?? trade?.contract ?? null;
  const isEntered = viewState === "entered" || viewState === "exited";
  const showRiskReward = viewState === "plan" || viewState === "loaded" || viewState === "watch";

  // Get entry/stop/target prices
  const entryPrice = effectiveContract?.mid ?? effectiveContract?.ask ?? 0;
  const stopPrice = trade?.stopLoss ?? entryPrice * 0.7;
  const targetPrice = trade?.targetPrice ?? entryPrice * 1.5;

  return (
    <div
      className={cn("h-full flex flex-col overflow-auto p-3 gap-3", className)}
      data-testid="cockpit-right-panel"
    >
      {/* Section 1: R:R Hero (PLAN/LOADED) or P&L (ENTERED) */}
      {showRiskReward && entryPrice > 0 ? (
        <HDRiskRewardHero
          entryPrice={entryPrice}
          stopPrice={stopPrice}
          targetPrice={targetPrice}
          delta={effectiveContract?.delta}
          underlyingEntry={underlyingPrice ?? undefined}
        />
      ) : isEntered && pnl ? (
        <PnLDisplay pnl={pnl} />
      ) : null}

      {/* Change Contract Button - Positioned prominently after hero section */}
      {onContractSelect && !isEntered && (
        <>
          <ContractPickerTrigger
            onClick={() => setPickerOpen(true)}
            label="Change Contract"
            size="sm"
            variant="ghost"
            className="w-full h-7"
          />
          <ContractPicker
            symbol={symbol}
            currentPrice={underlyingPrice ?? currentPrice ?? 0}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(newContract) => {
              onContractSelect(newContract);
              setPickerOpen(false);
            }}
            recommendation={recommendation}
            currentContract={effectiveContract}
            disabled={isEntered}
          />
        </>
      )}

      {/* Section 2: Key Levels - Always visible (not collapsible) for better visibility */}
      {keyLevels && (
        <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] overflow-visible">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-hairline)]">
            <Layers className="w-4 h-4 text-[var(--brand-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-high)] uppercase">
              Key Levels
            </span>
          </div>
          <div className="px-3 py-2">
            <KeyLevelsSection
              keyLevels={keyLevels}
              currentPrice={currentPrice ?? underlyingPrice ?? 0}
            />
          </div>
        </div>
      )}

      {/* Section 3: Flow Data */}
      <FlowCompact symbol={symbol} flowContext={flowContext ?? null} keyLevels={keyLevels} />

      {/* Section 4: Contract Activity */}
      <CollapsibleSection
        title="Activity"
        icon={<BarChart2 className="w-4 h-4 text-[var(--brand-primary)]" />}
        expanded={activityExpanded}
        onToggle={() => setActivityExpanded(!activityExpanded)}
        headerRight={
          effectiveContract ? <LiquidityBadge contract={effectiveContract} /> : undefined
        }
      >
        <ContractActivitySection
          symbol={symbol}
          contract={effectiveContract}
          lastQuoteTime={lastQuoteTime}
          isEntered={isEntered}
          onContractSelect={onContractSelect}
          recommendation={recommendation}
          underlyingPrice={underlyingPrice}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
        />
      </CollapsibleSection>
    </div>
  );
}

// ============================================================================
// Collapsible Section
// ============================================================================

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  defaultExpanded = true,
  headerRight,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  defaultExpanded?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-1)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-[var(--text-high)] uppercase">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </div>
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ============================================================================
// P&L Display (ENTERED State)
// ============================================================================

function PnLDisplay({
  pnl,
}: {
  pnl: {
    percent: number;
    dollars: number;
    rMultiple?: number;
    progressToTarget?: number;
    targetPrice?: number;
    stopLoss?: number;
    currentMid?: number;
  };
}) {
  const isPositive = pnl.percent >= 0;
  const colorClass = isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]";
  const bgClass = isPositive ? "bg-[var(--accent-positive)]/10" : "bg-[var(--accent-negative)]/10";
  const borderClass = isPositive
    ? "border-[var(--accent-positive)]/30"
    : "border-[var(--accent-negative)]/30";

  // Progress bar state (clamped 0-100)
  const progressPercent =
    pnl.progressToTarget !== undefined
      ? Math.min(100, Math.max(0, pnl.progressToTarget))
      : undefined;

  // Determine progress status
  const progressStatus =
    progressPercent !== undefined
      ? progressPercent < 25
        ? "danger" // Near stop loss (red zone)
        : progressPercent > 75
          ? "target" // Approaching target (green zone)
          : "neutral" // In the middle
      : undefined;

  return (
    <div
      className={cn("rounded-lg border overflow-hidden p-4", bgClass, borderClass)}
      data-testid="pnl-display"
    >
      {/* Main P&L */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className={cn("w-5 h-5", colorClass)} />
          ) : (
            <TrendingDown className={cn("w-5 h-5", colorClass)} />
          )}
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Live P&L</span>
        </div>
        {pnl.rMultiple !== undefined && (
          <div className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <span className="text-[10px] text-[var(--text-muted)]">R: </span>
            <span className={cn("text-sm font-bold tabular-nums", colorClass)}>
              {pnl.rMultiple >= 0 ? "+" : ""}
              {pnl.rMultiple.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Big Numbers */}
      <div className="flex items-baseline gap-3">
        <span className={cn("text-4xl font-black tabular-nums tracking-tight", colorClass)}>
          {pnl.percent >= 0 ? "+" : ""}
          {pnl.percent.toFixed(1)}%
        </span>
        <span className={cn("text-lg font-bold tabular-nums", colorClass)}>
          {pnl.dollars >= 0 ? "+" : ""}
          {formatDollars(pnl.dollars)}
        </span>
      </div>

      {/* Progress to Target Bar */}
      {progressPercent !== undefined &&
        pnl.stopLoss !== undefined &&
        pnl.targetPrice !== undefined && (
          <div className="mt-4 space-y-2">
            {/* Price labels */}
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span className="text-red-400">SL: ${pnl.stopLoss.toFixed(2)}</span>
              <span className="text-[var(--text-high)] font-medium">
                ${pnl.currentMid?.toFixed(2) ?? "--"}
              </span>
              <span className="text-green-400">TP: ${pnl.targetPrice.toFixed(2)}</span>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-[var(--surface-3)] rounded-full overflow-hidden">
              {/* Red zone (0-25%) */}
              <div className="absolute left-0 h-full w-[25%] bg-red-500/20" />
              {/* Green zone (75-100%) */}
              <div className="absolute right-0 h-full w-[25%] bg-green-500/20" />

              {/* Progress fill */}
              <div
                className={cn(
                  "absolute left-0 h-full transition-all duration-300 rounded-full",
                  progressStatus === "danger"
                    ? "bg-red-500/60"
                    : progressStatus === "target"
                      ? "bg-green-500/60"
                      : "bg-[var(--brand-primary)]/50"
                )}
                style={{ width: `${progressPercent}%` }}
              />

              {/* Progress marker */}
              <div
                className={cn(
                  "absolute top-0 h-full w-1.5 rounded transition-all duration-300",
                  progressStatus === "danger"
                    ? "bg-red-400"
                    : progressStatus === "target"
                      ? "bg-green-400"
                      : "bg-white"
                )}
                style={{ left: `calc(${progressPercent}% - 3px)` }}
              />
            </div>

            {/* Status text */}
            <div className="text-center text-xs font-medium">
              {progressStatus === "danger" ? (
                <span className="text-red-400 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Near Stop Loss
                </span>
              ) : progressStatus === "target" ? (
                <span className="text-green-400 flex items-center justify-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Approaching Target
                </span>
              ) : (
                <span className="text-[var(--text-muted)]">
                  {progressPercent.toFixed(0)}% to Target
                </span>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

function formatDollars(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

// ============================================================================
// Key Levels Section
// ============================================================================

function KeyLevelsSection({
  keyLevels,
  currentPrice,
}: {
  keyLevels: KeyLevels;
  currentPrice: number;
}) {
  // Extract key levels
  const vwap = keyLevels.vwap;
  const orbHigh = keyLevels.orbHigh;
  const orbLow = keyLevels.orbLow;
  const priorDayHigh = keyLevels.priorDayHigh;
  const priorDayLow = keyLevels.priorDayLow;
  const preMarketHigh = keyLevels.preMarketHigh;
  const preMarketLow = keyLevels.preMarketLow;

  // Calculate position relative to VWAP
  const vwapPosition =
    vwap && currentPrice > 0
      ? currentPrice > vwap
        ? "Above"
        : currentPrice < vwap
          ? "Below"
          : "At"
      : null;

  const vwapColor =
    vwapPosition === "Above"
      ? "text-[var(--accent-positive)]"
      : vwapPosition === "Below"
        ? "text-[var(--accent-negative)]"
        : "text-[var(--text-muted)]";

  return (
    <div className="space-y-2">
      {/* VWAP with position indicator */}
      {vwap && (
        <div className="flex items-center justify-between p-2 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)]">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-[var(--text-faint)] uppercase">VWAP</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-[var(--text-high)]">
              ${vwap.toFixed(2)}
            </span>
            {vwapPosition && (
              <span className={cn("text-[9px] font-medium", vwapColor)}>({vwapPosition})</span>
            )}
          </div>
        </div>
      )}

      {/* ORB Levels */}
      {(orbHigh || orbLow) && (
        <div className="grid grid-cols-2 gap-2">
          {orbHigh && <LevelPill label="ORB High" value={orbHigh} color="text-orange-400" />}
          {orbLow && <LevelPill label="ORB Low" value={orbLow} color="text-orange-400" />}
        </div>
      )}

      {/* Prior Day Levels */}
      {(priorDayHigh || priorDayLow) && (
        <div className="grid grid-cols-2 gap-2">
          {priorDayHigh && <LevelPill label="PDH" value={priorDayHigh} color="text-red-400" />}
          {priorDayLow && <LevelPill label="PDL" value={priorDayLow} color="text-green-400" />}
        </div>
      )}

      {/* Pre-Market Levels */}
      {(preMarketHigh || preMarketLow) && (
        <div className="grid grid-cols-2 gap-2">
          {preMarketHigh && (
            <LevelPill label="PM High" value={preMarketHigh} color="text-indigo-400" />
          )}
          {preMarketLow && (
            <LevelPill label="PM Low" value={preMarketLow} color="text-indigo-400" />
          )}
        </div>
      )}
    </div>
  );
}

function LevelPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between p-1.5 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)] min-w-0">
      <span className={cn("text-[9px] uppercase shrink-0", color)}>{label}</span>
      <span className="text-xs font-bold tabular-nums text-[var(--text-high)] ml-1 truncate">
        ${value.toFixed(2)}
      </span>
    </div>
  );
}

// ============================================================================
// Contract Activity Section
// ============================================================================

function ContractActivitySection({
  symbol,
  contract,
  lastQuoteTime,
  isEntered,
  onContractSelect,
  recommendation,
  underlyingPrice,
  pickerOpen,
  setPickerOpen,
}: {
  symbol: string;
  contract: Contract | null;
  lastQuoteTime?: Date | null;
  isEntered: boolean;
  onContractSelect?: (contract: Contract) => void;
  recommendation?: ContractRecommendation | null;
  underlyingPrice?: number | null;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}) {
  // BUGFIX: pickerOpen state is now lifted to parent CockpitRightPanel

  const handleContractSelected = useCallback(
    (newContract: Contract) => {
      if (onContractSelect && !isEntered) {
        onContractSelect(newContract);
      }
      setPickerOpen(false);
    },
    [onContractSelect, isEntered]
  );

  // Calculate liquidity metrics
  const liquidityMetrics = useMemo(() => {
    if (!contract) return null;

    const bid = contract.bid ?? 0;
    const ask = contract.ask ?? 0;
    const mid = contract.mid ?? (bid + ask) / 2;
    const hasValidPricing = mid > 0.01 || bid > 0 || ask > 0;
    const spreadPct = hasValidPricing && mid > 0.01 ? ((ask - bid) / mid) * 100 : null;

    const volume = contract.volume ?? 0;
    const openInterest = contract.openInterest ?? 0;

    return {
      volume,
      openInterest,
      spreadPct,
    };
  }, [contract]);

  const formattedQuoteTime = lastQuoteTime
    ? lastQuoteTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <Settings2 className="w-6 h-6 text-[var(--text-faint)]" />
        <span className="text-xs text-[var(--text-faint)]">No contract selected</span>
        {onContractSelect && (
          <ContractPickerTrigger
            onClick={() => setPickerOpen(true)}
            label="Select Contract"
            size="sm"
            variant="default"
          />
        )}
        {onContractSelect && (
          <ContractPicker
            symbol={symbol}
            currentPrice={underlyingPrice ?? 0}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={handleContractSelected}
            recommendation={recommendation}
            currentContract={contract}
            disabled={isEntered}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Volume & OI Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-[9px] text-[var(--text-faint)] uppercase">Volume</span>
          </div>
          <div className="text-sm font-bold tabular-nums text-[var(--text-high)]">
            {liquidityMetrics?.volume && liquidityMetrics.volume > 0
              ? liquidityMetrics.volume.toLocaleString()
              : "--"}
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-[9px] text-[var(--text-faint)] uppercase">Open Int</span>
          </div>
          <div className="text-sm font-bold tabular-nums text-[var(--text-high)]">
            {liquidityMetrics?.openInterest ? liquidityMetrics.openInterest.toLocaleString() : "--"}
          </div>
        </div>
      </div>

      {/* Wide Spread Warning */}
      {liquidityMetrics?.spreadPct !== null && liquidityMetrics.spreadPct > 3 && (
        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[10px] text-amber-400">
              Wide spread ({liquidityMetrics.spreadPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      {/* Quote Time Footer */}
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-[var(--text-faint)] pt-1 border-t border-[var(--border-hairline)]">
        <Clock className="w-3 h-3" />
        <span className="tabular-nums">{formattedQuoteTime}</span>
      </div>

      {/* Contract Picker Modal */}
      {onContractSelect && (
        <ContractPicker
          symbol={symbol}
          currentPrice={underlyingPrice ?? 0}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handleContractSelected}
          recommendation={recommendation}
          currentContract={contract}
          disabled={isEntered}
          disabledReason={isEntered ? "Can't change contract after entry" : undefined}
        />
      )}
    </div>
  );
}

// ============================================================================
// Liquidity Badge
// ============================================================================

function LiquidityBadge({ contract }: { contract: Contract }) {
  const rating = useMemo(() => {
    const bid = contract.bid ?? 0;
    const ask = contract.ask ?? 0;
    const mid = contract.mid ?? (bid + ask) / 2;
    if (mid <= 0.01) return "poor";

    const spreadPct = ((ask - bid) / mid) * 100;
    const grade = getLiquidityGrade(spreadPct / 100);
    return grade === "A" ? "good" : grade === "B" ? "fair" : "poor";
  }, [contract]);

  const config = {
    good: {
      label: "Good",
      icon: CheckCircle,
      className:
        "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border-[var(--accent-positive)]/30",
    },
    fair: {
      label: "Fair",
      icon: MinusCircle,
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    poor: {
      label: "Poor",
      icon: AlertCircle,
      className:
        "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] border-[var(--accent-negative)]/30",
    },
  };

  const { label, icon: Icon, className } = config[rating];

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium",
        className
      )}
      title={`Liquidity: ${label}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

export default CockpitRightPanel;
