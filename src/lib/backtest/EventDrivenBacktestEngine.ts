import { BacktestStats, BacktestTrade, BacktestConfig, DEFAULT_BACKTEST_CONFIG } from "./types.js";
import { MultiTimeframeLoader, Bar, Timeframe } from "./MultiTimeframeLoader.js";
import { HistoricalOptionsProvider } from "../massive/HistoricalOptionsProvider.js";
import { FeaturesBuilder } from "./FeaturesBuilder.js";
import { SymbolFeatures } from "../strategy/engine.js";

// Helper for strict typed map key access
const tfMap = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "60m": 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
};

export class EventDrivenBacktestEngine {
  private loader: MultiTimeframeLoader;
  private optionsProvider: HistoricalOptionsProvider;
  private config: BacktestConfig;

  // State
  private activeTrades: BacktestTrade[] = [];
  private completedTrades: BacktestTrade[] = [];

  constructor(config?: Partial<BacktestConfig>) {
    this.config = { ...DEFAULT_BACKTEST_CONFIG, ...config };
    this.loader = new MultiTimeframeLoader();
    this.optionsProvider = new HistoricalOptionsProvider(process.env.MASSIVE_API_KEY);
  }

  /**
   * Run backtest for a specific detector on a list of symbols
   */
  async runDetector(detector: any): Promise<BacktestStats> {
    this.activeTrades = [];
    this.completedTrades = [];

    const timeframes: Timeframe[] = ["1m", "5m", "15m", "60m"]; // Standard MTF set

    console.log(`[EventEngine] Starting run for ${detector.type}`);

    for (const symbol of this.config.symbols) {
      // 1. Load Multi-Timeframe Data
      const data = await this.loader.load(
        symbol,
        this.config.startDate,
        this.config.endDate,
        timeframes
      );

      // Verify we have base 1m data for the clock
      if (!data.has("1m") || data.get("1m")!.length === 0) {
        console.warn(`[EventEngine] No 1m data for ${symbol}, skipping.`);
        continue;
      }

      const bars1m = data.get("1m")!;
      // Sort to ensure chronological order
      bars1m.sort((a, b) => a.timestamp - b.timestamp);

      // 2. Load Flow Data
      const flowData = await this.loader.loadFlow(
        symbol,
        this.config.startDate,
        this.config.endDate
      );

      // 2. Initialize Pointers for higher timeframes
      // We want efficient lookups, not array.find every tick
      const pointers: Record<Timeframe, number> = {
        "1m": 0,
        "5m": 0,
        "15m": 0,
        "60m": 0,
        "1D": 0,
      };

      // 3. Event Loop (Iterate through 1m bars as "Ticks")
      // Start from index 300 to allow warmup for EMA-200 convergence
      // EMA-200 needs ~3*period (600) samples ideally, but 300 is a practical minimum
      const WARMUP_BARS = 300;
      for (let i = WARMUP_BARS; i < bars1m.length; i++) {
        const tick = bars1m[i];

        // --- A. Trade Management (Check Stops/Targets on current Tick) ---
        this.manageTrades(tick, symbol);

        // --- B. Data Synchronization (Construct MTF Context) ---
        // Find the most recently CLOSED bar for each timeframe relative to 'tick.timestamp'
        // A 5m bar closing at 10:05 is available at 10:05:00 (or 10:05:01)
        const context = this.syncContext(tick.timestamp, data, pointers);

        // --- C. Signal Detection ---
        // Only run detection if we are not already in a trade for this symbol
        // (Assuming 1 trade per symbol constraint for simplicity, can be lifted)
        const hasActiveTrade = this.activeTrades.some((t) => t.symbol === symbol);
        if (!hasActiveTrade) {
          // CRITICAL: Pass next bar for lookahead-free entry
          // Signal fires at bar[i], entry happens at bar[i+1].open
          const nextBar = i + 1 < bars1m.length ? bars1m[i + 1] : undefined;

          await this.scanForEntry(
            symbol,
            detector,
            tick,
            context,
            bars1m.slice(0, i + 1), // Pass full history up to now
            this.extractMTFBars(data, pointers), // Extract raw bars for feature builder
            flowData, // Pass loaded flow data
            nextBar // Pass next bar for lookahead-free entry
          );
        }
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(detector.type, [...this.completedTrades]);
    this.completedTrades = []; // Clear for next detector
    return stats;
  }

  private manageTrades(tick: Bar, symbol: string) {
    for (let i = this.activeTrades.length - 1; i >= 0; i--) {
      const trade = this.activeTrades[i];
      if (trade.symbol !== symbol) continue;

      // Check for exit conditions
      let exitReason: "STOP_HIT" | "TARGET_HIT" | "MAX_HOLD" | "EOD" | null = null;
      let exitPrice = tick.close; // Default to close if not stopped out

      // 1. Check Stop Loss (Hit Low in candle?)
      if (trade.direction === "LONG") {
        if (tick.low <= trade.stopPrice) {
          exitReason = "STOP_HIT";
          exitPrice = trade.stopPrice; // Assumes stop fill (slippage applied later)
        } else if (tick.high >= trade.targetPrice) {
          exitReason = "TARGET_HIT";
          exitPrice = trade.targetPrice;
        }
      } else {
        // Short
        if (tick.high >= trade.stopPrice) {
          exitReason = "STOP_HIT";
          exitPrice = trade.stopPrice;
        } else if (tick.low <= trade.targetPrice) {
          exitReason = "TARGET_HIT";
          exitPrice = trade.targetPrice;
        }
      }

      // 2. Check Max Hold (Relative to strategy timeframe)
      const strategyTf = trade.timeframe || "15m";
      const tfMultiplier =
        strategyTf === "1m" ? 1 : strategyTf === "5m" ? 5 : strategyTf === "15m" ? 15 : 60;

      if (
        !exitReason &&
        (tick.timestamp - trade.timestamp) / (60 * 1000) >= this.config.maxHoldBars * tfMultiplier
      ) {
        exitReason = "MAX_HOLD";
        exitPrice = tick.close;
      }

      // 3. Trailing Stop & Advanced Management
      if (!exitReason) {
        const atr = (trade as any).atr || 1.0;
        const distToTarget = Math.abs(trade.targetPrice - trade.entryPrice);
        const isLong = trade.direction === "LONG";
        const initialRisk =
          trade.initialStopDist || Math.abs(trade.entryPrice - trade.stopPrice) || 0.01;
        const currentGainR =
          (isLong ? tick.close - trade.entryPrice : trade.entryPrice - tick.close) / initialRisk;

        // A. Breakeven Logic (Move stop to entry after 1R move)
        if (!trade.breakevenTriggered && currentGainR >= 1.0) {
          trade.stopPrice = trade.entryPrice;
          trade.breakevenTriggered = true;
          console.log(
            `[Trade Management] ${trade.symbol} ${trade.detector}: Breakeven Triggered at ${tick.close}`
          );
        }

        // B. Trimming Logic (Partial Profit at 1.2R)
        if (!trade.isTrimmed && currentGainR >= 1.2) {
          trade.isTrimmed = true;
          // In a real system we'd sell half. Here we just flag it for PnL adjustment.
          console.log(
            `[Trade Management] ${trade.symbol} ${trade.detector}: Trimmed 50% at ${tick.close} (1.2R)`
          );
        }

        // C. Trailing Stop Logic
        if (this.config.enableTrailingStop) {
          const trailR = 1.5; // Trail by 1.5 ATR
          if (trade.direction === "LONG") {
            const newStop = tick.close - atr * trailR;
            if (newStop > trade.stopPrice) {
              trade.stopPrice = newStop;
            }
          } else {
            const newStop = tick.close + atr * trailR;
            if (newStop < trade.stopPrice) {
              trade.stopPrice = newStop;
            }
          }
        }
      }

      if (exitReason) {
        this.closeTrade(trade, exitPrice, tick.timestamp, exitReason);
        this.activeTrades.splice(i, 1); // Remove from active
      }
    }
  }

  private closeTrade(trade: BacktestTrade, price: number, timestamp: number, reason: any) {
    // Calculate PnL
    const isLong = trade.direction === "LONG";
    const initialRisk =
      trade.initialStopDist || Math.abs(trade.entryPrice - trade.stopPrice) || 0.01;
    let finalPnlRaw: number;

    if (trade.isTrimmed) {
      // Half exited at 1.2R (approx), half at current price
      const trimR = 1.2;
      const trimPnl = initialRisk * trimR;
      const remainingPnl = isLong ? price - trade.entryPrice : trade.entryPrice - price;
      finalPnlRaw = trimPnl * 0.5 + remainingPnl * 0.5;
    } else {
      finalPnlRaw = isLong ? price - trade.entryPrice : trade.entryPrice - price;
    }

    // Apply slippage (simple model for now)
    const slippage = trade.entryPrice * (this.config.slippage || 0.001);
    const finalPnl = finalPnlRaw - slippage;

    const completed: BacktestTrade = {
      ...trade,
      exitPrice: price,
      exitTimestamp: timestamp,
      exitReason: reason,
      pnl: finalPnl,
      pnlPercent: (finalPnl / trade.entryPrice) * 100,
      // Calculate R-Multiple (final weighted R)
      rMultiple: finalPnl / (trade.initialStopDist || 0.01),
      barsHeld: Math.floor(
        (timestamp - trade.timestamp) /
          (tfMap[trade.timeframe as keyof typeof tfMap] || 15 * 60 * 1000)
      ),
    };

    console.log(
      `[Trade Exit] ${trade.symbol} ${trade.detector} ${trade.direction}: ${reason} PnL=${completed.pnlPercent.toFixed(2)}% R=${completed.rMultiple.toFixed(2)} ${trade.isTrimmed ? "(Trimmed)" : ""}`
    );

    this.completedTrades.push(completed);
  }

  private syncContext(
    timestamp: number,
    data: Map<Timeframe, Bar[]>,
    pointers: Record<Timeframe, number>
  ): SymbolFeatures {
    // 1. Advance pointers to sync with tick timestamp
    const timeframes: Timeframe[] = ["5m", "15m", "60m"];

    for (const tf of timeframes) {
      if (!data.has(tf)) continue;
      const bars = data.get(tf)!;

      if (bars.length === 0) continue; // Safety check

      // Advance pointer until next bar is in the future
      while (pointers[tf] < bars.length - 1) {
        const nextBar = bars[pointers[tf] + 1];
        if (!nextBar || nextBar.timestamp > timestamp) break;
        pointers[tf]++;
      }
    }

    // 2. Build MTF features object
    // This provides "last closed bar" data for higher timeframes
    const mtfFeatures: any = {};
    for (const tf of timeframes) {
      if (!data.has(tf)) continue;
      const bars = data.get(tf)!;
      const idx = pointers[tf];
      // Only include if we have at least one bar closed
      if (idx >= 0 && bars[idx] && bars[idx].timestamp <= timestamp) {
        const bar = bars[idx];
        mtfFeatures[tf] = {
          price: {
            current: bar.close,
            open: bar.open,
            high: bar.high,
            low: bar.low,
          },
          // TODO: Add calc indicators for MTF if needed
        };
      }
    }

    return {
      symbol: "", // Filled by caller
      time: new Date(timestamp).toISOString(),
      price: {
        current: 0, // Filled by caller
      },
      mtf: mtfFeatures,
    };
  }

  private extractMTFBars(
    data: Map<Timeframe, Bar[]>,
    pointers: Record<Timeframe, number>
  ): Record<Timeframe, Bar[]> {
    const result: any = {};
    const timeframes: Timeframe[] = ["5m", "15m", "60m"];

    for (const tf of timeframes) {
      if (!data.has(tf)) continue;
      const bars = data.get(tf)!;
      const idx = pointers[tf];
      // Provide all history up to the current pointer (inclusive) for indicator calc
      if (idx >= 0) {
        result[tf] = bars.slice(0, idx + 1);
      } else {
        result[tf] = [];
      }
    }
    return result;
  }

  private async scanForEntry(
    symbol: string,
    detector: any,
    tick: Bar,
    mtfContext: Record<string, Bar[]>,
    history1m: Bar[],
    mtfbars: Record<string, Bar[]>,
    flowData: any[],
    nextBar?: Bar // CRITICAL: Pass next bar for lookahead-free entry
  ) {
    // --- 1. Resolution Check (Accurate Win Rate exploration) ---
    // Some strategies are Scalps (1m/5m), Swings (1h), or Day Trades (15m)
    const strategyTf = detector.idealTimeframe || "15m";
    const tfMs = tfMap[strategyTf as keyof typeof tfMap] || 15 * 60 * 1000;

    // Only trigger signal detection at the CLOSE of the strategy's bar
    const isBarClose = tick.timestamp % tfMs === 0;
    if (!isBarClose) return;

    // --- 2. Build Features ---
    // Reconstruct full features using centralized Builder
    // This ensures parity with live trading engine logic
    const features = FeaturesBuilder.build(
      symbol,
      tick,
      history1m,
      mtfContext,
      flowData // Passed as an argument
    );

    // 2. Run detector
    const result = detector.detectWithScore(features);

    if (result.detected && result.baseScore >= 40) {
      // Threshold for report
      // CRITICAL FIX: Entry must be on NEXT bar's open to avoid lookahead bias
      // Signal fires at bar[i].close, we enter at bar[i+1].open
      if (!nextBar) {
        // Cannot enter without knowing next bar - signal at end of data
        console.log(
          `[EventEngine] Signal detected at end of data, no next bar available for ${symbol}`
        );
        return;
      }

      const entryPrice = nextBar.open; // NOT tick.close!
      const atr = features.pattern?.atr ? Number(features.pattern.atr) : 1.0;

      // Calculate dynamic stops (Basic ATR logic for MVP)
      let stopPrice = 0;
      let targetPrice = 0;
      const targetR = this.config.targetMultiple || 2.0;
      const stopR = this.config.stopMultiple || 1.0;

      if (detector.direction === "LONG") {
        stopPrice = entryPrice - atr * stopR;
        targetPrice = entryPrice + atr * targetR;

        // Volatility-Adaptive Minimum Stop (Prevent noise-outs)
        // Enforce at least 0.5% or 1.5x 1m ATR if available
        const minStopDist = entryPrice * 0.005;
        if (entryPrice - stopPrice < minStopDist) {
          stopPrice = entryPrice - minStopDist;
        }
      } else {
        stopPrice = entryPrice + atr * stopR;
        targetPrice = entryPrice - atr * targetR;

        const minStopDist = entryPrice * 0.005;
        if (stopPrice - entryPrice < minStopDist) {
          stopPrice = entryPrice + minStopDist;
        }
      }

      const trade: BacktestTrade = {
        timestamp: nextBar.timestamp, // Use ENTRY bar's timestamp, not signal bar
        symbol: symbol,
        detector: detector.type,
        direction: detector.direction,
        entryPrice: entryPrice,
        targetPrice: targetPrice,
        stopPrice: stopPrice,
        exitPrice: 0,
        exitTimestamp: 0,
        exitReason: "MAX_HOLD", // default
        pnl: 0,
        pnlPercent: 0,
        rMultiple: 0,
        barsHeld: 0,
        atr: atr, // Store for trailing stop logic
        marketRegime: features.regime,
        timeframe: strategyTf,
        initialStopDist: Math.abs(entryPrice - stopPrice),
      } as any;

      this.activeTrades.push(trade);
    }
  }

  private calculateStats(detectorName: string, trades: BacktestTrade[] = []): BacktestStats {
    const total = trades.length;
    if (total === 0) {
      return {
        detector: detectorName,
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
    const losers = trades.filter((t) => t.pnl <= 0);

    const totalWin = winners.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));

    const totalPnlPercent = trades.reduce((sum, t) => sum + t.pnlPercent, 0);
    const avgR = trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / total;

    return {
      detector: detectorName,
      totalTrades: total,
      winners: winners.length,
      losers: losers.length,
      breakeven: 0,
      winRate: winners.length / total,
      totalPnl: trades.reduce((sum, t) => sum + t.pnl, 0),
      totalPnlPercent,
      avgWin:
        winners.length > 0 ? winners.reduce((sum, t) => sum + t.pnlPercent, 0) / winners.length : 0,
      avgLoss:
        losers.length > 0 ? losers.reduce((sum, t) => sum + t.pnlPercent, 0) / losers.length : 0,
      largestWin: winners.length > 0 ? Math.max(...winners.map((t) => t.pnlPercent)) : 0,
      largestLoss: losers.length > 0 ? Math.min(...losers.map((t) => t.pnlPercent)) : 0,
      profitFactor: totalLoss === 0 ? (totalWin > 0 ? 10 : 0) : totalWin / totalLoss,
      expectancy: avgR,
      avgRMultiple: avgR,
      avgBarsHeld: trades.reduce((sum, t) => sum + t.barsHeld, 0) / total,
      avgWinBars:
        winners.length > 0 ? winners.reduce((sum, t) => sum + t.barsHeld, 0) / winners.length : 0,
      avgLossBars:
        losers.length > 0 ? losers.reduce((sum, t) => sum + t.barsHeld, 0) / losers.length : 0,
      trades: trades,
    };
  }
}
