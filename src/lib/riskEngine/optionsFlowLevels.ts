import { massive } from "../massive";

export interface OptionsFlowLevels {
  gammaWall: number | null;
  callWall: number | null;
  putWall: number | null;
  maxPain: number | null;
}

/**
 * Calculates key levels based on options flow (GEX, OI concentration, Max Pain)
 */
export async function calculateOptionsFlowLevels(symbol: string): Promise<OptionsFlowLevels> {
  try {
    const underlying = symbol.replace(/^I:/, "");
    const snapshot = await massive.getOptionsSnapshot(underlying);

    if (!snapshot?.results || snapshot.results.length === 0) {
      return { gammaWall: null, callWall: null, putWall: null, maxPain: null };
    }

    const contracts = snapshot.results;
    let maxGamma = -Infinity;
    let gammaWall = 0;
    let maxCallOI = -Infinity;
    let callWall = 0;
    let maxPutOI = -Infinity;
    let putWall = 0;

    // For Max Pain
    const strikes = new Map<number, { callOI: number; putOI: number }>();

    contracts.forEach((c: any) => {
      const strike = Number(c.strike_price || c.strike || 0);
      const type = (c.contract_type || c.type || "").toLowerCase();
      const oi = Number(c.open_interest || c.day?.open_interest || 0);
      const gamma = Number(c.gamma || 0);

      // Gamma Wall (abs gamma for walls)
      const absGamma = Math.abs(gamma);
      if (absGamma > maxGamma) {
        maxGamma = absGamma;
        gammaWall = strike;
      }

      // Call/Put Walls
      if (type.startsWith("c")) {
        if (oi > maxCallOI) {
          maxCallOI = oi;
          callWall = strike;
        }
      } else if (type.startsWith("p")) {
        if (oi > maxPutOI) {
          maxPutOI = oi;
          putWall = strike;
        }
      }

      // Collect strikes for Max Pain
      if (strike > 0) {
        if (!strikes.has(strike)) strikes.set(strike, { callOI: 0, putOI: 0 });
        const data = strikes.get(strike)!;
        if (type.startsWith("c")) data.callOI += oi;
        else if (type.startsWith("p")) data.putOI += oi;
      }
    });

    // Max Pain Calculation (Strike where total penalty is min)
    let minPenalty = Infinity;
    let maxPain = 0;
    const uniqueStrikes = Array.from(strikes.keys()).sort((a, b) => a - b);

    uniqueStrikes.forEach((testStrike) => {
      let penalty = 0;
      uniqueStrikes.forEach((s) => {
        const data = strikes.get(s)!;
        if (s < testStrike)
          penalty += (testStrike - s) * data.callOI; // Calls in money
        else if (s > testStrike) penalty += (s - testStrike) * data.putOI; // Puts in money
      });
      if (penalty < minPenalty) {
        minPenalty = penalty;
        maxPain = testStrike;
      }
    });

    return {
      gammaWall: gammaWall || null,
      callWall: callWall || null,
      putWall: putWall || null,
      maxPain: maxPain || null,
    };
  } catch (error) {
    console.warn(`[calculateOptionsFlowLevels] Failed for ${symbol}:`, error);
    return { gammaWall: null, callWall: null, putWall: null, maxPain: null };
  }
}
