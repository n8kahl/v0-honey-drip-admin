/**
 * Aggregate Options Flow
 * Fetches and aggregates flow metrics across an entire options chain
 * Works for ANY optionable symbol (SPX, SPY, TGT, NVDA, etc.)
 */

import type { OptionContract } from './options-advanced';
import { analyzeTradeTape } from './options-advanced';
import type { TradeTape } from './options-advanced';

/**
 * Flow metrics aggregated across entire options chain for an underlying
 */
export interface AggregatedFlowMetrics {
  // Core flow metrics
  sweepCount: number;
  blockCount: number;
  unusualActivity: boolean;
  flowScore: number;
  flowBias: 'bullish' | 'bearish' | 'neutral';
  buyPressure: number;

  // Additional context
  totalVolume: number;
  callVolume: number;
  putVolume: number;
  callPutRatio: number;
  avgTradeSize: number;
  largeTradeCount: number;

  // Metadata
  contractsAnalyzed: number;
  timestamp: number;
  symbol: string;
}

/**
 * Cache for flow metrics to avoid repeated API calls
 * Key: symbol, Value: { data, expiry }
 */
interface FlowCacheEntry {
  data: AggregatedFlowMetrics;
  expiry: number;
}

const flowCache = new Map<string, FlowCacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Aggregate flow metrics across entire options chain for an underlying symbol
 *
 * @param symbol - Underlying symbol (SPX, SPY, TGT, NVDA, etc.)
 * @param contracts - Options contracts for the symbol (optional, will fetch if not provided)
 * @param lookbackMinutes - How far back to look for trades (default: 5 minutes)
 * @returns Aggregated flow metrics or null if symbol has no liquid options
 */
export async function getAggregateUnderlyingFlow(
  symbol: string,
  contracts?: OptionContract[],
  lookbackMinutes: number = 5
): Promise<AggregatedFlowMetrics | null> {
  // Check cache first
  const cached = flowCache.get(symbol);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  try {
    // If contracts not provided, we need to fetch them
    // For now, we'll return null and let the caller provide contracts
    // This avoids circular dependencies with the options fetching code
    if (!contracts || contracts.length === 0) {
      return null;
    }

    // Filter for liquid contracts (volume > 0, open interest > 100)
    const liquidContracts = contracts.filter(
      c => (c.volume || 0) > 0 && (c.open_interest || (c as any).openInterest || 0) > 100
    );

    if (liquidContracts.length === 0) {
      return null; // No liquid options
    }

    // Check if total volume meets minimum threshold (1000 contracts)
    const totalVolume = liquidContracts.reduce((sum, c) => sum + (c.volume || 0), 0);
    if (totalVolume < 1000) {
      return null; // Insufficient liquidity
    }

    // Sort by volume and take top 20 most active contracts
    const topContracts = liquidContracts
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 20);

    // Aggregate flow metrics across all contracts
    let totalSweeps = 0;
    let totalBlocks = 0;
    let totalBuyPressure = 0;
    let totalCallVolume = 0;
    let totalPutVolume = 0;
    let totalLargeTrades = 0;
    let totalTrades = 0;
    let hasUnusualActivity = false;

    for (const contract of topContracts) {
      const contractAny = contract as any;
      // If contract has trade tape data attached, use it
      if (contractAny.tradeTape) {
        const tape = contractAny.tradeTape;
        totalSweeps += tape.sweepCount || 0;
        totalBlocks += tape.blockCount || 0;
        totalBuyPressure += tape.buyPressure || 0;
        totalLargeTrades += tape.largeTradeCount || 0;

        if (tape.unusualActivity) {
          hasUnusualActivity = true;
        }

        // Aggregate volume by option type
        const optionType = contractAny.optionType || contract.contract_type;
        if (optionType === 'call') {
          totalCallVolume += contract.volume || 0;
        } else {
          totalPutVolume += contract.volume || 0;
        }

        totalTrades++;
      }
    }

    // If no trade tape data was found, return null
    if (totalTrades === 0) {
      return null;
    }

    // Calculate aggregate metrics
    const avgBuyPressure = totalBuyPressure / totalTrades;
    const callPutRatio = totalPutVolume > 0 ? totalCallVolume / totalPutVolume : 0;
    const avgTradeSize = totalVolume / topContracts.length;

    // Calculate flow score (0-100)
    // Sweeps are worth 15 points, blocks 10, large trades 3, unusual activity 20
    let flowScore = 0;
    flowScore += Math.min(totalSweeps * 15, 40); // Cap sweeps at 40 points
    flowScore += Math.min(totalBlocks * 10, 30);  // Cap blocks at 30 points
    flowScore += Math.min(totalLargeTrades * 3, 20); // Cap large trades at 20
    if (hasUnusualActivity) {
      flowScore += 10; // Bonus for unusual activity
    }
    flowScore = Math.min(Math.round(flowScore), 100);

    // Determine flow bias
    let flowBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    // If we have sweeps or blocks, use buy pressure to determine bias
    if (totalSweeps > 0 || totalBlocks > 0) {
      if (avgBuyPressure > 0.6) {
        flowBias = 'bullish';
      } else if (avgBuyPressure < 0.4) {
        flowBias = 'bearish';
      }
    } else if (callPutRatio > 1.5) {
      // More calls than puts
      flowBias = 'bullish';
    } else if (callPutRatio < 0.67) {
      // More puts than calls
      flowBias = 'bearish';
    }

    const metrics: AggregatedFlowMetrics = {
      sweepCount: totalSweeps,
      blockCount: totalBlocks,
      unusualActivity: hasUnusualActivity,
      flowScore,
      flowBias,
      buyPressure: avgBuyPressure,
      totalVolume,
      callVolume: totalCallVolume,
      putVolume: totalPutVolume,
      callPutRatio,
      avgTradeSize,
      largeTradeCount: totalLargeTrades,
      contractsAnalyzed: topContracts.length,
      timestamp: Date.now(),
      symbol,
    };

    // Cache the result
    flowCache.set(symbol, {
      data: metrics,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return metrics;
  } catch (error) {
    console.error(`[aggregate-flow] Error aggregating flow for ${symbol}:`, error);
    return null; // Graceful degradation
  }
}

/**
 * Clear flow cache for a specific symbol or all symbols
 */
export function clearFlowCache(symbol?: string): void {
  if (symbol) {
    flowCache.delete(symbol);
  } else {
    flowCache.clear();
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getFlowCacheStats(): {
  size: number;
  symbols: string[];
  oldestEntry: number | null;
} {
  const symbols = Array.from(flowCache.keys());
  const entries = Array.from(flowCache.values());
  const oldestEntry = entries.length > 0
    ? Math.min(...entries.map(e => e.expiry))
    : null;

  return {
    size: flowCache.size,
    symbols,
    oldestEntry,
  };
}

/**
 * Prune expired entries from cache
 */
export function pruneFlowCache(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  flowCache.forEach((entry, symbol) => {
    if (now >= entry.expiry) {
      toDelete.push(symbol);
    }
  });

  toDelete.forEach(symbol => flowCache.delete(symbol));
}
