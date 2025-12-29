/**
 * useLoadedTradeLiveModel - Canonical Live Model for LOADED/Setup State
 *
 * This hook provides a single source of truth for all metrics displayed
 * in the LOADED middle column during contract selection/setup.
 *
 * Data Sources:
 * - Underlying price: Tradier REST via useQuotes (fast polling)
 * - Option quotes: Massive WS (primary) or REST fallback via useActiveTradePnL
 * - Greeks: useLiveGreeks (30s polling)
 *
 * Outputs:
 * - Live option quote (bid/ask/mid/effectiveMid)
 * - Derived execution metrics (spread, liquidity grade, slippage)
 * - Live Greeks (delta, gamma, theta, vega, iv)
 * - Underlying price
 * - Data health indicators
 */

import { useMemo } from "react";
import type { Contract } from "../types";
import { useQuotes, useActiveTradePnL } from "./useMassiveData";
import { useLiveGreeks } from "./useOptionsAdvanced";
import {
  type DataHealth,
  type DataSource,
  THRESHOLDS,
  getFreshnessInfo,
  getCombinedHealth,
  shouldDisableExecution,
} from "../lib/market/dataFreshness";
import {
  type LiquidityGrade,
  type ContractQualityMetrics,
  calculateContractQuality,
  formatSpreadPct,
  formatSlippageRange,
  getLiquidityGradeStyle,
} from "../lib/market/contractQuality";

// ============================================================================
// Types
// ============================================================================

export interface UnderlyingQuote {
  price: number;
  change: number;
  changePercent: number;
  asOf: number;
  source: DataSource;
  isStale: boolean;
}

export interface OptionQuote {
  bid: number;
  ask: number;
  mid: number;
  effectiveMid: number;
  last: number;
  asOf: number;
  source: DataSource;
  isStale: boolean;
}

export interface LiveGreeksData {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  asOf: number;
  source: "live" | "static";
}

export interface ExecutionMetrics {
  spreadAbs: number;
  spreadPct: number;
  spreadPctFormatted: string;
  liquidityGrade: LiquidityGrade;
  liquidityStyle: ReturnType<typeof getLiquidityGradeStyle>;
  expectedSlippageMin: number;
  expectedSlippageMax: number;
  slippageFormatted: string;
  isWideSpread: boolean;
  warnings: string[];
}

export interface LoadedTradeLiveModel {
  // Core data
  underlying: UnderlyingQuote;
  option: OptionQuote;
  greeks: LiveGreeksData;
  execution: ExecutionMetrics;

  // Contract reference
  contract: Contract | null;
  contractTicker: string | null;

  // Health status
  overallHealth: DataHealth;
  isExecutionDisabled: boolean;
  healthWarnings: string[];

  // Formatted values for display
  formatted: {
    effectiveMid: string;
    underlyingPrice: string;
    delta: string;
    spreadPct: string;
    liquidityGrade: string;
    slippage: string;
  };
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_UNDERLYING: UnderlyingQuote = {
  price: 0,
  change: 0,
  changePercent: 0,
  asOf: 0,
  source: "none",
  isStale: true,
};

const DEFAULT_OPTION: OptionQuote = {
  bid: 0,
  ask: 0,
  mid: 0,
  effectiveMid: 0,
  last: 0,
  asOf: 0,
  source: "none",
  isStale: true,
};

const DEFAULT_GREEKS: LiveGreeksData = {
  delta: 0,
  gamma: 0,
  theta: 0,
  vega: 0,
  iv: 0,
  asOf: 0,
  source: "static",
};

const DEFAULT_EXECUTION: ExecutionMetrics = {
  spreadAbs: 0,
  spreadPct: 0,
  spreadPctFormatted: "—",
  liquidityGrade: "C",
  liquidityStyle: getLiquidityGradeStyle("C"),
  expectedSlippageMin: 0,
  expectedSlippageMax: 0,
  slippageFormatted: "—",
  isWideSpread: false,
  warnings: [],
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useLoadedTradeLiveModel(
  symbol: string | null,
  contract: Contract | null
): LoadedTradeLiveModel {
  // Get contract ticker for streaming
  const contractTicker = contract?.id || contract?.ticker || contract?.symbol || null;

  // ========================================================================
  // Underlying Quote (Tradier REST via useQuotes)
  // ========================================================================
  const symbolsToFetch = useMemo(() => (symbol ? [symbol] : []), [symbol]);
  const { quotes: underlyingQuotes } = useQuotes(symbolsToFetch);

  const underlying = useMemo((): UnderlyingQuote => {
    if (!symbol) return DEFAULT_UNDERLYING;

    const quote = underlyingQuotes.get(symbol);
    if (!quote) return DEFAULT_UNDERLYING;

    const freshness = getFreshnessInfo(quote.asOf, quote.source, THRESHOLDS.UNDERLYING);

    return {
      price: quote.last || 0,
      change: quote.change || 0,
      changePercent: quote.changePercent || 0,
      asOf: quote.asOf,
      source: quote.source,
      isStale: freshness.isStale,
    };
  }, [symbol, underlyingQuotes]);

  // ========================================================================
  // Option Quote (Massive WS/REST via useActiveTradePnL)
  // ========================================================================
  // Use entryPrice of 0 since we're just tracking current price, not P&L
  const {
    currentPrice: optionPrice,
    bid: optionBid,
    ask: optionAsk,
    asOf: optionAsOf,
    source: optionSource,
    isStale: optionIsStale,
  } = useActiveTradePnL(null, contractTicker, 0); // null tradeId = WATCHING state (no DB persistence)

  const option = useMemo((): OptionQuote => {
    if (!contract) return DEFAULT_OPTION;

    const freshness = getFreshnessInfo(optionAsOf, optionSource, THRESHOLDS.OPTION);

    // Use live price if available, otherwise fall back to contract snapshot
    const liveBid = optionBid > 0 ? optionBid : contract.bid || 0;
    const liveAsk = optionAsk > 0 ? optionAsk : contract.ask || 0;
    const liveMid = optionPrice > 0 ? optionPrice : contract.mid || 0;

    // effectiveMid: prefer live mid, then live price, then snapshot mid
    const midFromLive = liveBid > 0 && liveAsk > 0 ? (liveBid + liveAsk) / 2 : 0;
    const effectiveMid =
      midFromLive > 0 ? midFromLive : optionPrice > 0 ? optionPrice : contract.mid || 0;

    return {
      bid: liveBid,
      ask: liveAsk,
      mid: liveMid,
      effectiveMid,
      last: optionPrice,
      asOf: optionAsOf > 0 ? optionAsOf : Date.now(),
      source: optionPrice > 0 || midFromLive > 0 ? optionSource : "static",
      isStale: optionPrice > 0 || midFromLive > 0 ? optionIsStale : true,
    };
  }, [contract, optionPrice, optionBid, optionAsk, optionAsOf, optionSource, optionIsStale]);

  // ========================================================================
  // Live Greeks (polling via useLiveGreeks)
  // ========================================================================
  const staticGreeks = useMemo(
    () => ({
      delta: contract?.delta,
      gamma: contract?.gamma,
      theta: contract?.theta,
      vega: contract?.vega,
      iv: contract?.iv,
    }),
    [contract?.delta, contract?.gamma, contract?.theta, contract?.vega, contract?.iv]
  );

  const liveGreeksData = useLiveGreeks(contractTicker, staticGreeks, 30000);

  const greeks = useMemo((): LiveGreeksData => {
    return {
      delta: liveGreeksData.delta ?? 0,
      gamma: liveGreeksData.gamma ?? 0,
      theta: liveGreeksData.theta ?? 0,
      vega: liveGreeksData.vega ?? 0,
      iv: liveGreeksData.iv ?? 0,
      asOf: liveGreeksData.lastUpdate || 0,
      source: liveGreeksData.source,
    };
  }, [liveGreeksData]);

  // ========================================================================
  // Execution Metrics (derived from option quote)
  // ========================================================================
  const execution = useMemo((): ExecutionMetrics => {
    if (!contract || option.bid <= 0 || option.ask <= 0) {
      return DEFAULT_EXECUTION;
    }

    const quality = calculateContractQuality(option.bid, option.ask, option.effectiveMid);
    if (!quality) return DEFAULT_EXECUTION;

    return {
      ...quality,
      spreadPctFormatted: formatSpreadPct(quality.spreadPct),
      liquidityStyle: getLiquidityGradeStyle(quality.liquidityGrade),
      slippageFormatted: formatSlippageRange(
        quality.expectedSlippageMin,
        quality.expectedSlippageMax
      ),
    };
  }, [contract, option.bid, option.ask, option.effectiveMid]);

  // ========================================================================
  // Health Aggregation
  // ========================================================================
  const overallHealth = useMemo((): DataHealth => {
    const optionHealth: DataHealth = option.isStale ? "stale" : "healthy";
    const underlyingHealth: DataHealth = underlying.isStale ? "degraded" : "healthy";
    return getCombinedHealth(optionHealth, underlyingHealth);
  }, [option.isStale, underlying.isStale]);

  const isExecutionDisabled = shouldDisableExecution(overallHealth);

  const healthWarnings = useMemo((): string[] => {
    const warnings: string[] = [];
    if (option.isStale && option.source !== "none") {
      warnings.push("Option data may be stale");
    }
    if (underlying.isStale && underlying.source !== "none") {
      warnings.push("Underlying price may be stale");
    }
    if (execution.warnings.length > 0) {
      warnings.push(...execution.warnings);
    }
    return warnings;
  }, [option.isStale, option.source, underlying.isStale, underlying.source, execution.warnings]);

  // ========================================================================
  // Formatted Values
  // ========================================================================
  const formatted = useMemo(
    () => ({
      effectiveMid: option.effectiveMid > 0 ? `$${option.effectiveMid.toFixed(2)}` : "—",
      underlyingPrice: underlying.price > 0 ? `$${underlying.price.toFixed(2)}` : "—",
      delta: greeks.delta !== 0 ? greeks.delta.toFixed(2) : "—",
      spreadPct: execution.spreadPctFormatted,
      liquidityGrade: execution.liquidityGrade,
      slippage: execution.slippageFormatted,
    }),
    [
      option.effectiveMid,
      underlying.price,
      greeks.delta,
      execution.spreadPctFormatted,
      execution.liquidityGrade,
      execution.slippageFormatted,
    ]
  );

  // ========================================================================
  // Return Model
  // ========================================================================
  return {
    underlying,
    option,
    greeks,
    execution,
    contract,
    contractTicker,
    overallHealth,
    isExecutionDisabled,
    healthWarnings,
    formatted,
  };
}

export default useLoadedTradeLiveModel;
