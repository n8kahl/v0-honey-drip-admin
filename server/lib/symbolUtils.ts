// Symbol normalization utilities for server-side API handling

export const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'VIX', 'RUT', 'DJI']);

export const SYMBOL_ALIASES: Record<string, string> = {
  'SPXW': 'SPX',
  'NDXP': 'NDX',
  '$SPX': 'SPX',
  '$NDX': 'NDX',
  '$VIX': 'VIX',
};

export function isIndex(symbol: string): boolean {
  const clean = symbol.replace(/^I:/, '').toUpperCase();
  return INDEX_SYMBOLS.has(clean);
}

export function normalizeSymbolForUI(symbol: string): string {
  let clean = symbol.toUpperCase().replace(/^I:/, '');
  clean = SYMBOL_ALIASES[clean] || clean;
  return clean;
}

export function normalizeSymbolForMassive(symbol: string): string {
  const clean = normalizeSymbolForUI(symbol);
  if (isIndex(clean) && !symbol.startsWith('I:')) {
    return `I:${clean}`;
  }
  return clean;
}
