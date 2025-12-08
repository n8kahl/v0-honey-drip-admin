/**
 * Smart Alert Generation Service
 * 
 * Generates intelligent trade alerts with context-aware recommendations.
 * Acts like an experienced admin calling trades in a trading room.
 */

import { Trade, Contract, OptionType } from '../../types';
import { useMarketStore } from '../../stores/marketStore';
import { useTradeStore } from '../../stores/tradeStore';
import { fetchNormalizedChain } from '../../services/options';
import { massive } from '../massive';

export interface SmartAlertResult {
  alert: {
    ticker: string;
    contract?: Contract;
    price?: number;
    reasoning: string;
    confidence: number;
    alertType: 'entry' | 'exit' | 'trim' | 'update-sl';
  };
  reasoning: string;
  confidence: number;
  alternatives?: Contract[];
}

export interface ContractSearchResult {
  contract: Contract;
  score: number;
  reasoning: string;
}

/**
 * Calculate Days to Expiration from ISO date string
 */
function calculateDTE(expirationISO: string): number {
  const expiry = new Date(expirationISO);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Determine trade type based on DTE
 */
function inferTradeType(dte: number): 'Scalp' | 'Day' | 'Swing' | 'LEAP' {
  if (dte < 1) return 'Scalp';
  if (dte < 5) return 'Day';
  if (dte < 30) return 'Swing';
  return 'LEAP';
}

/**
 * Rank contracts by suitability for entry
 * Prioritizes: ATM strikes, high volume, good liquidity, appropriate DTE
 */
function rankContracts(
  contracts: Contract[],
  underlyingPrice: number,
  preferredType?: OptionType
): ContractSearchResult[] {
  const ranked: ContractSearchResult[] = [];

  for (const contract of contracts) {
    let score = 100;
    const dte = calculateDTE(contract.expiry);
    const tradeType = inferTradeType(dte);
    const priceDiff = Math.abs(contract.strike - underlyingPrice);
    const percentFromATM = (priceDiff / underlyingPrice) * 100;

    // Liquidity checks
    const spread = contract.ask - contract.bid;
    const spreadPercent = (spread / contract.mid) * 100;
    
    if (spreadPercent > 10) score -= 30; // Wide spread penalty
    if (contract.openInterest < 100) score -= 20; // Low OI penalty
    if (contract.volume < 50) score -= 15; // Low volume penalty
    if (contract.bid <= 0 || contract.ask <= 0) score -= 50; // No market

    // ATM proximity (best within 5% of underlying)
    if (percentFromATM < 2) score += 30; // Very close to ATM
    else if (percentFromATM < 5) score += 15; // Close to ATM
    else if (percentFromATM > 10) score -= 20; // Far from ATM

    // DTE scoring
    if (dte >= 30 && dte <= 60) score += 20; // Sweet spot for swings
    else if (dte >= 7 && dte <= 20) score += 15; // Good for day/swing
    else if (dte < 3) score -= 10; // Too short for most strategies
    else if (dte > 90) score -= 5; // Very long dated

    // Volume/OI ratio (higher is better)
    const volumeRatio = contract.volume / Math.max(1, contract.openInterest);
    if (volumeRatio > 0.5) score += 10; // High activity

    // Type preference
    if (preferredType && contract.type !== preferredType) {
      score -= 20;
    }

    // Greeks bonus (if available)
    if (contract.delta && Math.abs(contract.delta) > 0.4) {
      score += 10; // Good delta for directional plays
    }

    const reasoning = buildReasoningString(
      contract,
      underlyingPrice,
      dte,
      tradeType,
      spreadPercent,
      percentFromATM
    );

    ranked.push({ contract, score, reasoning });
  }

  // Sort by score descending
  return ranked.sort((a, b) => b.score - a.score);
}

/**
 * Build human-readable reasoning for contract selection
 */
function buildReasoningString(
  contract: Contract,
  underlyingPrice: number,
  dte: number,
  tradeType: string,
  spreadPercent: number,
  percentFromATM: number
): string {
  const reasons: string[] = [];

  if (percentFromATM < 2) {
    reasons.push('ATM strike');
  } else if (percentFromATM < 5) {
    reasons.push(`${percentFromATM.toFixed(1)}% from ATM`);
  }

  if (contract.volume > 500) {
    reasons.push('high volume');
  } else if (contract.volume > 100) {
    reasons.push('good volume');
  }

  if (spreadPercent < 5) {
    reasons.push('tight spread');
  }

  if (contract.openInterest > 1000) {
    reasons.push('strong OI');
  }

  reasons.push(`${dte} DTE (${tradeType})`);

  if (contract.iv) {
    reasons.push(`${(contract.iv * 100).toFixed(0)}% IV`);
  }

  return reasons.join(', ');
}

/**
 * Search for best contract for a given ticker
 */
export async function searchBestContract(
  ticker: string,
  optionType?: OptionType,
  priceHint?: number
): Promise<SmartAlertResult | null> {
  try {
    console.warn(`[v0] SmartAlert: Searching contracts for ${ticker}`);

    // Get current quote
    const quote = useMarketStore.getState().getQuote(ticker);
    const underlyingPrice = priceHint || quote?.last || 0;

    if (!underlyingPrice) {
      return null;
    }

    // Fetch options chain (10 expirations)
    const tokenManager = massive.getTokenManager();
    const contracts = await fetchNormalizedChain(ticker, {
      window: 10,
      tokenManager,
    });

    if (!contracts || contracts.length === 0) {
      return null;
    }

    // Filter by liquidity
    const liquidContracts = contracts.filter(
      (c) =>
        c.bid > 0 &&
        c.ask > 0 &&
        c.openInterest >= 100 &&
        c.volume >= 30 &&
        (c.ask - c.bid) / c.mid < 0.15 // Spread < 15%
    );

    if (liquidContracts.length === 0) {
      return null;
    }

    // Rank and select best
    const ranked = rankContracts(liquidContracts, underlyingPrice, optionType);
    
    if (ranked.length === 0) {
      return null;
    }

    const best = ranked[0];
    const alternatives = ranked.slice(1, 4).map((r) => r.contract);

    return {
      alert: {
        ticker,
        contract: best.contract,
        price: best.contract.mid,
        reasoning: best.reasoning,
        confidence: Math.min(100, best.score),
        alertType: 'entry',
      },
      reasoning: `${ticker} ${best.contract.strike}${best.contract.type} — ${best.reasoning}`,
      confidence: Math.min(100, best.score),
      alternatives,
    };
  } catch (error) {
    console.error('[v0] SmartAlert: Contract search failed:', error);
    return null;
  }
}

/**
 * Generate entry alert for a ticker
 * If contract not loaded, searches and recommends best option
 */
export async function generateEntryAlert(
  ticker: string,
  price?: number,
  optionType?: OptionType
): Promise<SmartAlertResult | null> {
  // Check if contract already loaded
  const currentTrade = useTradeStore.getState().currentTrade;
  
  if (currentTrade && currentTrade.ticker === ticker && currentTrade.contract) {
    // Use loaded contract
    const dte = calculateDTE(currentTrade.contract.expiry);
    const tradeType = inferTradeType(dte);
    const reasoning = `${ticker} ${currentTrade.contract.strike}${currentTrade.contract.type} — Loaded contract, ${dte} DTE (${tradeType})`;

    return {
      alert: {
        ticker,
        contract: currentTrade.contract,
        price: price || currentTrade.contract.mid,
        reasoning,
        confidence: 90,
        alertType: 'entry',
      },
      reasoning,
      confidence: 90,
    };
  }

  // Search for best contract
  return searchBestContract(ticker, optionType, price);
}

/**
 * Generate exit alert with P&L analysis
 */
export function generateExitAlert(trade: Trade): SmartAlertResult {
  const pnlPercent = trade.movePercent || 0;
  const isProfit = pnlPercent > 0;
  
  let reasoning = `${trade.ticker} ${trade.contract.strike}${trade.contract.type} — `;
  
  if (isProfit) {
    if (pnlPercent > 100) {
      reasoning += `Excellent ${pnlPercent.toFixed(0)}% gain, lock profit`;
    } else if (pnlPercent > 50) {
      reasoning += `Strong ${pnlPercent.toFixed(0)}% gain, secure win`;
    } else {
      reasoning += `${pnlPercent.toFixed(0)}% gain, take profit`;
    }
  } else {
    if (pnlPercent < -50) {
      reasoning += `Heavy ${pnlPercent.toFixed(0)}% loss, stop out`;
    } else if (pnlPercent < -20) {
      reasoning += `${pnlPercent.toFixed(0)}% loss, cut position`;
    } else {
      reasoning += `${pnlPercent.toFixed(0)}% loss, exit position`;
    }
  }

  return {
    alert: {
      ticker: trade.ticker,
      contract: trade.contract,
      price: trade.currentPrice,
      reasoning,
      confidence: 95,
      alertType: 'exit',
    },
    reasoning,
    confidence: 95,
  };
}

/**
 * Generate trim alert with recommended percentage
 */
export function generateTrimAlert(trade: Trade, trimPercent?: number): SmartAlertResult {
  const pnlPercent = trade.movePercent || 0;
  const suggestedTrim = trimPercent || (pnlPercent > 50 ? 50 : 30);
  
  const reasoning = `${trade.ticker} ${trade.contract.strike}${trade.contract.type} — Up ${pnlPercent.toFixed(0)}%, trim ${suggestedTrim}% to lock profit`;

  return {
    alert: {
      ticker: trade.ticker,
      contract: trade.contract,
      price: trade.currentPrice,
      reasoning,
      confidence: 85,
      alertType: 'trim',
    },
    reasoning,
    confidence: 85,
  };
}

/**
 * Generate stop loss update alert with ATR-based calculation
 */
export function generateStopLossAlert(trade: Trade, newStopLoss?: number): SmartAlertResult {
  const stopLoss = newStopLoss || trade.stopLoss;
  const distancePercent = stopLoss && trade.currentPrice
    ? ((trade.currentPrice - stopLoss) / trade.currentPrice) * 100
    : 0;

  const reasoning = `${trade.ticker} ${trade.contract.strike}${trade.contract.type} — Update SL to ${stopLoss?.toFixed(2)}, ${distancePercent.toFixed(1)}% cushion`;

  return {
    alert: {
      ticker: trade.ticker,
      contract: trade.contract,
      price: trade.currentPrice,
      reasoning,
      confidence: 80,
      alertType: 'update-sl',
    },
    reasoning,
    confidence: 80,
  };
}
