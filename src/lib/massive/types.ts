// Massive.com API Type Definitions

export interface MassiveQuote {
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  // Abbreviated field names (Massive.com WebSocket may use these)
  bp?: number; // bid price
  ap?: number; // ask price
  p?: number; // price (last trade price)
  price?: number; // alternative to 'last'
}

export interface MassiveOption {
  ticker: string;
  underlying_ticker: string;
  strike_price: number;
  expiration_date: string;
  contract_type: "call" | "put";
  exercise_style: "american" | "european" | "bermudan";
  shares_per_contract: number;
  bid: number;
  ask: number;
  mid: number;
  last: number;
  volume: number;
  open_interest: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  implied_volatility?: number;
}

export interface MassiveOptionsChain {
  underlying_ticker: string;
  results: MassiveOption[];
  next_url?: string;
}

export interface MassiveIndex {
  ticker: string;
  name: string;
  value: number;
  change: number;
  change_percent: number;
  timestamp: number;
}
