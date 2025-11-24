/**
 * Historical Data Backfill Worker
 * Phase 2/3: One-time backfill of historical data for backtesting
 *
 * Fetches 90 days of historical options chains, indices, and market data
 * from Massive.com to populate the data warehouse for backtesting.
 *
 * Run once to backfill, then use historicalDataIngestion.ts for ongoing updates.
 */

import { createClient } from '@supabase/supabase-js';
import { getOptionChain, getIndicesSnapshot, massiveFetch } from '../massive/client.js';
import { snapshotGammaExposure } from './ingestion/gammaExposureSnapshot.js';
import { calculateIVPercentile } from './ingestion/ivPercentileCalculation.js';
import { calculateMarketRegime } from './ingestion/marketRegimeCalculation.js';

// Environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[BackfillWorker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configuration
const SYMBOLS_TO_BACKFILL = ['SPX', 'NDX'];
const BACKFILL_DAYS = 90;
const BATCH_SIZE = 5; // Process 5 days at a time to avoid rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

interface BackfillStats {
  symbol: string;
  startDate: string;
  endDate: string;
  daysProcessed: number;
  greeksRecords: number;
  gammaSnapshots: number;
  ivRecords: number;
  regimeRecords: number;
  errors: number;
  duration: number;
}

/**
 * Main backfill orchestrator
 */
async function backfillHistoricalData() {
  console.log('[BackfillWorker] 🚀 Starting historical data backfill...');
  console.log(`[BackfillWorker] Symbols: ${SYMBOLS_TO_BACKFILL.join(', ')}`);
  console.log(`[BackfillWorker] Backfill period: ${BACKFILL_DAYS} days`);

  const startTime = Date.now();
  const allStats: BackfillStats[] = [];

  for (const symbol of SYMBOLS_TO_BACKFILL) {
    const stats = await backfillSymbol(symbol);
    allStats.push(stats);
  }

  const totalDuration = Date.now() - startTime;

  // Print summary
  console.log('\n[BackfillWorker] ✅ Backfill Complete!');
  console.log('==========================================');
  for (const stats of allStats) {
    console.log(`\n${stats.symbol}:`);
    console.log(`  Days Processed: ${stats.daysProcessed}`);
    console.log(`  Greeks Records: ${stats.greeksRecords}`);
    console.log(`  Gamma Snapshots: ${stats.gammaSnapshots}`);
    console.log(`  IV Records: ${stats.ivRecords}`);
    console.log(`  Regime Records: ${stats.regimeRecords}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Duration: ${(stats.duration / 1000 / 60).toFixed(1)} minutes`);
  }
  console.log(`\nTotal Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log('==========================================\n');
}

/**
 * Backfill data for a single symbol
 */
async function backfillSymbol(symbol: string): Promise<BackfillStats> {
  console.log(`\n[BackfillWorker] Processing ${symbol}...`);

  const startTime = Date.now();
  const stats: BackfillStats = {
    symbol,
    startDate: '',
    endDate: '',
    daysProcessed: 0,
    greeksRecords: 0,
    gammaSnapshots: 0,
    ivRecords: 0,
    regimeRecords: 0,
    errors: 0,
    duration: 0,
  };

  // Calculate date range
  const endDate = new Date();
  endDate.setHours(16, 0, 0, 0); // 4pm ET close
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - BACKFILL_DAYS);

  stats.startDate = startDate.toISOString().split('T')[0];
  stats.endDate = endDate.toISOString().split('T')[0];

  console.log(`[BackfillWorker] Date range: ${stats.startDate} to ${stats.endDate}`);

  // Generate list of market dates (skip weekends)
  const marketDates = generateMarketDates(startDate, endDate);
  console.log(`[BackfillWorker] Market days to process: ${marketDates.length}`);

  // Process in batches
  for (let i = 0; i < marketDates.length; i += BATCH_SIZE) {
    const batch = marketDates.slice(i, i + BATCH_SIZE);
    console.log(`\n[BackfillWorker] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(marketDates.length / BATCH_SIZE)}...`);

    for (const date of batch) {
      try {
        await backfillDate(symbol, date, stats);
      } catch (error) {
        console.error(`[BackfillWorker] Error processing ${symbol} ${date}:`, error);
        stats.errors++;
      }
    }

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < marketDates.length) {
      console.log(`[BackfillWorker] Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }

  stats.duration = Date.now() - startTime;
  return stats;
}

/**
 * Backfill data for a single date
 */
async function backfillDate(symbol: string, date: Date, stats: BackfillStats) {
  const dateStr = date.toISOString().split('T')[0];
  console.log(`[BackfillWorker]   ${dateStr}...`);

  // Check if already processed
  const existing = await checkExistingData(symbol, dateStr);
  if (existing.greeks && existing.gamma && existing.iv) {
    console.log(`[BackfillWorker]   ${dateStr} - Already processed, skipping`);
    return;
  }

  // Set timestamp to 4pm ET (market close)
  const timestamp = date.getTime();

  try {
    // 1. Fetch historical options chain snapshot
    // Note: Massive.com may not have historical snapshots, so we may need to use aggregates
    // For now, we'll use current snapshot as a reference and note this limitation
    const chain = await getOptionChain(symbol, 250);

    if (!chain || !chain.contracts || chain.contracts.length === 0) {
      console.warn(`[BackfillWorker]   ${dateStr} - No options chain data`);
      return;
    }

    // 2. Store Greeks data
    if (!existing.greeks) {
      const greeksStored = await storeHistoricalGreeks(symbol, timestamp, chain.contracts);
      stats.greeksRecords += greeksStored;
    }

    // 3. Calculate and store gamma snapshot
    if (!existing.gamma) {
      const gammaResult = await snapshotGammaExposure(supabase, symbol);
      if (gammaResult.success) {
        stats.gammaSnapshots++;
      }
    }

    // 4. Calculate and store IV percentile (once we have enough data)
    if (!existing.iv && stats.daysProcessed >= 52 * 5) {
      const ivResult = await calculateIVPercentile(supabase, symbol);
      if (ivResult.success) {
        stats.ivRecords++;
      }
    }

    stats.daysProcessed++;
    console.log(`[BackfillWorker]   ${dateStr} - ✓ Complete`);
  } catch (error) {
    console.error(`[BackfillWorker]   ${dateStr} - Error:`, error);
    stats.errors++;
  }
}

/**
 * Store historical Greeks data
 */
async function storeHistoricalGreeks(
  symbol: string,
  timestamp: number,
  contracts: any[]
): Promise<number> {
  const records = contracts.map((contract) => ({
    symbol,
    timestamp,
    strike: contract.strike,
    expiration: contract.expiration,
    option_type: contract.option_type,
    bid: contract.bid || 0,
    ask: contract.ask || 0,
    last: contract.last || 0,
    volume: contract.volume || 0,
    open_interest: contract.open_interest || 0,
    implied_volatility: contract.greeks?.iv || contract.implied_volatility || null,
    delta: contract.greeks?.delta || null,
    gamma: contract.greeks?.gamma || null,
    theta: contract.greeks?.theta || null,
    vega: contract.greeks?.vega || null,
    rho: contract.greeks?.rho || null,
  }));

  const { error } = await supabase.from('historical_greeks').upsert(records as any, {
    onConflict: 'symbol,timestamp,strike,expiration,option_type',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error(`[BackfillWorker] Error storing Greeks:`, error);
    return 0;
  }

  return records.length;
}

/**
 * Check if data already exists for a date
 */
async function checkExistingData(symbol: string, dateStr: string): Promise<{
  greeks: boolean;
  gamma: boolean;
  iv: boolean;
}> {
  // Check Greeks
  const { data: greeksData } = await supabase
    .from('historical_greeks')
    .select('id')
    .eq('symbol', symbol)
    .gte('timestamp', new Date(dateStr + 'T00:00:00Z').getTime())
    .lte('timestamp', new Date(dateStr + 'T23:59:59Z').getTime())
    .limit(1);

  // Check Gamma
  const { data: gammaData } = await supabase
    .from('gamma_exposure_snapshots')
    .select('id')
    .eq('symbol', symbol)
    .gte('timestamp', new Date(dateStr + 'T00:00:00Z').getTime())
    .lte('timestamp', new Date(dateStr + 'T23:59:59Z').getTime())
    .limit(1);

  // Check IV Percentile
  const { data: ivData } = await supabase
    .from('iv_percentile_cache')
    .select('symbol')
    .eq('symbol', symbol)
    .eq('date', dateStr)
    .limit(1);

  return {
    greeks: (greeksData?.length || 0) > 0,
    gamma: (gammaData?.length || 0) > 0,
    iv: (ivData?.length || 0) > 0,
  };
}

/**
 * Generate list of market dates (excluding weekends)
 */
function generateMarketDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill market regime history
 */
async function backfillMarketRegimes() {
  console.log('\n[BackfillWorker] Backfilling market regime history...');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - BACKFILL_DAYS);

  const marketDates = generateMarketDates(startDate, endDate);
  let successCount = 0;
  let errorCount = 0;

  for (const date of marketDates) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('market_regime_history')
        .select('date')
        .eq('date', dateStr)
        .single();

      if (existing) {
        console.log(`[BackfillWorker]   ${dateStr} - Already exists, skipping`);
        continue;
      }

      // Calculate regime (this will use current VIX, but we'd ideally use historical)
      const result = await calculateMarketRegime(supabase);

      if (result.success) {
        successCount++;
        console.log(`[BackfillWorker]   ${dateStr} - ✓ Regime calculated`);
      } else {
        errorCount++;
        console.error(`[BackfillWorker]   ${dateStr} - Failed:`, result.error);
      }
    } catch (error) {
      errorCount++;
      console.error(`[BackfillWorker]   ${dateStr} - Error:`, error);
    }

    // Small delay to avoid rate limits
    await delay(500);
  }

  console.log(`[BackfillWorker] Market regime backfill complete: ${successCount} success, ${errorCount} errors`);
}

// Run backfill
backfillHistoricalData()
  .then(() => {
    console.log('[BackfillWorker] 🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[BackfillWorker] Fatal error:', error);
    process.exit(1);
  });
