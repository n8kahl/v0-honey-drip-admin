import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Institutional Flow Alert Detector - FLOW ONLY (No Technical Confirmation)
 *
 * Phase 6: Triggers on strong institutional flow ALONE without requiring
 * technical setup confirmation. This is higher risk but catches pure
 * smart money moves that may precede technical setups.
 *
 * Requirements (ALL must be met):
 * - Institutional score >= 80 (very strong activity)
 * - Sweep count >= 5 (multiple aggressive orders)
 * - Buy/Sell pressure >= 70% (dominant directional bias)
 * - Large trade percentage >= 40% (institutional size)
 * - Aggressiveness: AGGRESSIVE or VERY_AGGRESSIVE
 *
 * Risk Warning: Flow-only signals - no technical confirmation
 * Expected Frequency: 1-3 signals/day (strong flow only)
 */

export const institutionalFlowBullishDetector: OpportunityDetector = createDetector({
  type: "institutional_flow_bullish",
  direction: "LONG",
  assetClass: ["INDEX", "EQUITY_ETF", "STOCK"],
  requiresOptionsData: false,
  idealTimeframe: "1m",

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours)
    const shouldRun = shouldRunDetector(features);
    if (!shouldRun) {
      return false;
    }

    // 2. Require flow data
    const flow = features.flow;
    if (!flow) {
      return false;
    }

    // 3. Institutional score must be very high (>= 80)
    if (flow.flowScore < 80) {
      return false;
    }

    // 4. Multiple sweeps (>= 5)
    if (flow.sweepCount < 5) {
      return false;
    }

    // 5. Strong buy pressure (>= 70%)
    if (!flow.buyPressure || flow.buyPressure < 70) {
      return false;
    }

    // 6. Large trade percentage (>= 40%) - institutional size
    if (!flow.largeTradePercentage || flow.largeTradePercentage < 40) {
      return false;
    }

    // 7. Aggressiveness check
    if (flow.aggressiveness !== "AGGRESSIVE" && flow.aggressiveness !== "VERY_AGGRESSIVE") {
      return false;
    }

    // 8. Flow bias must be bullish
    if (flow.flowBias !== "bullish") {
      return false;
    }

    console.log(
      `[institutional-flow-bullish] ${symbol}: ✅ FLOW ALERT - ` +
        `${flow.sweepCount} sweeps, ${flow.flowScore} inst score, ` +
        `${flow.buyPressure?.toFixed(0)}% buy pressure, ${flow.largeTradePercentage?.toFixed(0)}% large trades`
    );
    return true;
  },

  scoreFactors: [
    {
      name: "institutional_score",
      weight: 0.35,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.flowScore >= 95) return 100;
        if (flow.flowScore >= 90) return 95;
        if (flow.flowScore >= 85) return 90;
        if (flow.flowScore >= 80) return 85;

        return flow.flowScore;
      },
    },
    {
      name: "sweep_intensity",
      weight: 0.25,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.sweepCount >= 10) return 100;
        if (flow.sweepCount >= 8) return 95;
        if (flow.sweepCount >= 6) return 90;
        if (flow.sweepCount >= 5) return 85;

        return 0;
      },
    },
    {
      name: "buy_sell_pressure",
      weight: 0.2,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow || flow.buyPressure === undefined) return 0;

        if (flow.buyPressure >= 85) return 100;
        if (flow.buyPressure >= 80) return 95;
        if (flow.buyPressure >= 75) return 90;
        if (flow.buyPressure >= 70) return 85;

        return 0;
      },
    },
    {
      name: "large_trade_pct",
      weight: 0.15,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow || flow.largeTradePercentage === undefined) return 0;

        if (flow.largeTradePercentage >= 60) return 100;
        if (flow.largeTradePercentage >= 50) return 90;
        if (flow.largeTradePercentage >= 40) return 80;

        return 0;
      },
    },
    {
      name: "aggressiveness",
      weight: 0.05,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.aggressiveness === "VERY_AGGRESSIVE") return 100;
        if (flow.aggressiveness === "AGGRESSIVE") return 90;

        return 50;
      },
    },
  ],
});

export const institutionalFlowBearishDetector: OpportunityDetector = createDetector({
  type: "institutional_flow_bearish",
  direction: "SHORT",
  assetClass: ["INDEX", "EQUITY_ETF", "STOCK"],
  requiresOptionsData: false,
  idealTimeframe: "1m",

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours)
    const shouldRun = shouldRunDetector(features);
    if (!shouldRun) {
      return false;
    }

    // 2. Require flow data
    const flow = features.flow;
    if (!flow) {
      return false;
    }

    // 3. Institutional score must be very high (>= 80)
    if (flow.flowScore < 80) {
      return false;
    }

    // 4. Multiple sweeps (>= 5)
    if (flow.sweepCount < 5) {
      return false;
    }

    // 5. Strong sell pressure (buyPressure <= 30%, meaning 70%+ sell pressure)
    if (!flow.buyPressure || flow.buyPressure > 30) {
      return false;
    }

    // 6. Large trade percentage (>= 40%) - institutional size
    if (!flow.largeTradePercentage || flow.largeTradePercentage < 40) {
      return false;
    }

    // 7. Aggressiveness check
    if (flow.aggressiveness !== "AGGRESSIVE" && flow.aggressiveness !== "VERY_AGGRESSIVE") {
      return false;
    }

    // 8. Flow bias must be bearish
    if (flow.flowBias !== "bearish") {
      return false;
    }

    console.log(
      `[institutional-flow-bearish] ${symbol}: ✅ FLOW ALERT - ` +
        `${flow.sweepCount} sweeps, ${flow.flowScore} inst score, ` +
        `${(100 - flow.buyPressure)?.toFixed(0)}% sell pressure, ${flow.largeTradePercentage?.toFixed(0)}% large trades`
    );
    return true;
  },

  scoreFactors: [
    {
      name: "institutional_score",
      weight: 0.35,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.flowScore >= 95) return 100;
        if (flow.flowScore >= 90) return 95;
        if (flow.flowScore >= 85) return 90;
        if (flow.flowScore >= 80) return 85;

        return flow.flowScore;
      },
    },
    {
      name: "sweep_intensity",
      weight: 0.25,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.sweepCount >= 10) return 100;
        if (flow.sweepCount >= 8) return 95;
        if (flow.sweepCount >= 6) return 90;
        if (flow.sweepCount >= 5) return 85;

        return 0;
      },
    },
    {
      name: "buy_sell_pressure",
      weight: 0.2,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow || flow.buyPressure === undefined) return 0;

        // For bearish: lower buyPressure = higher sell pressure = better
        const sellPressure = 100 - flow.buyPressure;
        if (sellPressure >= 85) return 100;
        if (sellPressure >= 80) return 95;
        if (sellPressure >= 75) return 90;
        if (sellPressure >= 70) return 85;

        return 0;
      },
    },
    {
      name: "large_trade_pct",
      weight: 0.15,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow || flow.largeTradePercentage === undefined) return 0;

        if (flow.largeTradePercentage >= 60) return 100;
        if (flow.largeTradePercentage >= 50) return 90;
        if (flow.largeTradePercentage >= 40) return 80;

        return 0;
      },
    },
    {
      name: "aggressiveness",
      weight: 0.05,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.aggressiveness === "VERY_AGGRESSIVE") return 100;
        if (flow.aggressiveness === "AGGRESSIVE") return 90;

        return 50;
      },
    },
  ],
});
