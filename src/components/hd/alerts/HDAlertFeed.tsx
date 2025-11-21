/**
 * HDAlertFeed.tsx - Real-Time Alert Feed
 *
 * Displays tiered alerts (INFO/WARNING/URGENT/CRITICAL) in a scrolling feed.
 * Color-coded by severity with actionable quick buttons.
 */

import { useEffect, useState } from 'react';
import { useAlertEscalationStore, getSeverityColor, getSeverityEmoji } from '../../stores/alertEscalationStore';
import { Bell, X, Check, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HDAlertFeedProps {
  maxAlerts?: number;
  showDismissed?: boolean;
  tradeId?: string; // Filter by specific trade
}

export function HDAlertFeed({ maxAlerts = 10, showDismissed = false, tradeId }: HDAlertFeedProps) {
  const alerts = useAlertEscalationStore((state) => state.alerts);
  const dismissAlert = useAlertEscalationStore((state) => state.dismissAlert);
  const markAsRead = useAlertEscalationStore((state) => state.markAsRead);
  const criticalCount = useAlertEscalationStore((state) => state.getCriticalCount());

  // Filter and sort alerts
  const filteredAlerts = alerts
    .filter((a) => {
      if (!showDismissed && a.isDismissed) return false;
      if (tradeId && a.tradeId !== tradeId) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by severity (critical first), then timestamp (newest first)
      const severityOrder = { CRITICAL: 0, URGENT: 1, WARNING: 2, INFO: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp - a.timestamp;
    })
    .slice(0, maxAlerts);

  const unreadCount = alerts.filter((a) => !a.isRead && !a.isDismissed).length;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--text-muted)]" />
          <h3 className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wider">
            Alerts
          </h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent-negative)] text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-1 text-[var(--accent-negative)]">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[10px] font-bold">{criticalCount} CRITICAL</span>
          </div>
        )}
      </div>

      {/* Alert Feed */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
        {filteredAlerts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">No alerts</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'p-2.5 rounded-lg border transition-all duration-200',
                alert.isRead
                  ? 'bg-[var(--surface-2)] border-[var(--border-hairline)] opacity-70'
                  : 'bg-[var(--surface-2)] border-[var(--border-hairline)] shadow-sm',
                alert.isDismissed && 'hidden'
              )}
              style={{
                borderLeftWidth: '3px',
                borderLeftColor: getSeverityColor(alert.severity),
              }}
              onClick={() => !alert.isRead && markAsRead(alert.id)}
            >
              {/* Alert Header */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <span className="text-sm flex-shrink-0">{getSeverityEmoji(alert.severity)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[var(--text-high)] truncate">
                      {alert.ticker}
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--text-high)] mt-0.5">
                      {alert.title}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--surface-3)] transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3 h-3 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Alert Message */}
              <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-2">
                {alert.message}
              </p>

              {/* Action Button */}
              {alert.isActionable && alert.actionLabel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Handle action
                    console.log('[HDAlertFeed] Action clicked:', alert.actionType, alert.actionPayload);
                  }}
                  className={cn(
                    'w-full px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                    alert.severity === 'CRITICAL'
                      ? 'bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/30'
                      : alert.severity === 'URGENT'
                      ? 'bg-[#F97316]/20 text-[#F97316] hover:bg-[#F97316]/30'
                      : 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/30'
                  )}
                >
                  <Check className="w-3 h-3" />
                  {alert.actionLabel}
                </button>
              )}

              {/* Timestamp */}
              <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--surface-1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--surface-3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
