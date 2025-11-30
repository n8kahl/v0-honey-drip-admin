import React, { useMemo } from "react";
import { Trade } from "../../../types";
import { cn } from "../../../lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface HDGreeksMonitorProps {
  trade: Trade;
  compact?: boolean;
}

interface GreekDisplay {
  name: string;
  symbol: string;
  atEntry: number | undefined;
  current: number | undefined;
  change: number;
  changePercent: number;
  isPositive: boolean; // Is the change good for the trade?
  alert?: string;
}

/**
 * Determine if a Greek change is positive for the trade
 */
function isGreekChangePositive(greekName: string, change: number, isCall: boolean): boolean {
  switch (greekName) {
    case "delta":
      // For calls, higher delta = more directional exposure (good if in profit)
      // For puts, more negative delta = more exposure
      return isCall ? change > 0 : change < 0;
    case "gamma":
      // Higher gamma = delta changes faster (can be good or bad)
      // Generally positive when in profit
      return change > 0;
    case "theta":
      // Lower (less negative) theta is always better
      return change > 0; // Change > 0 means less decay
    case "vega":
      // Neutral - depends on IV direction
      return true;
    default:
      return true;
  }
}

/**
 * Get alert message for concerning Greek values
 */
function getGreekAlert(
  greekName: string,
  current: number,
  dte: number,
  tradeType: string
): string | undefined {
  switch (greekName) {
    case "delta":
      if (Math.abs(current) < 0.2) {
        return "Low delta - limited directional exposure";
      }
      if (Math.abs(current) > 0.85) {
        return "Deep ITM - consider taking profits";
      }
      break;
    case "gamma":
      if (current > 0.15 && dte <= 1) {
        return "High gamma risk near expiry";
      }
      break;
    case "theta":
      if (Math.abs(current) > 0.5 && dte <= 1 && tradeType !== "Scalp") {
        return "Rapid time decay - decide soon";
      }
      break;
    case "iv":
      // IV crush warning would need IV at entry comparison
      break;
  }
  return undefined;
}

export function HDGreeksMonitor({ trade, compact = false }: HDGreeksMonitorProps) {
  const contract = trade.contract;
  const isCall = contract.type === "C";
  const dte = contract.daysToExpiry ?? 0;

  // Get entry values (stored on trade) vs current values (from contract)
  const greeks = useMemo((): GreekDisplay[] => {
    const results: GreekDisplay[] = [];

    // Delta
    const deltaAtEntry = trade.deltaAtEntry;
    const deltaCurrent = contract.delta;
    if (deltaCurrent !== undefined) {
      const deltaChange = deltaAtEntry !== undefined ? deltaCurrent - deltaAtEntry : 0;
      const deltaChangePercent =
        deltaAtEntry && deltaAtEntry !== 0 ? (deltaChange / Math.abs(deltaAtEntry)) * 100 : 0;
      results.push({
        name: "Delta",
        symbol: "Δ",
        atEntry: deltaAtEntry,
        current: deltaCurrent,
        change: deltaChange,
        changePercent: deltaChangePercent,
        isPositive: isGreekChangePositive("delta", deltaChange, isCall),
        alert: getGreekAlert("delta", deltaCurrent, dte, trade.tradeType),
      });
    }

    // Gamma
    const gammaCurrent = contract.gamma;
    if (gammaCurrent !== undefined) {
      results.push({
        name: "Gamma",
        symbol: "Γ",
        atEntry: undefined, // Not tracked at entry currently
        current: gammaCurrent,
        change: 0,
        changePercent: 0,
        isPositive: true,
        alert: getGreekAlert("gamma", gammaCurrent, dte, trade.tradeType),
      });
    }

    // Theta
    const thetaCurrent = contract.theta;
    if (thetaCurrent !== undefined) {
      // Calculate theta per hour for day traders
      const thetaPerHour = thetaCurrent / 6.5;
      results.push({
        name: "Theta",
        symbol: "Θ",
        atEntry: undefined,
        current: thetaCurrent,
        change: 0,
        changePercent: 0,
        isPositive: true, // Theta is always negative, less negative is better
        alert: getGreekAlert("theta", thetaCurrent, dte, trade.tradeType),
      });
    }

    // Vega
    const vegaCurrent = contract.vega;
    if (vegaCurrent !== undefined) {
      results.push({
        name: "Vega",
        symbol: "V",
        atEntry: undefined,
        current: vegaCurrent,
        change: 0,
        changePercent: 0,
        isPositive: true,
      });
    }

    // IV (Implied Volatility)
    const ivAtEntry = trade.ivAtEntry;
    const ivCurrent = contract.iv;
    if (ivCurrent !== undefined) {
      const ivChange = ivAtEntry !== undefined ? ivCurrent - ivAtEntry : 0;
      const ivChangePercent = ivAtEntry && ivAtEntry !== 0 ? (ivChange / ivAtEntry) * 100 : 0;

      // IV crush is bad for long options
      const isIVCrush = ivChange < -5; // More than 5% IV drop
      const isIVExpansion = ivChange > 5;

      results.push({
        name: "IV",
        symbol: "%",
        atEntry: ivAtEntry ? ivAtEntry * 100 : undefined, // Convert to percentage
        current: ivCurrent * 100,
        change: ivChange * 100,
        changePercent: ivChangePercent,
        isPositive: !isIVCrush, // IV crush is bad
        alert: isIVCrush
          ? "IV crushing - hurting premium"
          : isIVExpansion
            ? "IV expanding - helping premium"
            : undefined,
      });
    }

    return results;
  }, [trade, contract, isCall, dte]);

  if (greeks.length === 0) {
    return null;
  }

  if (compact) {
    // Compact mode: single row of key metrics
    return (
      <div className="flex items-center gap-3 text-xs">
        {greeks.slice(0, 4).map((greek) => (
          <div key={greek.name} className="flex items-center gap-1">
            <span className="text-[var(--text-muted)]">{greek.symbol}</span>
            <span className="font-medium text-[var(--text-high)] tabular-nums">
              {greek.current?.toFixed(greek.name === "IV" ? 1 : 2)}
              {greek.name === "IV" && "%"}
            </span>
            {greek.change !== 0 && (
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  greek.isPositive
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {greek.change > 0 ? "↑" : "↓"}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Full mode: detailed grid
  return (
    <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] p-4">
      <h3 className="text-xs font-semibold text-[var(--text-high)] uppercase tracking-wide mb-3">
        Greeks Monitor
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {greeks.map((greek) => (
          <div
            key={greek.name}
            className={cn(
              "p-3 rounded border",
              greek.alert
                ? "bg-yellow-500/5 border-yellow-500/30"
                : "bg-[var(--surface-1)] border-[var(--border-hairline)]"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">{greek.name}</span>
              <span className="text-lg font-semibold text-[var(--text-high)]">{greek.symbol}</span>
            </div>

            <div className="text-lg font-bold text-[var(--text-high)] tabular-nums">
              {greek.current?.toFixed(greek.name === "IV" ? 1 : 2)}
              {greek.name === "IV" && "%"}
            </div>

            {greek.atEntry !== undefined && greek.change !== 0 && (
              <div className="flex items-center gap-1 mt-1">
                {greek.isPositive ? (
                  <TrendingUp className="w-3 h-3 text-[var(--accent-positive)]" />
                ) : greek.change !== 0 ? (
                  <TrendingDown className="w-3 h-3 text-[var(--accent-negative)]" />
                ) : (
                  <Minus className="w-3 h-3 text-[var(--text-muted)]" />
                )}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    greek.isPositive
                      ? "text-[var(--accent-positive)]"
                      : "text-[var(--accent-negative)]"
                  )}
                >
                  {greek.change > 0 ? "+" : ""}
                  {greek.change.toFixed(2)}
                  {greek.name === "IV" && "%"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  from {greek.atEntry?.toFixed(greek.name === "IV" ? 1 : 2)}
                </span>
              </div>
            )}

            {greek.alert && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-yellow-500">
                <AlertTriangle className="w-3 h-3" />
                <span>{greek.alert}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Theta per hour for day traders */}
      {trade.tradeType !== "Swing" && trade.tradeType !== "LEAP" && contract.theta && (
        <div className="mt-3 p-2 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Time Decay Rate</span>
            <span className="text-[var(--accent-negative)] font-medium tabular-nums">
              -${Math.abs(contract.theta / 6.5).toFixed(3)}/hour
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
