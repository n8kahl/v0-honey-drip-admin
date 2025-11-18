export type TradeType = 'SCALP' | 'DAY' | 'SWING' | 'LEAP';

export interface RiskProfile {
  tfPrimary: '1m' | '5m' | '15m' | '1h' | '1d';
  tfSecondary: '5m' | '15m' | '1h' | '1d';
  atrTF: '1m' | '5m' | '15m' | '1h' | '1d';
  atrLen: number;
  vwap: 'session' | 'anchored-session' | 'anchored-long';
  useLevels: string[];
  levelWeights: Record<string, number>;
  tpATRFrac: [number, number]; // [TP1, TP2] as fractions of ATR
  slATRFrac: number;
  trailStep: number;
  endOfDayCutoffMins?: number; // For intraday only
}

// Default DTE thresholds (configurable in settings)
export interface DTEThresholds {
  scalp: number; // 0 DTE (same day expiry)
  day: number; // 1-4 DTE
  swing: number; // 5-29 DTE
  // >=30 DTE = LEAP
}

export const DEFAULT_DTE_THRESHOLDS: DTEThresholds = {
  scalp: 0,
  day: 4,
  swing: 29,
};

export const RISK_PROFILES: Record<TradeType, RiskProfile> = {
  SCALP: {
    tfPrimary: '1m',
    tfSecondary: '5m',
    atrTF: '1m',
    atrLen: 14,
    vwap: 'session',
    useLevels: ['PremarketHL', 'ORB', 'VWAP', 'VWAPBands', 'PrevDayHL', 'Boll20'],
    levelWeights: {
      ORB: 1.0,
      VWAP: 1.0,
      VWAPBands: 0.7,
      PremarketHL: 0.8,
      PrevDayHL: 0.5,
      Boll20: 0.4,
    },
    tpATRFrac: [0.25, 0.5],
    slATRFrac: 0.2,
    trailStep: 0.1,
    endOfDayCutoffMins: 15,
  },
  DAY: {
    tfPrimary: '1m',
    tfSecondary: '15m',
    atrTF: '5m',
    atrLen: 14,
    vwap: 'session',
    useLevels: ['PremarketHL', 'ORB', 'VWAP', 'VWAPBands', 'PrevDayHL', 'Boll20'],
    levelWeights: {
      ORB: 1.0,
      VWAP: 1.0,
      VWAPBands: 0.8,
      PremarketHL: 0.7,
      PrevDayHL: 0.6,
      Boll20: 0.5,
    },
    tpATRFrac: [0.4, 0.8],
    slATRFrac: 0.25,
    trailStep: 0.15,
    endOfDayCutoffMins: 15,
  },
  SWING: {
    tfPrimary: '15m',
    tfSecondary: '1h',
    atrTF: '1h',
    atrLen: 14,
    vwap: 'anchored-session',
    useLevels: ['PrevDayHL', 'WeeklyHL', 'MonthlyHL', 'VWAP', 'Boll20'],
    levelWeights: {
      WeeklyHL: 1.0,
      PrevDayHL: 0.8,
      VWAP: 0.7,
      MonthlyHL: 0.7,
      Boll20: 0.6,
    },
    tpATRFrac: [0.8, 1.5],
    slATRFrac: 0.4,
    trailStep: 0.25,
  },
  LEAP: {
    tfPrimary: '1h',
    tfSecondary: '1d',
    atrTF: '1d',
    atrLen: 14,
    vwap: 'anchored-long',
    useLevels: ['MonthlyHL', 'QuarterlyHL', 'YearlyHL', 'VWAP', 'Boll20'],
    levelWeights: {
      MonthlyHL: 1.0,
      QuarterlyHL: 0.9,
      VWAP: 0.8,
      YearlyHL: 0.8,
      Boll20: 0.6,
    },
    tpATRFrac: [1.0, 2.0],
    slATRFrac: 0.5,
    trailStep: 0.3,
  },
};

/**
 * Infer trade type from DTE
 */
export function inferTradeTypeByDTE(
  expirationISO: string,
  now: Date = new Date(),
  thresholds: DTEThresholds = DEFAULT_DTE_THRESHOLDS
): TradeType {
  const expiration = new Date(expirationISO);
  const diffMs = expiration.getTime() - now.getTime();
  const dte = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  if (dte <= thresholds.scalp) return 'SCALP';
  if (dte <= thresholds.day) return 'DAY';
  if (dte <= thresholds.swing) return 'SWING';
  return 'LEAP';
}
