export type IndexId = 'I:SPX' | 'I:NDX' | 'I:VIX' | 'I:RUT' | string;

export interface UiIndexBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

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

export type WsEvent =
  | {
      ev: 'Q';
      sym: string;
      bp: number;
      ap: number;
      bs: number;
      as: number;
      t: number;
      q: number;
    }
  | {
      ev: 'V' | 'AM' | 'A';
      T: IndexId;
      o?: number;
      h?: number;
      l?: number;
      c?: number;
      v?: number;
      s: number;
      e?: number;
      val?: number;
    };
