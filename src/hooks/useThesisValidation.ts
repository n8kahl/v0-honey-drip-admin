import { useMemo } from "react";
import { Trade, SetupConditions } from "../types";
import { useMacroContext } from "./useIndicesAdvanced";
import { useKeyLevels } from "./useKeyLevels";
import { normalizeSymbolForAPI } from "../lib/symbolUtils";

interface ThesisValidationResult {
  isValid: boolean;
  score: number; // 0-100
  status: "valid" | "degraded" | "invalid";
  checks: ThesisCheck[];
  recommendation: string;
}

interface ThesisCheck {
  name: string;
  atEntry: string;
  current: string;
  status: "pass" | "warn" | "fail";
  weight: number;
}

/**
 * Capture current market conditions as setup conditions snapshot
 * This should be called when entering a trade to preserve the thesis
 */
export function captureSetupConditions(
  ticker: string,
  direction: "LONG" | "SHORT",
  keyLevels: any,
  macro: any
): SetupConditions {
  const now = new Date();

  return {
    // Technical setup - would need MTF data from market data store
    mtfAlignment: {
      m1: "neutral", // Would be populated from actual data
      m5: "neutral",
      m15: "neutral",
      m60: "neutral",
    },
    vwapPosition: keyLevels?.vwap
      ? keyLevels.currentPrice > keyLevels.vwap
        ? "above"
        : keyLevels.currentPrice < keyLevels.vwap
          ? "below"
          : "at"
      : undefined,
    orbPosition:
      keyLevels?.orbHigh && keyLevels?.orbLow
        ? keyLevels.currentPrice > keyLevels.orbHigh
          ? "above_high"
          : keyLevels.currentPrice < keyLevels.orbLow
            ? "below_low"
            : "inside"
        : undefined,
    // Market context
    vixLevel: macro?.vix?.level,
    marketRegime: macro?.marketRegime as SetupConditions["marketRegime"],
    // Flow/sentiment would come from options flow data
    flowBias: undefined,
    flowScore: undefined,
    // Volume would come from market data
    relativeVolume: undefined,
    capturedAt: now,
  };
}

/**
 * Hook to validate a trade's original thesis against current market conditions
 * Returns validation status and detailed breakdown
 */
export function useThesisValidation(trade: Trade | null): ThesisValidationResult {
  // Get current macro context
  const { macro } = useMacroContext(30000);

  // Get current key levels for the underlying (properly normalize for API)
  const underlyingTicker = trade?.ticker ? normalizeSymbolForAPI(trade.ticker) : "";
  const { keyLevels } = useKeyLevels(underlyingTicker, {
    timeframe: "5",
    lookbackDays: 5,
    enabled: Boolean(trade && trade.state === "ENTERED"),
  });

  return useMemo(() => {
    if (!trade || trade.state !== "ENTERED") {
      return {
        isValid: true,
        score: 100,
        status: "valid",
        checks: [],
        recommendation: "No active trade",
      };
    }

    const setupConditions = trade.setupConditions;
    const checks: ThesisCheck[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK 1: VIX Level Stability (Weight: 20)
    // ═══════════════════════════════════════════════════════════════════════
    const vixWeight = 20;
    totalWeight += vixWeight;

    // Ensure VIX values are proper numbers before using
    const vixAtEntryRaw = setupConditions?.vixLevel || trade.confluence?.factors?.regime?.value;
    const vixCurrentRaw = macro?.vix?.level;

    // Safely extract numeric values (might be objects or other types)
    const vixAtEntry =
      typeof vixAtEntryRaw === "number"
        ? vixAtEntryRaw
        : typeof vixAtEntryRaw === "object" && vixAtEntryRaw !== null && "value" in vixAtEntryRaw
          ? Number((vixAtEntryRaw as any).value)
          : undefined;
    const vixCurrent =
      typeof vixCurrentRaw === "number"
        ? vixCurrentRaw
        : typeof vixCurrentRaw === "object" && vixCurrentRaw !== null && "value" in vixCurrentRaw
          ? Number((vixCurrentRaw as any).value)
          : undefined;

    if (vixAtEntry && vixCurrent && !isNaN(vixAtEntry) && !isNaN(vixCurrent)) {
      const vixChange = Math.abs(vixCurrent - vixAtEntry);
      const vixChangePercent = (vixChange / vixAtEntry) * 100;

      let vixStatus: "pass" | "warn" | "fail";
      let vixScore: number;

      if (vixChangePercent < 10) {
        vixStatus = "pass";
        vixScore = vixWeight;
      } else if (vixChangePercent < 25) {
        vixStatus = "warn";
        vixScore = vixWeight * 0.5;
      } else {
        vixStatus = "fail";
        vixScore = 0;
      }

      totalScore += vixScore;
      checks.push({
        name: "VIX Stability",
        atEntry: vixAtEntry.toFixed(1),
        current: `${vixCurrent.toFixed(1)} (${vixChangePercent > 0 ? "+" : ""}${vixChangePercent.toFixed(1)}%)`,
        status: vixStatus,
        weight: vixWeight,
      });
    } else {
      // No VIX data - neutral
      totalScore += vixWeight * 0.5;
      checks.push({
        name: "VIX Stability",
        atEntry: "N/A",
        current: vixCurrent && !isNaN(vixCurrent) ? vixCurrent.toFixed(1) : "N/A",
        status: "warn",
        weight: vixWeight,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK 2: VWAP Position (Weight: 25)
    // ═══════════════════════════════════════════════════════════════════════
    const vwapWeight = 25;
    totalWeight += vwapWeight;

    const vwapAtEntry = setupConditions?.vwapPosition;
    const currentPrice = trade.currentPrice || keyLevels?.vwap;
    const vwap = keyLevels?.vwap;

    let vwapCurrentPosition: "above" | "below" | "at" | undefined;
    if (currentPrice && vwap) {
      const diff = (currentPrice - vwap) / vwap;
      if (diff > 0.001) vwapCurrentPosition = "above";
      else if (diff < -0.001) vwapCurrentPosition = "below";
      else vwapCurrentPosition = "at";
    }

    const isCall = trade.contract.type === "C";

    if (vwapCurrentPosition) {
      let vwapStatus: "pass" | "warn" | "fail";
      let vwapScore: number;

      // For calls, we want to be above VWAP; for puts, below
      const idealPosition = isCall ? "above" : "below";

      if (vwapCurrentPosition === idealPosition) {
        vwapStatus = "pass";
        vwapScore = vwapWeight;
      } else if (vwapCurrentPosition === "at") {
        vwapStatus = "warn";
        vwapScore = vwapWeight * 0.7;
      } else {
        vwapStatus = "fail";
        vwapScore = vwapWeight * 0.3;
      }

      totalScore += vwapScore;
      checks.push({
        name: "VWAP Position",
        atEntry: vwapAtEntry || "N/A",
        current: `${vwapCurrentPosition} (${isCall ? "Want above" : "Want below"})`,
        status: vwapStatus,
        weight: vwapWeight,
      });
    } else {
      totalScore += vwapWeight * 0.5;
      checks.push({
        name: "VWAP Position",
        atEntry: vwapAtEntry || "N/A",
        current: "N/A",
        status: "warn",
        weight: vwapWeight,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK 3: Price vs Entry (Weight: 25)
    // ═══════════════════════════════════════════════════════════════════════
    const priceWeight = 25;
    totalWeight += priceWeight;

    const entryPrice = trade.entryPrice || trade.contract.mid;
    const currentContractPrice = trade.currentPrice || trade.contract.mid;
    const pnlPercent = ((currentContractPrice - entryPrice) / entryPrice) * 100;

    let priceStatus: "pass" | "warn" | "fail";
    let priceScore: number;

    if (pnlPercent > 5) {
      priceStatus = "pass";
      priceScore = priceWeight;
    } else if (pnlPercent > -10) {
      priceStatus = "warn";
      priceScore = priceWeight * 0.6;
    } else {
      priceStatus = "fail";
      priceScore = priceWeight * 0.2;
    }

    totalScore += priceScore;
    checks.push({
      name: "Price Action",
      atEntry: `$${entryPrice.toFixed(2)}`,
      current: `$${currentContractPrice.toFixed(2)} (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%)`,
      status: priceStatus,
      weight: priceWeight,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK 4: Market Regime (Weight: 15)
    // ═══════════════════════════════════════════════════════════════════════
    const regimeWeight = 15;
    totalWeight += regimeWeight;

    const regimeAtEntry = setupConditions?.marketRegime;
    const regimeCurrent = macro?.marketRegime;

    if (regimeAtEntry && regimeCurrent) {
      let regimeStatus: "pass" | "warn" | "fail";
      let regimeScore: number;

      if (regimeAtEntry === regimeCurrent) {
        regimeStatus = "pass";
        regimeScore = regimeWeight;
      } else if (
        (regimeAtEntry === "trending" && regimeCurrent === "ranging") ||
        (regimeAtEntry === "ranging" && regimeCurrent === "trending")
      ) {
        regimeStatus = "warn";
        regimeScore = regimeWeight * 0.5;
      } else {
        regimeStatus = "fail";
        regimeScore = regimeWeight * 0.2;
      }

      totalScore += regimeScore;
      checks.push({
        name: "Market Regime",
        atEntry: regimeAtEntry,
        current: regimeCurrent,
        status: regimeStatus,
        weight: regimeWeight,
      });
    } else {
      totalScore += regimeWeight * 0.5;
      checks.push({
        name: "Market Regime",
        atEntry: regimeAtEntry || "N/A",
        current: regimeCurrent || "N/A",
        status: "warn",
        weight: regimeWeight,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK 5: Time Decay Impact (Weight: 15)
    // ═══════════════════════════════════════════════════════════════════════
    const thetaWeight = 15;
    totalWeight += thetaWeight;

    const dte = trade.contract.daysToExpiry ?? 0;
    const theta = Math.abs(trade.contract.theta || 0);
    const contractValue = currentContractPrice * 100; // Assuming 100 shares per contract
    const thetaImpactPercent = contractValue > 0 ? (theta / contractValue) * 100 : 0;

    let thetaStatus: "pass" | "warn" | "fail";
    let thetaScore: number;

    // For scalps, ignore theta; for swings, it matters more
    if (trade.tradeType === "Scalp") {
      thetaStatus = "pass";
      thetaScore = thetaWeight;
    } else if (dte > 5 || thetaImpactPercent < 2) {
      thetaStatus = "pass";
      thetaScore = thetaWeight;
    } else if (dte > 1 || thetaImpactPercent < 5) {
      thetaStatus = "warn";
      thetaScore = thetaWeight * 0.6;
    } else {
      thetaStatus = "fail";
      thetaScore = thetaWeight * 0.2;
    }

    totalScore += thetaScore;
    checks.push({
      name: "Time Decay",
      atEntry: `${dte}DTE`,
      current: `${dte}DTE, θ=${theta.toFixed(2)}/day`,
      status: thetaStatus,
      weight: thetaWeight,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Calculate final score and recommendation
    // ═══════════════════════════════════════════════════════════════════════
    const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 50;

    const failedChecks = checks.filter((c) => c.status === "fail");
    const warnChecks = checks.filter((c) => c.status === "warn");

    let status: "valid" | "degraded" | "invalid";
    let recommendation: string;

    if (finalScore >= 70 && failedChecks.length === 0) {
      status = "valid";
      recommendation = "Thesis intact. Continue holding per plan.";
    } else if (finalScore >= 50 || failedChecks.length <= 1) {
      status = "degraded";
      const issues = [...failedChecks, ...warnChecks].map((c) => c.name).join(", ");
      recommendation = `Thesis weakening (${issues}). Consider tightening stop or taking partial profits.`;
    } else {
      status = "invalid";
      const critical = failedChecks.map((c) => c.name).join(", ");
      recommendation = `Thesis invalidated (${critical}). Consider exiting or significantly reducing position.`;
    }

    return {
      isValid: status === "valid",
      score: finalScore,
      status,
      checks,
      recommendation,
    };
  }, [trade, macro, keyLevels]);
}

/**
 * Get a simple thesis validation summary for display
 */
export function getThesisSummary(validation: ThesisValidationResult): {
  icon: "✅" | "⚠️" | "❌";
  label: string;
  color: string;
} {
  switch (validation.status) {
    case "valid":
      return {
        icon: "✅",
        label: "Thesis Valid",
        color: "text-[var(--accent-positive)]",
      };
    case "degraded":
      return {
        icon: "⚠️",
        label: "Thesis Degraded",
        color: "text-yellow-500",
      };
    case "invalid":
      return {
        icon: "❌",
        label: "Thesis Invalid",
        color: "text-[var(--accent-negative)]",
      };
  }
}
