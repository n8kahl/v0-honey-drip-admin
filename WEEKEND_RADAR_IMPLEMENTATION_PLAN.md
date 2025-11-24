# Weekend Radar Features 2-8 - Implementation Plan

**Date**: November 24, 2025
**Status**: Feature 1 Complete ✅ | Features 2-8 Planned
**Total Estimated Time**: 28-39 hours (across 3 phases)

---

## 📋 Executive Summary

This document provides a **complete, end-to-end implementation plan** for Weekend Radar Features 2-8. Feature 1 (Historical Pattern Scanner) is already complete and functional.

**Current State:**
- ✅ Feature 1: Historical Pattern Scanner - **COMPLETE** (weekend mode enabled, production thresholds adjusted)
- ⏳ Features 2-8: Awaiting implementation

**Approach:**
- **3 phases** of development (recommended order from feasibility analysis)
- Each phase delivers **immediate user value**
- Full integration with existing systems (composite scanner, risk engine, data providers)
- Comprehensive testing at each phase

---

## 🎯 Phase Overview

| Phase | Features | Time | Deliverables | User Value |
|-------|----------|------|--------------|------------|
| **Phase 1** | 5, 7 | 8-12 hrs | Watchlist Health Score + Market Regime Detector | **Immediate**: Weekend planning tools |
| **Phase 2** | 4, 2 | 10-14 hrs | SPX Weekend Lab + Options Flow Replay | **High**: Index options deep-dive |
| **Phase 3** | 3, 6 | 10-13 hrs | Premarket/Aftermarket + Backtesting | **Power**: Extended hours + validation |

**Optional:** Feature 8 (Economic Calendar) - 4-6 hrs

---

# PHASE 1: Weekend Planning Foundation (8-12 hours)

**Goal**: Deliver immediate weekend planning value with minimal external dependencies

**Features**: 5 (Watchlist Health Score) + 7 (Market Regime Detector)

---

## Feature 5: Watchlist Health Score 💚

**Estimated Time**: 3-4 hours
**Complexity**: 🟢 LOW

### 1.1 Database Schema

**New Table: `watchlist_health_scores`**

```sql
-- Migration: 014_add_watchlist_health_scores.sql
CREATE TABLE watchlist_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,

  -- Overall score (0-100)
  total_score NUMERIC(5,2) NOT NULL,

  -- Component scores (each 0-100)
  technical_score NUMERIC(5,2),
  volume_score NUMERIC(5,2),
  options_liquidity_score NUMERIC(5,2),
  catalyst_score NUMERIC(5,2),

  -- Breakdown details (JSONB for flexibility)
  technical_breakdown JSONB,  -- { ma_alignment, rsi_level, support_distance, ... }
  volume_breakdown JSONB,     -- { avg_volume, rvol, trend, ... }
  options_breakdown JSONB,    -- { bid_ask_spread, open_interest, iv_percentile, ... }
  catalyst_breakdown JSONB,   -- { earnings_dte, economic_events, ... }

  -- Playbook recommendation
  recommended_setup TEXT,      -- 'breakout_long', 'mean_reversion_short', etc.
  conditional_plan TEXT,       -- "IF price breaks 450, THEN..."
  confidence_level TEXT CHECK (confidence_level IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),

  -- Metadata
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bars_analyzed INTEGER,       -- How many bars were used

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: One score per symbol per user per snapshot
  UNIQUE(user_id, symbol, snapshot_time)
);

CREATE INDEX idx_watchlist_health_user_id ON watchlist_health_scores(user_id);
CREATE INDEX idx_watchlist_health_symbol ON watchlist_health_scores(symbol);
CREATE INDEX idx_watchlist_health_score ON watchlist_health_scores(total_score DESC);
CREATE INDEX idx_watchlist_health_time ON watchlist_health_scores(snapshot_time DESC);

-- RLS Policies
ALTER TABLE watchlist_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health scores"
  ON watchlist_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health scores"
  ON watchlist_health_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health scores"
  ON watchlist_health_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health scores"
  ON watchlist_health_scores FOR DELETE
  USING (auth.uid() = user_id);
```

### 1.2 Backend Implementation

**New File: `server/lib/healthScorer.ts`**

```typescript
/**
 * Watchlist Health Score Calculator
 *
 * Scores watchlist tickers on 4 dimensions:
 * 1. Technical Setup (40 points)
 * 2. Volume Profile (20 points)
 * 3. Options Liquidity (20 points)
 * 4. Catalyst Proximity (20 points)
 */

import type { SymbolFeatures } from '../../src/lib/strategy/engine.js';
import type { OptionContract } from '../../src/types/options.js';

export interface HealthScoreResult {
  totalScore: number;
  technicalScore: number;
  volumeScore: number;
  optionsLiquidityScore: number;
  catalystScore: number;
  technicalBreakdown: Record<string, number>;
  volumeBreakdown: Record<string, number>;
  optionsBreakdown: Record<string, number>;
  catalystBreakdown: Record<string, number>;
  recommendedSetup: string;
  conditionalPlan: string;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}

export class HealthScorer {
  /**
   * Calculate comprehensive health score for a symbol
   */
  async calculateHealthScore(
    symbol: string,
    features: SymbolFeatures,
    optionsChain?: OptionContract[]
  ): Promise<HealthScoreResult> {

    // 1. Technical Setup (40 points)
    const technical = this.scoreTechnical(features);

    // 2. Volume Profile (20 points)
    const volume = this.scoreVolume(features);

    // 3. Options Liquidity (20 points)
    const optionsLiquidity = this.scoreOptionsLiquidity(optionsChain);

    // 4. Catalyst Proximity (20 points)
    const catalyst = this.scoreCatalyst(symbol, features);

    // Total score (0-100)
    const totalScore = technical.score + volume.score + optionsLiquidity.score + catalyst.score;

    // Determine recommended setup
    const recommendedSetup = this.determineRecommendedSetup(features, totalScore);

    // Generate conditional plan
    const conditionalPlan = this.generateConditionalPlan(symbol, features, recommendedSetup);

    // Confidence level
    const confidenceLevel = this.determineConfidence(totalScore, technical, volume);

    return {
      totalScore,
      technicalScore: technical.score,
      volumeScore: volume.score,
      optionsLiquidityScore: optionsLiquidity.score,
      catalystScore: catalyst.score,
      technicalBreakdown: technical.breakdown,
      volumeBreakdown: volume.breakdown,
      optionsBreakdown: optionsLiquidity.breakdown,
      catalystBreakdown: catalyst.breakdown,
      recommendedSetup,
      conditionalPlan,
      confidenceLevel,
    };
  }

  /**
   * Score technical setup (40 points max)
   */
  private scoreTechnical(features: SymbolFeatures): { score: number; breakdown: Record<string, number> } {
    let score = 0;
    const breakdown: Record<string, number> = {};

    // MA Alignment (15 points)
    const ema21 = features.ema?.['21'];
    const ema50 = features.ema?.['50'];
    const ema200 = features.ema?.['200'];
    const price = features.price?.current;

    if (ema21 && ema50 && ema200 && price) {
      // Perfect alignment: price > 21 > 50 > 200
      if (price > ema21 && ema21 > ema50 && ema50 > ema200) {
        breakdown.ma_alignment = 15;
        score += 15;
      } else if (price > ema21 && ema21 > ema50) {
        breakdown.ma_alignment = 10;
        score += 10;
      } else if (price > ema50) {
        breakdown.ma_alignment = 5;
        score += 5;
      } else {
        breakdown.ma_alignment = 0;
      }
    }

    // RSI Level (10 points)
    const rsi = features.rsi?.['14'];
    if (rsi) {
      // Ideal RSI: 45-65 (neutral to slightly bullish, room to run)
      if (rsi >= 45 && rsi <= 65) {
        breakdown.rsi_level = 10;
        score += 10;
      } else if (rsi >= 40 && rsi <= 70) {
        breakdown.rsi_level = 7;
        score += 7;
      } else if (rsi >= 35 && rsi <= 75) {
        breakdown.rsi_level = 4;
        score += 4;
      } else {
        breakdown.rsi_level = 0;
      }
    }

    // Support/Resistance Proximity (10 points)
    const nearSwingLow = features.pattern?.near_swing_low;
    const nearSwingHigh = features.pattern?.near_swing_high;
    const nearFib618 = features.pattern?.near_fib_618;
    const nearFib500 = features.pattern?.near_fib_500;

    if (nearSwingLow || nearFib618) {
      breakdown.support_proximity = 10; // Near support = good entry
      score += 10;
    } else if (nearFib500) {
      breakdown.support_proximity = 7;
      score += 7;
    } else {
      breakdown.support_proximity = 0;
    }

    // Trend Clarity (5 points)
    const regime = features.pattern?.market_regime;
    if (regime === 'trending_up' || regime === 'trending_down') {
      breakdown.trend_clarity = 5; // Clear trend = tradeable
      score += 5;
    } else if (regime === 'ranging') {
      breakdown.trend_clarity = 3; // Range = mean reversion plays
      score += 3;
    } else {
      breakdown.trend_clarity = 0; // Choppy = avoid
    }

    return { score, breakdown };
  }

  /**
   * Score volume profile (20 points max)
   */
  private scoreVolume(features: SymbolFeatures): { score: number; breakdown: Record<string, number> } {
    let score = 0;
    const breakdown: Record<string, number> = {};

    // Relative Volume (10 points)
    const rvol = features.volume?.relativeToAvg || 1.0;
    if (rvol >= 1.5) {
      breakdown.rvol = 10; // High volume = interest
      score += 10;
    } else if (rvol >= 1.2) {
      breakdown.rvol = 7;
      score += 7;
    } else if (rvol >= 0.8) {
      breakdown.rvol = 5; // Normal volume
      score += 5;
    } else {
      breakdown.rvol = 0; // Low volume = avoid
    }

    // Average Daily Volume (5 points)
    // High ADV = liquidity
    const avgVolume = features.volume?.average || 0;
    if (avgVolume > 10_000_000) {
      breakdown.avg_volume = 5;
      score += 5;
    } else if (avgVolume > 5_000_000) {
      breakdown.avg_volume = 3;
      score += 3;
    } else if (avgVolume > 1_000_000) {
      breakdown.avg_volume = 1;
      score += 1;
    } else {
      breakdown.avg_volume = 0;
    }

    // Volume Trend (5 points)
    // Increasing volume = building momentum
    const volumeTrend = features.volume?.trend;
    if (volumeTrend === 'increasing') {
      breakdown.volume_trend = 5;
      score += 5;
    } else if (volumeTrend === 'stable') {
      breakdown.volume_trend = 3;
      score += 3;
    } else {
      breakdown.volume_trend = 0;
    }

    return { score, breakdown };
  }

  /**
   * Score options liquidity (20 points max)
   */
  private scoreOptionsLiquidity(optionsChain?: OptionContract[]): { score: number; breakdown: Record<string, number> } {
    let score = 0;
    const breakdown: Record<string, number> = {};

    if (!optionsChain || optionsChain.length === 0) {
      breakdown.no_options_data = 0;
      return { score: 10, breakdown }; // Neutral if no options data (stocks)
    }

    // Calculate average bid-ask spread (10 points)
    const spreads = optionsChain.map(opt => {
      if (!opt.bid || !opt.ask) return null;
      return (opt.ask - opt.bid) / opt.ask; // Spread as % of ask
    }).filter(s => s !== null) as number[];

    if (spreads.length > 0) {
      const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
      if (avgSpread <= 0.05) { // <5% spread = excellent
        breakdown.bid_ask_spread = 10;
        score += 10;
      } else if (avgSpread <= 0.10) { // <10% = good
        breakdown.bid_ask_spread = 7;
        score += 7;
      } else if (avgSpread <= 0.20) { // <20% = acceptable
        breakdown.bid_ask_spread = 4;
        score += 4;
      } else {
        breakdown.bid_ask_spread = 0; // >20% = avoid
      }
    }

    // Total open interest (10 points)
    const totalOI = optionsChain.reduce((sum, opt) => sum + (opt.openInterest || 0), 0);
    if (totalOI > 100_000) {
      breakdown.open_interest = 10;
      score += 10;
    } else if (totalOI > 50_000) {
      breakdown.open_interest = 7;
      score += 7;
    } else if (totalOI > 10_000) {
      breakdown.open_interest = 4;
      score += 4;
    } else {
      breakdown.open_interest = 0;
    }

    return { score, breakdown };
  }

  /**
   * Score catalyst proximity (20 points max)
   */
  private scoreCatalyst(symbol: string, features: SymbolFeatures): { score: number; breakdown: Record<string, number> } {
    let score = 0;
    const breakdown: Record<string, number> = {};

    // Earnings proximity (15 points)
    // TODO: Integrate with external earnings calendar API
    // For now, placeholder scoring
    breakdown.earnings_proximity = 0;

    // Economic events (5 points)
    // TODO: Integrate with economic calendar API
    // For now, placeholder scoring
    breakdown.economic_events = 0;

    // Default neutral score if no catalyst data
    return { score: 10, breakdown };
  }

  /**
   * Determine recommended setup based on features
   */
  private determineRecommendedSetup(features: SymbolFeatures, totalScore: number): string {
    const regime = features.pattern?.market_regime;
    const rsi = features.rsi?.['14'] || 50;
    const price = features.price?.current || 0;
    const ema21 = features.ema?.['21'] || 0;

    // Trend continuation if trending + pullback
    if (regime === 'trending_up' && price > ema21 && rsi >= 40 && rsi <= 60) {
      return 'trend_continuation_long';
    }
    if (regime === 'trending_down' && price < ema21 && rsi >= 40 && rsi <= 60) {
      return 'trend_continuation_short';
    }

    // Mean reversion if oversold/overbought
    if (rsi < 35) {
      return 'mean_reversion_long';
    }
    if (rsi > 70) {
      return 'mean_reversion_short';
    }

    // Breakout if near resistance with volume
    const nearSwingHigh = features.pattern?.near_swing_high;
    const rvol = features.volume?.relativeToAvg || 1.0;
    if (nearSwingHigh && rvol > 1.5) {
      return 'breakout_bullish';
    }

    // Default to neutral
    return 'monitor';
  }

  /**
   * Generate conditional trade plan
   */
  private generateConditionalPlan(symbol: string, features: SymbolFeatures, setup: string): string {
    const price = features.price?.current || 0;
    const atr = (features.mtf?.['5m'] as any)?.atr || (price * 0.01); // 1% default

    switch (setup) {
      case 'trend_continuation_long':
        const support = price - atr;
        return `IF ${symbol} holds above ${support.toFixed(2)} (support), look for long entry on bounce`;

      case 'breakout_bullish':
        const resistance = price + (atr * 0.5);
        return `IF ${symbol} breaks above ${resistance.toFixed(2)} with volume, enter long`;

      case 'mean_reversion_long':
        const bounce = price + (atr * 0.5);
        return `IF ${symbol} bounces from ${price.toFixed(2)}, target ${bounce.toFixed(2)} (VWAP)`;

      case 'mean_reversion_short':
        const pullback = price - (atr * 0.5);
        return `IF ${symbol} fails at ${price.toFixed(2)}, target ${pullback.toFixed(2)} (VWAP)`;

      default:
        return `Monitor ${symbol} for setup development`;
    }
  }

  /**
   * Determine confidence level
   */
  private determineConfidence(
    totalScore: number,
    technical: { score: number },
    volume: { score: number }
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    // High confidence: high total score + strong technical + good volume
    if (totalScore >= 80 && technical.score >= 30 && volume.score >= 15) {
      return 'VERY_HIGH';
    }
    if (totalScore >= 70 && technical.score >= 25 && volume.score >= 12) {
      return 'HIGH';
    }
    if (totalScore >= 60 && technical.score >= 20) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}
```

**New API Route: `server/routes/healthScore.ts`**

```typescript
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { HealthScorer } from '../lib/healthScorer.js';
import { buildSymbolFeatures } from '../../src/lib/strategy/featuresBuilder.js';
import { getOptionChain } from '../massive/client.js';

const router = express.Router();

/**
 * GET /api/health-score
 *
 * Calculate health scores for all watchlist tickers
 */
router.get('/api/health-score', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Get user's watchlist
    const { data: watchlist, error: watchlistError } = await supabase
      .from('watchlist')
      .select('symbol')
      .eq('user_id', userId);

    if (watchlistError) throw watchlistError;
    if (!watchlist || watchlist.length === 0) {
      return res.json({ scores: [] });
    }

    const scorer = new HealthScorer();
    const scores = [];

    // Calculate score for each symbol
    for (const { symbol } of watchlist) {
      try {
        // Build features (reuse existing infrastructure)
        const features = await buildSymbolFeatures(symbol);

        // Get options chain if available
        let optionsChain = null;
        try {
          optionsChain = await getOptionChain(symbol);
        } catch {
          // Options data optional
        }

        // Calculate health score
        const score = await scorer.calculateHealthScore(symbol, features, optionsChain);

        // Save to database
        const { error: insertError } = await supabase
          .from('watchlist_health_scores')
          .insert({
            user_id: userId,
            symbol,
            total_score: score.totalScore,
            technical_score: score.technicalScore,
            volume_score: score.volumeScore,
            options_liquidity_score: score.optionsLiquidityScore,
            catalyst_score: score.catalystScore,
            technical_breakdown: score.technicalBreakdown,
            volume_breakdown: score.volumeBreakdown,
            options_breakdown: score.optionsBreakdown,
            catalyst_breakdown: score.catalystBreakdown,
            recommended_setup: score.recommendedSetup,
            conditional_plan: score.conditionalPlan,
            confidence_level: score.confidenceLevel,
            snapshot_time: new Date().toISOString(),
          });

        if (insertError) {
          console.warn(`Failed to save health score for ${symbol}:`, insertError);
        }

        scores.push({
          symbol,
          ...score,
        });

      } catch (error) {
        console.error(`Error scoring ${symbol}:`, error);
      }
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    res.json({ scores });

  } catch (error) {
    console.error('Health score error:', error);
    res.status(500).json({ error: 'Failed to calculate health scores' });
  }
});

/**
 * GET /api/health-score/history/:symbol
 *
 * Get historical health scores for a symbol
 */
router.get('/api/health-score/history/:symbol', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { symbol } = req.params;
    const { limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { data, error } = await supabase
      .from('watchlist_health_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .order('snapshot_time', { ascending: false })
      .limit(Number(limit));

    if (error) throw error;

    res.json({ history: data || [] });

  } catch (error) {
    console.error('Health score history error:', error);
    res.status(500).json({ error: 'Failed to fetch health score history' });
  }
});

export default router;
```

**Update `server/index.ts`:**

```typescript
import healthScoreRoutes from './routes/healthScore.js';

// ... existing imports

app.use(healthScoreRoutes);
```

### 1.3 Frontend Implementation

**New Component: `src/components/radar/WatchlistHealthScore.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthScore {
  symbol: string;
  totalScore: number;
  technicalScore: number;
  volumeScore: number;
  optionsLiquidityScore: number;
  catalystScore: number;
  recommendedSetup: string;
  conditionalPlan: string;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}

export function WatchlistHealthScore() {
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHealthScores = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health-score', {
        headers: {
          'x-user-id': 'your-user-id', // Replace with actual user ID from auth
        },
      });

      if (!response.ok) throw new Error('Failed to fetch health scores');

      const data = await response.json();
      setScores(data.scores);
    } catch (error) {
      console.error('Error fetching health scores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthScores();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants: Record<string, any> = {
      VERY_HIGH: 'default',
      HIGH: 'secondary',
      MEDIUM: 'outline',
      LOW: 'destructive',
    };
    return <Badge variant={variants[confidence]}>{confidence.replace('_', ' ')}</Badge>;
  };

  const getSetupIcon = (setup: string) => {
    if (setup.includes('long') || setup.includes('bullish')) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (setup.includes('short') || setup.includes('bearish')) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Watchlist Health Score</h2>
        <Button onClick={fetchHealthScores} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Total Score</TableHead>
            <TableHead>Technical</TableHead>
            <TableHead>Volume</TableHead>
            <TableHead>Options</TableHead>
            <TableHead>Catalyst</TableHead>
            <TableHead>Setup</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Trade Plan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </TableCell>
            </TableRow>
          ) : scores.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No watchlist tickers found
              </TableCell>
            </TableRow>
          ) : (
            scores.map((score, idx) => (
              <TableRow key={score.symbol}>
                <TableCell className="font-bold">{idx + 1}</TableCell>
                <TableCell className="font-mono font-semibold">{score.symbol}</TableCell>
                <TableCell className={cn('font-bold', getScoreColor(score.totalScore))}>
                  {score.totalScore.toFixed(0)}
                </TableCell>
                <TableCell>{score.technicalScore.toFixed(0)}</TableCell>
                <TableCell>{score.volumeScore.toFixed(0)}</TableCell>
                <TableCell>{score.optionsLiquidityScore.toFixed(0)}</TableCell>
                <TableCell>{score.catalystScore.toFixed(0)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getSetupIcon(score.recommendedSetup)}
                    <span className="text-sm">{score.recommendedSetup.replace(/_/g, ' ')}</span>
                  </div>
                </TableCell>
                <TableCell>{getConfidenceBadge(score.confidenceLevel)}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {score.conditionalPlan}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Add to Radar page navigation:**

```tsx
// src/pages/RadarPage.tsx
import { WatchlistHealthScore } from '@/components/radar/WatchlistHealthScore';

// Add tab: "Health Score"
```

### 1.4 Tests

**New Test File: `server/lib/__tests__/healthScorer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { HealthScorer } from '../healthScorer';

describe('HealthScorer', () => {
  const scorer = new HealthScorer();

  it('scores perfect technical setup as high', async () => {
    const features = {
      price: { current: 100 },
      ema: { '21': 95, '50': 90, '200': 85 },
      rsi: { '14': 55 },
      pattern: {
        near_swing_low: true,
        market_regime: 'trending_up',
      },
      volume: {
        relativeToAvg: 1.5,
        average: 10_000_000,
        trend: 'increasing',
      },
    } as any;

    const result = await scorer.calculateHealthScore('SPY', features);

    expect(result.totalScore).toBeGreaterThan(70);
    expect(result.technicalScore).toBeGreaterThan(30);
    expect(result.confidenceLevel).toBe('HIGH');
  });

  it('scores poor setup as low', async () => {
    const features = {
      price: { current: 100 },
      ema: { '21': 105, '50': 110, '200': 115 }, // Downtrend
      rsi: { '14': 85 }, // Overbought
      pattern: {
        market_regime: 'choppy',
      },
      volume: {
        relativeToAvg: 0.5, // Low volume
        average: 500_000,
        trend: 'decreasing',
      },
    } as any;

    const result = await scorer.calculateHealthScore('XYZ', features);

    expect(result.totalScore).toBeLessThan(40);
    expect(result.confidenceLevel).toBe('LOW');
  });

  it('generates conditional plans', async () => {
    const features = {
      price: { current: 100 },
      ema: { '21': 95, '50': 90 },
      rsi: { '14': 55 },
      pattern: { market_regime: 'trending_up' },
      volume: { relativeToAvg: 1.2, average: 5_000_000 },
      mtf: {
        '5m': { atr: 2.0 },
      },
    } as any;

    const result = await scorer.calculateHealthScore('SPY', features);

    expect(result.conditionalPlan).toContain('IF SPY');
    expect(result.conditionalPlan).toContain('support');
    expect(result.recommendedSetup).toBe('trend_continuation_long');
  });
});
```

---

## Feature 7: Market Regime Detector 🌡️

**Estimated Time**: 3-5 hours
**Complexity**: 🟡 MEDIUM

### 2.1 New Indicators (ADX)

**Update: `src/lib/riskEngine/indicators.ts`**

```typescript
/**
 * Calculate ADX (Average Directional Index)
 * Measures trend strength (0-100)
 *
 * ADX > 25 = Trending
 * ADX < 20 = Ranging
 */
export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

export function calculateADX(bars: OHLCV[], period: number = 14): ADXResult | null {
  if (bars.length < period + 1) return null;

  // Calculate True Range (TR)
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;

    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);

    tr.push(Math.max(tr1, tr2, tr3));
  }

  // Calculate +DM and -DM (Directional Movement)
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      plusDM.push(0);
      minusDM.push(downMove);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }

  // Calculate smoothed TR, +DM, -DM (EMA)
  const smoothTR = ema(tr, period);
  const smoothPlusDM = ema(plusDM, period);
  const smoothMinusDM = ema(minusDM, period);

  if (!smoothTR || !smoothPlusDM || !smoothMinusDM) return null;

  const lastIdx = smoothTR.length - 1;

  // Calculate +DI and -DI
  const plusDI = (smoothPlusDM[lastIdx] / smoothTR[lastIdx]) * 100;
  const minusDI = (smoothMinusDM[lastIdx] / smoothTR[lastIdx]) * 100;

  // Calculate DX
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

  // Calculate ADX (EMA of DX)
  // For simplicity, use last 14 DX values
  const dxValues: number[] = [];
  for (let i = Math.max(0, smoothTR.length - period); i < smoothTR.length; i++) {
    const pDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const mDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const dxVal = (Math.abs(pDI - mDI) / (pDI + mDI)) * 100;
    dxValues.push(dxVal);
  }

  const adxValues = ema(dxValues, period);
  if (!adxValues) return null;

  const adx = adxValues[adxValues.length - 1];

  return { adx, plusDI, minusDI };
}

// Helper EMA function
function ema(values: number[], period: number): number[] | null {
  if (values.length < period) return null;

  const k = 2 / (period + 1);
  const result: number[] = [];

  // First EMA = SMA
  let emaValue = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(emaValue);

  // Rest = EMA
  for (let i = period; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
    result.push(emaValue);
  }

  return result;
}
```

### 2.2 Regime Detection Logic

**New File: `src/lib/radar/regimeDetector.ts`**

```typescript
import type { SymbolFeatures } from '../strategy/engine.js';
import type { ADXResult } from '../riskEngine/indicators.js';

export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'LOW_VOL';

export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number; // 0-100
  adx: number;
  vixLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  atrPercentile: number;
  characteristics: string[];
  recommendedStrategies: string[];
}

export class RegimeDetector {
  /**
   * Detect current market regime for a symbol
   */
  detectRegime(features: SymbolFeatures, adx: ADXResult, vixValue?: number): RegimeDetectionResult {
    const characteristics: string[] = [];
    const recommendedStrategies: string[] = [];

    // 1. Determine trend strength (ADX)
    const isTrending = adx.adx > 25;
    const isRanging = adx.adx < 20;
    const isStrong = adx.adx > 40;

    // 2. Determine direction (+DI vs -DI)
    const isBullish = adx.plusDI > adx.minusDI;
    const isBearish = adx.minusDI > adx.plusDI;

    // 3. Determine volatility
    const vixLevel = this.classifyVIX(vixValue);
    const mtf = features.mtf?.['5m'] as any;
    const atr = mtf?.atr || 0;
    const atrPercentile = this.calculateATRPercentile(features);

    const isHighVol = vixLevel === 'HIGH' || vixLevel === 'EXTREME' || atrPercentile > 75;
    const isLowVol = vixLevel === 'LOW' && atrPercentile < 25;

    // 4. Classify regime
    let regime: MarketRegime;
    let confidence = 70; // Base confidence

    if (isTrending && isBullish) {
      regime = 'TRENDING_UP';
      characteristics.push('Strong upward trend');
      characteristics.push(`ADX: ${adx.adx.toFixed(1)} (trending)`);
      characteristics.push(`+DI > -DI (${adx.plusDI.toFixed(1)} > ${adx.minusDI.toFixed(1)})`);
      recommendedStrategies.push('Trend Continuation Long');
      recommendedStrategies.push('Breakout Bullish');

      if (isStrong) {
        confidence = 90;
        characteristics.push('Very strong trend');
      }

    } else if (isTrending && isBearish) {
      regime = 'TRENDING_DOWN';
      characteristics.push('Strong downward trend');
      characteristics.push(`ADX: ${adx.adx.toFixed(1)} (trending)`);
      characteristics.push(`-DI > +DI (${adx.minusDI.toFixed(1)} > ${adx.plusDI.toFixed(1)})`);
      recommendedStrategies.push('Trend Continuation Short');
      recommendedStrategies.push('Breakout Bearish');

      if (isStrong) {
        confidence = 90;
        characteristics.push('Very strong trend');
      }

    } else if (isRanging) {
      regime = 'RANGING';
      characteristics.push('Sideways/ranging market');
      characteristics.push(`ADX: ${adx.adx.toFixed(1)} (weak trend)`);
      recommendedStrategies.push('Mean Reversion Long');
      recommendedStrategies.push('Mean Reversion Short');
      recommendedStrategies.push('Range Trading');
      confidence = 75;

    } else if (isHighVol) {
      regime = 'VOLATILE';
      characteristics.push('High volatility environment');
      characteristics.push(`VIX: ${vixLevel}`);
      characteristics.push(`ATR Percentile: ${atrPercentile.toFixed(0)}th`);
      recommendedStrategies.push('Gamma Squeeze');
      recommendedStrategies.push('Wide stops required');
      confidence = 80;

    } else if (isLowVol) {
      regime = 'LOW_VOL';
      characteristics.push('Low volatility environment');
      characteristics.push(`VIX: ${vixLevel}`);
      characteristics.push(`ATR Percentile: ${atrPercentile.toFixed(0)}th`);
      recommendedStrategies.push('Breakout setups (coiling)');
      recommendedStrategies.push('Tight stops possible');
      confidence = 75;

    } else {
      // Indeterminate
      regime = 'RANGING';
      characteristics.push('Unclear regime');
      recommendedStrategies.push('Monitor for clarity');
      confidence = 50;
    }

    return {
      regime,
      confidence,
      adx: adx.adx,
      vixLevel,
      atrPercentile,
      characteristics,
      recommendedStrategies,
    };
  }

  /**
   * Classify VIX level
   */
  private classifyVIX(vix?: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    if (!vix) return 'MEDIUM';

    if (vix < 15) return 'LOW';
    if (vix < 20) return 'MEDIUM';
    if (vix < 30) return 'HIGH';
    return 'EXTREME';
  }

  /**
   * Calculate ATR percentile (relative to 90-day history)
   */
  private calculateATRPercentile(features: SymbolFeatures): number {
    // TODO: Implement historical ATR lookup
    // For now, return placeholder
    return 50;
  }
}
```

### 2.3 Frontend Component

**New Component: `src/components/radar/RegimeDashboard.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegimeInfo {
  symbol: string;
  regime: string;
  confidence: number;
  adx: number;
  vixLevel: string;
  characteristics: string[];
  recommendedStrategies: string[];
}

export function RegimeDashboard() {
  const [regimes, setRegimes] = useState<RegimeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRegimes();
  }, []);

  const fetchRegimes = async () => {
    // TODO: Implement API call
    setLoading(false);
  };

  const getRegimeIcon = (regime: string) => {
    switch (regime) {
      case 'TRENDING_UP': return <TrendingUp className="w-6 h-6 text-green-500" />;
      case 'TRENDING_DOWN': return <TrendingDown className="w-6 h-6 text-red-500" />;
      case 'VOLATILE': return <Zap className="w-6 h-6 text-yellow-500" />;
      default: return <Activity className="w-6 h-6 text-gray-500" />;
    }
  };

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'TRENDING_UP': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'TRENDING_DOWN': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'VOLATILE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'RANGING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Market Regime Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {['SPX', 'NDX', 'QQQ', 'IWM', 'SPY', 'DIA'].map(symbol => (
          <Card key={symbol}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-mono">{symbol}</CardTitle>
                {getRegimeIcon('TRENDING_UP')} {/* Placeholder */}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={cn('w-full justify-center', getRegimeColor('TRENDING_UP'))}>
                TRENDING UP
              </Badge>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ADX:</span>
                  <span className="font-semibold">32.5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-semibold">90%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VIX Level:</span>
                  <span className="font-semibold">MEDIUM</span>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1">Recommended:</p>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Trend Continuation Long</li>
                  <li>• Breakout Bullish</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 2.4 Tests

**Test File: `src/lib/radar/__tests__/regimeDetector.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { RegimeDetector } from '../regimeDetector';

describe('RegimeDetector', () => {
  const detector = new RegimeDetector();

  it('detects trending up regime', () => {
    const features = {
      mtf: { '5m': { atr: 2.0 } },
    } as any;

    const adx = { adx: 35, plusDI: 30, minusDI: 15 };
    const result = detector.detectRegime(features, adx, 18);

    expect(result.regime).toBe('TRENDING_UP');
    expect(result.confidence).toBeGreaterThan(80);
    expect(result.recommendedStrategies).toContain('Trend Continuation Long');
  });

  it('detects ranging regime', () => {
    const features = {
      mtf: { '5m': { atr: 1.0 } },
    } as any;

    const adx = { adx: 15, plusDI: 20, minusDI: 18 };
    const result = detector.detectRegime(features, adx, 12);

    expect(result.regime).toBe('RANGING');
    expect(result.recommendedStrategies).toContain('Mean Reversion Long');
  });

  it('detects high volatility regime', () => {
    const features = {
      mtf: { '5m': { atr: 5.0 } },
    } as any;

    const adx = { adx: 22, plusDI: 25, minusDI: 23 };
    const result = detector.detectRegime(features, adx, 35);

    expect(result.regime).toBe('VOLATILE');
    expect(result.vixLevel).toBe('EXTREME');
  });
});
```

---

## Phase 1 Completion Checklist

- [ ] Database migration 014 applied
- [ ] Health scorer implemented and tested
- [ ] Health score API routes working
- [ ] Watchlist Health Score UI functional
- [ ] ADX indicator implemented
- [ ] Regime detector logic complete
- [ ] Regime dashboard UI complete
- [ ] All tests passing
- [ ] Documentation updated

**Estimated Delivery**: 8-12 hours

---

# PHASE 2: SPX Deep Dive (10-14 hours)

**Goal**: Index options analysis tools for weekend planning

**Features**: 4 (SPX Weekend Lab) + 2 (Options Flow Replay)

[Content continues in next response due to length...]
