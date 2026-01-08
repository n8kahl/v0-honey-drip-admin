/**
 * Admin CRUD operations for Strategy Library management.
 * Super admin only: create, update, delete, toggle strategies.
 */

import { createClient } from "../supabase/client";
import type { StrategyDefinition } from "../../types/strategy";
import { mapStrategyDefinitionRow } from "../../types/strategy";

/**
 * List all strategy definitions (admin view, no RLS filtering).
 * Requires super admin privileges.
 */
export async function listAllStrategies(opts?: {
  includeDisabled?: boolean;
  categoryFilter?: string;
}): Promise<StrategyDefinition[]> {
  const supabase = createClient();
  const { includeDisabled = true, categoryFilter } = opts || {};

  let query = supabase
    .from("strategy_definitions")
    .select("*")
    .order("created_at", { ascending: false });

  if (!includeDisabled) {
    query = query.eq("enabled", true);
  }

  if (categoryFilter) {
    query = query.eq("category", categoryFilter);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapStrategyDefinitionRow);
}

/**
 * Get a single strategy by ID.
 */
export async function getStrategyById(strategyId: string): Promise<StrategyDefinition | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_definitions")
    .select("*")
    .eq("id", strategyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return mapStrategyDefinitionRow(data);
}

/**
 * Create a new strategy definition.
 * Super admin only.
 */
export async function createStrategy(
  strategy: Omit<StrategyDefinition, "id" | "createdAt" | "updatedAt">
): Promise<StrategyDefinition> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_definitions")
    .insert({
      name: strategy.name,
      slug: strategy.slug,
      description: strategy.description,
      category: strategy.category,
      underlying_scope: strategy.underlyingScope,
      time_window: strategy.timeWindow,
      bar_timeframe: strategy.barTimeframe,
      entry_side: strategy.entrySide,
      options_play_type: strategy.optionsPlayType,
      conditions: strategy.conditions,
      alert_behavior: strategy.alertBehavior,
      cooldown_minutes: strategy.cooldownMinutes,
      once_per_session: strategy.oncePerSession,
      is_core_library: strategy.isCoreLibrary,
      enabled: strategy.enabled,
      owner: strategy.owner,
    })
    .select()
    .single();

  if (error) throw error;
  return mapStrategyDefinitionRow(data);
}

/**
 * Update an existing strategy definition.
 * Super admin only.
 */
export async function updateStrategy(
  strategyId: string,
  updates: Partial<Omit<StrategyDefinition, "id" | "createdAt" | "updatedAt">>
): Promise<StrategyDefinition> {
  const supabase = createClient();
  const payload: any = {};

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.slug !== undefined) payload.slug = updates.slug;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.underlyingScope !== undefined) payload.underlying_scope = updates.underlyingScope;
  if (updates.timeWindow !== undefined) payload.time_window = updates.timeWindow;
  if (updates.barTimeframe !== undefined) payload.bar_timeframe = updates.barTimeframe;
  if (updates.entrySide !== undefined) payload.entry_side = updates.entrySide;
  if (updates.optionsPlayType !== undefined) payload.options_play_type = updates.optionsPlayType;
  if (updates.conditions !== undefined) payload.conditions = updates.conditions;
  if (updates.alertBehavior !== undefined) payload.alert_behavior = updates.alertBehavior;
  if (updates.cooldownMinutes !== undefined) payload.cooldown_minutes = updates.cooldownMinutes;
  if (updates.oncePerSession !== undefined) payload.once_per_session = updates.oncePerSession;
  if (updates.isCoreLibrary !== undefined) payload.is_core_library = updates.isCoreLibrary;
  if (updates.enabled !== undefined) payload.enabled = updates.enabled;

  const { data, error } = await supabase
    .from("strategy_definitions")
    .update(payload)
    .eq("id", strategyId)
    .select()
    .single();

  if (error) throw error;
  return mapStrategyDefinitionRow(data);
}

/**
 * Toggle strategy enabled/disabled.
 * Super admin only.
 */
export async function toggleStrategyEnabled(
  strategyId: string,
  enabled: boolean
): Promise<StrategyDefinition> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_definitions")
    .update({ enabled })
    .eq("id", strategyId)
    .select()
    .single();

  if (error) throw error;
  return mapStrategyDefinitionRow(data);
}

/**
 * Delete a strategy definition.
 * Super admin only. Cannot delete core library strategies.
 */
export async function deleteStrategy(strategyId: string): Promise<void> {
  // First check if it's a core library strategy
  const strategy = await getStrategyById(strategyId);
  if (!strategy) throw new Error("Strategy not found");
  if (strategy.isCoreLibrary) {
    throw new Error("Cannot delete core library strategies. Disable instead.");
  }

  const supabase = createClient();
  const { error } = await supabase.from("strategy_definitions").delete().eq("id", strategyId);

  if (error) throw error;
}

/**
 * Duplicate a strategy (clone it with new slug).
 * Super admin only.
 */
export async function duplicateStrategy(
  strategyId: string,
  newSlug: string
): Promise<StrategyDefinition> {
  const original = await getStrategyById(strategyId);
  if (!original) throw new Error("Strategy not found");

  return createStrategy({
    ...original,
    name: `${original.name} (Copy)`,
    slug: newSlug,
    isCoreLibrary: false, // Clones are never core library
    enabled: false, // Start disabled
  });
}

/**
 * Bulk toggle strategies by category.
 * Super admin only.
 */
export async function bulkToggleByCategory(category: string, enabled: boolean): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_definitions")
    .update({ enabled })
    .eq("category", category)
    .select("id");

  if (error) throw error;
  return (data || []).length;
}

/**
 * Apply pending optimization parameters to a strategy.
 * This copies pending_params to the live configuration and clears pending_params.
 */
export async function applyPendingParams(strategyId: string): Promise<StrategyDefinition> {
  const supabase = createClient();

  // First get the current strategy with pending params
  const strategy = await getStrategyById(strategyId);
  if (!strategy) throw new Error("Strategy not found");
  if (!strategy.pendingParams) throw new Error("No pending parameters to apply");

  // Update the strategy: clear pending_params and update last_optimized_at
  const { data, error } = await supabase
    .from("strategy_definitions")
    .update({
      pending_params: null,
      last_optimized_at: new Date().toISOString(),
    })
    .eq("id", strategyId)
    .select()
    .single();

  if (error) throw error;
  return mapStrategyDefinitionRow(data);
}

/**
 * Dismiss pending optimization parameters without applying.
 */
export async function dismissPendingParams(strategyId: string): Promise<StrategyDefinition> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("strategy_definitions")
    .update({ pending_params: null })
    .eq("id", strategyId)
    .select()
    .single();

  if (error) throw error;
  return mapStrategyDefinitionRow(data);
}

/**
 * Toggle auto_optimize flag for a strategy.
 */
export async function toggleAutoOptimize(
  strategyId: string,
  autoOptimize: boolean
): Promise<StrategyDefinition> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("strategy_definitions")
    .update({ auto_optimize: autoOptimize })
    .eq("id", strategyId)
    .select()
    .single();

  if (error) throw error;
  return mapStrategyDefinitionRow(data);
}

/**
 * Get strategy statistics for admin dashboard.
 */
export async function getStrategyStats(): Promise<{
  total: number;
  enabled: number;
  disabled: number;
  coreLibrary: number;
  userDefined: number;
  byCategory: Record<string, number>;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_definitions")
    .select("id, enabled, is_core_library, category");

  if (error) throw error;

  const strategies = data || [];
  const byCategory: Record<string, number> = {};

  for (const s of strategies) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
  }

  return {
    total: strategies.length,
    enabled: strategies.filter((s: any) => s.enabled).length,
    disabled: strategies.filter((s: any) => !s.enabled).length,
    coreLibrary: strategies.filter((s: any) => s.is_core_library).length,
    userDefined: strategies.filter((s: any) => !s.is_core_library).length,
    byCategory,
  };
}
