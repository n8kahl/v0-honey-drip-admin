import React, { useMemo, useState, useEffect } from "react";
import { Trade, TradeType } from "../../../types";
import { cn, formatPrice, formatPercent } from "../../../lib/utils";
import { normalizeSymbolForAPI, isIndex } from "../../../lib/symbolUtils";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
  AlertTriangle,
  Activity,
  Zap,
  ChevronRight,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Brain,
  BarChart3,
  HeartPulse,
  FileCheck,
} from "lucide-react";
import { useActiveTradePnL } from "../../../hooks/useMassiveData";
import { useKeyLevels } from "../../../hooks/useKeyLevels";
import { useMacroContext } from "../../../hooks/useIndicesAdvanced";
import { useThesisValidation } from "../../../hooks/useThesisValidation";
import { useAITradeCoach } from "../../../hooks/useAITradeCoach";
import { HDEnteredTradeCard } from "../cards/HDEnteredTradeCard";
import { HDGreeksMonitor } from "./HDGreeksMonitor";
import { AICoachPanel } from "../ai/AICoachPanel";

interface HDActiveTradePanelProps {
  trade: Trade;
  onAutoTrim?: () => void;
  onTrim?: () => void;
  onTrailStop?: () => void;
  onMoveSL?: () => void;
  onAdd?: () => void;
  onExit?: () => void;
}

/**
 * Calculate position health score (0-100)
 * Based on: thesis validity, technical alignment, Greeks health, market context
 */
function calculatePositionHealth(
  trade: Trade,
  pnlPercent: number,
  currentPrice: number,
  vixLevel?: number
): { score: number; status: "healthy" | "warning" | "danger"; factors: string[] } {
  let score = 50; // Base score
  const factors: string[] = [];

  // P&L Factor (0-25 points)
  if (pnlPercent > 20) {
    score += 25;
    factors.push("Strong profit");
  } else if (pnlPercent > 5) {
    score += 15;
    factors.push("In profit");
  } else if (pnlPercent > -5) {
    score += 5;
    factors.push("Breakeven zone");
  } else if (pnlPercent > -15) {
    factors.push("Small drawdown");
  } else {
    score -= 15;
    factors.push("Significant drawdown");
  }

  // Target proximity (0-15 points)
  if (trade.targetPrice && trade.entryPrice && currentPrice) {
    const targetProgress =
      (currentPrice - trade.entryPrice) / (trade.targetPrice - trade.entryPrice);
    if (targetProgress > 0.8) {
      score += 15;
      factors.push("Near target");
    } else if (targetProgress > 0.5) {
      score += 10;
      factors.push("Halfway to target");
    } else if (targetProgress > 0) {
      score += 5;
    }
  }

  // Stop loss distance (0-10 points)
  if (trade.stopLoss && currentPrice) {
    const stopDistance = Math.abs(currentPrice - trade.stopLoss) / currentPrice;
    if (stopDistance > 0.15) {
      score += 10;
      factors.push("Safe from stop");
    } else if (stopDistance > 0.05) {
      score += 5;
    } else {
      score -= 10;
      factors.push("Near stop loss");
    }
  }

  // VIX stability (-5 to +5)
  if (vixLevel !== undefined) {
    if (vixLevel < 15) {
      score += 5;
    } else if (vixLevel > 25) {
      score -= 5;
      factors.push("Elevated VIX");
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const status = score >= 70 ? "healthy" : score >= 40 ? "warning" : "danger";

  return { score, status, factors };
}

/**
 * Get time pressure info based on DTE and trade type
 */
function getTimePressure(trade: Trade): {
  timeLeft: string;
  thetaPerHour: number;
  urgency: "low" | "medium" | "high" | "critical";
  message: string;
} {
  const dte = trade.contract.daysToExpiry ?? 0;
  const theta = trade.contract.theta ?? 0;

  // Calculate hours remaining (rough estimate)
  const now = new Date();
  const marketClose = new Date();
  marketClose.setHours(16, 0, 0, 0); // 4 PM ET

  let hoursRemaining: number;
  if (dte === 0) {
    // 0DTE - calculate hours until market close
    hoursRemaining = Math.max(0, (marketClose.getTime() - now.getTime()) / (1000 * 60 * 60));
  } else {
    // Multi-day - use trading hours (6.5 hours per day)
    hoursRemaining = dte * 6.5;
  }

  // Theta per hour (theta is typically per day)
  const thetaPerHour = Math.abs(theta) / 6.5;

  // Format time left
  let timeLeft: string;
  if (hoursRemaining < 1) {
    timeLeft = `${Math.round(hoursRemaining * 60)}m`;
  } else if (hoursRemaining < 24) {
    timeLeft = `${hoursRemaining.toFixed(1)}h`;
  } else {
    timeLeft = `${Math.ceil(hoursRemaining / 6.5)}d`;
  }

  // Determine urgency based on trade type and time
  let urgency: "low" | "medium" | "high" | "critical";
  let message: string;

  if (trade.tradeType === "Scalp") {
    // Scalps: time doesn't matter much, it's about momentum
    urgency = "low";
    message = "Focus on momentum, not time";
  } else if (dte === 0) {
    if (hoursRemaining < 1) {
      urgency = "critical";
      message = "Final hour - decide now";
    } else if (hoursRemaining < 2) {
      urgency = "high";
      message = "Theta accelerating rapidly";
    } else {
      urgency = "medium";
      message = "0DTE - monitor closely";
    }
  } else if (dte <= 2) {
    urgency = "medium";
    message = "Short-dated, theta significant";
  } else {
    urgency = "low";
    message = "Time decay manageable";
  }

  return { timeLeft, thetaPerHour, urgency, message };
}

/**
 * Get trade style specific configuration
 */
function getStyleConfig(tradeType: TradeType): {
  focusMetrics: string[];
  chartTimeframes: string[];
  targetRange: string;
} {
  switch (tradeType) {
    case "Scalp":
      return {
        focusMetrics: ["Momentum", "Volume", "Spread"],
        chartTimeframes: ["1m", "5m"],
        targetRange: "5-15%",
      };
    case "Day":
      return {
        focusMetrics: ["VWAP", "Volume", "Theta"],
        chartTimeframes: ["5m", "15m"],
        targetRange: "15-50%",
      };
    case "Swing":
      return {
        focusMetrics: ["Trend", "IV Rank", "Theta/Day"],
        chartTimeframes: ["15m", "1h"],
        targetRange: "50-200%",
      };
    case "LEAP":
      return {
        focusMetrics: ["Delta", "IV Rank", "Underlying Trend"],
        chartTimeframes: ["1h", "4h"],
        targetRange: "100%+",
      };
    default:
      return {
        focusMetrics: ["P&L", "Risk"],
        chartTimeframes: ["5m", "15m"],
        targetRange: "Variable",
      };
  }
}

export function HDActiveTradePanel({
  trade,
  onAutoTrim,
  onTrim,
  onTrailStop,
  onMoveSL,
  onAdd,
  onExit,
}: HDActiveTradePanelProps) {
  // AI Coach state
  const [showCoach, setShowCoach] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // AI Coach hook
  const aiCoach = useAITradeCoach({ enableVoice: voiceEnabled });

  // Start AI coach session when panel opens
  useEffect(() => {
    if (showCoach && !aiCoach.state.isActive) {
      aiCoach.startSession(trade);
    }
  }, [showCoach, trade, aiCoach.state.isActive]);

  // Get real-time P&L
  const { currentPrice, pnlPercent, pnlDollars } = useActiveTradePnL(
    trade.contract.id,
    trade.entryPrice || trade.contract.mid
  );

  // Get key levels for underlying (only for indices, not stocks)
  const underlyingTicker = normalizeSymbolForAPI(trade.ticker);
  const { keyLevels } = useKeyLevels(underlyingTicker, {
    timeframe: "5",
    lookbackDays: 5,
    enabled: true,
  });

  // Get macro context
  const { macro } = useMacroContext(30000);
  const vixLevel = macro?.vix?.level;

  // Calculate position health
  const health = useMemo(
    () => calculatePositionHealth(trade, pnlPercent || 0, currentPrice || 0, vixLevel),
    [trade, pnlPercent, currentPrice, vixLevel]
  );

  // Get time pressure
  const timePressure = useMemo(() => getTimePressure(trade), [trade]);

  // Get style-specific config
  const styleConfig = useMemo(() => getStyleConfig(trade.tradeType), [trade.tradeType]);

  // Get thesis validation
  const thesisValidation = useThesisValidation(trade);

  // Calculate P&L progress (SL to TP)
  const pnlProgress = useMemo(() => {
    if (!trade.entryPrice || !trade.stopLoss || !trade.targetPrice || !currentPrice) {
      return 0.5; // Default to middle
    }
    const totalRange = trade.targetPrice - trade.stopLoss;
    const currentPosition = currentPrice - trade.stopLoss;
    return Math.max(0, Math.min(1, currentPosition / totalRange));
  }, [trade, currentPrice]);

  const isProfit = (pnlPercent || 0) >= 0;
  const entryPrice = trade.entryPrice || trade.contract.mid;

  // Calculate underlying price change (if we had entry snapshot)
  const underlyingCurrent = keyLevels?.vwap || 0;
  const underlyingAtEntry = trade.underlyingAtEntry || underlyingCurrent;
  const underlyingChange = underlyingCurrent
    ? ((underlyingCurrent - underlyingAtEntry) / underlyingAtEntry) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════════════════
          P&L DASHBOARD - Top Header Section
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-[var(--surface-2)] to-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* P&L Display */}
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">P&L</div>
            <div
              className={cn(
                "text-2xl font-bold tabular-nums",
                isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
              )}
            >
              {isProfit ? "+" : ""}
              {formatPercent(pnlPercent || 0)}
            </div>
            {pnlDollars !== undefined && (
              <div
                className={cn(
                  "text-sm tabular-nums",
                  isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {isProfit ? "+" : ""}${pnlDollars.toFixed(2)}
              </div>
            )}
          </div>

          {/* Position Health */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] uppercase tracking-wide">
              <HeartPulse className="w-3 h-3" />
              Health
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "text-2xl font-bold",
                  health.status === "healthy" && "text-[var(--accent-positive)]",
                  health.status === "warning" && "text-yellow-500",
                  health.status === "danger" && "text-[var(--accent-negative)]"
                )}
              >
                {health.score}%
              </div>
              <div
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] uppercase",
                  health.status === "healthy" &&
                    "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
                  health.status === "warning" && "bg-yellow-500/20 text-yellow-500",
                  health.status === "danger" &&
                    "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                )}
              >
                {health.status === "healthy"
                  ? "VALID"
                  : health.status === "warning"
                    ? "WATCH"
                    : "EXIT?"}
              </div>
            </div>
            <div className="text-xs text-[var(--text-muted)]">{health.factors[0]}</div>
          </div>

          {/* Time Pressure */}
          <div className="space-y-2">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
              Time Left
            </div>
            <div className="flex items-center gap-2">
              <Timer
                className={cn(
                  "w-5 h-5",
                  timePressure.urgency === "critical" &&
                    "text-[var(--accent-negative)] animate-pulse",
                  timePressure.urgency === "high" && "text-orange-500",
                  timePressure.urgency === "medium" && "text-yellow-500",
                  timePressure.urgency === "low" && "text-[var(--text-muted)]"
                )}
              />
              <span className="text-2xl font-bold text-[var(--text-high)]">
                {timePressure.timeLeft}
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              θ: -${timePressure.thetaPerHour.toFixed(2)}/hr
            </div>
          </div>
        </div>

        {/* P&L Progress Bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>Stop: ${formatPrice(trade.stopLoss || 0)}</span>
            <span>Entry: ${formatPrice(entryPrice)}</span>
            <span>Target: ${formatPrice(trade.targetPrice || 0)}</span>
          </div>
          <div className="relative h-3 bg-gradient-to-r from-[var(--accent-negative)]/30 via-[var(--surface-3)] to-[var(--accent-positive)]/30 rounded-full overflow-hidden">
            {/* Entry marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/50"
              style={{
                left: `${((entryPrice - (trade.stopLoss || 0)) / ((trade.targetPrice || entryPrice * 1.5) - (trade.stopLoss || entryPrice * 0.5))) * 100}%`,
              }}
            />
            {/* Current position marker */}
            <div
              className={cn(
                "absolute top-0 bottom-0 w-2 rounded-full transition-all duration-300",
                isProfit ? "bg-[var(--accent-positive)]" : "bg-[var(--accent-negative)]"
              )}
              style={{ left: `calc(${pnlProgress * 100}% - 4px)` }}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          UNDERLYING LEVELS
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
          <h3 className="text-xs font-semibold text-[var(--text-high)] uppercase tracking-wide">
            Levels
          </h3>
          <span className="text-[10px] text-[var(--text-faint)]">{trade.ticker}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Current Underlying */}
          <div className="bg-[var(--surface-1)] rounded p-2 border border-[var(--border-hairline)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Current</div>
            <div className="text-sm font-medium text-[var(--text-high)] tabular-nums">
              ${formatPrice(underlyingCurrent)}
            </div>
            {underlyingChange !== 0 && (
              <div
                className={cn(
                  "text-[10px] tabular-nums",
                  underlyingChange >= 0
                    ? "text-[var(--accent-positive)]"
                    : "text-[var(--accent-negative)]"
                )}
              >
                {underlyingChange >= 0 ? "+" : ""}
                {underlyingChange.toFixed(2)}%
              </div>
            )}
          </div>

          {/* VWAP */}
          {keyLevels?.vwap && (
            <div className="bg-[var(--surface-1)] rounded p-2 border border-blue-500/20">
              <div className="text-[10px] text-blue-400 uppercase">VWAP</div>
              <div className="text-sm font-medium text-[var(--text-high)] tabular-nums">
                ${formatPrice(keyLevels.vwap)}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {underlyingCurrent > keyLevels.vwap ? "Above ✓" : "Below"}
              </div>
            </div>
          )}

          {/* ORB High */}
          {keyLevels?.orbHigh && (
            <div className="bg-[var(--surface-1)] rounded p-2 border border-[var(--accent-positive)]/20">
              <div className="text-[10px] text-[var(--accent-positive)] uppercase">ORB High</div>
              <div className="text-sm font-medium text-[var(--text-high)] tabular-nums">
                ${formatPrice(keyLevels.orbHigh)}
              </div>
            </div>
          )}

          {/* ORB Low */}
          {keyLevels?.orbLow && (
            <div className="bg-[var(--surface-1)] rounded p-2 border border-[var(--accent-negative)]/20">
              <div className="text-[10px] text-[var(--accent-negative)] uppercase">ORB Low</div>
              <div className="text-sm font-medium text-[var(--text-high)] tabular-nums">
                ${formatPrice(keyLevels.orbLow)}
              </div>
            </div>
          )}

          {/* Prior Day High */}
          {keyLevels?.priorDayHigh && (
            <div className="bg-[var(--surface-1)] rounded p-2 border border-[var(--border-hairline)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Prior High</div>
              <div className="text-sm font-medium text-[var(--text-high)] tabular-nums">
                ${formatPrice(keyLevels.priorDayHigh)}
              </div>
            </div>
          )}

          {/* Prior Day Low */}
          {keyLevels?.priorDayLow && (
            <div className="bg-[var(--surface-1)] rounded p-2 border border-[var(--border-hairline)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Prior Low</div>
              <div className="text-sm font-medium text-[var(--text-high)] tabular-nums">
                ${formatPrice(keyLevels.priorDayLow)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          THESIS VALIDATION
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileCheck
              className={cn(
                "w-4 h-4",
                thesisValidation.status === "valid" && "text-[var(--accent-positive)]",
                thesisValidation.status === "degraded" && "text-yellow-500",
                thesisValidation.status === "invalid" && "text-[var(--accent-negative)]"
              )}
            />
            <h3 className="text-xs font-semibold text-[var(--text-high)] uppercase tracking-wide">
              Thesis
            </h3>
          </div>
          <div
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium uppercase",
              thesisValidation.status === "valid" &&
                "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
              thesisValidation.status === "degraded" && "bg-yellow-500/20 text-yellow-500",
              thesisValidation.status === "invalid" &&
                "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
            )}
          >
            {thesisValidation.score}%
          </div>
        </div>

        {/* Thesis Checks Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
          {thesisValidation.checks.map((check) => (
            <div
              key={check.name}
              className={cn(
                "p-2 rounded border",
                check.status === "pass" &&
                  "bg-[var(--accent-positive)]/5 border-[var(--accent-positive)]/20",
                check.status === "warn" && "bg-yellow-500/5 border-yellow-500/20",
                check.status === "fail" &&
                  "bg-[var(--accent-negative)]/5 border-[var(--accent-negative)]/20"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase">{check.name}</span>
                {check.status === "pass" && (
                  <CheckCircle className="w-3 h-3 text-[var(--accent-positive)]" />
                )}
                {check.status === "warn" && <AlertCircle className="w-3 h-3 text-yellow-500" />}
                {check.status === "fail" && (
                  <XCircle className="w-3 h-3 text-[var(--accent-negative)]" />
                )}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                <span className="text-[var(--text-low)]">{check.atEntry}</span>
                <span className="mx-1">→</span>
                <span
                  className={cn(
                    check.status === "pass" && "text-[var(--accent-positive)]",
                    check.status === "warn" && "text-yellow-500",
                    check.status === "fail" && "text-[var(--accent-negative)]"
                  )}
                >
                  {check.current}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Recommendation */}
        <div
          className={cn(
            "p-2 rounded",
            thesisValidation.status === "valid" && "bg-[var(--accent-positive)]/10",
            thesisValidation.status === "degraded" && "bg-yellow-500/10",
            thesisValidation.status === "invalid" && "bg-[var(--accent-negative)]/10"
          )}
        >
          <p className="text-xs text-[var(--text-muted)]">{thesisValidation.recommendation}</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          GREEKS MONITOR - Real-time Greeks with entry comparison
          ═══════════════════════════════════════════════════════════════════════ */}
      <HDGreeksMonitor trade={trade} />

      {/* ═══════════════════════════════════════════════════════════════════════
          TRADE STYLE INDICATOR
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] p-3">
        <div className="flex items-center gap-2">
          <Zap
            className={cn(
              "w-4 h-4",
              trade.tradeType === "Scalp" && "text-purple-400",
              trade.tradeType === "Day" && "text-blue-400",
              trade.tradeType === "Swing" && "text-green-400",
              trade.tradeType === "LEAP" && "text-yellow-400"
            )}
          />
          <span className="text-sm font-medium text-[var(--text-high)]">
            {trade.tradeType} Mode
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>Focus: {styleConfig.focusMetrics.join(", ")}</span>
          <span>Target: {styleConfig.targetRange}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          QUICK ACTIONS BAR
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--text-muted)]" />
            <h3 className="text-xs font-semibold text-[var(--text-high)] uppercase tracking-wide">
              Actions
            </h3>
          </div>
          {/* AI Coach Button */}
          <button
            onClick={() => setShowCoach(!showCoach)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
              showCoach
                ? "bg-[var(--brand-primary)] text-[var(--bg-base)]"
                : "bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20"
            )}
          >
            <Brain className="w-3.5 h-3.5" />
            {showCoach ? "Hide Coach" : "AI Coach"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {onTrim && (
            <button
              onClick={onTrim}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent-positive)]/10 border border-[var(--accent-positive)]/30 text-[var(--accent-positive)] text-xs font-medium hover:bg-[var(--accent-positive)]/20 transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              Trim 50%
            </button>
          )}
          {onTrailStop && (
            <button
              onClick={onTrailStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              Trail Stop
            </button>
          )}
          {onMoveSL && (
            <button
              onClick={onMoveSL}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Move SL
            </button>
          )}
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Add
            </button>
          )}
          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/30 text-[var(--accent-negative)] text-xs font-medium hover:bg-[var(--accent-negative)]/20 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Exit
            </button>
          )}
        </div>

        {/* Smart Recommendation */}
        {timePressure.urgency !== "low" && (
          <div className="mt-3 p-2 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={cn(
                  "w-4 h-4 mt-0.5 flex-shrink-0",
                  timePressure.urgency === "critical" && "text-[var(--accent-negative)]",
                  timePressure.urgency === "high" && "text-orange-500",
                  timePressure.urgency === "medium" && "text-yellow-500"
                )}
              />
              <p className="text-xs text-[var(--text-muted)]">{timePressure.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          EXISTING ENTERED TRADE CARD (Full Details)
          ═══════════════════════════════════════════════════════════════════════ */}
      <HDEnteredTradeCard
        trade={trade}
        direction={trade.contract.type === "C" ? "call" : "put"}
        onAutoTrim={onAutoTrim}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          AI COACH PANEL - Inline coaching section
          ═══════════════════════════════════════════════════════════════════════ */}
      {showCoach && (
        <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)]/30 overflow-hidden">
          <AICoachPanel
            trade={trade}
            sessionId={aiCoach.state.sessionId}
            coachingMode={aiCoach.state.coachingMode}
            latestResponse={aiCoach.state.latestResponse}
            isLoading={aiCoach.state.isLoading}
            isProcessing={aiCoach.isProcessing}
            error={aiCoach.state.error}
            updateCount={aiCoach.state.updateCount}
            tokensUsed={aiCoach.state.tokensUsed}
            startTime={aiCoach.state.startTime}
            onClose={() => {
              setShowCoach(false);
              aiCoach.endSession();
            }}
            onRefresh={aiCoach.refresh}
            onAsk={aiCoach.ask}
            onEndSession={aiCoach.endSession}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
          />
        </div>
      )}
    </div>
  );
}
