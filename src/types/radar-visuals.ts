/**
 * radar-visuals.ts - Type definitions for Radar War Room components
 *
 * Forward-looking intelligence types for off-hours trading preparation
 */

import type { SetupScenario, KeyLevel, FuturesSnapshot } from "../hooks/useOffHoursData";

// ============================================================================
// Market Regime
// ============================================================================

export type MarketRegimeState = "calm" | "volatile" | "trend_up" | "trend_down";

export interface MarketHorizonData {
  regime: MarketRegimeState;
  themeGradientFrom: string;
  themeGradientTo: string;
  animationDurationMs: number;
  headline: string;
  subtitle: string;
  sessionBias: string; // Forward-looking guidance
}

/**
 * Derive market regime from current VIX and futures direction
 */
export function deriveMarketRegime(vix: number, esChangePercent: number): MarketRegimeState {
  // High volatility overrides trend
  if (vix > 25) return "volatile";

  // Low volatility = calm
  if (vix < 13) return "calm";

  // Medium volatility: check trend
  if (esChangePercent > 0.5) return "trend_up";
  if (esChangePercent < -0.5) return "trend_down";

  return "calm";
}

/**
 * Generate market horizon display data from futures snapshot
 */
export function generateMarketHorizonData(
  vix: number,
  futures?: FuturesSnapshot | null
): MarketHorizonData {
  const esChangePercent = futures?.es.changePercent || 0;
  const regime = deriveMarketRegime(vix, esChangePercent);

  // Theme configuration per regime
  const themes: Record<
    MarketRegimeState,
    {
      from: string;
      to: string;
      duration: number;
      headline: string;
      subtitle: string;
      bias: string;
    }
  > = {
    calm: {
      from: "from-blue-900/20",
      to: "to-teal-900/20",
      duration: 5000,
      headline: "Calm Market Environment",
      subtitle: `VIX at ${vix.toFixed(1)} - Low volatility conditions`,
      bias: "Favor tight stops and scalps. Range-bound likely.",
    },
    volatile: {
      from: "from-red-900/30",
      to: "to-orange-900/30",
      duration: 2000,
      headline: "High Volatility Alert",
      subtitle: `VIX elevated at ${vix.toFixed(1)} - Expect wide swings`,
      bias: "Reduce position size. Wider stops needed. Wait for extremes.",
    },
    trend_up: {
      from: "from-green-900/20",
      to: "to-emerald-900/20",
      duration: 3500,
      headline: "Bullish Momentum",
      subtitle: `Futures up ${esChangePercent.toFixed(2)}% - Uptrend forming`,
      bias: "Favor long setups. Buy pullbacks to support. Trail stops.",
    },
    trend_down: {
      from: "from-purple-900/20",
      to: "to-pink-900/20",
      duration: 3500,
      headline: "Bearish Pressure",
      subtitle: `Futures down ${Math.abs(esChangePercent).toFixed(2)}% - Downtrend forming`,
      bias: "Favor short setups. Sell rallies to resistance. Tight stops.",
    },
  };

  const config = themes[regime];

  return {
    regime,
    themeGradientFrom: config.from,
    themeGradientTo: config.to,
    animationDurationMs: config.duration,
    headline: config.headline,
    subtitle: config.subtitle,
    sessionBias: config.bias,
  };
}

// ============================================================================
// Opportunity Matrix (Scatter Plot Data)
// ============================================================================

export interface OpportunityDot {
  symbol: string;
  score: number; // 0-100 AI confidence
  rrRatio: number; // Risk/Reward ratio
  volatility: number; // ATR or IV-based
  setups: string[]; // Setup types
  setupId?: string; // Link to original SetupScenario
  direction: "long" | "short";
}

/**
 * Convert SetupScenarios to OpportunityDot format for scatter chart
 */
export function generateOpportunityMatrix(setupScenarios: SetupScenario[]): OpportunityDot[] {
  return setupScenarios.map((setup) => {
    // Map confidence to score (0-100)
    const scoreMap = {
      high: 85,
      medium: 70,
      low: 50,
    };

    // Estimate volatility from price range (simplified)
    const priceRange = Math.abs(setup.targets[0] - setup.stop);
    const volatility = (priceRange / setup.entry) * 100;

    return {
      symbol: setup.symbol,
      score: scoreMap[setup.confidence],
      rrRatio: Math.min(setup.riskReward, 5), // Cap at 5 for visualization
      volatility: Math.min(volatility, 8), // Cap at 8
      setups: [setup.type],
      setupId: setup.id,
      direction: setup.direction,
    };
  });
}

// ============================================================================
// Session Scenarios (If/Then Playbook)
// ============================================================================

export interface SessionScenario {
  id: string;
  symbol: string;
  caseType: "bull" | "bear" | "neutral";
  trigger: string; // "If SPY opens above 595"
  setup: string; // "Bullish continuation"
  action: string; // "Wait for pullback to VWAP, then long"
  entry?: number;
  targets: number[];
  stop?: number;
  invalidation: string; // "Below 593.50 = bearish reversal"
  probability: "high" | "medium" | "low";
  reasoning: string;
}

/**
 * Generate if/then scenarios for next session from key levels
 */
export function generateSessionScenarios(
  symbol: string,
  currentPrice: number,
  keyLevels: KeyLevel[],
  futures?: FuturesSnapshot | null
): SessionScenario[] {
  const scenarios: SessionScenario[] = [];

  // Find key levels
  const resistances = keyLevels
    .filter((l) => l.type === "resistance" && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);

  const supports = keyLevels
    .filter((l) => l.type === "support" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);

  const vwap = keyLevels.find((l) => l.type === "vwap");
  const pivot = keyLevels.find((l) => l.type === "pivot");

  const r1 = resistances[0];
  const s1 = supports[0];
  const futuresUp = (futures?.es.changePercent || 0) > 0;

  // ========== BULL CASE ==========
  if (r1) {
    const pullbackLevel = vwap?.price || pivot?.price || currentPrice * 0.998;
    const target1 = r1.price * 1.01;
    const target2 = r1.price * 1.015;

    scenarios.push({
      id: `${symbol}-bull-case`,
      symbol,
      caseType: "bull",
      trigger: `Opens above ${r1.price.toFixed(2)} (${r1.source})`,
      setup: "Bullish breakout continuation",
      action: `Wait for pullback to ${pullbackLevel.toFixed(2)}, then long`,
      entry: pullbackLevel,
      targets: [target1, target2],
      stop: s1?.price || currentPrice * 0.99,
      invalidation: `Break below ${s1?.price.toFixed(2) || "support"} = bearish reversal`,
      probability: futuresUp ? "high" : "medium",
      reasoning: `Strong resistance breakout at ${r1.source}. Buy dip to VWAP for better R:R.`,
    });
  }

  // ========== BEAR CASE ==========
  if (s1) {
    const rallyLevel = vwap?.price || pivot?.price || currentPrice * 1.002;
    const target1 = s1.price * 0.99;
    const target2 = s1.price * 0.985;

    scenarios.push({
      id: `${symbol}-bear-case`,
      symbol,
      caseType: "bear",
      trigger: `Opens below ${s1.price.toFixed(2)} (${s1.source})`,
      setup: "Bearish breakdown continuation",
      action: `Short any rally to ${rallyLevel.toFixed(2)}, tight stop`,
      entry: rallyLevel,
      targets: [target1, target2],
      stop: r1?.price || currentPrice * 1.01,
      invalidation: `Reclaim above ${r1?.price.toFixed(2) || "resistance"} = bullish reversal`,
      probability: !futuresUp ? "high" : "medium",
      reasoning: `Support breakdown at ${s1.source}. Sell strength for lower-risk entry.`,
    });
  }

  // ========== NEUTRAL CASE ==========
  if (r1 && s1) {
    const range = r1.price - s1.price;
    const midpoint = s1.price + range / 2;

    scenarios.push({
      id: `${symbol}-neutral-case`,
      symbol,
      caseType: "neutral",
      trigger: `Opens between ${s1.price.toFixed(2)} - ${r1.price.toFixed(2)}`,
      setup: "Range-bound chop expected",
      action: `Fade extremes: Buy near ${s1.price.toFixed(2)}, Sell near ${r1.price.toFixed(2)}`,
      targets: [midpoint],
      invalidation: `Break of range = follow momentum`,
      probability: "medium",
      reasoning: `Price consolidating between support/resistance. Mean reversion favored.`,
    });
  }

  return scenarios;
}

// ============================================================================
// Battle Plan Board (Kanban)
// ============================================================================

export type BattlePlanStatus = "radar" | "analyzing" | "ready";

export interface BattlePlanItem {
  id: string;
  symbol: string;
  status: BattlePlanStatus;
  notes: string;
  createdAt: Date;
  setupId?: string; // Link to SetupScenario
  direction?: "long" | "short";
  entryLevel?: number;
  targetLevel?: number;
}

/**
 * Column configuration for Battle Plan board
 */
export const BATTLE_PLAN_COLUMNS: Record<
  BattlePlanStatus,
  {
    id: BattlePlanStatus;
    title: string;
    description: string;
    color: string;
  }
> = {
  radar: {
    id: "radar",
    title: "On Radar",
    description: "Potential setups to watch",
    color: "text-blue-400",
  },
  analyzing: {
    id: "analyzing",
    title: "Charting",
    description: "Analyzing levels & plan",
    color: "text-yellow-400",
  },
  ready: {
    id: "ready",
    title: "Ready",
    description: "Plan set, alerts configured",
    color: "text-green-400",
  },
};
