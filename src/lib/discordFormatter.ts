import { Trade, AlertType, SetupType } from "../types";
import { formatPrice } from "./utils";

interface DiscordAlertOptions {
  updateKind?: "trim" | "generic" | "sl" | "take-profit";
  includeEntry?: boolean;
  includeCurrent?: boolean;
  includeTarget?: boolean;
  includeStopLoss?: boolean;
  includePnL?: boolean;
  includeConfluence?: boolean;
  comment?: string;
  // Enhanced confluence data structure (supports both legacy and new format)
  confluenceData?: {
    // New comprehensive fields from marketDataStore ConfluenceScore
    overallScore?: number;
    subscores?: {
      trend?: number;
      momentum?: number;
      volatility?: number;
      volume?: number;
      technical?: number;
    };
    components?: {
      trendAlignment?: boolean;
      aboveVWAP?: boolean;
      rsiConfirm?: boolean;
      volumeConfirm?: boolean;
      supportResistance?: boolean;
    };
    highlights?: string[]; // e.g., ["RVOL 2.1x", "Flow +62", "IVP 34%"]
    // Legacy fields (backwards compatibility)
    rsi?: number;
    macdSignal?: "bullish" | "bearish" | "neutral";
    emaStatus?: string;
    volumeChange?: number;
    ivPercentile?: number;
  };
  // New enhanced fields
  includeDTE?: boolean;
  includeRiskReward?: boolean;
  includeGreeks?: boolean;
  includeUnderlying?: boolean;
  includeSetupType?: boolean;
  // Data for new fields
  dte?: number;
  riskReward?: number | null;
  greeks?: {
    delta?: number;
    iv?: number;
    theta?: number;
    gamma?: number;
  };
  underlyingPrice?: number;
  setupType?: SetupType;
}

/**
 * Format a trade alert for Discord with proper emojis, timestamps, and structure
 */
export function formatDiscordAlert(
  trade: Trade,
  alertType: AlertType,
  options: DiscordAlertOptions = {}
): string {
  const lines: string[] = [];

  // Get current time in EST
  const now = new Date();
  const estTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const estDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);

  // Get alert emoji and title
  const { emoji, title } = getAlertTypeDisplay(alertType, options.updateKind);

  // Header line with timestamp
  lines.push(`${emoji} **${title}** | ${estTime} EST | ${estDate}`);

  // Trade identifier line with DTE badge
  const strikeStr = `$${trade.contract.strike}${trade.contract.type}`;
  const expiryStr = trade.contract.expiry;
  const dteStr =
    options.includeDTE && options.dte !== undefined
      ? ` [${options.dte === 0 ? "⚠️ 0DTE" : options.dte <= 2 ? `🔥 ${options.dte}DTE` : `📅 ${options.dte}DTE`}]`
      : "";
  lines.push(`**${trade.ticker} ${strikeStr} ${expiryStr}** (${trade.tradeType})${dteStr}`);

  // Setup type badge
  if (options.includeSetupType && options.setupType) {
    const setupEmoji = getSetupTypeEmoji(options.setupType);
    lines.push(`${setupEmoji} Setup: **${options.setupType}**`);
  }

  lines.push("");

  // Underlying price context
  if (options.includeUnderlying && options.underlyingPrice) {
    lines.push(`📍 ${trade.ticker} @ $${formatPrice(options.underlyingPrice)}`);
  }

  // Price fields
  if (options.includeEntry && trade.entryPrice) {
    lines.push(`✅ Entry: $${formatPrice(trade.entryPrice)}`);
  }

  if (options.includeCurrent) {
    const currentPrice = trade.currentPrice || trade.contract.mid;
    lines.push(`📊 Current: $${formatPrice(currentPrice)}`);
  }

  if (options.includeTarget && trade.targetPrice) {
    lines.push(`🎯 Target: $${formatPrice(trade.targetPrice)}`);
  }

  if (options.includeStopLoss && trade.stopLoss) {
    lines.push(`🛡️ Stop: $${formatPrice(trade.stopLoss)}`);
  }

  // Risk/Reward ratio
  if (options.includeRiskReward && options.riskReward) {
    const rrEmoji = options.riskReward >= 2 ? "🎲" : "⚖️";
    const rrRating =
      options.riskReward >= 3 ? "Excellent" : options.riskReward >= 2 ? "Good" : "Fair";
    lines.push(`${rrEmoji} R:R: **${options.riskReward.toFixed(1)}:1** (${rrRating})`);
  }

  if (options.includePnL && trade.movePercent !== undefined) {
    const sign = trade.movePercent >= 0 ? "+" : "";
    const pnlEmoji = trade.movePercent >= 0 ? "💰" : "📉";
    lines.push(`${pnlEmoji} P&L: ${sign}${trade.movePercent.toFixed(1)}%`);
  }

  // Greeks section
  if (options.includeGreeks && options.greeks) {
    const greeksParts: string[] = [];
    if (options.greeks.delta !== undefined) {
      greeksParts.push(`Δ ${(options.greeks.delta * 100).toFixed(0)}`);
    }
    if (options.greeks.iv !== undefined) {
      greeksParts.push(`IV ${(options.greeks.iv * 100).toFixed(0)}%`);
    }
    if (options.greeks.theta !== undefined) {
      greeksParts.push(`θ ${options.greeks.theta.toFixed(2)}`);
    }
    if (greeksParts.length > 0) {
      lines.push(`📐 Greeks: ${greeksParts.join(" | ")}`);
    }
  }

  // Confluence metrics (enhanced with full breakdown)
  if (options.includeConfluence && options.confluenceData) {
    lines.push("");
    const conf = options.confluenceData;

    // Line 1: Overall score (if available)
    if (conf.overallScore !== undefined) {
      const scoreEmoji = conf.overallScore >= 80 ? "🟢" : conf.overallScore >= 60 ? "🟡" : "🔴";
      lines.push(`📈 Confluence: **${Math.round(conf.overallScore)}** ${scoreEmoji}`);
    } else {
      lines.push("📈 Confluence:");
    }

    // Line 2: Subscores (trend/momentum/volatility/volume/technical)
    if (conf.subscores) {
      const subscoreParts: string[] = [];
      const ss = conf.subscores;
      if (ss.trend !== undefined) subscoreParts.push(`Trend ${Math.round(ss.trend)}`);
      if (ss.momentum !== undefined) subscoreParts.push(`Mom ${Math.round(ss.momentum)}`);
      if (ss.volatility !== undefined) subscoreParts.push(`Vol ${Math.round(ss.volatility)}`);
      if (ss.volume !== undefined) subscoreParts.push(`Volm ${Math.round(ss.volume)}`);
      if (ss.technical !== undefined) subscoreParts.push(`Tech ${Math.round(ss.technical)}`);
      if (subscoreParts.length > 0) {
        lines.push(`• ${subscoreParts.join(" | ")}`);
      }
    }

    // Line 3: Component checklist (✅/❌ format)
    if (conf.components) {
      const c = conf.components;
      const checkParts: string[] = [];
      if (c.aboveVWAP !== undefined) checkParts.push(`${c.aboveVWAP ? "✅" : "❌"} VWAP`);
      if (c.rsiConfirm !== undefined) checkParts.push(`${c.rsiConfirm ? "✅" : "❌"} RSI`);
      if (c.trendAlignment !== undefined) checkParts.push(`${c.trendAlignment ? "✅" : "❌"} MTF`);
      if (c.supportResistance !== undefined)
        checkParts.push(`${c.supportResistance ? "✅" : "❌"} S/R`);
      if (c.volumeConfirm !== undefined) checkParts.push(`${c.volumeConfirm ? "✅" : "❌"} Vol`);
      if (checkParts.length > 0) {
        lines.push(`• ${checkParts.join(" ")}`);
      }
    }

    // Line 4: Highlights (RVOL, Flow, IVP)
    if (conf.highlights && conf.highlights.length > 0) {
      lines.push(`• ${conf.highlights.join(" | ")}`);
    }

    // Legacy fallback: If no new fields, use legacy format
    if (!conf.overallScore && !conf.subscores && !conf.components && !conf.highlights) {
      const legacyParts: string[] = [];
      if (conf.rsi) legacyParts.push(`RSI ${conf.rsi}`);
      if (conf.macdSignal) {
        const macdText =
          conf.macdSignal === "bullish"
            ? "MACD bullish"
            : conf.macdSignal === "bearish"
              ? "MACD bearish"
              : "MACD neutral";
        legacyParts.push(macdText);
      }
      if (conf.emaStatus) legacyParts.push(conf.emaStatus);
      if (conf.volumeChange !== undefined) {
        legacyParts.push(
          `Volume ${conf.volumeChange >= 0 ? "+" : ""}${conf.volumeChange.toFixed(0)}%`
        );
      }
      if (conf.ivPercentile !== undefined) {
        legacyParts.push(`IV ${conf.ivPercentile}th %ile`);
      }
      if (legacyParts.length > 0) {
        // Remove the empty confluence header if we only have legacy
        lines.pop();
        lines.push(`📈 Confluence: ${legacyParts.join(" | ")}`);
      }
    }
  }

  // Comment
  if (options.comment && options.comment.trim()) {
    lines.push("");
    lines.push(`💭 ${options.comment.trim()}`);
  }

  // Footer
  lines.push("");
  lines.push("📢 honeydripnetwork.com");

  return lines.join("\n");
}

/**
 * Get emoji and display title for alert type
 */
function getAlertTypeDisplay(
  alertType: AlertType,
  updateKind?: "trim" | "generic" | "sl" | "take-profit"
): { emoji: string; title: string } {
  if (alertType === "load") {
    return { emoji: "🟡", title: "LOAD ALERT" };
  }
  if (alertType === "enter") {
    return { emoji: "🚀", title: "ENTRY ALERT" };
  }
  if (alertType === "exit") {
    return { emoji: "🏁", title: "EXIT ALERT" };
  }
  if (alertType === "add") {
    return { emoji: "➕", title: "ADD TO POSITION" };
  }
  if (alertType === "trail_stop") {
    return { emoji: "🏃", title: "TRAIL STOP ACTIVATED" };
  }
  if (alertType === "update") {
    if (updateKind === "trim") {
      return { emoji: "💰", title: "TRIM ALERT" };
    }
    if (updateKind === "sl") {
      return { emoji: "🛡️", title: "STOP LOSS UPDATE" };
    }
    if (updateKind === "take-profit") {
      return { emoji: "🎯", title: "TAKE PROFIT ALERT" };
    }
    return { emoji: "📝", title: "UPDATE ALERT" };
  }
  return { emoji: "📢", title: "ALERT" };
}

/**
 * Get emoji for setup type
 */
function getSetupTypeEmoji(setupType: SetupType): string {
  const emojiMap: Record<string, string> = {
    // Momentum setups
    MOMENTUM_BREAKOUT: "🚀",
    TREND_CONTINUATION: "📈",
    PULLBACK_ENTRY: "↩️",
    // Reversal setups
    REVERSAL: "🔄",
    MEAN_REVERSION: "⚖️",
    OVERSOLD_BOUNCE: "📉",
    OVERBOUGHT_FADE: "📈",
    // Range/Pattern setups
    RANGE_TRADE: "📊",
    BREAKOUT: "💥",
    BREAKDOWN: "⬇️",
    GAP_FILL: "🕳️",
    VWAP_RECLAIM: "📍",
    // Time-based
    ORB: "⏰",
    OPENING_RANGE: "⏰",
    // Default
    SCALP: "⚡",
    DAY: "☀️",
    SWING: "🌙",
  };
  return emojiMap[setupType] || "📋";
}

/**
 * Format a challenge summary for Discord export
 */
export function formatChallengeDiscordExport(
  challengeName: string,
  trades: Trade[],
  stats: {
    totalTrades: number;
    winRate: number;
    avgPnL: number;
    bestTrade: { ticker: string; pnl: number } | null;
    worstTrade: { ticker: string; pnl: number } | null;
    totalPnL: number;
  }
): string {
  const lines: string[] = [];

  // Get current time in EST
  const now = new Date();
  const estDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);

  // Header
  lines.push(`🏆 **${challengeName.toUpperCase()} - SUMMARY**`);
  lines.push(`📅 ${estDate}`);
  lines.push("");

  // Summary stats
  lines.push("**📊 Performance**");
  lines.push(`Total Trades: ${stats.totalTrades}`);
  lines.push(`Win Rate: ${stats.winRate.toFixed(1)}%`);
  lines.push(`Avg P&L: ${stats.avgPnL >= 0 ? "+" : ""}${stats.avgPnL.toFixed(1)}%`);
  lines.push(`Total P&L: ${stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(1)}%`);
  lines.push("");

  // Best and worst
  if (stats.bestTrade) {
    lines.push(`🥇 Best: ${stats.bestTrade.ticker} +${stats.bestTrade.pnl.toFixed(1)}%`);
  }
  if (stats.worstTrade) {
    lines.push(`📉 Worst: ${stats.worstTrade.ticker} ${stats.worstTrade.pnl.toFixed(1)}%`);
  }
  lines.push("");

  // Trade list
  lines.push("**📋 Trades Entered**");
  const enteredTrades = trades.filter((t) => t.state === "ENTERED" || t.state === "EXITED");

  if (enteredTrades.length === 0) {
    lines.push("_No trades entered yet_");
  } else {
    enteredTrades.forEach((trade, idx) => {
      const pnl = trade.movePercent || 0;
      const pnlEmoji = pnl >= 0 ? "✅" : "❌";
      const pnlStr = pnl >= 0 ? `+${pnl.toFixed(1)}%` : `${pnl.toFixed(1)}%`;
      lines.push(
        `${idx + 1}. ${pnlEmoji} ${trade.ticker} $${trade.contract.strike}${trade.contract.type} ${pnlStr}`
      );
    });
  }

  lines.push("");
  lines.push("📢 honeydripnetwork.com");

  return lines.join("\n");
}

/**
 * Format a single trade for sharing/screenshot
 */
export function formatTradeShareMessage(trade: Trade): string {
  const lines: string[] = [];

  const now = new Date();
  const estDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const pnl = trade.movePercent || 0;
  const emoji = pnl >= 0 ? "🎯" : "📉";

  lines.push(`${emoji} **TRADE RESULT** | ${estDate}`);
  lines.push(
    `**${trade.ticker} $${trade.contract.strike}${trade.contract.type} ${trade.contract.expiry}**`
  );
  lines.push("");

  if (trade.entryPrice) {
    lines.push(`✅ Entry: $${formatPrice(trade.entryPrice)}`);
  }
  if (trade.exitPrice) {
    lines.push(`🏁 Exit: $${formatPrice(trade.exitPrice)}`);
  }
  lines.push(`${pnl >= 0 ? "💰" : "📉"} P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`);

  lines.push("");
  lines.push("📢 honeydripnetwork.com");

  return lines.join("\n");
}
