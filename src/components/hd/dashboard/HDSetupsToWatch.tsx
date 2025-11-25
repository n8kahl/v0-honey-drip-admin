/**
 * HDSetupsToWatch - Visual trade scenario cards
 *
 * Displays potential trade setups with visual entry/stop/target levels
 * Each card shows a complete trade plan based on key levels
 */

import { useState } from "react";
import { useOffHoursData, type SetupScenario } from "../../../hooks/useOffHoursData";
import { cn } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  BarChart3,
  Eye,
  Star,
  Filter,
} from "lucide-react";

interface HDSetupsToWatchProps {
  className?: string;
  maxSetups?: number;
}

type SetupFilter = "all" | "long" | "short" | "high_confidence";

export function HDSetupsToWatch({ className, maxSetups = 6 }: HDSetupsToWatchProps) {
  const { setupScenarios, loading, isOffHours } = useOffHoursData();
  const [filter, setFilter] = useState<SetupFilter>("all");
  const [selectedSetup, setSelectedSetup] = useState<string | null>(null);

  // Filter setups
  const filteredSetups = setupScenarios
    .filter((setup) => {
      if (filter === "long") return setup.direction === "long";
      if (filter === "short") return setup.direction === "short";
      if (filter === "high_confidence") return setup.confidence === "high";
      return true;
    })
    .slice(0, maxSetups);

  if (!isOffHours && filteredSetups.length === 0) {
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
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-[var(--surface-2)] rounded" />
            <div className="h-48 bg-[var(--surface-2)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (setupScenarios.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl p-6 bg-[var(--surface-1)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <h3 className="text-lg font-semibold text-[var(--text-high)] mb-2 flex items-center gap-2">
          <Eye className="w-5 h-5 text-[var(--brand-primary)]" />
          Setups to Watch
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          Add symbols to your watchlist to generate trade scenarios
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[var(--brand-primary)]" />
            <h3 className="text-lg font-semibold text-[var(--text-high)]">Setups to Watch</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
              {filteredSetups.length}
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-[var(--text-muted)] mr-1" />
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterButton>
            <FilterButton
              active={filter === "long"}
              onClick={() => setFilter("long")}
              className="text-green-400"
            >
              <TrendingUp className="w-3 h-3" />
              Long
            </FilterButton>
            <FilterButton
              active={filter === "short"}
              onClick={() => setFilter("short")}
              className="text-red-400"
            >
              <TrendingDown className="w-3 h-3" />
              Short
            </FilterButton>
            <FilterButton
              active={filter === "high_confidence"}
              onClick={() => setFilter("high_confidence")}
              className="text-yellow-400"
            >
              <Star className="w-3 h-3" />
              High
            </FilterButton>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Pre-planned trade scenarios based on key levels
        </p>
      </div>

      {/* Setup Cards Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSetups.map((setup) => (
          <SetupCard
            key={setup.id}
            setup={setup}
            isSelected={selectedSetup === setup.id}
            onSelect={() => setSelectedSetup(selectedSetup === setup.id ? null : setup.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]/50">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Click a setup to see the visual trade plan</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Auto-generated from key levels
          </span>
        </div>
      </div>
    </div>
  );
}

// Filter button
function FilterButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors",
        active
          ? "bg-[var(--surface-2)] text-[var(--text-high)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-high)]",
        className
      )}
    >
      {children}
    </button>
  );
}

// Individual setup card
function SetupCard({
  setup,
  isSelected,
  onSelect,
}: {
  setup: SetupScenario;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isLong = setup.direction === "long";

  const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    breakout: {
      icon: <ArrowUpRight className="w-4 h-4" />,
      label: "BREAKOUT",
      color: "text-green-400 bg-green-500/20",
    },
    breakdown: {
      icon: <ArrowDownRight className="w-4 h-4" />,
      label: "BREAKDOWN",
      color: "text-red-400 bg-red-500/20",
    },
    bounce: {
      icon: <TrendingUp className="w-4 h-4" />,
      label: "BOUNCE",
      color: "text-blue-400 bg-blue-500/20",
    },
    rejection: {
      icon: <TrendingDown className="w-4 h-4" />,
      label: "REJECTION",
      color: "text-orange-400 bg-orange-500/20",
    },
    gap_fill: {
      icon: <BarChart3 className="w-4 h-4" />,
      label: "GAP FILL",
      color: "text-purple-400 bg-purple-500/20",
    },
    range_trade: {
      icon: <Target className="w-4 h-4" />,
      label: "RANGE",
      color: "text-cyan-400 bg-cyan-500/20",
    },
  };

  const config = typeConfig[setup.type] || typeConfig.breakout;

  const confidenceConfig = {
    high: { label: "HIGH", color: "text-yellow-400 bg-yellow-500/20" },
    medium: { label: "MED", color: "text-blue-400 bg-blue-500/20" },
    low: { label: "LOW", color: "text-[var(--text-muted)] bg-[var(--surface-2)]" },
  };

  const confConfig = confidenceConfig[setup.confidence];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full text-left rounded-xl border transition-all",
        "bg-[var(--surface-2)]/50 hover:bg-[var(--surface-2)]",
        isSelected
          ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]"
          : "border-[var(--border-hairline)]"
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--text-high)]">{setup.symbol}</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1",
                config.color
              )}
            >
              {config.icon}
              {config.label}
            </span>
          </div>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", confConfig.color)}>
            {confConfig.label}
          </span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-sm mt-1",
            isLong ? "text-green-400" : "text-red-400"
          )}
        >
          {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="font-medium">{setup.trigger}</span>
        </div>
      </div>

      {/* Visual Trade Plan */}
      <div className="p-4">
        <TradePlanVisual setup={setup} expanded={isSelected} />
      </div>

      {/* Footer Stats */}
      <div className="px-4 pb-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-muted)]">
            R:R{" "}
            <span className="text-[var(--text-high)] font-bold">
              {setup.riskReward.toFixed(1)}:1
            </span>
          </span>
          <span className="text-[var(--text-muted)]">
            Stop <span className="text-red-400 font-mono">${setup.stop.toFixed(2)}</span>
          </span>
        </div>
        <ChevronRight
          className={cn(
            "w-4 h-4 transition-transform",
            isSelected ? "rotate-90 text-[var(--brand-primary)]" : "text-[var(--text-muted)]"
          )}
        />
      </div>

      {/* Expanded Reasoning */}
      {isSelected && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--border-hairline)]">
          <p className="text-sm text-[var(--text-muted)]">{setup.reasoning}</p>
        </div>
      )}
    </button>
  );
}

// Visual trade plan showing entry/stop/targets
function TradePlanVisual({ setup, expanded }: { setup: SetupScenario; expanded: boolean }) {
  const isLong = setup.direction === "long";
  const levels = [setup.stop, setup.entry, ...setup.targets].sort((a, b) => b - a);
  const minPrice = Math.min(...levels) * 0.998;
  const maxPrice = Math.max(...levels) * 1.002;
  const range = maxPrice - minPrice;

  const getPosition = (price: number) => ((maxPrice - price) / range) * 100;

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden transition-all",
        expanded ? "h-40" : "h-24"
      )}
      style={{
        background: isLong
          ? "linear-gradient(to top, rgba(34, 197, 94, 0.1), rgba(239, 68, 68, 0.1))"
          : "linear-gradient(to top, rgba(239, 68, 68, 0.1), rgba(34, 197, 94, 0.1))",
      }}
    >
      {/* Target levels */}
      {setup.targets.map((target, idx) => (
        <div
          key={`target-${idx}`}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: `${getPosition(target)}%` }}
        >
          <div className={cn("flex-1 h-px", isLong ? "bg-green-500/50" : "bg-red-500/50")} />
          <div
            className={cn(
              "px-2 py-0.5 text-[10px] font-mono rounded-sm flex items-center gap-1",
              isLong ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}
          >
            <Target className="w-3 h-3" />T{idx + 1} ${target.toFixed(2)}
          </div>
        </div>
      ))}

      {/* Entry level */}
      <div
        className="absolute left-0 right-0 flex items-center"
        style={{ top: `${getPosition(setup.entry)}%` }}
      >
        <div className="flex-1 h-0.5 bg-[var(--brand-primary)]" />
        <div className="px-2 py-0.5 bg-[var(--brand-primary)] text-white text-[10px] font-bold rounded-sm flex items-center gap-1">
          <Zap className="w-3 h-3" />
          ENTRY ${setup.entry.toFixed(2)}
        </div>
      </div>

      {/* Stop level */}
      <div
        className="absolute left-0 right-0 flex items-center"
        style={{ top: `${getPosition(setup.stop)}%` }}
      >
        <div className={cn("flex-1 h-px", isLong ? "bg-red-500/50" : "bg-green-500/50")} />
        <div
          className={cn(
            "px-2 py-0.5 text-[10px] font-mono rounded-sm flex items-center gap-1",
            isLong ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
          )}
        >
          <Shield className="w-3 h-3" />
          STOP ${setup.stop.toFixed(2)}
        </div>
      </div>

      {/* Direction arrow */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        {isLong ? (
          <div className="flex flex-col items-center text-green-400/50">
            <TrendingUp className="w-6 h-6" />
            <span className="text-[10px] font-bold">LONG</span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-red-400/50">
            <TrendingDown className="w-6 h-6" />
            <span className="text-[10px] font-bold">SHORT</span>
          </div>
        )}
      </div>

      {/* Key levels indicators */}
      {expanded &&
        setup.keyLevels.map((level, idx) => (
          <div
            key={`key-${idx}`}
            className="absolute right-2 text-[9px] text-[var(--text-muted)]"
            style={{ top: `${getPosition(level.price)}%` }}
          >
            {level.label}
          </div>
        ))}
    </div>
  );
}

// Export compact version for quick view
export function HDSetupCard({ setup }: { setup: SetupScenario }) {
  const isLong = setup.direction === "long";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        "bg-[var(--surface-2)] border border-[var(--border-hairline)]"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isLong ? "bg-green-500/20" : "bg-red-500/20"
        )}
      >
        {isLong ? (
          <TrendingUp className="w-4 h-4 text-green-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-high)]">{setup.symbol}</span>
          <span
            className={cn(
              "text-[10px] font-bold px-1 rounded",
              isLong ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}
          >
            {setup.type.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">{setup.trigger}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-[var(--text-high)]">
          {setup.riskReward.toFixed(1)}:1
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">R:R</div>
      </div>
    </div>
  );
}
