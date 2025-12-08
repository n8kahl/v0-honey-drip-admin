/**
 * SnapshotBuilder - Builds context snapshots for AI coaching
 *
 * Aggregates data from multiple sources:
 * - Trade data (position, entry, stop, targets)
 * - Market data (price, volume, indicators)
 * - Economic calendar
 * - Greeks (for options)
 * - Time/session context
 * - Regime detection
 */

import { DripCoachSnapshot, TradeType, Direction, CoachingMode } from "./types.js";

// ============= Input Types =============

export interface TradeInput {
  tradeId: string;
  symbol: string;
  underlying: string;
  direction: Direction;
  tradeType: TradeType;
  dte: number;
  strike?: number;
  optionType?: "CALL" | "PUT";
  contractSymbol?: string;
  entryPrice: number;
  entryTime: string;
  stopPrice: number;
  targets: { t1: number; t2?: number; t3?: number };
  partialsTaken?: number;
  remainingSize?: number;
}

export interface MarketInput {
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  avgVolume: number;
  vwap: number;
  atr: number;
  rsi: number;
  ema8?: number;
  ema21?: number;
  ema50?: number;
  priorDayHigh: number;
  priorDayLow: number;
  priorDayClose: number;
  orbHigh?: number;
  orbLow?: number;
  swingHigh?: number;
  swingLow?: number;
}

export interface GreeksInput {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  ivPercentile?: number;
  ivRank?: number;
}

export interface EconomicInput {
  nextHighImpactEvent?: {
    name: string;
    datetime: string;
    hoursUntil: number;
    impact: "HIGH" | "CRITICAL";
    affectsSymbols: string[];
  };
  earningsProximity?: {
    symbol: string;
    daysUntil: number;
    timing: "BMO" | "AMC";
  };
  tradingRecommendations?: string[];
  volatilityOutlook?: "elevated" | "normal" | "low";
  marketSentiment?: "risk-on" | "risk-off" | "neutral";
}

export interface ContextInput {
  vixValue: number;
  vixTrend?: "rising" | "falling" | "stable";
  marketRegime?: "trending" | "ranging" | "choppy" | "volatile";
  regimeConfidence?: number;
  timeWindow?: string;
  timeWindowLabel?: string;
}

export interface SnapshotBuilderInput {
  trade: TradeInput;
  market: MarketInput;
  greeks?: GreeksInput;
  economic?: EconomicInput;
  context?: ContextInput;
  sessionId: string;
  coachingMode: CoachingMode;
  updateCount: number;
  maxUpdates: number;
  tokensUsed: number;
  sessionStartTime: string;
}

// ============= Snapshot Builder Class =============

export class SnapshotBuilder {
  /**
   * Build a complete snapshot from input data
   */
  build(input: SnapshotBuilderInput): DripCoachSnapshot {
    const now = new Date();
    const entryTime = new Date(input.trade.entryTime);
    const timeInTradeMinutes = Math.floor((now.getTime() - entryTime.getTime()) / 60000);
    const timeInTradeBars = Math.floor(timeInTradeMinutes); // Assume 1-min bars

    // Calculate R-multiple
    const riskPerShare = Math.abs(input.trade.entryPrice - input.trade.stopPrice);
    const currentPnlPerShare =
      input.trade.direction === "LONG"
        ? input.market.lastPrice - input.trade.entryPrice
        : input.trade.entryPrice - input.market.lastPrice;
    const rMultiple = riskPerShare > 0 ? currentPnlPerShare / riskPerShare : 0;

    // Calculate distances in ATR
    const atr = input.market.atr || 1;
    const distanceToStop = Math.abs(input.market.lastPrice - input.trade.stopPrice);
    const distanceToT1 = Math.abs(input.trade.targets.t1 - input.market.lastPrice);

    // Build position status
    const position = {
      entryPrice: input.trade.entryPrice,
      currentPrice: input.market.lastPrice,
      stopPrice: input.trade.stopPrice,
      targets: input.trade.targets,
      pnlDollars: currentPnlPerShare * 100, // Assume 100 shares/contracts
      pnlPercent: (currentPnlPerShare / input.trade.entryPrice) * 100,
      rMultiple,
      timeInTradeBars,
      timeInTradeMinutes,
      partialsTaken: input.trade.partialsTaken || 0,
      remainingSize: input.trade.remainingSize || 100,
      distanceToStopATR: distanceToStop / atr,
      distanceToT1ATR: distanceToT1 / atr,
      distanceToT2ATR: input.trade.targets.t2
        ? Math.abs(input.trade.targets.t2 - input.market.lastPrice) / atr
        : undefined,
    };

    // Build market snapshot
    const spread = input.market.ask - input.market.bid;
    const volumeRatio =
      input.market.avgVolume > 0 ? input.market.volume / input.market.avgVolume : 1;
    const vwapDistance = (input.market.lastPrice - input.market.vwap) / atr;

    const market = {
      lastPrice: input.market.lastPrice,
      bid: input.market.bid,
      ask: input.market.ask,
      spread,
      spreadPercent: (spread / input.market.lastPrice) * 100,
      atr,
      atrPercent: (atr / input.market.lastPrice) * 100,
      rsi: input.market.rsi,
      momentum: this.classifyMomentum(input.market.rsi, input.market),
      currentVolume: input.market.volume,
      avgVolume: input.market.avgVolume,
      volumeRatio,
      volumeTrend: this.classifyVolumeTrend(volumeRatio),
      vwap: input.market.vwap,
      vwapDistance,
      aboveVWAP: input.market.lastPrice > input.market.vwap,
      mtfTrend: this.buildMTFTrend(input.market),
    };

    // Build structure context
    const structure = this.buildStructureContext(input.market, input.trade, atr);

    // Build time context
    const timeContext = this.buildTimeContext(now, input.context);

    // Build volatility context
    const volatilityContext = {
      vixLevel: this.classifyVIXLevel(input.context?.vixValue || 20),
      vixValue: input.context?.vixValue || 20,
      vixTrend: input.context?.vixTrend || "stable",
      marketRegime: input.context?.marketRegime || "trending",
      regimeConfidence: input.context?.regimeConfidence || 70,
    };

    // Build economic context
    const economicContext = this.buildEconomicContext(input.economic, input.trade.symbol);

    // Build greeks if provided
    const greeks = input.greeks
      ? this.buildGreeksContext(input.greeks, timeInTradeMinutes, input.trade.entryPrice)
      : undefined;

    // Build session metadata
    const session = {
      sessionId: input.sessionId,
      coachingMode: input.coachingMode,
      updateCount: input.updateCount,
      lastTrigger: "SESSION_START",
      lastUpdateTime: now.toISOString(),
      tokensUsedTotal: input.tokensUsed,
      sessionStartTime: input.sessionStartTime,
      maxUpdatesRemaining: input.maxUpdates - input.updateCount,
    };

    return {
      trade: {
        tradeId: input.trade.tradeId,
        symbol: input.trade.symbol,
        underlying: input.trade.underlying,
        direction: input.trade.direction,
        tradeType: input.trade.tradeType,
        dte: input.trade.dte,
        strike: input.trade.strike,
        optionType: input.trade.optionType,
        contractSymbol: input.trade.contractSymbol,
      },
      position,
      market,
      structure,
      greeks,
      timeContext,
      volatilityContext,
      economicContext,
      session,
    };
  }

  // ============= Helper Methods =============

  private classifyMomentum(
    rsi: number,
    market: MarketInput
  ): "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear" {
    // Use RSI and EMA alignment if available
    if (rsi > 70) return "strong_bull";
    if (rsi > 55) return "bull";
    if (rsi >= 45) return "neutral";
    if (rsi >= 30) return "bear";
    return "strong_bear";
  }

  private classifyVolumeTrend(
    ratio: number
  ): "spiking" | "above_avg" | "normal" | "below_avg" | "drying_up" {
    if (ratio > 2.0) return "spiking";
    if (ratio > 1.3) return "above_avg";
    if (ratio >= 0.7) return "normal";
    if (ratio >= 0.4) return "below_avg";
    return "drying_up";
  }

  private buildMTFTrend(market: MarketInput): DripCoachSnapshot["market"]["mtfTrend"] {
    // Simplified MTF trend based on price vs EMAs
    const price = market.lastPrice;
    const ema8 = market.ema8 || price;
    const ema21 = market.ema21 || price;
    const ema50 = market.ema50 || price;

    const trend1m = price > ema8 ? "bullish" : price < ema8 ? "bearish" : "neutral";
    const trend5m = price > ema21 ? "bullish" : price < ema21 ? "bearish" : "neutral";
    const trend15m = price > ema50 ? "bullish" : price < ema50 ? "bearish" : "neutral";

    // Check alignment
    const trends = [trend1m, trend5m, trend15m];
    const bullish = trends.filter((t) => t === "bullish").length;
    const bearish = trends.filter((t) => t === "bearish").length;

    let alignment: "full" | "partial" | "conflicting";
    if (bullish === 3 || bearish === 3) {
      alignment = "full";
    } else if (bullish >= 2 || bearish >= 2) {
      alignment = "partial";
    } else {
      alignment = "conflicting";
    }

    return {
      "1m": trend1m,
      "5m": trend5m,
      "15m": trend15m,
      "60m": "neutral", // Would need hourly data
      alignment,
    };
  }

  private buildStructureContext(
    market: MarketInput,
    trade: TradeInput,
    atr: number
  ): DripCoachSnapshot["structure"] {
    const price = market.lastPrice;

    // Find nearest support
    const supports = [
      { price: market.vwap, type: "VWAP" },
      { price: market.orbLow || 0, type: "ORB_LOW" },
      { price: market.priorDayLow, type: "PRIOR_DAY_LOW" },
      { price: market.swingLow || 0, type: "SWING_LOW" },
    ].filter((s) => s.price > 0 && s.price < price);

    const nearestSupport =
      supports.length > 0
        ? supports.reduce((a, b) => (Math.abs(price - a.price) < Math.abs(price - b.price) ? a : b))
        : { price: market.priorDayLow, type: "PRIOR_DAY_LOW" };

    // Find nearest resistance
    const resistances = [
      { price: market.vwap, type: "VWAP" },
      { price: market.orbHigh || Infinity, type: "ORB_HIGH" },
      { price: market.priorDayHigh, type: "PRIOR_DAY_HIGH" },
      { price: market.swingHigh || Infinity, type: "SWING_HIGH" },
    ].filter((r) => r.price < Infinity && r.price > price);

    const nearestResistance =
      resistances.length > 0
        ? resistances.reduce((a, b) =>
            Math.abs(price - a.price) < Math.abs(price - b.price) ? a : b
          )
        : { price: market.priorDayHigh, type: "PRIOR_DAY_HIGH" };

    // Determine key level proximity
    const nearestLevel =
      Math.abs(price - nearestSupport.price) < Math.abs(price - nearestResistance.price)
        ? nearestSupport
        : nearestResistance;
    const nearestDistance = Math.abs(price - nearestLevel.price) / atr;

    let keyLevelProximity: "at_level" | "near" | "clear";
    if (nearestDistance < 0.2) {
      keyLevelProximity = "at_level";
    } else if (nearestDistance < 0.5) {
      keyLevelProximity = "near";
    } else {
      keyLevelProximity = "clear";
    }

    return {
      nearestSupport: {
        price: nearestSupport.price,
        type: nearestSupport.type,
        atrDistance: Math.abs(price - nearestSupport.price) / atr,
      },
      nearestResistance: {
        price: nearestResistance.price,
        type: nearestResistance.type,
        atrDistance: Math.abs(price - nearestResistance.price) / atr,
      },
      orbHigh: market.orbHigh || market.priorDayHigh,
      orbLow: market.orbLow || market.priorDayLow,
      priorDayHigh: market.priorDayHigh,
      priorDayLow: market.priorDayLow,
      priorDayClose: market.priorDayClose,
      keyLevelProximity,
      nearestLevelName: nearestLevel.type,
      nearestLevelDistance: nearestDistance,
    };
  }

  private buildTimeContext(now: Date, context?: ContextInput): DripCoachSnapshot["timeContext"] {
    // Calculate market open/close times (9:30 AM - 4:00 PM ET)
    const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const marketOpenMinutes = 9 * 60 + 30; // 9:30 AM
    const marketCloseMinutes = 16 * 60; // 4:00 PM

    const minutesSinceOpen = Math.max(0, totalMinutes - marketOpenMinutes);
    const minutesToClose = Math.max(0, marketCloseMinutes - totalMinutes);

    const isExtendedHours = totalMinutes < marketOpenMinutes || totalMinutes > marketCloseMinutes;

    // Determine time window
    let timeWindow = context?.timeWindow || "mid_morning";
    let timeWindowLabel = context?.timeWindowLabel || "Mid-Morning";

    if (!context?.timeWindow) {
      if (totalMinutes < marketOpenMinutes) {
        timeWindow = "pre_market";
        timeWindowLabel = "Pre-Market";
      } else if (totalMinutes < 10 * 60) {
        timeWindow = "opening_drive";
        timeWindowLabel = "Opening Drive";
      } else if (totalMinutes < 11 * 60) {
        timeWindow = "mid_morning";
        timeWindowLabel = "Mid-Morning";
      } else if (totalMinutes < 11 * 60 + 30) {
        timeWindow = "late_morning";
        timeWindowLabel = "Late Morning";
      } else if (totalMinutes < 13 * 60 + 30) {
        timeWindow = "lunch_chop";
        timeWindowLabel = "Lunch Chop";
      } else if (totalMinutes < 14 * 60 + 30) {
        timeWindow = "early_afternoon";
        timeWindowLabel = "Early Afternoon";
      } else if (totalMinutes < 15 * 60) {
        timeWindow = "afternoon";
        timeWindowLabel = "Afternoon";
      } else if (totalMinutes < marketCloseMinutes) {
        timeWindow = "power_hour";
        timeWindowLabel = "Power Hour";
      } else {
        timeWindow = "after_hours";
        timeWindowLabel = "After Hours";
      }
    }

    return {
      timeWindow,
      timeWindowLabel,
      minutesSinceOpen,
      minutesToClose,
      isExtendedHours,
    };
  }

  private classifyVIXLevel(vix: number): "low" | "medium" | "high" | "extreme" {
    if (vix < 15) return "low";
    if (vix < 25) return "medium";
    if (vix < 35) return "high";
    return "extreme";
  }

  private buildEconomicContext(
    economic?: EconomicInput,
    symbol?: string
  ): DripCoachSnapshot["economicContext"] {
    if (!economic) {
      return {
        tradingRecommendations: [],
        volatilityOutlook: "normal",
        marketSentiment: "neutral",
      };
    }

    return {
      nextHighImpactEvent: economic.nextHighImpactEvent
        ? {
            ...economic.nextHighImpactEvent,
            affectsSymbol:
              economic.nextHighImpactEvent.affectsSymbols?.includes(symbol || "") ||
              economic.nextHighImpactEvent.affectsSymbols?.includes("SPY") ||
              false,
          }
        : undefined,
      earningsProximity: economic.earningsProximity,
      tradingRecommendations: economic.tradingRecommendations || [],
      volatilityOutlook: economic.volatilityOutlook || "normal",
      marketSentiment: economic.marketSentiment || "neutral",
    };
  }

  private buildGreeksContext(
    greeks: GreeksInput,
    timeInTradeMinutes: number,
    entryPrice: number
  ): DripCoachSnapshot["greeks"] {
    const thetaPerMinute = greeks.theta / (6.5 * 60); // Trading day in minutes
    const thetaCostSinceEntry = Math.abs(thetaPerMinute) * timeInTradeMinutes;

    return {
      delta: greeks.delta,
      gamma: greeks.gamma,
      theta: greeks.theta,
      vega: greeks.vega,
      iv: greeks.iv,
      thetaPerMinute,
      thetaCostSinceEntry,
      gammaExposure: greeks.gamma * 100, // Per 100 shares
      ivPercentile: greeks.ivPercentile || 50,
      ivRank: greeks.ivRank || 50,
      recentIVCrush: false, // Would need historical data
      recentIVSpike: false,
    };
  }
}

// Singleton instance
let snapshotBuilderInstance: SnapshotBuilder | null = null;

export function getSnapshotBuilder(): SnapshotBuilder {
  if (!snapshotBuilderInstance) {
    snapshotBuilderInstance = new SnapshotBuilder();
  }
  return snapshotBuilderInstance;
}
