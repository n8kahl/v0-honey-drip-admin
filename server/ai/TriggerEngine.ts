/**
 * TriggerEngine - Detects when AI coaching updates should be triggered
 *
 * Event-driven, not time-driven:
 * - R-milestone hits (0.5R, 1R, 1.5R, 2R)
 * - Key level proximity
 * - Volume spikes
 * - Stop/target proximity
 * - Theta decay warnings (0DTE)
 * - Economic event proximity
 * - Session changes (opening drive -> lunch chop)
 */

import {
  DripCoachSnapshot,
  TriggerType,
  TriggerResult,
  CoachingTrigger,
  CoachingMode,
} from "./types.js";

// ============= Trigger Definitions =============

const SCALP_TRIGGERS: CoachingTrigger[] = [
  // R-Milestones (high priority)
  {
    type: "R_MILESTONE",
    priority: 4,
    cooldownSeconds: 30,
  },

  // Key Level Proximity (high priority)
  {
    type: "KEY_LEVEL_HIT",
    priority: 4,
    cooldownSeconds: 45,
  },

  // Volume Spike (medium priority)
  {
    type: "VOLUME_SPIKE",
    priority: 3,
    cooldownSeconds: 60,
  },

  // Momentum Stall (medium priority)
  {
    type: "MOMENTUM_STALL",
    priority: 3,
    cooldownSeconds: 60,
  },

  // Stop Proximity (CRITICAL)
  {
    type: "STOP_PROXIMITY",
    priority: 5,
    cooldownSeconds: 20,
  },

  // Target Proximity (high priority)
  {
    type: "TARGET_PROXIMITY",
    priority: 4,
    cooldownSeconds: 30,
  },

  // Theta Decay Warning (0DTE only)
  {
    type: "THETA_DECAY",
    priority: 3,
    cooldownSeconds: 120,
  },

  // Time in Trade Warning
  {
    type: "TIME_WARNING",
    priority: 2,
    cooldownSeconds: 180,
  },

  // Economic Event Imminent
  {
    type: "ECONOMIC_EVENT_IMMINENT",
    priority: 4,
    cooldownSeconds: 300, // 5 min
  },
];

const DAY_TRIGGERS: CoachingTrigger[] = [
  // All scalp triggers plus...
  ...SCALP_TRIGGERS,

  // Session Change (opening -> lunch -> power hour)
  {
    type: "SESSION_CHANGE",
    priority: 3,
    cooldownSeconds: 0, // No cooldown - only triggers once per change
  },

  // Regime Shift
  {
    type: "REGIME_SHIFT",
    priority: 3,
    cooldownSeconds: 300, // 5 min
  },

  // EOD Approach (15 min before close)
  {
    type: "EOD_APPROACH",
    priority: 4,
    cooldownSeconds: 600, // 10 min
  },
];

const SWING_TRIGGERS: CoachingTrigger[] = [
  // Daily Check-In
  {
    type: "DAILY_CHECKIN",
    priority: 3,
    cooldownSeconds: 86400, // 24 hours
    triggerTime: "16:05",
  },

  // Economic Event Tomorrow
  {
    type: "ECONOMIC_EVENT_TOMORROW",
    priority: 4,
    cooldownSeconds: 86400,
  },

  // Earnings Approaching
  {
    type: "EARNINGS_APPROACHING",
    priority: 4,
    cooldownSeconds: 86400,
  },

  // IV Percentile Shift
  {
    type: "IV_SHIFT",
    priority: 3,
    cooldownSeconds: 86400,
  },

  // Weekly Review (Friday)
  {
    type: "WEEKLY_REVIEW",
    priority: 3,
    cooldownSeconds: 604800, // 1 week
    triggerTime: "16:05",
    triggerDay: 5, // Friday
  },
];

const LEAP_TRIGGERS: CoachingTrigger[] = [
  // Monthly Review
  {
    type: "WEEKLY_REVIEW", // Reused as monthly for LEAPs
    priority: 3,
    cooldownSeconds: 2592000, // 30 days
  },

  // Earnings Approaching
  {
    type: "EARNINGS_APPROACHING",
    priority: 4,
    cooldownSeconds: 604800, // Weekly
  },

  // IV Shift (significant)
  {
    type: "IV_SHIFT",
    priority: 3,
    cooldownSeconds: 604800,
  },
];

// ============= Trigger Engine Class =============

export class TriggerEngine {
  private triggers: Map<CoachingMode, CoachingTrigger[]>;

  constructor() {
    this.triggers = new Map([
      ["scalp", SCALP_TRIGGERS],
      ["day", DAY_TRIGGERS],
      ["swing", SWING_TRIGGERS],
      ["leap", LEAP_TRIGGERS],
    ]);
  }

  /**
   * Evaluate all triggers for a snapshot
   * Returns the highest priority trigger that fired
   */
  evaluateTriggers(
    mode: CoachingMode,
    snapshot: DripCoachSnapshot,
    prevSnapshot?: DripCoachSnapshot,
    canTriggerFn?: (type: TriggerType, cooldown: number) => boolean
  ): TriggerResult | null {
    const triggers = this.triggers.get(mode) || SCALP_TRIGGERS;
    const results: TriggerResult[] = [];

    for (const trigger of triggers) {
      // Check cooldown if function provided
      if (canTriggerFn && !canTriggerFn(trigger.type, trigger.cooldownSeconds)) {
        continue;
      }

      const result = this.evaluateSingleTrigger(trigger, snapshot, prevSnapshot);
      if (result.triggered) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      return null;
    }

    // Return highest priority trigger
    results.sort((a, b) => b.priority - a.priority);
    return results[0];
  }

  /**
   * Evaluate a single trigger
   */
  private evaluateSingleTrigger(
    trigger: CoachingTrigger,
    snapshot: DripCoachSnapshot,
    prevSnapshot?: DripCoachSnapshot
  ): TriggerResult {
    const baseResult: TriggerResult = {
      triggered: false,
      type: trigger.type,
      priority: trigger.priority,
    };

    switch (trigger.type) {
      case "R_MILESTONE":
        return this.checkRMilestone(snapshot, prevSnapshot, baseResult);

      case "KEY_LEVEL_HIT":
        return this.checkKeyLevelHit(snapshot, baseResult);

      case "VOLUME_SPIKE":
        return this.checkVolumeSpike(snapshot, baseResult);

      case "MOMENTUM_STALL":
        return this.checkMomentumStall(snapshot, prevSnapshot, baseResult);

      case "STOP_PROXIMITY":
        return this.checkStopProximity(snapshot, baseResult);

      case "TARGET_PROXIMITY":
        return this.checkTargetProximity(snapshot, baseResult);

      case "THETA_DECAY":
        return this.checkThetaDecay(snapshot, baseResult);

      case "TIME_WARNING":
        return this.checkTimeWarning(snapshot, baseResult);

      case "ECONOMIC_EVENT_IMMINENT":
        return this.checkEconomicEventImminent(snapshot, baseResult);

      case "ECONOMIC_EVENT_TOMORROW":
        return this.checkEconomicEventTomorrow(snapshot, baseResult);

      case "SESSION_CHANGE":
        return this.checkSessionChange(snapshot, prevSnapshot, baseResult);

      case "REGIME_SHIFT":
        return this.checkRegimeShift(snapshot, prevSnapshot, baseResult);

      case "EOD_APPROACH":
        return this.checkEODApproach(snapshot, baseResult);

      case "EARNINGS_APPROACHING":
        return this.checkEarningsApproaching(snapshot, baseResult);

      case "IV_SHIFT":
        return this.checkIVShift(snapshot, prevSnapshot, baseResult);

      case "DAILY_CHECKIN":
        return this.checkDailyCheckin(snapshot, trigger, baseResult);

      case "WEEKLY_REVIEW":
        return this.checkWeeklyReview(snapshot, trigger, baseResult);

      default:
        return baseResult;
    }
  }

  // ============= Individual Trigger Checks =============

  private checkRMilestone(
    snapshot: DripCoachSnapshot,
    prevSnapshot: DripCoachSnapshot | undefined,
    result: TriggerResult
  ): TriggerResult {
    const rNow = Math.floor(snapshot.position.rMultiple * 2) / 2; // Round to 0.5R
    const rPrev = prevSnapshot ? Math.floor(prevSnapshot.position.rMultiple * 2) / 2 : 0;

    // Check if we crossed a milestone (0.5R, 1R, 1.5R, etc.)
    if (rNow !== rPrev && Math.abs(rNow) >= 0.5) {
      return {
        ...result,
        triggered: true,
        reason: `R-multiple changed from ${rPrev}R to ${rNow}R`,
        data: { rMultiple: rNow, previousR: rPrev },
      };
    }

    return result;
  }

  private checkKeyLevelHit(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    if (snapshot.structure.keyLevelProximity === "at_level") {
      return {
        ...result,
        triggered: true,
        reason: `At ${snapshot.structure.nearestLevelName || "key level"}`,
        data: {
          levelName: snapshot.structure.nearestLevelName,
          distance: snapshot.structure.nearestLevelDistance,
        },
      };
    }

    return result;
  }

  private checkVolumeSpike(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    if (snapshot.market.volumeRatio > 2.0) {
      const direction = snapshot.market.momentum.includes("bull") ? "bullish" : "bearish";
      return {
        ...result,
        triggered: true,
        reason: `Volume spike: ${snapshot.market.volumeRatio.toFixed(1)}x average`,
        data: {
          volumeRatio: snapshot.market.volumeRatio,
          direction,
        },
      };
    }

    return result;
  }

  private checkMomentumStall(
    snapshot: DripCoachSnapshot,
    prevSnapshot: DripCoachSnapshot | undefined,
    result: TriggerResult
  ): TriggerResult {
    if (!prevSnapshot) return result;

    const priceChange = Math.abs(snapshot.market.lastPrice - prevSnapshot.market.lastPrice);
    const threshold = snapshot.market.atr * 0.1; // Less than 10% ATR

    if (priceChange < threshold && snapshot.position.timeInTradeBars > 3) {
      return {
        ...result,
        triggered: true,
        reason: `Momentum stalling - ${snapshot.position.timeInTradeBars} bars with minimal movement`,
        data: {
          barsWithoutProgress: snapshot.position.timeInTradeBars,
          priceChange,
        },
      };
    }

    return result;
  }

  private checkStopProximity(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    if (snapshot.position.distanceToStopATR < 0.3) {
      return {
        ...result,
        triggered: true,
        reason: `CRITICAL: ${snapshot.position.distanceToStopATR.toFixed(2)} ATR from stop`,
        data: {
          distanceATR: snapshot.position.distanceToStopATR,
          stopPrice: snapshot.position.stopPrice,
          currentPrice: snapshot.position.currentPrice,
        },
      };
    }

    return result;
  }

  private checkTargetProximity(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    if (snapshot.position.distanceToT1ATR < 0.2) {
      return {
        ...result,
        triggered: true,
        reason: `Approaching T1: ${snapshot.position.distanceToT1ATR.toFixed(2)} ATR away`,
        data: {
          distanceATR: snapshot.position.distanceToT1ATR,
          targetPrice: snapshot.position.targets.t1,
        },
      };
    }

    return result;
  }

  private checkThetaDecay(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    // Only for 0DTE options
    if (!snapshot.greeks || snapshot.trade.dte > 0) {
      return result;
    }

    // Check if theta cost is significant and trade has been open a while
    if (snapshot.position.timeInTradeBars > 5 && Math.abs(snapshot.greeks.thetaPerMinute) > 0.02) {
      return {
        ...result,
        triggered: true,
        reason: `Theta decay: $${snapshot.greeks.thetaCostSinceEntry.toFixed(2)} burned in ${snapshot.position.timeInTradeMinutes} min`,
        data: {
          thetaPerMinute: snapshot.greeks.thetaPerMinute,
          thetaCost: snapshot.greeks.thetaCostSinceEntry,
          timeInTrade: snapshot.position.timeInTradeMinutes,
        },
      };
    }

    return result;
  }

  private checkTimeWarning(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    // Warn if scalp is taking too long
    if (snapshot.trade.tradeType === "Scalp" && snapshot.position.timeInTradeMinutes > 8) {
      return {
        ...result,
        triggered: true,
        reason: `Extended scalp: ${snapshot.position.timeInTradeMinutes} minutes`,
        data: {
          timeInTradeMinutes: snapshot.position.timeInTradeMinutes,
        },
      };
    }

    return result;
  }

  private checkEconomicEventImminent(
    snapshot: DripCoachSnapshot,
    result: TriggerResult
  ): TriggerResult {
    const event = snapshot.economicContext.nextHighImpactEvent;

    if (event && event.hoursUntil <= 1 && event.affectsSymbol) {
      return {
        ...result,
        triggered: true,
        reason: `${event.name} in ${Math.round(event.hoursUntil * 60)} minutes`,
        data: {
          eventName: event.name,
          hoursUntil: event.hoursUntil,
          impact: event.impact,
        },
      };
    }

    return result;
  }

  private checkEconomicEventTomorrow(
    snapshot: DripCoachSnapshot,
    result: TriggerResult
  ): TriggerResult {
    const event = snapshot.economicContext.nextHighImpactEvent;

    if (event && event.hoursUntil <= 24 && event.hoursUntil > 1) {
      return {
        ...result,
        triggered: true,
        reason: `${event.name} in ${Math.round(event.hoursUntil)} hours`,
        data: {
          eventName: event.name,
          hoursUntil: event.hoursUntil,
          impact: event.impact,
        },
      };
    }

    return result;
  }

  private checkSessionChange(
    snapshot: DripCoachSnapshot,
    prevSnapshot: DripCoachSnapshot | undefined,
    result: TriggerResult
  ): TriggerResult {
    if (!prevSnapshot) return result;

    if (snapshot.timeContext.timeWindow !== prevSnapshot.timeContext.timeWindow) {
      return {
        ...result,
        triggered: true,
        reason: `Session change: ${prevSnapshot.timeContext.timeWindowLabel} → ${snapshot.timeContext.timeWindowLabel}`,
        data: {
          previousWindow: prevSnapshot.timeContext.timeWindow,
          newWindow: snapshot.timeContext.timeWindow,
        },
      };
    }

    return result;
  }

  private checkRegimeShift(
    snapshot: DripCoachSnapshot,
    prevSnapshot: DripCoachSnapshot | undefined,
    result: TriggerResult
  ): TriggerResult {
    if (!prevSnapshot) return result;

    if (snapshot.volatilityContext.marketRegime !== prevSnapshot.volatilityContext.marketRegime) {
      return {
        ...result,
        triggered: true,
        reason: `Regime shift: ${prevSnapshot.volatilityContext.marketRegime} → ${snapshot.volatilityContext.marketRegime}`,
        data: {
          previousRegime: prevSnapshot.volatilityContext.marketRegime,
          newRegime: snapshot.volatilityContext.marketRegime,
        },
      };
    }

    return result;
  }

  private checkEODApproach(snapshot: DripCoachSnapshot, result: TriggerResult): TriggerResult {
    if (snapshot.timeContext.minutesToClose <= 15) {
      return {
        ...result,
        triggered: true,
        reason: `${snapshot.timeContext.minutesToClose} minutes to close`,
        data: {
          minutesToClose: snapshot.timeContext.minutesToClose,
        },
      };
    }

    return result;
  }

  private checkEarningsApproaching(
    snapshot: DripCoachSnapshot,
    result: TriggerResult
  ): TriggerResult {
    const earnings = snapshot.economicContext.earningsProximity;

    if (earnings && earnings.daysUntil <= 3 && earnings.daysUntil > 0) {
      return {
        ...result,
        triggered: true,
        reason: `${earnings.symbol} earnings in ${earnings.daysUntil} days`,
        data: {
          symbol: earnings.symbol,
          daysUntil: earnings.daysUntil,
          timing: earnings.timing,
        },
      };
    }

    return result;
  }

  private checkIVShift(
    snapshot: DripCoachSnapshot,
    prevSnapshot: DripCoachSnapshot | undefined,
    result: TriggerResult
  ): TriggerResult {
    if (!snapshot.greeks || !prevSnapshot?.greeks) return result;

    const shift = Math.abs(snapshot.greeks.ivPercentile - prevSnapshot.greeks.ivPercentile);

    // 15+ percentile move is significant
    if (shift > 15) {
      return {
        ...result,
        triggered: true,
        reason: `IV shifted ${shift > 0 ? "+" : ""}${shift.toFixed(0)} percentile`,
        data: {
          previousIVPercentile: prevSnapshot.greeks.ivPercentile,
          newIVPercentile: snapshot.greeks.ivPercentile,
          shift,
        },
      };
    }

    return result;
  }

  private checkDailyCheckin(
    snapshot: DripCoachSnapshot,
    trigger: CoachingTrigger,
    result: TriggerResult
  ): TriggerResult {
    // Check if it's after market close (4:05 PM ET)
    if (
      trigger.triggerTime &&
      snapshot.timeContext.minutesToClose <= 0 &&
      snapshot.timeContext.minutesToClose > -10
    ) {
      return {
        ...result,
        triggered: true,
        reason: "Daily EOD check-in",
        data: {},
      };
    }

    return result;
  }

  private checkWeeklyReview(
    snapshot: DripCoachSnapshot,
    trigger: CoachingTrigger,
    result: TriggerResult
  ): TriggerResult {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Friday = 5
    if (
      trigger.triggerDay === dayOfWeek &&
      snapshot.timeContext.minutesToClose <= 0 &&
      snapshot.timeContext.minutesToClose > -10
    ) {
      return {
        ...result,
        triggered: true,
        reason: "Weekly review (Friday EOD)",
        data: {},
      };
    }

    return result;
  }

  /**
   * Get trigger definitions for a mode
   */
  getTriggersForMode(mode: CoachingMode): CoachingTrigger[] {
    return this.triggers.get(mode) || SCALP_TRIGGERS;
  }
}

// Singleton instance
let triggerEngineInstance: TriggerEngine | null = null;

export function getTriggerEngine(): TriggerEngine {
  if (!triggerEngineInstance) {
    triggerEngineInstance = new TriggerEngine();
  }
  return triggerEngineInstance;
}
