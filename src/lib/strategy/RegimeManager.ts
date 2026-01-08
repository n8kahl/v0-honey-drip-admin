import { SymbolFeatures } from "./engine.js";

export type MarketRegime =
  | "STRONG_UPTREND"
  | "WEAK_UPTREND"
  | "CHOPPY"
  | "WEAK_DOWNTREND"
  | "STRONG_DOWNTREND"
  | "EXTREME_VOLATILITY";

export class RegimeManager {
  /**
   * Determine the current market regime based on price action and moving averages
   */
  static classify(features: SymbolFeatures): MarketRegime {
    const price = features.price.current;
    const ema21 = features.ema?.["21"];
    const ema50 = features.ema?.["50"];
    const ema200 = features.ema?.["200"];
    const rsi = features.rsi?.["14"] ?? 50;
    const atr = features.atr ?? 1.0;

    if (!ema21 || !ema50) return "CHOPPY";

    // Volatility check
    const atrPct = (atr / price) * 100;
    if (atrPct > 3.5) return "EXTREME_VOLATILITY";

    // Trend checks
    const isAboveCloud = price > ema21 && price > ema50;
    const isBelowCloud = price < ema21 && price < ema50;
    const isTieredUp = ema21 > ema50 && (ema200 ? ema50 > ema200 : true);
    const isTieredDown = ema21 < ema50 && (ema200 ? ema50 < ema200 : true);

    if (isAboveCloud && isTieredUp) {
      return rsi > 60 ? "STRONG_UPTREND" : "WEAK_UPTREND";
    }

    if (isBelowCloud && isTieredDown) {
      return rsi < 40 ? "STRONG_DOWNTREND" : "WEAK_DOWNTREND";
    }

    return "CHOPPY";
  }

  /**
   * Get an adjustment factor for thresholds based on regime
   */
  static getScoreAdjustment(regime: MarketRegime): number {
    switch (regime) {
      case "STRONG_UPTREND":
      case "STRONG_DOWNTREND":
        return 0; // Standard thresholds
      case "WEAK_UPTREND":
      case "WEAK_DOWNTREND":
        return 5; // Slightly harder to enter
      case "CHOPPY":
        return 15; // Much harder to enter (require high confluence)
      case "EXTREME_VOLATILITY":
        return 20; // Very hard to enter
      default:
        return 0;
    }
  }
}
