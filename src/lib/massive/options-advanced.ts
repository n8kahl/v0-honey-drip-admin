import type { MassiveOptionSnapshot } from './types';

export interface UiOptionRow {
  ticker: string;
  type: 'C' | 'P';
  strike: number;
  expiration: string;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  oi?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  mid?: number;
}

export function toUiRow(s: MassiveOptionSnapshot): UiOptionRow {
  const greeks = s.greeks ?? {};
  const quote = s.last_quote ?? {};
  return {
    ticker: s.ticker,
    type: s.contract_type?.toUpperCase() === 'CALL' ? 'C' : 'P',
    strike: Number(s.strike_price),
    expiration: s.expiration_date,
    iv: s.implied_volatility,
    delta: greeks.delta,
    gamma: greeks.gamma,
    theta: greeks.theta,
    vega: greeks.vega,
    rho: greeks.rho,
    oi: s.open_interest,
    volume: s.volume,
    bid: quote.bp,
    ask: quote.ap,
    mid:
      quote.bp != null && quote.ap != null
        ? (quote.bp + quote.ap) / 2
        : quote.last_price ?? quote.mid ?? undefined,
  };
}
