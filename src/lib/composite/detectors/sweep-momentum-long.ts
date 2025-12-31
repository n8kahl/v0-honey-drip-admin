import type { SymbolFeatures } from "../../strategy/engine.js";
import { createDetector, type OpportunityDetector } from "../OpportunityDetector.js";
import { shouldRunDetector } from "./utils.js";

/**
 * Sweep Momentum Long Detector - FLOW-PRIMARY
 *
 * Uses institutional options flow (sweeps, blocks) as PRIMARY signal.
 * Technical indicators are SECONDARY confirmation only.
 *
 * This detector follows smart money:
 * - Multiple bullish sweeps = institutional buying pressure
 * - High flow score = concentrated institutional activity
 * - Buy pressure > 60% = aggressive call buying
 *
 * Expected Frequency: 2-5 signals/day when flow is active
 */
export const sweepMomentumLongDetector: OpportunityDetector = createDetector({
  type: "sweep_momentum_long",
  direction: "LONG",
  assetClass: ["INDEX", "EQUITY_ETF"],
  requiresOptionsData: false, // Uses features.flow, not live options chain

  detect: (features: SymbolFeatures) => {
    const symbol = (features as any).symbol || "UNKNOWN";

    // 1. Check if detector should run (market hours)
    const shouldRun = shouldRunDetector(features);
    if (!shouldRun) {
      console.log(`[sweep-momentum-long] ${symbol}: ❌ Outside market hours`);
      return false;
    }

    // 2. PRIMARY: Require flow data
    const flow = features.flow;
    if (!flow) {
      console.log(`[sweep-momentum-long] ${symbol}: ❌ No flow data available`);
      return false;
    }

    // 3. PRIMARY: Multiple bullish sweeps in last hour (minimum 2)
    if (flow.sweepCount < 2) {
      console.log(
        `[sweep-momentum-long] ${symbol}: ❌ Insufficient sweeps (${flow.sweepCount} < 2)`
      );
      return false;
    }

    // 4. PRIMARY: Flow bias must be bullish
    if (flow.flowBias !== "bullish") {
      console.log(`[sweep-momentum-long] ${symbol}: ❌ Flow bias not bullish (${flow.flowBias})`);
      return false;
    }

    // 5. PRIMARY: Flow score must indicate strong institutional activity (70+)
    if (flow.flowScore < 70) {
      console.log(
        `[sweep-momentum-long] ${symbol}: ❌ Flow score too low (${flow.flowScore} < 70)`
      );
      return false;
    }

    // 6. PRIMARY: Buy pressure must be dominant (60%+)
    if (flow.buyPressure && flow.buyPressure < 60) {
      console.log(
        `[sweep-momentum-long] ${symbol}: ❌ Buy pressure too low (${flow.buyPressure}% < 60%)`
      );
      return false;
    }

    // 7. SECONDARY: Not extremely overbought (RSI < 80)
    const rsi = features.rsi?.["14"];
    if (rsi && rsi > 80) {
      console.log(`[sweep-momentum-long] ${symbol}: ❌ RSI overbought (${rsi.toFixed(1)} > 80)`);
      return false;
    }

    // 8. SECONDARY: Not in extreme downtrend unless divergence present
    const regime = features.pattern?.market_regime;
    if (regime === "trending_down") {
      const div = features.divergence;
      if (!div || div.type !== "bullish") {
        console.log(`[sweep-momentum-long] ${symbol}: ❌ Downtrend without bullish divergence`);
        return false;
      }
      console.log(`[sweep-momentum-long] ${symbol}: ⚠️ Downtrend but bullish divergence detected`);
    }

    console.log(
      `[sweep-momentum-long] ${symbol}: ✅ SIGNAL - ${flow.sweepCount} sweeps, ` +
        `${flow.flowScore} flow score, ${flow.buyPressure?.toFixed(0)}% buy pressure`
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

        return 0; // Should not reach here (detect() requires >= 2)
      },
    },
    {
      name: "flow_score",
      weight: 0.3,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow) return 0;

        // Higher flow score = stronger institutional activity
        if (flow.flowScore >= 90) return 100;
        if (flow.flowScore >= 80) return 90;
        if (flow.flowScore >= 70) return 80;

        return Math.max(0, flow.flowScore);
      },
    },
    {
      name: "buy_pressure",
      weight: 0.2,
      evaluate: (features) => {
        const flow = features.flow;
        if (!flow || flow.buyPressure === undefined) return 50;

        // Strong buy pressure = aggressive institutional buying
        if (flow.buyPressure >= 80) return 100;
        if (flow.buyPressure >= 70) return 90;
        if (flow.buyPressure >= 60) return 80;

        return Math.max(0, flow.buyPressure);
      },
    },
    {
      name: "technical_alignment",
      weight: 0.15, // Technical is SECONDARY
      evaluate: (features) => {
        let score = 50; // Base score

        const rsi = features.rsi?.["14"];
        const vwapDist = features.vwap?.distancePct;

        // Oversold + bullish flow = excellent entry
        if (rsi && rsi < 40) score += 25;
        else if (rsi && rsi < 50) score += 15;

        // Below VWAP + bullish flow = value entry
        if (vwapDist && vwapDist < -0.3) score += 25;
        else if (vwapDist && vwapDist < 0) score += 10;

        return Math.min(100, score);
      },
    },
  ],
});
