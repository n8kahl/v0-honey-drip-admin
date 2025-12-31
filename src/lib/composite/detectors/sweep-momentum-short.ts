import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Sweep Momentum Short Detector - FLOW-PRIMARY
 *
 * Uses institutional options flow (sweeps, blocks) as PRIMARY signal.
 * Technical indicators are SECONDARY confirmation only.
 *
 * This detector follows smart money:
 * - Multiple bearish sweeps = institutional selling pressure
 * - High flow score = concentrated institutional activity
 * - Buy pressure < 40% = aggressive put buying / call selling
 *
 * Expected Frequency: 2-5 signals/day when flow is active
 */
export const sweepMomentumShortDetector: OpportunityDetector = createDetector({
  type: "sweep_momentum_short",
  direction: "SHORT",
  assetClass: ["INDEX", "EQUITY_ETF"],
  requiresOptionsData: false, // Uses features.flow, not live options chain

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours)
    const shouldRun = shouldRunDetector(features);
    if (!shouldRun) {
      console.log(`[sweep-momentum-short] ${symbol}: ❌ Outside market hours`);
      return false;
    }

    // 2. PRIMARY: Require flow data
    const flow = features.flow;
    if (!flow) {
      console.log(`[sweep-momentum-short] ${symbol}: ❌ No flow data available`);
      return false;
    }

    // 3. PRIMARY: Multiple bearish sweeps in last hour (minimum 2)
    // Note: We check sweepCount but combine with bearish bias
    if (flow.sweepCount < 2) {
      console.log(
        `[sweep-momentum-short] ${symbol}: ❌ Insufficient sweeps (${flow.sweepCount} < 2)`
      );
      return false;
    }

    // 4. PRIMARY: Flow bias must be bearish
    if (flow.flowBias !== "bearish") {
      console.log(`[sweep-momentum-short] ${symbol}: ❌ Flow bias not bearish (${flow.flowBias})`);
      return false;
    }

    // 5. PRIMARY: Flow score must indicate strong institutional activity (70+)
    if (flow.flowScore < 70) {
      console.log(
        `[sweep-momentum-short] ${symbol}: ❌ Flow score too low (${flow.flowScore} < 70)`
      );
      return false;
    }

    // 6. PRIMARY: Buy pressure must be low (< 40%) = aggressive put buying
    if (flow.buyPressure !== undefined && flow.buyPressure > 40) {
      console.log(
        `[sweep-momentum-short] ${symbol}: ❌ Buy pressure too high (${flow.buyPressure}% > 40%)`
      );
      return false;
    }

    // 7. SECONDARY: Not extremely oversold (RSI > 20)
    const rsi = features.rsi?.["14"];
    if (rsi && rsi < 20) {
      console.log(`[sweep-momentum-short] ${symbol}: ❌ RSI oversold (${rsi.toFixed(1)} < 20)`);
      return false;
    }

    // 8. SECONDARY: Not in strong uptrend unless divergence present
    const regime = features.pattern?.market_regime;
    if (regime === "trending_up") {
      const div = features.divergence;
      if (!div || div.type !== "bearish") {
        console.log(`[sweep-momentum-short] ${symbol}: ❌ Uptrend without bearish divergence`);
        return false;
      }
      console.log(`[sweep-momentum-short] ${symbol}: ⚠️ Uptrend but bearish divergence detected`);
    }

    const sellPressure = flow.buyPressure !== undefined ? 100 - flow.buyPressure : 0;
    console.log(
      `[sweep-momentum-short] ${symbol}: ✅ SIGNAL - ${flow.sweepCount} sweeps, ` +
        `${flow.flowScore} flow score, ${sellPressure.toFixed(0)}% sell pressure`
    );
    return true;
  },

  scoreFactors: [
    {
      name: "sweep_intensity",
      weight: 0.35, // Flow is PRIMARY
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        // More sweeps = stronger institutional conviction
        if (flow.sweepCount >= 5) return 100;
        if (flow.sweepCount >= 4) return 90;
        if (flow.sweepCount >= 3) return 80;
        if (flow.sweepCount >= 2) return 70;

        return 0;
      },
    },
    {
      name: "flow_score",
      weight: 0.3,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        if (flow.flowScore >= 90) return 100;
        if (flow.flowScore >= 80) return 90;
        if (flow.flowScore >= 70) return 80;

        return Math.max(0, flow.flowScore);
      },
    },
    {
      name: "sell_pressure",
      weight: 0.2,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow || flow.buyPressure === undefined) return 50;

        // Low buy pressure = high sell pressure (bearish)
        const sellPressure = 100 - flow.buyPressure;

        if (sellPressure >= 80) return 100;
        if (sellPressure >= 70) return 90;
        if (sellPressure >= 60) return 80;

        return Math.max(0, sellPressure);
      },
    },
    {
      name: "technical_alignment",
      weight: 0.15, // Technical is SECONDARY
      evaluate: (features) => {
        let score = 50;

        const rsi = features.rsi?.["14"];
        const vwapDist = features.vwap?.distancePct;

        // Overbought + bearish flow = excellent entry
        if (rsi && rsi > 70) score += 25;
        else if (rsi && rsi > 60) score += 15;

        // Above VWAP + bearish flow = short at resistance
        if (vwapDist && vwapDist > 0.3) score += 25;
        else if (vwapDist && vwapDist > 0) score += 10;

        return Math.min(100, score);
      },
    },
  ],
});
