/**
 * HDRadarScanner - Real-time composite signal scanner
 *
 * Displays active composite signals with filtering and sorting capabilities
 */

import { useState, useMemo } from "react";
import { useCompositeSignals } from "../../../hooks/useCompositeSignals";
import { CompositeSignalBadge } from "../signals/CompositeSignalBadge";
import { Search, SlidersHorizontal, TrendingUp, TrendingDown } from "lucide-react";
import type { CompositeSignal } from "../../../lib/composite/CompositeSignal";

interface HDRadarScannerProps {
  userId: string;
}

export function HDRadarScanner({ userId }: HDRadarScannerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [minScore, setMinScore] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  const { signals, activeSignals, loading, error } = useCompositeSignals({
    userId,
    autoSubscribe: true,
    autoExpire: true,
  });

  // Filter and sort signals
  const filteredSignals = useMemo(() => {
    let filtered = activeSignals;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((signal) =>
        signal.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Score filter
    filtered = filtered.filter((signal) => signal.baseScore >= minScore);

    // Sort by score (highest first)
    return filtered.sort((a, b) => b.baseScore - a.baseScore);
  }, [activeSignals, searchTerm, minScore]);

  // Group signals by ticker
  const signalsByTicker = useMemo(() => {
    const grouped = new Map<string, CompositeSignal[]>();
    filteredSignals.forEach((signal) => {
      const existing = grouped.get(signal.symbol) || [];
      grouped.set(signal.symbol, [...existing, signal]);
    });
    return grouped;
  }, [filteredSignals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--text-muted)]">Loading signals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--accent-negative)]">
          Error loading signals: {error?.message || String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-[var(--text-high)]">Signal Radar</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {filteredSignals.length} active signals • {signalsByTicker.size} tickers
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] transition-colors"
          title="Toggle filters"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4 space-y-3">
          <div>
            <label className="text-sm text-[var(--text-muted)] mb-1 block">Search Ticker</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="SPY, QQQ, AAPL..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--text-muted)] mb-1 block">
              Min Score: {minScore}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Signal List */}
      <div className="space-y-3">
        {signalsByTicker.size === 0 ? (
          <div className="text-center p-8 text-[var(--text-muted)]">
            No signals found matching your filters
          </div>
        ) : (
          Array.from(signalsByTicker.entries()).map(([ticker, tickerSignals]) => (
            <div
              key={ticker}
              className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-medium text-[var(--text-high)]">{ticker}</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {tickerSignals.length} {tickerSignals.length === 1 ? "signal" : "signals"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {tickerSignals[0].direction === "LONG" ? (
                    <TrendingUp className="w-5 h-5 text-[var(--accent-positive)]" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-[var(--accent-negative)]" />
                  )}
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {Math.round(tickerSignals[0].baseScore)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">Score</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <CompositeSignalBadge symbol={ticker} signals={tickerSignals} compact={false} />
              </div>

              {/* Opportunity type label */}
              <div className="mt-3 pt-3 border-t border-[var(--border-hairline)]">
                <p className="text-sm text-[var(--text-muted)]">
                  {tickerSignals[0].opportunityType.replace(/_/g, " ")} • R:R{" "}
                  {tickerSignals[0].riskReward.toFixed(1)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
