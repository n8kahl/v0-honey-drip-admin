/**
 * SPX/NDX 0DTE Specialized Strategies
 * Optimized for same-day index options expiration trading
 * Leverages flow intelligence, Greeks analysis, and macro context
 */

import type { StrategyDefinition } from '../../types/strategy';

/**
 * SPX 0DTE Flow Sweep Long
 * Enters when detecting institutional sweep activity with bullish flow
 * Best during first 2 hours and power hour
 */
export const SPX_0DTE_FLOW_SWEEP_LONG: Partial<StrategyDefinition> = {
  name: 'SPX 0DTE Flow Sweep Long',
  slug: 'spx-0dte-flow-sweep-long',
  category: 'SPX_SPECIAL',
  underlyingScope: 'SPX_ONLY',
  barTimeframe: '5m',
  description: 'Institutional sweep activity detected on SPX 0DTE calls with bullish macro alignment',
  timeWindow: {
    start: '09:35',
    end: '15:30',
    timezone: 'America/New_York',
  },
  cooldownMinutes: 10,
  oncePerSession: false,
  conditions: {
    type: 'AND',
    children: [
      // Flow requirements
      {
        type: 'RULE',
        rule: { field: 'flow.sweepCount', op: '>=', value: 1 },
      },
      {
        type: 'RULE',
        rule: { field: 'flow.flowBias', op: '==', value: 'bullish' },
      },
      {
        type: 'RULE',
        rule: { field: 'flow.flowScore', op: '>=', value: 60 },
      },
      // Price action
      {
        type: 'RULE',
        rule: { field: 'price.current', op: '>', value: 'ema.21' },
      },
      // Macro alignment
      {
        type: 'RULE',
        rule: { field: 'pattern.spx_trend', op: '==', value: 'bullish' },
      },
      // Volume confirmation
      {
        type: 'RULE',
        rule: { field: 'volume.relativeToAvg', op: '>=', value: 1.2 },
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 65,
      ready: 80,
      SCALP: { min: 70, ready: 85 }, // Higher bar for 0DTE
    },
  },
};

/**
 * SPX 0DTE Gamma Scalp
 * Targets high gamma (ATM) contracts with tight stop/profit targets
 * Works best in low VIX, trending markets
 */
export const SPX_0DTE_GAMMA_SCALP: Partial<StrategyDefinition> = {
  name: 'SPX 0DTE Gamma Scalp',
  slug: 'spx-0dte-gamma-scalp',
  category: 'SPX_SPECIAL',
  underlyingScope: 'SPX_ONLY',
  barTimeframe: '1m',
  description: 'High gamma ATM scalp with tight risk management for SPX 0DTE',
  timeWindow: {
    start: '09:45',
    end: '15:00', // Avoid last hour theta decay
    timezone: 'America/New_York',
  },
  cooldownMinutes: 5,
  oncePerSession: false,
  conditions: {
    type: 'AND',
    children: [
      // Greeks requirements
      {
        type: 'RULE',
        rule: { field: 'greeks.gammaRisk', op: '==', value: 'high' },
      },
      {
        type: 'RULE',
        rule: { field: 'greeks.deltaNormalized', op: 'insideRange', value: [0.40, 0.60] }, // ATM range
      },
      // Low VIX environment (less whipsaw)
      {
        type: 'RULE',
        rule: { field: 'pattern.vix_level', op: '!=', value: 'high' },
      },
      // Trending market (not choppy)
      {
        type: 'RULE',
        rule: { field: 'pattern.market_regime', op: '==', value: 'trending' },
      },
      // EMA alignment for trend
      {
        type: 'RULE',
        rule: { field: 'pattern.spx_ema_alignment', op: '==', value: true },
      },
      // Momentum confirmation
      {
        type: 'RULE',
        rule: { field: 'rsi.14', op: 'insideRange', value: [40, 70] }, // Not extreme
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 70,
      ready: 85,
      SCALP: { min: 75, ready: 88 },
    },
  },
};

/**
 * SPX 0DTE Power Hour Reversal
 * Captures end-of-day mean reversion with flow confirmation
 * 3:00-3:45 PM window for final hour positioning
 */
export const SPX_0DTE_POWER_HOUR_REVERSAL: Partial<StrategyDefinition> = {
  name: 'SPX 0DTE Power Hour Reversal',
  slug: 'spx-0dte-power-hour-reversal',
  category: 'SPX_SPECIAL',
  underlyingScope: 'SPX_ONLY',
  barTimeframe: '5m',
  description: 'Mean reversion setup in final trading hour with RSI divergence',
  timeWindow: {
    start: '15:00',
    end: '15:45',
    timezone: 'America/New_York',
  },
  cooldownMinutes: 15,
  oncePerSession: true, // One shot per day
  conditions: {
    type: 'AND',
    children: [
      // RSI divergence signal
      {
        type: 'OR',
        children: [
          {
            type: 'RULE',
            rule: { field: 'pattern.rsi_divergence_5m', op: '==', value: 'bullish' },
          },
          {
            type: 'RULE',
            rule: { field: 'pattern.rsi_divergence_5m', op: '==', value: 'bearish' },
          },
        ],
      },
      // Multi-timeframe confirmation
      {
        type: 'RULE',
        rule: { field: 'pattern.mtf_divergence_aligned', op: '==', value: true },
      },
      // Flow doesn't oppose the reversal
      {
        type: 'RULE',
        rule: { field: 'flow.flowScore', op: '>=', value: 50 },
      },
      // Price near VWAP (mean reversion target)
      {
        type: 'RULE',
        rule: { field: 'vwap.distancePct', op: 'insideRange', value: [-2, 2] },
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 60,
      ready: 75,
      SCALP: { min: 65, ready: 80 },
    },
  },
};

/**
 * NDX 0DTE Block Trade Follow
 * Follows large institutional block trades with confirmation
 */
export const NDX_0DTE_BLOCK_TRADE_FOLLOW: Partial<StrategyDefinition> = {
  name: 'NDX 0DTE Block Trade Follow',
  slug: 'ndx-0dte-block-trade-follow',
  category: 'OPTIONS_DAY_TRADE',
  underlyingScope: 'INDEXES',
  barTimeframe: '5m',
  description: 'Follow institutional block trades on NDX with flow and macro confirmation',
  timeWindow: {
    start: '09:35',
    end: '15:30',
    timezone: 'America/New_York',
  },
  cooldownMinutes: 15,
  oncePerSession: false,
  conditions: {
    type: 'AND',
    children: [
      // Block trade detection
      {
        type: 'RULE',
        rule: { field: 'flow.blockCount', op: '>=', value: 1 },
      },
      // Flow score high (institutional conviction)
      {
        type: 'RULE',
        rule: { field: 'flow.flowScore', op: '>=', value: 70 },
      },
      // Unusual activity (smart money moving)
      {
        type: 'RULE',
        rule: { field: 'flow.unusualActivity', op: '==', value: true },
      },
      // Price action confirmation (not counter-trend)
      {
        type: 'RULE',
        rule: { field: 'price.current', op: '>', value: 'ema.8' },
      },
      // Tech leadership or aligned market
      {
        type: 'OR',
        children: [
          {
            type: 'RULE',
            rule: { field: 'pattern.sector_leadership', op: '==', value: 'tech' },
          },
          {
            type: 'RULE',
            rule: { field: 'pattern.spy_qqq_correlation', op: '==', value: 'aligned' },
          },
        ],
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 70,
      ready: 85,
      SCALP: { min: 75, ready: 88 },
    },
  },
};

/**
 * SPX 0DTE Opening Range Breakout with Flow
 * Enhanced ORB strategy with institutional flow confirmation
 */
export const SPX_0DTE_ORB_FLOW: Partial<StrategyDefinition> = {
  name: 'SPX 0DTE ORB + Flow',
  slug: 'spx-0dte-orb-flow',
  category: 'SPX_SPECIAL',
  underlyingScope: 'SPX_ONLY',
  barTimeframe: '5m',
  description: 'Opening range breakout enhanced with institutional flow detection',
  timeWindow: {
    start: '09:45',
    end: '10:30',
    timezone: 'America/New_York',
  },
  cooldownMinutes: 10,
  oncePerSession: true,
  conditions: {
    type: 'AND',
    children: [
      // ORB breakout
      {
        type: 'OR',
        children: [
          {
            type: 'RULE',
            rule: { field: 'pattern.orb_breakout_bull', op: '==', value: true },
          },
          {
            type: 'RULE',
            rule: { field: 'pattern.orb_breakout_bear', op: '==', value: true },
          },
        ],
      },
      // Flow confirmation (not fighting the move)
      {
        type: 'RULE',
        rule: { field: 'flow.flowScore', op: '>=', value: 55 },
      },
      // Volume surge
      {
        type: 'RULE',
        rule: { field: 'volume.relativeToAvg', op: '>=', value: 1.5 },
      },
      // Macro support (not fighting market)
      {
        type: 'RULE',
        rule: { field: 'pattern.market_regime', op: '!=', value: 'choppy' },
      },
      // Session timing (5-60 min after open)
      {
        type: 'RULE',
        rule: { field: 'session.minutesSinceOpen', op: 'insideRange', value: [5, 60] },
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 65,
      ready: 82,
      SCALP: { min: 70, ready: 85 },
    },
  },
};

/**
 * SPX 0DTE VWAP Mean Reversion with Divergence
 * Fades extremes back to VWAP with multi-timeframe divergence confirmation
 */
export const SPX_0DTE_VWAP_DIVERGENCE_FADE: Partial<StrategyDefinition> = {
  name: 'SPX 0DTE VWAP Divergence Fade',
  slug: 'spx-0dte-vwap-divergence-fade',
  category: 'SPX_SPECIAL',
  underlyingScope: 'SPX_ONLY',
  barTimeframe: '5m',
  description: 'Fade price extremes back to VWAP with RSI divergence confirmation',
  timeWindow: {
    start: '10:00',
    end: '15:30',
    timezone: 'America/New_York',
  },
  cooldownMinutes: 15,
  oncePerSession: false,
  conditions: {
    type: 'AND',
    children: [
      // Price extended from VWAP
      {
        type: 'OR',
        children: [
          {
            type: 'RULE',
            rule: { field: 'vwap.distancePct', op: '>', value: 0.8 }, // 0.8% above
          },
          {
            type: 'RULE',
            rule: { field: 'vwap.distancePct', op: '<', value: -0.8 }, // 0.8% below
          },
        ],
      },
      // RSI divergence present
      {
        type: 'OR',
        children: [
          {
            type: 'RULE',
            rule: { field: 'pattern.rsi_divergence_5m', op: '==', value: 'bullish' },
          },
          {
            type: 'RULE',
            rule: { field: 'pattern.rsi_divergence_5m', op: '==', value: 'bearish' },
          },
        ],
      },
      // Multi-timeframe alignment
      {
        type: 'RULE',
        rule: { field: 'pattern.mtf_divergence_strength', op: '>=', value: 'moderate' },
      },
      // Not in extreme VIX (avoid volatile whipsaws)
      {
        type: 'RULE',
        rule: { field: 'pattern.vix_level', op: '!=', value: 'high' },
      },
      // Flow doesn't strongly oppose (allow neutral or weak opposing)
      {
        type: 'RULE',
        rule: { field: 'flow.flowScore', op: '<=', value: 75 },
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 60,
      ready: 78,
      SCALP: { min: 65, ready: 82 },
    },
  },
};

/**
 * NDX 0DTE Tech Leadership Momentum
 * Rides tech sector leadership with SPY/QQQ correlation
 */
export const NDX_0DTE_TECH_LEADERSHIP: Partial<StrategyDefinition> = {
  name: 'NDX 0DTE Tech Leadership',
  slug: 'ndx-0dte-tech-leadership',
  category: 'OPTIONS_DAY_TRADE',
  underlyingScope: 'INDEXES',
  barTimeframe: '5m',
  description: 'Momentum strategy for NDX when tech sector is leading the market',
  timeWindow: {
    start: '09:35',
    end: '15:00',
    timezone: 'America/New_York',
  },
  cooldownMinutes: 20,
  oncePerSession: false,
  conditions: {
    type: 'AND',
    children: [
      // Tech leadership confirmed
      {
        type: 'RULE',
        rule: { field: 'pattern.sector_leadership', op: '==', value: 'tech' },
      },
      // QQQ outperforming SPY
      {
        type: 'RULE',
        rule: { field: 'pattern.spy_qqq_correlation', op: '==', value: 'aligned' },
      },
      // Strong flow in direction
      {
        type: 'RULE',
        rule: { field: 'flow.flowScore', op: '>=', value: 65 },
      },
      // Price above key EMAs
      {
        type: 'RULE',
        rule: { field: 'price.current', op: '>', value: 'ema.21' },
      },
      {
        type: 'RULE',
        rule: { field: 'ema.8', op: '>', value: 'ema.21' },
      },
      // Relative volume surge
      {
        type: 'RULE',
        rule: { field: 'volume.relativeToAvg', op: '>=', value: 1.3 },
      },
      // Not overbought (room to run)
      {
        type: 'RULE',
        rule: { field: 'rsi.14', op: '<', value: 75 },
      },
    ],
  },
  alertBehavior: {
    confidenceThresholds: {
      min: 68,
      ready: 83,
      DAY: { min: 70, ready: 85 },
    },
  },
};

/**
 * Export all SPX/NDX 0DTE strategies as an array
 */
export const SPX_NDX_0DTE_STRATEGIES = [
  SPX_0DTE_FLOW_SWEEP_LONG,
  SPX_0DTE_GAMMA_SCALP,
  SPX_0DTE_POWER_HOUR_REVERSAL,
  NDX_0DTE_BLOCK_TRADE_FOLLOW,
  SPX_0DTE_ORB_FLOW,
  SPX_0DTE_VWAP_DIVERGENCE_FADE,
  NDX_0DTE_TECH_LEADERSHIP,
];

/**
 * Helper to install these strategies into the database
 * Can be called from a seed script or admin panel
 */
export function getSPX0DTEStrategySeeds(ownerId: string) {
  return SPX_NDX_0DTE_STRATEGIES.map((strategy, idx) => ({
    ...strategy,
    owner: ownerId,
    enabled: true,
    is_core_library: false, // User-specific, not core
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}
