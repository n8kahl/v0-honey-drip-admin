import { Trade } from "../../types";
import { ChartLevel, ChartLevelType } from "../../types/tradeLevels";
import { RiskCalculationInput, RiskCalculationResult, KeyLevels } from "./types";
import { calculateRisk } from "./calculator";

/**
 * Live option prices for calculating chart levels
 */
interface LiveOptionPrices {
  targetPrice?: number; // Option TP price from liveModel
  stopLoss?: number; // Option SL price from liveModel
  currentMid?: number; // Current option mid price from liveModel
}

/**
 * Build chart levels for a trade based on risk engine context
 *
 * IMPORTANT: Chart displays UNDERLYING stock prices, so we must use
 * underlying price fields (targetUnderlyingPrice, stopUnderlyingPrice)
 * rather than option premium prices (targetPrice, stopLoss).
 *
 * If underlying prices aren't stored, calculate them from option prices + delta.
 *
 * @param trade - The trade object
 * @param keyLevels - Key market levels (VWAP, ORB, etc.)
 * @param riskResult - Optional risk calculation result
 * @param currentUnderlyingPrice - Current underlying price for calculations
 * @param liveOptionPrices - Live option prices from useActiveTradeLiveModel
 */
export function buildChartLevelsForTrade(
  trade: Trade,
  keyLevels: KeyLevels | undefined,
  riskResult?: RiskCalculationResult,
  currentUnderlyingPrice?: number,
  liveOptionPrices?: LiveOptionPrices
): ChartLevel[] {
  const levels: ChartLevel[] = [];

  // Get reference underlying price and delta for calculations
  // Try stored values first, then fallback to current price
  const baseUnderlyingPrice =
    trade.underlyingAtEntry || trade.underlyingPriceAtLoad || currentUnderlyingPrice || 0;
  const delta = trade.contract?.delta || trade.deltaAtEntry || 0.5;
  const isCall = trade.contract?.type === "C";

  // For option price to underlying calculation, use current mid as reference
  const referenceOptionPrice =
    liveOptionPrices?.currentMid || trade.entryPrice || trade.contract?.mid || 0;

  // Get TP/SL option prices - prefer live model values, fallback to trade values
  const targetOptionPrice = liveOptionPrices?.targetPrice || trade.targetPrice;
  const stopOptionPrice = liveOptionPrices?.stopLoss || trade.stopLoss;

  /**
   * Calculate underlying price from option price change using delta
   * Uses current underlying as reference point
   * For calls: underlying increases when option increases
   * For puts: underlying decreases when option increases (negative delta)
   */
  function calculateUnderlyingFromOption(optionPrice: number): number | null {
    if (!baseUnderlyingPrice || !referenceOptionPrice || !delta) {
      return null;
    }
    const optionChange = optionPrice - referenceOptionPrice;
    // Use absolute delta for calculation, direction handled by call/put logic
    const underlyingChange = optionChange / Math.abs(delta);
    // For calls: positive option change = positive underlying change
    // For puts: positive option change = negative underlying change
    return baseUnderlyingPrice + (isCall ? underlyingChange : -underlyingChange);
  }

  // Entry level - use underlying price at entry or load time
  if (baseUnderlyingPrice > 0) {
    levels.push({
      type: "ENTRY",
      label: "Entry",
      price: baseUnderlyingPrice,
    });
  }

  // TP level - prefer stored underlying price, otherwise calculate from option price
  let tpUnderlyingPrice = trade.targetUnderlyingPrice;
  if (!tpUnderlyingPrice && targetOptionPrice && baseUnderlyingPrice > 0) {
    tpUnderlyingPrice = calculateUnderlyingFromOption(targetOptionPrice) ?? undefined;
  }
  if (tpUnderlyingPrice && tpUnderlyingPrice > 0) {
    levels.push({
      type: "TP",
      label: "TP1",
      price: tpUnderlyingPrice,
      meta: {
        tpIndex: 1,
        reason: riskResult?.reasoning,
      },
    });
  }

  // TP2 if available (underlying price)
  if (trade.targetUnderlyingPrice2 && trade.targetUnderlyingPrice2 > 0) {
    levels.push({
      type: "TP",
      label: "TP2",
      price: trade.targetUnderlyingPrice2,
      meta: {
        tpIndex: 2,
      },
    });
  }

  // TP3 if available (from extended risk result or trade)
  const tp3 = (riskResult as any)?.targetPrice3 || (trade as any)?.targetPrice3;
  if (tp3) {
    levels.push({
      type: "TP",
      label: "TP3",
      price: tp3,
      meta: {
        tpIndex: 3,
      },
    });
  }

  // SL level - prefer stored underlying price, otherwise calculate from option price
  let slUnderlyingPrice = trade.stopUnderlyingPrice;
  if (!slUnderlyingPrice && stopOptionPrice && baseUnderlyingPrice > 0) {
    slUnderlyingPrice = calculateUnderlyingFromOption(stopOptionPrice) ?? undefined;
  }
  if (slUnderlyingPrice && slUnderlyingPrice > 0) {
    levels.push({
      type: "SL",
      label: "SL",
      price: slUnderlyingPrice,
      meta: {
        reason: riskResult?.reasoning,
      },
    });
  }

  // Return early if no keyLevels provided
  if (!keyLevels) {
    return levels;
  }

  // Add key levels if they exist and are meaningful
  if (keyLevels.preMarketHigh && keyLevels.preMarketHigh > 0) {
    levels.push({
      type: "PREMARKET_HIGH",
      label: "PM High",
      price: keyLevels.preMarketHigh,
    });
  }

  if (keyLevels.preMarketLow && keyLevels.preMarketLow > 0) {
    levels.push({
      type: "PREMARKET_LOW",
      label: "PM Low",
      price: keyLevels.preMarketLow,
    });
  }

  if (keyLevels.orbHigh && keyLevels.orbHigh > 0) {
    levels.push({
      type: "ORB_HIGH",
      label: "ORB High",
      price: keyLevels.orbHigh,
    });
  }

  if (keyLevels.orbLow && keyLevels.orbLow > 0) {
    levels.push({
      type: "ORB_LOW",
      label: "ORB Low",
      price: keyLevels.orbLow,
    });
  }

  if (keyLevels.priorDayHigh && keyLevels.priorDayHigh > 0) {
    levels.push({
      type: "PREV_DAY_HIGH",
      label: "PDH",
      price: keyLevels.priorDayHigh,
    });
  }

  if (keyLevels.priorDayLow && keyLevels.priorDayLow > 0) {
    levels.push({
      type: "PREV_DAY_LOW",
      label: "PDL",
      price: keyLevels.priorDayLow,
    });
  }

  if (keyLevels.vwap && keyLevels.vwap > 0) {
    levels.push({
      type: "VWAP",
      label: "VWAP",
      price: keyLevels.vwap,
    });
  }

  if (keyLevels.vwapUpperBand && keyLevels.vwapUpperBand > 0) {
    levels.push({
      type: "VWAP_BAND",
      label: "VWAP +1σ",
      price: keyLevels.vwapUpperBand,
    });
  }

  if (keyLevels.vwapLowerBand && keyLevels.vwapLowerBand > 0) {
    levels.push({
      type: "VWAP_BAND",
      label: "VWAP -1σ",
      price: keyLevels.vwapLowerBand,
    });
  }

  if (keyLevels.bollingerUpper && keyLevels.bollingerUpper > 0) {
    levels.push({
      type: "BOLLINGER",
      label: "BB Upper",
      price: keyLevels.bollingerUpper,
    });
  }

  if (keyLevels.bollingerLower && keyLevels.bollingerLower > 0) {
    levels.push({
      type: "BOLLINGER",
      label: "BB Lower",
      price: keyLevels.bollingerLower,
    });
  }

  return levels;
}

/**
 * Build chart levels for an "about to enter" candidate
 */
export function buildChartLevelsForCandidate(
  ticker: string,
  currentPrice: number,
  keyLevels: KeyLevels,
  riskInput: RiskCalculationInput
): ChartLevel[] {
  const levels: ChartLevel[] = [];

  // Calculate TP/SL
  const riskResult = calculateRisk(riskInput);

  // Add TP levels - use UNDERLYING prices for chart display
  // riskResult.targetUnderlyingPrice is the underlying price where option hits TP
  if (riskResult.targetUnderlyingPrice && riskResult.targetUnderlyingPrice > 0) {
    levels.push({
      type: "TP",
      label: "TP1",
      price: riskResult.targetUnderlyingPrice,
      meta: {
        tpIndex: 1,
        reason: riskResult.reasoning,
      },
    });
  }

  // TP2 if available (underlying price)
  if (
    (riskResult as any).targetUnderlyingPrice2 &&
    (riskResult as any).targetUnderlyingPrice2 > 0
  ) {
    levels.push({
      type: "TP",
      label: "TP2",
      price: (riskResult as any).targetUnderlyingPrice2,
      meta: {
        tpIndex: 2,
      },
    });
  }

  // TP3 if available (from extended risk result)
  const tp3 = (riskResult as any)?.targetUnderlyingPrice3;
  if (tp3 && tp3 > 0) {
    levels.push({
      type: "TP",
      label: "TP3",
      price: tp3,
      meta: {
        tpIndex: 3,
      },
    });
  }

  // Add SL - use UNDERLYING price for chart display
  if (riskResult.stopUnderlyingPrice && riskResult.stopUnderlyingPrice > 0) {
    levels.push({
      type: "SL",
      label: "SL",
      price: riskResult.stopUnderlyingPrice,
      meta: {
        reason: riskResult.reasoning,
      },
    });
  }

  // Add key levels (same as above)
  if (keyLevels.preMarketHigh && keyLevels.preMarketHigh > 0) {
    levels.push({
      type: "PREMARKET_HIGH",
      label: "PM High",
      price: keyLevels.preMarketHigh,
    });
  }

  if (keyLevels.preMarketLow && keyLevels.preMarketLow > 0) {
    levels.push({
      type: "PREMARKET_LOW",
      label: "PM Low",
      price: keyLevels.preMarketLow,
    });
  }

  if (keyLevels.orbHigh && keyLevels.orbHigh > 0) {
    levels.push({
      type: "ORB_HIGH",
      label: "ORB High",
      price: keyLevels.orbHigh,
    });
  }

  if (keyLevels.orbLow && keyLevels.orbLow > 0) {
    levels.push({
      type: "ORB_LOW",
      label: "ORB Low",
      price: keyLevels.orbLow,
    });
  }

  if (keyLevels.priorDayHigh && keyLevels.priorDayHigh > 0) {
    levels.push({
      type: "PREV_DAY_HIGH",
      label: "PDH",
      price: keyLevels.priorDayHigh,
    });
  }

  if (keyLevels.priorDayLow && keyLevels.priorDayLow > 0) {
    levels.push({
      type: "PREV_DAY_LOW",
      label: "PDL",
      price: keyLevels.priorDayLow,
    });
  }

  if (keyLevels.vwap && keyLevels.vwap > 0) {
    levels.push({
      type: "VWAP",
      label: "VWAP",
      price: keyLevels.vwap,
    });
  }

  if (keyLevels.vwapUpperBand && keyLevels.vwapUpperBand > 0) {
    levels.push({
      type: "VWAP_BAND",
      label: "VWAP +1σ",
      price: keyLevels.vwapUpperBand,
    });
  }

  if (keyLevels.vwapLowerBand && keyLevels.vwapLowerBand > 0) {
    levels.push({
      type: "VWAP_BAND",
      label: "VWAP -1σ",
      price: keyLevels.vwapLowerBand,
    });
  }

  if (keyLevels.bollingerUpper && keyLevels.bollingerUpper > 0) {
    levels.push({
      type: "BOLLINGER",
      label: "BB Upper",
      price: keyLevels.bollingerUpper,
    });
  }

  if (keyLevels.bollingerLower && keyLevels.bollingerLower > 0) {
    levels.push({
      type: "BOLLINGER",
      label: "BB Lower",
      price: keyLevels.bollingerLower,
    });
  }

  return levels;
}
