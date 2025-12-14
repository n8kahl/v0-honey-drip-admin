/**
 * HDConfluenceRadar.tsx - Main container for the Confluence Radar view
 *
 * Features:
 * - List of confluence rows for each watchlist symbol
 * - Sort by: Overall score, alphabetical, "hottest first"
 * - Filter: Show all / Hot only / By style (scalp/day/swing)
 * - Auto-refresh indicator
 * - Toast notification when symbol hits threshold
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Filter, ArrowUpDown, Flame, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { HDConfluenceBuilderRow } from "./HDConfluenceBuilderRow";
import {
  useWatchlistConfluence,
  type SortMode,
  type FilterMode,
} from "../../../hooks/useWatchlistConfluence";
import { useNavigate } from "react-router-dom";
import { useMarketStore } from "../../../stores/marketStore";

// ============================================================================
// Types
// ============================================================================

interface HDConfluenceRadarProps {
  /** Callback when navigating to options chain */
  onViewChain?: (symbol: string) => void;
  /** Callback when loading a setup */
  onLoadSetup?: (symbol: string) => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function HDConfluenceRadar({ onViewChain, onLoadSetup, className }: HDConfluenceRadarProps) {
  const navigate = useNavigate();
  const setSelectedTicker = useMarketStore((state) => state.setSelectedTicker);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortMode>("score");
  const [filterBy, setFilterBy] = useState<FilterMode>("all");

  // Track previously ready symbols for toast notifications
  const [previousReadySymbols, setPreviousReadySymbols] = useState<Set<string>>(new Set());

  // Get watchlist confluence data
  const { symbols, hotSymbols, readySymbols, avgScore, isLoading, lastUpdated } =
    useWatchlistConfluence({ sortBy, filterBy });

  // Handle view chain click
  const handleViewChain = useCallback(
    (symbol: string) => {
      if (onViewChain) {
        onViewChain(symbol);
      } else {
        // Find symbol data for Ticker interface
        const symbolData = symbols.find((s) => s.symbol === symbol);
        const ticker = {
          id: symbol,
          symbol,
          last: symbolData?.price || 0,
          change: symbolData?.change || 0,
          changePercent: symbolData?.changePercent || 0,
        };
        setSelectedTicker(ticker);
        navigate("/trade");
      }
    },
    [onViewChain, setSelectedTicker, navigate, symbols]
  );

  // Handle load setup click
  const handleLoadSetup = useCallback(
    (symbol: string) => {
      if (onLoadSetup) {
        onLoadSetup(symbol);
      } else {
        // Find symbol data for Ticker interface
        const symbolData = symbols.find((s) => s.symbol === symbol);
        const ticker = {
          id: symbol,
          symbol,
          last: symbolData?.price || 0,
          change: symbolData?.change || 0,
          changePercent: symbolData?.changePercent || 0,
        };
        setSelectedTicker(ticker);
        navigate("/trade");
      }
    },
    [onLoadSetup, setSelectedTicker, navigate, symbols]
  );

  // Toast notifications for newly ready symbols
  useEffect(() => {
    const currentReadySet = new Set(readySymbols);

    // Find symbols that just became ready
    const newlyReady = readySymbols.filter((s) => !previousReadySymbols.has(s));

    if (newlyReady.length > 0 && previousReadySymbols.size > 0) {
      // Only toast if this isn't the initial load
      newlyReady.forEach((symbol) => {
        const symbolData = symbols.find((s) => s.symbol === symbol);
        if (symbolData) {
          toast.success(`${symbol} is READY!`, {
            description: `Score: ${symbolData.overallScore.toFixed(0)}/${symbolData.threshold} - ${symbolData.bestStyle.toUpperCase()} setup`,
            duration: 5000,
            action: {
              label: "View",
              onClick: () => handleViewChain(symbol),
            },
          });
        }
      });
    }

    setPreviousReadySymbols(currentReadySet);
  }, [readySymbols, symbols, previousReadySymbols, handleViewChain]);

  // Format last updated time
  const lastUpdatedText =
    lastUpdated > 0
      ? new Date(lastUpdated).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "Never";

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-high)]">Confluence Radar</h2>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            {readySymbols.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]">
                <Zap className="w-3 h-3" />
                <span className="font-bold">{readySymbols.length}</span>
                <span>ready</span>
              </div>
            )}
            {hotSymbols.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/10 text-amber-400">
                <Flame className="w-3 h-3" />
                <span className="font-bold">{hotSymbols.length}</span>
                <span>hot</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[var(--text-muted)]">
              <span>Avg:</span>
              <span className="font-mono font-bold tabular-nums">{avgScore.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Last Updated */}
          <div className="hidden md:flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
            <Clock className="w-3 h-3" />
            <span>{lastUpdatedText}</span>
          </div>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSortBy("score")}
                className={sortBy === "score" ? "bg-[var(--surface-2)]" : ""}
              >
                Score (highest first)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("hot")}
                className={sortBy === "hot" ? "bg-[var(--surface-2)]" : ""}
              >
                Hottest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("change")}
                className={sortBy === "change" ? "bg-[var(--surface-2)]" : ""}
              >
                Price change
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortBy("alphabetical")}
                className={sortBy === "alphabetical" ? "bg-[var(--surface-2)]" : ""}
              >
                Alphabetical
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                Filter
                {filterBy !== "all" && (
                  <span className="ml-1 px-1 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px]">
                    {filterBy}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setFilterBy("all")}
                className={filterBy === "all" ? "bg-[var(--surface-2)]" : ""}
              >
                Show all
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterBy("hot")}
                className={filterBy === "hot" ? "bg-[var(--surface-2)]" : ""}
              >
                Hot only
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setFilterBy("scalp")}
                className={filterBy === "scalp" ? "bg-[var(--surface-2)]" : ""}
              >
                Scalp setups
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterBy("day")}
                className={filterBy === "day" ? "bg-[var(--surface-2)]" : ""}
              >
                Day trade setups
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterBy("swing")}
                className={filterBy === "swing" ? "bg-[var(--surface-2)]" : ""}
              >
                Swing setups
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            <span className="ml-2 text-[var(--text-muted)]">Loading confluence data...</span>
          </div>
        ) : symbols.length === 0 && filterBy === "all" ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Flame className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium text-[var(--text-high)] mb-2">
              No symbols in watchlist
            </p>
            <p className="text-sm text-center max-w-md mb-4">
              Add symbols to your watchlist to see confluence data building up in real-time. The
              radar shows how close each symbol is to a trade setup.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              Go to Dashboard
            </Button>
          </div>
        ) : symbols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Filter className="w-8 h-8 mb-2 opacity-50" />
            <p>No symbols match current filter</p>
            <Button variant="link" size="sm" onClick={() => setFilterBy("all")} className="mt-2">
              Show all symbols
            </Button>
          </div>
        ) : (
          <div>
            {symbols.map((confluenceData) => (
              <HDConfluenceBuilderRow
                key={confluenceData.symbol}
                symbol={confluenceData.symbol}
                confluenceData={confluenceData}
                onViewChain={handleViewChain}
                onLoadSetup={handleLoadSetup}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with auto-refresh indicator */}
      <div className="flex items-center justify-center py-2 border-t border-[var(--border-hairline)] bg-[var(--surface-0)]">
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-positive)] animate-pulse" />
          <span>Live updates</span>
          <span>|</span>
          <span>{symbols.length} symbols</span>
        </div>
      </div>
    </div>
  );
}

export default HDConfluenceRadar;
