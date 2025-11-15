export type RiskMode = 'percent' | 'calculated';
export type TrailMode = 'none' | 'fixed' | 'atr';
export type StopType = 'fixed' | 'breakeven' | 'trailing';
export type TradeType = 'SCALP' | 'DAY' | 'SWING' | 'LEAP';

export interface AdminRiskDefaults {
  mode: RiskMode;
  tpPercent?: number;
  slPercent?: number;
  trailMode?: TrailMode;
  atrPeriod?: number;
  atrMultiplier?: number;
  dteThresholds?: {
    scalp: number;
    day: number;
    swing: number;
  };
  orbMinutes?: number;
}

export interface KeyLevels {
  preMarketHigh?: number;
  preMarketLow?: number;
  orbHigh?: number;
  orbLow?: number;
  priorDayHigh?: number;
  priorDayLow?: number;
  priorDayClose?: number;
  weeklyHigh?: number;
  weeklyLow?: number;
  monthlyHigh?: number;
  monthlyLow?: number;
  quarterlyHigh?: number;
  quarterlyLow?: number;
  yearlyHigh?: number;
  yearlyLow?: number;
  vwap?: number;
  vwapUpperBand?: number;
  vwapLowerBand?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  bollingerMiddle?: number;
}

export interface RiskCalculationInput {
  entryPrice: number;
  currentUnderlyingPrice: number;
  currentOptionMid: number;
  keyLevels: KeyLevels;
  atr?: number;
  defaults: AdminRiskDefaults;
  timestamp?: number;
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
  expirationISO?: string;
  tradeType?: TradeType; // Can be passed or inferred
}

export interface RiskCalculationResult {
  targetPrice: number;
  stopLoss: number;
  targetPrice2?: number;
  targetPremium?: number;
  targetPremium2?: number;
  stopLossPremium?: number;
  riskRewardRatio: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  calculatedAt: number;
  usedLevels: string[];
  tradeType?: TradeType;
  profile?: string;
  dte?: number;
}

export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LevelCandidate {
  price: number;
  reason: string;
  weight: number;
  distance: number;
}
