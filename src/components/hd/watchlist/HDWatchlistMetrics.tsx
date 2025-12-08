/**
 * HDWatchlistMetrics Component
 *
 * Admin-focused metrics panel showing:
 * - Data health (WebSocket status, staleness)
 * - Confluence breakdown (5 weighted components)
 * - Smart money flow (from historical warehouse)
 * - Gamma exposure context
 */

import { useState } from "react";
import { cn } from "../../../lib/utils";
import {
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";

interface HDWatchlistMetricsProps {
  symbol: string;
  /** Last bar timestamp in ms */
  lastBarTimestamp?: number;
  /** Data availability by timeframe */
  dataAvailability?: {
    "1m"?: boolean;
    "5m"?: boolean;
    "15m"?: boolean;
    "1h"?: boolean;
  };
  /** WebSocket connection status */
  wsStatus: "connected" | "fallback" | "disconnected";
  /** Confluence breakdown (0-100 for each component) */
  confluence?: {
    overall: number;
    trend: number;
    momentum: number;
    technical: number;
    volume: number;
    volatility: number;
    // Binary checks
    trendConfirmed: boolean;
    momentumConfirmed: boolean;
    vwapAligned: boolean;
    emaAligned: boolean;
    volumeAboveAvg: boolean;
  };
  /** Smart money flow summary */
  flowSummary?: {
    sweepCount: number;
    bullishSweeps: number;
    bearishSweeps: number;
    totalPremium: number;
    bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  };
  /** Gamma exposure context */
  gammaContext?: {
    dealerPositioning: "SHORT_GAMMA" | "LONG_GAMMA" | "NEUTRAL";
    resistanceLevel: number | null;
    supportLevel: number | null;
  };
}

export function HDWatchlistMetrics({
  symbol: _symbol,
  lastBarTimestamp,
  dataAvailability = {},
  wsStatus,
  confluence,
  flowSummary,
  gammaContext,
}: HDWatchlistMetricsProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate data staleness
  const isStale = lastBarTimestamp
    ? Date.now() - lastBarTimestamp > 5 * 60 * 1000 // 5 minutes
    : true;

  // WebSocket status color
  const wsStatusColor = {
    connected: "text-green-500",
    fallback: "text-yellow-500",
    disconnected: "text-red-500",
  }[wsStatus];

  const wsStatusText = {
    connected: "Live",
    fallback: "REST Fallback",
    disconnected: "Offline",
  }[wsStatus];

  // Confluence component scoring
  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const formatTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="px-3 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
      {/* Compact Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs hover:bg-[var(--surface-2)] -mx-1 px-1 py-1 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Data Health Icon */}
          <div
            className={cn("flex items-center gap-1", wsStatusColor)}
            title={`${wsStatusText}${isStale ? " (Stale)" : ""}`}
          >
            {wsStatus === "connected" ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {isStale && <AlertCircle className="w-3 h-3 text-red-500" />}
          </div>

          {/* Confluence Score */}
          {confluence && (
            <span className={cn("font-mono font-medium", getScoreColor(confluence.overall))}>
              {Math.round(confluence.overall)}
            </span>
          )}

          {/* Flow Bias */}
          {flowSummary && flowSummary.sweepCount > 0 && (
            <div
              className="flex items-center gap-1"
              title={`${flowSummary.sweepCount} sweeps (${flowSummary.bullishSweeps} bull, ${flowSummary.bearishSweeps} bear)`}
            >
              {flowSummary.bias === "BULLISH" ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : flowSummary.bias === "BEARISH" ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : (
                <Activity className="w-3 h-3 text-gray-500" />
              )}
              <span className="text-[10px] text-[var(--text-muted)]">{flowSummary.sweepCount}</span>
            </div>
          )}
        </div>

        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          {/* Data Health */}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] mb-1">Data Health</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>Connection:</span>
                <span className={wsStatusColor}>{wsStatusText}</span>
              </div>
              {lastBarTimestamp && (
                <div className="flex items-center justify-between">
                  <span>Last Update:</span>
                  <span className={isStale ? "text-red-500" : "text-[var(--text-high)]"}>
                    {formatTimeSince(lastBarTimestamp)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Data Availability */}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] mb-1">Timeframes</div>
            <div className="flex gap-2">
              {(["1m", "5m", "15m", "1h"] as const).map((tf) => (
                <div key={tf} className="flex items-center gap-1">
                  {dataAvailability[tf] ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-[10px]">{tf}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confluence Breakdown */}
          {confluence && (
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">
                Confluence (30/25/20/15/10)
              </div>
              <div className="space-y-1">
                <ConfluenceRow
                  label="Trend"
                  score={confluence.trend}
                  weight={30}
                  checked={confluence.trendConfirmed}
                />
                <ConfluenceRow
                  label="Momentum"
                  score={confluence.momentum}
                  weight={25}
                  checked={confluence.momentumConfirmed}
                  detail="RSI"
                />
                <ConfluenceRow
                  label="Technical"
                  score={confluence.technical}
                  weight={20}
                  checked={confluence.vwapAligned && confluence.emaAligned}
                  detail={`VWAP ${confluence.vwapAligned ? "✓" : "✗"} EMA ${confluence.emaAligned ? "✓" : "✗"}`}
                />
                <ConfluenceRow
                  label="Volume"
                  score={confluence.volume}
                  weight={15}
                  checked={confluence.volumeAboveAvg}
                  detail={confluence.volumeAboveAvg ? "> avg" : "< avg"}
                />
                <ConfluenceRow
                  label="Volatility"
                  score={confluence.volatility}
                  weight={10}
                  checked={true}
                />
              </div>
            </div>
          )}

          {/* Smart Money Flow */}
          {flowSummary && flowSummary.sweepCount > 0 && (
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">Smart Money (60min)</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{flowSummary.sweepCount} sweeps</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {flowSummary.bullishSweeps}↑ {flowSummary.bearishSweeps}↓ · $
                    {(flowSummary.totalPremium / 1000000).toFixed(1)}M
                  </div>
                </div>
                <div
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium",
                    flowSummary.bias === "BULLISH" && "bg-green-500/20 text-green-500",
                    flowSummary.bias === "BEARISH" && "bg-red-500/20 text-red-500",
                    flowSummary.bias === "NEUTRAL" && "bg-gray-500/20 text-gray-500"
                  )}
                >
                  {flowSummary.bias}
                </div>
              </div>
            </div>
          )}

          {/* Gamma Context */}
          {gammaContext && (
            <div>
              <div className="text-[10px] text-[var(--text-muted)] mb-1">Gamma Exposure</div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>Dealer:</span>
                  <span
                    className={cn(
                      "font-medium text-[10px]",
                      gammaContext.dealerPositioning === "SHORT_GAMMA" && "text-green-500",
                      gammaContext.dealerPositioning === "LONG_GAMMA" && "text-red-500"
                    )}
                  >
                    {gammaContext.dealerPositioning === "SHORT_GAMMA" && "📈 Bullish"}
                    {gammaContext.dealerPositioning === "LONG_GAMMA" && "📉 Bearish"}
                    {gammaContext.dealerPositioning === "NEUTRAL" && "➡️ Neutral"}
                  </span>
                </div>
                {(gammaContext.resistanceLevel || gammaContext.supportLevel) && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span>Walls:</span>
                    <span className="font-mono">
                      {gammaContext.supportLevel && `S: $${gammaContext.supportLevel.toFixed(0)}`}
                      {gammaContext.supportLevel && gammaContext.resistanceLevel && " | "}
                      {gammaContext.resistanceLevel &&
                        `R: $${gammaContext.resistanceLevel.toFixed(0)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for confluence rows
function ConfluenceRow({
  label,
  score,
  weight,
  checked,
  detail,
}: {
  label: string;
  score: number;
  weight: number;
  checked: boolean;
  detail?: string;
}) {
  const scoreColor =
    score >= 60 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex items-center gap-1">
        {checked ? (
          <CheckCircle className="w-3 h-3 text-green-500" />
        ) : (
          <XCircle className="w-3 h-3 text-red-500" />
        )}
        <span>
          {label} ({weight}%)
        </span>
        {detail && <span className="text-[var(--text-muted)]">· {detail}</span>}
      </div>
      <span className={cn("font-mono font-medium", scoreColor)}>{Math.round(score)}</span>
    </div>
  );
}
