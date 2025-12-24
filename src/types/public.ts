/**
 * Public Portal Types
 *
 * Canonical type definitions for public-facing components and API responses.
 * All public components should import types from this file.
 *
 * IMPORTANT: Contract type uses "C" | "P" to match src/types/index.ts canonical format.
 * Property names use "expiry" (not "expiration") for consistency.
 */

// ============================================================================
// Contract Types
// ============================================================================

/**
 * Canonical contract type - matches OptionType from src/types/index.ts
 * "C" for Call, "P" for Put
 */
export type PublicContractType = "C" | "P";

/**
 * Public-facing contract information
 */
export interface PublicContract {
  strike?: number;
  type?: PublicContractType;
  expiry?: string; // ISO date string or "YYYY-MM-DD"
  symbol?: string; // Full OCC symbol if available
}

// ============================================================================
// Trade Types
// ============================================================================

/**
 * Trade type categories
 */
export type PublicTradeType = "Scalp" | "Day" | "Swing" | "LEAP";

/**
 * Trade state for public display
 * Note: WATCHING is not included as it's not public-facing
 */
export type PublicTradeState = "LOADED" | "ENTERED" | "EXITED";

/**
 * Complete public trade representation
 * Matches the shape returned by /api/public/trades/active
 */
export interface PublicTrade {
  id: string;
  ticker: string;
  trade_type: PublicTradeType;
  state: PublicTradeState;
  contract: PublicContract | null;
  entry_price: number | null;
  current_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  exit_price: number | null;
  admin_id: string | null;
  admin_name: string | null;
  share_token: string | null;
  public_comment: string | null;
  created_at: string;
  entry_time: string | null;
  exit_time?: string | null;
  updated_at?: string;
  // Computed fields from API
  pnl_percent?: number | null;
  time_in_trade?: string | null;
  progress_to_target?: number | null;
}

/**
 * Response from /api/public/trades/active
 */
export interface PublicTradesResponse {
  trades: PublicTrade[];
  grouped: {
    scalps: PublicTrade[];
    day_trades: PublicTrade[];
    swings: PublicTrade[];
    leaps: PublicTrade[];
  };
  total: number;
  by_state: {
    loaded: number;
    entered: number;
  };
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Trade update/alert types
 */
export type PublicAlertType =
  | "enter"
  | "trim"
  | "update"
  | "update-sl"
  | "trail-stop"
  | "add"
  | "exit";

/**
 * Trade alert/update for the alert feed
 * Matches the shape returned by /api/public/alerts/recent
 */
export interface PublicTradeAlert {
  id: string;
  type: PublicAlertType;
  message: string;
  price: number;
  pnl_percent: number | null;
  trim_percent: number | null;
  created_at: string;
  trade: {
    id: string;
    ticker: string;
    trade_type: string;
    contract: PublicContract | null;
    admin_name: string | null;
  };
}

/**
 * Response from /api/public/alerts/recent
 */
export interface PublicAlertsResponse {
  alerts: PublicTradeAlert[];
  has_more: boolean;
  is_member_view: boolean;
}

// ============================================================================
// Challenge Types
// ============================================================================

/**
 * Public challenge with progress calculations
 * Matches the shape returned by /api/public/challenges/active
 */
export interface PublicChallenge {
  id: string;
  name: string;
  description?: string;
  starting_balance: number;
  current_balance: number;
  target_balance: number;
  start_date: string;
  end_date: string;
  scope?: "admin" | "honeydrip-wide";
  // Computed by API
  progress_percent: number;
  current_pnl: number;
  days_elapsed: number;
  days_remaining: number;
  total_days: number;
}

/**
 * Response from /api/public/challenges/active
 */
export interface PublicChallengesResponse {
  challenges: PublicChallenge[];
}

// ============================================================================
// Stats Types
// ============================================================================

/**
 * Time range for stats queries
 */
export type StatsRange = "day" | "week" | "month";

/**
 * Breakdown of stats by trade type
 */
export interface StatsByType {
  count: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_pnl: number;
  win_rate: number;
}

/**
 * Summary statistics for a time range
 * Matches the shape returned by /api/public/stats/summary
 */
export interface PublicStatsSummary {
  range: StatsRange;
  start_date: string;
  end_date: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl_percent: number;
  avg_pnl_percent: number;
  best_trade: {
    percent: number;
    id: string | null;
  };
  worst_trade: {
    percent: number;
    id: string | null;
  };
  by_type: Record<string, StatsByType>;
  updated_at: string;
}

/**
 * Admin performance on leaderboard
 */
export interface AdminStats {
  admin_id: string;
  admin_name: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_gain_percent: number;
  win_rate: number;
}

/**
 * Response from /api/public/stats/leaderboard
 */
export interface PublicLeaderboardResponse {
  leaderboard: AdminStats[];
  updated_at: string;
}

// ============================================================================
// Module Freshness Types
// ============================================================================

/**
 * Freshness state for a single data module
 */
export interface ModuleStatus {
  updatedAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Combined freshness state for all public portal modules
 */
export interface PublicPortalFreshness {
  alerts: ModuleStatus;
  trades: ModuleStatus;
  stats: ModuleStatus;
  challenges: ModuleStatus;
  calendar: ModuleStatus;
  premarket: ModuleStatus;
}

// ============================================================================
// Utility Type Guards
// ============================================================================

/**
 * Type guard to check if a trade is in ENTERED state
 */
export function isEnteredTrade(trade: PublicTrade): boolean {
  return trade.state === "ENTERED";
}

/**
 * Type guard to check if a trade is in LOADED state
 */
export function isLoadedTrade(trade: PublicTrade): boolean {
  return trade.state === "LOADED";
}

/**
 * Type guard to check if a trade is exited
 */
export function isExitedTrade(trade: PublicTrade): boolean {
  return trade.state === "EXITED";
}

/**
 * Type guard to validate PublicTradeType
 */
export function isValidTradeType(type: string): type is PublicTradeType {
  return ["Scalp", "Day", "Swing", "LEAP"].includes(type);
}

/**
 * Type guard to validate PublicContractType
 */
export function isValidContractType(type: string): type is PublicContractType {
  return type === "C" || type === "P";
}
