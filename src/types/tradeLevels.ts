export type ChartLevelType =
  | 'ENTRY'
  | 'TP'
  | 'SL'
  | 'PREMARKET_HIGH'
  | 'PREMARKET_LOW'
  | 'ORB_HIGH'
  | 'ORB_LOW'
  | 'PREV_DAY_HIGH'
  | 'PREV_DAY_LOW'
  | 'VWAP'
  | 'VWAP_BAND'
  | 'BOLLINGER'
  | 'OTHER';

export interface ChartLevel {
  type: ChartLevelType;
  label: string;        // e.g. "TP1", "SL", "Premarket H", "VWAP"
  price: number;        // underlying or option price (whichever the chart is using)
  meta?: {
    tpIndex?: number;   // for TP1/TP2
    reason?: string;    // optional "based on ATR / VWAP / ORB"
  };
}
