// INDICES ADVANCED - Real-time index data with technical indicators
// Supports SPX, NDX, VIX, and other major indices

import { massiveClient } from './client';
import { fetchIndicators, IndicatorRequest, IndicatorResponse } from './indicators-api';
import { streamingManager } from './streaming-manager';

export interface IndexQuote {
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: number;
  asOf: string;
}

export interface IndexIndicators {
  ema8: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  vwap: number;
  macd: { value: number; signal: number; histogram: number };
  updatedAt: number;
}

export interface MacroContext {
  spx: {
    value: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    trendStrength: 'strong' | 'moderate' | 'weak';
    vwapRelation: 'above' | 'below' | 'at';
    emaAlignment: boolean; // True if 8>21>50>200
    rsiState: 'overbought' | 'oversold' | 'neutral';
    atrRegime: 'normal' | 'elevated' | 'low';
  };
  ndx: {
    value: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  vix: {
    value: number;
    trend: 'rising' | 'falling' | 'stable';
    level: 'low' | 'mid' | 'high'; // <15, 15-22, >22
    signal: string; // "VIX: Elevated (23) — tighten SL"
  };
  marketRegime: 'trending' | 'choppy' | 'volatile';
  riskBias: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
}

/**
 * Fetch index quote
 */
export async function fetchIndexQuote(symbol: string): Promise<IndexQuote> {
  console.log(`[IndicesAdvanced] Fetching quote for ${symbol}`);
  
  try {
    const data = await massiveClient.getIndex(symbol);
    
    return {
      symbol,
      value: data.value || 0,
      change: data.change || 0,
      changePercent: data.change_percent || 0,
      timestamp: data.updated || Date.now(),
      asOf: new Date(data.updated || Date.now()).toLocaleTimeString(),
    };
  } catch (error) {
    console.error(`[IndicesAdvanced] Failed to fetch ${symbol}:`, error);
    return {
      symbol,
      value: 0,
      change: 0,
      changePercent: 0,
      timestamp: Date.now(),
      asOf: 'N/A',
    };
  }
}

/**
 * Fetch index indicators
 */
export async function fetchIndexIndicators(symbol: string): Promise<IndexIndicators> {
  console.log(`[IndicesAdvanced] Fetching indicators for ${symbol}`);
  
  const request: IndicatorRequest = {
    ema: [8, 21, 50, 200],
    rsi: [14],
    atr: [14],
  };
  
  const indicators = await fetchIndicators(symbol, request, '1', 250);
  
  // Get latest values
  const ema8 = indicators.ema?.[8]?.slice(-1)[0] || 0;
  const ema21 = indicators.ema?.[21]?.slice(-1)[0] || 0;
  const ema50 = indicators.ema?.[50]?.slice(-1)[0] || 0;
  const ema200 = indicators.ema?.[200]?.slice(-1)[0] || 0;
  const rsi14 = indicators.rsi?.[14]?.slice(-1)[0] || 50;
  const atr14 = indicators.atr?.[14]?.slice(-1)[0] || 0;
  
  // Calculate VWAP (simplified - would need volume data from aggregates)
  const vwap = ema21; // Use EMA21 as proxy for now
  
  return {
    ema8,
    ema21,
    ema50,
    ema200,
    rsi14,
    atr14,
    vwap,
    macd: { value: 0, signal: 0, histogram: 0 }, // TODO: Add MACD calculation
    updatedAt: Date.now(),
  };
}

/**
 * Gather complete macro context
 */
export async function gatherMacroContext(): Promise<MacroContext> {
  console.log('[IndicesAdvanced] Gathering macro context (SPX, NDX, VIX)');
  
  const [spxQuote, ndxQuote, vixQuote, spxIndicators] = await Promise.all([
    fetchIndexQuote('SPX'),
    fetchIndexQuote('NDX'),
    fetchIndexQuote('VIX'),
    fetchIndexIndicators('SPX'),
  ]);
  
  // Analyze SPX
  const spxTrend = analyzeTrend(spxQuote.value, spxIndicators);
  const spxTrendStrength = analyzeTrendStrength(spxIndicators);
  const spxVwapRelation = spxQuote.value > spxIndicators.vwap ? 'above' : 
                          spxQuote.value < spxIndicators.vwap ? 'below' : 'at';
  const emaAlignment = spxIndicators.ema8 > spxIndicators.ema21 && 
                       spxIndicators.ema21 > spxIndicators.ema50 &&
                       spxIndicators.ema50 > spxIndicators.ema200;
  const rsiState = spxIndicators.rsi14 > 70 ? 'overbought' :
                   spxIndicators.rsi14 < 30 ? 'oversold' : 'neutral';
  
  // Compare ATR to recent average (simplified)
  const atrRegime = spxIndicators.atr14 > spxQuote.value * 0.015 ? 'elevated' :
                    spxIndicators.atr14 < spxQuote.value * 0.008 ? 'low' : 'normal';
  
  // Analyze NDX
  const ndxTrend = ndxQuote.changePercent > 0.5 ? 'bullish' :
                   ndxQuote.changePercent < -0.5 ? 'bearish' : 'neutral';
  
  // Analyze VIX
  const vixTrend = vixQuote.changePercent > 3 ? 'rising' :
                   vixQuote.changePercent < -3 ? 'falling' : 'stable';
  const vixLevel = vixQuote.value < 15 ? 'low' :
                   vixQuote.value > 22 ? 'high' : 'mid';
  const vixSignal = vixLevel === 'high' 
    ? `VIX: Elevated (${vixQuote.value.toFixed(1)}) — tighten SL`
    : vixLevel === 'low'
    ? `VIX: Low (${vixQuote.value.toFixed(1)}) — normal volatility`
    : `VIX: Moderate (${vixQuote.value.toFixed(1)})`;
  
  // Determine market regime
  const marketRegime = emaAlignment && atrRegime !== 'elevated' ? 'trending' :
                       atrRegime === 'elevated' ? 'volatile' : 'choppy';
  
  // Determine risk bias
  const riskBias = spxTrend === 'bullish' && ndxTrend === 'bullish' && vixLevel !== 'high' ? 'bullish' :
                   spxTrend === 'bearish' && ndxTrend === 'bearish' && vixLevel === 'high' ? 'bearish' : 'neutral';
  
  return {
    spx: {
      value: spxQuote.value,
      trend: spxTrend,
      trendStrength: spxTrendStrength,
      vwapRelation: spxVwapRelation,
      emaAlignment,
      rsiState,
      atrRegime,
    },
    ndx: {
      value: ndxQuote.value,
      trend: ndxTrend,
    },
    vix: {
      value: vixQuote.value,
      trend: vixTrend,
      level: vixLevel,
      signal: vixSignal,
    },
    marketRegime,
    riskBias,
    timestamp: Date.now(),
  };
}

/**
 * Analyze trend from indicators
 */
function analyzeTrend(
  currentPrice: number,
  indicators: IndexIndicators
): 'bullish' | 'bearish' | 'neutral' {
  // Price above EMA21 and EMA8 > EMA21 = bullish
  if (currentPrice > indicators.ema21 && indicators.ema8 > indicators.ema21) {
    return 'bullish';
  }
  // Price below EMA21 and EMA8 < EMA21 = bearish
  if (currentPrice < indicators.ema21 && indicators.ema8 < indicators.ema21) {
    return 'bearish';
  }
  return 'neutral';
}

/**
 * Analyze trend strength
 */
function analyzeTrendStrength(indicators: IndexIndicators): 'strong' | 'moderate' | 'weak' {
  // Strong: All EMAs aligned in order
  const bullishAlignment = indicators.ema8 > indicators.ema21 && 
                          indicators.ema21 > indicators.ema50 &&
                          indicators.ema50 > indicators.ema200;
  const bearishAlignment = indicators.ema8 < indicators.ema21 && 
                          indicators.ema21 < indicators.ema50 &&
                          indicators.ema50 < indicators.ema200;
  
  if (bullishAlignment || bearishAlignment) return 'strong';
  
  // Moderate: Some alignment
  const someAlignment = indicators.ema8 > indicators.ema21 || indicators.ema21 > indicators.ema50;
  if (someAlignment) return 'moderate';
  
  return 'weak';
}

/**
 * Format macro context as UI pills
 */
export function formatMacroContextPills(macro: MacroContext): Array<{
  label: string;
  variant: 'positive' | 'negative' | 'neutral' | 'warning';
}> {
  const pills: Array<{ label: string; variant: 'positive' | 'negative' | 'neutral' | 'warning' }> = [];
  
  // SPX VWAP
  if (macro.spx.vwapRelation === 'above') {
    pills.push({ label: 'SPX: Above VWAP', variant: 'positive' });
  } else if (macro.spx.vwapRelation === 'below') {
    pills.push({ label: 'SPX: Below VWAP', variant: 'negative' });
  }
  
  // SPX Trend
  if (macro.spx.emaAlignment) {
    pills.push({ 
      label: `SPX Trend: ${macro.spx.trend === 'bullish' ? 'Bullish' : 'Bearish'} (8>21>50)`, 
      variant: macro.spx.trend === 'bullish' ? 'positive' : 'negative' 
    });
  }
  
  // VIX
  pills.push({ 
    label: macro.vix.signal, 
    variant: macro.vix.level === 'high' ? 'warning' : 'neutral' 
  });
  
  // Macro Trend Strength
  if (macro.spx.trendStrength === 'strong') {
    pills.push({ label: 'Macro: High Trend Strength', variant: 'positive' });
  }
  
  return pills;
}
