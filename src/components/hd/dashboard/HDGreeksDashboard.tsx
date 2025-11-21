/**
 * HDGreeksDashboard.tsx - Real-Time Greeks Monitoring for HoneyDrip Admins
 *
 * Features:
 * - Portfolio-level Greeks aggregation
 * - Per-trade Greeks with freshness indicators
 * - IV history charts & percentile
 * - Greeks alerts (theta decay, gamma spikes, IV crush)
 * - Real-time updates (via greeksMonitor + marketDataStore)
 */

import { useState, useEffect } from 'react';
import { useTradeStore } from '../../stores/tradeStore';
import { useMarketDataStore, useGreeks, useAreGreeksStale } from '../../stores/marketDataStore';
import { getIVStats, getIVHistory } from '../../lib/greeks/ivHistory';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Activity, TrendingUp, TrendingDown, Zap, Clock, AlertTriangle } from 'lucide-react';

interface PortfolioGreeks {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  thetaPerDay: number;
  netDirectionality: 'bullish' | 'bearish' | 'neutral';
  tradeCount: number;
}

export function HDGreeksDashboard() {
  const activeTrades = useTradeStore(state => state.activeTrades);
  const [portfolioGreeks, setPortfolioGreeks] = useState<PortfolioGreeks | null>(null);

  // Calculate portfolio Greeks
  useEffect(() => {
    if (activeTrades.length === 0) {
      setPortfolioGreeks(null);
      return;
    }

    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    activeTrades.forEach(trade => {
      const greeks = useMarketDataStore.getState().getGreeks(trade.ticker);
      if (greeks) {
        // Adjust for position size (assume 1 contract for now)
        const multiplier = trade.contract.type === 'P' ? -1 : 1;
        totalDelta += (greeks.delta ?? 0) * multiplier;
        totalGamma += greeks.gamma ?? 0;
        totalTheta += greeks.theta ?? 0;
        totalVega += greeks.vega ?? 0;
      }
    });

    const netDirectionality =
      Math.abs(totalDelta) < 0.5 ? 'neutral' :
      totalDelta > 0 ? 'bullish' : 'bearish';

    setPortfolioGreeks({
      totalDelta,
      totalGamma,
      totalTheta,
      totalVega,
      thetaPerDay: totalTheta, // Theta is already per day
      netDirectionality,
      tradeCount: activeTrades.length,
    });
  }, [activeTrades]);

  if (activeTrades.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Greeks Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">
            No active trades to monitor. Enter a trade to start tracking Greeks.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Portfolio-Level Greeks */}
      {portfolioGreeks && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Portfolio Greeks
              <Badge variant="secondary" className="ml-auto">
                {portfolioGreeks.tradeCount} {portfolioGreeks.tradeCount === 1 ? 'Trade' : 'Trades'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Delta */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Δ Delta</span>
                  {portfolioGreeks.netDirectionality === 'bullish' && (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  )}
                  {portfolioGreeks.netDirectionality === 'bearish' && (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className={`text-lg font-bold ${
                  portfolioGreeks.totalDelta > 0 ? 'text-green-500' :
                  portfolioGreeks.totalDelta < 0 ? 'text-red-500' :
                  'text-[var(--text-med)]'
                }`}>
                  {portfolioGreeks.totalDelta > 0 ? '+' : ''}{portfolioGreeks.totalDelta.toFixed(2)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {portfolioGreeks.netDirectionality}
                </div>
              </div>

              {/* Gamma */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Γ Gamma</span>
                  {portfolioGreeks.totalGamma > 0.2 && (
                    <Zap className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div className="text-lg font-bold text-[var(--text-high)]">
                  {portfolioGreeks.totalGamma.toFixed(3)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {portfolioGreeks.totalGamma > 0.2 ? 'High' : portfolioGreeks.totalGamma > 0.1 ? 'Medium' : 'Low'}
                </div>
              </div>

              {/* Theta */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Θ Theta</span>
                  <Clock className="h-3 w-3 text-orange-500" />
                </div>
                <div className="text-lg font-bold text-red-500">
                  ${portfolioGreeks.thetaPerDay.toFixed(0)}/day
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  decay
                </div>
              </div>

              {/* Vega */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">ν Vega</span>
                <div className="text-lg font-bold text-[var(--text-high)]">
                  {portfolioGreeks.totalVega > 0 ? '+$' : '-$'}{Math.abs(portfolioGreeks.totalVega).toFixed(0)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  per 1% IV
                </div>
              </div>

              {/* Risk Summary */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-muted)]">Risk</span>
                <div className="flex flex-col gap-1">
                  {portfolioGreeks.totalGamma > 0.2 && (
                    <Badge variant="destructive" className="text-xs">High Gamma</Badge>
                  )}
                  {Math.abs(portfolioGreeks.thetaPerDay) > 300 && (
                    <Badge variant="outline" className="text-xs text-orange-500">Heavy Decay</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Trade Greeks */}
      <Card>
        <CardHeader>
          <CardTitle>Active Trade Greeks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeTrades.map(trade => (
              <TradeGreeksRow key={trade.id} trade={trade} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TradeGreeksRow({ trade }: { trade: any }) {
  const greeks = useGreeks(trade.ticker);
  const isStale = useAreGreeksStale(trade.ticker);
  const [ivStats, setIvStats] = useState<any>(null);

  // Get IV stats
  useEffect(() => {
    if (greeks) {
      const stats = getIVStats(trade.ticker);
      setIvStats(stats);
    }
  }, [greeks, trade.ticker]);

  if (!greeks) {
    return (
      <div className="p-3 border border-[var(--border-hairline)] rounded-lg bg-[var(--surface-2)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-[var(--text-high)]">
              {trade.ticker} {trade.contract.strike}{trade.contract.type}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {trade.contract.expiry} • {trade.contract.daysToExpiry} DTE
            </div>
          </div>
          <Badge variant="outline">No Greeks</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 border rounded-lg transition-colors ${
      isStale ? 'border-orange-500 bg-orange-500/5' : 'border-[var(--border-hairline)] bg-[var(--surface-2)]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-[var(--text-high)]">
            {trade.ticker} {trade.contract.strike}{trade.contract.type}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {trade.contract.expiry} • {trade.contract.daysToExpiry} DTE
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStale && (
            <Badge variant="outline" className="text-xs text-orange-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Stale
            </Badge>
          )}
          {greeks.isFresh && (
            <Badge variant="outline" className="text-xs text-green-500">
              <Activity className="h-3 w-3 mr-1" />
              Live
            </Badge>
          )}
        </div>
      </div>

      <Separator className="my-2" />

      {/* Greeks */}
      <div className="grid grid-cols-5 gap-3 text-center">
        <div>
          <div className="text-xs text-[var(--text-muted)]">Delta</div>
          <div className={`font-bold ${greeks.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {greeks.delta.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-muted)]">Gamma</div>
          <div className="font-bold text-[var(--text-high)]">
            {greeks.gamma.toFixed(4)}
          </div>
          {greeks.gamma > 0.2 && (
            <div className="text-xs text-yellow-500">⚡ High</div>
          )}
        </div>
        <div>
          <div className="text-xs text-[var(--text-muted)]">Theta</div>
          <div className="font-bold text-red-500">
            {greeks.theta.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-muted)]">Vega</div>
          <div className="font-bold text-[var(--text-high)]">
            {greeks.vega.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-muted)]">IV</div>
          <div className="font-bold text-[var(--text-high)]">
            {(greeks.iv * 100).toFixed(1)}%
          </div>
          {ivStats && (
            <div className={`text-xs ${ivStats.isHigh ? 'text-red-500' : ivStats.isLow ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
              {ivStats.percentile.toFixed(0)}%ile
            </div>
          )}
        </div>
      </div>

      {/* Source & Timestamp */}
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div>Source: {greeks.source}</div>
        <div>{formatTimestamp(greeks.lastUpdated)}</div>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 5000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(timestamp).toLocaleTimeString();
}
