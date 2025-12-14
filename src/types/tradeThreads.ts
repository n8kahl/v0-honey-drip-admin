/**
 * Trade Threads V1 - Type Definitions
 *
 * HoneyDrip's core differentiator: Trade Threads enable members to:
 * - Subscribe to admin trades ("I took this trade")
 * - See all admin updates in a timeline
 * - Track personal P/L based on their entry
 * - Receive in-app notifications
 */

import { Contract, TradeType } from "./index";

// ============================================================================
// Trade Thread Types
// ============================================================================

export type TradeThreadStatus = "open" | "closed";
export type TradeThreadOutcome = "win" | "loss" | "breakeven";
export type TradeThreadUpdateType =
  | "OPEN"
  | "UPDATE"
  | "STOP_MOVE"
  | "TRIM"
  | "EXIT"
  | "NOTE";

/**
 * TradeThread - Canonical trade object linking all admin updates
 */
export interface TradeThread {
  id: string;
  adminId: string;
  adminName?: string;
  symbol: string;
  contractId: string; // e.g., "SPY250120C600"
  contract?: Contract;

  // Thread status
  status: TradeThreadStatus;

  // Original alert data
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  tradeType?: TradeType;

  // Outcome (populated on close)
  exitPrice?: number;
  finalPnlPercent?: number;
  outcome?: TradeThreadOutcome;

  // Timestamps
  createdAt: Date;
  closedAt?: Date;
  latestUpdateAt: Date;

  // Tags for filtering
  tags?: string[];

  // Loaded relationships
  updates?: TradeThreadUpdate[];
  memberTrade?: MemberTrade; // Current user's subscription
  memberCount?: number; // How many members subscribed
}

/**
 * TradeThreadUpdate - A single admin action on a thread
 */
export interface TradeThreadUpdate {
  id: string;
  tradeThreadId: string;
  adminId: string;

  // Update type
  type: TradeThreadUpdateType;

  // Content
  message?: string;
  payload?: TradeThreadUpdatePayload;

  // Timestamp
  createdAt: Date;
}

/**
 * Payload for different update types
 */
export interface TradeThreadUpdatePayload {
  stopPrice?: number;
  targetPrices?: number[];
  entryPrice?: number;
  exitPrice?: number;
  pnlPercent?: number;
  trimPercent?: number;
  note?: string;
}

// ============================================================================
// Member Trade Types
// ============================================================================

export type MemberTradeStatus = "active" | "exited";

/**
 * MemberTrade - A member's subscription to a trade thread
 */
export interface MemberTrade {
  id: string;
  userId: string;
  tradeThreadId: string;

  // Entry details (required)
  entryPrice: number;
  entryTime: Date;

  // Optional details
  sizeContracts?: number;
  stopPrice?: number; // Custom stop (default: use admin's)
  targets?: number[]; // Custom targets (default: use admin's)

  // Exit details
  exitPrice?: number;
  exitTime?: Date;

  // Status
  status: MemberTradeStatus;

  // Journal
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Loaded relationships
  tradeThread?: TradeThread;
}

/**
 * Input for creating a member trade ("I took this trade")
 */
export interface CreateMemberTradeInput {
  tradeThreadId: string;
  entryPrice: number;
  sizeContracts?: number;
  stopPrice?: number;
  targets?: number[];
  notes?: string;
  useAdminStopTargets?: boolean; // Default: true
}

/**
 * Input for exiting a member trade
 */
export interface ExitMemberTradeInput {
  memberTradeId: string;
  exitPrice: number;
  notes?: string;
}

// ============================================================================
// Public Outcomes Types
// ============================================================================

/**
 * PublicTradeOutcome - Published EOD result for /wins feed
 */
export interface PublicTradeOutcome {
  id: string;
  tradeThreadId: string;

  // Trade details
  symbol: string;
  contractId: string;
  tradeType?: TradeType;

  // Outcome
  outcome: TradeThreadOutcome;
  pnlPercent: number;

  // Admin attribution
  adminId?: string;
  adminName?: string;
  adminAvatarUrl?: string;

  // Entry masking
  entryPriceMasked: boolean;

  // Public comment
  publicComment?: string;

  // Timestamps
  tradeOpenedAt?: Date;
  tradeClosedAt?: Date;
  publishedAt: Date;
  publishDate: string; // YYYY-MM-DD
}

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Member notification preferences
 */
export interface MemberNotificationPrefs {
  id: string;
  userId: string;
  pnlThresholds: number[]; // e.g., [10, 20, -10]
  notifyAdminUpdates: boolean;
  notifyPnlThresholds: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-app notification for trade updates
 */
export interface TradeNotification {
  id: string;
  type: "admin_update" | "pnl_threshold" | "trade_closed";
  tradeThreadId: string;
  memberTradeId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response when creating a trade thread
 */
export interface CreateTradeThreadResponse {
  thread: TradeThread;
  openUpdate: TradeThreadUpdate;
}

/**
 * Response when adding an update to a thread
 */
export interface AddThreadUpdateResponse {
  update: TradeThreadUpdate;
  threadClosed: boolean; // True if this was an EXIT update
}

/**
 * Response when creating a member trade
 */
export interface CreateMemberTradeResponse {
  memberTrade: MemberTrade;
  thread: TradeThread;
}

/**
 * Paginated public outcomes for /wins
 */
export interface PublicOutcomesResponse {
  outcomes: PublicTradeOutcome[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Store State Types
// ============================================================================

/**
 * Trade Thread Store State
 */
export interface TradeThreadStoreState {
  // All visible threads (admin view)
  threads: TradeThread[];

  // Member's active subscriptions
  myTrades: MemberTrade[];

  // Completed member trades (journal)
  journalTrades: MemberTrade[];

  // Currently focused thread
  currentThreadId: string | null;

  // Notifications
  notifications: TradeNotification[];
  unreadCount: number;

  // Loading states
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Calculate P/L percentage
 */
export function calculatePnlPercent(entryPrice: number, currentPrice: number): number {
  if (!entryPrice || entryPrice === 0) return 0;
  return ((currentPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Determine outcome from P/L
 */
export function determineOutcome(pnlPercent: number): TradeThreadOutcome {
  if (pnlPercent > 0.5) return "win";
  if (pnlPercent < -0.5) return "loss";
  return "breakeven";
}

/**
 * Format contract ID from contract object
 */
export function formatContractId(symbol: string, contract: Contract): string {
  const expiry = contract.expiry?.replace(/-/g, "").slice(2) || "000000";
  const type = contract.type === "C" ? "C" : "P";
  const strike = Math.round(contract.strike * 1000)
    .toString()
    .padStart(8, "0");
  return `${symbol}${expiry}${type}${strike}`;
}

/**
 * Map database row to TradeThread
 */
export function mapDbRowToTradeThread(row: any): TradeThread {
  return {
    id: row.id,
    adminId: row.admin_id,
    adminName: row.admin_name,
    symbol: row.symbol,
    contractId: row.contract_id,
    contract: row.contract,
    status: row.status,
    entryPrice: row.entry_price ? parseFloat(row.entry_price) : undefined,
    targetPrice: row.target_price ? parseFloat(row.target_price) : undefined,
    stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
    tradeType: row.trade_type,
    exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
    finalPnlPercent: row.final_pnl_percent ? parseFloat(row.final_pnl_percent) : undefined,
    outcome: row.outcome,
    createdAt: new Date(row.created_at),
    closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    latestUpdateAt: new Date(row.latest_update_at || row.created_at),
    tags: row.tags || [],
    updates: row.trade_thread_updates?.map(mapDbRowToTradeThreadUpdate),
    memberTrade: row.member_trades?.[0] ? mapDbRowToMemberTrade(row.member_trades[0]) : undefined,
  };
}

/**
 * Map database row to TradeThreadUpdate
 */
export function mapDbRowToTradeThreadUpdate(row: any): TradeThreadUpdate {
  return {
    id: row.id,
    tradeThreadId: row.trade_thread_id,
    adminId: row.admin_id,
    type: row.type,
    message: row.message,
    payload: row.payload,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Map database row to MemberTrade
 */
export function mapDbRowToMemberTrade(row: any): MemberTrade {
  return {
    id: row.id,
    userId: row.user_id,
    tradeThreadId: row.trade_thread_id,
    entryPrice: parseFloat(row.entry_price),
    entryTime: new Date(row.entry_time || row.created_at),
    sizeContracts: row.size_contracts,
    stopPrice: row.stop_price ? parseFloat(row.stop_price) : undefined,
    targets: row.targets,
    exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
    exitTime: row.exit_time ? new Date(row.exit_time) : undefined,
    status: row.status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at || row.created_at),
    tradeThread: row.trade_threads ? mapDbRowToTradeThread(row.trade_threads) : undefined,
  };
}

/**
 * Map database row to PublicTradeOutcome
 */
export function mapDbRowToPublicOutcome(row: any): PublicTradeOutcome {
  return {
    id: row.id,
    tradeThreadId: row.trade_thread_id,
    symbol: row.symbol,
    contractId: row.contract_id,
    tradeType: row.trade_type,
    outcome: row.outcome,
    pnlPercent: parseFloat(row.pnl_percent),
    adminId: row.admin_id,
    adminName: row.admin_name,
    adminAvatarUrl: row.admin_avatar_url,
    entryPriceMasked: row.entry_price_masked,
    publicComment: row.public_comment,
    tradeOpenedAt: row.trade_opened_at ? new Date(row.trade_opened_at) : undefined,
    tradeClosedAt: row.trade_closed_at ? new Date(row.trade_closed_at) : undefined,
    publishedAt: new Date(row.published_at),
    publishDate: row.publish_date,
  };
}
