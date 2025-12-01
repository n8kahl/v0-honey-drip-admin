/**
 * Backtesting Engine
 * Phase 3: Run detectors on historical data to calculate actual win rates
 *
 * Uses Phase 1 historical data warehouse to simulate detector performance
 * over past 90 days and calculate:
 * - Win rate per detector
 * - Average win/loss
 * - Profit factor
 * - Regime-specific performance
 * - Time-of-day performance
 */

import type { OpportunityDetector } from "../composite/OpportunityDetector";
import type { SymbolFeatures } from "../strategy/engine";
import { createClient } from "@supabase/supabase-js";

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  symbols: string[]; // Symbols to backtest
  startDate: string; // Start date (YYYY-MM-DD)
  endDate: string; // End date (YYYY-MM-DD)
  timeframe: string; // Primary timeframe (e.g., '15m')
  targetMultiple: number; // Target profit multiple (e.g., 1.5 = 1.5R)
  stopMultiple: number; // Stop loss multiple (e.g., 1.0 = 1R)
  maxHoldBars: number; // Max bars to hold position
  slippage: number; // Slippage in % (e.g., 0.001 = 0.1%)
}

/**
 * Watchlist for backtesting - symbols with available historical data
 */
export const BACKTEST_WATCHLIST = [
  // Indices - best ORB performance
  "SPY",
  "SPX",
  "NDX",
  "QQQ",
  // Individual stocks
  "TSLA",
  "SOFI",
  "AMD",
  // "NVDA", // Removed - no historical data available
  "MSFT",
];

/**
 * Default backtest configuration
 */
export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  symbols: BACKTEST_WATCHLIST,
  startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  endDate: new Date().toISOString().split("T")[0],
  timeframe: "15m",
  targetMultiple: 1.5,
  stopMultiple: 1.0,
  maxHoldBars: 20, // ~5 hours on 15m
  slippage: 0.001,
};

/**
 * Backtest result for a single trade
 */
export interface BacktestTrade {
  timestamp: number;
  symbol: string;
  detector: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  exitPrice: number;
  exitTimestamp: number;
  exitReason: "TARGET_HIT" | "STOP_HIT" | "MAX_HOLD" | "EOD";
  pnl: number;
  pnlPercent: number;
  rMultiple: number; // Actual R achieved (e.g., 1.5R or -1.0R)
  barsHeld: number;
  marketRegime?: string;
  vixLevel?: number;
  ivPercentile?: number;
}

/**
 * Backtest statistics for a detector
 */
export interface BacktestStats {
  detector: string;
  symbol?: string;

  // Trade counts
  totalTrades: number;
  winners: number;
  losers: number;
  breakeven: number;

  // Win rate
  winRate: number;

  // P&L stats
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;

  // Risk metrics
  profitFactor: number; // Gross profit / Gross loss
  expectancy: number; // Average R per trade
  avgRMultiple: number;

  // Time metrics
  avgBarsHeld: number;
  avgWinBars: number;
  avgLossBars: number;

  // Distribution
  byRegime?: Record<string, Partial<BacktestStats>>;
  byTimeOfDay?: Record<string, Partial<BacktestStats>>;
  bySymbol?: Record<string, Partial<BacktestStats>>;

  // Trade list
  trades: BacktestTrade[];
}

/**
 * Main Backtesting Engine
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private supabase: any;

  constructor(config?: Partial<BacktestConfig>, supabaseClient?: any) {
    this.config = { ...DEFAULT_BACKTEST_CONFIG, ...config };

    // Use provided client (for server-side with service role) or create one with env vars
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      // Create server-side Supabase client with service role key
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      console.log(
        "[BacktestEngine] Supabase URL:",
        supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "MISSING"
      );
      console.log("[BacktestEngine] Supabase Key:", supabaseKey ? "Present" : "MISSING");

      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          "Missing Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"
        );
      }

      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            console.log("[BacktestEngine] Supabase fetch to:", input);
            return fetch(input, init).catch((err) => {
              console.error("[BacktestEngine] Fetch error:", err.message);
              throw err;
            });
          },
        },
      });
    }
  }

  /**
   * Run backtest for a single detector
   */
  async backtestDetector(detector: OpportunityDetector): Promise<BacktestStats> {
    console.log(`[BacktestEngine] Backtesting ${detector.type}...`);

    const allTrades: BacktestTrade[] = [];

    for (const symbol of this.config.symbols) {
      console.log(`[BacktestEngine]   ${symbol}...`);

      // Fetch historical bars
      const bars = await this.fetchHistoricalBars(symbol);

      if (!bars || bars.length < 50) {
        console.warn(
          `[BacktestEngine]   ${symbol} - Insufficient data (${bars?.length || 0} bars)`
        );
        continue;
      }

      // Run detector on each bar
      for (let i = 50; i < bars.length; i++) {
        const currentBar = bars[i];

        // Reconstruct features for this timestamp
        const features = await this.reconstructFeatures(symbol, bars, i);

        // Run detector with scoring (not just boolean detection)
        const result = detector.detectWithScore(features, undefined);

        if (result.detected) {
          // Apply runtime parameter filtering (for genetic algorithm optimization)
          const { getOptimizedParams } = await import("../composite/OptimizedScannerConfig.js");
          const params = getOptimizedParams();

          // Check if this is a KCU detector and apply KCU-specific filtering
          const isKCUDetector = detector.type.startsWith("kcu_");
          let minScoreThreshold = params?.minScores?.day || 40;
          let maxHoldBars = params?.riskReward?.maxHoldBars ?? this.config.maxHoldBars;

          if (isKCUDetector) {
            // Import KCU optimized config
            const { isDetectorEnabled, getDetectorMinScore, KCU_OPTIMIZED_PARAMS } = await import(
              "../composite/detectors/kcu/KCUOptimizedConfig.js"
            );

            // Check if detector is enabled in KCU config
            if (!isDetectorEnabled(detector.type)) {
              // Detector disabled by optimization config - skip
              continue;
            }

            // Use KCU-specific minimum score
            minScoreThreshold = getDetectorMinScore(detector.type, "day");
            maxHoldBars = KCU_OPTIMIZED_PARAMS.riskReward.maxHoldBars;
          }

          if (result.baseScore < minScoreThreshold) {
            // Signal detected but score too low - skip trade
            continue;
          }

          // Simulate trade
          const trade = await this.simulateTrade(
            symbol,
            detector,
            currentBar,
            bars.slice(i + 1, i + maxHoldBars + 1),
            features
          );

          if (trade) {
            allTrades.push(trade);
          }
        }
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(detector.type, allTrades);

    console.log(
      `[BacktestEngine] ${detector.type} - Complete: ${stats.totalTrades} trades, ${(stats.winRate * 100).toFixed(1)}% win rate`
    );

    return stats;
  }

  /**
   * Run backtest for all detectors
   * Used by ConfluenceOptimizer to evaluate parameter sets
   *
   * NOTE: Uses BACKTESTABLE_DETECTORS which excludes options-dependent detectors
   * (gamma_squeeze, gamma_flip, eod_pin) that require real-time options data.
   *
   * @param includeKCU - Include KCU LTP Strategy detectors (default: false)
   */
  async backtestAll(includeKCU = false): Promise<BacktestStats[]> {
    // Import only detectors that can be backtested with historical price/volume data
    // Options-dependent detectors are excluded (gamma_*, eod_pin)
    const { BACKTESTABLE_DETECTORS, BACKTESTABLE_DETECTORS_WITH_KCU } = await import(
      "../composite/detectors/index.js"
    );

    const detectors = includeKCU ? BACKTESTABLE_DETECTORS_WITH_KCU : BACKTESTABLE_DETECTORS;

    console.log(
      `[BacktestEngine] Running backtests for ${detectors.length} backtestable detectors${includeKCU ? " (including KCU)" : ""}...`
    );

    const results: BacktestStats[] = [];

    for (const detector of detectors) {
      const stats = await this.backtestDetector(detector);
      results.push(stats);
    }

    console.log(`[BacktestEngine] Completed backtests for ${detectors.length} detectors`);

    return results;
  }

  /**
   * Run backtest for KCU LTP Strategy detectors only
   *
   * KCU strategies include:
   * - EMA Bounce (long/short)
   * - VWAP Standard (long/short)
   * - King & Queen (long/short)
   * - ORB Breakout (long/short)
   */
  async backtestKCU(): Promise<BacktestStats[]> {
    const { BACKTESTABLE_KCU_DETECTORS } = await import("../composite/detectors/index.js");

    console.log(
      `[BacktestEngine] Running backtests for ${BACKTESTABLE_KCU_DETECTORS.length} KCU detectors...`
    );

    const results: BacktestStats[] = [];

    for (const detector of BACKTESTABLE_KCU_DETECTORS) {
      const stats = await this.backtestDetector(detector);
      results.push(stats);
    }

    console.log(`[BacktestEngine] Completed KCU backtests for ${results.length} detectors`);

    return results;
  }

  /**
   * Fetch historical bars for a symbol
   * Primary: Database (fast)
   * Fallback: Massive.com REST API (slower but reliable)
   */
  private async fetchHistoricalBars(symbol: string): Promise<any[]> {
    // Try database first
    try {
      const { data, error } = await this.supabase
        .from("historical_bars")
        .select("*")
        .eq("symbol", symbol)
        .eq("timeframe", this.config.timeframe)
        .gte("timestamp", new Date(this.config.startDate).getTime())
        .lte("timestamp", new Date(this.config.endDate).getTime())
        .order("timestamp", { ascending: true });

      if (!error && data && data.length > 0) {
        console.log(`[BacktestEngine] ✅ Database: ${data.length} bars for ${symbol}`);
        return data;
      }

      if (error) {
        console.warn(`[BacktestEngine] ⚠️ Database error for ${symbol}:`, error.message);
      } else {
        console.warn(`[BacktestEngine] ⚠️ No database data for ${symbol}`);
      }
    } catch (dbError: any) {
      console.warn(`[BacktestEngine] ⚠️ Database fetch failed for ${symbol}:`, dbError.message);
    }

    // Fallback to Massive.com REST API
    console.log(`[BacktestEngine] 🔄 Falling back to Massive.com API for ${symbol}...`);
    return await this.fetchFromMassiveAPI(symbol);
  }

  /**
   * Fetch historical bars from Massive.com REST API
   */
  private async fetchFromMassiveAPI(symbol: string): Promise<any[]> {
    try {
      const timeframeMap: Record<string, string> = {
        "1m": "minute",
        "5m": "minute",
        "15m": "minute",
        "1h": "hour",
        "4h": "hour",
        day: "day",
      };

      const multiplierMap: Record<string, number> = {
        "1m": 1,
        "5m": 5,
        "15m": 15,
        "1h": 1,
        "4h": 4,
        day: 1,
      };

      const timespan = timeframeMap[this.config.timeframe] || "minute";
      const multiplier = multiplierMap[this.config.timeframe] || 1;

      // Format dates for API (YYYY-MM-DD)
      const from = this.config.startDate;
      const to = this.config.endDate;

      // Determine if this is an index or equity
      const indexSymbols = ["SPX", "NDX", "VIX", "RUT", "DJI"];
      const cleanSymbol = symbol.replace(/^I:/, "");
      const isIndex = indexSymbols.includes(cleanSymbol);

      // Use appropriate ticker format
      const apiTicker = isIndex ? `I:${cleanSymbol}` : symbol;

      const apiKey = process.env.MASSIVE_API_KEY;
      if (!apiKey) {
        console.error("[BacktestEngine] ❌ MASSIVE_API_KEY not found");
        return [];
      }

      const url = `https://api.massive.com/v2/aggs/ticker/${apiTicker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;

      console.log(`[BacktestEngine] 📡 Fetching from: ${url.substring(0, 80)}...`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        console.error(`[BacktestEngine] ❌ API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const json = await response.json();
      const results = json.results || [];

      if (results.length === 0) {
        console.warn(`[BacktestEngine] ⚠️ API returned 0 results for ${symbol}`);
        return [];
      }

      // Convert Massive API format to database format
      const bars = results.map((bar: any) => ({
        symbol,
        timeframe: this.config.timeframe,
        timestamp: bar.t, // Epoch milliseconds
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v || 0,
        vwap: bar.vw || bar.c,
        trades: bar.n || 0,
      }));

      console.log(`[BacktestEngine] ✅ API: ${bars.length} bars for ${symbol}`);
      return bars;
    } catch (error: any) {
      console.error(`[BacktestEngine] ❌ API fetch failed for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Reconstruct SymbolFeatures from historical bars
   */
  private async reconstructFeatures(
    symbol: string,
    bars: any[],
    currentIndex: number
  ): Promise<SymbolFeatures> {
    const current = bars[currentIndex];
    const previous = bars.slice(Math.max(0, currentIndex - 50), currentIndex);

    // Calculate basic indicators
    const closes = previous.map((b: any) => b.close);
    const highs = previous.map((b: any) => b.high);
    const lows = previous.map((b: any) => b.low);
    const volumes = previous.map((b: any) => b.volume);

    // Simple EMA calculation (including EMA 8 for KCU strategies)
    const ema8 = this.calculateEMA(closes, 8);
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    const ema50 = this.calculateEMA(closes, 50);

    // ATR
    const atr = this.calculateATR(highs, lows, closes, 14);

    // RSI calculation
    const rsi14 = this.calculateRSI(closes, 14);

    // Breakout detection (20-bar lookback)
    const breakoutLookback = Math.min(20, previous.length);
    const recentHighs = highs.slice(-breakoutLookback);
    const recentLows = lows.slice(-breakoutLookback);
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    // Bullish breakout: current high breaks above prior 20-bar high
    const breakoutBullish = current.high > highestHigh;
    // Bearish breakout: current low breaks below prior 20-bar low
    const breakoutBearish = current.low < lowestLow;

    // Calculate ORB (Opening Range Breakout) levels for KCU strategies
    // ORB is typically first 15-30 minutes of trading (depends on timeframe)
    const { orbHigh, orbLow, priorDayHigh, priorDayLow } = this.calculateDayLevels(
      bars,
      currentIndex,
      current.timestamp
    );

    // VWAP calculation - recalculate from bars instead of using database value
    // Calculate VWAP over the previous bars (includes current bar)
    const barsForVWAP = bars.slice(Math.max(0, currentIndex - 50), currentIndex + 1);
    const vwapValue = this.calculateVWAP(barsForVWAP);
    const vwapDistancePct =
      vwapValue !== null ? ((current.close - vwapValue) / vwapValue) * 100 : null;

    // Market regime determination
    const marketRegime = this.determineMarketRegime(
      current.close,
      ema9[ema9.length - 1],
      ema21[ema21.length - 1]
    );

    // Construct features (simplified version)
    const features: SymbolFeatures = {
      symbol,
      time: new Date(current.timestamp).toISOString(),
      price: {
        current: current.close,
        open: current.open,
        high: current.high,
        low: current.low,
        prevClose: previous[previous.length - 1]?.close || current.close,
        prev: previous[previous.length - 1]?.close,
      },
      volume: {
        current: current.volume,
        avg: volumes.reduce((sum: number, v: number) => sum + v, 0) / volumes.length,
        relativeToAvg:
          current.volume /
          (volumes.reduce((sum: number, v: number) => sum + v, 0) / volumes.length),
      },
      vwap:
        vwapValue !== null
          ? {
              value: vwapValue,
              distancePct: vwapDistancePct!,
            }
          : undefined,
      ema: {
        "8": ema8[ema8.length - 1],
        "9": ema9[ema9.length - 1],
        "21": ema21[ema21.length - 1],
        "50": ema50[ema50.length - 1],
      },
      rsi: {
        "14": rsi14,
      },
      mtf: {
        [this.config.timeframe]: {
          ema: {
            "9": ema9[ema9.length - 1],
            "21": ema21[ema21.length - 1],
          },
          rsi: {
            "14": rsi14,
          },
        },
      },
      session: {
        minutesSinceOpen: this.calculateMinutesSinceOpen(current.timestamp),
        // Regular hours: 9:30 AM - 4:00 PM ET (with VWAP available)
        // Note: isRegularHours also requires VWAP data to be available
        isRegularHours: vwapValue !== null && this.isWithinMarketHours(current.timestamp),
      },
      pattern: {
        atr,
        trend: this.determineTrend(current.close, ema9[ema9.length - 1], ema21[ema21.length - 1]),
        market_regime: marketRegime,
        // Breakout flags for breakout detectors
        breakout_bullish: breakoutBullish,
        breakout_bearish: breakoutBearish,
        // ORB levels for KCU strategies
        orbHigh,
        orbLow,
        // Prior day levels for KCU strategies
        priorDayHigh,
        priorDayLow,
        // Premarket levels (approximated from first few bars of day)
        preMarketHigh: orbHigh, // Use ORB as proxy for premarket
        preMarketLow: orbLow,
      },
      // Raw bars for KCU trend detection (stored at top level due to pattern type constraints)
      rawBars: previous.slice(-20).map((b: any) => ({
        time: b.timestamp / 1000,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume || 0,
      })),
    };

    return features;
  }

  /**
   * Simulate a trade and calculate outcome
   */
  private async simulateTrade(
    symbol: string,
    detector: OpportunityDetector,
    entryBar: any,
    futureBars: any[],
    features: SymbolFeatures
  ): Promise<BacktestTrade | null> {
    const direction = detector.direction;
    const entryPrice = entryBar.close;
    const atr = features.pattern?.atr || features.indicators?.atr || 2.0;

    // Get optimized parameters (for genetic algorithm)
    const { getOptimizedParams } = await import("../composite/OptimizedScannerConfig.js");
    const params = getOptimizedParams();

    // Use optimized riskReward parameters if available, otherwise fall back to config
    const targetMultiple = params?.riskReward?.targetMultiple ?? this.config.targetMultiple;
    const stopMultiple = params?.riskReward?.stopMultiple ?? this.config.stopMultiple;
    const maxHoldBars = params?.riskReward?.maxHoldBars ?? this.config.maxHoldBars;

    // Calculate target and stop based on ATR
    let targetPrice: number;
    let stopPrice: number;

    if (direction === "LONG") {
      targetPrice = entryPrice + atr * targetMultiple;
      stopPrice = entryPrice - atr * stopMultiple;
    } else {
      targetPrice = entryPrice - atr * targetMultiple;
      stopPrice = entryPrice + atr * stopMultiple;
    }

    // Apply slippage
    const slippageAmount = entryPrice * this.config.slippage;
    const entryPriceWithSlippage =
      direction === "LONG" ? entryPrice + slippageAmount : entryPrice - slippageAmount;

    // Simulate holding the trade
    let exitPrice = entryPriceWithSlippage;
    let exitReason: BacktestTrade["exitReason"] = "MAX_HOLD";
    let exitTimestamp = entryBar.timestamp;
    let barsHeld = 0;

    for (let i = 0; i < futureBars.length; i++) {
      const bar = futureBars[i];
      barsHeld = i + 1;
      exitTimestamp = bar.timestamp;

      // Check if target hit
      if (direction === "LONG" && bar.high >= targetPrice) {
        exitPrice = targetPrice;
        exitReason = "TARGET_HIT";
        break;
      } else if (direction === "SHORT" && bar.low <= targetPrice) {
        exitPrice = targetPrice;
        exitReason = "TARGET_HIT";
        break;
      }

      // Check if stop hit
      if (direction === "LONG" && bar.low <= stopPrice) {
        exitPrice = stopPrice;
        exitReason = "STOP_HIT";
        break;
      } else if (direction === "SHORT" && bar.high >= stopPrice) {
        exitPrice = stopPrice;
        exitReason = "STOP_HIT";
        break;
      }

      // Exit at close if this is the last bar
      if (i === futureBars.length - 1) {
        exitPrice = bar.close;
        exitReason = "MAX_HOLD";
      }
    }

    // Calculate P&L
    const pnl =
      direction === "LONG"
        ? exitPrice - entryPriceWithSlippage
        : entryPriceWithSlippage - exitPrice;

    const pnlPercent = (pnl / entryPriceWithSlippage) * 100;

    // Calculate R-multiple
    const risk = atr * this.config.stopMultiple;
    const rMultiple = pnl / risk;

    return {
      timestamp: entryBar.timestamp,
      symbol,
      detector: detector.type,
      direction,
      entryPrice: entryPriceWithSlippage,
      targetPrice,
      stopPrice,
      exitPrice,
      exitTimestamp,
      exitReason,
      pnl,
      pnlPercent,
      rMultiple,
      barsHeld,
    };
  }

  /**
   * Calculate statistics from trades
   */
  private calculateStats(detectorType: string, trades: BacktestTrade[]): BacktestStats {
    if (trades.length === 0) {
      return {
        detector: detectorType,
        totalTrades: 0,
        winners: 0,
        losers: 0,
        breakeven: 0,
        winRate: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        profitFactor: 0,
        expectancy: 0,
        avgRMultiple: 0,
        avgBarsHeld: 0,
        avgWinBars: 0,
        avgLossBars: 0,
        trades: [],
      };
    }

    const winners = trades.filter((t) => t.pnl > 0);
    const losers = trades.filter((t) => t.pnl < 0);
    const breakeven = trades.filter((t) => t.pnl === 0);

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalPnlPercent = trades.reduce((sum, t) => sum + t.pnlPercent, 0);

    const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));

    const avgWin =
      winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnlPercent, 0) / winners.length : 0;

    const avgLoss =
      losers.length > 0 ? losers.reduce((sum, t) => sum + t.pnlPercent, 0) / losers.length : 0;

    const largestWin = winners.length > 0 ? Math.max(...winners.map((t) => t.pnlPercent)) : 0;

    const largestLoss = losers.length > 0 ? Math.min(...losers.map((t) => t.pnlPercent)) : 0;

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    const avgRMultiple = trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length;
    const expectancy = avgRMultiple;

    const avgBarsHeld = trades.reduce((sum, t) => sum + t.barsHeld, 0) / trades.length;
    const avgWinBars =
      winners.length > 0 ? winners.reduce((sum, t) => sum + t.barsHeld, 0) / winners.length : 0;
    const avgLossBars =
      losers.length > 0 ? losers.reduce((sum, t) => sum + t.barsHeld, 0) / losers.length : 0;

    return {
      detector: detectorType,
      totalTrades: trades.length,
      winners: winners.length,
      losers: losers.length,
      breakeven: breakeven.length,
      winRate: winners.length / trades.length,
      totalPnl,
      totalPnlPercent,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
      expectancy,
      avgRMultiple,
      avgBarsHeld,
      avgWinBars,
      avgLossBars,
      trades,
    };
  }

  /**
   * Helper: Calculate EMA
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    ema[0] = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  /**
   * Helper: Calculate ATR
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    const trueRanges: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
  }

  /**
   * Helper: Calculate RSI
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50; // Default neutral RSI

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains: number[] = changes.map((c) => (c > 0 ? c : 0));
    const losses: number[] = changes.map((c) => (c < 0 ? Math.abs(c) : 0));

    // Calculate average gain and loss
    const avgGain = gains.slice(-period).reduce((sum, g) => sum + g, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, l) => sum + l, 0) / period;

    if (avgLoss === 0) return 100; // No losses = overbought
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Helper: Calculate VWAP from historical bars
   * VWAP = sum(typical_price * volume) / sum(volume)
   * where typical_price = (high + low + close) / 3
   */
  private calculateVWAP(bars: any[]): number | null {
    if (bars.length === 0) return null;

    let cumulativePV = 0;
    let cumulativeVolume = 0;

    for (const bar of bars) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      const volume = bar.volume || 0;
      cumulativePV += typicalPrice * volume;
      cumulativeVolume += volume;
    }

    // Return null if no volume data (instead of fallback to close price)
    // This allows detectors to skip VWAP checks when data is unavailable
    return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : null;
  }

  /**
   * Helper: Determine market regime
   */
  private determineMarketRegime(price: number, ema9: number, ema21: number): string {
    if (price > ema9 && ema9 > ema21) return "trending_up";
    if (price < ema9 && ema9 < ema21) return "trending_down";
    return "ranging";
  }

  /**
   * Helper: Determine trend
   */
  private determineTrend(price: number, ema9: number, ema21: number): string {
    if (price > ema9 && ema9 > ema21) return "UPTREND";
    if (price < ema9 && ema9 < ema21) return "DOWNTREND";
    return "SIDEWAYS";
  }

  /**
   * Helper: Calculate minutes since market open (9:30 AM ET)
   * Market opens at 9:30 AM ET = 14:30 UTC (EST) or 13:30 UTC (EDT)
   */
  private calculateMinutesSinceOpen(timestamp: number): number {
    const date = new Date(timestamp);

    // Get hours and minutes in ET (America/New_York)
    // Note: This is a simplified calculation - in production, use proper timezone library
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();

    // Convert to ET (approximate: -5 for EST, -4 for EDT)
    // Use -5 as default (EST), adjust for DST if needed
    const isDST = this.isDaylightSavingTime(date);
    const etOffset = isDST ? -4 : -5;

    let etHours = utcHours + etOffset;
    if (etHours < 0) etHours += 24;

    // Market opens at 9:30 AM ET
    const marketOpenMinutes = 9 * 60 + 30; // 570 minutes from midnight
    const currentMinutes = etHours * 60 + utcMinutes;

    return currentMinutes - marketOpenMinutes;
  }

  /**
   * Helper: Check if timestamp is within regular market hours (9:30 AM - 4:00 PM ET)
   */
  private isWithinMarketHours(timestamp: number): boolean {
    const minutesSinceOpen = this.calculateMinutesSinceOpen(timestamp);
    // Market is open from 0 to 390 minutes after open (9:30 AM to 4:00 PM = 6.5 hours = 390 minutes)
    return minutesSinceOpen >= 0 && minutesSinceOpen <= 390;
  }

  /**
   * Helper: Calculate ORB and prior day levels for KCU strategies
   * ORB = Opening Range Breakout (first 15-30 minutes of trading)
   */
  private calculateDayLevels(
    bars: any[],
    currentIndex: number,
    currentTimestamp: number
  ): { orbHigh: number; orbLow: number; priorDayHigh: number; priorDayLow: number } {
    const currentDate = new Date(currentTimestamp);
    const currentDay = currentDate.toISOString().split("T")[0];

    // Find bars from today (for ORB) and yesterday (for prior day levels)
    const todayBars: any[] = [];
    const yesterdayBars: any[] = [];
    let yesterdayDate = "";

    // Look back through bars to find today's and yesterday's bars
    for (
      let i = currentIndex;
      i >= 0 && (todayBars.length < 50 || yesterdayBars.length < 200);
      i--
    ) {
      const bar = bars[i];
      const barDate = new Date(bar.timestamp).toISOString().split("T")[0];

      if (barDate === currentDay) {
        todayBars.unshift(bar);
      } else if (yesterdayDate === "" || barDate === yesterdayDate) {
        if (yesterdayDate === "") {
          yesterdayDate = barDate;
        }
        if (barDate === yesterdayDate) {
          yesterdayBars.unshift(bar);
        }
      }
    }

    // Calculate ORB from first N bars of today (depends on timeframe)
    // For 15m: first 2 bars = 30 minutes
    // For 5m: first 6 bars = 30 minutes
    // For 1m: first 15-30 bars
    const orbBarCount = Math.min(
      this.config.timeframe === "1m"
        ? 15
        : this.config.timeframe === "5m"
          ? 6
          : this.config.timeframe === "15m"
            ? 2
            : 4,
      todayBars.length
    );

    const orbBars = todayBars.slice(0, orbBarCount);
    const orbHigh = orbBars.length > 0 ? Math.max(...orbBars.map((b) => b.high)) : 0;
    const orbLow = orbBars.length > 0 ? Math.min(...orbBars.map((b) => b.low)) : 0;

    // Calculate prior day high/low
    const priorDayHigh =
      yesterdayBars.length > 0 ? Math.max(...yesterdayBars.map((b) => b.high)) : 0;
    const priorDayLow = yesterdayBars.length > 0 ? Math.min(...yesterdayBars.map((b) => b.low)) : 0;

    return { orbHigh, orbLow, priorDayHigh, priorDayLow };
  }

  /**
   * Helper: Check if date is in Daylight Saving Time (US)
   * DST runs from second Sunday in March to first Sunday in November
   */
  private isDaylightSavingTime(date: Date): boolean {
    const year = date.getUTCFullYear();

    // Second Sunday in March
    const marchFirst = new Date(Date.UTC(year, 2, 1)); // March 1
    const dstStart = new Date(Date.UTC(year, 2, 14 - marchFirst.getUTCDay())); // Second Sunday
    dstStart.setUTCHours(7); // 2 AM ET = 7 AM UTC

    // First Sunday in November
    const novFirst = new Date(Date.UTC(year, 10, 1)); // November 1
    const dstEnd = new Date(Date.UTC(year, 10, 7 - novFirst.getUTCDay() || 7)); // First Sunday
    dstEnd.setUTCHours(6); // 2 AM ET = 6 AM UTC (still in EDT before switch)

    return date >= dstStart && date < dstEnd;
  }
}
