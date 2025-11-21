/**
 * Performance Analytics
 * Phase 6: Database & Backend
 *
 * Functions for aggregating and analyzing signal performance
 */

import { createClient } from './client.js';
import type { CompositeSignalRow, SignalPerformanceMetricsRow } from './compositeSignals.js';
import { upsertPerformanceMetrics } from './compositeSignals.js';

/**
 * Calculate performance metrics for a given date/owner/symbol/type/style
 *
 * @param date - Date to calculate metrics for
 * @param owner - User ID
 * @param symbol - Symbol (optional, null = all symbols)
 * @param opportunityType - Opportunity type (optional, null = all types)
 * @param recommendedStyle - Recommended style (optional, null = all styles)
 * @returns Calculated metrics
 */
export async function calculatePerformanceMetrics(
  date: Date,
  owner: string,
  symbol?: string,
  opportunityType?: string,
  recommendedStyle?: string
): Promise<Omit<SignalPerformanceMetricsRow, 'id' | 'created_at' | 'updated_at'>> {
  const supabase = createClient();

  const dateStr = date.toISOString().split('T')[0];

  // Build query for signals on this date
  let query = supabase
    .from('composite_signals')
    .select('*')
    .eq('owner', owner)
    .gte('created_at', `${dateStr}T00:00:00Z`)
    .lt('created_at', `${dateStr}T23:59:59Z`);

  if (symbol) {
    query = query.eq('symbol', symbol);
  }

  if (opportunityType) {
    query = query.eq('opportunity_type', opportunityType);
  }

  if (recommendedStyle) {
    query = query.eq('recommended_style', recommendedStyle);
  }

  const { data: signals, error } = await query;

  if (error) throw error;

  // Calculate metrics from signals
  return aggregateSignalMetrics(
    signals || [],
    dateStr,
    owner,
    symbol,
    opportunityType,
    recommendedStyle
  );
}

/**
 * Aggregate metrics from an array of signals
 *
 * @param signals - Array of signal rows
 * @param date - Date string
 * @param owner - User ID
 * @param symbol - Symbol (optional)
 * @param opportunityType - Opportunity type (optional)
 * @param recommendedStyle - Recommended style (optional)
 * @returns Aggregated metrics
 */
function aggregateSignalMetrics(
  signals: CompositeSignalRow[],
  date: string,
  owner: string,
  symbol?: string,
  opportunityType?: string,
  recommendedStyle?: string
): Omit<SignalPerformanceMetricsRow, 'id' | 'created_at' | 'updated_at'> {
  const totalSignals = signals.length;

  // Count by status
  const signalsFilled = signals.filter((s) => s.status === 'FILLED' || s.exited_at).length;
  const signalsExpired = signals.filter((s) => s.status === 'EXPIRED').length;
  const signalsDismissed = signals.filter((s) => s.status === 'DISMISSED').length;

  // Only consider exited trades for P&L metrics
  const exitedSignals = signals.filter(
    (s) => s.exited_at && s.realized_pnl !== undefined && s.realized_pnl !== null
  );

  // Win/Loss stats
  const winners = exitedSignals.filter((s) => (s.realized_pnl || 0) > 0).length;
  const losers = exitedSignals.filter((s) => (s.realized_pnl || 0) <= 0).length;
  const winRate = winners + losers > 0 ? (winners / (winners + losers)) * 100 : undefined;

  // P&L stats
  const totalPnl = exitedSignals.reduce((sum, s) => sum + (s.realized_pnl || 0), 0);

  const winningTrades = exitedSignals.filter((s) => (s.realized_pnl || 0) > 0);
  const losingTrades = exitedSignals.filter((s) => (s.realized_pnl || 0) <= 0);

  const avgWinnerPnl =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0) / winningTrades.length
      : undefined;

  const avgLoserPnl =
    losingTrades.length > 0
      ? losingTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0) / losingTrades.length
      : undefined;

  const largestWinner =
    winningTrades.length > 0
      ? Math.max(...winningTrades.map((s) => s.realized_pnl || 0))
      : undefined;

  const largestLoser =
    losingTrades.length > 0
      ? Math.min(...losingTrades.map((s) => s.realized_pnl || 0))
      : undefined;

  // Profit factor = total wins / abs(total losses)
  const totalWins = winningTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, s) => sum + (s.realized_pnl || 0), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : undefined;

  // Execution stats
  const filledSignals = signals.filter((s) => s.filled_at);

  const avgHoldTimeMinutes =
    exitedSignals.length > 0
      ? Math.round(
          exitedSignals.reduce((sum, s) => sum + (s.hold_time_minutes || 0), 0) /
            exitedSignals.length
        )
      : undefined;

  const avgRiskReward =
    filledSignals.length > 0
      ? filledSignals.reduce((sum, s) => sum + (s.risk_reward || 0), 0) / filledSignals.length
      : undefined;

  // Calculate fill slippage
  const avgFillSlippagePct =
    filledSignals.length > 0
      ? filledSignals.reduce((sum, s) => {
          const slippage = s.fill_price
            ? ((s.fill_price - s.entry_price) / s.entry_price) * 100
            : 0;
          return sum + slippage;
        }, 0) / filledSignals.length
      : undefined;

  // Quality metrics
  const avgBaseScore =
    totalSignals > 0
      ? signals.reduce((sum, s) => sum + s.base_score, 0) / totalSignals
      : undefined;

  const avgStyleScore =
    totalSignals > 0
      ? signals.reduce((sum, s) => sum + s.recommended_style_score, 0) / totalSignals
      : undefined;

  const avgMfe =
    exitedSignals.length > 0
      ? exitedSignals.reduce((sum, s) => sum + (s.max_favorable_excursion || 0), 0) /
        exitedSignals.length
      : undefined;

  const avgMae =
    exitedSignals.length > 0
      ? exitedSignals.reduce((sum, s) => sum + (s.max_adverse_excursion || 0), 0) /
        exitedSignals.length
      : undefined;

  // Exit distribution
  const exitsT1 = exitedSignals.filter((s) => s.exit_reason === 'T1').length;
  const exitsT2 = exitedSignals.filter((s) => s.exit_reason === 'T2').length;
  const exitsT3 = exitedSignals.filter((s) => s.exit_reason === 'T3').length;
  const exitsStop = exitedSignals.filter((s) => s.exit_reason === 'STOP').length;
  const exitsManual = exitedSignals.filter((s) => s.exit_reason === 'MANUAL').length;
  const exitsExpired = exitedSignals.filter((s) => s.exit_reason === 'EXPIRED').length;

  return {
    date,
    owner,
    symbol: symbol || null,
    opportunity_type: opportunityType || null,
    recommended_style: recommendedStyle || null,
    total_signals: totalSignals,
    signals_filled: signalsFilled,
    signals_expired: signalsExpired,
    signals_dismissed: signalsDismissed,
    winners,
    losers,
    win_rate: winRate,
    total_pnl: totalPnl || undefined,
    avg_winner_pnl: avgWinnerPnl,
    avg_loser_pnl: avgLoserPnl,
    largest_winner: largestWinner,
    largest_loser: largestLoser,
    profit_factor: profitFactor,
    avg_hold_time_minutes: avgHoldTimeMinutes,
    avg_risk_reward: avgRiskReward,
    avg_fill_slippage_pct: avgFillSlippagePct,
    avg_base_score: avgBaseScore,
    avg_style_score: avgStyleScore,
    avg_mfe: avgMfe,
    avg_mae: avgMae,
    exits_t1: exitsT1,
    exits_t2: exitsT2,
    exits_t3: exitsT3,
    exits_stop: exitsStop,
    exits_manual: exitsManual,
    exits_expired: exitsExpired,
  };
}

/**
 * Update performance metrics for a completed signal
 * This is called when a signal is exited
 *
 * @param signalId - Signal ID
 * @returns Updated metrics
 */
export async function updatePerformanceMetricsForSignal(signalId: string): Promise<void> {
  const supabase = createClient();

  // Get the signal
  const { data: signal, error: signalError } = await supabase
    .from('composite_signals')
    .select('*')
    .eq('id', signalId)
    .single();

  if (signalError) throw signalError;

  // Extract date from created_at
  const date = new Date(signal.created_at);

  // Calculate metrics for this date/owner/symbol/type/style
  const metrics = await calculatePerformanceMetrics(
    date,
    signal.owner,
    signal.symbol,
    signal.opportunity_type,
    signal.recommended_style
  );

  // Upsert the metrics
  await upsertPerformanceMetrics(metrics);

  // Also update aggregated metrics (all symbols, all types, all styles)
  const aggregatedMetrics = await calculatePerformanceMetrics(date, signal.owner);
  await upsertPerformanceMetrics(aggregatedMetrics);
}

/**
 * Recalculate all performance metrics for a date range
 * Useful for backfilling or fixing metrics
 *
 * @param owner - User ID
 * @param fromDate - Start date
 * @param toDate - End date
 * @returns Number of metric rows updated
 */
export async function recalculatePerformanceMetrics(
  owner: string,
  fromDate: Date,
  toDate: Date
): Promise<number> {
  const supabase = createClient();

  // Get all unique combinations of symbol/type/style for this date range
  const { data: signals, error } = await supabase
    .from('composite_signals')
    .select('symbol, opportunity_type, recommended_style, created_at')
    .eq('owner', owner)
    .gte('created_at', fromDate.toISOString())
    .lte('created_at', toDate.toISOString());

  if (error) throw error;

  // Group by date
  const dateMap = new Map<string, Set<string>>();

  for (const signal of signals || []) {
    const dateStr = new Date(signal.created_at).toISOString().split('T')[0];

    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, new Set());
    }

    // Add combinations
    dateMap.get(dateStr)!.add('ALL'); // Aggregated
    dateMap.get(dateStr)!.add(`SYMBOL:${signal.symbol}`);
    dateMap.get(dateStr)!.add(`TYPE:${signal.opportunity_type}`);
    dateMap.get(dateStr)!.add(`STYLE:${signal.recommended_style}`);
    dateMap
      .get(dateStr)!
      .add(`SYMBOL:${signal.symbol}|TYPE:${signal.opportunity_type}|STYLE:${signal.recommended_style}`);
  }

  let count = 0;

  // Calculate metrics for each combination
  for (const [dateStr, combinations] of dateMap.entries()) {
    const date = new Date(dateStr);

    for (const combo of combinations) {
      if (combo === 'ALL') {
        // Aggregated metrics
        const metrics = await calculatePerformanceMetrics(date, owner);
        await upsertPerformanceMetrics(metrics);
        count++;
      } else if (combo.startsWith('SYMBOL:') && !combo.includes('|')) {
        // Symbol-only metrics
        const symbol = combo.split(':')[1];
        const metrics = await calculatePerformanceMetrics(date, owner, symbol);
        await upsertPerformanceMetrics(metrics);
        count++;
      } else if (combo.startsWith('TYPE:')) {
        // Type-only metrics
        const type = combo.split(':')[1];
        const metrics = await calculatePerformanceMetrics(date, owner, undefined, type);
        await upsertPerformanceMetrics(metrics);
        count++;
      } else if (combo.startsWith('STYLE:')) {
        // Style-only metrics
        const style = combo.split(':')[1];
        const metrics = await calculatePerformanceMetrics(date, owner, undefined, undefined, style);
        await upsertPerformanceMetrics(metrics);
        count++;
      } else if (combo.includes('|')) {
        // Full combination
        const parts = combo.split('|');
        const symbol = parts[0].split(':')[1];
        const type = parts[1].split(':')[1];
        const style = parts[2].split(':')[1];
        const metrics = await calculatePerformanceMetrics(date, owner, symbol, type, style);
        await upsertPerformanceMetrics(metrics);
        count++;
      }
    }
  }

  return count;
}

/**
 * Get summary statistics for a user
 *
 * @param owner - User ID
 * @param days - Number of days to look back (default: 30)
 * @returns Summary statistics
 */
export async function getPerformanceSummary(
  owner: string,
  days: number = 30
): Promise<{
  totalSignals: number;
  totalFilled: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  avgHoldTime: number;
  bestDay: { date: string; pnl: number };
  worstDay: { date: string; pnl: number };
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const supabase = createClient();

  // Get aggregated metrics (symbol=null, type=null, style=null)
  const { data: metrics, error } = await supabase
    .from('signal_performance_metrics')
    .select('*')
    .eq('owner', owner)
    .is('symbol', null)
    .is('opportunity_type', null)
    .is('recommended_style', null)
    .gte('date', fromDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw error;

  if (!metrics || metrics.length === 0) {
    return {
      totalSignals: 0,
      totalFilled: 0,
      winRate: 0,
      totalPnl: 0,
      profitFactor: 0,
      avgHoldTime: 0,
      bestDay: { date: '', pnl: 0 },
      worstDay: { date: '', pnl: 0 },
    };
  }

  const totalSignals = metrics.reduce((sum, m) => sum + m.total_signals, 0);
  const totalFilled = metrics.reduce((sum, m) => sum + m.signals_filled, 0);
  const totalWinners = metrics.reduce((sum, m) => sum + m.winners, 0);
  const totalLosers = metrics.reduce((sum, m) => sum + m.losers, 0);
  const winRate =
    totalWinners + totalLosers > 0 ? (totalWinners / (totalWinners + totalLosers)) * 100 : 0;
  const totalPnl = metrics.reduce((sum, m) => sum + (m.total_pnl || 0), 0);

  // Weighted average profit factor
  const profitFactor =
    metrics.reduce((sum, m) => sum + (m.profit_factor || 0), 0) / metrics.length || 0;

  // Weighted average hold time
  const avgHoldTime =
    metrics.reduce((sum, m) => sum + (m.avg_hold_time_minutes || 0), 0) / metrics.length || 0;

  // Best and worst days
  const sortedByPnl = [...metrics].sort((a, b) => (b.total_pnl || 0) - (a.total_pnl || 0));
  const bestDay = { date: sortedByPnl[0]?.date || '', pnl: sortedByPnl[0]?.total_pnl || 0 };
  const worstDay = {
    date: sortedByPnl[sortedByPnl.length - 1]?.date || '',
    pnl: sortedByPnl[sortedByPnl.length - 1]?.total_pnl || 0,
  };

  return {
    totalSignals,
    totalFilled,
    winRate,
    totalPnl,
    profitFactor,
    avgHoldTime,
    bestDay,
    worstDay,
  };
}
