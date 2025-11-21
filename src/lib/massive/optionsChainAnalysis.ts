/**
 * Options Chain Analysis
 *
 * Analyzes options chains for SPX/NDX to identify:
 * - Gamma walls (strikes with max dealer gamma exposure)
 * - Dealer positioning (net long/short gamma)
 * - Max pain (price where most options expire worthless)
 * - Call/put skew (directional bias in volume/OI)
 *
 * Used primarily for 0DTE strategies and power hour setups
 */

import { massive } from './index.js';

export interface OptionContract {
  strike: number;
  type: 'call' | 'put';
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
}

export interface GammaLevel {
  strike: number;
  totalGamma: number; // Absolute gamma at this strike
  dealerGamma: number; // Dealer's gamma (negative = dealers short gamma)
  callGamma: number;
  putGamma: number;
  distance: number; // Distance from current price
  distancePct: number; // Percentage distance from current price
}

export interface OptionsChainData {
  symbol: string;
  underlying: number; // Current price
  expiration: string; // YYYY-MM-DD
  minutesToExpiry: number;

  // Gamma analysis
  gammaWalls: GammaLevel[]; // Top 5 gamma levels
  maxGammaStrike: GammaLevel; // Strike with highest gamma
  dealerGammaExposure: number; // Net dealer gamma (negative = short)

  // Volume/OI analysis
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  putCallVolumeRatio: number;
  putCallOIRatio: number;

  // Skew analysis
  callSkew: number; // Call volume - Put volume (normalized -100 to 100)
  ivSkew: number; // Difference in IV between ATM calls and puts

  // Max pain
  maxPain: number; // Price where most options expire worthless
}

/**
 * Fetch and analyze options chain for a given symbol and expiration
 *
 * @param symbol Underlying symbol (e.g., 'SPX', 'NDX')
 * @param expirationDate Expiration date (YYYY-MM-DD) - defaults to 0DTE
 * @param currentPrice Current underlying price (for distance calculations)
 */
export async function fetchOptionsChainData(
  symbol: string,
  expirationDate?: string,
  currentPrice?: number
): Promise<OptionsChainData | null> {
  try {
    // Get current price if not provided
    let underlying = currentPrice;
    if (!underlying) {
      const snapshot = await massive.rest.getIndicesSnapshot([symbol]);
      underlying = snapshot?.results?.[0]?.value || 0;
    }

    if (!underlying) {
      console.error('[OptionsChain] Could not determine underlying price');
      return null;
    }

    // Default to 0DTE if no expiration provided
    const expiration = expirationDate || getTodayDateString();

    // Fetch options chain (calls + puts)
    // Note: Polygon's options contract endpoint requires ticker format: O:SPX241120C04500000
    const calls = await fetchOptionsForStrike(symbol, expiration, 'call', underlying);
    const puts = await fetchOptionsForStrike(symbol, expiration, 'put', underlying);

    if (!calls && !puts) {
      console.error('[OptionsChain] No options data available');
      return null;
    }

    const allContracts = [...(calls || []), ...(puts || [])];

    // Calculate gamma levels
    const gammaLevels = calculateGammaLevels(allContracts, underlying);
    const gammaWalls = gammaLevels.slice(0, 5); // Top 5
    const maxGammaStrike = gammaLevels[0];

    // Calculate dealer exposure (assume dealers are short when retail is long)
    const dealerGammaExposure = calculateDealerGamma(allContracts);

    // Volume and OI totals
    const callContracts = allContracts.filter(c => c.type === 'call');
    const putContracts = allContracts.filter(c => c.type === 'put');

    const totalCallVolume = callContracts.reduce((sum, c) => sum + c.volume, 0);
    const totalPutVolume = putContracts.reduce((sum, c) => sum + c.volume, 0);
    const totalCallOI = callContracts.reduce((sum, c) => sum + c.openInterest, 0);
    const totalPutOI = putContracts.reduce((sum, c) => sum + c.openInterest, 0);

    const putCallVolumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
    const putCallOIRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

    // Skew calculation
    const callSkew = calculateSkew(totalCallVolume, totalPutVolume);
    const ivSkew = calculateIVSkew(callContracts, putContracts, underlying);

    // Max pain calculation
    const maxPain = calculateMaxPain(allContracts, underlying);

    // Calculate minutes to expiry
    const minutesToExpiry = calculateMinutesToExpiry(expiration);

    return {
      symbol,
      underlying,
      expiration,
      minutesToExpiry,
      gammaWalls,
      maxGammaStrike,
      dealerGammaExposure,
      totalCallVolume,
      totalPutVolume,
      totalCallOI,
      totalPutOI,
      putCallVolumeRatio,
      putCallOIRatio,
      callSkew,
      ivSkew,
      maxPain,
    };
  } catch (error) {
    console.error('[OptionsChain] Error fetching chain data:', error);
    return null;
  }
}

/**
 * Fetch options contracts near a given strike price
 * (Simplified - in production would use Polygon's options snapshot)
 */
async function fetchOptionsForStrike(
  symbol: string,
  expiration: string,
  type: 'call' | 'put',
  underlyingPrice: number
): Promise<OptionContract[] | null> {
  // TODO: Implement actual Polygon API call
  // For now, return mock data structure
  // In production: await massive.rest.getOptionsContracts(...)

  console.warn('[OptionsChain] Using mock data - implement Polygon options API');

  // Mock: Generate strikes around current price
  const strikes: OptionContract[] = [];
  const strikeInterval = symbol === 'SPX' || symbol === 'NDX' ? 25 : 5;
  const numStrikes = 20;

  for (let i = -numStrikes / 2; i < numStrikes / 2; i++) {
    const strike = Math.round((underlyingPrice + i * strikeInterval) / strikeInterval) * strikeInterval;
    const distance = strike - underlyingPrice;
    const distancePct = Math.abs(distance / underlyingPrice);

    // Mock Greeks (in production, these come from Polygon)
    const delta = type === 'call'
      ? Math.max(0, Math.min(1, 0.5 + distance / (2 * strikeInterval)))
      : Math.max(-1, Math.min(0, -0.5 + distance / (2 * strikeInterval)));

    const gamma = 0.01 * Math.exp(-Math.pow(distancePct * 100, 2) / 50); // Gaussian around ATM

    strikes.push({
      strike,
      type,
      volume: Math.max(0, 1000 - Math.abs(i) * 50 + Math.random() * 200),
      openInterest: Math.max(0, 5000 - Math.abs(i) * 100 + Math.random() * 1000),
      impliedVolatility: 0.15 + Math.random() * 0.05,
      delta,
      gamma,
    });
  }

  return strikes;
}

/**
 * Calculate gamma levels across all strikes
 */
function calculateGammaLevels(contracts: OptionContract[], underlyingPrice: number): GammaLevel[] {
  // Group by strike
  const strikeMap = new Map<number, { calls: OptionContract[]; puts: OptionContract[] }>();

  for (const contract of contracts) {
    if (!strikeMap.has(contract.strike)) {
      strikeMap.set(contract.strike, { calls: [], puts: [] });
    }
    const group = strikeMap.get(contract.strike)!;
    if (contract.type === 'call') {
      group.calls.push(contract);
    } else {
      group.puts.push(contract);
    }
  }

  // Calculate gamma for each strike
  const levels: GammaLevel[] = [];

  for (const [strike, { calls, puts }] of strikeMap.entries()) {
    const callGamma = calls.reduce((sum, c) => sum + c.gamma * c.openInterest, 0);
    const putGamma = puts.reduce((sum, c) => sum + c.gamma * c.openInterest, 0);
    const totalGamma = callGamma + putGamma;

    // Dealer gamma is opposite of retail (dealers sell options, so they're short gamma)
    const dealerGamma = -(totalGamma);

    const distance = strike - underlyingPrice;
    const distancePct = (distance / underlyingPrice) * 100;

    levels.push({
      strike,
      totalGamma,
      dealerGamma,
      callGamma,
      putGamma,
      distance,
      distancePct,
    });
  }

  // Sort by total gamma (highest first)
  levels.sort((a, b) => b.totalGamma - a.totalGamma);

  return levels;
}

/**
 * Calculate net dealer gamma exposure
 * Negative = dealers are short gamma (squeeze potential)
 * Positive = dealers are long gamma (resistance to movement)
 */
function calculateDealerGamma(contracts: OptionContract[]): number {
  const totalGamma = contracts.reduce((sum, c) => sum + c.gamma * c.openInterest, 0);
  // Dealers are on opposite side of retail
  return -totalGamma;
}

/**
 * Calculate call/put skew (-100 to 100)
 * Positive = more call activity (bullish)
 * Negative = more put activity (bearish)
 */
function calculateSkew(callVolume: number, putVolume: number): number {
  const total = callVolume + putVolume;
  if (total === 0) return 0;
  return ((callVolume - putVolume) / total) * 100;
}

/**
 * Calculate IV skew between ATM calls and puts
 * Positive = calls more expensive (bullish sentiment)
 * Negative = puts more expensive (bearish sentiment / protection)
 */
function calculateIVSkew(
  calls: OptionContract[],
  puts: OptionContract[],
  underlyingPrice: number
): number {
  // Find ATM call and put
  const atmCall = calls.reduce((closest, c) =>
    Math.abs(c.strike - underlyingPrice) < Math.abs(closest.strike - underlyingPrice) ? c : closest
  , calls[0]);

  const atmPut = puts.reduce((closest, p) =>
    Math.abs(p.strike - underlyingPrice) < Math.abs(closest.strike - underlyingPrice) ? p : closest
  , puts[0]);

  if (!atmCall || !atmPut) return 0;

  return (atmCall.impliedVolatility - atmPut.impliedVolatility) * 100;
}

/**
 * Calculate max pain (price where most options expire worthless)
 * This is where option sellers (dealers) make the most profit
 */
function calculateMaxPain(contracts: OptionContract[], underlyingPrice: number): number {
  // Get all unique strikes
  const strikes = Array.from(new Set(contracts.map(c => c.strike))).sort((a, b) => a - b);

  let minPain = Infinity;
  let maxPainStrike = underlyingPrice;

  for (const strike of strikes) {
    let pain = 0;

    // Calculate pain at this strike
    for (const contract of contracts) {
      if (contract.type === 'call' && strike > contract.strike) {
        // Call is ITM, pain = (strike - contract.strike) * OI
        pain += (strike - contract.strike) * contract.openInterest;
      } else if (contract.type === 'put' && strike < contract.strike) {
        // Put is ITM, pain = (contract.strike - strike) * OI
        pain += (contract.strike - strike) * contract.openInterest;
      }
    }

    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = strike;
    }
  }

  return maxPainStrike;
}

/**
 * Calculate minutes until expiration
 */
function calculateMinutesToExpiry(expirationDate: string): number {
  // Options expire at 4:00 PM ET on expiration date
  const expiry = new Date(expirationDate + 'T16:00:00-05:00');
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Find max gamma strike (helper function)
 */
export function findMaxGammaStrike(data: OptionsChainData | null): GammaLevel {
  if (!data || !data.maxGammaStrike) {
    return {
      strike: 0,
      totalGamma: 0,
      dealerGamma: 0,
      callGamma: 0,
      putGamma: 0,
      distance: 0,
      distancePct: 0,
    };
  }
  return data.maxGammaStrike;
}
