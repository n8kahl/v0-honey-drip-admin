import type {
  StrategyDefinition,
  StrategyConditionTree,
  StrategyConditionRule,
  StrategySmartGates,
} from "../../types/strategy.js";

// Feature snapshot used for rule evaluation
export interface SymbolFeatures {
  symbol: string;
  time: string; // ISO string
  price: {
    current: number;
    open?: number;
    high?: number;
    low?: number;
    prevClose?: number;
    prev?: number; // optional previous for crosses ops
    gapPercent?: number; // (Open - PrevClose) / PrevClose * 100
    gapFillStatus?: "unfilled" | "filling" | "filled";
  };
  volume?: {
    current?: number;
    avg?: number;
    prev?: number;
    relativeToAvg?: number; // RVOL: current/avg (e.g., 2.5 = 250% of average)
    relative_to_avg?: number; // Alias for snake_case compatibility
  };
  vwap?: {
    value?: number;
    distancePct?: number;
    prev?: number;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    rho?: number;
    gammaRisk?: "high" | "medium" | "low"; // Auto-calculated based on gamma value
    thetaDecayRate?: "extreme" | "high" | "moderate" | "low"; // Per-hour decay
    deltaNormalized?: number; // Absolute delta (0-1 range)
  };
  flow?: {
    // Core metrics (existing)
    sweepCount?: number;
    blockCount?: number;
    unusualActivity?: boolean;
    flowScore?: number; // 0-100 flow strength
    flowBias?: "bullish" | "bearish" | "neutral";
    buyPressure?: number; // 0-100 percentage

    // High Value - Institutional markers
    aggressiveness?: "PASSIVE" | "NORMAL" | "MODERATE" | "AGGRESSIVE" | "VERY_AGGRESSIVE";
    institutionalConviction?: number; // 0-100 institutional conviction score
    optionsFlowConviction?: number; // Alias for institutionalConviction
    putCallRatio?: number; // 0-5 range (1 = balanced, <1 = call heavy, >1 = put heavy)
    largeTradePercentage?: number; // 0-100 institutional marker
    avgTradeSize?: number; // Average dollar amount per trade
    splitCount?: number; // Number of split orders (smaller institutional orders)

    // Trend Detection - Flow momentum
    flowTrend?: "INCREASING" | "STABLE" | "DECREASING"; // Compared to 4h ago
    sweepAcceleration?: number; // Rate of change in sweep frequency

    // Volume Context
    callVolume?: number;
    putVolume?: number;
    totalPremium?: number; // Total premium transacted
  };
  ema?: Record<string, number>;
  rsi?: Record<string, number>;
  session?: {
    minutesSinceOpen?: number;
    isRegularHours?: boolean;
  };
  // Multi-timeframe bucket: e.g., mtf['5m'].ema['21'], mtf['15m'].vwap.distancePct
  mtf?: Record<
    string,
    {
      price?: {
        current?: number;
        open?: number;
        high?: number;
        low?: number;
        prevClose?: number;
        prev?: number;
      };
      vwap?: { value?: number; distancePct?: number; prev?: number };
      ema?: Record<string, number>;
      rsi?: Record<string, number>;
    }
  >;
  pattern?: Record<string, boolean | number | string>;
  prev?: Record<string, any>; // generic previous snapshot fields if available
  // PHASE 1: Bollinger Bands for volatility-normalized mean reversion
  bollingerBands?: {
    upper: number;
    lower: number;
    middle: number;
    width: number; // Band width as % of middle (volatility measure)
    percentB: number; // 0-1 where price sits within bands (0=lower, 1=upper)
  };
  // PHASE 2: ATR for volatility-adaptive entries (better than BB for mean reversion)
  atr?: number; // 14-period Average True Range
  // PHASE 2: RSI divergence for reversal confirmation
  divergence?: {
    type: "bullish" | "bearish" | "none";
    confidence: number; // 0-100
  };
  [key: string]: any;
}

// Resolve dot-notated field paths such as 'price.current', 'ema.21'
export function getFeatureValue(features: SymbolFeatures, field: string): any {
  if (!features || !field) return undefined;
  const parts = field.split(".");
  let cur: any = features;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p as keyof typeof cur];
  }
  return cur;
}

function toNumber(x: any): number | undefined {
  if (x == null) return undefined;
  const n = typeof x === "number" ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : undefined;
}

function compare(a: any, b: any, op: string): boolean {
  switch (op) {
    case ">":
      return toNumber(a)! > toNumber(b)!;
    case ">=":
      return toNumber(a)! >= toNumber(b)!;
    case "<":
      return toNumber(a)! < toNumber(b)!;
    case "<=":
      return toNumber(a)! <= toNumber(b)!;
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case "above":
      return toNumber(a)! > toNumber(b)!;
    case "below":
      return toNumber(a)! < toNumber(b)!;
    default:
      return false;
  }
}

export function evaluateRule(rule: StrategyConditionRule, features: SymbolFeatures): boolean {
  if (!rule) return false;
  const left = getFeatureValue(features, rule.field);
  const op = rule.op;

  if (op === "insideRange" || op === "outsideRange") {
    const val = toNumber(left);
    const tuple = rule.value as [number, number];
    if (!Array.isArray(tuple) || tuple.length !== 2 || val == null) return false;
    const [min, max] = tuple;
    const inside = val >= min && val <= max;
    return op === "insideRange" ? inside : !inside;
  }

  if (op === "crossesAbove" || op === "crossesBelow") {
    // Basic implementation: require previous value at `pattern["prev:"+field]` or features.prev[field]
    // If not available, return false.
    const prevKey = `prev:${rule.field}`;
    const prevFromPattern = features.pattern?.[prevKey];
    const prevFromPrev = getFeatureValue(features.prev as any, rule.field);
    const prev = toNumber(prevFromPattern ?? prevFromPrev);
    const cur = toNumber(left);
    const threshold = toNumber(rule.value);
    if (prev == null || cur == null || threshold == null) return false;
    if (op === "crossesAbove") return prev <= threshold && cur > threshold;
    return prev >= threshold && cur < threshold;
  }

  // Handle dynamic field references: if rule.value is a string starting with a letter,
  // treat it as a field path and resolve it from features
  let right = rule.value;
  if (typeof right === "string" && /^[a-z]/i.test(right)) {
    right = getFeatureValue(features, right);
  }

  return compare(left, right, op);
}

export function evaluateConditionTree(
  tree: StrategyConditionTree,
  features: SymbolFeatures
): boolean {
  if (!tree) return false;
  switch (tree.type) {
    case "RULE":
      return evaluateRule(tree.rule, features);
    case "AND":
      return (tree.children || []).every((ch) => evaluateConditionTree(ch, features));
    case "OR":
      return (tree.children || []).some((ch) => evaluateConditionTree(ch, features));
    case "NOT":
      return !evaluateConditionTree(tree.child, features);
    default:
      return false;
  }
}

function isWithinTimeWindow(iso: string, window: StrategyDefinition["timeWindow"]): boolean {
  try {
    if (!iso || !window) return true; // no restriction
    const { start, end, timezone } = window;
    if (!start || !end || !timezone) return true;
    const date = new Date(iso);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const hh = parts.find((p) => p.type === "hour")?.value || "00";
    const mm = parts.find((p) => p.type === "minute")?.value || "00";
    const cur = parseInt(hh, 10) * 60 + parseInt(mm, 10);
    const [sh, sm] = start.split(":").map((n) => parseInt(n, 10));
    const [eh, em] = end.split(":").map((n) => parseInt(n, 10));
    const sMin = sh * 60 + sm;
    const eMin = eh * 60 + em;
    if (eMin >= sMin) return cur >= sMin && cur <= eMin;
    // overnight window: treat as wrap
    return cur >= sMin || cur <= eMin;
  } catch {
    return true; // fail-open to avoid blocking
  }
}

// Proximity-aware scoring for a single rule. Returns a value in [0,1].
function scoreRule(rule: StrategyConditionRule, features: SymbolFeatures): number {
  if (!rule) return 0;
  const left = getFeatureValue(features, rule.field);
  const op = rule.op;

  // Helper to compute relative gap based on magnitudes
  const relGap = (a: number | undefined, b: number | undefined): number => {
    if (a == null || b == null) return 1;
    const denom = Math.max(1e-9, Math.abs(b), Math.abs(a));
    return Math.abs(a - b) / denom; // unitless relative distance
  };

  // inside/outside range: allow partial credit based on distance to nearest bound
  if (op === "insideRange" || op === "outsideRange") {
    const val = toNumber(left);
    const tuple = rule.value as [number, number];
    if (!Array.isArray(tuple) || tuple.length !== 2 || val == null) return 0;
    const [min, max] = tuple;
    const inside = val >= min && val <= max;
    if (op === "insideRange") {
      if (inside) return 1;
      const dist = val < min ? min - val : val - max;
      const width = Math.max(1e-9, max - min);
      const rel = dist / width; // how far outside the band
      // Give partial up to 0.9 for near misses within 25% of band width
      return Math.max(0, Math.min(0.9, 1 - rel / 0.25));
    } else {
      // outsideRange
      if (!inside) return 1;
      // Inside but near edges is weaker for an outside expectation
      const toEdge = Math.min(Math.abs(val - min), Math.abs(val - max));
      const width = Math.max(1e-9, max - min);
      const rel = toEdge / width;
      return Math.max(0, Math.min(0.9, 1 - rel / 0.25));
    }
  }

  if (op === "crossesAbove" || op === "crossesBelow") {
    // Binary for cross events
    return evaluateRule(rule, features) ? 1 : 0;
  }

  // Resolve dynamic field value for right-hand side
  let right: any = rule.value;
  if (typeof right === "string" && /^[a-z]/i.test(right)) {
    right = getFeatureValue(features, right);
  }

  // Numeric proximity for comparative ops
  const numericOps = new Set([">", ">=", "<", "<=", "above", "below", "==", "!="]);
  if (numericOps.has(op)) {
    const a = toNumber(left);
    const b = toNumber(right);
    const satisfied = evaluateRule(rule, features);
    if (satisfied) return 1;
    if (a == null || b == null) return 0;
    if (op === "==" || op === "!=") return 0; // equality is binary

    // Compute relative gap and convert to partial credit within a 2% window
    const gap = relGap(a, b);
    // If gap <= 0.02 (~2%), award partial up to 0.9; else 0
    const window = 0.02;
    const score = 1 - Math.min(1, gap / window);
    return Math.max(0, Math.min(0.9, score));
  }

  // Fallback
  return evaluateRule(rule, features) ? 1 : 0;
}

// Compute a graded confidence score (0..100) by aggregating satisfaction across the condition tree.
// Heuristic scoring rules:
// - RULE: proximity-aware score in [0,1] based on satisfaction and numeric closeness
// - AND: average of child scores (all must be true for 1.0; partial matches yield fractional scores)
// - OR: max of child scores (any satisfied child can yield high score)
// - NOT: 1 - child score
// The final confidence is Math.round(score * 100).
export function computeStrategyConfidence(
  strategy: StrategyDefinition,
  features: SymbolFeatures
): number {
  function scoreTree(tree: StrategyConditionTree): number {
    if (!tree) return 0;
    switch (tree.type) {
      case "RULE": {
        return scoreRule(tree.rule, features);
      }
      case "AND": {
        const children = tree.children || [];
        if (children.length === 0) return 0;
        const sum = children.reduce((acc, ch) => acc + scoreTree(ch), 0);
        return sum / children.length;
      }
      case "OR": {
        const children = tree.children || [];
        if (children.length === 0) return 0;
        return Math.max(...children.map((ch) => scoreTree(ch)));
      }
      case "NOT": {
        return 1 - scoreTree(tree.child);
      }
      default:
        return 0;
    }
  }

  const score = scoreTree(strategy.conditions);
  // Clamp and scale to 0..100
  const pct = Math.max(0, Math.min(1, score)) * 100;
  return Math.round(pct);
}

/**
 * Evaluate Smart Gates - Institutional context filters
 * These gates are checked BEFORE technical conditions to filter out trades
 * that don't have proper institutional backing.
 *
 * @returns null if all gates pass, otherwise returns the reason for gate failure
 */
export function evaluateSmartGates(
  gates: StrategySmartGates | undefined,
  features: SymbolFeatures
): string | null {
  if (!gates) return null; // No gates defined = pass

  // 1. Flow Score Gate
  if (gates.minFlowScore != null) {
    const flowScore = features.flow?.flowScore ?? 50;
    if (flowScore < gates.minFlowScore) {
      return `Flow Score Low (${flowScore} < ${gates.minFlowScore})`;
    }
  }

  // 2. Institutional Score Gate
  if (gates.minInstitutionalScore != null) {
    // Check multiple possible field names for institutional score
    const instScore =
      (features.flow as any)?.institutionalConviction ??
      (features as any)?.institutional_score ??
      20;
    if (instScore < gates.minInstitutionalScore) {
      return `Institutional Score Low (${instScore} < ${gates.minInstitutionalScore})`;
    }
  }

  // 3. Flow Bias Gate
  if (gates.requiredFlowBias && gates.requiredFlowBias !== "any") {
    const flowBias = features.flow?.flowBias ?? "neutral";
    if (flowBias !== gates.requiredFlowBias) {
      return `Flow Bias Mismatch (${flowBias} ≠ ${gates.requiredFlowBias})`;
    }
  }

  // 4. Gamma Regime Gate
  if (gates.gammaRegime && gates.gammaRegime !== "any") {
    // Check for dealer positioning from gamma context
    const dealerPositioning =
      (features as any)?.dealer_positioning ??
      (features.greeks as any)?.dealerPositioning ??
      "NEUTRAL";

    const normalizedPositioning = dealerPositioning.toLowerCase().replace("_", "_");
    const requiredRegime = gates.gammaRegime; // 'long_gamma' or 'short_gamma'

    // Map dealer positioning to regime: SHORT_GAMMA -> short_gamma, LONG_GAMMA -> long_gamma
    const currentRegime = normalizedPositioning.includes("short")
      ? "short_gamma"
      : normalizedPositioning.includes("long")
        ? "long_gamma"
        : "neutral";

    if (currentRegime !== requiredRegime) {
      return `Gamma Regime Mismatch (${currentRegime} ≠ ${requiredRegime})`;
    }
  }

  // 5. Gamma Exposure Gate (Dealer Net Delta threshold)
  if (gates.minGammaExposure != null) {
    const dealerNetDelta =
      (features as any)?.dealer_net_delta ?? (features.greeks as any)?.dealerNetDelta ?? 0;
    if (Math.abs(dealerNetDelta) < gates.minGammaExposure) {
      return `Gamma Exposure Low (|${dealerNetDelta}| < ${gates.minGammaExposure})`;
    }
  }

  return null; // All gates passed
}

/**
 * Strategy evaluation result with optional gate rejection reason
 */
export interface StrategyEvaluationResult {
  matches: boolean;
  confidence: number;
  /** If a smart gate failed, this contains the reason */
  gateReason?: string;
}

export function evaluateStrategy(
  strategy: StrategyDefinition,
  features: SymbolFeatures
): StrategyEvaluationResult {
  // 1. Time window check first
  if (!isWithinTimeWindow(features.time, strategy.timeWindow)) {
    return { matches: false, confidence: 0 };
  }

  // 2. Smart Gates check BEFORE technical conditions
  const gateFailure = evaluateSmartGates(strategy.smartGates, features);
  if (gateFailure) {
    return { matches: false, confidence: 0, gateReason: gateFailure };
  }

  // 3. Technical conditions evaluation
  const matches = evaluateConditionTree(strategy.conditions, features);

  // 4. Compute graded confidence regardless of strict match, so UI can show setup readiness
  const confidence = computeStrategyConfidence(strategy, features);

  return { matches, confidence };
}
