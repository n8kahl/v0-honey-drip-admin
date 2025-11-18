// Shared client-side types for normalized APIs

export type UnifiedQuote = {
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  asOf: number; // epoch ms
  source: string; // 'indices' | 'stocks' | 'options-snapshot' | 'none' | 'error'
};

export type Norm = {
  id: string;
  ticker: string;
  type: 'C' | 'P';
  strike: number;
  expiration: string; // YYYY-MM-DD
  dte: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  bid?: number;
  ask?: number;
  last?: number;
  oi?: number;
};

export type NormalizedChain = {
  symbol: string;
  price: number;
  asOf: string; // ISO datetime
  expirations: Array<{
    date: string; // YYYY-MM-DD
    dte: number;
    atmStrike: number;
    calls: Array<Norm>;
    puts: Array<Norm>;
  }>;
};

export type Bar = {
  timestamp: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
};

export type BarsResponse = {
  symbol: string;
  timespan: string;
  multiplier: number;
  from: string;
  to: string;
  adjusted: boolean;
  count: number;
  bars: Bar[];
};
