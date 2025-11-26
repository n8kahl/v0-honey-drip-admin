/**
 * HDRadarGreeksDashboard.tsx - Greeks Analysis Dashboard for Radar
 *
 * Phase 2.3: Comprehensive Greeks analysis for weekend/off-hours planning
 * - IV Analysis Panel with rank gauge and recommendations
 * - Theta Decay Timeline visualization
 * - Gamma Exposure Map
 * - DTE Recommendations based on market conditions
 */

import {
  useGreeksAnalysis,
  type IVAnalysis,
  type ThetaDecayProjection,
  type GammaExposureAnalysis,
  type DTERecommendation,
} from "../../../hooks/useGreeksAnalysis";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Progress } from "../../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { cn } from "../../../lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Zap,
  Target,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  LineChart,
  Info,
} from "lucide-react";

interface HDRadarGreeksDashboardProps {
  symbol?: string;
  isOffHours?: boolean;
  className?: string;
}

export function HDRadarGreeksDashboard({
  symbol,
  isOffHours = true,
  className,
}: HDRadarGreeksDashboardProps) {
  const { analyses, getAnalysis, isLoading, refresh } = useGreeksAnalysis({
    symbol,
    enabled: true,
    refreshInterval: 60000,
  });

  const currentAnalysis = symbol ? getAnalysis(symbol) : analyses[0];

  if (isLoading && !currentAnalysis) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="py-8 text-center">
          <Activity className="h-8 w-8 animate-pulse mx-auto text-[var(--text-muted)]" />
          <p className="mt-2 text-sm text-[var(--text-muted)]">Loading Greeks analysis...</p>
        </CardContent>
      </Card>
    );
  }

  if (!currentAnalysis) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="py-8 text-center">
          <Info className="h-8 w-8 mx-auto text-[var(--text-muted)]" />
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Select a symbol to view Greeks analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-high)]">
            Greeks Analysis {symbol && `- ${symbol}`}
          </h2>
          {isOffHours && (
            <Badge variant="outline" className="text-xs">
              Off-Hours Mode
            </Badge>
          )}
        </div>
        <button
          onClick={refresh}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-med)] transition-colors"
        >
          Refresh
        </button>
      </div>

      <Tabs defaultValue="iv" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="iv">IV Analysis</TabsTrigger>
          <TabsTrigger value="theta">Theta Decay</TabsTrigger>
          <TabsTrigger value="gamma">Gamma Exposure</TabsTrigger>
          <TabsTrigger value="dte">DTE Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="iv" className="mt-4">
          <IVAnalysisPanel analysis={currentAnalysis.ivAnalysis} />
        </TabsContent>

        <TabsContent value="theta" className="mt-4">
          <ThetaDecayPanel projections={currentAnalysis.thetaProjections} />
        </TabsContent>

        <TabsContent value="gamma" className="mt-4">
          <GammaExposurePanel exposure={currentAnalysis.gammaExposure} />
        </TabsContent>

        <TabsContent value="dte" className="mt-4">
          <DTERecommendationPanel recommendation={currentAnalysis.dteRecommendation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= Sub-Components =============

interface IVAnalysisPanelProps {
  analysis: IVAnalysis | null;
}

function IVAnalysisPanel({ analysis }: IVAnalysisPanelProps) {
  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-[var(--text-muted)]">
          <LineChart className="h-8 w-8 mx-auto opacity-50" />
          <p className="mt-2">Insufficient IV data for analysis</p>
          <p className="text-xs mt-1">IV history builds over time as data is collected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* IV Rank Gauge */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            IV Rank & Percentile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Main Gauge */}
            <div className="relative">
              <IVRankGauge rank={analysis.ivRank} percentile={analysis.ivPercentile} />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Current IV</div>
                <div className="text-lg font-bold text-[var(--text-high)]">
                  {(analysis.currentIV * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">IV Rank</div>
                <div
                  className={cn(
                    "text-lg font-bold",
                    analysis.isHigh
                      ? "text-red-500"
                      : analysis.isLow
                        ? "text-green-500"
                        : "text-[var(--text-high)]"
                  )}
                >
                  {analysis.ivRank.toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Trend</div>
                <div className="flex items-center justify-center gap-1">
                  {analysis.trend === "rising" && <TrendingUp className="h-4 w-4 text-red-500" />}
                  {analysis.trend === "falling" && (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  )}
                  {analysis.trend === "stable" && <Activity className="h-4 w-4 text-yellow-500" />}
                  <span
                    className={cn(
                      "text-sm font-medium capitalize",
                      analysis.trend === "rising"
                        ? "text-red-500"
                        : analysis.trend === "falling"
                          ? "text-green-500"
                          : "text-yellow-500"
                    )}
                  >
                    {analysis.trend}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation */}
      <Card
        className={cn(
          "border-l-4",
          analysis.recommendation.action === "buy"
            ? "border-l-green-500"
            : analysis.recommendation.action === "sell"
              ? "border-l-red-500"
              : "border-l-yellow-500"
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>IV-Based Recommendation</span>
            <Badge
              variant={
                analysis.recommendation.action === "buy"
                  ? "default"
                  : analysis.recommendation.action === "sell"
                    ? "destructive"
                    : "secondary"
              }
            >
              {analysis.recommendation.action.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--accent)]" />
              <span className="font-medium text-[var(--text-high)]">
                {analysis.recommendation.strategy}
              </span>
            </div>
            <p className="text-sm text-[var(--text-med)]">{analysis.recommendation.reasoning}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[var(--text-muted)]">Confidence:</span>
              <Progress value={analysis.recommendation.confidence} className="h-2 flex-1" />
              <span className="text-xs font-medium text-[var(--text-med)]">
                {analysis.recommendation.confidence}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface IVRankGaugeProps {
  rank: number;
  percentile: number;
}

function IVRankGauge({ rank, percentile: _percentile }: IVRankGaugeProps) {
  // Determine color based on rank
  const getColor = (value: number) => {
    if (value <= 25) return "bg-green-500";
    if (value <= 50) return "bg-yellow-500";
    if (value <= 75) return "bg-orange-500";
    return "bg-red-500";
  };

  const getLabel = (value: number) => {
    if (value <= 25) return "Low";
    if (value <= 50) return "Moderate";
    if (value <= 75) return "Elevated";
    return "High";
  };

  return (
    <div className="space-y-2">
      {/* Gauge Bar */}
      <div className="relative h-8 bg-[var(--surface-2)] rounded-full overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 flex">
          <div className="w-1/4 bg-green-500/20" />
          <div className="w-1/4 bg-yellow-500/20" />
          <div className="w-1/4 bg-orange-500/20" />
          <div className="w-1/4 bg-red-500/20" />
        </div>

        {/* Indicator */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-500"
          style={{ left: `${Math.min(Math.max(rank, 0), 100)}%` }}
        />

        {/* Labels */}
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <span className="text-xs text-green-400 font-medium">Low</span>
          <span className="text-xs text-yellow-400 font-medium">Mod</span>
          <span className="text-xs text-orange-400 font-medium">Elev</span>
          <span className="text-xs text-red-400 font-medium">High</span>
        </div>
      </div>

      {/* Value Display */}
      <div className="flex items-center justify-center gap-2">
        <div className={cn("w-3 h-3 rounded-full", getColor(rank))} />
        <span className="font-bold text-[var(--text-high)]">{rank.toFixed(0)}%</span>
        <span className="text-sm text-[var(--text-muted)]">({getLabel(rank)})</span>
      </div>
    </div>
  );
}

interface ThetaDecayPanelProps {
  projections: ThetaDecayProjection[];
}

function ThetaDecayPanel({ projections }: ThetaDecayPanelProps) {
  const maxDecay = Math.max(...projections.map((p) => p.decayRate));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Theta Decay by DTE
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-[var(--surface-2)] rounded-lg">
            <Info className="h-4 w-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[var(--text-muted)]">
              Theta decay accelerates exponentially as expiration approaches. The "critical zone"
              (last 7 days) sees the steepest decay - favor shorter DTE for theta capture, longer
              for directional plays.
            </p>
          </div>

          {/* Decay Bars */}
          <div className="space-y-2">
            {projections
              .filter((p) => [0, 1, 2, 3, 7, 14, 21, 30, 45].includes(p.dte))
              .map((projection) => (
                <ThetaDecayBar key={projection.dte} projection={projection} maxDecay={maxDecay} />
              ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 justify-center pt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span className="text-xs text-[var(--text-muted)]">Critical Zone</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded" />
              <span className="text-xs text-[var(--text-muted)]">Moderate Decay</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-xs text-[var(--text-muted)]">Slow Decay</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ThetaDecayBarProps {
  projection: ThetaDecayProjection;
  maxDecay: number;
}

function ThetaDecayBar({ projection, maxDecay }: ThetaDecayBarProps) {
  const width = (projection.decayRate / maxDecay) * 100;

  const getBarColor = () => {
    if (projection.criticalZone) return "bg-red-500";
    if (projection.dte <= 14) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 text-right">
        <span
          className={cn(
            "text-sm font-medium",
            projection.criticalZone ? "text-red-500" : "text-[var(--text-med)]"
          )}
        >
          {projection.dte}d
        </span>
      </div>
      <div className="flex-1 h-6 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getBarColor())}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-16 text-right">
        <span className="text-xs text-[var(--text-muted)]">
          {(projection.decayRate * 100).toFixed(1)}%/day
        </span>
      </div>
    </div>
  );
}

interface GammaExposurePanelProps {
  exposure: GammaExposureAnalysis | null;
}

function GammaExposurePanel({ exposure }: GammaExposurePanelProps) {
  if (!exposure) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-[var(--text-muted)]">
          <Zap className="h-8 w-8 mx-auto opacity-50" />
          <p className="mt-2">Gamma exposure data unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const maxGamma = Math.max(...exposure.exposureByStrike.map((s) => Math.abs(s.netGamma)));

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Gamma Exposure Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Current Price</div>
              <div className="text-lg font-bold text-[var(--text-high)]">
                ${exposure.currentPrice.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Gamma Flip</div>
              <div className="text-lg font-bold text-[var(--accent)]">
                {exposure.gammaFlipLevel ? `$${exposure.gammaFlipLevel.toFixed(0)}` : "N/A"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">MM Bias</div>
              <div
                className={cn(
                  "text-lg font-bold capitalize",
                  exposure.marketMakerBias === "positive"
                    ? "text-green-500"
                    : exposure.marketMakerBias === "negative"
                      ? "text-red-500"
                      : "text-yellow-500"
                )}
              >
                {exposure.marketMakerBias}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exposure Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gamma by Strike</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {exposure.exposureByStrike
              .filter((_, i) => i % 2 === 0) // Show every other strike for clarity
              .map((level) => (
                <GammaExposureRow
                  key={level.strike}
                  level={level}
                  maxGamma={maxGamma}
                  currentPrice={exposure.currentPrice}
                />
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Volatility Forecast */}
      <Card
        className={cn(
          "border-l-4",
          exposure.volatilityForecast === "elevated"
            ? "border-l-red-500"
            : exposure.volatilityForecast === "suppressed"
              ? "border-l-green-500"
              : "border-l-yellow-500"
        )}
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {exposure.volatilityForecast === "elevated" && (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            {exposure.volatilityForecast === "suppressed" && (
              <Activity className="h-5 w-5 text-green-500" />
            )}
            {exposure.volatilityForecast === "neutral" && (
              <Activity className="h-5 w-5 text-yellow-500" />
            )}
            <div>
              <div className="font-medium text-[var(--text-high)] capitalize">
                Volatility Forecast: {exposure.volatilityForecast}
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                {exposure.volatilityForecast === "elevated"
                  ? "Negative gamma regime - expect larger price swings"
                  : exposure.volatilityForecast === "suppressed"
                    ? "Positive gamma regime - market makers dampen moves"
                    : "Neutral gamma - standard volatility expected"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface GammaExposureRowProps {
  level: {
    strike: number;
    netGamma: number;
    isGammaFlip: boolean;
  };
  maxGamma: number;
  currentPrice: number;
}

function GammaExposureRow({ level, maxGamma, currentPrice }: GammaExposureRowProps) {
  const width = (Math.abs(level.netGamma) / maxGamma) * 50;
  const isCall = level.netGamma > 0;
  const isAtm = Math.abs(level.strike - currentPrice) < currentPrice * 0.01;

  return (
    <div className={cn("flex items-center gap-2 h-5", level.isGammaFlip && "bg-yellow-500/10")}>
      <div className="w-16 text-right">
        <span
          className={cn(
            "text-xs",
            isAtm ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"
          )}
        >
          ${level.strike}
        </span>
      </div>

      {/* Negative bar (left) */}
      <div className="w-24 flex justify-end">
        {!isCall && <div className="h-3 bg-red-500 rounded-l" style={{ width: `${width}%` }} />}
      </div>

      {/* Center line */}
      <div className="w-px h-full bg-[var(--border-hairline)]" />

      {/* Positive bar (right) */}
      <div className="w-24">
        {isCall && <div className="h-3 bg-green-500 rounded-r" style={{ width: `${width}%` }} />}
      </div>

      {level.isGammaFlip && (
        <Badge variant="outline" className="text-xs h-4">
          Flip
        </Badge>
      )}
    </div>
  );
}

interface DTERecommendationPanelProps {
  recommendation: DTERecommendation | null;
}

function DTERecommendationPanel({ recommendation }: DTERecommendationPanelProps) {
  if (!recommendation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-[var(--text-muted)]">
          <Target className="h-8 w-8 mx-auto opacity-50" />
          <p className="mt-2">DTE recommendation unavailable</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Recommendation */}
      <Card className="border-2 border-[var(--accent)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--accent)]" />
              Recommended DTE
            </span>
            <Badge
              variant={
                recommendation.riskLevel === "low"
                  ? "default"
                  : recommendation.riskLevel === "high"
                    ? "destructive"
                    : "secondary"
              }
            >
              {recommendation.riskLevel.toUpperCase()} RISK
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-5xl font-bold text-[var(--accent)]">
              {recommendation.recommendedDTE}
            </div>
            <div className="text-sm text-[var(--text-muted)] mt-1">days to expiration</div>
          </div>

          <div className="space-y-2 mt-4">
            {recommendation.reasoning.map((reason, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[var(--text-med)]">{reason}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alternatives */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Alternative DTEs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendation.alternativeDTEs.map((alt, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-[var(--text-med)]">{alt.dte}d</div>
                  <div className="text-sm text-[var(--text-muted)]">{alt.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={alt.suitability} className="w-16 h-2" />
                  <span className="text-xs font-medium text-[var(--text-med)]">
                    {alt.suitability}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HDRadarGreeksDashboard;
