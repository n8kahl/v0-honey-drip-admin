/**
 * HDKeyLevelsPanel - Visual key levels display for watchlist symbols
 *
 * Shows support/resistance, pivots, gaps on a price ladder visualization
 * Designed for quick pre-market level analysis
 */

import { useState } from "react";
import {
  useOffHoursData,
  type SymbolKeyLevels,
  type KeyLevel,
} from "../../../hooks/useOffHoursData";
import { cn } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  Activity,
  Layers,
} from "lucide-react";

interface HDKeyLevelsPanelProps {
  className?: string;
  maxSymbols?: number;
}

export function HDKeyLevelsPanel({ className, maxSymbols = 5 }: HDKeyLevelsPanelProps) {
  const { keyLevelsBySymbol, loading, isOffHours } = useOffHoursData();
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const symbols = Array.from(keyLevelsBySymbol.values()).slice(0, maxSymbols);

  if (!isOffHours && symbols.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl p-6 bg-[var(--surface-1)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--surface-2)] rounded w-1/3" />
          <div className="h-24 bg-[var(--surface-2)] rounded" />
          <div className="h-24 bg-[var(--surface-2)] rounded" />
        </div>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl p-6 bg-[var(--surface-1)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <h3 className="text-lg font-semibold text-[var(--text-high)] mb-2">Key Levels</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Add symbols to your watchlist to see key levels
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden",
        "bg-[var(--surface-1)] border border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[var(--brand-primary)]" />
          <h3 className="text-lg font-semibold text-[var(--text-high)]">Key Levels</h3>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Support, resistance, and pivot levels for next session
        </p>
      </div>

      {/* Symbol List */}
      <div className="divide-y divide-[var(--border-hairline)]">
        {symbols.map((symbolData) => (
          <SymbolLevelsRow
            key={symbolData.symbol}
            data={symbolData}
            isExpanded={expandedSymbol === symbolData.symbol}
            onToggle={() =>
              setExpandedSymbol(expandedSymbol === symbolData.symbol ? null : symbolData.symbol)
            }
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]/50">
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Resistance
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Support
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Pivot/VWAP
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Gap
          </span>
        </div>
      </div>
    </div>
  );
}

// Individual symbol row with expandable levels
function SymbolLevelsRow({
  data,
  isExpanded,
  onToggle,
}: {
  data: SymbolKeyLevels;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { symbol, currentPrice, priorClose, changePercent, levels, trend, setupBias } = data;

  const TrendIcon = trend === "bullish" ? TrendingUp : trend === "bearish" ? TrendingDown : Minus;
  const trendColor =
    trend === "bullish"
      ? "text-green-400"
      : trend === "bearish"
        ? "text-red-400"
        : "text-[var(--text-muted)]";

  return (
    <div>
      {/* Summary Row */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 hover:bg-[var(--surface-2)]/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-[var(--text-high)]">{symbol}</span>
                <BiasTag bias={setupBias} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-mono text-[var(--text-high)]">
                  ${currentPrice.toFixed(2)}
                </span>
                <span className={cn("text-sm font-mono flex items-center gap-0.5", trendColor)}>
                  <TrendIcon className="w-3 h-3" />
                  {changePercent >= 0 ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mini Level Preview */}
            <MiniLevelBar levels={levels} currentPrice={currentPrice} />

            <div className="flex items-center gap-1 text-[var(--text-muted)]">
              <span className="text-xs">{levels.length} levels</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-6 pb-4 space-y-4">
          {/* Visual Level Ladder */}
          <LevelLadder levels={levels} currentPrice={currentPrice} />

          {/* Level List */}
          <div className="grid grid-cols-2 gap-2">
            {levels.map((level, idx) => (
              <LevelChip
                key={`${level.type}-${level.price}-${idx}`}
                level={level}
                currentPrice={currentPrice}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Bias tag component
function BiasTag({ bias }: { bias: "long" | "short" | "neutral" }) {
  const config = {
    long: { bg: "bg-green-500/20", text: "text-green-400", label: "LONG BIAS" },
    short: { bg: "bg-red-500/20", text: "text-red-400", label: "SHORT BIAS" },
    neutral: { bg: "bg-[var(--surface-2)]", text: "text-[var(--text-muted)]", label: "NEUTRAL" },
  };

  const { bg, text, label } = config[bias];

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide", bg, text)}>
      {label}
    </span>
  );
}

// Mini horizontal bar showing level distribution
function MiniLevelBar({ levels, currentPrice }: { levels: KeyLevel[]; currentPrice: number }) {
  // Find price range
  const prices = levels.map((l) => l.price);
  const minPrice = Math.min(...prices, currentPrice) * 0.99;
  const maxPrice = Math.max(...prices, currentPrice) * 1.01;
  const range = maxPrice - minPrice;

  const getPosition = (price: number) => ((price - minPrice) / range) * 100;

  return (
    <div className="relative w-24 h-6 bg-[var(--surface-2)] rounded overflow-hidden">
      {/* Level dots */}
      {levels.map((level, idx) => (
        <div
          key={`${level.type}-${idx}`}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
            level.type === "resistance" && "bg-red-400",
            level.type === "support" && "bg-green-400",
            level.type === "pivot" && "bg-yellow-400",
            level.type === "vwap" && "bg-yellow-400",
            level.type === "gap" && "bg-purple-400"
          )}
          style={{ left: `${getPosition(level.price)}%` }}
        />
      ))}

      {/* Current price line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white"
        style={{ left: `${getPosition(currentPrice)}%` }}
      />
    </div>
  );
}

// Visual level ladder
function LevelLadder({ levels, currentPrice }: { levels: KeyLevel[]; currentPrice: number }) {
  // Sort levels by price (high to low)
  const sortedLevels = [...levels].sort((a, b) => b.price - a.price);

  // Find price range
  const prices = levels.map((l) => l.price);
  const minPrice = Math.min(...prices, currentPrice) * 0.995;
  const maxPrice = Math.max(...prices, currentPrice) * 1.005;
  const range = maxPrice - minPrice;

  const getPosition = (price: number) => ((maxPrice - price) / range) * 100;

  return (
    <div className="relative h-48 bg-gradient-to-b from-red-500/5 via-[var(--surface-2)] to-green-500/5 rounded-lg overflow-hidden">
      {/* Price axis labels */}
      <div className="absolute right-2 top-2 text-[10px] text-red-400 font-mono">
        ${maxPrice.toFixed(2)}
      </div>
      <div className="absolute right-2 bottom-2 text-[10px] text-green-400 font-mono">
        ${minPrice.toFixed(2)}
      </div>

      {/* Level lines */}
      {sortedLevels.map((level, idx) => {
        const position = getPosition(level.price);
        const isAbovePrice = level.price > currentPrice;

        return (
          <div
            key={`${level.type}-${level.price}-${idx}`}
            className="absolute left-0 right-0 flex items-center group"
            style={{ top: `${position}%` }}
          >
            <div
              className={cn(
                "flex-1 h-px",
                level.type === "resistance" && "bg-red-400/60",
                level.type === "support" && "bg-green-400/60",
                level.type === "pivot" && "bg-yellow-400/60 border-dashed",
                level.type === "vwap" && "bg-yellow-400/60 border-dashed",
                level.type === "gap" && "bg-purple-400/60"
              )}
            />
            <div
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono rounded-sm whitespace-nowrap",
                level.type === "resistance" && "bg-red-500/20 text-red-400",
                level.type === "support" && "bg-green-500/20 text-green-400",
                level.type === "pivot" && "bg-yellow-500/20 text-yellow-400",
                level.type === "vwap" && "bg-yellow-500/20 text-yellow-400",
                level.type === "gap" && "bg-purple-500/20 text-purple-400"
              )}
            >
              {level.label}
            </div>
          </div>
        );
      })}

      {/* Current price line */}
      <div
        className="absolute left-0 right-0 flex items-center"
        style={{ top: `${getPosition(currentPrice)}%` }}
      >
        <div className="flex-1 h-0.5 bg-white/80" />
        <div className="px-2 py-1 bg-white text-black text-xs font-bold rounded-sm">
          ${currentPrice.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

// Level chip component
function LevelChip({ level, currentPrice }: { level: KeyLevel; currentPrice: number }) {
  const distance = ((level.price - currentPrice) / currentPrice) * 100;
  const isAbove = level.price > currentPrice;

  const Icon =
    level.type === "resistance"
      ? Target
      : level.type === "support"
        ? Shield
        : level.type === "vwap" || level.type === "pivot"
          ? Activity
          : Layers;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        "bg-[var(--surface-2)] border",
        level.type === "resistance" && "border-red-500/30",
        level.type === "support" && "border-green-500/30",
        level.type === "pivot" && "border-yellow-500/30",
        level.type === "vwap" && "border-yellow-500/30",
        level.type === "gap" && "border-purple-500/30"
      )}
    >
      <Icon
        className={cn(
          "w-4 h-4",
          level.type === "resistance" && "text-red-400",
          level.type === "support" && "text-green-400",
          level.type === "pivot" && "text-yellow-400",
          level.type === "vwap" && "text-yellow-400",
          level.type === "gap" && "text-purple-400"
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--text-muted)] truncate">{level.source}</div>
        <div className="font-mono text-[var(--text-high)]">${level.price.toFixed(2)}</div>
      </div>
      <div className={cn("text-xs font-mono", isAbove ? "text-red-400" : "text-green-400")}>
        {isAbove ? "+" : ""}
        {distance.toFixed(2)}%
      </div>
    </div>
  );
}

// Export compact version for sidebar use
export function HDKeyLevelsCompact({ symbol }: { symbol: string }) {
  const { keyLevelsBySymbol } = useOffHoursData();
  const data = keyLevelsBySymbol.get(symbol);

  if (!data) return null;

  const nearestResistance = data.levels
    .filter((l) => l.type === "resistance" && l.price > data.currentPrice)
    .sort((a, b) => a.price - b.price)[0];

  const nearestSupport = data.levels
    .filter((l) => l.type === "support" && l.price < data.currentPrice)
    .sort((a, b) => b.price - a.price)[0];

  return (
    <div className="flex items-center gap-2 text-xs">
      {nearestResistance && (
        <span className="flex items-center gap-1 text-red-400">
          <Target className="w-3 h-3" />
          R: ${nearestResistance.price.toFixed(2)}
        </span>
      )}
      {nearestSupport && (
        <span className="flex items-center gap-1 text-green-400">
          <Shield className="w-3 h-3" />
          S: ${nearestSupport.price.toFixed(2)}
        </span>
      )}
    </div>
  );
}
