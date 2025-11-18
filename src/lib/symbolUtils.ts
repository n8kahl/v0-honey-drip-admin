// Symbol normalization utilities for consistent handling across client and server

export const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'VIX', 'RUT', 'DJI', 'SPY', 'QQQ']);

export const SYMBOL_ALIASES: Record<string, string> = {
  'SPXW': 'SPX', // Weekly SPX options
  'NDXP': 'NDX', // PM-settled NDX
  '$SPX': 'SPX',
  '$NDX': 'NDX',
  '$VIX': 'VIX',
};

/**
 * Check if a symbol is an index (requires I: prefix for Massive API)
 */
export function isIndex(symbol: string): boolean {
  const clean = symbol.replace(/^I:/, '').toUpperCase();
  return ['SPX', 'NDX', 'VIX', 'RUT', 'DJI'].includes(clean);
}

/**
 * Normalize symbol for UI display (remove I: prefix, apply aliases)
 */
export function normalizeSymbolForUI(symbol: string): string {
  let clean = symbol.toUpperCase().replace(/^I:/, '');
  clean = SYMBOL_ALIASES[clean] || clean;
  return clean;
}

/**
 * Normalize symbol for Massive API calls (add I: prefix for indices)
 */
export function normalizeSymbolForAPI(symbol: string): string {
  const clean = normalizeSymbolForUI(symbol);
  if (isIndex(clean) && !symbol.startsWith('I:')) {
    return `I:${clean}`;
  }
  return clean;
}

/**
 * Batch normalize symbols for API
 */
export function normalizeSymbolsForAPI(symbols: string[]): string[] {
  return symbols.map(normalizeSymbolForAPI);
}

/**
 * Check if symbol is an equity ETF or stock (not an index)
 */
export function isEquity(symbol: string): boolean {
  const clean = normalizeSymbolForUI(symbol);
  return !isIndex(clean);
}
