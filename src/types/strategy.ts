// Strategy & Signal Type Definitions
// NOTE: Database columns are snake_case; frontend uses camelCase. Mapping utilities provided below.

export type StrategyCategory = "OPTIONS_DAY_TRADE" | "SWING" | "INTRADAY" | "SPX_SPECIAL" | "OTHER";

export type UnderlyingScope = "ANY" | "SPX_ONLY" | "INDEXES" | "ETFS" | "SINGLE_STOCKS";

export type BarTimeframe = "1m" | "5m" | "15m" | "60m" | "1d";
export type EntrySide = "LONG" | "SHORT" | "BOTH";

export type OptionsPlayType = "single_leg" | "vertical_spread" | "0dte_spx" | "lotto" | "other";

export interface StrategyTimeWindow {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  timezone: string; // IANA timezone
}

export interface StrategyAlertBehavior {
  flashWatchlist: boolean;
  showNowPlaying: boolean;
  notifyDiscord: boolean;
  autoOpenTradePlanner?: boolean;
  // Optional graded confidence thresholds (per strategy), with per-trade-type overrides.
  // If not provided, defaults are used (min=50, ready=80).
  confidenceThresholds?: {
    min?: number; // default min confidence to consider a signal
    ready?: number; // default confidence to consider "ready"
    SCALP?: { min?: number; ready?: number };
    DAY?: { min?: number; ready?: number };
    SWING?: { min?: number; ready?: number };
    LEAP?: { min?: number; ready?: number };
  };
}

/**
 * Smart Gates - Pre-condition filters based on institutional context
 * These gates are evaluated BEFORE technical conditions to filter out trades
 * that don't have proper institutional backing or favorable market positioning.
 */
export type FlowBiasGate = "bullish" | "bearish" | "any";
export type GammaRegimeGate = "long_gamma" | "short_gamma" | "any";

export interface StrategySmartGates {
  /** Minimum flow score (0-100) from FlowAnalysisEngine. Default: no gate */
  minFlowScore?: number;

  /** Required flow bias direction. Default: 'any' */
  requiredFlowBias?: FlowBiasGate;

  /** Required gamma regime (dealer positioning). Default: 'any' */
  gammaRegime?: GammaRegimeGate;

  /** Minimum absolute dealer net delta threshold. Default: no gate */
  minGammaExposure?: number;

  /** Minimum institutional conviction score (0-100). Default: no gate */
  minInstitutionalScore?: number;
}

// Condition Operators DSL
export type StrategyConditionOp =
  | ">"
  | ">="
  | "<"
  | "<="
  | "=="
  | "!="
  | "crossesAbove"
  | "crossesBelow"
  | "above"
  | "below"
  | "insideRange"
  | "outsideRange";

export interface StrategyConditionRule {
  field: string; // dot notation path into SymbolFeatures
  op: StrategyConditionOp;
  value: number | string | [number, number];
}

export interface StrategyConditionTreeRuleNode {
  type: "RULE";
  rule: StrategyConditionRule;
}

export interface StrategyConditionTreeLogicNode {
  type: "AND" | "OR";
  children: StrategyConditionTree[];
}

export interface StrategyConditionTreeNotNode {
  type: "NOT";
  child: StrategyConditionTree;
}

export type StrategyConditionTree =
  | StrategyConditionTreeRuleNode
  | StrategyConditionTreeLogicNode
  | StrategyConditionTreeNotNode;

/**
 * Optimization parameters stored in pending_params JSONB column.
 * Contains optimized risk/reward and consensus thresholds from GA optimizer.
 */
export interface StrategyOptimizationParams {
  riskReward?: {
    stopMultiplier?: number;
    targetMultiplier?: number;
    trailingStopPct?: number;
  };
  consensus?: {
    minScore?: number;
    minConfluence?: number;
    requiredFactors?: string[];
  };
  optimizedAt?: string;
  expectancyGain?: number;
}

export interface StrategyDefinition {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  name: string;
  slug: string;
  shortName?: string; // Short display name for badges (e.g., ORB, VWR, EMA)
  description?: string;
  category: StrategyCategory;
  underlyingScope: UnderlyingScope;
  timeWindow: StrategyTimeWindow | null;
  barTimeframe: BarTimeframe;
  entrySide: EntrySide;
  optionsPlayType?: OptionsPlayType;
  /**
   * Smart Gates - Institutional context gates evaluated BEFORE technical conditions.
   * If any gate fails, the strategy returns { matches: false, gateReason: "..." }
   */
  smartGates?: StrategySmartGates;
  conditions: StrategyConditionTree;
  alertBehavior: StrategyAlertBehavior;
  cooldownMinutes: number; // minimal cooldown
  oncePerSession: boolean;
  lastFiredAt?: string | null;
  isCoreLibrary: boolean;
  enabled: boolean;

  // Optimization fields (Phase 4 - GA Optimizer)
  /** If true, the GA optimizer will include this strategy in optimization runs */
  autoOptimize?: boolean;
  /** JSON blob of optimized parameters awaiting user approval */
  pendingParams?: StrategyOptimizationParams | null;
  /** Timestamp of the last successful optimization run for this strategy */
  lastOptimizedAt?: string | null;
  /** Cached baseline expectancy (before optimization) for comparison */
  baselineExpectancy?: number | null;
}

export type StrategySignalStatus = "ACTIVE" | "ACKED" | "DISMISSED";

export interface StrategySignal {
  id: string;
  createdAt: string;
  symbol: string;
  strategyId: string;
  owner: string;
  confidence: number;
  payload: Record<string, unknown> | null;
  status: StrategySignalStatus;
  barTimeKey?: string | null;
}

// DB Row Raw Types (snake_case) ------------------------------------------------
// These reflect the Postgres column names for mapping purposes. Not exported outside mapping utilities.
interface StrategyDefinitionRow {
  id: string;
  created_at: string;
  updated_at: string;
  owner: string;
  name: string;
  slug: string;
  short_name: string | null;
  description: string | null;
  category: string;
  underlying_scope: string;
  time_window: any | null; // validate externally
  bar_timeframe: string;
  entry_side: string;
  options_play_type: string | null;
  smart_gates: any | null; // JSONB smart gates
  conditions: any;
  alert_behavior: any;
  cooldown_minutes: number | null;
  once_per_session: boolean;
  last_fired_at: string | null;
  is_core_library: boolean;
  enabled: boolean;
  // Optimization fields (Phase 4)
  auto_optimize: boolean | null;
  pending_params: StrategyOptimizationParams | null;
  last_optimized_at: string | null;
  baseline_expectancy: number | null;
}

interface StrategySignalRow {
  id: string;
  created_at: string;
  symbol: string;
  strategy_id: string;
  owner: string;
  confidence: number | null;
  payload: any | null;
  status: string;
  bar_time_key: string | null;
}

// Mapping Utilities -----------------------------------------------------------
export function mapStrategyDefinitionRow(row: StrategyDefinitionRow): StrategyDefinition {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: row.owner,
    name: row.name,
    slug: row.slug,
    shortName: row.short_name || undefined,
    description: row.description || undefined,
    category: row.category as StrategyCategory,
    underlyingScope: row.underlying_scope as UnderlyingScope,
    timeWindow: row.time_window || null,
    barTimeframe: row.bar_timeframe as BarTimeframe,
    entrySide: row.entry_side as EntrySide,
    optionsPlayType: (row.options_play_type as OptionsPlayType | null) || undefined,
    smartGates: row.smart_gates as StrategySmartGates | undefined,
    conditions: row.conditions as StrategyConditionTree,
    alertBehavior: row.alert_behavior as StrategyAlertBehavior,
    cooldownMinutes: row.cooldown_minutes ?? 5,
    oncePerSession: row.once_per_session,
    lastFiredAt: row.last_fired_at,
    isCoreLibrary: row.is_core_library,
    enabled: row.enabled,
    // Optimization fields
    autoOptimize: row.auto_optimize ?? false,
    pendingParams: row.pending_params ?? null,
    lastOptimizedAt: row.last_optimized_at ?? null,
    baselineExpectancy: row.baseline_expectancy ?? null,
  };
}

export function mapStrategySignalRow(row: StrategySignalRow): StrategySignal {
  return {
    id: row.id,
    createdAt: row.created_at,
    symbol: row.symbol,
    strategyId: row.strategy_id,
    owner: row.owner,
    confidence: row.confidence ?? 0,
    payload: row.payload ?? null,
    status: row.status as StrategySignalStatus,
    barTimeKey: row.bar_time_key,
  };
}

// Validation Helpers (lightweight; deeper validation can use Zod elsewhere) ----
export function isStrategyDefinition(def: any): def is StrategyDefinition {
  return def && typeof def.id === "string" && typeof def.slug === "string" && def.conditions;
}

export function isStrategySignal(sig: any): sig is StrategySignal {
  return sig && typeof sig.id === "string" && typeof sig.symbol === "string";
}
