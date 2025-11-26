import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { HDCard } from "../common/HDCard";
import { HDChip } from "../common/HDChip";
import { formatPrice, formatPercent, formatTime, cn } from "../../../lib/utils";
import { TrendingUp, TrendingDown, Wifi } from "lucide-react";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { useTPProximity } from "../../../hooks/useTPProximity";
import { useTPSettings } from "../../../hooks/useTPSettings";
import { useAppToast } from "../../../hooks/useAppToast";
import { useOptionTrades, useOptionQuote } from "../../../hooks/useOptionsAdvanced";
import { HDConfluenceChips } from "../signals/HDConfluenceChips";
import { HDConfluenceDetailPanel } from "../dashboard/HDConfluenceDetailPanel";
import { useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { addTradeUpdate } from "../../../lib/supabase/database";
import { useMacroContext } from "../../../hooks/useIndicesAdvanced";
import { useNavigate } from "react-router-dom";

interface HDEnteredTradeCardProps {
  trade: Trade;
  direction: "call" | "put";
  onAutoTrim?: () => void;
}

export function HDEnteredTradeCard({
  trade,
  direction: _direction,
  onAutoTrim,
}: HDEnteredTradeCardProps) {
  const toast = useAppToast();
  const navigate = useNavigate();
  const { currentPrice, pnlPercent, asOf, source } = useActiveTradePnL(
    trade.contract.id,
    trade.entryPrice || trade.contract.mid
  );
  const { tpNearThreshold, autoOpenTrim } = useTPSettings();
  const tp = useTPProximity(trade, currentPrice, { threshold: tpNearThreshold });
  const { user } = useAuth();
  const { macro } = useMacroContext(30000);
  // One-shot toast when crossing the TP-near threshold
  useEffect(() => {
    if (tp.justCrossed && trade) {
      const pct = Math.min(99, Math.round(tp.progress * 100));
      const dte =
        trade.contract.daysToExpiry ??
        Math.max(
          0,
          Math.ceil(
            (new Date(trade.contract.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        );
      const confidence = undefined; // Removed: old signal system
      const macroSummary = macro
        ? `${macro.marketRegime} • ${macro.riskBias} bias • VIX ${macro.vix.level}`
        : undefined;
      const base = `${trade.ticker} ${trade.contract.strike}${trade.contract.type} is ${pct}% toward TP`;
      const pieces = [
        `DTE ${dte}`,
        confidence != null ? `setup ${Math.round(confidence)}%` : undefined,
        macroSummary,
      ].filter(Boolean);
      const description = pieces.join(" • ");
      toast.info(`Take Profit approaching`, {
        description: `${base}${description ? ` — ${description}` : ""}`,
        action:
          onAutoTrim && !autoOpenTrim
            ? {
                label: "Open Trim",
                onClick: () => onAutoTrim?.(),
              }
            : undefined,
      });
      if (onAutoTrim && autoOpenTrim) {
        // Auto-open trim composer
        onAutoTrim();
      }
      // Persist audit update if authenticated (non-blocking)
      if (user?.id) {
        addTradeUpdate(trade.id, user.id, {
          action: "tp_near",
          price: currentPrice ?? trade.contract.mid,
          notes: `TP near ${pct}%`,
        }).catch((e) => {
          console.warn("[v0] Failed to persist tp_near update:", e?.message || e);
        });
      }
    }
  }, [tp.justCrossed]);

  const { tradeTape } = useOptionTrades(trade.contract.id);
  const { quote, liquidity } = useOptionQuote(trade.contract.id, {
    ticker: trade.contract.id,
    strike_price: trade.contract.strike,
    expiration_date: trade.contract.expiry,
    contract_type: trade.contract.type === "C" ? "call" : "put",
    implied_volatility: trade.contract.iv,
    greeks: {
      delta: trade.contract.delta,
      gamma: trade.contract.gamma,
      theta: trade.contract.theta,
      vega: trade.contract.vega,
    },
    open_interest: trade.contract.openInterest,
    volume: trade.contract.volume,
    last_quote: {
      bid: trade.contract.bid,
      ask: trade.contract.ask,
    },
  });

  const isPositive = pnlPercent >= 0;

  // Format "as of" timestamp
  const getAsOfText = () => {
    const secondsAgo = Math.floor((Date.now() - asOf) / 1000);
    if (secondsAgo < 5) return "Live";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };

  // Chart is now rendered globally in the middle pane.

  return (
    <div
      onClick={() => navigate(`/trades/${trade.id}`)}
      className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-3 lg:p-4 space-y-3 cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
    >
      {/* Header Row - Compact */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-[var(--text-high)] font-medium">{trade.ticker}</h2>
            <HDTagTradeType type={trade.tradeType} />
          </div>
          <div className="text-[var(--text-muted)] text-xs">
            {trade.contract.strike}
            {trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
          </div>
        </div>

        {/* Right-side badges: P&L and TP proximity */}
        <div className="flex flex-col items-end gap-1">
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius)] flex-shrink-0",
              isPositive ? "bg-[var(--accent-positive)]/10" : "bg-[var(--accent-negative)]/10"
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-positive)]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-[var(--accent-negative)]" />
            )}
            <span
              className={cn(
                "font-semibold tabular-nums",
                isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}
            >
              {formatPercent(pnlPercent)}
            </span>
          </div>
          {/* TP Nearing badge */}
          {tp.nearing && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius)] bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />
              <span className="text-[10px] font-medium">
                TP near {Math.min(99, Math.round(tp.progress * 100))}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Wifi
              className={cn(
                "w-2.5 h-2.5",
                source === "websocket" ? "text-green-500" : "text-yellow-500"
              )}
            />
            <span>{getAsOfText()}</span>
          </div>
        </div>
      </div>

      {(tradeTape || liquidity) && (
        <HDConfluenceChips
          tradeTape={tradeTape}
          liquidity={
            liquidity
              ? {
                  quality: liquidity.quality,
                  spreadPercent: liquidity.spreadPercent,
                }
              : undefined
          }
        />
      )}

      {/* Confluence Detail Panel - Prioritized coaching data for active trades */}
      <HDConfluenceDetailPanel
        ticker={trade.ticker}
        direction={trade.contract.type === "C" ? "call" : "put"}
        contract={trade.contract}
        compact={true}
        tpProgress={tp.progress}
        isPositive={pnlPercent !== null && pnlPercent > 0}
      />

      {/* Tight 2×2 Levels Grid */}
      <div className="grid grid-cols-2 gap-2">
        {trade.entryPrice && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--border-hairline)]">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">
              Entry
            </div>
            <div className="text-[var(--text-high)] text-sm tabular-nums font-medium">
              ${formatPrice(trade.entryPrice)}
            </div>
          </div>
        )}

        {currentPrice && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--border-hairline)]">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">
              Current
            </div>
            <div className="text-[var(--text-high)] text-sm tabular-nums font-medium">
              ${formatPrice(currentPrice)}
            </div>
          </div>
        )}

        {trade.targetPrice && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--accent-positive)]/20">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">
              Target
            </div>
            <div className="text-[var(--accent-positive)] text-sm tabular-nums font-medium">
              ${formatPrice(trade.targetPrice)}
            </div>
          </div>
        )}

        {trade.stopLoss && (
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] px-2.5 py-2 border border-[var(--accent-negative)]/20">
            <div className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-0.5">
              Stop
            </div>
            <div className="text-[var(--accent-negative)] text-sm tabular-nums font-medium">
              ${formatPrice(trade.stopLoss)}
            </div>
          </div>
        )}
      </div>

      {/* Activity Timeline - Ultra Compact */}
      {trade.updates && trade.updates.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-hairline)]">
          <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-1.5">
            Activity
          </h3>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            {trade.updates
              .slice()
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 5)
              .map((update) => {
                const updateLabel =
                  {
                    enter: "Entered",
                    exit: "Exited",
                    trim: "Trimmed",
                    add: "Added",
                    "update-sl": "Updated SL",
                    "trail-stop": "Trail stop",
                    tp_near: "TP near",
                    update: "Update",
                  }[update.type] || update.type;

                const displayText = update.message || updateLabel;

                return (
                  <li key={update.id} className="flex justify-between gap-2 leading-tight">
                    <span className="truncate">
                      <span className="text-[var(--text-muted)]/70">
                        {formatTime(update.timestamp)}
                      </span>
                      <span className="mx-1">·</span>
                      <span>{displayText}</span>
                    </span>
                    {update.pnlPercent != null && (
                      <span
                        className={cn(
                          "tabular-nums font-medium flex-shrink-0",
                          update.pnlPercent >= 0
                            ? "text-[var(--accent-positive)]"
                            : "text-[var(--accent-negative)]"
                        )}
                      >
                        {update.pnlPercent >= 0 ? "+" : ""}
                        {update.pnlPercent.toFixed(1)}%
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
