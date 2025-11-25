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
  isActive?: boolean;
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
  | "CUSTOM";

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
  // Rich confluence data with factor breakdown
  confluence?: TradeConfluence;
  confluenceUpdatedAt?: Date;
  // Legacy confluence fields (deprecated, use confluence.factors)
  legacyConfluence?: {
    trend?: string;
    volatility?: string;
    liquidity?: string;
    strength?: string;
  };
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
