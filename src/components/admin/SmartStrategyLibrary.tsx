/**
 * SmartStrategyLibrary - Advanced Strategy Management Component
 *
 * Features:
 * - Card-based strategy display from Supabase
 * - Live performance stats (Win Rate, Profit Factor, Expectancy)
 * - Smart Gate visualization badges
 * - Optimizer upgrade dialog for pending_params review
 */

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  Play,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  listAllStrategies,
  toggleStrategyEnabled,
  toggleAutoOptimize,
  applyPendingParams,
  dismissPendingParams,
  saveOptimizationResult,
} from "../../lib/strategy/admin";
import { StrategyOptimizer, type OptimizationResult } from "../../lib/strategy/optimizer";
import {
  SignalPerformanceTracker,
  type WinRateResult,
} from "../../lib/analytics/SignalPerformance";
import { createClient } from "../../lib/supabase/client";
import type {
  StrategyDefinition,
  StrategyOptimizationParams,
  StrategySmartGates,
} from "../../types/strategy";
import { useAppToast } from "../../hooks/useAppToast";

interface StrategyPerformanceStats {
  winRate: number;
  profitFactor: number;
  expectancy: number;
  totalTrades: number;
}

interface StrategyCardProps {
  strategy: StrategyDefinition;
  stats?: StrategyPerformanceStats;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onToggleAutoOptimize: (id: string, autoOptimize: boolean) => void;
  onReviewUpgrade: (strategy: StrategyDefinition) => void;
  onRunOptimizer: (strategy: StrategyDefinition) => void;
  isOptimizing?: boolean;
}

// Smart Gate Badge Component
function SmartGateBadges({ gates }: { gates?: StrategySmartGates }) {
  if (!gates) return null;

  const badges: Array<{ label: string; variant: "default" | "secondary" | "outline" }> = [];

  if (gates.minFlowScore) {
    badges.push({ label: `Flow > ${gates.minFlowScore}`, variant: "default" });
  }
  if (gates.requiredFlowBias && gates.requiredFlowBias !== "any") {
    badges.push({
      label: `Bias: ${gates.requiredFlowBias}`,
      variant: gates.requiredFlowBias === "bullish" ? "default" : "secondary",
    });
  }
  if (gates.gammaRegime && gates.gammaRegime !== "any") {
    badges.push({
      label: `Gamma: ${gates.gammaRegime === "long_gamma" ? "Long" : "Short"}`,
      variant: "outline",
    });
  }
  if (gates.minGammaExposure) {
    badges.push({ label: `GEX > ${gates.minGammaExposure}`, variant: "outline" });
  }
  if (gates.minInstitutionalScore) {
    badges.push({ label: `Inst > ${gates.minInstitutionalScore}`, variant: "secondary" });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {badges.map((badge, idx) => (
        <Badge key={idx} variant={badge.variant} className="text-xs">
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

// Strategy Card Component
function StrategyCard({
  strategy,
  stats,
  onToggleEnabled,
  onToggleAutoOptimize,
  onReviewUpgrade,
  onRunOptimizer,
  isOptimizing = false,
}: StrategyCardProps) {
  const hasPendingUpgrade = !!strategy.pendingParams;
  const expectancyGain = strategy.pendingParams?.expectancyGain ?? 0;

  return (
    <Card className={`relative ${!strategy.enabled ? "opacity-60" : ""}`}>
      {/* Pending Upgrade Indicator */}
      {hasPendingUpgrade && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
            <Sparkles className="w-3 h-3" />
            Upgrade Available
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {strategy.shortName && (
                <Badge variant="outline" className="text-xs">
                  {strategy.shortName}
                </Badge>
              )}
              {strategy.name}
            </CardTitle>
            <CardDescription className="text-xs mt-1 line-clamp-2">
              {strategy.description || "No description"}
            </CardDescription>
          </div>
          <Badge
            variant={
              strategy.entrySide === "LONG"
                ? "default"
                : strategy.entrySide === "SHORT"
                  ? "secondary"
                  : "outline"
            }
          >
            {strategy.entrySide}
          </Badge>
        </div>

        {/* Smart Gates */}
        <SmartGateBadges gates={strategy.smartGates} />
      </CardHeader>

      <CardContent className="pb-2">
        {/* Performance Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-xs text-muted-foreground">Win Rate</div>
            <div
              className={`text-sm font-bold ${stats && stats.winRate >= 50 ? "text-green-500" : "text-red-500"}`}
            >
              {stats ? `${stats.winRate.toFixed(1)}%` : "-"}
            </div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-xs text-muted-foreground">PF</div>
            <div
              className={`text-sm font-bold ${stats && stats.profitFactor >= 1.5 ? "text-green-500" : "text-amber-500"}`}
            >
              {stats ? stats.profitFactor.toFixed(2) : "-"}
            </div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-xs text-muted-foreground">Expectancy</div>
            <div
              className={`text-sm font-bold ${stats && stats.expectancy > 0 ? "text-green-500" : "text-red-500"}`}
            >
              {stats ? `$${stats.expectancy.toFixed(0)}` : "-"}
            </div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-xs text-muted-foreground">Trades</div>
            <div className="text-sm font-bold">{stats ? stats.totalTrades : "-"}</div>
          </div>
        </div>

        {/* Optimization Status */}
        {strategy.lastOptimizedAt && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Last optimized: {new Date(strategy.lastOptimizedAt).toLocaleDateString()}
          </div>
        )}

        {/* Baseline vs Current Expectancy */}
        {strategy.baselineExpectancy !== null && strategy.baselineExpectancy !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Baseline expectancy: ${strategy.baselineExpectancy.toFixed(2)}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-2">
        {/* Enable/Disable Toggle */}
        <Button
          variant={strategy.enabled ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleEnabled(strategy.id, strategy.enabled)}
        >
          {strategy.enabled ? "Enabled" : "Disabled"}
        </Button>

        {/* Auto-Optimize Toggle */}
        <Button
          variant={strategy.autoOptimize ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleAutoOptimize(strategy.id, strategy.autoOptimize ?? false)}
          className="flex items-center gap-1"
        >
          <Settings2 className="w-3 h-3" />
          {strategy.autoOptimize ? "Auto-Opt ON" : "Auto-Opt OFF"}
        </Button>

        {/* Run Optimizer Button */}
        {!hasPendingUpgrade && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRunOptimizer(strategy)}
            disabled={isOptimizing}
            className="flex items-center gap-1 ml-auto"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Run Optimizer
              </>
            )}
          </Button>
        )}

        {/* Review Upgrade Button */}
        {hasPendingUpgrade && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onReviewUpgrade(strategy)}
            className="flex items-center gap-1 ml-auto"
          >
            <Sparkles className="w-3 h-3" />
            Review Upgrade
            {expectancyGain > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">
                +{(expectancyGain * 100).toFixed(1)}%
              </Badge>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Upgrade Review Dialog Component
function UpgradeReviewDialog({
  strategy,
  open,
  onOpenChange,
  onApply,
  onDismiss,
}: {
  strategy: StrategyDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (strategyId: string) => Promise<void>;
  onDismiss: (strategyId: string) => Promise<void>;
}) {
  const [applying, setApplying] = useState(false);
  const pending = strategy?.pendingParams;

  if (!strategy || !pending) return null;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(strategy.id);
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  };

  const handleDismiss = async () => {
    await onDismiss(strategy.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Review Optimization Upgrade
          </DialogTitle>
          <DialogDescription>
            The GA optimizer has found improved parameters for <strong>{strategy.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expectancy Comparison */}
          {strategy.baselineExpectancy !== null && pending.expectancyGain !== undefined && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Expectancy Comparison</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="text-lg font-bold text-amber-500">
                    ${strategy.baselineExpectancy?.toFixed(2) ?? "N/A"}
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Optimized</div>
                  <div className="text-lg font-bold text-green-500">
                    $
                    {(
                      (strategy.baselineExpectancy ?? 0) *
                      (1 + (pending.expectancyGain ?? 0))
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-center">
                <Badge variant="default" className="bg-green-500">
                  +{((pending.expectancyGain ?? 0) * 100).toFixed(1)}% Improvement
                </Badge>
              </div>
            </div>
          )}

          {/* Risk/Reward Parameters */}
          {pending.riskReward && (
            <div className="p-4 border rounded-lg">
              <div className="text-sm font-medium mb-2">Risk/Reward Parameters</div>
              <div className="space-y-2 text-sm">
                {pending.riskReward.stopMultiplier !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stop Multiplier</span>
                    <span className="font-mono">
                      {pending.riskReward.stopMultiplier.toFixed(2)}x ATR
                    </span>
                  </div>
                )}
                {pending.riskReward.targetMultiplier !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target Multiplier</span>
                    <span className="font-mono">
                      {pending.riskReward.targetMultiplier.toFixed(2)}x ATR
                    </span>
                  </div>
                )}
                {pending.riskReward.trailingStopPct !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trailing Stop</span>
                    <span className="font-mono">
                      {(pending.riskReward.trailingStopPct * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Consensus Parameters */}
          {pending.consensus && (
            <div className="p-4 border rounded-lg">
              <div className="text-sm font-medium mb-2">Consensus Parameters</div>
              <div className="space-y-2 text-sm">
                {pending.consensus.minScore !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Score</span>
                    <span className="font-mono">{pending.consensus.minScore}</span>
                  </div>
                )}
                {pending.consensus.minConfluence !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Confluence</span>
                    <span className="font-mono">{pending.consensus.minConfluence}</span>
                  </div>
                )}
                {pending.consensus.requiredFactors &&
                  pending.consensus.requiredFactors.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Required Factors</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pending.consensus.requiredFactors.map((factor) => (
                          <Badge key={factor} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              Applying these changes will update the live strategy configuration. This action cannot
              be undone automatically.
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button onClick={handleApply} disabled={applying}>
            {applying ? "Applying..." : "Apply Upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export function SmartStrategyLibrary() {
  const toast = useAppToast();
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, StrategyPerformanceStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDefinition | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);

  // Load strategies from database
  const loadStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const allStrategies = await listAllStrategies();
      setStrategies(allStrategies);

      // Load performance stats for each strategy
      const supabase = createClient();
      const tracker = new SignalPerformanceTracker(supabase);
      const newStatsMap = new Map<string, StrategyPerformanceStats>();

      for (const strategy of allStrategies) {
        try {
          const winRatesResult = await tracker.getWinRates({ opportunityType: strategy.slug });
          // getWinRates returns an array, aggregate the first result or use totals
          if (winRatesResult && winRatesResult.length > 0) {
            const winRates = winRatesResult[0];
            // Calculate profit factor from win rate and average win/loss percentages
            const winRateDecimal = (winRates.winRate ?? 0) / 100;
            const lossRateDecimal = 1 - winRateDecimal;
            const avgWinPct = winRates.avgWinPct ?? 0;
            const avgLossPct = Math.abs(winRates.avgLossPct ?? 1); // Avoid division by zero
            const profitFactor =
              lossRateDecimal > 0 && avgLossPct > 0
                ? (winRateDecimal * avgWinPct) / (lossRateDecimal * avgLossPct)
                : 0;

            newStatsMap.set(strategy.id, {
              winRate: winRates.winRate ?? 0,
              profitFactor,
              expectancy: winRates.expectancy ?? 0,
              totalTrades: winRates.totalSignals ?? 0,
            });
          }
        } catch (err) {
          // Stats not available for this strategy
          console.debug(`No performance stats for ${strategy.slug}`);
        }
      }

      setStatsMap(newStatsMap);
    } catch (error: any) {
      console.error("Failed to load strategies:", error);
      toast.error("Failed to load strategies: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  // Handlers
  const handleToggleEnabled = async (strategyId: string, currentEnabled: boolean) => {
    try {
      await toggleStrategyEnabled(strategyId, !currentEnabled);
      toast.success(`Strategy ${!currentEnabled ? "enabled" : "disabled"}`);
      await loadStrategies();
    } catch (error: any) {
      toast.error("Failed to toggle strategy: " + error.message);
    }
  };

  const handleToggleAutoOptimize = async (strategyId: string, currentAutoOptimize: boolean) => {
    try {
      await toggleAutoOptimize(strategyId, !currentAutoOptimize);
      toast.success(`Auto-optimize ${!currentAutoOptimize ? "enabled" : "disabled"}`);
      await loadStrategies();
    } catch (error: any) {
      toast.error("Failed to toggle auto-optimize: " + error.message);
    }
  };

  const handleReviewUpgrade = (strategy: StrategyDefinition) => {
    setSelectedStrategy(strategy);
    setUpgradeDialogOpen(true);
  };

  const handleApplyUpgrade = async (strategyId: string) => {
    try {
      await applyPendingParams(strategyId);
      toast.success("Optimization parameters applied successfully!");
      await loadStrategies();
    } catch (error: any) {
      toast.error("Failed to apply upgrade: " + error.message);
    }
  };

  const handleDismissUpgrade = async (strategyId: string) => {
    try {
      await dismissPendingParams(strategyId);
      toast.info("Pending parameters dismissed");
      await loadStrategies();
    } catch (error: any) {
      toast.error("Failed to dismiss upgrade: " + error.message);
    }
  };

  // Optimizer Handler
  const handleRunOptimizer = async (strategy: StrategyDefinition) => {
    setOptimizingId(strategy.id);
    const optimizer = new StrategyOptimizer();

    try {
      toast.info(`Starting optimization for ${strategy.name}...`);

      const result = await optimizer.optimize(strategy, {
        onProgress: (progress, message) => {
          // Optional: could show a progress toast or update local state
          console.log(`[Optimizer] ${message} (${progress.toFixed(0)}%)`);
        },
      });

      if (result.improvement > 0) {
        await saveOptimizationResult(strategy.id, result.bestParams, result.improvement);
        toast.success(
          `Optimization complete! Expectancy improved by ${(result.improvement * 100).toFixed(1)}%`
        );
        await loadStrategies();
      } else {
        toast.info("Optimization complete. No significant improvements found.");
      }
    } catch (error: any) {
      console.error("Optimizer error:", error);
      toast.error("Optimization failed: " + error.message);
    } finally {
      setOptimizingId(null);
    }
  };

  // Filter strategies with pending upgrades
  const strategiesWithUpgrades = strategies.filter((s) => s.pendingParams);
  const enabledStrategies = strategies.filter((s) => s.enabled);
  const autoOptimizeCount = strategies.filter((s) => s.autoOptimize).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Smart Strategy Library
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage strategies with live performance tracking and AI-powered optimization
          </p>
        </div>
        <Button variant="outline" onClick={loadStrategies} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{strategies.length}</div>
            <div className="text-xs text-muted-foreground">Total Strategies</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{enabledStrategies.length}</div>
            <div className="text-xs text-muted-foreground">Enabled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">{autoOptimizeCount}</div>
            <div className="text-xs text-muted-foreground">Auto-Optimize</div>
          </CardContent>
        </Card>
        <Card className={strategiesWithUpgrades.length > 0 ? "border-amber-500" : ""}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-500">{strategiesWithUpgrades.length}</div>
            <div className="text-xs text-muted-foreground">Pending Upgrades</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Upgrades Alert */}
      {strategiesWithUpgrades.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div className="flex-1">
            <div className="font-medium">
              {strategiesWithUpgrades.length} strategies have optimized parameters waiting for
              review
            </div>
            <div className="text-sm text-muted-foreground">
              Click "Review Upgrade" on any card to compare and apply improvements
            </div>
          </div>
        </div>
      )}

      {/* Strategy Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading strategies...
        </div>
      ) : strategies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No strategies found. Add strategies in the Strategy Library Admin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              stats={statsMap.get(strategy.id)}
              onToggleEnabled={handleToggleEnabled}
              onToggleAutoOptimize={handleToggleAutoOptimize}
              onReviewUpgrade={handleReviewUpgrade}
              onRunOptimizer={handleRunOptimizer}
              isOptimizing={optimizingId === strategy.id}
            />
          ))}
        </div>
      )}

      {/* Upgrade Review Dialog */}
      <UpgradeReviewDialog
        strategy={selectedStrategy}
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        onApply={handleApplyUpgrade}
        onDismiss={handleDismissUpgrade}
      />
    </div>
  );
}
