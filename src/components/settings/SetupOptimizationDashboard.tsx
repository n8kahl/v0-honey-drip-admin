/**
 * SetupOptimizationDashboard - Setup Edge Dashboard
 *
 * Displays live win rates, profit factors, and sample sizes per setup type.
 * Shows "What Works Now" recommendations based on historical performance.
 *
 * Sections:
 * - A) Overview Stats (total signals, exited, win rate summary)
 * - B) Top Performing Setups ("What Works Now")
 * - C) All Setup Performance (full table/cards)
 * - D) Optimizer Parameters (from file-based optimizer, if available)
 */

import { useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  Trophy,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  Settings2,
} from "lucide-react";
import { HDCard } from "../hd/common/HDCard";
import { HDButton } from "../hd/common/HDButton";
import {
  useEdgeStats,
  formatOpportunityType,
  formatStyle,
  formatWinRate,
  formatProfitFactor,
  formatRMultiple,
  formatLastUpdated,
  getConfidenceColor,
  getConfidenceBadge,
  isProfitable,
  isUnderperforming,
  type EdgeStat,
  type TopSetup,
} from "../../hooks/useEdgeStats";
import {
  useOptimizerStatus,
  formatWinRate as formatOptimizerWinRate,
  formatProfitFactor as formatOptimizerPF,
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

interface ConfidenceBadgeProps {
  confidence: "low" | "medium" | "high";
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const colors: Record<string, string> = {
    high: "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)] border-[var(--accent-positive)]/30",
    medium: "bg-amber-500/10 text-amber-400 border-amber-400/30",
    low: "bg-[var(--surface-1)] text-[var(--text-muted)] border-[var(--border-hairline)]",
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${colors[confidence]}`}>
      {getConfidenceBadge(confidence)}
    </span>
  );
}

interface TopSetupCardProps {
  setup: TopSetup;
  rank: number;
}

function TopSetupCard({ setup, rank }: TopSetupCardProps) {
  const isTop = rank === 1;

  return (
    <div
      className={`p-4 rounded-[var(--radius)] border ${
        isTop
          ? "bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]/30"
          : "bg-[var(--surface-1)] border-[var(--border-hairline)]"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isTop && <Trophy className="w-4 h-4 text-amber-500" />}
          <span
            className={`text-xs font-bold ${isTop ? "text-amber-500" : "text-[var(--text-muted)]"}`}
          >
            #{rank}
          </span>
        </div>
        <ConfidenceBadge confidence={setup.confidence} />
      </div>

      <div className="mb-2">
        <div className="text-sm font-semibold text-[var(--text-high)] leading-tight">
          {formatOpportunityType(setup.opportunityType)}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {formatStyle(setup.recommendedStyle)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div
            className={`text-sm font-bold ${
              setup.winRate >= 50
                ? "text-[var(--accent-positive)]"
                : setup.winRate >= 40
                  ? "text-amber-400"
                  : "text-[var(--accent-negative)]"
            }`}
          >
            {formatWinRate(setup.winRate)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">Win Rate</div>
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--text-high)]">
            {formatProfitFactor(setup.profitFactor)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">PF</div>
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--text-high)]">{setup.totalExited}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Trades</div>
        </div>
      </div>
    </div>
  );
}

interface SetupRowProps {
  stat: EdgeStat;
  isExpanded: boolean;
  onToggle: () => void;
}

function SetupRow({ stat, isExpanded, onToggle }: SetupRowProps) {
  const profitable = isProfitable(stat);
  const underperforming = isUnderperforming(stat);

  return (
    <>
      {/* Desktop Row */}
      <tr
        className={`border-b border-[var(--border-hairline)] cursor-pointer hover:bg-[var(--surface-1)]/50 hidden md:table-row ${
          profitable
            ? "bg-[var(--accent-positive)]/5"
            : underperforming
              ? "bg-[var(--accent-negative)]/5"
              : ""
        }`}
        onClick={onToggle}
      >
        <td className="py-2 px-2">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-medium truncate max-w-[180px]">
              {formatOpportunityType(stat.opportunityType)}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {formatStyle(stat.recommendedStyle)}
          </div>
        </td>
        <td
          className={`text-right py-2 px-2 font-mono ${
            stat.winRate >= 50
              ? "text-[var(--accent-positive)]"
              : stat.winRate >= 40
                ? "text-amber-400"
                : "text-[var(--accent-negative)]"
          }`}
        >
          {formatWinRate(stat.winRate)}
        </td>
        <td className="text-right py-2 px-2 font-mono text-[var(--text-high)]">
          {formatProfitFactor(stat.profitFactor)}
        </td>
        <td className="text-right py-2 px-2 text-[var(--text-muted)]">{stat.totalExited}</td>
        <td className="text-center py-2 px-2">
          <ConfidenceBadge confidence={stat.confidence} />
        </td>
        <td className="text-right py-2 px-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </td>
      </tr>

      {/* Expanded Details Row (Desktop) */}
      {isExpanded && (
        <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-1)] hidden md:table-row">
          <td colSpan={6} className="py-3 px-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">W/L: </span>
                <span className="text-[var(--text-high)] font-mono">
                  {stat.totalWins}/{stat.totalLosses}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Avg R: </span>
                <span
                  className={`font-mono ${stat.avgRMultiple >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"}`}
                >
                  {formatRMultiple(stat.avgRMultiple)}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Avg RR: </span>
                <span className="text-[var(--text-high)] font-mono">
                  {stat.avgRiskReward.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Updated: </span>
                <span className="text-[var(--text-high)]">
                  {formatLastUpdated(stat.lastUpdated)}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Mobile Card */}
      <tr className="md:hidden">
        <td colSpan={6} className="p-0">
          <div
            className={`p-3 border-b border-[var(--border-hairline)] ${
              profitable
                ? "bg-[var(--accent-positive)]/5"
                : underperforming
                  ? "bg-[var(--accent-negative)]/5"
                  : ""
            }`}
            onClick={onToggle}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text-high)]">
                  {formatOpportunityType(stat.opportunityType)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {formatStyle(stat.recommendedStyle)}
                </div>
              </div>
              <ConfidenceBadge confidence={stat.confidence} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div
                  className={`text-sm font-bold ${
                    stat.winRate >= 50
                      ? "text-[var(--accent-positive)]"
                      : stat.winRate >= 40
                        ? "text-amber-400"
                        : "text-[var(--accent-negative)]"
                  }`}
                >
                  {formatWinRate(stat.winRate)}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">Win Rate</div>
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-high)]">
                  {formatProfitFactor(stat.profitFactor)}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">PF</div>
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-high)]">{stat.totalExited}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Trades</div>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-[var(--text-muted)]">W/L: </span>
                  <span className="text-[var(--text-high)] font-mono">
                    {stat.totalWins}/{stat.totalLosses}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Avg R: </span>
                  <span
                    className={`font-mono ${stat.avgRMultiple >= 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"}`}
                  >
                    {formatRMultiple(stat.avgRMultiple)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Avg RR: </span>
                  <span className="text-[var(--text-high)] font-mono">
                    {stat.avgRiskReward.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Updated: </span>
                  <span className="text-[var(--text-high)]">
                    {formatLastUpdated(stat.lastUpdated)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SetupOptimizationDashboard() {
  const [windowDays, setWindowDays] = useState(30);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showOptimizer, setShowOptimizer] = useState(false);

  const { summary, topSetups, isLoading, error, refetch } = useEdgeStats(windowDays);
  const { data: optimizerData, isLoading: optimizerLoading } = useOptimizerStatus();

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <HDCard>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand-primary)]" />
          <span className="ml-2 text-[var(--text-muted)]">Loading edge stats...</span>
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
          <p className="text-[var(--text-high)] font-medium">Failed to load edge stats</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">{error}</p>
          <HDButton variant="secondary" onClick={refetch} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </HDButton>
        </div>
      </HDCard>
    );
  }

  // Empty state
  if (!summary || summary.totalExited === 0) {
    return (
      <HDCard>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="w-8 h-8 text-[var(--text-muted)] mb-2" />
          <p className="text-[var(--text-high)] font-medium">No Outcomes Yet</p>
          <p className="text-[var(--text-muted)] text-sm mt-1 max-w-md">
            Edge stats will populate after signals are evaluated. The outcome worker processes
            expired signals every 5 minutes.
          </p>
          <div className="mt-4 p-3 bg-[var(--surface-1)] rounded-[var(--radius)] text-left">
            <p className="text-xs text-[var(--text-muted)] mb-2">How it works:</p>
            <ol className="text-xs text-[var(--text-muted)] list-decimal list-inside space-y-1">
              <li>Composite scanner generates signals with entry/stop/target</li>
              <li>Signals expire after their validity window</li>
              <li>Outcome worker walks historical bars to determine exit</li>
              <li>Performance metrics are aggregated here</li>
            </ol>
          </div>
        </div>
      </HDCard>
    );
  }

  // Calculate summary stats
  const totalWins = summary.stats.reduce((sum, s) => sum + s.totalWins, 0);
  const totalLosses = summary.stats.reduce((sum, s) => sum + s.totalLosses, 0);
  const overallWinRate = summary.totalExited > 0 ? (totalWins / summary.totalExited) * 100 : 0;
  const highConfidenceSetups = summary.stats.filter((s) => s.confidence === "high").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-high)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--brand-primary)]" />
            Setup Edge
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Live performance metrics from composite signal outcomes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] text-[var(--text-high)]"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <HDButton variant="secondary" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </HDButton>
        </div>
      </div>

      {/* Section A: Overview Stats */}
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--text-high)] font-semibold">Overview</h3>
              <p className="text-[var(--text-muted)] text-xs">
                Last {windowDays} days of signal performance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatBox label="Total Signals" value={summary.totalSignals} subtext="generated" />
            <StatBox label="Evaluated" value={summary.totalExited} subtext="with outcomes" />
            <StatBox
              label="Win Rate"
              value={`${overallWinRate.toFixed(1)}%`}
              positive={overallWinRate >= 50}
              negative={overallWinRate < 40}
            />
            <StatBox
              label="W/L"
              value={`${totalWins}/${totalLosses}`}
              positive={totalWins > totalLosses}
            />
            <StatBox
              label="High Confidence"
              value={highConfidenceSetups}
              subtext={`of ${summary.stats.length} setups`}
            />
          </div>

          {summary.lastUpdated && (
            <div className="text-xs text-[var(--text-muted)] text-right">
              Last outcome: {formatLastUpdated(summary.lastUpdated)}
            </div>
          )}
        </div>
      </HDCard>

      {/* Section B: Top Performing Setups */}
      {topSetups && topSetups.setups.length > 0 && (
        <HDCard>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-[var(--text-high)] font-semibold">What Works Now</h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Top setups ranked by expectancy (min 10 samples)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {topSetups.setups.map((setup) => (
                <TopSetupCard
                  key={`${setup.opportunityType}:${setup.recommendedStyle}`}
                  setup={setup}
                  rank={setup.rank}
                />
              ))}
            </div>
          </div>
        </HDCard>
      )}

      {/* Section C: All Setup Performance */}
      <HDCard>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-[var(--brand-primary)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--text-high)] font-semibold">All Setups</h3>
              <p className="text-[var(--text-muted)] text-xs">
                Performance by opportunity type and style
              </p>
            </div>
          </div>

          {summary.stats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-[var(--border-hairline)]">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Setup
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
                    <th className="text-center py-2 px-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Confidence
                    </th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.stats.map((stat) => {
                    const key = `${stat.opportunityType}:${stat.recommendedStyle}`;
                    return (
                      <SetupRow
                        key={key}
                        stat={stat}
                        isExpanded={expandedRows.has(key)}
                        onToggle={() => toggleRow(key)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-[var(--text-muted)] text-sm">
              No setup data available
            </div>
          )}
        </div>
      </HDCard>

      {/* Section D: Optimizer Parameters (Collapsible) */}
      {optimizerData && !optimizerData.missingFiles.includes("optimized-params.json") && (
        <HDCard>
          <button
            onClick={() => setShowOptimizer(!showOptimizer)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-start gap-3">
              <Settings2 className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <h3 className="text-[var(--text-high)] font-semibold">Optimizer Parameters</h3>
                <p className="text-[var(--text-muted)] text-xs">
                  GA-optimized detection thresholds
                </p>
              </div>
            </div>
            {showOptimizer ? (
              <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
            )}
          </button>

          {showOptimizer && optimizerData.paramsConfig?.parameters && (
            <div className="mt-4 pt-4 border-t border-[var(--border-hairline)]">
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
                        {optimizerData.paramsConfig.parameters.riskReward.targetMultiple.toFixed(2)}
                        x ATR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Stop Multiple</span>
                      <span className="font-mono text-[var(--text-high)]">
                        {optimizerData.paramsConfig.parameters.riskReward.stopMultiple.toFixed(2)}x
                        ATR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Max Hold Bars</span>
                      <span className="font-mono text-[var(--text-high)]">
                        {optimizerData.paramsConfig.parameters.riskReward.maxHoldBars}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Boosts */}
                <div className="p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    Score Boosts
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Low IV</span>
                      <span
                        className={`font-mono ${
                          optimizerData.paramsConfig.parameters.ivBoosts.lowIV >= 0
                            ? "text-[var(--accent-positive)]"
                            : "text-[var(--accent-negative)]"
                        }`}
                      >
                        {optimizerData.paramsConfig.parameters.ivBoosts.lowIV >= 0 ? "+" : ""}
                        {(optimizerData.paramsConfig.parameters.ivBoosts.lowIV * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Flow Aligned</span>
                      <span
                        className={`font-mono ${
                          optimizerData.paramsConfig.parameters.flowBoosts.aligned >= 0
                            ? "text-[var(--accent-positive)]"
                            : "text-[var(--accent-negative)]"
                        }`}
                      >
                        {optimizerData.paramsConfig.parameters.flowBoosts.aligned >= 0 ? "+" : ""}
                        {(optimizerData.paramsConfig.parameters.flowBoosts.aligned * 100).toFixed(
                          0
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Short Gamma</span>
                      <span
                        className={`font-mono ${
                          optimizerData.paramsConfig.parameters.gammaBoosts.shortGamma >= 0
                            ? "text-[var(--accent-positive)]"
                            : "text-[var(--accent-negative)]"
                        }`}
                      >
                        {optimizerData.paramsConfig.parameters.gammaBoosts.shortGamma >= 0
                          ? "+"
                          : ""}
                        {(
                          optimizerData.paramsConfig.parameters.gammaBoosts.shortGamma * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {optimizerData.performanceSummary && (
                <div className="mt-4 p-3 bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
                  <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Backtested Performance
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">
                      Win Rate:{" "}
                      <span className="text-[var(--text-high)] font-mono">
                        {formatOptimizerWinRate(optimizerData.performanceSummary.winRate)}
                      </span>
                    </span>
                    <span className="text-[var(--text-muted)]">
                      PF:{" "}
                      <span className="text-[var(--text-high)] font-mono">
                        {formatOptimizerPF(optimizerData.performanceSummary.profitFactor)}
                      </span>
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Trades:{" "}
                      <span className="text-[var(--text-high)] font-mono">
                        {optimizerData.performanceSummary.totalTrades}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </HDCard>
      )}
    </div>
  );
}

export default SetupOptimizationDashboard;
