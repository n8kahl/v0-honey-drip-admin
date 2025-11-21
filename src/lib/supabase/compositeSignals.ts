/**
 * Composite Signals Database Layer
 * Phase 6: Database & Backend
 *
 * Functions for persisting and querying composite trade signals
 */

import { createClient } from './client.js';
import type { CompositeSignal } from '../composite/CompositeSignal.js';
import type { OpportunityType } from '../composite/OpportunityDetector.js';

/**
 * Database row type for composite_signals table
 */
export interface CompositeSignalRow {
  id: string;
  created_at: string;
  updated_at: string;
  owner: string;
  symbol: string;
  opportunity_type: string;
  direction: string;
  asset_class: string;
  base_score: number;
  scalp_score: number;
  day_trade_score: number;
  swing_score: number;
  recommended_style: string;
  recommended_style_score: number;
  confluence: Record<string, number>;
  entry_price: number;
  stop_price: number;
  target_t1: number;
  target_t2: number;
  target_t3: number;
  risk_reward: number;
  features: any;
  status: string;
  expires_at: string;
  alerted_at?: string;
  dismissed_at?: string;
  filled_at?: string;
  exited_at?: string;
  fill_price?: number;
  exit_price?: number;
  exit_reason?: string;
  contracts_traded?: number;
  realized_pnl?: number;
  realized_pnl_pct?: number;
  hold_time_minutes?: number;
  max_favorable_excursion?: number;
  max_adverse_excursion?: number;
  bar_time_key?: string;
  detector_version?: string;
}

/**
 * Database row type for signal_performance_metrics table
 */
export interface SignalPerformanceMetricsRow {
  id: string;
  created_at: string;
  updated_at: string;
  date: string;
  owner?: string;
  symbol?: string;
  opportunity_type?: string;
  recommended_style?: string;
  total_signals: number;
  signals_filled: number;
  signals_expired: number;
  signals_dismissed: number;
  winners: number;
  losers: number;
  win_rate?: number;
  total_pnl?: number;
  avg_winner_pnl?: number;
  avg_loser_pnl?: number;
  largest_winner?: number;
  largest_loser?: number;
  profit_factor?: number;
  avg_hold_time_minutes?: number;
  avg_risk_reward?: number;
  avg_fill_slippage_pct?: number;
  avg_base_score?: number;
  avg_style_score?: number;
  avg_mfe?: number;
  avg_mae?: number;
  exits_t1: number;
  exits_t2: number;
  exits_t3: number;
  exits_stop: number;
  exits_manual: number;
  exits_expired: number;
}

// ============================================================================
// COMPOSITE SIGNALS - INSERT/UPDATE
// ============================================================================

/**
 * Convert CompositeSignal to database row
 */
function signalToRow(signal: CompositeSignal): Omit<CompositeSignalRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    owner: signal.owner,
    symbol: signal.symbol,
    opportunity_type: signal.opportunityType,
    direction: signal.direction,
    asset_class: signal.assetClass,
    base_score: signal.baseScore,
    scalp_score: signal.scalpScore,
    day_trade_score: signal.dayTradeScore,
    swing_score: signal.swingScore,
    recommended_style: signal.recommendedStyle,
    recommended_style_score: signal.recommendedStyleScore,
    confluence: signal.confluence,
    entry_price: signal.entryPrice,
    stop_price: signal.stopPrice,
    target_t1: signal.targets.T1,
    target_t2: signal.targets.T2,
    target_t3: signal.targets.T3,
    risk_reward: signal.riskReward,
    features: signal.features,
    status: signal.status,
    expires_at: signal.expiresAt.toISOString(),
    alerted_at: signal.alertedAt?.toISOString(),
    dismissed_at: signal.dismissedAt?.toISOString(),
    filled_at: signal.filledAt?.toISOString(),
    exited_at: signal.exitedAt?.toISOString(),
    fill_price: signal.fillPrice,
    exit_price: signal.exitPrice,
    exit_reason: signal.exitReason,
    contracts_traded: signal.contractsTraded,
    realized_pnl: signal.realizedPnl,
    realized_pnl_pct: signal.realizedPnlPct,
    hold_time_minutes: signal.holdTimeMinutes,
    max_favorable_excursion: signal.maxFavorableExcursion,
    max_adverse_excursion: signal.maxAdverseExcursion,
    bar_time_key: signal.barTimeKey,
    detector_version: signal.detectorVersion,
  };
}

/**
 * Convert database row to CompositeSignal
 */
function rowToSignal(row: CompositeSignalRow): CompositeSignal {
  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    owner: row.owner,
    symbol: row.symbol,
    opportunityType: row.opportunity_type as OpportunityType,
    direction: row.direction as 'LONG' | 'SHORT',
    assetClass: row.asset_class as any,
    baseScore: row.base_score,
    scalpScore: row.scalp_score,
    dayTradeScore: row.day_trade_score,
    swingScore: row.swing_score,
    recommendedStyle: row.recommended_style as 'scalp' | 'day_trade' | 'swing',
    recommendedStyleScore: row.recommended_style_score,
    confluence: row.confluence,
    entryPrice: row.entry_price,
    stopPrice: row.stop_price,
    targets: {
      T1: row.target_t1,
      T2: row.target_t2,
      T3: row.target_t3,
    },
    riskReward: row.risk_reward,
    features: row.features,
    status: row.status as any,
    expiresAt: new Date(row.expires_at),
    alertedAt: row.alerted_at ? new Date(row.alerted_at) : undefined,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
    filledAt: row.filled_at ? new Date(row.filled_at) : undefined,
    exitedAt: row.exited_at ? new Date(row.exited_at) : undefined,
    fillPrice: row.fill_price,
    exitPrice: row.exit_price,
    exitReason: row.exit_reason as any,
    contractsTraded: row.contracts_traded,
    realizedPnl: row.realized_pnl,
    realizedPnlPct: row.realized_pnl_pct,
    holdTimeMinutes: row.hold_time_minutes,
    maxFavorableExcursion: row.max_favorable_excursion,
    maxAdverseExcursion: row.max_adverse_excursion,
    barTimeKey: row.bar_time_key,
    detectorVersion: row.detector_version,
    timestamp: new Date(row.created_at).getTime(),
  };
}

/**
 * Insert a new composite signal
 *
 * @param signal - Signal to insert
 * @returns Inserted signal with ID
 */
export async function insertCompositeSignal(signal: CompositeSignal): Promise<CompositeSignal> {
  const supabase = createClient();

  const row = signalToRow(signal);

  const { data, error } = await supabase
    .from('composite_signals')
    .insert(row)
    .select()
    .single();

  if (error) {
    // Check for duplicate bar_time_key
    if (error.code === '23505' && error.message?.includes('bar_time_key')) {
      throw new Error(`Duplicate signal: ${signal.barTimeKey}`);
    }
    throw error;
  }

  return rowToSignal(data);
}

/**
 * Update an existing composite signal
 *
 * @param id - Signal ID
 * @param updates - Fields to update
 * @returns Updated signal
 */
export async function updateCompositeSignal(
  id: string,
  updates: Partial<Omit<CompositeSignal, 'id' | 'createdAt' | 'updatedAt' | 'timestamp'>>
): Promise<CompositeSignal> {
  const supabase = createClient();

  // Convert updates to row format
  const rowUpdates: any = {};

  if (updates.status !== undefined) rowUpdates.status = updates.status;
  if (updates.alertedAt !== undefined) rowUpdates.alerted_at = updates.alertedAt.toISOString();
  if (updates.dismissedAt !== undefined) rowUpdates.dismissed_at = updates.dismissedAt.toISOString();
  if (updates.filledAt !== undefined) rowUpdates.filled_at = updates.filledAt.toISOString();
  if (updates.exitedAt !== undefined) rowUpdates.exited_at = updates.exitedAt.toISOString();
  if (updates.fillPrice !== undefined) rowUpdates.fill_price = updates.fillPrice;
  if (updates.exitPrice !== undefined) rowUpdates.exit_price = updates.exitPrice;
  if (updates.exitReason !== undefined) rowUpdates.exit_reason = updates.exitReason;
  if (updates.contractsTraded !== undefined) rowUpdates.contracts_traded = updates.contractsTraded;
  if (updates.realizedPnl !== undefined) rowUpdates.realized_pnl = updates.realizedPnl;
  if (updates.realizedPnlPct !== undefined) rowUpdates.realized_pnl_pct = updates.realizedPnlPct;
  if (updates.holdTimeMinutes !== undefined) rowUpdates.hold_time_minutes = updates.holdTimeMinutes;
  if (updates.maxFavorableExcursion !== undefined) rowUpdates.max_favorable_excursion = updates.maxFavorableExcursion;
  if (updates.maxAdverseExcursion !== undefined) rowUpdates.max_adverse_excursion = updates.maxAdverseExcursion;

  const { data, error } = await supabase
    .from('composite_signals')
    .update(rowUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return rowToSignal(data);
}

// ============================================================================
// COMPOSITE SIGNALS - QUERIES
// ============================================================================

/**
 * Get active signals for a user
 *
 * @param userId - User ID
 * @param limit - Max number of signals to return
 * @returns Active signals
 */
export async function getActiveSignals(userId: string, limit: number = 50): Promise<CompositeSignal[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('composite_signals')
    .select('*')
    .eq('owner', userId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(rowToSignal);
}

/**
 * Get signals for a user with filters
 *
 * @param userId - User ID
 * @param filters - Query filters
 * @returns Filtered signals
 */
export async function getSignals(
  userId: string,
  filters: {
    status?: string[];
    symbol?: string;
    opportunityType?: string;
    recommendedStyle?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  } = {}
): Promise<CompositeSignal[]> {
  const supabase = createClient();

  let query = supabase
    .from('composite_signals')
    .select('*')
    .eq('owner', userId);

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.symbol) {
    query = query.eq('symbol', filters.symbol);
  }

  if (filters.opportunityType) {
    query = query.eq('opportunity_type', filters.opportunityType);
  }

  if (filters.recommendedStyle) {
    query = query.eq('recommended_style', filters.recommendedStyle);
  }

  if (filters.fromDate) {
    query = query.gte('created_at', filters.fromDate.toISOString());
  }

  if (filters.toDate) {
    query = query.lte('created_at', filters.toDate.toISOString());
  }

  query = query.order('created_at', { ascending: false });

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(rowToSignal);
}

/**
 * Get a single signal by ID
 *
 * @param id - Signal ID
 * @returns Signal or null
 */
export async function getSignalById(id: string): Promise<CompositeSignal | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('composite_signals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return rowToSignal(data);
}

/**
 * Mark signal as alerted
 *
 * @param id - Signal ID
 * @returns Updated signal
 */
export async function markSignalAlerted(id: string): Promise<CompositeSignal> {
  return updateCompositeSignal(id, {
    alertedAt: new Date(),
  });
}

/**
 * Mark signal as dismissed
 *
 * @param id - Signal ID
 * @returns Updated signal
 */
export async function dismissSignal(id: string): Promise<CompositeSignal> {
  return updateCompositeSignal(id, {
    status: 'DISMISSED',
    dismissedAt: new Date(),
  });
}

/**
 * Fill a signal (enter trade)
 *
 * @param id - Signal ID
 * @param fillPrice - Fill price
 * @param contractsTraded - Number of contracts
 * @returns Updated signal
 */
export async function fillSignal(
  id: string,
  fillPrice: number,
  contractsTraded: number = 1
): Promise<CompositeSignal> {
  return updateCompositeSignal(id, {
    status: 'FILLED',
    filledAt: new Date(),
    fillPrice,
    contractsTraded,
  });
}

/**
 * Exit a signal (close trade)
 *
 * @param id - Signal ID
 * @param exitPrice - Exit price
 * @param exitReason - Reason for exit
 * @returns Updated signal
 */
export async function exitSignal(
  id: string,
  exitPrice: number,
  exitReason: 'STOP' | 'T1' | 'T2' | 'T3' | 'MANUAL' | 'EXPIRED'
): Promise<CompositeSignal> {
  // Get current signal to calculate P&L
  const signal = await getSignalById(id);
  if (!signal) throw new Error('Signal not found');

  if (!signal.fillPrice || !signal.filledAt) {
    throw new Error('Cannot exit signal that was not filled');
  }

  // Calculate P&L
  const pnlPerContract =
    signal.direction === 'LONG'
      ? exitPrice - signal.fillPrice
      : signal.fillPrice - exitPrice;

  const realizedPnl = pnlPerContract * (signal.contractsTraded || 1);
  const realizedPnlPct = (pnlPerContract / signal.fillPrice) * 100;

  // Calculate hold time
  const holdTimeMs = Date.now() - signal.filledAt.getTime();
  const holdTimeMinutes = Math.floor(holdTimeMs / 60000);

  // Determine final status
  const status = exitReason === 'STOP' ? 'STOPPED' : 'TARGET_HIT';

  return updateCompositeSignal(id, {
    status,
    exitedAt: new Date(),
    exitPrice,
    exitReason,
    realizedPnl,
    realizedPnlPct,
    holdTimeMinutes,
  });
}

/**
 * Update MFE/MAE for a filled signal
 *
 * @param id - Signal ID
 * @param currentPrice - Current price
 * @returns Updated signal
 */
export async function updateSignalExcursions(
  id: string,
  currentPrice: number
): Promise<CompositeSignal> {
  const signal = await getSignalById(id);
  if (!signal || signal.status !== 'FILLED') {
    throw new Error('Can only update excursions for filled signals');
  }

  const fillPrice = signal.fillPrice || signal.entryPrice;
  const currentExcursion = signal.direction === 'LONG'
    ? currentPrice - fillPrice
    : fillPrice - currentPrice;

  const updates: any = {};

  // Update MFE (max favorable excursion)
  if (
    currentExcursion > 0 &&
    (signal.maxFavorableExcursion === undefined ||
      currentExcursion > signal.maxFavorableExcursion)
  ) {
    updates.maxFavorableExcursion = currentExcursion;
  }

  // Update MAE (max adverse excursion)
  if (
    currentExcursion < 0 &&
    (signal.maxAdverseExcursion === undefined ||
      currentExcursion < signal.maxAdverseExcursion)
  ) {
    updates.maxAdverseExcursion = currentExcursion;
  }

  if (Object.keys(updates).length === 0) {
    return signal; // No updates needed
  }

  return updateCompositeSignal(id, updates);
}

/**
 * Expire old active signals
 *
 * @param userId - User ID (optional, if not provided expires for all users)
 * @returns Number of signals expired
 */
export async function expireOldSignals(userId?: string): Promise<number> {
  const supabase = createClient();

  let query = supabase
    .from('composite_signals')
    .update({ status: 'EXPIRED' })
    .eq('status', 'ACTIVE')
    .lt('expires_at', new Date().toISOString());

  if (userId) {
    query = query.eq('owner', userId);
  }

  const { data, error } = await query.select();

  if (error) throw error;

  return data?.length || 0;
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

/**
 * Get performance metrics for a user
 *
 * @param userId - User ID
 * @param filters - Query filters
 * @returns Performance metrics
 */
export async function getPerformanceMetrics(
  userId: string,
  filters: {
    fromDate?: Date;
    toDate?: Date;
    symbol?: string;
    opportunityType?: string;
    recommendedStyle?: string;
  } = {}
): Promise<SignalPerformanceMetricsRow[]> {
  const supabase = createClient();

  let query = supabase
    .from('signal_performance_metrics')
    .select('*')
    .eq('owner', userId);

  if (filters.fromDate) {
    query = query.gte('date', filters.fromDate.toISOString().split('T')[0]);
  }

  if (filters.toDate) {
    query = query.lte('date', filters.toDate.toISOString().split('T')[0]);
  }

  if (filters.symbol) {
    query = query.eq('symbol', filters.symbol);
  }

  if (filters.opportunityType) {
    query = query.eq('opportunity_type', filters.opportunityType);
  }

  if (filters.recommendedStyle) {
    query = query.eq('recommended_style', filters.recommendedStyle);
  }

  query = query.order('date', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

/**
 * Update performance metrics (upsert)
 * This is typically called by a background worker
 *
 * @param metrics - Metrics to upsert
 * @returns Updated metrics
 */
export async function upsertPerformanceMetrics(
  metrics: Omit<SignalPerformanceMetricsRow, 'id' | 'created_at' | 'updated_at'>
): Promise<SignalPerformanceMetricsRow> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('signal_performance_metrics')
    .upsert(metrics, {
      onConflict: 'date,owner,symbol,opportunity_type,recommended_style',
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}
