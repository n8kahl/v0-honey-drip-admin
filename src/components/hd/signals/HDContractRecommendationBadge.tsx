/**
 * Contract Recommendation Badge
 * Displays AI-powered contract recommendation with flow, Greeks, and scoring
 */

import React from 'react';
import type { ContractScore } from '../../../lib/massive/contract-recommendations';
import { Badge } from '../../../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/tooltip';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Activity } from 'lucide-react';

interface HDContractRecommendationBadgeProps {
  score: ContractScore;
  compact?: boolean;
}

export function HDContractRecommendationBadge({ score, compact = false }: HDContractRecommendationBadgeProps) {
  // Determine badge appearance based on recommendation
  const getBadgeVariant = () => {
    switch (score.recommendation) {
      case 'strong_buy':
        return 'default'; // Green
      case 'buy':
        return 'secondary'; // Blue/neutral
      case 'consider':
        return 'outline'; // Outline
      case 'avoid':
        return 'destructive'; // Red
      default:
        return 'outline';
    }
  };

  const getBadgeIcon = () => {
    switch (score.recommendation) {
      case 'strong_buy':
        return <Zap className="w-3 h-3 mr-1" />;
      case 'buy':
        return <TrendingUp className="w-3 h-3 mr-1" />;
      case 'consider':
        return <Activity className="w-3 h-3 mr-1" />;
      case 'avoid':
        return <AlertTriangle className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  const getBadgeLabel = () => {
    if (compact) {
      return `${score.score}`;
    }
    switch (score.recommendation) {
      case 'strong_buy':
        return `⭐ ${score.score}`;
      case 'buy':
        return `${score.score}`;
      case 'consider':
        return `${score.score}`;
      case 'avoid':
        return `⚠️ ${score.score}`;
      default:
        return `${score.score}`;
    }
  };

  // Format tooltip content
  const renderTooltipContent = () => {
    return (
      <div className="max-w-sm space-y-2">
        <div className="font-bold text-sm border-b border-border pb-1">
          {score.recommendation === 'strong_buy' && '⭐ Strong Buy'}
          {score.recommendation === 'buy' && '✓ Buy'}
          {score.recommendation === 'consider' && '~ Consider'}
          {score.recommendation === 'avoid' && '⚠️ Avoid'}
          <span className="ml-2 text-muted-foreground">Score: {score.score}/100</span>
        </div>

        {/* Metric breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Flow:</span>
            <span className="ml-1 font-medium">{score.metrics.flowScore}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Liquidity:</span>
            <span className="ml-1 font-medium">{score.metrics.liquidityScore}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Greeks:</span>
            <span className="ml-1 font-medium">{score.metrics.greeksScore}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Value:</span>
            <span className="ml-1 font-medium">{score.metrics.valueScore}</span>
          </div>
        </div>

        {/* Reasons */}
        {score.reasons.length > 0 && (
          <div className="text-xs space-y-1">
            <div className="font-medium text-muted-foreground">Why this score:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {score.reasons.slice(0, 5).map((reason, idx) => (
                <li key={idx} className="text-muted-foreground">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {score.warnings.length > 0 && (
          <div className="text-xs space-y-1 border-t border-border pt-2">
            <div className="font-medium text-destructive">⚠️ Warnings:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {score.warnings.map((warning, idx) => (
                <li key={idx} className="text-destructive">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Top rank indicator (show crown for #1)
  const isTopRank = score.rank === 1;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            {isTopRank && <span className="text-xs">👑</span>}
            <Badge variant={getBadgeVariant()} className="cursor-help text-xs px-2 py-0.5">
              {getBadgeIcon()}
              {getBadgeLabel()}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border border-border">
          {renderTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Flow Indicator Badge
 * Shows flow metrics (sweeps, blocks, unusual activity)
 */
interface HDFlowIndicatorBadgeProps {
  sweepCount?: number;
  blockCount?: number;
  unusualActivity?: boolean;
  flowScore?: number;
  flowBias?: 'bullish' | 'bearish' | 'neutral';
  compact?: boolean;
}

export function HDFlowIndicatorBadge({
  sweepCount = 0,
  blockCount = 0,
  unusualActivity = false,
  flowScore = 0,
  flowBias = 'neutral',
  compact = false,
}: HDFlowIndicatorBadgeProps) {
  if (!sweepCount && !blockCount && !unusualActivity && flowScore < 50) {
    return null; // No significant flow
  }

  const hasSignificantFlow = sweepCount > 0 || blockCount > 0 || unusualActivity;

  const getBadgeColor = () => {
    if (flowBias === 'bullish') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (flowBias === 'bearish') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getFlowLabel = () => {
    if (compact) {
      if (sweepCount > 0) return `🔥${sweepCount}`;
      if (blockCount > 0) return `📦${blockCount}`;
      return '💫';
    }

    const labels: string[] = [];
    if (sweepCount > 0) labels.push(`${sweepCount} sweep${sweepCount > 1 ? 's' : ''}`);
    if (blockCount > 0) labels.push(`${blockCount} block${blockCount > 1 ? 's' : ''}`);
    if (unusualActivity) labels.push('unusual vol');

    return labels.length > 0 ? labels.join(', ') : `Flow: ${flowScore}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${getBadgeColor()} border cursor-help text-xs px-2 py-0.5`}>
            {getFlowLabel()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border border-border">
          <div className="max-w-xs space-y-2 text-xs">
            <div className="font-bold border-b border-border pb-1">
              Options Flow Detected
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground">Sweeps:</span>
                <span className="ml-2 font-medium">{sweepCount}</span>
                <span className="ml-1 text-muted-foreground">(smart money)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Blocks:</span>
                <span className="ml-2 font-medium">{blockCount}</span>
                <span className="ml-1 text-muted-foreground">(institutional)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unusual Activity:</span>
                <span className="ml-2 font-medium">{unusualActivity ? 'Yes' : 'No'}</span>
              </div>
              <div className="border-t border-border pt-1 mt-2">
                <span className="text-muted-foreground">Flow Score:</span>
                <span className="ml-2 font-medium">{flowScore}/100</span>
              </div>
              <div>
                <span className="text-muted-foreground">Bias:</span>
                <span className={`ml-2 font-medium ${flowBias === 'bullish' ? 'text-green-400' : flowBias === 'bearish' ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {flowBias}
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Greeks Warning Badge
 * Shows important Greeks-based warnings (gamma risk, theta decay)
 */
interface HDGreeksWarningBadgeProps {
  gammaRisk?: 'high' | 'medium' | 'low';
  thetaDecayRate?: 'extreme' | 'high' | 'moderate' | 'low';
  deltaNormalized?: number;
  hoursToExpiry?: number;
}

export function HDGreeksWarningBadge({
  gammaRisk = 'low',
  thetaDecayRate = 'low',
  deltaNormalized = 0,
  hoursToExpiry = 24,
}: HDGreeksWarningBadgeProps) {
  const hasWarning = gammaRisk === 'high' || thetaDecayRate === 'extreme' || thetaDecayRate === 'high';

  if (!hasWarning) return null;

  const getWarningLevel = () => {
    if (thetaDecayRate === 'extreme') return 'destructive';
    if (gammaRisk === 'high' || thetaDecayRate === 'high') return 'warning';
    return 'outline';
  };

  const getWarningIcon = () => {
    if (thetaDecayRate === 'extreme' || thetaDecayRate === 'high') return '⏰';
    if (gammaRisk === 'high') return '⚡';
    return '⚠️';
  };

  const getWarningLabel = () => {
    if (thetaDecayRate === 'extreme') return 'Extreme Theta Decay';
    if (thetaDecayRate === 'high') return 'High Theta Decay';
    if (gammaRisk === 'high') return 'High Gamma Risk';
    return 'Greeks Warning';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={getWarningLevel() as any}
            className="cursor-help text-xs px-2 py-0.5"
          >
            {getWarningIcon()} {getWarningLabel()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border border-border">
          <div className="max-w-xs space-y-2 text-xs">
            <div className="font-bold border-b border-border pb-1">
              Greeks Analysis
            </div>
            <div className="space-y-1">
              {gammaRisk === 'high' && (
                <div className="text-yellow-400">
                  ⚡ <strong>High Gamma:</strong> Explosive price sensitivity near ATM.
                  Position can move rapidly.
                </div>
              )}
              {thetaDecayRate === 'extreme' && (
                <div className="text-destructive">
                  ⏰ <strong>Extreme Theta Decay:</strong> Option losing 50%+ value per hour.
                  Close to expiry ({hoursToExpiry?.toFixed(1)}h remaining).
                </div>
              )}
              {thetaDecayRate === 'high' && thetaDecayRate !== 'extreme' && (
                <div className="text-yellow-400">
                  ⏰ <strong>High Theta Decay:</strong> Rapid time decay in effect.
                  Monitor position closely.
                </div>
              )}
              <div className="border-t border-border pt-1 mt-2">
                <span className="text-muted-foreground">Delta (normalized):</span>
                <span className="ml-2 font-medium">{(deltaNormalized * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Gamma Risk:</span>
                <span className="ml-2 font-medium capitalize">{gammaRisk}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Theta Decay:</span>
                <span className="ml-2 font-medium capitalize">{thetaDecayRate}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
