/**
 * Data Validation & Quality Scoring
 *
 * Production validation rules for all market data.
 * Ensures data integrity, detects anomalies, and provides quality scores.
 *
 * @module data-provider/validation
 */

import type {
  OptionContractData,
  OptionChainData,
  IndexSnapshot,
  ValidationError,
  DataQualityFlags,
  DataQualityLevel,
  DataQualityOptions,
} from './types';

// ============================================================================
// VALIDATION CONFIGURATION
// ============================================================================

const DEFAULT_QUALITY_OPTIONS: DataQualityOptions = {
  maxAgeMsForGood: 5000,        // 5s for "good"
  maxAgeMsForFair: 15000,       // 15s for "fair"
  maxAgeMsForAcceptable: 30000, // 30s before "poor"
  minConfidenceScore: 60,       // 0-100
};

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  quality: DataQualityLevel;
  confidence: number;        // 0-100
  errors: string[];
  warnings: string[];
  info: string[];
}

// ============================================================================
// OPTION CONTRACT VALIDATION
// ============================================================================

/**
 * Validate a single option contract
 */
export function validateOptionContract(
  contract: OptionContractData,
  options?: DataQualityOptions
): ValidationResult {
  const opts = { ...DEFAULT_QUALITY_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // --------- IDENTIFIERS ---------
  if (!contract.ticker || typeof contract.ticker !== 'string') {
    errors.push('Invalid or missing ticker');
  }
  if (!contract.rootSymbol || typeof contract.rootSymbol !== 'string') {
    errors.push('Invalid or missing rootSymbol');
  }

  if (!Number.isFinite(contract.strike) || contract.strike <= 0) {
    errors.push(`Invalid strike: ${contract.strike}`);
  }

  if (!contract.expiration || !/^\d{4}-\d{2}-\d{2}$/.test(contract.expiration)) {
    errors.push(`Invalid expiration format: ${contract.expiration}`);
  }

  if (contract.type !== 'call' && contract.type !== 'put') {
    errors.push(`Invalid type: ${contract.type}`);
  }

  if (!Number.isFinite(contract.dte) || contract.dte < 0) {
    errors.push(`Invalid DTE: ${contract.dte}`);
  }

  // --------- QUOTE VALIDATION ---------
  const { bid, ask, mid } = contract.quote;

  if (!Number.isFinite(bid) || bid < 0) {
    errors.push(`Invalid bid: ${bid}`);
  }
  if (!Number.isFinite(ask) || ask < 0) {
    errors.push(`Invalid ask: ${ask}`);
  }
  if (!Number.isFinite(mid) || mid < 0) {
    errors.push(`Invalid mid: ${mid}`);
  }

  if (Number.isFinite(bid) && Number.isFinite(ask)) {
    if (bid > ask) {
      errors.push(`Inverted quote: bid (${bid}) > ask (${ask})`);
    }
    const spreadPercent = ((ask - bid) / mid) * 100;
    if (spreadPercent > 20) {
      warnings.push(`Wide spread: ${spreadPercent.toFixed(2)}%`);
    }
    if (spreadPercent > 50) {
      errors.push(`Extremely wide spread: ${spreadPercent.toFixed(2)}%`);
    }
  }

  if (contract.quote.last !== undefined) {
    if (!Number.isFinite(contract.quote.last) || contract.quote.last < 0) {
      warnings.push(`Invalid last price: ${contract.quote.last}`);
    }
  }

  // --------- GREEKS VALIDATION ---------
  const { delta, gamma, theta, vega, iv } = contract.greeks;

  // Delta: should be -1 to 1 (sometimes up to 1.1 due to dividends)
  if (!Number.isFinite(delta) || Math.abs(delta) > 1.5) {
    warnings.push(`Unusual delta: ${delta}`);
  }

  // Gamma: should be positive, 0 to ~0.3 for SPX/NDX
  if (!Number.isFinite(gamma) || gamma < 0 || gamma > 0.5) {
    if (gamma < 0) {
      errors.push(`Negative gamma: ${gamma}`);
    } else {
      warnings.push(`High gamma: ${gamma.toFixed(4)}`);
    }
  }

  // Theta: usually negative (time decay), can be positive for ITM puts
  if (!Number.isFinite(theta)) {
    warnings.push(`Invalid theta: ${theta}`);
  } else if (Math.abs(theta) > 2) {
    warnings.push(`Very high theta magnitude: ${theta.toFixed(4)}`);
  }

  // Vega: should be positive, 0 to ~0.5
  if (!Number.isFinite(vega) || vega < 0) {
    warnings.push(`Invalid or negative vega: ${vega}`);
  } else if (vega > 1) {
    warnings.push(`Very high vega: ${vega.toFixed(4)}`);
  }

  // IV: should be 0 to ~300 (as decimal, so 0 to 3 mostly)
  if (!Number.isFinite(iv) || iv < 0 || iv > 10) {
    warnings.push(`Unusual IV: ${(iv * 100).toFixed(1)}%`);
  }

  // --------- LIQUIDITY VALIDATION ---------
  if (!Number.isFinite(contract.liquidity.volume) || contract.liquidity.volume < 0) {
    warnings.push(`Invalid volume: ${contract.liquidity.volume}`);
  }
  if (contract.liquidity.volume === 0) {
    warnings.push('Zero volume');
  }

  if (!Number.isFinite(contract.liquidity.openInterest) || contract.liquidity.openInterest < 0) {
    warnings.push(`Invalid open interest: ${contract.liquidity.openInterest}`);
  }
  if (contract.liquidity.openInterest === 0) {
    warnings.push('Zero open interest');
  }

  // --------- DATA FRESHNESS ---------
  const age = Date.now() - contract.quality.updatedAt;
  if (age < 0) {
    errors.push('Data timestamp in future');
  } else if (age > opts.maxAgeMsForAcceptable!) {
    errors.push(`Data is ${(age / 1000).toFixed(1)}s old (max ${opts.maxAgeMsForAcceptable! / 1000}s)`);
  } else if (age > opts.maxAgeMsForFair!) {
    warnings.push(`Data is ${(age / 1000).toFixed(1)}s old (fair quality threshold)`);
  }

  // --------- CONSISTENCY CHECKS ---------
  if (contract.type === 'call' && delta < 0) {
    warnings.push(`Call with negative delta: ${delta}`);
  }
  if (contract.type === 'put' && delta > 0) {
    warnings.push(`Put with positive delta: ${delta}`);
  }

  // --------- FLOW DATA (if present) ---------
  if (contract.flow) {
    if (contract.flow.flowBias !== 'bullish' && contract.flow.flowBias !== 'bearish' && contract.flow.flowBias !== 'neutral') {
      warnings.push(`Invalid flow bias: ${contract.flow.flowBias}`);
    }
    if (contract.flow.buyPressure < 0 || contract.flow.buyPressure > 100) {
      warnings.push(`Invalid buy pressure: ${contract.flow.buyPressure}`);
    }
  }

  // --------- COMPUTE QUALITY & CONFIDENCE ---------
  let quality: DataQualityLevel = 'excellent';
  let confidence = 100;

  if (errors.length > 0) {
    quality = 'poor';
    confidence = 0;
  } else if (warnings.length > 3) {
    quality = 'fair';
    confidence = Math.max(40, 100 - warnings.length * 10);
  } else if (warnings.length > 1) {
    quality = 'good';
    confidence = Math.max(70, 100 - warnings.length * 5);
  } else if (warnings.length > 0) {
    quality = 'good';
    confidence = 90;
  }

  // Age penalty
  if (age > opts.maxAgeMsForGood!) {
    confidence *= 0.9;
  }
  if (age > opts.maxAgeMsForFair!) {
    confidence *= 0.75;
  }

  confidence = Math.round(Math.max(0, Math.min(100, confidence)));

  return {
    isValid: errors.length === 0,
    quality,
    confidence,
    errors,
    warnings,
    info,
  };
}

// ============================================================================
// OPTIONS CHAIN VALIDATION
// ============================================================================

/**
 * Validate entire options chain
 */
export function validateOptionChain(
  chain: OptionChainData,
  options?: DataQualityOptions
): ValidationResult {
  const opts = { ...DEFAULT_QUALITY_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  let minConfidence = 100;

  // --------- BASIC STRUCTURE ---------
  if (!chain.underlying || typeof chain.underlying !== 'string') {
    errors.push('Invalid or missing underlying');
  }

  if (!Number.isFinite(chain.underlyingPrice) || chain.underlyingPrice <= 0) {
    errors.push(`Invalid underlying price: ${chain.underlyingPrice}`);
  }

  if (!Array.isArray(chain.contracts)) {
    errors.push('contracts must be an array');
  } else if (chain.contracts.length === 0) {
    errors.push('Empty chain');
  }

  // --------- VALIDATE EACH CONTRACT ---------
  const strikeSet = new Set<number>();
  const expirationSet = new Set<string>();
  let callCount = 0;
  let putCount = 0;

  for (const contract of chain.contracts || []) {
    const validation = validateOptionContract(contract, opts);

    if (!validation.isValid) {
      errors.push(`Contract ${contract.ticker}: ${validation.errors.join('; ')}`);
    }

    // Accumulate warnings from contracts
    warnings.push(...validation.errors.map(e => `Contract ${contract.ticker}: ${e}`));

    minConfidence = Math.min(minConfidence, validation.confidence);
    strikeSet.add(contract.strike);
    expirationSet.add(contract.expiration);

    if (contract.type === 'call') callCount++;
    if (contract.type === 'put') putCount++;
  }

  // --------- COVERAGE CHECKS ---------
  if (callCount === 0) {
    warnings.push('No calls in chain');
  }
  if (putCount === 0) {
    warnings.push('No puts in chain');
  }

  // Check strike continuity
  if (strikeSet.size > 1) {
    const strikes = Array.from(strikeSet).sort((a, b) => a - b);
    for (let i = 1; i < strikes.length; i++) {
      const gap = strikes[i] - strikes[i - 1];
      if (gap > 5 && chain.underlyingPrice > 100) {
        // Gap > 5 cents for normal price
        info.push(`Strike gap: ${strikes[i - 1]} to ${strikes[i]} (${gap})`);
      }
    }
  }

  // --------- DATA FRESHNESS ---------
  const age = Date.now() - chain.quality.updatedAt;
  if (age > opts.maxAgeMsForAcceptable!) {
    errors.push(`Chain is ${(age / 1000).toFixed(1)}s old (max ${opts.maxAgeMsForAcceptable! / 1000}s)`);
  } else if (age > opts.maxAgeMsForFair!) {
    warnings.push(`Chain is ${(age / 1000).toFixed(1)}s old (fair quality threshold)`);
  }

  // --------- COMPUTE QUALITY & CONFIDENCE ---------
  let quality: DataQualityLevel = 'excellent';
  let confidence = minConfidence;

  if (errors.length > 0) {
    quality = 'poor';
    confidence = 0;
  } else if (warnings.length > 5) {
    quality = 'fair';
    confidence = Math.max(40, 100 - warnings.length * 5);
  } else if (warnings.length > 2) {
    quality = 'good';
    confidence = Math.max(70, 100 - warnings.length * 5);
  }

  confidence = Math.round(Math.max(0, Math.min(100, confidence)));

  return {
    isValid: errors.length === 0,
    quality,
    confidence,
    errors,
    warnings,
    info,
  };
}

// ============================================================================
// INDEX SNAPSHOT VALIDATION
// ============================================================================

/**
 * Validate index snapshot
 */
export function validateIndexSnapshot(
  snapshot: IndexSnapshot,
  options?: DataQualityOptions
): ValidationResult {
  const opts = { ...DEFAULT_QUALITY_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // --------- BASIC STRUCTURE ---------
  if (!snapshot.symbol || typeof snapshot.symbol !== 'string') {
    errors.push('Invalid or missing symbol');
  }

  const quote = snapshot.quote;
  if (!quote) {
    errors.push('Missing quote data');
  } else {
    if (!Number.isFinite(quote.value) || quote.value <= 0) {
      errors.push(`Invalid index value: ${quote.value}`);
    }
    if (!Number.isFinite(quote.change)) {
      warnings.push(`Invalid change: ${quote.change}`);
    }
    if (!Number.isFinite(quote.changePercent)) {
      warnings.push(`Invalid changePercent: ${quote.changePercent}`);
    }

    // Sanity check: change should be roughly proportional to changePercent
    if (Number.isFinite(quote.value) && Number.isFinite(quote.prevClose) && quote.prevClose > 0) {
      const expectedChange = quote.value - quote.prevClose;
      if (Math.abs(quote.change - expectedChange) > 1) {
        warnings.push(`Inconsistent change: ${quote.change} vs expected ${expectedChange.toFixed(2)}`);
      }
    }
  }

  // --------- TIMEFRAMES VALIDATION ---------
  if (!snapshot.timeframes || snapshot.timeframes.size === 0) {
    warnings.push('No timeframes data');
  } else {
    for (const [tf, data] of snapshot.timeframes.entries()) {
      if (!Array.isArray(data.candles) || data.candles.length === 0) {
        warnings.push(`No candles for timeframe ${tf}`);
      }

      // Check candle sanity
      for (const candle of data.candles || []) {
        if (!(candle.high >= candle.low)) {
          errors.push(`Candle inverted: ${tf} high ${candle.high} < low ${candle.low}`);
        }
        if (!(candle.close >= candle.low && candle.close <= candle.high)) {
          warnings.push(`Close ${candle.close} outside high/low for ${tf}`);
        }
      }
    }
  }

  // --------- DATA FRESHNESS ---------
  const age = Date.now() - snapshot.updatedAt;
  if (age > opts.maxAgeMsForAcceptable!) {
    errors.push(`Snapshot is ${(age / 1000).toFixed(1)}s old`);
  } else if (age > opts.maxAgeMsForFair!) {
    warnings.push(`Snapshot is ${(age / 1000).toFixed(1)}s old (fair quality)`);
  }

  // --------- COMPUTE QUALITY & CONFIDENCE ---------
  let quality: DataQualityLevel = 'excellent';
  let confidence = 100;

  if (errors.length > 0) {
    quality = 'poor';
    confidence = 0;
  } else if (warnings.length > 3) {
    quality = 'fair';
    confidence = Math.max(40, 100 - warnings.length * 10);
  } else if (warnings.length > 0) {
    quality = 'good';
    confidence = Math.max(70, 100 - warnings.length * 5);
  }

  confidence = Math.round(Math.max(0, Math.min(100, confidence)));

  return {
    isValid: errors.length === 0,
    quality,
    confidence,
    errors,
    warnings,
    info,
  };
}

// ============================================================================
// QUALITY FLAGS HELPER
// ============================================================================

/**
 * Create DataQualityFlags from validation result
 */
export function createQualityFlags(
  result: ValidationResult,
  source: 'massive' | 'tradier' | 'hybrid',
  fallbackReason?: string
): Partial<DataQualityFlags> {
  return {
    source,
    quality: result.quality,
    confidence: result.confidence,
    hasWarnings: result.warnings.length > 0,
    warnings: result.warnings,
    isStale: result.quality === 'poor' && result.confidence < 30,
    staleSinceMs: undefined, // Set by caller if needed
    fallbackReason,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export {
  DEFAULT_QUALITY_OPTIONS,
  type ValidationResult,
};
