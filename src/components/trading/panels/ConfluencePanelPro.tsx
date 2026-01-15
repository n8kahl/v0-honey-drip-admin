/**
 * ConfluencePanelPro - "Impressive" Confluence Visuals
 *
 * A single reusable panel showing all confluence factors in a visually dense,
 * impressive display. Uses existing proven components:
 * - SmartScoreBadge: Big confluence score
 * - MTFHeatmap: Multi-timeframe alignment
 * - FlowPulse: Institutional flow tug-of-war
 * - GammaLevelsMap: Dealer gamma exposure
 * - Level Proximity Chips: VWAP/ORB/PDH/PDL with distance
 *
 * STATE-BASED DISPLAY:
 * - WATCH: "What's missing" empty states explaining what would raise confidence
 * - PLAN/LOADED/ENTERED: "What's supporting this trade" with degradation warnings
 *
 * UNDERLYING vs CONTRACT CONTEXT:
 * - Clearly labels which metrics are underlying-based vs option market-based
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Activity,
  Layers,
  BarChart3,
  Zap,
  Clock,
  Info,
} from "lucide-react";

// Visual Components
import { SmartScoreBadge } from "@/components/hd/terminal/SmartScoreBadge";
import { MTFHeatmap, type MTFState, type TrendState } from "@/components/hd/viz/MTFHeatmap";
import { FlowPulse } from "@/components/hd/terminal/FlowPulse";
import { GammaLevelsMap } from "@/components/hd/terminal/GammaLevelsMap";

// Hooks & Types
import { useSymbolConfluence, type MTFData } from "@/hooks/useSymbolConfluence";
import { useFlowContext } from "@/hooks/useFlowContext";
import { useMarketSession } from "@/hooks/useMarketSession";
import type { KeyLevels } from "@/lib/riskEngine/types";
import type { SymbolFeatures } from "@/lib/strategy/engine";
import type { CockpitViewState } from "../cockpit/CockpitLayout";

// ============================================================================
// Types
// ============================================================================

export interface ConfluencePanelProProps {
  /** Symbol to analyze */
  symbol: string;
  /** Current cockpit view state */
  viewState: CockpitViewState;
  /** Current underlying price */
  currentPrice?: number | null;
  /** Key price levels */
  keyLevels?: KeyLevels | null;
  /** Flow data override */
  flow?: SymbolFeatures["flow"];
  /** Gamma data */
  gamma?: {
    flipLevel?: number;
    dealerNetDelta?: number;
    callWall?: number;
    putWall?: number;
    maxPain?: number;
    regime?: "long_gamma" | "short_gamma" | "neutral";
  };
  /** MTF data override */
  mtfData?: MTFData[];
  /** Show degradation warnings */
  showDegradationWarnings?: boolean;
  /** Contract IV for fallback when Greeks not available */
  contractIV?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Format timestamp as relative time (e.g., "12s ago", "2m ago") */
function formatRelativeTime(ts: number | null | undefined): string {
  if (!ts) return "never";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// ============================================================================
// Main Component
// ============================================================================

export function ConfluencePanelPro({
  symbol,
  viewState,
  currentPrice,
  keyLevels,
  flow,
  gamma,
  mtfData,
  showDegradationWarnings = true,
  contractIV,
  className,
}: ConfluencePanelProProps) {
  // Get confluence data from hooks (pass contractIV as fallback for IV percentile)
  const confluence = useSymbolConfluence(symbol, { contractIV });
  const flowContext = useFlowContext(symbol);
  const { session } = useMarketSession();

  // Determine if market is closed (flow data won't update)
  const isMarketClosed = session === "CLOSED";

  // Derive effective flow
  const effectiveFlow = useMemo(() => {
    if (flow) return flow;
    return {
      flowScore: flowContext.institutionalScore,
      flowBias:
        flowContext.primarySentiment === "BULLISH"
          ? ("bullish" as const)
          : flowContext.primarySentiment === "BEARISH"
            ? ("bearish" as const)
            : ("neutral" as const),
      buyPressure: 50 + flowContext.primaryStrength / 2,
      sweepCount: flowContext.sweepCount,
      blockCount: 0,
      putCallRatio: flowContext.putCallRatio,
      aggressiveness: "NORMAL" as const,
    };
  }, [flow, flowContext]);

  // Convert MTFData to MTFState for heatmap
  const mtfStates = useMemo<MTFState[]>(() => {
    const data = mtfData ?? confluence?.mtf ?? [];
    return data.map((tf) => ({
      tf: tf.timeframe,
      label: tf.label,
      trend:
        tf.direction === "up"
          ? ("bull" as TrendState)
          : tf.direction === "down"
            ? ("bear" as TrendState)
            : ("neutral" as TrendState),
    }));
  }, [mtfData, confluence?.mtf]);

  // Build level chips
  const levelChips = useMemo(() => {
    if (!keyLevels || !currentPrice) return [];

    const levels: { label: string; price: number; type: "support" | "resistance" | "vwap" }[] = [];

    if (keyLevels.vwap) levels.push({ label: "VWAP", price: keyLevels.vwap, type: "vwap" });
    if (keyLevels.orbHigh)
      levels.push({ label: "ORH", price: keyLevels.orbHigh, type: "resistance" });
    if (keyLevels.orbLow) levels.push({ label: "ORL", price: keyLevels.orbLow, type: "support" });
    if (keyLevels.priorDayHigh)
      levels.push({ label: "PDH", price: keyLevels.priorDayHigh, type: "resistance" });
    if (keyLevels.priorDayLow)
      levels.push({ label: "PDL", price: keyLevels.priorDayLow, type: "support" });

    return levels
      .map((l) => ({
        ...l,
        distance: ((currentPrice - l.price) / l.price) * 100,
        absDistance: Math.abs(((currentPrice - l.price) / l.price) * 100),
      }))
      .sort((a, b) => a.absDistance - b.absDistance)
      .slice(0, 5);
  }, [keyLevels, currentPrice]);

  // Score and health status
  const score = confluence?.overallScore ?? 0;
  const isWatching = viewState === "watch";
  const hasFlow = effectiveFlow.flowScore > 0;
  const hasGamma = !!gamma?.flipLevel || !!gamma?.callWall || !!gamma?.putWall;
  const hasMTF = mtfStates.length > 0;
  const hasLevels = levelChips.length > 0;

  // Degradation warnings
  const warnings = useMemo(() => {
    if (!showDegradationWarnings || isWatching) return [];

    const w: string[] = [];
    if (effectiveFlow.flowScore < 40) w.push("Flow conviction dropping");
    if (confluence?.mtfAligned && confluence.mtfAligned < 2) w.push("MTF alignment weakening");
    return w;
  }, [showDegradationWarnings, isWatching, effectiveFlow.flowScore, confluence?.mtfAligned]);

  return (
    <div
      className={cn("h-full flex flex-col overflow-hidden bg-[var(--surface-1)]", className)}
      data-testid="confluence-panel-pro"
    >
      {/* ========== HEADER: Score Badge + Status ========== */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2 border-b border-[var(--border-hairline)]">
        <SmartScoreBadge score={score} size="lg" label="CONF" variant="ring" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-high)]">Confluence</span>
            {isWatching ? (
              <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--surface-2)]">
                ANALYZING
              </span>
            ) : (
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                  score >= 70
                    ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                    : score >= 50
                      ? "bg-[var(--accent-warning)]/20 text-[var(--accent-warning)]"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                )}
              >
                {score >= 70 ? "STRONG" : score >= 50 ? "MODERATE" : "WEAK"}
              </span>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertCircle className="w-3 h-3 text-[var(--accent-warning)]" />
              <span className="text-[10px] text-[var(--accent-warning)]">{warnings[0]}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3">
        {/* ---------- MTF HEATMAP ---------- */}
        <Section
          title="Multi-Timeframe Trend"
          icon={<Layers className="w-3.5 h-3.5" />}
          context="underlying"
          hasData={hasMTF}
          emptyMessage="MTF data loading..."
        >
          {hasMTF && <MTFHeatmap timeframes={mtfStates} />}
          {hasMTF && confluence?.mtfAligned !== undefined && (
            <div className="flex items-center justify-between mt-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)]">Alignment</span>
                {/* MTF data status indicator */}
                {(confluence.mtfHasNoData || confluence.mtfHasStale) && (
                  <span
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded",
                      isMarketClosed
                        ? "bg-zinc-700/50 text-zinc-400"
                        : confluence.mtfHasNoData
                          ? "bg-zinc-600/30 text-zinc-400"
                          : "bg-amber-500/20 text-amber-400"
                    )}
                  >
                    {isMarketClosed ? (
                      <>CLOSED</>
                    ) : confluence.mtfHasNoData ? (
                      <>NO DATA</>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        STALE
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-semibold",
                    confluence.mtfAligned >= 3
                      ? "text-[var(--accent-positive)]"
                      : "text-[var(--text-muted)]"
                  )}
                >
                  {confluence.mtfAligned}/{mtfStates.length} aligned
                </span>
                {/* MTF last updated timestamp */}
                {confluence.mtfLastUpdated && (
                  <span className="flex items-center gap-1 text-[var(--text-faint)]">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(confluence.mtfLastUpdated)}
                  </span>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* ---------- FLOW PULSE ---------- */}
        <Section
          title="Institutional Flow"
          icon={<Activity className="w-3.5 h-3.5" />}
          context="option"
          hasData={hasFlow}
          emptyMessage={
            isWatching
              ? "Flow data reveals institutional positioning"
              : "Flow data unavailable for this symbol"
          }
        >
          {hasFlow && (
            <FlowPulse
              flow={effectiveFlow}
              compact
              showLabels={false}
              lastUpdated={flowContext.lastUpdated}
              isStale={flowContext.isStale}
              isMarketClosed={isMarketClosed}
            />
          )}
          {hasFlow && (
            <div className="flex items-center justify-between mt-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                {effectiveFlow.sweepCount > 0 && (
                  <span className="flex items-center gap-1 text-[var(--accent-warning)]">
                    <Zap className="w-3 h-3" />
                    {effectiveFlow.sweepCount} sweeps
                  </span>
                )}
                {/* Stale/Market Closed indicator */}
                {(flowContext.isStale || isMarketClosed) && (
                  <span
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded",
                      isMarketClosed
                        ? "bg-zinc-700/50 text-zinc-400"
                        : "bg-amber-500/20 text-amber-400"
                    )}
                  >
                    {isMarketClosed ? (
                      <>CLOSED</>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        STALE
                      </>
                    )}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "font-semibold uppercase",
                  effectiveFlow.flowBias === "bullish"
                    ? "text-[var(--accent-positive)]"
                    : effectiveFlow.flowBias === "bearish"
                      ? "text-[var(--accent-negative)]"
                      : "text-[var(--text-muted)]"
                )}
              >
                {effectiveFlow.flowBias}
              </span>
            </div>
          )}
        </Section>

        {/* ---------- GAMMA LEVELS MAP ---------- */}
        <Section
          title="Gamma Exposure"
          icon={<BarChart3 className="w-3.5 h-3.5" />}
          context="option"
          hasData={hasGamma}
          emptyMessage={
            isWatching
              ? "Gamma walls show where dealer hedging impacts price"
              : "Gamma data not available"
          }
        >
          {hasGamma && currentPrice && (
            <GammaLevelsMap currentPrice={currentPrice} gamma={gamma} compact showLabels={false} />
          )}
        </Section>

        {/* ---------- KEY LEVELS PROXIMITY ---------- */}
        <Section
          title="Key Levels"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          context="underlying"
          hasData={hasLevels}
          emptyMessage={isWatching ? "Key levels provide entry/exit reference" : "No levels found"}
        >
          {hasLevels && (
            <div className="flex flex-wrap gap-1.5">
              {levelChips.map((level, idx) => (
                <LevelChip
                  key={level.label}
                  label={level.label}
                  distance={level.distance}
                  type={level.type}
                  isNearest={idx === 0}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ---------- WHY EVIDENCE ---------- */}
        {confluence?.factors && confluence.factors.length > 0 && (
          <Section
            title="WHY"
            icon={<Info className="w-3.5 h-3.5" />}
            context="underlying"
            hasData={true}
            emptyMessage=""
          >
            <div className="space-y-1">
              {confluence.factors
                .filter((f) => f.evidence && f.status !== "missing")
                .slice(0, 6) // Show top 6 factors with evidence
                .map((factor) => (
                  <div key={factor.name} className="flex items-start gap-2 text-[10px]">
                    <span
                      className={cn(
                        "flex-shrink-0 w-12 font-semibold uppercase",
                        factor.status === "strong"
                          ? "text-[var(--accent-positive)]"
                          : factor.status === "good"
                            ? "text-emerald-400"
                            : factor.status === "building"
                              ? "text-amber-400"
                              : "text-[var(--text-muted)]"
                      )}
                    >
                      {factor.label}
                    </span>
                    <span className="text-[var(--text-medium)] leading-tight">
                      {factor.evidence}
                    </span>
                  </div>
                ))}
            </div>
          </Section>
        )}
      </div>

      {/* ========== FOOTER: What's Missing (WATCH state) ========== */}
      {isWatching && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-0)]">
          <div className="text-[10px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-high)]">To raise confidence:</span>
            <ul className="mt-1 space-y-0.5 pl-3">
              {!hasMTF && (
                <li className="flex items-center gap-1">
                  <HelpCircle className="w-2.5 h-2.5" />
                  Wait for MTF alignment
                </li>
              )}
              {!hasFlow && (
                <li className="flex items-center gap-1">
                  <HelpCircle className="w-2.5 h-2.5" />
                  Check institutional flow
                </li>
              )}
              {!hasLevels && (
                <li className="flex items-center gap-1">
                  <HelpCircle className="w-2.5 h-2.5" />
                  Identify key levels
                </li>
              )}
              {hasMTF && hasFlow && hasLevels && (
                <li className="flex items-center gap-1 text-[var(--accent-positive)]">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  All factors available
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  context: "underlying" | "option";
  hasData: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}

function Section({ title, icon, context, hasData, emptyMessage, children }: SectionProps) {
  return (
    <div data-testid={`confluence-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-muted)]">{icon}</span>
          <span className="text-[11px] font-semibold text-[var(--text-high)] uppercase tracking-wide">
            {title}
          </span>
        </div>
        <span
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide",
            context === "underlying"
              ? "bg-blue-500/10 text-blue-400"
              : "bg-purple-500/10 text-purple-400"
          )}
        >
          {context === "underlying" ? "UNDERLYING" : "OPTIONS"}
        </span>
      </div>

      {/* Section Content */}
      {hasData ? (
        children
      ) : (
        <div className="flex items-center justify-center py-3 rounded bg-[var(--surface-0)] border border-dashed border-[var(--border-hairline)]">
          <span className="text-[10px] text-[var(--text-faint)] text-center px-4">
            {emptyMessage}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Level Chip Component
// ============================================================================

interface LevelChipProps {
  label: string;
  distance: number;
  type: "support" | "resistance" | "vwap";
  isNearest?: boolean;
}

function LevelChip({ label, distance, type, isNearest = false }: LevelChipProps) {
  const colorClasses = {
    support:
      "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]",
    resistance:
      "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]/30 text-[var(--accent-negative)]",
    vwap: "bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded border text-[10px]",
        colorClasses[type],
        isNearest && "ring-1 ring-[var(--brand-primary)]/50"
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className="opacity-70 tabular-nums font-mono">
        {distance >= 0 ? "+" : ""}
        {distance.toFixed(1)}%
      </span>
      {isNearest && <span className="text-[8px] opacity-60 uppercase">nearest</span>}
    </div>
  );
}

export default ConfluencePanelPro;
