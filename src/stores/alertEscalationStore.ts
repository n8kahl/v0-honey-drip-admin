/**
 * alertEscalationStore.ts - Tiered Alert Management System
 *
 * Manages real-time alerts with severity-based escalation for active trades.
 * Integrates with Discord, flow analysis, Greeks monitoring, and profit optimization.
 *
 * Alert Tiers:
 * - INFO (🟢): Positive updates, milestones reached
 * - WARNING (🟡): Caution signals, risk approaching
 * - URGENT (🟠): Immediate attention needed
 * - CRITICAL (🔴): Emergency action required
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = 'INFO' | 'WARNING' | 'URGENT' | 'CRITICAL';
export type AlertCategory =
  | 'pnl'
  | 'flow'
  | 'greeks'
  | 'confluence'
  | 'risk'
  | 'technical'
  | 'profit-optimization'
  | 'position-management';

export interface Alert {
  id: string;
  tradeId: string;
  ticker: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  isDismissed: boolean;
  isActionable: boolean; // Can user take immediate action?
  actionLabel?: string; // e.g., "Trim 25%", "Exit Now", "Move SL"
  actionType?: 'trim' | 'exit' | 'move-sl' | 'add' | 'custom';
  actionPayload?: any; // Data for the action
  metadata?: Record<string, any>; // Additional context
}

export interface EscalationRule {
  id: string;
  category: AlertCategory;
  condition: (context: EscalationContext) => boolean;
  severity: AlertSeverity;
  title: string;
  messageTemplate: (context: EscalationContext) => string;
  isActionable?: boolean;
  actionLabel?: string;
  actionType?: 'trim' | 'exit' | 'move-sl' | 'add' | 'custom';
  actionPayload?: (context: EscalationContext) => any;
}

export interface EscalationContext {
  tradeId: string;
  ticker: string;
  currentPrice: number;
  entryPrice: number;
  stopLoss?: number;
  targetPrice?: number;
  pnlPercent: number;
  confluence: number;
  confluencePrev?: number;
  flowVelocity?: number; // Rate of change in flow
  flowPressure?: number; // Current buy/sell pressure
  thetaPerDay?: number;
  gammaRisk?: number;
  vegaExposure?: number;
  distanceToStopPercent?: number;
  distanceToTargetPercent?: number;
  volumeRatio?: number; // Current volume vs average
  [key: string]: any;
}

interface AlertEscalationStore {
  // State
  alerts: Alert[];
  rules: EscalationRule[];
  isEnabled: boolean;
  lastCheckTimestamp: number;

  // Settings
  maxAlertsPerTrade: number; // Prevent spam
  alertCooldownMs: number; // Min time between same alerts
  autoTrimEnabled: boolean; // Global auto-trim toggle

  // Actions
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'isRead' | 'isDismissed'>) => void;
  dismissAlert: (alertId: string) => void;
  markAsRead: (alertId: string) => void;
  clearAlerts: () => void;
  clearAlertsForTrade: (tradeId: string) => void;

  // Escalation engine
  checkEscalation: (context: EscalationContext) => void;
  registerRule: (rule: EscalationRule) => void;

  // Selectors
  getAlertsByTrade: (tradeId: string) => Alert[];
  getUnreadAlerts: () => Alert[];
  getActionableAlerts: () => Alert[];
  getAlertsBySeverity: (severity: AlertSeverity) => Alert[];
  getCriticalCount: () => number;

  // Settings
  setAutoTrimEnabled: (enabled: boolean) => void;
  setEnabled: (enabled: boolean) => void;
}

// ============================================================================
// Default Escalation Rules
// ============================================================================

const DEFAULT_RULES: EscalationRule[] = [
  // ===== P&L ALERTS =====
  {
    id: 'pnl-profit-milestone-10',
    category: 'pnl',
    condition: (ctx) => ctx.pnlPercent >= 10 && ctx.pnlPercent < 20,
    severity: 'INFO',
    title: 'Profit Milestone',
    messageTemplate: (ctx) => `Position up ${ctx.pnlPercent.toFixed(1)}% - Consider scaling out`,
  },
  {
    id: 'pnl-profit-milestone-25',
    category: 'pnl',
    condition: (ctx) => ctx.pnlPercent >= 25 && ctx.pnlPercent < 40,
    severity: 'INFO',
    title: 'Strong Profit',
    messageTemplate: (ctx) => `Position up ${ctx.pnlPercent.toFixed(1)}% - Excellent entry!`,
    isActionable: true,
    actionLabel: 'Trim 25%',
    actionType: 'trim',
    actionPayload: (ctx) => ({ trimPercent: 25 }),
  },
  {
    id: 'pnl-loss-warning',
    category: 'pnl',
    condition: (ctx) => ctx.pnlPercent <= -10 && ctx.pnlPercent > -15,
    severity: 'WARNING',
    title: 'Loss Approaching',
    messageTemplate: (ctx) => `Position down ${Math.abs(ctx.pnlPercent).toFixed(1)}% - Review setup`,
  },
  {
    id: 'pnl-loss-critical',
    category: 'pnl',
    condition: (ctx) => ctx.pnlPercent <= -20,
    severity: 'CRITICAL',
    title: 'Heavy Loss',
    messageTemplate: (ctx) => `Position down ${Math.abs(ctx.pnlPercent).toFixed(1)}% - Cut losses?`,
    isActionable: true,
    actionLabel: 'Exit Position',
    actionType: 'exit',
  },

  // ===== STOP LOSS ALERTS =====
  {
    id: 'risk-stop-near',
    category: 'risk',
    condition: (ctx) => ctx.distanceToStopPercent !== undefined && ctx.distanceToStopPercent < 5 && ctx.distanceToStopPercent > 0,
    severity: 'WARNING',
    title: 'Stop Loss Approaching',
    messageTemplate: (ctx) => `Stop loss within ${ctx.distanceToStopPercent?.toFixed(1)}% - High risk`,
  },
  {
    id: 'risk-stop-breached',
    category: 'risk',
    condition: (ctx) => ctx.distanceToStopPercent !== undefined && ctx.distanceToStopPercent <= 0,
    severity: 'CRITICAL',
    title: 'Stop Loss Breached',
    messageTemplate: (ctx) => `Price below stop loss at $${ctx.stopLoss} - Exit immediately!`,
    isActionable: true,
    actionLabel: 'Exit Now',
    actionType: 'exit',
  },

  // ===== CONFLUENCE ALERTS =====
  {
    id: 'confluence-deterioration',
    category: 'confluence',
    condition: (ctx) => {
      const drop = (ctx.confluencePrev || 0) - ctx.confluence;
      return drop >= 15 && ctx.confluence < 60;
    },
    severity: 'WARNING',
    title: 'Confluence Weakening',
    messageTemplate: (ctx) => {
      const drop = ((ctx.confluencePrev || 0) - ctx.confluence).toFixed(0);
      return `Confluence dropped ${drop} points to ${ctx.confluence} - Setup deteriorating`;
    },
  },
  {
    id: 'confluence-collapse',
    category: 'confluence',
    condition: (ctx) => {
      const drop = (ctx.confluencePrev || 0) - ctx.confluence;
      return drop >= 25;
    },
    severity: 'URGENT',
    title: 'Confluence Collapse',
    messageTemplate: (ctx) => {
      const drop = ((ctx.confluencePrev || 0) - ctx.confluence).toFixed(0);
      return `Confluence dropped ${drop} points rapidly - Major setup change detected`;
    },
    isActionable: true,
    actionLabel: 'Trim 50%',
    actionType: 'trim',
    actionPayload: (ctx) => ({ trimPercent: 50 }),
  },

  // ===== FLOW ALERTS =====
  {
    id: 'flow-surge-bullish',
    category: 'flow',
    condition: (ctx) => (ctx.flowVelocity || 0) > 2 && (ctx.flowPressure || 0) > 70,
    severity: 'INFO',
    title: 'Bullish Flow Surge',
    messageTemplate: (ctx) => `Unusual buying pressure detected - Flow velocity ${ctx.flowVelocity?.toFixed(1)}x normal`,
  },
  {
    id: 'flow-surge-bearish',
    category: 'flow',
    condition: (ctx) => (ctx.flowVelocity || 0) > 2 && (ctx.flowPressure || 0) < 30,
    severity: 'WARNING',
    title: 'Bearish Flow Surge',
    messageTemplate: (ctx) => `Unusual selling pressure detected - Flow velocity ${ctx.flowVelocity?.toFixed(1)}x normal`,
  },
  {
    id: 'flow-divergence',
    category: 'flow',
    condition: (ctx) => {
      // Price up but flow bearish, or price down but flow bullish
      const priceBullish = ctx.pnlPercent > 0;
      const flowBullish = (ctx.flowPressure || 50) > 60;
      return priceBullish !== flowBullish && Math.abs(ctx.pnlPercent) > 5;
    },
    severity: 'WARNING',
    title: 'Flow Divergence',
    messageTemplate: (ctx) => {
      const priceBullish = ctx.pnlPercent > 0;
      return `Price ${priceBullish ? 'rising' : 'falling'} but flow is ${priceBullish ? 'bearish' : 'bullish'} - Possible reversal`;
    },
  },

  // ===== GREEKS ALERTS =====
  {
    id: 'greeks-theta-burn',
    category: 'greeks',
    condition: (ctx) => (ctx.thetaPerDay || 0) < -500,
    severity: 'WARNING',
    title: 'High Theta Decay',
    messageTemplate: (ctx) => `Losing $${Math.abs(ctx.thetaPerDay || 0).toFixed(0)}/day to time decay - Move needed`,
  },
  {
    id: 'greeks-gamma-spike',
    category: 'greeks',
    condition: (ctx) => (ctx.gammaRisk || 0) > 0.5,
    severity: 'URGENT',
    title: 'Gamma Explosion Risk',
    messageTemplate: (ctx) => `High gamma exposure detected - Position could move violently`,
  },
  {
    id: 'greeks-vega-crush',
    category: 'greeks',
    condition: (ctx) => (ctx.vegaExposure || 0) < -1000,
    severity: 'WARNING',
    title: 'Vega Collapse',
    messageTemplate: (ctx) => `IV dropping - Losing $${Math.abs(ctx.vegaExposure || 0).toFixed(0)} to volatility crush`,
  },

  // ===== TECHNICAL ALERTS =====
  {
    id: 'technical-target-near',
    category: 'technical',
    condition: (ctx) => ctx.distanceToTargetPercent !== undefined && ctx.distanceToTargetPercent < 3 && ctx.distanceToTargetPercent > 0,
    severity: 'INFO',
    title: 'Target Approaching',
    messageTemplate: (ctx) => `Target price within ${ctx.distanceToTargetPercent?.toFixed(1)}% - Take profits?`,
    isActionable: true,
    actionLabel: 'Trim 50%',
    actionType: 'trim',
    actionPayload: (ctx) => ({ trimPercent: 50 }),
  },
  {
    id: 'technical-volume-spike',
    category: 'technical',
    condition: (ctx) => (ctx.volumeRatio || 1) > 2,
    severity: 'INFO',
    title: 'Volume Spike',
    messageTemplate: (ctx) => `Volume ${ctx.volumeRatio?.toFixed(1)}x above average - Institutional activity`,
  },
];

// ============================================================================
// Store Implementation
// ============================================================================

export const useAlertEscalationStore = create<AlertEscalationStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      alerts: [],
      rules: DEFAULT_RULES,
      isEnabled: true,
      lastCheckTimestamp: 0,
      maxAlertsPerTrade: 10,
      alertCooldownMs: 60000, // 1 minute cooldown between same alerts
      autoTrimEnabled: false, // Disabled by default - user must enable

      // ======================================================================
      // Actions
      // ======================================================================

      addAlert: (alertData) => {
        const newAlert: Alert = {
          ...alertData,
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          isRead: false,
          isDismissed: false,
        };

        set((state) => {
          // Check cooldown - don't add duplicate alerts too quickly
          const recentSimilar = state.alerts.find(
            (a) =>
              a.tradeId === newAlert.tradeId &&
              a.category === newAlert.category &&
              a.severity === newAlert.severity &&
              Date.now() - a.timestamp < state.alertCooldownMs &&
              !a.isDismissed
          );

          if (recentSimilar) {
            console.log('[AlertEscalation] Cooldown active for similar alert, skipping');
            return state;
          }

          // Limit alerts per trade to prevent spam
          const tradeAlerts = state.alerts.filter(
            (a) => a.tradeId === newAlert.tradeId && !a.isDismissed
          );

          if (tradeAlerts.length >= state.maxAlertsPerTrade) {
            // Remove oldest alert for this trade
            const oldestId = tradeAlerts[0].id;
            return {
              alerts: [...state.alerts.filter((a) => a.id !== oldestId), newAlert],
            };
          }

          return {
            alerts: [...state.alerts, newAlert],
          };
        });

        console.log('[AlertEscalation] New alert:', newAlert.severity, newAlert.title);
      },

      dismissAlert: (alertId) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, isDismissed: true, isRead: true } : a
          ),
        }));
      },

      markAsRead: (alertId) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, isRead: true } : a
          ),
        }));
      },

      clearAlerts: () => {
        set({ alerts: [] });
      },

      clearAlertsForTrade: (tradeId) => {
        set((state) => ({
          alerts: state.alerts.filter((a) => a.tradeId !== tradeId),
        }));
      },

      checkEscalation: (context: EscalationContext) => {
        const { rules, isEnabled } = get();

        if (!isEnabled) return;

        // Check each rule
        rules.forEach((rule) => {
          try {
            if (rule.condition(context)) {
              // Rule triggered - add alert
              get().addAlert({
                tradeId: context.tradeId,
                ticker: context.ticker,
                severity: rule.severity,
                category: rule.category,
                title: rule.title,
                message: rule.messageTemplate(context),
                isActionable: rule.isActionable || false,
                actionLabel: rule.actionLabel,
                actionType: rule.actionType,
                actionPayload: rule.actionPayload ? rule.actionPayload(context) : undefined,
                metadata: context,
              });
            }
          } catch (error) {
            console.error('[AlertEscalation] Rule check failed:', rule.id, error);
          }
        });

        set({ lastCheckTimestamp: Date.now() });
      },

      registerRule: (rule) => {
        set((state) => ({
          rules: [...state.rules, rule],
        }));
      },

      // ======================================================================
      // Selectors
      // ======================================================================

      getAlertsByTrade: (tradeId) => {
        return get().alerts.filter(
          (a) => a.tradeId === tradeId && !a.isDismissed
        );
      },

      getUnreadAlerts: () => {
        return get().alerts.filter((a) => !a.isRead && !a.isDismissed);
      },

      getActionableAlerts: () => {
        return get().alerts.filter(
          (a) => a.isActionable && !a.isDismissed
        );
      },

      getAlertsBySeverity: (severity) => {
        return get().alerts.filter(
          (a) => a.severity === severity && !a.isDismissed
        );
      },

      getCriticalCount: () => {
        return get().alerts.filter(
          (a) => a.severity === 'CRITICAL' && !a.isDismissed
        ).length;
      },

      // ======================================================================
      // Settings
      // ======================================================================

      setAutoTrimEnabled: (enabled) => {
        set({ autoTrimEnabled: enabled });
        console.log('[AlertEscalation] Auto-trim', enabled ? 'enabled' : 'disabled');
      },

      setEnabled: (enabled) => {
        set({ isEnabled: enabled });
        console.log('[AlertEscalation] Alert system', enabled ? 'enabled' : 'disabled');
      },
    }),
    { name: 'AlertEscalationStore' }
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/** Calculate distance to stop loss as percentage */
export function calculateDistanceToStop(
  currentPrice: number,
  stopLoss: number
): number {
  return ((currentPrice - stopLoss) / currentPrice) * 100;
}

/** Calculate distance to target as percentage */
export function calculateDistanceToTarget(
  currentPrice: number,
  targetPrice: number
): number {
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}

/** Get severity color for UI */
export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'INFO':
      return '#16A34A'; // Green
    case 'WARNING':
      return '#F59E0B'; // Yellow/Amber
    case 'URGENT':
      return '#F97316'; // Orange
    case 'CRITICAL':
      return '#EF4444'; // Red
  }
}

/** Get severity emoji for Discord/UI */
export function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case 'INFO':
      return '🟢';
    case 'WARNING':
      return '🟡';
    case 'URGENT':
      return '🟠';
    case 'CRITICAL':
      return '🔴';
  }
}
