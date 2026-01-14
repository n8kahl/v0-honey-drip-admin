/**
 * SetupOptimizationDashboard - Optimizer Status and Detection Dashboard
 *
 * Displays optimization status, current parameters, and detector rankings
 * from the backend optimizer API.
 *
 * Sections:
 * - A) Last Optimization (timestamp, win rate, PF, symbols tested)
 * - B) Current Parameters (targetMultiple, stopMultiple, maxHoldBars, boosts)
 * - C) Top Day Trader Detectors (table with win rate, PF, trades)
 * - D) What's Enabled (list, explain "Day Trader First" gating)
 */

import {
  RefreshCw,
  Zap,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { HDCard } from "../hd/common/HDCard";
import { HDButton } from "../hd/common/HDButton";
import {
  useOptimizerStatus,
  getTopDetectors,
  formatWinRate,
  formatProfitFactor,
  formatLastUpdated,
} from "../../hooks/useOptimizerStatus";

// ============================================================================
// Sub-components
// ============================================================================

interface StatBoxProps {
  label: string;
  value: string | number;
  subtext?: string;
  positive?: boolean;
  negative?: boolean;
}

function StatBox({ label, value, subtext, positive, negative }: StatBoxProps) {
  return (
    <div className="p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${
          positive
            ? "text-[var(--accent-positive)]"
            : negative
              ? "text-[var(--accent-negative)]"
              : "text-[var(--text-high)]"
        }`}
      >
        {value}
      </div>
      {subtext && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{subtext}</div>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SetupOptimizationDashboard() {
  const { data, isLoading, error, refetch } = useOptimizerStatus();

  // Loading state
  if (isLoading) {
    return (
      <HDCard>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand-primary)]" />
          <span className="ml-2 text-[var(--text-muted)]">Loading optimizer status...</span>
        </div>
      </HDCard>
    );
  }

  // Error state
  if (error) {
    return (
      <HDCard>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--accent-negative)] mb-2" />
          <p className="text-[var(--text-high)] font-medium">Failed to load optimizer status</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">{error}</p>
          <HDButton variant="secondary" onClick={refetch} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </HDButton>
        </div>
      </HDCard>
    );
  }

  // No data state
  if (!data || data.missingFiles.length === 2) {
    return (
      <HDCard>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Zap className="w-8 h-8 text-[var(--text-muted)] mb-2" />
          <p className="text-[var(--text-high)] font-medium">No Optimization Data</p>
          <p className="text-[var(--text-muted)] text-sm mt-1 max-w-md">
            Run the optimizer to generate parameters and performance reports.
          </p>
          <div className="mt-4 p-3 bg-[var(--surface-1)] rounded-[var(--radius)] text-left">
            <p className="text-xs text-[var(--text-muted)] mb-2">CLI Commands:</p>
            <code className="block text-xs text-[var(--brand-primary)] font-mono">
              pnpm run optimizer
            </code>
            <code className="block text-xs text-[var(--brand-primary)] font-mono mt-1">
              pnpm run report
            </code>
          </div>
        </div>
      </HDCard>
    );
  }

  const { paramsConfig, report } = data;
  const topDetectors = getTopDetectors(report, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-high)] flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Setup Detection & Optimization
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            GA-optimized parameters for day trading strategies
          </p>
        </div>
        <HDButton variant="secondary" onClick={refetch} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </HDButton>
      </div>

      {/* Section A: Last Optimization */}
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--text-high)] font-semibold">Last Optimization</h3>
              <p className="text-[var(--text-muted)] text-xs">
                Performance summary from the most recent optimization run
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="Last Run"
              value={formatLastUpdated(data.lastUpdated)}
              subtext={
                data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : undefined
              }
            />
            <StatBox
              label="Win Rate"
              value={
                paramsConfig?.performance?.winRate !== undefined
                  ? formatWinRate(paramsConfig.performance.winRate)
                  : "—"
              }
              positive={
                paramsConfig?.performance?.winRate ? paramsConfig.performance.winRate >= 0.5 : false
              }
              negative={
                paramsConfig?.performance?.winRate ? paramsConfig.performance.winRate < 0.4 : false
              }
            />
            <StatBox
              label="Profit Factor"
              value={
                paramsConfig?.performance?.profitFactor !== undefined
                  ? formatProfitFactor(paramsConfig.performance.profitFactor)
                  : "—"
              }
              positive={
                paramsConfig?.performance?.profitFactor
                  ? paramsConfig.performance.profitFactor >= 1.5
                  : false
              }
            />
            <StatBox
              label="Total Trades"
              value={paramsConfig?.performance?.totalTrades ?? "—"}
              subtext={report?.testedSymbols ? `${report.testedSymbols.length} symbols` : undefined}
            />
          </div>

          {report?.testedSymbols && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">Symbols:</span>
              {report.testedSymbols.map((symbol) => (
                <span
                  key={symbol}
                  className="px-2 py-0.5 text-xs bg-[var(--surface-1)] rounded text-[var(--text-high)]"
                >
                  {symbol}
                </span>
              ))}
            </div>
          )}
        </div>
      </HDCard>

      {/* Section B: Current Parameters */}
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--text-high)] font-semibold">Current Parameters</h3>
              <p className="text-[var(--text-muted)] text-xs">
                Active risk/reward and boost parameters
              </p>
            </div>
          </div>

          {paramsConfig?.parameters ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Risk/Reward */}
              <div className="p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Risk/Reward
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Target Multiple</span>
                    <span className="font-mono text-[var(--text-high)]">
                      {paramsConfig.parameters.riskReward.targetMultiple.toFixed(2)}x ATR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Stop Multiple</span>
                    <span className="font-mono text-[var(--text-high)]">
                      {paramsConfig.parameters.riskReward.stopMultiple.toFixed(2)}x ATR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Max Hold Bars</span>
                    <span className="font-mono text-[var(--text-high)]">
                      {paramsConfig.parameters.riskReward.maxHoldBars}
                    </span>
                  </div>
                </div>
              </div>

              {/* Boosts */}
              <div className="p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Score Boosts
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Low IV</span>
                    <span
                      className={`font-mono ${paramsConfig.parameters.ivBoosts.lowIV >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"}`}
                    >
                      {paramsConfig.parameters.ivBoosts.lowIV >= 0 ? "+" : ""}
                      {(paramsConfig.parameters.ivBoosts.lowIV * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Flow Aligned</span>
                    <span
                      className={`font-mono ${paramsConfig.parameters.flowBoosts.aligned >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"}`}
                    >
                      {paramsConfig.parameters.flowBoosts.aligned >= 0 ? "+" : ""}
                      {(paramsConfig.parameters.flowBoosts.aligned * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Short Gamma</span>
                    <span
                      className={`font-mono ${paramsConfig.parameters.gammaBoosts.shortGamma >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"}`}
                    >
                      {paramsConfig.parameters.gammaBoosts.shortGamma >= 0 ? "+" : ""}
                      {(paramsConfig.parameters.gammaBoosts.shortGamma * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-[var(--text-muted)] text-sm">
              No parameter data available
            </div>
          )}
        </div>
      </HDCard>

      {/* Section C: Top Day Trader Detectors */}
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--text-high)] font-semibold">Top Day Trader Detectors</h3>
              <p className="text-[var(--text-muted)] text-xs">
                Ranked by win rate (minimum 3 trades)
              </p>
            </div>
          </div>

          {topDetectors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)]">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Detector
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Win Rate
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      PF
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Trades
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topDetectors.map((detector, idx) => (
                    <tr
                      key={detector.detector}
                      className={`border-b border-[var(--border-hairline)] ${idx === 0 ? "bg-[var(--brand-primary)]/5" : ""}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          {idx === 0 && <span className="text-amber-500 text-xs">1st</span>}
                          <span className="text-[var(--text-high)] font-medium truncate max-w-[200px]">
                            {detector.detector.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`text-right py-2 px-2 font-mono ${
                          detector.winRate >= 0.5
                            ? "text-[var(--accent-positive)]"
                            : detector.winRate >= 0.4
                              ? "text-amber-400"
                              : "text-[var(--accent-negative)]"
                        }`}
                      >
                        {formatWinRate(detector.winRate)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-[var(--text-high)]">
                        {formatProfitFactor(detector.profitFactor)}
                      </td>
                      <td className="text-right py-2 px-2 text-[var(--text-muted)]">
                        {detector.totalTrades}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-[var(--text-muted)] text-sm">
              No detector performance data available
            </div>
          )}
        </div>
      </HDCard>

      {/* Section D: What's Enabled */}
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--accent-positive)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--text-high)] font-semibold">What's Enabled</h3>
              <p className="text-[var(--text-muted)] text-xs">
                Current detection and gating configuration
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-[var(--surface-1)] rounded-[var(--radius)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-positive)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-[var(--text-high)] font-medium">
                  Day Trader First Gating
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Signals are filtered by optimized score thresholds. Only setups meeting the
                  minimum Day score ({paramsConfig?.parameters?.minScores?.day ?? 80}) are surfaced.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[var(--surface-1)] rounded-[var(--radius)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-positive)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-[var(--text-high)] font-medium">IV-Adjusted Entry</div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Low IV environments get a{" "}
                  {((paramsConfig?.parameters?.ivBoosts?.lowIV ?? 0.15) * 100).toFixed(0)}% score
                  boost. High IV environments are penalized.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[var(--surface-1)] rounded-[var(--radius)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-positive)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-[var(--text-high)] font-medium">Flow Confluence</div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Aligned institutional flow adds{" "}
                  {((paramsConfig?.parameters?.flowBoosts?.aligned ?? 0.2) * 100).toFixed(0)}% to
                  score. Opposing flow reduces signal confidence.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[var(--surface-1)] rounded-[var(--radius)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-positive)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-[var(--text-high)] font-medium">
                  MTF Trend Weighting
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Weekly ({paramsConfig?.parameters?.mtfWeights?.weekly ?? 3}x), Daily (
                  {paramsConfig?.parameters?.mtfWeights?.daily ?? 2}x), Hourly (
                  {paramsConfig?.parameters?.mtfWeights?.hourly ?? 1}x), 15m (
                  {paramsConfig?.parameters?.mtfWeights?.fifteenMin ?? 0.5}x) weights applied.
                </p>
              </div>
            </div>
          </div>
        </div>
      </HDCard>
    </div>
  );
}

export default SetupOptimizationDashboard;
