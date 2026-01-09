import type { StrategySignal, StrategyDefinition } from "../../types/strategy.js";
import { mapStrategyDefinitionRow, mapStrategySignalRow } from "../../types/strategy.js";
import { evaluateStrategy, type SymbolFeatures } from "./engine.js";

export interface StrategyScannerOptions {
  owner: string; // user id
  symbols: string[];
  featuresBySymbol?: Record<string, SymbolFeatures>; // Deprecated, use 'features'
  features?: Record<string, SymbolFeatures>; // Preferred field name
  supabaseClient: any; // Required Supabase client
}

function isSPXSymbol(sym: string): boolean {
  const s = (sym || "").toUpperCase();
  return s === "SPX" || s === "I:SPX" || s === "SPX.X" || s === "O:SPX";
}

function underlyingScopeAllows(symbol: string, def: StrategyDefinition): boolean {
  const scope = def.underlyingScope;
  switch (scope) {
    case "ANY":
      return true;
    case "SPX_ONLY":
      return isSPXSymbol(symbol);
    case "INDEXES":
      return /^(I:)?(SPX|NDX|DJI|VIX|RUT)$/.test(symbol.toUpperCase());
    case "ETFS":
      // TODO: refine ETF list
      return /^(SPY|QQQ|IWM|DIA|VXX)$/.test(symbol.toUpperCase());
    case "SINGLE_STOCKS":
      return !/^(I:|O:)/.test(symbol); // crude filter
    default:
      return true;
  }
}

// Infer a trade horizon/type for threshold overrides based on strategy metadata.
type HorizonKey = "SCALP" | "DAY" | "SWING" | "LEAP";
function inferHorizon(def: StrategyDefinition): HorizonKey {
  // Options-specific hints
  if ((def as any).optionsPlayType === "0dte_spx") return "SCALP";

  // Category mapping
  switch (def.category) {
    case "INTRADAY":
    case "OPTIONS_DAY_TRADE":
      return "DAY";
    case "SWING":
      return "SWING";
    case "SPX_SPECIAL":
    case "OTHER":
    default:
      break;
  }

  // Timeframe heuristics
  switch (def.barTimeframe) {
    case "1m":
    case "5m":
      return "SCALP";
    case "15m":
      return "DAY";
    case "60m":
    case "1d":
      return "SWING";
    default:
      return "DAY";
  }
}

function getConfidenceThresholds(def: StrategyDefinition): { min: number; ready: number } {
  const cfg = def.alertBehavior?.confidenceThresholds;
  const baseMin = cfg?.min ?? 50;
  const baseReady = cfg?.ready ?? 80;
  const horizon = inferHorizon(def);
  const override = (cfg && (cfg as any)[horizon]) || {};
  return {
    min: override.min ?? baseMin,
    ready: override.ready ?? baseReady,
  };
}

export async function scanStrategiesForUser(
  opts: StrategyScannerOptions
): Promise<StrategySignal[]> {
  if (!opts.supabaseClient) {
    throw new Error("supabaseClient is required");
  }
  const supabase = opts.supabaseClient;
  const owner = opts.owner;
  const newSignals: StrategySignal[] = [];

  // Support both old and new field names
  const featuresBySymbol = opts.features || opts.featuresBySymbol || {};

  try {
    const { data: defsRows, error: defsErr } = await supabase
      .from("strategy_definitions")
      .select("*")
      .or(`owner.eq.${owner},is_core_library.eq.true`)
      .eq("enabled", true);

    if (defsErr) throw defsErr;
    const defs = (defsRows || []).map(mapStrategyDefinitionRow);

    for (const symbol of opts.symbols) {
      const features = featuresBySymbol[symbol];
      if (!features) continue;

      for (const def of defs) {
        if (!underlyingScopeAllows(symbol, def)) continue;

        const { matches, confidence } = evaluateStrategy(def, features as any);
        const thresholds = getConfidenceThresholds(def);
        // Gate by per-strategy/type threshold
        if (confidence < thresholds.min) continue;

        // Cooldown check: last signal for symbol+strategy+owner
        const { data: lastRows, error: lastErr } = await supabase
          .from("strategy_signals")
          .select("*")
          .eq("owner", owner)
          .eq("strategy_id", def.id)
          .eq("symbol", symbol)
          .order("created_at", { ascending: false })
          .limit(1);
        if (lastErr) {
          console.error("[v0] scanStrategiesForUser: lastErr", lastErr);
        }
        const last = lastRows?.[0];
        const now = new Date(features.time);
        if (last) {
          const lastAt = new Date(last.created_at);
          const mins = Math.abs((now.getTime() - lastAt.getTime()) / 60000);
          const cooldown = def.cooldownMinutes ?? 5;
          if (mins < cooldown) {
            continue;
          }
          if (def.oncePerSession) {
            // same UTC trading day? Simplified: same date in NY timezone TODO refine
            // For now, if same calendar day UTC, skip.
            if (now.toISOString().slice(0, 10) === lastAt.toISOString().slice(0, 10)) continue;
          }
        }

        // Insert signal
        const payload = {
          time: features.time,
          price: features?.price?.current,
          confidence,
          confidence_ready: confidence >= thresholds.ready,
        } as any;

        // Generate bar_time_key for idempotent signal insertion
        // Format: ISO_timestamp + _ + timeframe (e.g., "2025-11-17T09:35:00Z_5m")
        const barTimeKey = `${features.time}_${def.barTimeframe}`;

        const insert = {
          symbol,
          strategy_id: def.id,
          owner,
          confidence,
          payload,
          status: "ACTIVE",
          bar_time_key: barTimeKey,
        } as any;

        const { data: insRow, error: insErr } = await supabase
          .from("strategy_signals")
          .insert(insert)
          .select("*")
          .single();

        if (insErr) {
          // Check if error is unique constraint violation (duplicate bar_time_key)
          // PostgreSQL error code 23505 = unique_violation
          if (insErr.code === "23505" && insErr.message?.includes("bar_time_key")) {
            console.log(
              `[v0] Signal already exists for ${symbol} (${def.slug}) at bar ${barTimeKey}, skipping`
            );
            continue;
          }
          console.error("[v0] scanStrategiesForUser: insert error", insErr);
          continue;
        }
        newSignals.push(mapStrategySignalRow(insRow));
      }
    }
  } catch (e) {
    console.error("[v0] scanStrategiesForUser error", e);
  }

  return newSignals;
}
