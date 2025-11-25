/**
 * HDMarketCountdown - Market session countdown with futures snapshot
 *
 * Displays time until next trading session with key index data
 * Designed for options day traders during off-hours prep
 */

import { useOffHoursData } from "../../../hooks/useOffHoursData";
import { cn } from "../../../lib/utils";
import { Clock, TrendingUp, TrendingDown, Activity, AlertTriangle, RefreshCw } from "lucide-react";

interface HDMarketCountdownProps {
  className?: string;
  compact?: boolean;
}

export function HDMarketCountdown({ className, compact = false }: HDMarketCountdownProps) {
  const { countdown, futures, session, isOffHours, refresh, loading } = useOffHoursData();

  // During market hours, show minimal indicator
  if (!isOffHours) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-green-500/10 border border-green-500/20",
          className
        )}
      >
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium text-green-400">Market Open</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg",
          "bg-[var(--surface-1)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <Clock className="w-4 h-4 text-[var(--brand-primary)]" />
        <div className="flex-1">
          <div className="text-xs text-[var(--text-muted)]">{countdown.nextSessionLabel}</div>
          <div className="text-lg font-bold text-[var(--text-high)] font-mono">
            {countdown.timeRemaining}
          </div>
        </div>
        {futures && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "font-mono",
                futures.es.changePercent >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              ES {futures.es.changePercent >= 0 ? "+" : ""}
              {futures.es.changePercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden",
        "bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)]",
        "border border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                session === "PRE" && "bg-yellow-500/20",
                session === "POST" && "bg-blue-500/20",
                session === "CLOSED" && "bg-[var(--surface-2)]"
              )}
            >
              <Clock
                className={cn(
                  "w-5 h-5",
                  session === "PRE" && "text-yellow-400",
                  session === "POST" && "text-blue-400",
                  session === "CLOSED" && "text-[var(--text-muted)]"
                )}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-high)]">
                {session === "PRE" && "Pre-Market Session"}
                {session === "POST" && "After-Hours Session"}
                {session === "CLOSED" && "Market Closed"}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                {countdown.nextSessionLabel} opens in
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className={cn(
              "p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors",
              loading && "animate-spin"
            )}
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="px-6 py-6 text-center">
        <div className="text-5xl font-bold font-mono text-[var(--text-high)] tracking-tight">
          {countdown.timeRemaining}
        </div>
        <div className="mt-2 text-sm text-[var(--text-muted)]">
          {countdown.nextSessionTime.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}{" "}
          at{" "}
          {countdown.nextSessionTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      </div>

      {/* Futures Snapshot */}
      {futures && (
        <div className="px-6 py-4 border-t border-[var(--border-hairline)] bg-[var(--surface-1)]/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Index Snapshot
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {futures.isDelayed && "(Delayed) "}as of {futures.asOf}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* ES / S&P 500 */}
            <FuturesCard
              label="ES (SPX)"
              value={futures.es.value}
              change={futures.es.change}
              changePercent={futures.es.changePercent}
            />

            {/* NQ / Nasdaq */}
            <FuturesCard
              label="NQ (NDX)"
              value={futures.nq.value}
              change={futures.nq.change}
              changePercent={futures.nq.changePercent}
            />

            {/* VIX */}
            <VixCard
              value={futures.vix.value}
              change={futures.vix.change}
              level={futures.vix.level}
            />
          </div>
        </div>
      )}

      {/* Session Tips */}
      <div className="px-6 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]/50">
        <SessionTip session={session} futures={futures} />
      </div>
    </div>
  );
}

// Futures mini-card
function FuturesCard({
  label,
  value,
  change,
  changePercent,
}: {
  label: string;
  value: number;
  change: number;
  changePercent: number;
}) {
  const isPositive = change >= 0;

  return (
    <div className="text-center">
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-lg font-bold text-[var(--text-high)] font-mono">
        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div
        className={cn(
          "flex items-center justify-center gap-1 text-sm font-medium",
          isPositive ? "text-green-400" : "text-red-400"
        )}
      >
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>
          {isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// VIX card with level indicator
function VixCard({
  value,
  change,
  level,
}: {
  value: number;
  change: number;
  level: "low" | "normal" | "elevated" | "high";
}) {
  const levelConfig = {
    low: { color: "text-green-400", bg: "bg-green-500/20", label: "Low Vol" },
    normal: { color: "text-blue-400", bg: "bg-blue-500/20", label: "Normal" },
    elevated: { color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Elevated" },
    high: { color: "text-red-400", bg: "bg-red-500/20", label: "High Vol" },
  };

  const config = levelConfig[level];

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] mb-1">
        <Activity className="w-3 h-3" />
        VIX
      </div>
      <div className="text-lg font-bold text-[var(--text-high)] font-mono">{value.toFixed(2)}</div>
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium mt-1",
          config.bg,
          config.color
        )}
      >
        {level === "high" && <AlertTriangle className="w-3 h-3" />}
        {config.label}
      </div>
    </div>
  );
}

// Session-specific tips
function SessionTip({
  session,
  futures,
}: {
  session: string;
  futures: ReturnType<typeof useOffHoursData>["futures"];
}) {
  let tip = "";
  let icon = null;

  if (session === "CLOSED") {
    // Weekend tips
    const esChange = futures?.es.changePercent || 0;
    const vixLevel = futures?.vix.level || "normal";

    if (vixLevel === "high") {
      tip = "VIX elevated - expect wider spreads at open. Consider reducing size.";
      icon = <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    } else if (Math.abs(esChange) > 1) {
      tip = `Futures ${esChange > 0 ? "up" : "down"} ${Math.abs(esChange).toFixed(1)}% - watch for gap plays at open.`;
      icon =
        esChange > 0 ? (
          <TrendingUp className="w-4 h-4 text-green-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        );
    } else {
      tip = "Review key levels and plan setups for next session.";
      icon = <Clock className="w-4 h-4 text-[var(--brand-primary)]" />;
    }
  } else if (session === "PRE") {
    tip = "Pre-market active - watch for early movers and gap setups.";
    icon = <Activity className="w-4 h-4 text-yellow-400" />;
  } else if (session === "POST") {
    tip = "After-hours - review today's trades and prep for tomorrow.";
    icon = <Clock className="w-4 h-4 text-blue-400" />;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
      {icon}
      <span>{tip}</span>
    </div>
  );
}
