/**
 * autoPositionService.ts - Automated Position Management
 *
 * Manages auto-trim rules and dynamic stop-loss adjustments with approval workflow:
 * - Auto-trim on confluence drop
 * - Auto-trim at profit milestones
 * - Dynamic trailing stops
 * - Smart re-entry signals
 *
 * ALL actions require one-click approval before execution.
 */

import { Trade } from "../types";
import { ConfluenceScore } from "../stores/marketDataStore";
import { useAlertEscalationStore } from "../stores/alertEscalationStore";
import { useTradeStore } from "../stores/tradeStore";

// ============================================================================
// Types
// ============================================================================

export type AutoActionType = "TRIM" | "EXIT" | "MOVE_SL" | "TRAIL_STOP";

export interface AutoRule {
  id: string;
  tradeId: string;
  type: AutoActionType;
  isActive: boolean;

  // Trigger conditions
  condition: {
    pnlPercentAbove?: number;
    pnlPercentBelow?: number;
    confluenceBelow?: number;
    confluenceDropGreaterThan?: number;
    distanceToStopLessPercent?: number;
  };

  // Action to take
  action: {
    trimPercent?: number; // For TRIM
    moveStopToBreakeven?: boolean; // For TRAIL_STOP
    moveStopToPercent?: number; // For TRAIL_STOP (% retracement)
    exitCompletely?: boolean; // For EXIT
  };

  // Metadata
  createdAt: number;
  lastChecked: number;
  triggeredCount: number;
}

export interface AutoAction {
  id: string;
  ruleId: string;
  tradeId: string;
  ticker: string;
  type: AutoActionType;
  status: "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED";

  // Action details
  description: string;
  trimPercent?: number;
  newStopLoss?: number;
  executionPrice?: number;

  // Approval workflow
  createdAt: number;
  approvedAt?: number;
  executedAt?: number;
  rejectedAt?: number;
  approvedBy?: string; // User ID
}

interface AutoPositionStore {
  rules: Map<string, AutoRule[]>; // tradeId → rules
  pendingActions: AutoAction[];
}

// ============================================================================
// Auto Position Manager
// ============================================================================

class AutoPositionManager {
  private store: AutoPositionStore = {
    rules: new Map(),
    pendingActions: [],
  };

  /**
   * Add an auto-management rule for a trade
   */
  addRule(rule: Omit<AutoRule, "id" | "createdAt" | "lastChecked" | "triggeredCount">): string {
    const newRule: AutoRule = {
      ...rule,
      id: `rule-${crypto.randomUUID()}`,
      createdAt: Date.now(),
      lastChecked: 0,
      triggeredCount: 0,
    };

    const tradeRules = this.store.rules.get(rule.tradeId) || [];
    tradeRules.push(newRule);
    this.store.rules.set(rule.tradeId, tradeRules);

    console.log("[AutoPosition] Rule added:", newRule.type, "for trade", rule.tradeId);
    return newRule.id;
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    for (const [tradeId, rules] of this.store.rules.entries()) {
      const index = rules.findIndex((r) => r.id === ruleId);
      if (index !== -1) {
        rules.splice(index, 1);
        if (rules.length === 0) {
          this.store.rules.delete(tradeId);
        }
        console.log("[AutoPosition] Rule removed:", ruleId);
        return true;
      }
    }
    return false;
  }

  /**
   * Toggle rule active state
   */
  toggleRule(ruleId: string, isActive: boolean) {
    for (const rules of this.store.rules.values()) {
      const rule = rules.find((r) => r.id === ruleId);
      if (rule) {
        rule.isActive = isActive;
        console.log("[AutoPosition] Rule", isActive ? "activated" : "deactivated");
        return true;
      }
    }
    return false;
  }

  /**
   * Check rules for a trade and create pending actions if triggered
   */
  checkRules(
    trade: Trade,
    currentPrice: number,
    confluence: ConfluenceScore,
    confluencePrev?: number
  ) {
    const tradeRules = this.store.rules.get(trade.id) || [];
    const activeRules = tradeRules.filter((r) => r.isActive);

    if (activeRules.length === 0) return;

    const pnlPercent = trade.entryPrice
      ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
      : 0;

    const confluenceDrop = (confluencePrev || 0) - confluence.overall;

    const distanceToStopPercent = trade.stopLoss
      ? ((currentPrice - trade.stopLoss) / currentPrice) * 100
      : 100;

    activeRules.forEach((rule) => {
      const { condition } = rule;

      // Check if condition is met
      let triggered = false;

      if (condition.pnlPercentAbove !== undefined && pnlPercent >= condition.pnlPercentAbove) {
        triggered = true;
      }

      if (condition.pnlPercentBelow !== undefined && pnlPercent <= condition.pnlPercentBelow) {
        triggered = true;
      }

      if (
        condition.confluenceBelow !== undefined &&
        confluence.overall < condition.confluenceBelow
      ) {
        triggered = true;
      }

      if (
        condition.confluenceDropGreaterThan !== undefined &&
        confluenceDrop >= condition.confluenceDropGreaterThan
      ) {
        triggered = true;
      }

      if (
        condition.distanceToStopLessPercent !== undefined &&
        distanceToStopPercent < condition.distanceToStopLessPercent
      ) {
        triggered = true;
      }

      if (triggered) {
        this.createPendingAction(rule, trade, currentPrice, pnlPercent, confluence);
        rule.lastChecked = Date.now();
        rule.triggeredCount++;
      }
    });
  }

  /**
   * Create a pending action that requires approval
   */
  private createPendingAction(
    rule: AutoRule,
    trade: Trade,
    currentPrice: number,
    pnlPercent: number,
    confluence: ConfluenceScore
  ) {
    // Check if there's already a pending action for this rule
    const existing = this.store.pendingActions.find(
      (a) => a.ruleId === rule.id && a.status === "PENDING"
    );

    if (existing) {
      console.log("[AutoPosition] Pending action already exists for rule", rule.id);
      return;
    }

    let description = "";
    let trimPercent: number | undefined;
    let newStopLoss: number | undefined;

    switch (rule.type) {
      case "TRIM":
        trimPercent = rule.action.trimPercent || 25;
        description = `Auto-trim ${trimPercent}% at ${pnlPercent.toFixed(1)}% profit (confluence ${confluence.overall})`;
        break;

      case "EXIT":
        description = `Auto-exit position at ${pnlPercent.toFixed(1)}% (confluence ${confluence.overall})`;
        break;

      case "MOVE_SL":
      case "TRAIL_STOP":
        if (rule.action.moveStopToBreakeven) {
          newStopLoss = trade.entryPrice;
          description = `Auto-trail stop to breakeven at $${trade.entryPrice?.toFixed(2)}`;
        } else if (rule.action.moveStopToPercent) {
          const retracement = rule.action.moveStopToPercent / 100;
          const profit = currentPrice - (trade.entryPrice || currentPrice);
          newStopLoss = (trade.entryPrice || 0) + profit * retracement;
          description = `Auto-trail stop to $${newStopLoss.toFixed(2)} (${rule.action.moveStopToPercent}% retracement)`;
        }
        break;
    }

    const action: AutoAction = {
      id: `action-${crypto.randomUUID()}`,
      ruleId: rule.id,
      tradeId: trade.id,
      ticker: trade.ticker,
      type: rule.type,
      status: "PENDING",
      description,
      trimPercent,
      newStopLoss,
      executionPrice: currentPrice,
      createdAt: Date.now(),
    };

    this.store.pendingActions.push(action);

    console.log("[AutoPosition] Pending action created:", action.description);

    // Trigger alert for approval
    const alertStore = useAlertEscalationStore.getState();
    alertStore.addAlert({
      tradeId: trade.id,
      ticker: trade.ticker,
      severity: "WARNING",
      category: "position-management",
      title: "Auto-Action Pending Approval",
      message: action.description,
      isActionable: true,
      actionLabel: "Approve",
      actionType: "custom",
      actionPayload: { actionId: action.id },
      metadata: {
        autoActionId: action.id,
        autoActionType: action.type,
        trimPercent: action.trimPercent,
        newStopLoss: action.newStopLoss,
      },
    });
  }

  /**
   * Approve a pending action
   */
  approveAction(actionId: string, userId?: string): boolean {
    const action = this.store.pendingActions.find((a) => a.id === actionId);
    if (!action || action.status !== "PENDING") {
      console.error("[AutoPosition] Action not found or not pending:", actionId);
      return false;
    }

    action.status = "APPROVED";
    action.approvedAt = Date.now();
    action.approvedBy = userId;

    console.log("[AutoPosition] Action approved:", action.description);

    // Execute the action asynchronously
    setTimeout(() => {
      this.executeAction(actionId);
    }, 1000);

    return true;
  }

  /**
   * Reject a pending action
   */
  rejectAction(actionId: string): boolean {
    const action = this.store.pendingActions.find((a) => a.id === actionId);
    if (!action || action.status !== "PENDING") {
      console.error("[AutoPosition] Action not found or not pending:", actionId);
      return false;
    }

    action.status = "REJECTED";
    action.rejectedAt = Date.now();

    console.log("[AutoPosition] Action rejected:", action.description);
    return true;
  }

  /**
   * Execute an approved action
   */
  private executeAction(actionId: string) {
    const action = this.store.pendingActions.find((a) => a.id === actionId);
    if (!action || action.status !== "APPROVED") {
      console.error("[AutoPosition] Action not approved:", actionId);
      return;
    }

    action.status = "EXECUTED";
    action.executedAt = Date.now();

    console.log("[AutoPosition] Action executed:", action.description);

    // Execute the action based on type
    try {
      const tradeStore = useTradeStore.getState();
      const trade = tradeStore.activeTrades.find((t) => t.id === action.tradeId);

      if (!trade) {
        console.error("[AutoPosition] Trade not found:", action.tradeId);
        return;
      }

      const tradeRules = this.store.rules.get(action.tradeId) || [];

      switch (action.type) {
        case "TRIM": {
          // Partially exit the position
          const trimRule = tradeRules.find((r) => r.type === "TRIM");
          const trimPercent = trimRule?.action.trimPercent || 50;

          console.log(`[AutoPosition] Trimming ${trimPercent}% of position ${trade.ticker}`);
          tradeStore.updateTrade(trade.id, {
            notes: `${trade.notes || ""}\n[AUTO] Trimmed ${trimPercent}% at ${new Date().toLocaleString()}`,
          });
          break;
        }

        case "EXIT": {
          // Fully exit the position
          console.log(`[AutoPosition] Exiting position ${trade.ticker}`);
          tradeStore.updateTrade(trade.id, {
            state: "EXITED",
            exitTime: new Date(),
            exitPrice: trade.currentPrice,
            notes: `${trade.notes || ""}\n[AUTO] Full exit at ${new Date().toLocaleString()}`,
          });
          break;
        }

        case "MOVE_SL": {
          // Update stop loss
          const moveSlRule = tradeRules.find((r) => r.type === "MOVE_SL");
          if (moveSlRule?.action.moveStopToBreakeven && trade.entryPrice) {
            console.log(`[AutoPosition] Moving stop to breakeven for ${trade.ticker}`);
            tradeStore.updateTrade(trade.id, {
              stopLoss: trade.entryPrice,
              notes: `${trade.notes || ""}\n[AUTO] Stop moved to breakeven at ${new Date().toLocaleString()}`,
            });
          }
          break;
        }

        case "TRAIL_STOP": {
          // Implement trailing stop logic
          const trailRule = tradeRules.find((r) => r.type === "TRAIL_STOP");
          const retracePercent = trailRule?.action.moveStopToPercent || 0.5;

          if (trade.currentPrice && trade.entryPrice) {
            const move = trade.currentPrice - trade.entryPrice;
            const newStop = trade.entryPrice + move * retracePercent;

            console.log(
              `[AutoPosition] Trailing stop for ${trade.ticker} to $${newStop.toFixed(2)}`
            );
            tradeStore.updateTrade(trade.id, {
              stopLoss: newStop,
              notes: `${trade.notes || ""}\n[AUTO] Trailing stop updated to $${newStop.toFixed(2)} at ${new Date().toLocaleString()}`,
            });
          }
          break;
        }

        default:
          console.warn("[AutoPosition] Unknown action type:", action.type);
      }

      // Send alert about action execution
      const alertStore = useAlertEscalationStore.getState();
      alertStore.addAlert({
        tradeId: action.tradeId,
        ticker: trade.ticker,
        severity: "INFO",
        category: "position-management",
        title: "Auto Action Executed",
        message: `Auto action executed: ${action.description}`,
        isActionable: false,
      });
    } catch (error) {
      console.error("[AutoPosition] Failed to execute action:", error);
      action.status = "REJECTED";
    }
  }

  /**
   * Get pending actions
   */
  getPendingActions(): AutoAction[] {
    return this.store.pendingActions.filter((a) => a.status === "PENDING");
  }

  /**
   * Get actions for a specific trade
   */
  getTradeActions(tradeId: string): AutoAction[] {
    return this.store.pendingActions.filter((a) => a.tradeId === tradeId);
  }

  /**
   * Get rules for a specific trade
   */
  getTradeRules(tradeId: string): AutoRule[] {
    return this.store.rules.get(tradeId) || [];
  }

  /**
   * Clear completed actions
   */
  clearCompletedActions() {
    this.store.pendingActions = this.store.pendingActions.filter(
      (a) => a.status === "PENDING" || a.status === "APPROVED"
    );
  }

  /**
   * Clear all rules and actions for a trade (e.g., when trade exits)
   */
  clearTrade(tradeId: string) {
    this.store.rules.delete(tradeId);
    this.store.pendingActions = this.store.pendingActions.filter((a) => a.tradeId !== tradeId);
    console.log("[AutoPosition] Cleared all data for trade", tradeId);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const autoPositionManager = new AutoPositionManager();

// ============================================================================
// Public API
// ============================================================================

/**
 * Add an auto-management rule
 */
export function addAutoRule(
  rule: Omit<AutoRule, "id" | "createdAt" | "lastChecked" | "triggeredCount">
): string {
  return autoPositionManager.addRule(rule);
}

/**
 * Remove a rule
 */
export function removeAutoRule(ruleId: string): boolean {
  return autoPositionManager.removeRule(ruleId);
}

/**
 * Toggle rule active state
 */
export function toggleAutoRule(ruleId: string, isActive: boolean): boolean {
  return autoPositionManager.toggleRule(ruleId, isActive);
}

/**
 * Check rules for a trade
 */
export function checkAutoRules(
  trade: Trade,
  currentPrice: number,
  confluence: ConfluenceScore,
  confluencePrev?: number
) {
  autoPositionManager.checkRules(trade, currentPrice, confluence, confluencePrev);
}

/**
 * Approve a pending action
 */
export function approveAutoAction(actionId: string, userId?: string): boolean {
  return autoPositionManager.approveAction(actionId, userId);
}

/**
 * Reject a pending action
 */
export function rejectAutoAction(actionId: string): boolean {
  return autoPositionManager.rejectAction(actionId);
}

/**
 * Get pending actions
 */
export function getPendingAutoActions(): AutoAction[] {
  return autoPositionManager.getPendingActions();
}

/**
 * Get actions for a trade
 */
export function getTradeAutoActions(tradeId: string): AutoAction[] {
  return autoPositionManager.getTradeActions(tradeId);
}

/**
 * Get rules for a trade
 */
export function getTradeAutoRules(tradeId: string): AutoRule[] {
  return autoPositionManager.getTradeRules(tradeId);
}

/**
 * Clear completed actions
 */
export function clearCompletedAutoActions() {
  autoPositionManager.clearCompletedActions();
}

/**
 * Clear all data for a trade
 */
export function clearTradeAutoData(tradeId: string) {
  autoPositionManager.clearTrade(tradeId);
}

// ============================================================================
// Common Rule Templates
// ============================================================================

/**
 * Create a "trim on profit" rule
 */
export function createTrimOnProfitRule(
  tradeId: string,
  profitPercent: number,
  trimPercent: number
): string {
  return addAutoRule({
    tradeId,
    type: "TRIM",
    isActive: true,
    condition: {
      pnlPercentAbove: profitPercent,
    },
    action: {
      trimPercent,
    },
  });
}

/**
 * Create a "trail stop to breakeven" rule
 */
export function createTrailToBreakevenRule(tradeId: string, profitPercent: number): string {
  return addAutoRule({
    tradeId,
    type: "TRAIL_STOP",
    isActive: true,
    condition: {
      pnlPercentAbove: profitPercent,
    },
    action: {
      moveStopToBreakeven: true,
    },
  });
}

/**
 * Create a "trim on confluence drop" rule
 */
export function createTrimOnConfluenceDropRule(
  tradeId: string,
  confluenceDrop: number,
  trimPercent: number
): string {
  return addAutoRule({
    tradeId,
    type: "TRIM",
    isActive: true,
    condition: {
      confluenceDropGreaterThan: confluenceDrop,
    },
    action: {
      trimPercent,
    },
  });
}

/**
 * Create a "stop loss exit" rule
 */
export function createStopLossExitRule(tradeId: string, distancePercent: number): string {
  return addAutoRule({
    tradeId,
    type: "EXIT",
    isActive: true,
    condition: {
      distanceToStopLessPercent: distancePercent,
    },
    action: {
      exitCompletely: true,
    },
  });
}
