/**
 * Monitoring Dashboard - Real-time production metrics
 *
 * Displays 4 critical monitoring panels:
 * 1. Data Provider Health (Massive/Tradier API availability)
 * 2. Greeks/IV Quality (validation rates, bounds violations)
 * 3. P&L Accuracy (backtest vs live variance, cost impact)
 * 4. System Health (API response times, error rates, WebSocket)
 */

import { useState, useEffect } from 'react';
import { getMetricsService, type DashboardMetrics } from '../../services/monitoring';
import { Activity, TrendingUp, AlertTriangle, Server, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScannerHealth {
  status: string;
  healthy: boolean;
  lastScan: string;
  signalsDetected: number;
  ageMinutes: number;
}

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [scannerHealth, setScannerHealth] = useState<ScannerHealth | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      if (!isPaused) {
        const metricsService = getMetricsService();
        setMetrics(metricsService.getDashboardMetrics());
      }
    };

    // Update every 5 seconds
    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Fetch scanner health
  useEffect(() => {
    const updateScannerHealth = async () => {
      if (!isPaused) {
        try {
          const res = await fetch('/api/health');
          const health = await res.json();
          setScannerHealth(health.details.scanner);
        } catch (err) {
          console.error('Failed to fetch scanner health:', err);
        }
      }
    };

    // Update every 5 seconds
    updateScannerHealth();
    const interval = setInterval(updateScannerHealth, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  if (!metrics) {
    return (
      <div className="p-4 text-center text-[var(--text-muted)]">
        Initializing monitoring...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-4 bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[var(--brand-primary)]" />
          <h1 className="text-lg font-bold text-[var(--text-high)]">Production Monitoring</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-3 py-1 rounded bg-[var(--surface-2)] text-xs font-medium hover:bg-[var(--surface-3)]"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <span className="text-[10px] text-[var(--text-muted)]">
            Updated: {new Date(metrics.lastUpdateAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Grid: 5 Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: Data Provider Health */}
        <ProviderHealthPanel metrics={metrics} />

        {/* Panel 2: Greeks/IV Quality */}
        <GreeksQualityPanel metrics={metrics} />

        {/* Panel 3: P&L Accuracy */}
        <PnLAccuracyPanel metrics={metrics} />

        {/* Panel 4: System Health */}
        <SystemHealthPanel metrics={metrics} />

        {/* Panel 5: Scanner Worker Health */}
        {scannerHealth && <ScannerHealthPanel health={scannerHealth} />}
      </div>
    </div>
  );
}

// ============================================================================
// Panel Components
// ============================================================================

function ProviderHealthPanel({ metrics }: { metrics: DashboardMetrics }) {
  const { massive, tradier } = metrics.providers;

  const renderProvider = (provider: typeof massive) => {
    const healthColor =
      provider.uptime >= 99 ? 'text-green-500' :
      provider.uptime >= 95 ? 'text-yellow-500' :
      'text-red-500';

    return (
      <div className="border-t border-[var(--border-hairline)] pt-3 first:border-t-0 first:pt-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-high)]">
            {provider.provider.toUpperCase()}
          </span>
          <span className={cn('text-xs font-bold', healthColor)}>
            {provider.uptime.toFixed(1)}% ↑
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-muted)]">Requests:</span>
            <div className="text-[var(--text-high)] font-mono">{provider.requestCount}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Success:</span>
            <div className="text-green-500 font-mono">{provider.successCount}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Response:</span>
            <div className="text-[var(--text-high)] font-mono">{provider.avgResponseTimeMs}ms</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Fallbacks:</span>
            <div className={cn('font-mono', provider.fallbackCount > 5 ? 'text-red-500' : 'text-[var(--text-high)]')}>
              {provider.fallbackCount}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-[var(--brand-primary)]" />
        <h2 className="text-xs font-bold uppercase text-[var(--text-high)]">Data Provider Health</h2>
      </div>
      {renderProvider(massive)}
      {renderProvider(tradier)}
    </div>
  );
}

function GreeksQualityPanel({ metrics }: { metrics: DashboardMetrics }) {
  const { greeksQuality } = metrics;
  const validRate = greeksQuality.totalTrades > 0
    ? (greeksQuality.validGreeks / greeksQuality.totalTrades) * 100
    : 0;

  const hasErrors = greeksQuality.gammaIsZero > 0 || greeksQuality.deltaOutOfBounds > 0;

  return (
    <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[var(--brand-primary)]" />
        <h2 className="text-xs font-bold uppercase text-[var(--text-high)]">Greeks/IV Quality</h2>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)]">Valid Greeks Rate</span>
          <span className={cn(
            'text-xs font-bold font-mono',
            validRate >= 95 ? 'text-green-500' : validRate >= 85 ? 'text-yellow-500' : 'text-red-500'
          )}>
            {validRate.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-muted)]">Total Trades:</span>
            <div className="text-[var(--text-high)] font-mono">{greeksQuality.totalTrades}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Estimated:</span>
            <div className="text-yellow-500 font-mono">{greeksQuality.estimatedGreeks}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Validation Errors:</span>
            <div className={cn('font-mono', greeksQuality.validationErrors > 0 ? 'text-red-500' : 'text-green-500')}>
              {greeksQuality.validationErrors}
            </div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">IV Anomalies:</span>
            <div className={cn('font-mono', greeksQuality.ivAnomalies > 0 ? 'text-orange-500' : 'text-green-500')}>
              {greeksQuality.ivAnomalies}
            </div>
          </div>
        </div>

        {/* Critical Errors */}
        {hasErrors && (
          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-[9px] font-bold text-red-500">CRITICAL ERRORS</span>
            </div>
            <div className="text-[9px] text-red-400 space-y-0.5">
              {greeksQuality.gammaIsZero > 0 && <div>• Gamma = 0: {greeksQuality.gammaIsZero} trades</div>}
              {greeksQuality.deltaOutOfBounds > 0 && <div>• Delta out of bounds: {greeksQuality.deltaOutOfBounds}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PnLAccuracyPanel({ metrics }: { metrics: DashboardMetrics }) {
  const { pnl } = metrics;

  return (
    <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-[var(--brand-primary)]" />
        <h2 className="text-xs font-bold uppercase text-[var(--text-high)]">P&L Accuracy</h2>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-[var(--text-muted)]">Avg Gross P&L</span>
            <div className={cn(
              'text-sm font-bold font-mono',
              pnl.avgGrossPnL >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {pnl.avgGrossPnL > 0 ? '+' : ''}{pnl.avgGrossPnL.toFixed(2)}%
            </div>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)]">Avg Net P&L</span>
            <div className={cn(
              'text-sm font-bold font-mono',
              pnl.avgNetPnL >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {pnl.avgNetPnL > 0 ? '+' : ''}{pnl.avgNetPnL.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-hairline)] pt-2">
          <div className="text-[10px] text-[var(--text-muted)] mb-1">Cost Impact</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[var(--surface-1)] rounded h-1.5 overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all"
                style={{ width: `${Math.min(pnl.costImpactPercent, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-[var(--text-high)]">
              {pnl.costImpactPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-[var(--border-hairline)]">
          <div>
            <span className="text-[var(--text-muted)]">Trades:</span>
            <div className="text-[var(--text-high)] font-mono">{pnl.totalTrades}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Total Commission:</span>
            <div className="text-red-500 font-mono">${pnl.totalCommissionCost.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Avg Slippage:</span>
            <div className="text-red-500 font-mono">${pnl.avgSlippageCost.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Backtest Variance:</span>
            <div className={cn('font-mono', pnl.backtestVariance < 5 ? 'text-green-500' : 'text-yellow-500')}>
              {pnl.backtestVariance.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemHealthPanel({ metrics }: { metrics: DashboardMetrics }) {
  const { systemHealth } = metrics;

  const wsColor = systemHealth.webSocketConnected ? 'text-green-500' : 'text-red-500';
  const uptimeHours = Math.floor(systemHealth.uptime / 3600);
  const uptimeMinutes = Math.floor((systemHealth.uptime % 3600) / 60);

  return (
    <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-[var(--brand-primary)]" />
        <h2 className="text-xs font-bold uppercase text-[var(--text-high)]">System Health</h2>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)]">WebSocket</span>
          <span className={cn('text-xs font-bold', wsColor)}>
            {systemHealth.webSocketConnected ? '✓ Connected' : '✗ Disconnected'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-muted)]">API Response</span>
            <div className="text-[var(--text-high)] font-mono">{systemHealth.apiAvgResponseTimeMs}ms</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">WS Latency</span>
            <div className="text-[var(--text-high)] font-mono">{systemHealth.webSocketLatencyMs}ms</div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Total Errors</span>
            <div className={cn('font-mono', systemHealth.errorCount > 10 ? 'text-red-500' : 'text-[var(--text-high)]')}>
              {systemHealth.errorCount}
            </div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Uptime</span>
            <div className="text-[var(--text-high)] font-mono">{uptimeHours}h {uptimeMinutes}m</div>
          </div>
        </div>

        {/* Error breakdown */}
        {systemHealth.errorsByType.size > 0 && (
          <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
            <div className="text-[9px] font-bold text-orange-500 mb-1">Error Breakdown</div>
            <div className="text-[9px] text-orange-400 space-y-0.5">
              {Array.from(systemHealth.errorsByType.entries()).slice(0, 4).map(([type, count]) => (
                <div key={type}>• {type}: {count}</div>
              ))}
            </div>
          </div>
        )}

        {systemHealth.lastErrorMessage && (
          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
            <div className="text-[9px] font-bold text-red-500 mb-1">Last Error</div>
            <div className="text-[8px] text-red-400 truncate">{systemHealth.lastErrorMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScannerHealthPanel({ health }: { health: ScannerHealth }) {
  const isHealthy = health.healthy && health.ageMinutes < 2;
  const statusColor = isHealthy ? 'text-green-500' : 'text-red-500';

  const formatLastScan = (lastScan: string) => {
    try {
      return new Date(lastScan).toLocaleTimeString();
    } catch {
      return 'Never';
    }
  };

  return (
    <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[var(--brand-primary)]" />
        <h2 className="text-xs font-bold uppercase text-[var(--text-high)]">Scanner Worker</h2>
      </div>

      <div className="space-y-3">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)]">Status</span>
          <span className={cn('text-xs font-bold', statusColor)}>
            {isHealthy ? '✓ Active' : '✗ Down'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[var(--text-muted)]">Last Scan</span>
            <div className="text-[var(--text-high)] font-mono text-[9px]">
              {formatLastScan(health.lastScan)}
            </div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Age</span>
            <div className={cn(
              'font-mono',
              health.ageMinutes < 2 ? 'text-green-500' : 'text-red-500'
            )}>
              {health.ageMinutes.toFixed(1)}m ago
            </div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Signals Detected</span>
            <div className="text-[var(--text-high)] font-mono">
              {health.signalsDetected}
            </div>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Worker Status</span>
            <div className="text-[var(--text-high)] font-mono text-[9px]">
              {health.status || 'unknown'}
            </div>
          </div>
        </div>

        {/* Warning if unhealthy */}
        {!isHealthy && (
          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
            <div className="text-[9px] font-bold text-red-500 mb-1">⚠️ Scanner Not Running</div>
            <div className="text-[8px] text-red-400">
              Last scan was {health.ageMinutes.toFixed(0)} minutes ago. Expected: &lt;2 minutes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
