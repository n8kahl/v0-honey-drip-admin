/**
 * KCU Trade Card Component
 *
 * Displays a KCU LTP (Levels, Trends, Patience) trade setup with:
 * - Key Levels (King/Queen confluence)
 * - Trend status (with MTF alignment)
 * - Patience Candle indicator
 * - Entry/Stop/Target levels
 * - Bid/Ask threshold confirmation status
 */

import { Trade } from "../../../types";
import { HDCard } from "../common/HDCard";
import { HDButton } from "../common/HDButton";
import { formatPrice } from "../../../lib/utils";
import type {
  KCUTradeSetup,
  KCULevel,
  LTPTrend,
  LTPPatienceCandle,
  KCUSetupQuality,
  BidAskStatus,
} from "../../../lib/composite/detectors/kcu/types";

interface HDKCUTradeCardProps {
  trade: Trade;
  setup: KCUTradeSetup;
  bidAskStatus?: BidAskStatus;
  onEnter: () => void;
  onDiscard: () => void;
  underlyingPrice?: number;
}

/**
 * Quality badge colors
 */
function getQualityColor(quality: KCUSetupQuality): string {
  switch (quality) {
    case "A+":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "A":
      return "text-green-400 bg-green-500/10 border-green-500/30";
    case "B":
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "Avoid":
      return "text-red-400 bg-red-500/10 border-red-500/30";
    default:
      return "text-[var(--text-muted)] bg-[var(--bg-subtle)]";
  }
}

/**
 * Trend direction indicator
 */
function TrendIndicator({ trend }: { trend: LTPTrend }) {
  const isUp = trend.direction === "UPTREND";
  const isDown = trend.direction === "DOWNTREND";
  const isChop = trend.direction === "CHOP";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
          isUp
            ? "text-emerald-400 bg-emerald-500/10"
            : isDown
              ? "text-red-400 bg-red-500/10"
              : "text-amber-400 bg-amber-500/10"
        }`}
      >
        {isUp && "↑ UPTREND"}
        {isDown && "↓ DOWNTREND"}
        {isChop && "↔ CHOP"}
      </div>
      <span className="text-[var(--text-muted)] text-[10px]">{trend.strength}% strength</span>
    </div>
  );
}

/**
 * MTF Alignment indicator
 */
function MTFAlignmentBar({ trend }: { trend: LTPTrend }) {
  const timeframes = ["1m", "5m", "15m", "60m"] as const;

  return (
    <div className="flex items-center gap-1">
      {timeframes.map((tf) => {
        const dir = trend.mtfAlignment[tf];
        const isUp = dir === "UPTREND";
        const isDown = dir === "DOWNTREND";
        return (
          <div
            key={tf}
            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-medium ${
              isUp
                ? "text-emerald-400 bg-emerald-500/10"
                : isDown
                  ? "text-red-400 bg-red-500/10"
                  : "text-[var(--text-muted)] bg-[var(--bg-subtle)]"
            }`}
            title={`${tf}: ${dir}`}
          >
            {tf.replace("m", "")}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Patience Candle indicator
 */
function PatienceCandleIndicator({ patienceCandle }: { patienceCandle: LTPPatienceCandle }) {
  if (!patienceCandle.detected) {
    return (
      <div className="text-[var(--text-muted)] text-xs flex items-center gap-1">
        <span className="text-amber-400">⏳</span>
        Waiting for patience candle...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${getQualityColor(
          patienceCandle.quality
        )}`}
      >
        {patienceCandle.quality}
      </span>
      <span className="text-[var(--text-muted)] text-[10px]">
        {patienceCandle.isInsideBar ? "Inside Bar" : "Consolidation"} •{" "}
        {patienceCandle.containedCount} bars
      </span>
    </div>
  );
}

/**
 * Bid/Ask confirmation progress
 */
function BidAskConfirmation({ status }: { status?: BidAskStatus }) {
  if (!status) {
    return <div className="text-[var(--text-muted)] text-xs">Bid/Ask monitoring not active</div>;
  }

  const { isConfirmed, confirmationProgress, currentSpreadPercent, warnings } = status;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-medium)] text-xs">Bid/Ask Threshold</span>
        <span
          className={`text-xs font-medium ${isConfirmed ? "text-emerald-400" : "text-amber-400"}`}
        >
          {isConfirmed ? "✓ Confirmed" : `${confirmationProgress.toFixed(0)}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isConfirmed ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${confirmationProgress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>Spread: {currentSpreadPercent.toFixed(2)}%</span>
        {warnings.length > 0 && <span className="text-amber-400">{warnings[0]}</span>}
      </div>
    </div>
  );
}

/**
 * Main KCU Trade Card Component
 */
export function HDKCUTradeCard({
  trade,
  setup,
  bidAskStatus,
  onEnter,
  onDiscard,
  underlyingPrice,
}: HDKCUTradeCardProps) {
  const currentPrice = underlyingPrice ?? setup.entry.price;

  // Get key levels to display (top 5 nearest)
  const nearestLevels = setup.levels.all
    .sort((a, b) => a.distancePercent - b.distancePercent)
    .slice(0, 5);

  // Check if entry is allowed (bid/ask confirmed or not monitoring)
  const canEnter = !bidAskStatus || bidAskStatus.isConfirmed;

  return (
    <div className="space-y-3">
      {/* Header - Strategy & Quality */}
      <HDCard>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-[var(--text-high)] font-semibold text-lg">{trade.ticker}</h2>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium border ${getQualityColor(
                  setup.quality
                )}`}
              >
                {setup.quality} Setup
              </span>
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              {setup.strategyType.replace("kcu_", "").replace(/_/g, " ").toUpperCase()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[var(--text-high)] tabular-nums font-medium">
              ${formatPrice(currentPrice)}
            </div>
            <div className="text-[var(--text-muted)] text-[10px]">
              R:R {setup.riskReward.toFixed(1)}:1
            </div>
          </div>
        </div>
      </HDCard>

      {/* L - Levels Section */}
      <HDCard>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📊</span>
          <h3 className="text-[var(--text-high)] font-medium text-sm">Key Levels</h3>
          {setup.levels.kingQueen && (
            <span className="text-amber-400 text-xs flex items-center gap-1">♔♛ King & Queen</span>
          )}
        </div>

        <div className="space-y-1">
          {nearestLevels.map((level, i) => {
            const isNear = level.distancePercent < 0.3;
            const isAbove = level.price > currentPrice;
            return (
              <div
                key={i}
                className={`flex items-center justify-between py-1 px-2 rounded text-xs ${
                  isNear ? "bg-[var(--bg-subtle)]" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {level.isQueen && (
                    <span className="text-amber-400" title="Queen level">
                      ♛
                    </span>
                  )}
                  {level.type === "VWAP" && (
                    <span className="text-white" title="King (VWAP)">
                      ♔
                    </span>
                  )}
                  <span className="text-[var(--text-medium)]">{level.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-high)] tabular-nums font-medium">
                    ${formatPrice(level.price)}
                  </span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      isAbove ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isAbove ? "+" : ""}
                    {level.distancePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </HDCard>

      {/* T - Trend Section */}
      <HDCard>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📈</span>
          <h3 className="text-[var(--text-high)] font-medium text-sm">Trend</h3>
        </div>

        <div className="space-y-3">
          <TrendIndicator trend={setup.trend} />

          <div>
            <div className="text-[var(--text-muted)] text-[10px] mb-1">
              Multi-Timeframe Alignment
            </div>
            <MTFAlignmentBar trend={setup.trend} />
          </div>

          {setup.trend.orbBroken !== "NONE" && (
            <div className="text-xs text-[var(--text-medium)]">
              ORB {setup.trend.orbBroken === "HIGH" ? "High" : "Low"} broken
            </div>
          )}
        </div>
      </HDCard>

      {/* P - Patience Candle Section */}
      <HDCard>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⏳</span>
          <h3 className="text-[var(--text-high)] font-medium text-sm">Patience Candle</h3>
        </div>

        <PatienceCandleIndicator patienceCandle={setup.patienceCandle} />

        {setup.patienceCandle.detected && (
          <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-3">
            <div>
              <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
                Long Break
              </div>
              <div className="text-emerald-400 tabular-nums font-medium">
                ${formatPrice(setup.patienceCandle.entryTrigger.longBreak)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
                Short Break
              </div>
              <div className="text-red-400 tabular-nums font-medium">
                ${formatPrice(setup.patienceCandle.entryTrigger.shortBreak)}
              </div>
            </div>
          </div>
        )}
      </HDCard>

      {/* Entry/Risk Section */}
      <HDCard>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎯</span>
          <h3 className="text-[var(--text-high)] font-medium text-sm">Trade Plan</h3>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Entry
            </div>
            <div className="text-[var(--text-high)] tabular-nums font-medium">
              ${formatPrice(setup.entry.price)}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Stop Loss
            </div>
            <div className="text-red-400 tabular-nums font-medium">
              ${formatPrice(setup.risk.stopLoss)}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] text-[10px] uppercase tracking-wide mb-1">
              Target 1
            </div>
            <div className="text-emerald-400 tabular-nums font-medium">
              ${formatPrice(setup.targets.T1.price)}
            </div>
          </div>
        </div>

        <div className="text-[var(--text-muted)] text-[10px]">
          Stop: {setup.risk.stopReason} • Target: {setup.targets.T1.reason}
        </div>
      </HDCard>

      {/* Bid/Ask Confirmation */}
      {bidAskStatus && (
        <HDCard>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📡</span>
            <h3 className="text-[var(--text-high)] font-medium text-sm">Entry Confirmation</h3>
          </div>
          <BidAskConfirmation status={bidAskStatus} />
        </HDCard>
      )}

      {/* Confluence Scores */}
      <HDCard>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔀</span>
          <h3 className="text-[var(--text-high)] font-medium text-sm">L-T-P Confluence</h3>
          <span className="text-[var(--text-high)] font-semibold">
            {setup.confluence.totalScore.toFixed(0)}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)]">Levels</div>
            <div className="text-sm font-medium text-[var(--text-high)]">
              {setup.confluence.levelScore.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)]">Trend</div>
            <div className="text-sm font-medium text-[var(--text-high)]">
              {setup.confluence.trendScore.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)]">Patience</div>
            <div className="text-sm font-medium text-[var(--text-high)]">
              {setup.confluence.patienceScore.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)]">Volume</div>
            <div className="text-sm font-medium text-[var(--text-high)]">
              {setup.confluence.volumeScore.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)]">Session</div>
            <div className="text-sm font-medium text-[var(--text-high)]">
              {setup.confluence.sessionScore.toFixed(0)}
            </div>
          </div>
        </div>
      </HDCard>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <HDButton variant="secondary" onClick={onDiscard} className="flex-1">
          Discard
        </HDButton>
        <HDButton
          variant="primary"
          onClick={onEnter}
          disabled={!canEnter}
          className="flex-1"
          title={!canEnter ? "Waiting for bid/ask confirmation (5 seconds)" : undefined}
        >
          {canEnter ? "Enter Trade" : "Confirming..."}
        </HDButton>
      </div>
    </div>
  );
}
