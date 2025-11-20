/**
 * HDAIRecommendations.tsx - AI-Powered Profit Optimization Recommendations
 *
 * Displays profit optimization recommendations with one-click approval workflow.
 * Shows trim/exit/trail-stop suggestions based on analysis.
 */

import { useState, useEffect } from 'react';
import { useTradeStore } from '../../stores/tradeStore';
import { useMarketDataStore } from '../../stores/marketDataStore';
import {
  getTradeRecommendations,
  approveRecommendation,
  dismissRecommendation,
  ProfitRecommendation,
  generateProfitRecommendations,
  calculateTechnicalLevels,
} from '../../services/profitOptimizationService';
import { analyzeAndAlertFlow } from '../../services/flowAnalysisService';
import { getTradeGreeks } from '../../services/greeksMonitorService';
import { Lightbulb, TrendingUp, TrendingDown, Target, ShieldAlert, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HDAIRecommendationsProps {
  maxRecommendations?: number;
}

export function HDAIRecommendations({ maxRecommendations = 5 }: HDAIRecommendationsProps) {
  const activeTrades = useTradeStore((state) => state.getEnteredTrades());
  const [recommendations, setRecommendations] = useState<ProfitRecommendation[]>([]);

  // Generate recommendations for all active trades
  useEffect(() => {
    const allRecs: ProfitRecommendation[] = [];

    activeTrades.forEach((trade) => {
      // Get current data
      const symbolData = useMarketDataStore.getState().getSymbolData(trade.ticker);
      const currentPrice = symbolData?.candles[symbolData.primaryTimeframe]?.[
        symbolData.candles[symbolData.primaryTimeframe].length - 1
      ]?.close || trade.currentPrice || 0;

      const confluence = useMarketDataStore.getState().getConfluence(trade.ticker);
      if (!confluence) return;

      // Get flow metrics
      const flowMetrics = analyzeAndAlertFlow(trade.ticker, trade.id);

      // Get Greeks
      const greeksSnapshot = getTradeGreeks(trade.id);

      // Get technical levels
      const technicalLevels = calculateTechnicalLevels(trade.ticker);

      // Generate recommendations
      const recs = generateProfitRecommendations({
        trade,
        currentPrice,
        confluence,
        flowMetrics: flowMetrics || undefined,
        technicalLevels,
        greeks: greeksSnapshot
          ? {
              delta: greeksSnapshot.greeks.delta,
              gamma: greeksSnapshot.greeks.gamma,
              theta: greeksSnapshot.greeks.theta,
              vega: greeksSnapshot.greeks.vega,
              thetaPerDay: greeksSnapshot.greeks.theta,
              daysToExpiry: greeksSnapshot.daysToExpiry,
            }
          : undefined,
      });

      allRecs.push(...recs);
    });

    // Sort by priority and confidence
    const sortedRecs = allRecs
      .filter((r) => !r.isDismissed)
      .sort((a, b) => {
        // Priority order
        const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by confidence
        return (b.confidence || 0) - (a.confidence || 0);
      })
      .slice(0, maxRecommendations);

    setRecommendations(sortedRecs);
  }, [activeTrades, maxRecommendations]);

  const handleApprove = (rec: ProfitRecommendation) => {
    approveRecommendation(rec.id);
    // Remove from display
    setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
    console.log('[HDAIRecommendations] Approved:', rec.title);
    // TODO: Execute the action (integrate with trade execution service)
  };

  const handleDismiss = (rec: ProfitRecommendation) => {
    dismissRecommendation(rec.id);
    setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
    console.log('[HDAIRecommendations] Dismissed:', rec.title);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TRIM':
        return <TrendingDown className="w-3 h-3" />;
      case 'EXIT':
        return <ShieldAlert className="w-3 h-3" />;
      case 'TRAIL_STOP':
        return <Target className="w-3 h-3" />;
      case 'HOLD':
        return <TrendingUp className="w-3 h-3" />;
      default:
        return <Lightbulb className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return '#F97316'; // Orange
      case 'HIGH':
        return '#F59E0B'; // Amber
      case 'MEDIUM':
        return '#3B82F6'; // Blue
      case 'LOW':
        return '#6B7280'; // Gray
      default:
        return '#6B7280';
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-[var(--brand-primary)]" />
        <h3 className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wider">
          AI Recommendations
        </h3>
        {recommendations.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-[10px] font-bold">
            {recommendations.length}
          </span>
        )}
      </div>

      {/* Recommendations */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
        {recommendations.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">No recommendations</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              AI will suggest actions as opportunities arise
            </p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] shadow-sm"
              style={{
                borderLeftWidth: '3px',
                borderLeftColor: getPriorityColor(rec.priority),
              }}
            >
              {/* Header */}
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-shrink-0 mt-0.5" style={{ color: getPriorityColor(rec.priority) }}>
                  {getTypeIcon(rec.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[var(--text-high)] truncate">
                        {rec.ticker}
                      </div>
                      <div className="text-[11px] font-semibold text-[var(--text-high)] mt-0.5">
                        {rec.title}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${getPriorityColor(rec.priority)}20`,
                          color: getPriorityColor(rec.priority),
                        }}
                      >
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-2">
                {rec.reasoning}
              </p>

              {/* Metrics */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                {rec.suggestedPercent && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Action:</span>
                    <span className="text-[10px] font-bold text-[var(--brand-primary)]">
                      {rec.type} {rec.suggestedPercent}%
                    </span>
                  </div>
                )}
                {rec.winProbability && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Win %:</span>
                    <span className="text-[10px] font-mono font-bold text-[var(--text-high)]">
                      {rec.winProbability.toFixed(0)}%
                    </span>
                  </div>
                )}
                {rec.confidence && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--text-muted)]">Confidence:</span>
                    <span className="text-[10px] font-mono font-bold text-[var(--text-high)]">
                      {rec.confidence}%
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(rec)}
                  className="flex-1 px-3 py-1.5 rounded bg-[var(--brand-primary)] text-[var(--bg-base)] text-xs font-medium hover:bg-[var(--brand-primary)]/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3 h-3" />
                  Approve
                  {rec.suggestedPercent && ` ${rec.suggestedPercent}%`}
                </button>
                <button
                  onClick={() => handleDismiss(rec)}
                  className="px-3 py-1.5 rounded bg-[var(--surface-3)] text-[var(--text-muted)] text-xs font-medium hover:bg-[var(--surface-3)]/70 transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
              </div>

              {/* Additional Context */}
              {(rec.historicalPattern || rec.technicalLevel || rec.flowMetrics) && (
                <div className="mt-2 pt-2 border-t border-[var(--border-hairline)]">
                  <div className="text-[10px] text-[var(--text-muted)] space-y-0.5">
                    {rec.historicalPattern && (
                      <div>📊 {rec.historicalPattern}</div>
                    )}
                    {rec.technicalLevel && (
                      <div>📍 {rec.technicalLevel}</div>
                    )}
                    {rec.flowMetrics?.divergence.detected && (
                      <div>🌊 Flow divergence: {rec.flowMetrics.divergence.type}</div>
                    )}
                  </div>
                </div>
              )}
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
