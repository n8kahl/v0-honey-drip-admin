export type ChallengeScope = 'admin' | 'honeydrip-wide';

export type TradeState = 'WATCHING' | 'LOADED' | 'ENTERED' | 'EXITED';
export type SessionStatus = 'premarket' | 'open' | 'afterhours' | 'closed';
export type OptionType = 'C' | 'P';
export type TradeType = 'Scalp' | 'Day' | 'Swing' | 'LEAP';
export type AlertType = 'load' | 'enter' | 'update' | 'trail-stop' | 'update-sl' | 'trim' | 'add' | 'exit';
export type StopMode = 'fixed' | 'trailing';

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
}

export interface Trade {
  id: string;
  ticker: string;
  contract: Contract;
  tradeType: TradeType;
  state: TradeState;
  entryPrice?: number;
  entryTime?: Date;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  stopMode?: StopMode;
  movePercent?: number;
  exitPrice?: number;
  exitTime?: Date;
  updates: TradeUpdate[];
  discordChannels: string[];
  challenges: string[];
}

export interface TradeUpdate {
  id: string;
  type: 'enter' | 'trim' | 'update' | 'update-sl' | 'trail-stop' | 'add' | 'exit' | 'tp_near';
  timestamp: Date;
  message: string;
  price: number;
  pnlPercent?: number;
}

export interface TradeEvent {
  type: 'load' | 'enter' | 'trim' | 'update' | 'exit';
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
