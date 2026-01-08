/**
 * HDPanelFocusedTrade - Trade Context Panel
 *
 * Shows WHY we are watching this ticker with institutional-grade visualizations.
 * Displays flow analysis, gamma levels, and smart engine status.
 */

import { Trade, TradeState } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { formatPrice, formatPercent, formatTime, cn } from "../../../lib/utils";
import { TrendingUp, TrendingDown, Zap, Activity } from "lucide-react";
import { SmartScoreBadge, FlowPulse, GammaLevelsMap } from "../terminal";
import type { SymbolFeatures } from "../../../lib/strategy/engine";

interface HDPanelFocusedTradeProps {
  trade?: Trade;
  ticker?: string;
  state: TradeState;
  features?: SymbolFeatures;
  className?: string;
}

/**
 * Generate a smart context summary based on features
 */
function getContextSummary(features?: SymbolFeatures): string {
  if (!features) return "Loading market context...";

  const summaries: string[] = [];

  // Flow analysis
  const flowScore = features.flow?.institutionalConviction ?? features.flow?.flowScore ?? 0;
  const flowBias = features.flow?.flowBias;
  const sweepCount = features.flow?.sweepCount ?? 0;

  if (flowScore > 70) {
    summaries.push(
      `Strong ${flowBias ?? "directional"} flow detected (${flowScore.toFixed(0)}/100)`
    );
  } else if (sweepCount > 0) {
    summaries.push(`${sweepCount} sweep${sweepCount > 1 ? "s" : ""} detected`);
  }

  // Volume analysis
  const rvol = features.volume?.relativeToAvg ?? features.volume?.relative_to_avg ?? 1;
  if (rvol > 2) {
    summaries.push(`Volume ${rvol.toFixed(1)}x average`);
  }

  // Technical status
  const rsi14 = features.rsi?.["14"];
  if (rsi14 !== undefined) {
    if (rsi14 < 30) {
      summaries.push("RSI oversold - reversal zone");
    } else if (rsi14 > 70) {
      summaries.push("RSI overbought - reversal zone");
    }
  }

  if (summaries.length === 0) {
    return "Smart Engine: Analyzing conditions...";
  }

  return summaries.join(" | ");
}

export function HDPanelFocusedTrade({
  trade,
  ticker,
  state,
  features,
  className,
}: HDPanelFocusedTradeProps) {
  // WATCHING state with no trade - show placeholder
  if (state === "WATCHING" && !trade) {
    return (
      <div
        className={cn(
          "p-6 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]",
          className
        )}
      >
        <div className="text-center py-12">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-[var(--text-muted)]">
            {ticker
              ? `Select a contract to load an idea for ${ticker}`
              : "Select a ticker from the watchlist to start"}
          </p>
        </div>
      </div>
    );
  }

  // Calculate scores for display
  const flowScore = features?.flow?.institutionalConviction ?? features?.flow?.flowScore ?? 0;
  const isPositive = (trade?.movePercent || 0) >= 0;
  const contextSummary = getContextSummary(features);

  // Get gamma data for map
  const gammaData = {
    flipLevel: undefined as number | undefined, // Would come from gamma engine
    dealerNetDelta: features?.greeks?.delta,
    regime: features?.greeks?.delta
      ? features.greeks.delta > 0
        ? ("long_gamma" as const)
        : ("short_gamma" as const)
      : ("neutral" as const),
  };

  return (
    <div
      className={cn(
        "p-6 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] space-y-4",
        className
      )}
    >
      {/* Header with Smart Score */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-[var(--text-high)] text-xl font-semibold">
                {trade?.ticker ?? ticker}
              </h2>
              {trade && <HDTagTradeType type={trade.tradeType} />}
            </div>
            {trade?.contract && (
              <div className="text-[var(--text-muted)] text-sm">
                {trade.contract.strike}
                {trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
              </div>
            )}
          </div>
        </div>

        {/* Smart Score Badge */}
        <div className="flex items-center gap-3">
          <SmartScoreBadge score={flowScore} size="md" label="FLOW" />

          {state === "ENTERED" && trade?.movePercent !== undefined && (
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-[var(--accent-positive)]" />
              ) : (
                <TrendingDown className="w-5 h-5 text-[var(--accent-negative)]" />
              )}
              <span
                className={cn(
                  "text-xl tabular-nums font-semibold",
                  isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {formatPercent(trade.movePercent)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Context Summary Strip */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-muted/50">
        <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-sm text-muted-foreground">{contextSummary}</span>
      </div>

      {/* Flow & Gamma Visualization (Side by Side) */}
      {(state === "WATCHING" || state === "LOADED") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Flow Pulse */}
          <div className="p-4 bg-muted/20 rounded-lg border border-muted/30">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
              Options Flow
            </div>
            <FlowPulse flow={features?.flow} compact showLabels={false} />
          </div>

          {/* Gamma Levels Map */}
          <div className="p-4 bg-muted/20 rounded-lg border border-muted/30">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
              Gamma Exposure
            </div>
            <GammaLevelsMap
              currentPrice={features?.price?.current ?? trade?.currentPrice ?? 0}
              gamma={gammaData}
              compact
              showLabels={false}
            />
          </div>
        </div>
      )}

      {/* Price Grid - Only show for ENTERED state */}
      {state === "ENTERED" && trade && (
        <div className="grid grid-cols-4 gap-4 pt-2">
          {trade.entryPrice && (
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Entry</div>
              <div className="text-[var(--text-high)] tabular-nums font-medium">
                ${formatPrice(trade.entryPrice)}
              </div>
            </div>
          )}

          {trade.currentPrice && (
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Current</div>
              <div className="text-[var(--text-high)] tabular-nums font-medium">
                ${formatPrice(trade.currentPrice)}
              </div>
            </div>
          )}

          {trade.targetPrice && (
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Target</div>
              <div className="text-[var(--accent-positive)] tabular-nums font-medium">
                ${formatPrice(trade.targetPrice)}
              </div>
            </div>
          )}

          {trade.stopLoss && (
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Stop Loss</div>
              <div className="text-[var(--accent-negative)] tabular-nums font-medium">
                ${formatPrice(trade.stopLoss)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contract Details - Show for LOADED and ENTERED */}
      {trade?.contract && (state === "LOADED" || state === "ENTERED") && (
        <div className="pt-4 border-t border-[var(--border-hairline)]">
          <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-3">
            Contract Details
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Mid</div>
              <div className="text-[var(--text-high)] tabular-nums">
                ${formatPrice(trade.contract.mid)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Bid</div>
              <div className="text-[var(--text-high)] tabular-nums">
                ${formatPrice(trade.contract.bid)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Ask</div>
              <div className="text-[var(--text-high)] tabular-nums">
                ${formatPrice(trade.contract.ask)}
              </div>
            </div>
          </div>

          {/* Greeks */}
          {(trade.contract.delta ||
            trade.contract.gamma ||
            trade.contract.theta ||
            trade.contract.vega) && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              {trade.contract.delta !== undefined && (
                <div>
                  <div className="text-[var(--text-muted)] text-xs mb-1">Delta</div>
                  <div className="text-[var(--text-high)] tabular-nums">
                    {trade.contract.delta.toFixed(3)}
                  </div>
                </div>
              )}
              {trade.contract.gamma !== undefined && (
                <div>
                  <div className="text-[var(--text-muted)] text-xs mb-1">Gamma</div>
                  <div className="text-[var(--text-high)] tabular-nums">
                    {trade.contract.gamma.toFixed(3)}
                  </div>
                </div>
              )}
              {trade.contract.theta !== undefined && (
                <div>
                  <div className="text-[var(--text-muted)] text-xs mb-1">Theta</div>
                  <div className="text-[var(--text-high)] tabular-nums">
                    {trade.contract.theta.toFixed(3)}
                  </div>
                </div>
              )}
              {trade.contract.vega !== undefined && (
                <div>
                  <div className="text-[var(--text-muted)] text-xs mb-1">Vega</div>
                  <div className="text-[var(--text-high)] tabular-nums">
                    {trade.contract.vega.toFixed(3)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Volume & OI */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Volume</div>
              <div className="text-[var(--text-high)] tabular-nums">
                {trade.contract.volume.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-xs mb-1">Open Interest</div>
              <div className="text-[var(--text-high)] tabular-nums">
                {trade.contract.openInterest.toLocaleString()}
              </div>
            </div>
            {trade.contract.iv !== undefined && (
              <div>
                <div className="text-[var(--text-muted)] text-xs mb-1">IV</div>
                <div className="text-[var(--text-high)] tabular-nums">
                  {trade.contract.iv.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {trade?.updates && trade.updates.length > 0 && (
        <div className="pt-4 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Activity
          </h3>
          <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
            {trade.updates
              .slice()
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((update) => {
                const updateLabel = {
                  enter: "Entered position",
                  exit: "Exited position",
                  "light-trim": "Light trim",
                  "heavy-trim": "Heavy trim",
                  add: "Added",
                  "move-sl": "Moved SL",
                  update: "Update",
                }[update.type];

                const displayText = update.message || updateLabel;
                const priceText = ` at $${formatPrice(update.price)}`;

                return (
                  <li key={update.id} className="flex justify-between gap-2">
                    <span>
                      {formatTime(update.timestamp)} – {displayText}
                      {priceText}
                    </span>
                    {update.pnlPercent != null && (
                      <span
                        className={cn(
                          "tabular-nums",
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
