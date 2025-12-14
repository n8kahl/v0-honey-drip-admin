export type ChallengeScope = "admin" | "honeydrip-wide";

export type TradeState = "WATCHING" | "LOADED" | "ENTERED" | "EXITED";
export type SessionStatus = "premarket" | "open" | "afterhours" | "closed";
export type OptionType = "C" | "P";
export type TradeType = "Scalp" | "Day" | "Swing" | "LEAP";
export type AlertType =
  | "load"
  | "enter"
  | "update"
  | "trail-stop"
  | "update-sl"
  | "trim"
  | "add"
  | "exit";
export type StopMode = "fixed" | "trailing";

export interface DiscordChannel {
  id: string;
  name: string;
  webhookUrl: string;
  createdAt: Date;
  description?: string;
  isActive?: boolean;
  isGlobalDefault?: boolean;
  isDefaultLoad?: boolean;
  isDefaultEnter?: boolean;
  isDefaultExit?: boolean;
  isDefaultUpdate?: boolean;
}

export interface Ticker {
  id: string;
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
}

export interface Contract {
  id: string;
  strike: number;
  expiry: string;
  expiration?: string; // Alternative property name used in some components
  expiryDate: Date;
  daysToExpiry: number;
  type: OptionType;
  mid: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  iv?: number;
}

export interface Challenge {
  id: string;
  name: string;
  description?: string;
  startingBalance: number;
  currentBalance: number;
  targetBalance: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: Date;
  archivedAt?: Date | null;
  scope?: ChallengeScope;
  defaultChannel?: string;
}

// Setup types from CompositeScanner detectors
export type SetupType =
  | "BREAKOUT"
  | "REVERSAL"
  | "MOMENTUM"
  | "BREAK_AND_RETEST"
  | "TREND_CONTINUATION"
  | "RANGE_FADE"
  | "VWAP_BOUNCE"
  | "GAP_FILL"
  | "SQUEEZE_BREAKOUT"
  | "DIVERGENCE"
  | "SUPPORT_BOUNCE"
  | "RESISTANCE_REJECTION"
  | "CUSTOM"
  // KCU LTP Strategy Types
  | "KCU_EMA_BOUNCE"
  | "KCU_VWAP_STANDARD"
  | "KCU_VWAP_ADVANCED"
  | "KCU_KING_QUEEN"
  | "KCU_ORB_BREAKOUT"
  | "KCU_CLOUD_BOUNCE";

/**
 * Check if a setup type is a KCU LTP strategy
 */
export function isKCUSetupType(setupType?: SetupType): boolean {
  if (!setupType) return false;
  return setupType.startsWith("KCU_");
}

// Individual confluence factor with value and status
export interface ConfluenceFactor {
  value: number; // Raw value (e.g., IV percentile = 85)
  status: "bullish" | "bearish" | "neutral"; // Direction indicator
  label: string; // Human readable (e.g., "IV 85%")
  weight?: number; // How much this factor contributed to score
}

// Full confluence breakdown for a trade
export interface TradeConfluence {
  score: number; // Overall confluence score 0-100
  direction: "LONG" | "SHORT";
  factors: {
    ivPercentile?: ConfluenceFactor;
    mtfAlignment?: ConfluenceFactor;
    flowPressure?: ConfluenceFactor;
    gammaExposure?: ConfluenceFactor;
    regime?: ConfluenceFactor;
    vwapPosition?: ConfluenceFactor;
    volumeProfile?: ConfluenceFactor;
  };
  keyLevels?: import("../lib/riskEngine/types").KeyLevels; // Real-time key levels for TP/SL calculations and metric display
  updatedAt: Date;
  isStale?: boolean; // True if data is >60s old
}

export interface Trade {
  id: string;
  ticker: string;
  contract: Contract;
  tradeType: TradeType;
  state: TradeState;
  setupType?: SetupType; // Detected pattern type
  entryPrice?: number;
  entryTime?: Date;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  stopMode?: StopMode;
  movePercent?: number;
  movePrice?: number;
  exitPrice?: number;
  exitTime?: Date;
  updates: TradeUpdate[];
  discordChannels: string[];
  challenges: string[];
  quantity?: number; // Number of contracts
  // Rich confluence data with factor breakdown
  confluence?: TradeConfluence;
  confluenceUpdatedAt?: Date;
  // Entry snapshot data for trade analysis
  ivAtEntry?: number; // IV at time of entry (detect IV crush)
  deltaAtEntry?: number; // Delta at entry
  underlyingAtEntry?: number; // Underlying price at entry
  // Underlying price context for TP/SL display (Format C)
  targetUnderlyingPrice?: number;
  targetUnderlyingPrice2?: number;
  stopUnderlyingPrice?: number;
  underlyingPriceAtLoad?: number;
  // Setup conditions snapshot for thesis validation
  setupConditions?: SetupConditions;
  originalSignalScore?: number; // Composite signal score at entry
  // Trade notes for journal
  notes?: string;
  // Voice command context for pre-filling alert composer
  voiceContext?: string;
  // R-multiple for risk/reward tracking (computed from entry, exit, stopLoss)
  rMultiple?: number;
  // Legacy confluence fields (deprecated, use confluence.factors)
  legacyConfluence?: {
    trend?: string;
    volatility?: string;
    liquidity?: string;
    strength?: string;
  };
}

// Setup conditions captured at trade entry for thesis validation
export interface SetupConditions {
  // Technical setup
  mtfAlignment?: {
    m1: "up" | "down" | "neutral";
    m5: "up" | "down" | "neutral";
    m15: "up" | "down" | "neutral";
    m60: "up" | "down" | "neutral";
  };
  vwapPosition?: "above" | "below" | "at";
  orbPosition?: "above_high" | "below_low" | "inside";
  // Flow/sentiment
  flowBias?: "bullish" | "bearish" | "neutral";
  flowScore?: number;
  // Market context
  vixLevel?: number;
  marketRegime?: "trending" | "ranging" | "volatile" | "choppy";
  // Volume
  relativeVolume?: number; // vs 20-day avg
  // Captured at
  capturedAt?: Date;
}

export interface TradeUpdate {
  id: string;
  type: "enter" | "trim" | "update" | "update-sl" | "trail-stop" | "add" | "exit" | "tp_near";
  timestamp: Date;
  message: string;
  price: number;
  pnlPercent?: number;
}

export interface TradeEvent {
  type: "load" | "enter" | "trim" | "update" | "exit";
  timestamp: number;
  price: number;
  label: string;
  color?: string;
}

export interface AlertChannels {
  discord: boolean;
  telegram: boolean;
  app: boolean;
}
