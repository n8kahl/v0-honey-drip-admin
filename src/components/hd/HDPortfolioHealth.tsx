/**
 * HDPortfolioHealth.tsx - Portfolio Health Dashboard
 *
 * Displays aggregate portfolio metrics:
 * - Total P&L across all positions
 * - Portfolio-level Greeks (Delta, Theta, Vega, Gamma)
 * - Risk exposure meters
 */

import { useEffect, useState } from 'react';
import { useTradeStore } from '../../stores/tradeStore';
import { getPortfolioGreeks, PortfolioGreeks } from '../../services/greeksMonitorService';
import { TrendingUp, TrendingDown, Activity, Zap, Wind, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export function HDPortfolioHealth() {
  const activeTrades = useTradeStore((state) => state.activeTrades);
  const [portfolioGreeks, setPortfolioGreeks] = useState<PortfolioGreeks | null>(null);

  // Calculate total P&L
  const totalPnL = activeTrades.reduce((sum, trade) => {
    if (!trade.entryPrice || !trade.currentPrice) return sum;
    const pnlPercent = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
    return sum + pnlPercent;
  }, 0);

  const avgPnL = activeTrades.length > 0 ? totalPnL / activeTrades.length : 0;
  const isProfitable = avgPnL >= 0;

  // Update portfolio Greeks periodically
  useEffect(() => {
    const updateGreeks = () => {
      const greeks = getPortfolioGreeks();
      setPortfolioGreeks(greeks);
    };

    updateGreeks();
    const interval = setInterval(updateGreeks, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [activeTrades]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[var(--text-muted)]" />
        <h3 className="text-xs font-medium text-[var(--text-high)] uppercase tracking-wider">
          Portfolio Health
        </h3>
      </div>

      {activeTrades.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-[var(--text-muted)]">No active trades</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Total P&L */}
          <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-muted)]">Total P&L</span>
              {isProfitable ? (
                <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-[var(--accent-negative)]" />
              )}
            </div>
            <div
              className={cn(
                'text-2xl font-bold',
                isProfitable ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}
            >
              {isProfitable ? '+' : ''}{avgPnL.toFixed(1)}%
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              {activeTrades.length} active position{activeTrades.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Portfolio Greeks */}
          {portfolioGreeks && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Greeks Exposure
              </div>

              {/* Delta */}
              <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-blue-400" />
                    <span className="text-xs text-[var(--text-muted)]">Delta</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-mono font-bold',
                      portfolioGreeks.totalDelta >= 0
                        ? 'text-[var(--accent-positive)]'
                        : 'text-[var(--accent-negative)]'
                    )}
                  >
                    {portfolioGreeks.totalDelta >= 0 ? '+' : ''}
                    {portfolioGreeks.totalDelta.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      portfolioGreeks.totalDelta >= 0
                        ? 'bg-[var(--accent-positive)]'
                        : 'bg-[var(--accent-negative)]'
                    )}
                    style={{
                      width: `${Math.min(Math.abs(portfolioGreeks.totalDelta) * 20, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Theta */}
              <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-[var(--text-muted)]">Theta (per day)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--accent-negative)]">
                    ${Math.abs(portfolioGreeks.thetaPerDay).toFixed(0)}
                  </span>
                </div>
                {portfolioGreeks.thetaPerDay < -300 && (
                  <div className="mt-1 text-[10px] text-amber-400">
                    ⚠️ High decay rate
                  </div>
                )}
              </div>

              {/* Gamma */}
              <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-[var(--text-muted)]">Gamma Risk</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400">
                    {portfolioGreeks.gammaRisk.toFixed(2)}
                  </span>
                </div>
                {portfolioGreeks.gammaRisk > 0.3 && (
                  <div className="mt-1 text-[10px] text-purple-400">
                    ⚠️ High volatility risk
                  </div>
                )}
              </div>

              {/* Vega */}
              <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wind className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs text-[var(--text-muted)]">Vega (IV exposure)</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-mono font-bold',
                      portfolioGreeks.vegaExposure >= 0
                        ? 'text-[var(--accent-positive)]'
                        : 'text-[var(--accent-negative)]'
                    )}
                  >
                    ${Math.abs(portfolioGreeks.vegaExposure).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Risk Summary */}
          <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="text-[10px] text-[var(--text-muted)] mb-1">Risk Level</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    avgPnL < -10
                      ? 'bg-[var(--accent-negative)]'
                      : avgPnL > 20
                      ? 'bg-[var(--brand-primary)]'
                      : 'bg-[var(--accent-positive)]'
                  )}
                  style={{ width: `${Math.min(Math.abs(avgPnL) * 2, 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-[var(--text-high)]">
                {avgPnL < -10 ? 'HIGH' : avgPnL > 20 ? 'ELEVATED' : 'MODERATE'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
