/**
 * KCU Confluence Panel Component
 *
 * Displays the L-T-P (Levels, Trends, Patience) confluence analysis
 * in a compact visual format. Used in the trading workspace to show
 * setup quality at a glance.
 */

import type {
  KCULevel,
  LTPTrend,
  LTPPatienceCandle,
  KCUSetupQuality,
  KingQueenConfluence,
  LevelConfluence,
} from "../../../lib/composite/detectors/kcu/types";
import { formatPrice } from "../../../lib/utils";

interface HDKCUConfluencePanelProps {
  /** All key levels */
  levels: KCULevel[];
  /** King & Queen confluence if detected */
  kingQueen: KingQueenConfluence | null;
  /** Level confluences */
  levelConfluences: LevelConfluence[];
  /** Trend analysis */
  trend: LTPTrend;
  /** Patience candle status */
  patienceCandle: LTPPatienceCandle;
  /** Overall setup quality */
  quality: KCUSetupQuality;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Get color class based on score
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

/**
 * Get quality badge color
 */
function getQualityBadgeClass(quality: KCUSetupQuality): string {
  switch (quality) {
    case "A+":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    case "A":
      return "bg-green-500/20 text-green-400 border-green-500/40";
    case "B":
      return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    case "Avoid":
      return "bg-red-500/20 text-red-400 border-red-500/40";
    default:
      return "bg-[var(--bg-subtle)] text-[var(--text-muted)]";
  }
}

/**
 * Trend direction badge
 */
function TrendBadge({ trend }: { trend: LTPTrend }) {
  const isUp = trend.direction === "UPTREND";
  const isDown = trend.direction === "DOWNTREND";

  if (trend.direction === "CHOP") {
    return <span className="text-amber-400 text-xs font-medium">↔ No Trend</span>;
  }

  return (
    <span className={`text-xs font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      {isUp ? "↑" : "↓"} {trend.strength}%
    </span>
  );
}

/**
 * Patience candle status indicator
 */
function PatienceStatus({ patienceCandle }: { patienceCandle: LTPPatienceCandle }) {
  if (!patienceCandle.detected) {
    return <span className="text-amber-400 text-xs">⏳ Waiting</span>;
  }

  return (
    <span
      className={`text-xs font-medium ${
        patienceCandle.quality === "A+" || patienceCandle.quality === "A"
          ? "text-emerald-400"
          : patienceCandle.quality === "B"
            ? "text-amber-400"
            : "text-red-400"
      }`}
    >
      ✓ {patienceCandle.quality}
    </span>
  );
}

/**
 * King & Queen indicator
 */
function KingQueenIndicator({ kingQueen }: { kingQueen: KingQueenConfluence | null }) {
  if (!kingQueen || !kingQueen.detected) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-amber-400">
      <span title="King (VWAP)">♔</span>
      {kingQueen.queens.map((queen, i) => (
        <span key={i} title={`Queen: ${queen.type}`}>
          ♛
        </span>
      ))}
    </div>
  );
}

/**
 * Mini level ladder
 */
function LevelLadder({ levels, currentPrice }: { levels: KCULevel[]; currentPrice: number }) {
  // Sort levels by price descending
  const sortedLevels = [...levels].sort((a, b) => b.price - a.price);

  // Find where current price fits
  const aboveLevels = sortedLevels.filter((l) => l.price > currentPrice);
  const belowLevels = sortedLevels.filter((l) => l.price <= currentPrice);

  // Take top 2 above and top 2 below
  const displayLevels = [...aboveLevels.slice(-2), ...belowLevels.slice(0, 2)];

  return (
    <div className="space-y-0.5">
      {displayLevels.map((level, i) => {
        const isVWAP = level.type === "VWAP";
        const isQueen = level.isQueen;
        const isAbove = level.price > currentPrice;

        return (
          <div
            key={i}
            className={`flex items-center justify-between text-[10px] px-1 py-0.5 rounded ${
              Math.abs(level.distancePercent) < 0.3 ? "bg-[var(--bg-subtle)]" : ""
            }`}
          >
            <div className="flex items-center gap-1">
              {isVWAP && <span className="text-white">♔</span>}
              {isQueen && !isVWAP && <span className="text-amber-400">♛</span>}
              <span className="text-[var(--text-muted)] truncate max-w-[60px]">
                {level.type.replace("_", "")}
              </span>
            </div>
            <span className={`tabular-nums ${isAbove ? "text-emerald-400" : "text-red-400"}`}>
              {formatPrice(level.price)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Main KCU Confluence Panel
 */
export function HDKCUConfluencePanel({
  levels,
  kingQueen,
  levelConfluences,
  trend,
  patienceCandle,
  quality,
  compact = false,
}: HDKCUConfluencePanelProps) {
  // Find current price from nearest level
  const currentPrice =
    levels.length > 0
      ? levels.reduce((nearest, l) => (l.distancePercent < nearest.distancePercent ? l : nearest))
          .price
      : 0;

  if (compact) {
    // Compact mode: single row with key indicators
    return (
      <div className="flex items-center gap-3 p-2 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)]">
        {/* Quality Badge */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getQualityBadgeClass(
            quality
          )}`}
        >
          {quality}
        </span>

        {/* L-T-P Status */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">L</span>
            <KingQueenIndicator kingQueen={kingQueen} />
            {!kingQueen?.detected && (
              <span className="text-[var(--text-muted)]">{levels.length}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">T</span>
            <TrendBadge trend={trend} />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">P</span>
            <PatienceStatus patienceCandle={patienceCandle} />
          </div>
        </div>
      </div>
    );
  }

  // Full mode: detailed panel
  return (
    <div className="bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-[var(--text-high)] text-sm font-medium">L-T-P Confluence</h4>
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold border ${getQualityBadgeClass(
            quality
          )}`}
        >
          {quality} Setup
        </span>
      </div>

      {/* L - Levels */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
            Levels
          </span>
          <KingQueenIndicator kingQueen={kingQueen} />
        </div>
        <LevelLadder levels={levels} currentPrice={currentPrice} />
      </div>

      {/* T - Trend */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
            Trend
          </span>
          <TrendBadge trend={trend} />
        </div>

        {/* MTF mini display */}
        <div className="flex items-center gap-0.5">
          {(["1m", "5m", "15m", "60m"] as const).map((tf) => {
            const dir = trend.mtfAlignment[tf];
            const isUp = dir === "UPTREND";
            const isDown = dir === "DOWNTREND";
            return (
              <div
                key={tf}
                className={`flex-1 h-1 rounded-full ${
                  isUp ? "bg-emerald-500" : isDown ? "bg-red-500" : "bg-[var(--bg-muted)]"
                }`}
                title={`${tf}: ${dir}`}
              />
            );
          })}
        </div>
      </div>

      {/* P - Patience */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
            Patience Candle
          </span>
          <PatienceStatus patienceCandle={patienceCandle} />
        </div>

        {patienceCandle.detected && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">
              {patienceCandle.isInsideBar ? "Inside Bar" : "Consolidation"}
            </span>
            <span className="text-[var(--text-medium)] tabular-nums">
              Entry: ${formatPrice(patienceCandle.entryTrigger.longBreak)}
            </span>
          </div>
        )}
      </div>

      {/* Confluence zones */}
      {levelConfluences.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-hairline)]">
          <span className="text-[var(--text-muted)] text-[10px]">
            {levelConfluences.length} confluence zone
            {levelConfluences.length > 1 ? "s" : ""} detected
          </span>
        </div>
      )}
    </div>
  );
}
