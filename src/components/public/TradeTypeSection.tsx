/**
 * TradeTypeSection.tsx - Grouped Trades by Type
 *
 * Displays trades grouped by type (Scalps, Day Trades, Swings, LEAPs)
 * in collapsible sections with trade cards.
 */

import { useState } from "react";
import { Flame, Target, TrendingUp, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveTradeCard, type PublicTrade } from "./LiveTradeCard";

// ============================================================================
// Types
// ============================================================================

type TradeType = "Scalp" | "Day" | "Swing" | "LEAP";

interface TradeTypeSectionProps {
  trades: PublicTrade[];
  onViewDetails?: (trade: PublicTrade) => void;
  onShare?: (trade: PublicTrade) => void;
}

interface GroupedTrades {
  Scalp: PublicTrade[];
  Day: PublicTrade[];
  Swing: PublicTrade[];
  LEAP: PublicTrade[];
}

// ============================================================================
// Type Config
// ============================================================================

const TYPE_CONFIG: Record<TradeType, {
  icon: typeof Flame;
  label: string;
  pluralLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  Scalp: {
    icon: Flame,
    label: "SCALPS",
    pluralLabel: "Scalps",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/30",
  },
  Day: {
    icon: Target,
    label: "DAY TRADES",
    pluralLabel: "Day Trades",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/30",
  },
  Swing: {
    icon: TrendingUp,
    label: "SWINGS",
    pluralLabel: "Swings",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/30",
  },
  LEAP: {
    icon: BarChart3,
    label: "LEAPS",
    pluralLabel: "LEAPs",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/30",
  },
};

// ============================================================================
// Component
// ============================================================================

export function TradeTypeSection({ trades, onViewDetails, onShare }: TradeTypeSectionProps) {
  // Group trades by type
  const grouped: GroupedTrades = {
    Scalp: trades.filter((t) => t.trade_type === "Scalp"),
    Day: trades.filter((t) => t.trade_type === "Day"),
    Swing: trades.filter((t) => t.trade_type === "Swing"),
    LEAP: trades.filter((t) => t.trade_type === "LEAP"),
  };

  // Order types by count (most trades first), but always show types with trades
  const orderedTypes = (Object.keys(TYPE_CONFIG) as TradeType[])
    .filter((type) => grouped[type].length > 0)
    .sort((a, b) => grouped[b].length - grouped[a].length);

  if (orderedTypes.length === 0) {
    return (
      <div className="p-8 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
        <p className="text-[var(--text-muted)]">No active trades right now. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orderedTypes.map((type) => (
        <TypeGroup
          key={type}
          type={type}
          trades={grouped[type]}
          onViewDetails={onViewDetails}
          onShare={onShare}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Type Group Component
// ============================================================================

interface TypeGroupProps {
  type: TradeType;
  trades: PublicTrade[];
  onViewDetails?: (trade: PublicTrade) => void;
  onShare?: (trade: PublicTrade) => void;
}

function TypeGroup({ type, trades, onViewDetails, onShare }: TypeGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        config.borderColor,
        config.bgColor
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "hover:bg-black/5 transition-colors"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn("w-5 h-5", config.color)} />
          <span className={cn("font-semibold", config.color)}>
            {config.label}
          </span>
          <span className="text-sm text-[var(--text-muted)]">
            ({trades.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
        )}
      </button>

      {/* Trade Cards */}
      {isExpanded && (
        <div className="p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trades.map((trade) => (
              <LiveTradeCard
                key={trade.id}
                trade={trade}
                onViewDetails={onViewDetails}
                onShare={onShare}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Flat List Alternative (No Grouping)
// ============================================================================

interface TradeListProps {
  trades: PublicTrade[];
  title?: string;
  onViewDetails?: (trade: PublicTrade) => void;
  onShare?: (trade: PublicTrade) => void;
}

export function TradeList({ trades, title, onViewDetails, onShare }: TradeListProps) {
  if (trades.length === 0) {
    return (
      <div className="p-8 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
        <p className="text-[var(--text-muted)]">No trades to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-lg font-semibold text-[var(--text-high)]">{title}</h3>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {trades.map((trade) => (
          <LiveTradeCard
            key={trade.id}
            trade={trade}
            onViewDetails={onViewDetails}
            onShare={onShare}
          />
        ))}
      </div>
    </div>
  );
}

export default TradeTypeSection;
