/**
 * marketDataStore.ts - Single Source of Truth for Market Data
 * 
 * Consolidates all market data streams (candles, indicators, signals, confluence)
 * into one Zustand store powered by Massive.com WebSocket (Options + Indices Advanced).
 * 
 * Features:
 * - WebSocket streams for indices (AM/A) and options elsewhere
 * - Multi-timeframe candles with automatic aggregation
 * - Lazy indicator calculation (computed once per update)
 * - Strategy signal integration
 * - Confluence scoring from multiple sources
 * 
 * All components should read from this store instead of calculating locally.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { produce } from 'immer';
import { Bar } from '../types/shared';
import { MassiveSubscriptionManager } from '../lib/massive/subscriptionManager';
import { StrategySignal } from '../types/strategy';
import { 
  calculateEMA, 
  calculateVWAP, 
  rsiWilder,
  atrWilder,
  calculateBollingerBands,
} from '../lib/indicators';

// ============================================================================
// Types
// ============================================================================

export type Timeframe = '1m' | '5m' | '15m' | '60m' | '1D';
export type MTFTrend = 'bull' | 'bear' | 'neutral';
export type MarketStatus = 'premarket' | 'open' | 'afterhours' | 'closed';

// Enriched market session with timing data (for TraderHeader, etc.)
export interface EnrichedMarketSession {
  session: 'PRE' | 'OPEN' | 'POST' | 'CLOSED';
  isOpen: boolean;
  isWeekend: boolean;
  nextOpen: number;    // Unix timestamp ms
  nextClose: number;   // Unix timestamp ms
  serverTime: string;  // ISO timestamp
  label: string;       // Display label
  asOf: string;        // ISO timestamp of last update
}

export interface Candle {
  time: number;        // Epoch ms - matches Bar interface from indicators.ts
  timestamp?: number;  // Alias for compatibility
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface Indicators {
  // Moving averages
  ema9?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  
  // Momentum
  rsi14?: number;
  macd?: { value: number; signal: number; histogram: number };
  
  // Volatility
  atr14?: number;
  bollingerBands?: { upper: number; middle: number; lower: number };
  
  // Volume
  vwap?: number;
  vwapUpperBand?: number;
  vwapLowerBand?: number;
  
  // Trend
  adx?: number;
  
  // Price action
  pivots?: {
    r3: number;
    r2: number;
    r1: number;
    pivot: number;
    s1: number;
    s2: number;
    s3: number;
  };
}

export interface ConfluenceScore {
  overall: number; // 0-100
  trend: number;
  momentum: number;
  volatility: number;
  volume: number;
  technical: number;
  components: {
    trendAlignment: boolean;
    aboveVWAP: boolean;
    rsiConfirm: boolean;
    volumeConfirm: boolean;
    supportResistance: boolean;
  };
  lastUpdated: number;
}

export interface SymbolData {
  symbol: string;
  
  // Multi-timeframe candles
  candles: Record<Timeframe, Candle[]>;
  
  // Latest indicators (computed from primary timeframe)
  indicators: Indicators;
  
  // Multi-timeframe trend
  mtfTrend: Record<Timeframe, MTFTrend>;
  
  // Confluence scoring
  confluence: ConfluenceScore;
  
  // Strategy signals
  strategySignals: StrategySignal[];
  
  // Metadata
  lastUpdated: number;
  isSubscribed: boolean;
  primaryTimeframe: Timeframe; // Which timeframe to use for indicators
}

export interface WebSocketConnection {
  socket: WebSocket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';
  reconnectAttempts: number;
  lastError?: string;
  lastMessageTime: number;
}

interface MarketDataStore {
  // ========================================================================
  // State
  // ========================================================================
  
  /** Map of symbol → data (SPY, QQQ, SPX, etc.) */
  symbols: Record<string, SymbolData>;
  
  /** Unified WebSocket manager */
  wsManager: MassiveSubscriptionManager | null;
  
  /** WebSocket connection (single for stocks) */
  wsConnection: WebSocketConnection;
  
  /** Global connection state */
  isConnected: boolean;
  lastServerTimestamp: number;
  
  /** Market status (legacy simple enum) */
  marketStatus: MarketStatus;
  
  /** Enriched market session with timing data */
  enrichedSession: EnrichedMarketSession | null;
  
  /** Subscribed symbols */
  subscribedSymbols: Set<string>;
  
  /** Macro indices to always subscribe */
  macroSymbols: string[];
  
  /** Loading state */
  isInitializing: boolean;
  
  /** Last error */
  error: string | null;
  
  /** Heartbeat interval */
  heartbeatInterval: any;

  /** Unsubscribe fns for active WS subscriptions */
  unsubscribers: Array<() => void>;
  
  // ========================================================================
  // Actions
  // ========================================================================
  
  /** Initialize WebSocket connections and subscribe to watchlist */
  initialize: (watchlistSymbols: string[]) => void;
  
  /** Fetch historical bars for symbols */
  fetchHistoricalBars: (symbols: string[]) => Promise<void>;
  
  /** Connect to WebSocket */
  connectWebSocket: () => void;
  
  /** Schedule reconnection with backoff */
  scheduleReconnect: () => void;
  
  /** Subscribe to all symbols after authentication */
  subscribeToSymbols: () => void;
  
  /** Handle aggregate bar message */
  handleAggregateBar: (msg: MassiveAggregateMessage) => void;
  
  /** Subscribe to additional symbol */
  subscribe: (symbol: string) => void;
  
  /** Unsubscribe from symbol */
  unsubscribe: (symbol: string) => void;
  
  /** Update candles for a symbol/timeframe */
  updateCandles: (symbol: string, timeframe: Timeframe, candles: Candle[]) => void;
  
  /** Merge new bar into existing candles (snapshot + delta pattern) */
  mergeBar: (symbol: string, timeframe: Timeframe, bar: Candle) => void;
  
  /** Recompute indicators for a symbol */
  recomputeIndicators: (symbol: string) => void;
  
  /** Comprehensive recompute: indicators + MTF trends + confluence + strategies */
  recomputeSymbol: (symbol: string) => void;
  
  /** Update confluence score */
  updateConfluence: (symbol: string, confluence: Partial<ConfluenceScore>) => void;
  
  /** Add strategy signal */
  addStrategySignal: (symbol: string, signal: StrategySignal) => void;
  
  /** Update market status (legacy) */
  setMarketStatus: (status: MarketStatus) => void;
  
  /** Update enriched market session */
  updateMarketSession: (session: EnrichedMarketSession) => void;
  
  /** Fetch and update market session from Massive API */
  fetchMarketSession: () => Promise<void>;
  
  /** Cleanup connections */
  cleanup: () => void;
  
  // ========================================================================
  // Selectors (for React components)
  // ========================================================================
  
  /** Get all data for a symbol */
  getSymbolData: (symbol: string) => SymbolData | undefined;
  
  /** Get candles for specific timeframe */
  getCandles: (symbol: string, timeframe: Timeframe) => Candle[];
  
  /** Get latest indicators */
  getIndicators: (symbol: string) => Indicators;
  
  /** Get confluence score */
  getConfluence: (symbol: string) => ConfluenceScore | undefined;
  
  /** Get strategy signals */
  getStrategySignals: (symbol: string) => StrategySignal[];
  
  /** Get MTF trend analysis */
  getMTFTrend: (symbol: string) => Record<Timeframe, MTFTrend>;
  
  /** Check if data is stale */
  isStale: (symbol: string, maxAgeMs?: number) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

// Pure indices mode for macro; equities removed
const MACRO_SYMBOLS = ['SPX', 'NDX', 'VIX'];
const DEFAULT_PRIMARY_TIMEFRAME: Timeframe = '1m';
const MAX_CANDLES_PER_TIMEFRAME = 500; // Memory limit
const STALE_THRESHOLD_MS = 10000; // 10 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 25000; // 25 seconds

// Stocks socket deprecated in pure options+indices mode

/** Roll up 1m bars into higher timeframes (5m, 15m, 60m) */
function rollupBars(bars1m: Candle[], targetTF: Timeframe): Candle[] {
  if (bars1m.length === 0) return [];
  
  const minutesPerBar = targetTF === '5m' ? 5 : targetTF === '15m' ? 15 : targetTF === '60m' ? 60 : 1;
  if (minutesPerBar === 1) return bars1m;
  
  const rolled: Candle[] = [];
  let currentBar: Candle | null = null;
  
  for (const bar of bars1m) {
    const barTime = bar.time || bar.timestamp || 0;
    const barMinute = Math.floor(barTime / 60000) * 60000;
    const bucketStart = Math.floor(barMinute / (minutesPerBar * 60000)) * (minutesPerBar * 60000);
    
    if (!currentBar || (currentBar.time !== bucketStart)) {
      // Start new bucket
      if (currentBar) rolled.push(currentBar);
      currentBar = {
        time: bucketStart,
        timestamp: bucketStart,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        vwap: bar.vwap,
        trades: bar.trades || 0,
      };
    } else {
      // Update existing bucket
      currentBar.high = Math.max(currentBar.high, bar.high);
      currentBar.low = Math.min(currentBar.low, bar.low);
      currentBar.close = bar.close;
      currentBar.volume += bar.volume;
      if (bar.trades) currentBar.trades = (currentBar.trades || 0) + bar.trades;
      // VWAP: weighted average (simplified)
      if (bar.vwap && currentBar.vwap) {
        currentBar.vwap = (currentBar.vwap + bar.vwap) / 2;
      } else if (bar.vwap) {
        currentBar.vwap = bar.vwap;
      }
    }
  }
  
  if (currentBar) rolled.push(currentBar);
  return rolled;
}

/** Create empty symbol data */
function createEmptySymbolData(symbol: string): SymbolData {
  return {
    symbol,
    candles: {
      '1m': [],
      '5m': [],
      '15m': [],
      '60m': [],
      '1D': [],
    },
    indicators: {},
    mtfTrend: {
      '1m': 'neutral',
      '5m': 'neutral',
      '15m': 'neutral',
      '60m': 'neutral',
      '1D': 'neutral',
    },
    confluence: {
      overall: 0,
      trend: 0,
      momentum: 0,
      volatility: 0,
      volume: 0,
      technical: 0,
      components: {
        trendAlignment: false,
        aboveVWAP: false,
        rsiConfirm: false,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    },
    strategySignals: [],
    lastUpdated: Date.now(),
    isSubscribed: false,
    primaryTimeframe: DEFAULT_PRIMARY_TIMEFRAME,
  };
}

/** Calculate indicators from candle array */
function computeIndicatorsFromCandles(candles: Candle[]): Indicators {
  if (candles.length === 0) return {};
  
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  // EMA calculations
  const ema9Array = calculateEMA(closes, 9);
  const ema20Array = calculateEMA(closes, 20);
  const ema50Array = calculateEMA(closes, 50);
  const ema200Array = calculateEMA(closes, 200);
  
  // RSI calculation
  const rsi14Array = rsiWilder(closes, 14);
  
  // VWAP calculation - ensure candles have 'time' field for Bar compatibility
  const barsWithTime = candles.map(c => ({
    ...c,
    time: c.time || c.timestamp || 0
  }));
  const vwapArray = calculateVWAP(barsWithTime);
  
  // Get latest values (last element)
  const lastIdx = candles.length - 1;
  
  return {
    ema9: ema9Array[lastIdx],
    ema20: ema20Array[lastIdx],
    ema50: ema50Array[lastIdx],
    ema200: ema200Array[lastIdx],
    rsi14: rsi14Array[lastIdx],
    vwap: vwapArray[lastIdx],
    // TODO: Add ATR, Bollinger Bands, MACD, ADX, Pivots when needed
  };
}

/** Determine trend from indicators */
function determineTrend(candles: Candle[], indicators: Indicators): MTFTrend {
  if (candles.length === 0) return 'neutral';
  
  const lastClose = candles[candles.length - 1].close;
  const { ema9, ema20, ema50 } = indicators;
  
  // Simple trend logic: price above EMAs = bull, below = bear
  if (ema9 && ema20 && ema50) {
    if (lastClose > ema9 && ema9 > ema20 && ema20 > ema50) {
      return 'bull';
    }
    if (lastClose < ema9 && ema9 < ema20 && ema20 < ema50) {
      return 'bear';
    }
  }
  
  return 'neutral';
}

/** Calculate confluence score from market data */
function calculateConfluence(
  symbol: string,
  candles: Candle[],
  indicators: Indicators,
  mtfTrend: Record<Timeframe, MTFTrend>
): ConfluenceScore {
  if (candles.length === 0) {
    return {
      overall: 0,
      trend: 0,
      momentum: 0,
      volatility: 0,
      volume: 0,
      technical: 0,
      components: {
        trendAlignment: false,
        aboveVWAP: false,
        rsiConfirm: false,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    };
  }

  const lastClose = candles[candles.length - 1].close;
  const { ema9, ema20, ema50, vwap, rsi14 } = indicators;

  // Component checks
  const trendAlignment = mtfTrend['5m'] === mtfTrend['15m'] && mtfTrend['15m'] === mtfTrend['60m'];
  const aboveVWAP = vwap ? lastClose > vwap : false;
  const rsiConfirm = rsi14 ? (rsi14 > 40 && rsi14 < 70) : false;
  const supportResistance = ema9 && ema20 && ema50 ? (ema9 > ema20 && ema20 > ema50) : false;
  const volumeConfirm = candles.length > 1 ? candles[candles.length - 1].volume > candles[candles.length - 2].volume : false;

  // Score components (0-100)
  const trend = trendAlignment ? 100 : 50;
  const momentum = rsiConfirm ? 100 : 50;
  const volatility = 50; // Placeholder
  const volume = volumeConfirm ? 100 : 50;
  const technical = supportResistance ? 100 : 50;

  const overall = Math.round((trend + momentum + volatility + volume + technical) / 5);

  return {
    overall,
    trend,
    momentum,
    volatility,
    volume,
    technical,
    components: {
      trendAlignment,
      aboveVWAP,
      rsiConfirm,
      volumeConfirm,
      supportResistance,
    },
    lastUpdated: Date.now(),
  };
}

/** Get Massive API key from environment */
function getMassiveApiKey(): string {
  // In production, this would come from a secure token endpoint
  // For now, we'll use the proxy token pattern
  return import.meta.env.VITE_MASSIVE_PROXY_TOKEN || '';
}

/** Parse Massive.com aggregate bar message */
interface MassiveAggregateMessage {
  ev: 'AM';  // Aggregate Minute
  sym: string;
  v: number;  // volume
  av: number; // accumulated volume
  op: number; // open
  vw: number; // VWAP
  o: number;  // open
  c: number;  // close
  h: number;  // high
  l: number;  // low
  a: number;  // average/vwap
  s: number;  // start timestamp (ms)
  e: number;  // end timestamp (ms)
  n: number;  // number of trades
}

/** Map Massive aggregate to our Candle format */
function parseAggregateBar(msg: MassiveAggregateMessage, timeframe: Timeframe): Candle {
  return {
    time: msg.s,
    timestamp: msg.s,
    open: msg.o,
    high: msg.h,
    low: msg.l,
    close: msg.c,
    volume: msg.v,
    vwap: msg.vw || msg.a,
    trades: msg.n,
  };
}

/** Determine timeframe from timestamp difference */
function detectTimeframe(startMs: number, endMs: number): Timeframe {
  const diffMs = endMs - startMs;
  const diffMin = Math.round(diffMs / 60000);
  
  if (diffMin <= 1) return '1m';
  if (diffMin <= 5) return '5m';
  if (diffMin <= 15) return '15m';
  if (diffMin <= 60) return '60m';
  return '1D';
}

/** Calculate comprehensive indicators from multiple timeframes */
function calculateComprehensiveIndicators(symbolData: SymbolData): Indicators {
  // Use primary timeframe (default 5m) for main indicators
  const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
  if (primaryCandles.length === 0) return {};
  
  const closes = primaryCandles.map(c => c.close);
  const highs = primaryCandles.map(c => c.high);
  const lows = primaryCandles.map(c => c.low);
  
  // EMA calculations
  const ema9Array = calculateEMA(closes, 9);
  const ema20Array = calculateEMA(closes, 20);
  const ema50Array = calculateEMA(closes, 50);
  const ema200Array = calculateEMA(closes, 200);
  
  // RSI calculation
  const rsi14Array = rsiWilder(closes, 14);
  
  // ATR calculation
  const atr14Array = atrWilder(highs, lows, closes, 14);
  
  // VWAP calculation (session-based)
  const barsWithTime = primaryCandles.map(c => ({
    ...c,
    time: c.time || c.timestamp || 0
  }));
  const vwapArray = calculateVWAP(barsWithTime);
  
  // Bollinger Bands
  const { upper, middle, lower } = calculateBollingerBands(closes, 20, 2);
  
  // Get latest values (last element)
  const lastIdx = primaryCandles.length - 1;
  
  return {
    ema9: ema9Array[lastIdx],
    ema20: ema20Array[lastIdx],
    ema50: ema50Array[lastIdx],
    ema200: ema200Array[lastIdx],
    rsi14: rsi14Array[lastIdx],
    atr14: atr14Array[lastIdx],
    vwap: vwapArray[lastIdx],
    bollingerBands: {
      upper: upper[lastIdx],
      middle: middle[lastIdx],
      lower: lower[lastIdx],
    },
  };
}

/** Calculate MTF trend alignment across all timeframes */
function calculateMTFTrends(symbolData: SymbolData): Record<Timeframe, MTFTrend> {
  const mtfTrend: Record<Timeframe, MTFTrend> = {} as Record<Timeframe, MTFTrend>;
  
  (['1m', '5m', '15m', '60m', '1D'] as Timeframe[]).forEach(tf => {
    const tfCandles = symbolData.candles[tf];
    if (tfCandles.length === 0) {
      mtfTrend[tf] = 'neutral';
      return;
    }
    
    const closes = tfCandles.map(c => c.close);
    const ema9 = calculateEMA(closes, 9);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    
    const lastIdx = closes.length - 1;
    const lastClose = closes[lastIdx];
    const lastEma9 = ema9[lastIdx];
    const lastEma20 = ema20[lastIdx];
    const lastEma50 = ema50[lastIdx];
    
    // Determine trend: price and EMAs aligned
    if (lastEma9 && lastEma20 && lastEma50) {
      if (lastClose > lastEma9 && lastEma9 > lastEma20 && lastEma20 > lastEma50) {
        mtfTrend[tf] = 'bull';
      } else if (lastClose < lastEma9 && lastEma9 < lastEma20 && lastEma20 < lastEma50) {
        mtfTrend[tf] = 'bear';
      } else {
        mtfTrend[tf] = 'neutral';
      }
    } else {
      mtfTrend[tf] = 'neutral';
    }
  });
  
  return mtfTrend;
}

/** Calculate confluence score exactly like useConfluenceData does */
function calculateAdvancedConfluence(
  symbol: string,
  symbolData: SymbolData,
  indicators: Indicators,
  mtfTrend: Record<Timeframe, MTFTrend>
): ConfluenceScore {
  const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
  
  if (primaryCandles.length === 0) {
    return {
      overall: 0,
      trend: 0,
      momentum: 0,
      volatility: 0,
      volume: 0,
      technical: 0,
      components: {
        trendAlignment: false,
        aboveVWAP: false,
        rsiConfirm: false,
        volumeConfirm: false,
        supportResistance: false,
      },
      lastUpdated: Date.now(),
    };
  }
  
  const lastCandle = primaryCandles[primaryCandles.length - 1];
  const lastClose = lastCandle.close;
  const { vwap, rsi14, ema9, ema20, atr14, bollingerBands } = indicators;
  
  // ===== Component Checks (matching useConfluenceData patterns) =====
  
  // 1. Trend Alignment: multiple timeframes agree
  const bullCount = Object.values(mtfTrend).filter(t => t === 'bull').length;
  const bearCount = Object.values(mtfTrend).filter(t => t === 'bear').length;
  const trendAlignment = (bullCount >= 3) || (bearCount >= 3);
  const primaryTrendBullish = mtfTrend[symbolData.primaryTimeframe] === 'bull';
  
  // 2. Price above VWAP (bullish signal)
  const aboveVWAP = vwap ? lastClose > vwap : false;
  
  // 3. RSI confirmation (not overbought/oversold)
  const rsiConfirm = rsi14 ? (rsi14 > 30 && rsi14 < 70) : false;
  const rsiStrong = rsi14 ? (primaryTrendBullish ? rsi14 > 50 : rsi14 < 50) : false;
  
  // 4. Volume confirmation (above average)
  const recentVolumes = primaryCandles.slice(-20).map(c => c.volume);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const volumeConfirm = lastCandle.volume > avgVolume * 1.2;
  
  // 5. Support/Resistance near EMA levels
  const nearEma20 = ema20 ? Math.abs(lastClose - ema20) / lastClose < 0.01 : false;
  const nearEma50 = ema9 && ema20 ? Math.abs(ema9 - ema20) / ema20 < 0.005 : false;
  const supportResistance = nearEma20 || nearEma50;
  
  // 6. Volatility assessment (Bollinger Bands)
  const bbWidth = bollingerBands && bollingerBands.upper && bollingerBands.lower
    ? (bollingerBands.upper - bollingerBands.lower) / lastClose
    : 0;
  const lowVolatility = bbWidth < 0.02; // Narrow bands = low volatility
  const highVolatility = bbWidth > 0.05; // Wide bands = high volatility
  
  // ===== Score Calculations (0-100 scale) =====
  
  // Trend score: weighted by timeframe agreement + direction
  let trendScore = 50;
  if (trendAlignment) {
    trendScore = primaryTrendBullish ? 85 : 15; // Strong bull or bear
  } else if (mtfTrend['5m'] === mtfTrend['15m']) {
    trendScore = mtfTrend['5m'] === 'bull' ? 70 : 30; // Moderate agreement
  }
  
  // Momentum score: RSI + EMA positioning
  let momentumScore = 50;
  if (rsiConfirm && rsiStrong) {
    momentumScore = 80;
  } else if (rsiConfirm) {
    momentumScore = 65;
  } else if (rsi14 && (rsi14 < 30 || rsi14 > 70)) {
    momentumScore = 30; // Overbought/oversold
  }
  
  // Volatility score: prefer moderate volatility
  let volatilityScore = 50;
  if (lowVolatility) {
    volatilityScore = 40; // Too quiet, breakout potential but risky
  } else if (highVolatility) {
    volatilityScore = 35; // Too wild, hard to manage
  } else {
    volatilityScore = 75; // Sweet spot
  }
  
  // Volume score: higher is better
  const volumeScore = volumeConfirm ? 80 : 45;
  
  // Technical score: VWAP + support/resistance
  let technicalScore = 50;
  if (aboveVWAP && supportResistance) {
    technicalScore = 85;
  } else if (aboveVWAP || supportResistance) {
    technicalScore = 65;
  } else if (!aboveVWAP && !supportResistance) {
    technicalScore = 35;
  }
  
  // ===== Weighted Average (matching real trading priorities) =====
  const overall = Math.round(
    trendScore * 0.30 +      // Trend is king
    momentumScore * 0.25 +   // Momentum confirms
    technicalScore * 0.20 +  // Levels matter
    volumeScore * 0.15 +     // Volume validates
    volatilityScore * 0.10   // Volatility context
  );
  
  return {
    overall,
    trend: trendScore,
    momentum: momentumScore,
    volatility: volatilityScore,
    volume: volumeScore,
    technical: technicalScore,
    components: {
      trendAlignment,
      aboveVWAP,
      rsiConfirm,
      volumeConfirm,
      supportResistance,
    },
    lastUpdated: Date.now(),
  };
}

/** Run strategy signals (placeholder - integrate with actual strategy engine) */
function runStrategySignals(
  symbol: string,
  symbolData: SymbolData,
  indicators: Indicators,
  confluence: ConfluenceScore
): StrategySignal[] {
  const signals: StrategySignal[] = [];
  
  // Simple pattern detection for immediate feedback (useStrategyScanner handles full strategies)
  const { ema9, ema20, rsi14 } = indicators;
  const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
  const strategyDebug = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  const log = (msg: string, extra?: any) => {
    if (strategyDebug) {
      if (extra) console.log(`[v0][Strategy] ${msg}`, extra); else console.log(`[v0][Strategy] ${msg}`);
    }
  };

  const startTs = Date.now();
  log(`Checking signals for ${symbol}` , {
    candleCount: primaryCandles.length,
    lastClose: primaryCandles[primaryCandles.length - 1]?.close,
    ema9: ema9?.toFixed(4),
    ema20: ema20?.toFixed(4),
    rsi14: rsi14?.toFixed(2),
    confluenceOverall: confluence.overall,
    confluenceComponents: confluence.components,
    hasEnoughData: primaryCandles.length >= 2 && !!ema9 && !!ema20,
  });
  
  if (primaryCandles.length >= 2 && ema9 && ema20) {
    const lastCandle = primaryCandles[primaryCandles.length - 1];
    const prevCandle = primaryCandles[primaryCandles.length - 2];
    
    // Calculate previous EMAs properly
    const prevCloses = primaryCandles.slice(0, -1).map(c => c.close);
    const prevEma9Values = calculateEMA(prevCloses, 9);
    const prevEma20Values = calculateEMA(prevCloses, 20);
    const prevEma9 = prevEma9Values[prevEma9Values.length - 1];
    const prevEma20 = prevEma20Values[prevEma20Values.length - 1];
    
    const bullishCross = prevEma9 < prevEma20 && ema9 > ema20;
    const bearishCross = prevEma9 > prevEma20 && ema9 < ema20;
    const emaGap = Math.abs(ema9 - ema20);
    const prevEmaGap = Math.abs(prevEma9 - prevEma20);
    log(`EMA state ${symbol}`, {
      prevEma9: prevEma9?.toFixed(4),
      prevEma20: prevEma20?.toFixed(4),
      currentEma9: ema9.toFixed(4),
      currentEma20: ema20.toFixed(4),
      prevEmaGap: prevEmaGap.toFixed(4),
      emaGap: emaGap.toFixed(4),
      bullishCross,
      bearishCross,
      lastCandleTime: new Date(lastCandle.time || Date.now()).toISOString(),
      lastClose: lastCandle.close,
      prevClose: prevCandle.close,
      candleVol: lastCandle.volume,
    });
    
    // TEMPORARILY LOWER THRESHOLD TO 30% for testing
    const minConfluence = 30;
    
    // Bullish crossover with confluence confirmation
    if (bullishCross && confluence.overall >= minConfluence) {
      signals.push({
        id: `${symbol}-ema-cross-bull-${lastCandle.time}`,
        symbol,
        strategy: 'EMA Crossover',
        signal: 'BUY',
        confidence: Math.min(confluence.overall, 79), // Cap at "setup" level
        timestamp: lastCandle.time || Date.now(),
        reason: `EMA 9/20 bullish cross | Conf: ${confluence.overall}% | RSI: ${rsi14?.toFixed(1) || 'N/A'}`,
        price: lastCandle.close,
      } as any);
      log(`SETUP DETECTED bullish crossover ${symbol} @${lastCandle.close.toFixed(2)} conf=${confluence.overall}`);
    }
    
    // Bearish crossover with confluence confirmation
    if (bearishCross && confluence.overall >= minConfluence) {
      signals.push({
        id: `${symbol}-ema-cross-bear-${lastCandle.time}`,
        symbol,
        strategy: 'EMA Crossover',
        signal: 'SELL',
        confidence: Math.min(confluence.overall, 79),
        timestamp: lastCandle.time || Date.now(),
        reason: `EMA 9/20 bearish cross | Conf: ${confluence.overall}% | RSI: ${rsi14?.toFixed(1) || 'N/A'}`,
        price: lastCandle.close,
      } as any);
      log(`SETUP DETECTED bearish crossover ${symbol} @${lastCandle.close.toFixed(2)} conf=${confluence.overall}`);
    }
    
    if (signals.length === 0) {
      const reason = bullishCross || bearishCross
        ? `cross detected but confluence ${confluence.overall} < ${minConfluence}`
        : 'no valid EMA cross pattern';
      log(`No signals for ${symbol}: ${reason}`);
    }
  } else {
    log(`Not enough data: candles=${primaryCandles.length} ema9=${!!ema9} ema20=${!!ema20}`);
  }
  const duration = Date.now() - startTs;
  log(`Finished evaluation for ${symbol} in ${duration}ms (signals=${signals.length})`);
  return signals;
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useMarketDataStore = create<MarketDataStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      symbols: {},
      wsManager: null,
      wsConnection: { 
        socket: null, 
        status: 'disconnected', 
        reconnectAttempts: 0,
        lastMessageTime: 0,
      },
      isConnected: false,
      lastServerTimestamp: 0,
      marketStatus: 'closed',
      enrichedSession: null,
      subscribedSymbols: new Set(),
      macroSymbols: MACRO_SYMBOLS,
      isInitializing: false,
      error: null,
      heartbeatInterval: null,
      unsubscribers: [],
      
      // ======================================================================
      // Actions
      // ======================================================================
      
      initialize: (watchlistSymbols: string[]) => {
        console.log('[v0] marketDataStore: Initializing with watchlist:', watchlistSymbols);
        set({ isInitializing: true, error: null });
        
        const { macroSymbols } = get();
        // Deduplicate symbols without Set spread
        const allSymbolsSet = new Set<string>();
        watchlistSymbols.forEach(s => allSymbolsSet.add(s));
        macroSymbols.forEach(s => allSymbolsSet.add(s));
        const allSymbols = Array.from(allSymbolsSet);
        
        // Create empty data for all symbols
        const symbols: Record<string, SymbolData> = {};
        allSymbols.forEach(symbol => {
          const normalized = symbol.toUpperCase();
          symbols[normalized] = createEmptySymbolData(normalized);
        });
        
        // Convert to Set using Array.from for compatibility
        const subscribedSet = new Set<string>();
        allSymbols.forEach(s => subscribedSet.add(s));
        
        set({ symbols, subscribedSymbols: subscribedSet });
        
        // Initialize WebSocket connection
        get().connectWebSocket();
        
        // Fetch historical bars for all symbols (async, don't wait)
        get().fetchHistoricalBars(allSymbols);
        
        console.log('[v0] marketDataStore: Initialized with', allSymbols.length, 'symbols');
        set({ isInitializing: false });
      },
      
      /** Fetch historical bars for symbols to populate initial candles */
      fetchHistoricalBars: async (symbols: string[]) => {
        console.log('[v0] 📥 Fetching historical bars for', symbols.length, 'symbols');

        const { massiveClient } = await import('../lib/massive/client');

        for (const symbol of symbols) {
          try {
            const normalized = symbol.toUpperCase();
            console.log(`[v0] 📥 Fetching bars for ${normalized}...`);

            // Fetch 1m bars (last 200 bars = ~3 hours of data)
            const bars1m = await massiveClient.getAggregates(normalized, '1', 200);

            if (bars1m && bars1m.length > 0) {
              console.log(`[v0] ✅ Loaded ${bars1m.length} 1m bars for ${normalized}`);

              // Convert to Candle format and update store
              const candles1m: Candle[] = bars1m.map(bar => ({
                time: bar.t,
                timestamp: bar.t,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                vwap: bar.vw,
              }));

              // Update candles for 1m timeframe (rollup to 5m, 15m, 60m happens in mergeBar)
              get().updateCandles(normalized, '1m', candles1m);
            } else {
              console.log(`[v0] ⚠️ No 1m bars returned for ${normalized}`);
            }

            // Fetch Daily bars (last 200 days = ~6 months of data)
            const barsDaily = await massiveClient.getAggregates(normalized, '1D', 200);

            if (barsDaily && barsDaily.length > 0) {
              console.log(`[v0] ✅ Loaded ${barsDaily.length} daily bars for ${normalized}`);

              // Convert to Candle format and update store
              const candlesDaily: Candle[] = barsDaily.map(bar => ({
                time: bar.t,
                timestamp: bar.t,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                vwap: bar.vw,
              }));

              // Update candles for Daily timeframe
              get().updateCandles(normalized, '1D', candlesDaily);
            } else {
              console.log(`[v0] ⚠️ No daily bars returned for ${normalized}`);
            }

            // Trigger recompute to calculate indicators and signals
            get().recomputeSymbol(normalized);
          } catch (error) {
            console.error(`[v0] ❌ Failed to fetch bars for ${symbol}:`, error);
          }
        }

        console.log('[v0] ✅ Historical bars fetch complete');
      },
      
      connectWebSocket: () => {
        const token = import.meta.env.VITE_MASSIVE_PROXY_TOKEN;
        if (!token) {
          console.error('[v0] marketDataStore: No VITE_MASSIVE_PROXY_TOKEN');
          set({ error: 'Missing VITE_MASSIVE_PROXY_TOKEN' });
          return;
        }

        console.log('[v0] marketDataStore: Initializing unified WebSocket manager');

        const manager = new MassiveSubscriptionManager({
          token,
          onQuote: (symbol, quote) => {
            // Update candles with quote data (add as latest bar if needed)
            const normalized = symbol.toUpperCase();
            const { symbols } = get();
            const symbolData = symbols[normalized];
            
            if (!symbolData) return;
            
            // Update last candle's close price or create a minimal bar
            const primaryTF = symbolData.primaryTimeframe;
            const candles = symbolData.candles[primaryTF];
            
            if (candles.length > 0) {
              const lastCandle = candles[candles.length - 1];
              const now = Date.now();
              const candleAge = now - (lastCandle.time || lastCandle.timestamp || 0);
              
              // Update existing candle if < 60s old, else create new
              if (candleAge < 60000) {
                lastCandle.close = quote.last;
                lastCandle.high = Math.max(lastCandle.high, quote.last);
                lastCandle.low = Math.min(lastCandle.low, quote.last);
              } else {
                // New candle
                candles.push({
                  time: now,
                  timestamp: now,
                  open: quote.last,
                  high: quote.last,
                  low: quote.last,
                  close: quote.last,
                  volume: quote.volume || 0,
                });

                // Trim to prevent memory growth
                if (candles.length > MAX_CANDLES_PER_TIMEFRAME) {
                  candles.splice(0, candles.length - MAX_CANDLES_PER_TIMEFRAME);
                }
              }
            }
            
            set({ lastServerTimestamp: Date.now() });
          },
          onBar: (symbol, timeframe, bar) => {
            const normalized = symbol.toUpperCase();
            
            // VERBOSE LOGGING
            console.log(`[v0] 📊 New ${timeframe} bar for ${normalized}:`, {
              time: new Date(bar.time).toISOString(),
              close: bar.close,
              volume: bar.volume,
            });
            
            const tfMap: Record<string, Timeframe> = {
              '1m': '1m',
              '5m': '5m',
              '15m': '15m',
              '60m': '60m',
              '1D': '1D',
            };
            const tf = tfMap[timeframe] || '1m';
            
            get().mergeBar(normalized, tf, {
              time: bar.time,
              timestamp: bar.time,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
              vwap: bar.vwap,
            });
            
            set({ 
              wsConnection: { ...get().wsConnection, lastMessageTime: Date.now() },
              lastServerTimestamp: Date.now() 
            });
            
            console.log(`[v0] ✅ Merged bar into store, triggering recompute for ${normalized}`);
          },
          onTrade: (symbol, trade) => {
            // Optional: log trades
            if (Math.random() < 0.01) {
              console.log('[v0] Trade:', symbol, trade.price, 'x', trade.size);
            }
          },
          onStatus: (status) => {
            console.log('[v0] marketDataStore: WebSocket status:', status);
            const wsStatus = status === 'authenticated' ? 'authenticated' : 
                            status === 'connected' ? 'connected' :
                            status === 'connecting' ? 'connecting' :
                            status === 'error' ? 'error' : 'disconnected';
            
            set({
              wsConnection: { 
                ...get().wsConnection, 
                status: wsStatus 
              },
              isConnected: status === 'authenticated',
            });
            
            // Subscribe to symbols once authenticated
            if (status === 'authenticated') {
              console.log('[v0] marketDataStore: WebSocket authenticated, subscribing to symbols');
              get().subscribeToSymbols();
            }
          },
        });

        manager.connect();
        set({ wsManager: manager });
      },
      
      scheduleReconnect: () => {
        // No-op: massiveWS handles its own reconnection
        return;
      },
      
      subscribeToSymbols: () => {
        const { wsManager, subscribedSymbols } = get();
        if (!wsManager) {
          console.warn('[v0] marketDataStore: WebSocket manager not initialized');
          return;
        }
        
        if (subscribedSymbols.size === 0) {
          console.warn('[v0] marketDataStore: No symbols to subscribe to');
          return;
        }

        const symbols = Array.from(subscribedSymbols);
        console.log('[v0] marketDataStore: 📡 Subscribing to', symbols.length, 'symbols:', symbols);
        
        // Update watchlist - manager will handle channel subscriptions
        wsManager.updateWatchlist(symbols);
        
        // Log subscription confirmation
        console.log('[v0] marketDataStore: ✅ Subscription request sent for:', symbols.join(', '));
      },
      
      handleAggregateBar: (msg: MassiveAggregateMessage) => {
        // Extract symbol (remove I: prefix for indices)
        const symbol = msg.sym.replace(/^I:/, '').toUpperCase();
        
        // Detect timeframe from start/end timestamps
        const timeframe = detectTimeframe(msg.s, msg.e);
        
        // Parse bar
        const bar = parseAggregateBar(msg, timeframe);
        
        // Merge bar into store
        get().mergeBar(symbol, timeframe, bar);
        
        // Log occasionally for debugging
        if (Math.random() < 0.01) {
          console.log('[v0] marketDataStore: Received bar:', symbol, timeframe, {
            time: new Date(bar.time).toISOString(),
            close: bar.close,
            volume: bar.volume,
          });
        }
      },
      
      subscribe: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { symbols, subscribedSymbols, wsManager } = get();
        
        if (subscribedSymbols.has(normalized)) {
          console.log('[v0] marketDataStore: Already subscribed to', normalized);
          return;
        }
        
        console.log('[v0] marketDataStore: Subscribing to', normalized);
        
        // Create data structure if doesn't exist
        if (!symbols[normalized]) {
          set({
            symbols: {
              ...symbols,
              [normalized]: createEmptySymbolData(normalized),
            },
          });
        }
        
        // Add to subscribed set
        const newSubscribed = new Set<string>();
        Array.from(subscribedSymbols).forEach(s => newSubscribed.add(s));
        newSubscribed.add(normalized);
        set({ subscribedSymbols: newSubscribed });
        
        // Update WebSocket watchlist
        if (wsManager) {
          wsManager.updateWatchlist(Array.from(newSubscribed));
        }
      },
      
      unsubscribe: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { subscribedSymbols, macroSymbols, wsManager } = get();
        
        // Don't unsubscribe from macro symbols
        if (macroSymbols.includes(normalized)) {
          console.log('[v0] marketDataStore: Cannot unsubscribe from macro symbol', normalized);
          return;
        }
        
        console.log('[v0] marketDataStore: Unsubscribing from', normalized);
        
        const newSubscribed = new Set<string>();
        Array.from(subscribedSymbols).forEach(s => {
          if (s !== normalized) newSubscribed.add(s);
        });
        set({ subscribedSymbols: newSubscribed });
        
        // Update WebSocket watchlist
        if (wsManager) {
          wsManager.updateWatchlist(Array.from(newSubscribed));
        }
      },
      
      updateCandles: (symbol: string, timeframe: Timeframe, candles: Candle[]) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];
        
        if (!symbolData) {
          console.warn('[v0] marketDataStore: Symbol not found:', normalized);
          return;
        }
        
        // Trim to max candles
        const trimmedCandles = candles.slice(-MAX_CANDLES_PER_TIMEFRAME);
        
        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              candles: {
                ...symbolData.candles,
                [timeframe]: trimmedCandles,
              },
              lastUpdated: Date.now(),
            },
          },
        });
        
        // Recompute indicators if this is the primary timeframe
        if (timeframe === symbolData.primaryTimeframe) {
          get().recomputeIndicators(normalized);
        }
      },
      
      mergeBar: (symbol: string, timeframe: Timeframe, bar: Candle) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];
        
        if (!symbolData) {
          console.warn('[v0] marketDataStore: Symbol not found:', normalized);
          return;
        }
        
        const existingCandles = symbolData.candles[timeframe] || [];
        let updatedCandles = [...existingCandles];
        
        // Check if this bar updates the last candle (same time/timestamp) or adds new
        const lastCandle = existingCandles[existingCandles.length - 1];
        const barTime = bar.time || bar.timestamp || 0;
        const lastTime = lastCandle ? (lastCandle.time || lastCandle.timestamp || 0) : 0;
        
        if (lastCandle && lastTime === barTime) {
          // Update existing candle (snapshot + delta pattern)
          updatedCandles[updatedCandles.length - 1] = bar;
        } else {
          // New candle
          updatedCandles.push(bar);
          
          // Trim to max length
          if (updatedCandles.length > MAX_CANDLES_PER_TIMEFRAME) {
            updatedCandles = updatedCandles.slice(-MAX_CANDLES_PER_TIMEFRAME);
          }
        }
        
        // Auto-rollup higher timeframes from 1m bars
        let candles5m = symbolData.candles['5m'];
        let candles15m = symbolData.candles['15m'];
        let candles60m = symbolData.candles['60m'];
        
        if (timeframe === '1m') {
          // Roll up to 5m, 15m, 60m automatically
          candles5m = rollupBars(updatedCandles, '5m');
          candles15m = rollupBars(updatedCandles, '15m');
          candles60m = rollupBars(updatedCandles, '60m');
        }
        
        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              candles: {
                '1m': timeframe === '1m' ? updatedCandles : symbolData.candles['1m'],
                '5m': timeframe === '1m' ? candles5m : timeframe === '5m' ? updatedCandles : symbolData.candles['5m'],
                '15m': timeframe === '1m' ? candles15m : timeframe === '15m' ? updatedCandles : symbolData.candles['15m'],
                '60m': timeframe === '1m' ? candles60m : timeframe === '60m' ? updatedCandles : symbolData.candles['60m'],
                '1D': symbolData.candles['1D'],
              },
              lastUpdated: Date.now(),
            },
          },
        });
        
        // Recompute comprehensive indicators/signals if this is the primary timeframe
        // Note: recomputeSymbol has built-in conditional logic (only runs on bar close or significant move)
        if (timeframe === symbolData.primaryTimeframe || timeframe === '1m') {
          get().recomputeSymbol(normalized);
        }
      },
      
      recomputeIndicators: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];
        
        if (!symbolData) return;
        
        const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
        if (primaryCandles.length === 0) return;
        
        // Compute indicators
        const indicators = computeIndicatorsFromCandles(primaryCandles);
        
        // Compute MTF trends
        const mtfTrend: Record<Timeframe, MTFTrend> = {} as Record<Timeframe, MTFTrend>;
        (['1m', '5m', '15m', '60m', '1D'] as Timeframe[]).forEach(tf => {
          const tfCandles = symbolData.candles[tf];
          if (tfCandles.length > 0) {
            const tfIndicators = computeIndicatorsFromCandles(tfCandles);
            mtfTrend[tf] = determineTrend(tfCandles, tfIndicators);
          } else {
            mtfTrend[tf] = 'neutral';
          }
        });
        
        // Compute confluence
        const confluence = calculateConfluence(normalized, primaryCandles, indicators, mtfTrend);
        
        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              indicators,
              mtfTrend,
              confluence,
              lastUpdated: Date.now(),
            },
          },
        });
        
        console.log('[v0] marketDataStore: Recomputed indicators for', normalized, {
          ema9: indicators.ema9,
          ema20: indicators.ema20,
          rsi14: indicators.rsi14,
          confluence: confluence.overall,
        });
      },
      
      /** 
       * Recompute all indicators, MTF trends, confluence, and strategies for a symbol
       * Only runs on bar close OR significant price move (>0.5%)
       */
      recomputeSymbol: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        if (!symbolData) return;
        
        const primaryCandles = symbolData.candles[symbolData.primaryTimeframe];
        if (primaryCandles.length < 2) return; // Need at least 2 candles for comparison
        
        const lastCandle = primaryCandles[primaryCandles.length - 1];
        const prevCandle = primaryCandles[primaryCandles.length - 2];
        
        // ===== Conditional Execution: Only recompute on bar close or significant move =====
        
        // Check if this is a new bar (different timestamp from previous)
        const lastTime = lastCandle.time || lastCandle.timestamp || 0;
        const prevTime = prevCandle.time || prevCandle.timestamp || 0;
        const isNewBar = lastTime !== prevTime;
        
        // Check if price moved significantly (>0.5%)
        const priceChange = Math.abs((lastCandle.close - prevCandle.close) / prevCandle.close);
        const significantMove = priceChange > 0.005; // 0.5%
        
        // Skip if neither condition met
        if (!isNewBar && !significantMove) {
          return;
        }
        
        console.log(`[v0] 🔄 Recomputing ${symbol} - isNewBar: ${isNewBar}, priceChange: ${(priceChange * 100).toFixed(2)}%`);
        
        // ===== Step 1: Calculate comprehensive indicators from all timeframes =====
        const indicators = calculateComprehensiveIndicators(symbolData);
        
        // ===== Step 2: Calculate MTF trends for each timeframe =====
        const mtfTrend = calculateMTFTrends(symbolData);
        
        // ===== Step 3: Calculate enhanced confluence score =====
        const confluence = calculateAdvancedConfluence(normalized, symbolData, indicators, mtfTrend);
        
        // ===== Step 4: Run strategy signals =====
        const newSignals = runStrategySignals(normalized, symbolData, indicators, confluence);
        
        // ===== Step 5: Update state immutably using immer =====
        set(
          produce((draft) => {
            const sym = draft.symbols[normalized];
            if (!sym) return;
            
            // Update indicators
            sym.indicators = indicators;
            
            // Update MTF trends
            sym.mtfTrend = mtfTrend;
            
            // Update confluence
            sym.confluence = confluence;
            
            // Update strategy signals (keep last 10)
            if (newSignals.length > 0) {
              sym.strategySignals = [...newSignals, ...sym.strategySignals].slice(0, 10);
            }
            
            // Update timestamp
            sym.lastUpdated = Date.now();
          })
        );
      },
      
      updateConfluence: (symbol: string, confluenceUpdate: Partial<ConfluenceScore>) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];
        
        if (!symbolData) return;
        
        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              confluence: {
                ...symbolData.confluence,
                ...confluenceUpdate,
                lastUpdated: Date.now(),
              },
            },
          },
        });
      },
      
      addStrategySignal: (symbol: string, signal: StrategySignal) => {
        const normalized = symbol.toUpperCase();
        const { symbols } = get();
        const symbolData = symbols[normalized];
        
        if (!symbolData) return;
        
        // Add signal and keep only last 10
        const updatedSignals = [signal, ...symbolData.strategySignals].slice(0, 10);
        
        set({
          symbols: {
            ...symbols,
            [normalized]: {
              ...symbolData,
              strategySignals: updatedSignals,
            },
          },
        });
      },
      
      setMarketStatus: (status: MarketStatus) => {
        set({ marketStatus: status });
      },
      
      updateMarketSession: (session: EnrichedMarketSession) => {
        set({ enrichedSession: session });
        
        // Also update legacy marketStatus for backward compatibility
        const legacyStatus: MarketStatus = 
          session.session === 'PRE' ? 'premarket' :
          session.session === 'OPEN' ? 'open' :
          session.session === 'POST' ? 'afterhours' :
          'closed';
        
        set({ marketStatus: legacyStatus });
      },
      
      fetchMarketSession: async () => {
        try {
          const { massiveClient } = await import('../lib/massive/client');
          const { enrichMarketStatus } = await import('../lib/marketSession');
          
          const data = await massiveClient.getMarketStatus();
          const enriched = enrichMarketStatus(data as any);
          
          const session: EnrichedMarketSession = {
            session: enriched.session,
            isOpen: enriched.isLive,
            isWeekend: enriched.isWeekend,
            nextOpen: enriched.nextOpen,
            nextClose: enriched.nextClose,
            serverTime: enriched.asOf,
            label: enriched.label,
            asOf: enriched.asOf,
          };
          
          get().updateMarketSession(session);
          console.log('[v0] Market session updated:', session);
        } catch (error) {
          console.error('[v0] Failed to fetch market session:', error);
          
          // Use fallback session based on current time
          const { getFallbackSession, getNextMarketTimes } = await import('../lib/marketSession');
          const fallback = getFallbackSession();
          const { nextOpen, nextClose } = getNextMarketTimes(fallback.session);
          
          const now = new Date();
          const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
          const isWeekend = etTime.getDay() === 0 || etTime.getDay() === 6;
          
          const session: EnrichedMarketSession = {
            session: fallback.session,
            isOpen: fallback.isLive,
            isWeekend,
            nextOpen,
            nextClose,
            serverTime: fallback.asOf,
            label: fallback.label,
            asOf: fallback.asOf,
          };
          
          get().updateMarketSession(session);
          console.log('[v0] Using fallback market session:', session);
        }
      },
      
      cleanup: () => {
        console.log('[v0] marketDataStore: Cleaning up WebSocket connection');
        const { heartbeatInterval, wsManager } = get();
        
        // Disconnect unified WebSocket manager
        if (wsManager) {
          wsManager.disconnect();
        }
        
        // Clear heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        
        set({
          wsManager: null,
          wsConnection: {
            socket: null,
            status: 'disconnected',
            reconnectAttempts: 0,
            lastMessageTime: 0,
          },
          isConnected: false,
          heartbeatInterval: null,
          subscribedSymbols: new Set(),
          unsubscribers: [],
        });
      },
      
      // ======================================================================
      // Selectors
      // ======================================================================
      
      getSymbolData: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        return get().symbols[normalized];
      },
      
      getCandles: (symbol: string, timeframe: Timeframe) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.candles[timeframe] || [];
      },
      
      getIndicators: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.indicators || {};
      },
      
      getConfluence: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.confluence;
      },
      
      getStrategySignals: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.strategySignals || [];
      },
      
      getMTFTrend: (symbol: string) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        return symbolData?.mtfTrend || {
          '1m': 'neutral',
          '5m': 'neutral',
          '15m': 'neutral',
          '60m': 'neutral',
          '1D': 'neutral',
        };
      },
      
      isStale: (symbol: string, maxAgeMs = STALE_THRESHOLD_MS) => {
        const normalized = symbol.toUpperCase();
        const symbolData = get().symbols[normalized];
        if (!symbolData) return true;
        
        const age = Date.now() - symbolData.lastUpdated;
        return age > maxAgeMs;
      },
    }),
    { name: 'MarketDataStore' }
  )
);

// ============================================================================
// React Hooks (Typed Selectors)
// ============================================================================

/** Get all data for a symbol */
export function useSymbolData(symbol: string) {
  return useMarketDataStore(state => state.getSymbolData(symbol));
}

/** Get candles for a specific timeframe */
export function useCandles(symbol: string, timeframe: Timeframe) {
  return useMarketDataStore(state => state.getCandles(symbol, timeframe));
}

/** Get latest indicators */
export function useIndicators(symbol: string) {
  return useMarketDataStore(state => state.getIndicators(symbol));
}

/** Get confluence score */
export function useConfluence(symbol: string) {
  return useMarketDataStore(state => state.getConfluence(symbol));
}

/** Get strategy signals */
export function useStrategySignals(symbol: string) {
  return useMarketDataStore(state => state.getStrategySignals(symbol));
}

/** Get MTF trend analysis */
export function useMTFTrend(symbol: string) {
  return useMarketDataStore(state => state.getMTFTrend(symbol));
}

/** Get market status (legacy) */
export function useMarketStatus() {
  return useMarketDataStore(state => state.marketStatus);
}

/** Get enriched market session with timing data */
export function useEnrichedMarketSession() {
  return useMarketDataStore(state => state.enrichedSession);
}

/** Get market session actions */
export function useMarketSessionActions() {
  return useMarketDataStore(state => ({
    fetchMarketSession: state.fetchMarketSession,
    updateMarketSession: state.updateMarketSession,
  }));
}

/** Check if symbol data is stale */
export function useIsStale(symbol: string, maxAgeMs?: number) {
  return useMarketDataStore(state => state.isStale(symbol, maxAgeMs));
}
