/**
 * MobileDeepScreen - Chart & Analysis ("The Why")
 *
 * Deep-dive analysis for the focused symbol:
 * - Live chart with key levels
 * - Confluence breakdown
 * - Strategy signals
 * - Key levels (POIs)
 *
 * Part of the Opportunity Stack [DEEP] tab.
 */

import { useUIStore } from "../../../stores/uiStore";
import { useSymbolData } from "../../../stores/marketDataStore";
import { useKeyLevels } from "../../../hooks/useKeyLevels";
import { SmartScoreBadge } from "../../hd/terminal";
import { FlowIntelligencePanel } from "../../hd/terminal/FlowIntelligencePanel";
import { HDMiniSparkline } from "../../hd/charts/HDMiniSparkline";
import { HDSignalChips } from "../../hd/common/HDSignalChips";
import { BarChart3, Target, TrendingUp, TrendingDown, Layers, Activity } from "lucide-react";
import { HDInstitutionalRadar } from "../../hd/common/HDInstitutionalRadar";
import { cn } from "../../../lib/utils";

interface MobileDeepScreenProps {
  onAnalyzeMore?: () => void;
}

export function MobileDeepScreen({ onAnalyzeMore }: MobileDeepScreenProps) {
  const focusSymbol = useUIStore((s) => s.mainCockpitSymbol);
  const symbolData = useSymbolData(focusSymbol || "");

  // Get key levels including options flow levels
  const { keyLevels } = useKeyLevels(focusSymbol || "", {
    enabled: !!focusSymbol,
  });

  // Extract confluence data
  const confluenceScore = symbolData?.confluence?.overall ?? 0;
  const confluenceComponents = symbolData?.confluence?.components ?? {};

  // Extract indicators
  const indicators = symbolData?.indicators;
  const mtfTrend = symbolData?.mtfTrend;

  // Get current price from symbolData
  const currentPrice = symbolData?.price ?? 0;

  // No symbol selected state - Institutional Radar
  if (!focusSymbol) {
    return (
      <div className="flex-1">
        <HDInstitutionalRadar
          message="Analyzing market structure..."
          subMessage="Select a symbol from the SCAN tab"
          size="lg"
          className="h-full"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Chart Section */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Price Action
          </span>
        </div>

        {/* Mini Chart - taller for mobile */}
        <div className="h-40 rounded-xl bg-[var(--surface-2)] border border-[var(--border-hairline)] overflow-hidden">
          <HDMiniSparkline symbol={focusSymbol} height={160} />
        </div>
      </div>

      {/* Confluence Score Section */}
      <div className="p-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--brand-primary)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Confluence Score
            </span>
          </div>
          <SmartScoreBadge score={confluenceScore} size="md" variant="pill" />
        </div>

        {/* Confluence chips */}
        <HDSignalChips components={confluenceComponents} showAll />
      </div>

      {/* Options Flow Section - Full institutional intelligence */}
      <FlowIntelligencePanel
        symbol={focusSymbol}
        currentPrice={currentPrice}
        optionsFlow={keyLevels?.optionsFlow}
      />

      {/* MTF Trend Section */}
      {mtfTrend && (
        <div className="p-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-[var(--brand-primary)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Multi-Timeframe Trend
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(["1m", "5m", "15m", "60m"] as const).map((tf) => {
              const trend = mtfTrend[tf]; // "bull" | "bear" | "neutral"
              if (!trend) return null;

              const isBullish = trend === "bull";
              const isBearish = trend === "bear";

              return (
                <div
                  key={tf}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl",
                    "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
                    "min-h-[72px]"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">
                    {tf}
                  </span>
                  {isBullish ? (
                    <TrendingUp className="w-5 h-5 text-[var(--accent-positive)]" />
                  ) : isBearish ? (
                    <TrendingDown className="w-5 h-5 text-[var(--accent-negative)]" />
                  ) : (
                    <div className="w-5 h-0.5 bg-[var(--text-muted)]" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium mt-1",
                      isBullish && "text-[var(--accent-positive)]",
                      isBearish && "text-[var(--accent-negative)]",
                      !isBullish && !isBearish && "text-[var(--text-muted)]"
                    )}
                  >
                    {trend === "bull" ? "BULL" : trend === "bear" ? "BEAR" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Indicators */}
      {indicators && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[var(--brand-primary)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Key Indicators
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* RSI */}
            {indicators.rsi14 !== undefined && (
              <IndicatorCard
                label="RSI"
                value={indicators.rsi14.toFixed(0)}
                status={
                  indicators.rsi14 > 70
                    ? "overbought"
                    : indicators.rsi14 < 30
                      ? "oversold"
                      : "neutral"
                }
              />
            )}

            {/* VWAP */}
            {indicators.vwap && (
              <IndicatorCard
                label="VWAP"
                value={`$${indicators.vwap.toFixed(2)}`}
                status="neutral"
              />
            )}

            {/* ATR */}
            {indicators.atr14 && (
              <IndicatorCard label="ATR" value={indicators.atr14.toFixed(2)} status="neutral" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for indicator cards
function IndicatorCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "overbought" | "oversold" | "neutral";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-xl",
        "bg-[var(--surface-2)] border border-[var(--border-hairline)]",
        "min-h-[72px]"
      )}
    >
      <span className="text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-mono font-bold tabular-nums",
          status === "overbought" && "text-[var(--accent-negative)]",
          status === "oversold" && "text-[var(--accent-positive)]",
          status === "neutral" && "text-[var(--text-high)]"
        )}
      >
        {value}
      </span>
      {status !== "neutral" && (
        <span
          className={cn(
            "text-[9px] font-semibold uppercase mt-0.5",
            status === "overbought" && "text-[var(--accent-negative)]",
            status === "oversold" && "text-[var(--accent-positive)]"
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
}

export default MobileDeepScreen;
