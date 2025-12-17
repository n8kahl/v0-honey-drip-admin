/**
 * Trade Lifecycle Domain Logic
 *
 * Canonical, deterministic functions for trade state management.
 * This module ensures trades exist in exactly ONE list at a time
 * (activeTrades, historyTrades, or previewTrade) and state never regresses.
 *
 * @module domain/tradeLifecycle
 */

import type { Trade, TradeState } from "../types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Canonical ordering of trade states (lower index = earlier in lifecycle)
 */
export const TRADE_STATE_ORDER: readonly TradeState[] = [
  "WATCHING",
  "LOADED",
  "ENTERED",
  "EXITED",
] as const;

/**
 * Map state to numeric order for comparison
 */
const STATE_ORDER_MAP: Record<TradeState, number> = {
  WATCHING: 0,
  LOADED: 1,
  ENTERED: 2,
  EXITED: 3,
};

// ============================================================================
// State Comparison
// ============================================================================

/**
 * Compare two trade states.
 *
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareState(a: TradeState, b: TradeState): number {
  return STATE_ORDER_MAP[a] - STATE_ORDER_MAP[b];
}

/**
 * Check if state `a` is more advanced than state `b`
 */
export function isMoreAdvancedState(a: TradeState, b: TradeState): boolean {
  return compareState(a, b) > 0;
}

/**
 * Check if state `a` is at least as advanced as state `b`
 */
export function isAtLeastAsAdvanced(a: TradeState, b: TradeState): boolean {
  return compareState(a, b) >= 0;
}

// ============================================================================
// Trade Version Selection
// ============================================================================

/**
 * Get a timestamp for trade recency comparison.
 * Prefers exitTime > entryTime > updated_at-style inference > 0
 */
function getTradeTimestamp(trade: Trade): number {
  if (trade.exitTime) return trade.exitTime.getTime();
  if (trade.entryTime) return trade.entryTime.getTime();
  // No direct updatedAt on Trade type, use most recent update if available
  if (trade.updates && trade.updates.length > 0) {
    const lastUpdate = trade.updates[trade.updates.length - 1];
    if (lastUpdate.timestamp) {
      return lastUpdate.timestamp instanceof Date
        ? lastUpdate.timestamp.getTime()
        : new Date(lastUpdate.timestamp).getTime();
    }
  }
  return 0;
}

/**
 * Choose between two versions of the same trade (same ID).
 *
 * Rules:
 * 1. NEVER regress state (EXITED trade cannot become ENTERED)
 * 2. If incoming state is more advanced, use incoming
 * 3. If same state, prefer newer by timestamp (exitTime > entryTime > updates)
 * 4. If timestamps equal, prefer incoming (DB is source of truth)
 *
 * @param existing - Current trade version in local state
 * @param incoming - New trade version from database refresh
 * @returns The trade version to keep
 */
export function chooseTradeVersion(existing: Trade, incoming: Trade): Trade {
  if (existing.id !== incoming.id) {
    throw new Error(
      `chooseTradeVersion called with different IDs: ${existing.id} vs ${incoming.id}`
    );
  }

  const existingOrder = STATE_ORDER_MAP[existing.state];
  const incomingOrder = STATE_ORDER_MAP[incoming.state];

  // Rule 1 & 2: Never regress - if existing is more advanced, keep it
  if (existingOrder > incomingOrder) {
    return existing;
  }

  // If incoming is more advanced, use incoming
  if (incomingOrder > existingOrder) {
    return incoming;
  }

  // Same state - compare timestamps, prefer newer
  const existingTs = getTradeTimestamp(existing);
  const incomingTs = getTradeTimestamp(incoming);

  // If incoming is newer or equal, use incoming (DB is source of truth)
  if (incomingTs >= existingTs) {
    return incoming;
  }

  // Existing is newer (unusual case - optimistic update), keep existing
  return existing;
}

// ============================================================================
// Trade List Reconciliation
// ============================================================================

/**
 * Input structure for reconciliation
 */
export interface TradeListsInput {
  activeTrades: Trade[];
  historyTrades: Trade[];
  previewTrade: Trade | null;
}

/**
 * Output structure from reconciliation (same shape, guaranteed consistent)
 */
export interface TradeListsOutput {
  activeTrades: Trade[];
  historyTrades: Trade[];
  previewTrade: Trade | null;
}

/**
 * Determine which list a trade belongs to based on its state
 */
function getListMembership(state: TradeState): "active" | "history" | "preview" {
  if (state === "WATCHING") return "preview";
  if (state === "EXITED") return "history";
  return "active"; // LOADED or ENTERED
}

/**
 * Reconcile trade lists after a database refresh.
 *
 * This function ensures:
 * 1. Each trade ID appears in EXACTLY ONE of activeTrades/historyTrades/previewTrade
 * 2. List membership is derived from the trade's final state after chooseTradeVersion
 * 3. previewTrade is preserved only if not persisted (no DB row with same ID)
 * 4. State never regresses (EXITED trade stays EXITED even if DB returns stale data)
 *
 * @param existing - Current local state (activeTrades, historyTrades, previewTrade)
 * @param incomingDbTrades - Fresh trades from database
 * @returns New consistent state with no duplicates
 */
export function reconcileTradeLists(
  existing: TradeListsInput,
  incomingDbTrades: Trade[]
): TradeListsOutput {
  // Build a map of all trades by ID, choosing the best version
  const tradeMap = new Map<string, Trade>();

  // Step 1: Add all existing trades to map
  for (const trade of existing.activeTrades) {
    tradeMap.set(trade.id, trade);
  }
  for (const trade of existing.historyTrades) {
    const current = tradeMap.get(trade.id);
    if (current) {
      // Duplicate in existing lists - choose best version
      tradeMap.set(trade.id, chooseTradeVersion(current, trade));
    } else {
      tradeMap.set(trade.id, trade);
    }
  }

  // Step 2: Merge incoming DB trades
  for (const incoming of incomingDbTrades) {
    const current = tradeMap.get(incoming.id);
    if (current) {
      // Trade exists - choose best version
      tradeMap.set(incoming.id, chooseTradeVersion(current, incoming));
    } else {
      // New trade from DB
      tradeMap.set(incoming.id, incoming);
    }
  }

  // Step 3: Handle previewTrade
  // Only preserve if it's NOT in the DB (no row with same ID)
  let previewTrade: Trade | null = null;
  if (existing.previewTrade) {
    const dbVersion = tradeMap.get(existing.previewTrade.id);
    if (!dbVersion) {
      // Preview trade not in DB - keep it as preview
      previewTrade = existing.previewTrade;
    }
    // If dbVersion exists, the preview has been persisted - don't keep as preview
  }

  // Step 4: Partition trades into active/history based on final state
  const activeTrades: Trade[] = [];
  const historyTrades: Trade[] = [];

  // Use Array.from() for compatibility with older TS target settings
  const allTrades = Array.from(tradeMap.values());
  for (const trade of allTrades) {
    const membership = getListMembership(trade.state);
    if (membership === "active") {
      activeTrades.push(trade);
    } else if (membership === "history") {
      historyTrades.push(trade);
    }
    // WATCHING trades from DB are unusual - they don't go in activeTrades
    // (only previewTrade should be WATCHING, and that's handled separately)
  }

  return {
    activeTrades,
    historyTrades,
    previewTrade,
  };
}

// ============================================================================
// Invariant Validation
// ============================================================================

/**
 * Violation found during invariant check
 */
export interface TradeListViolation {
  type: "duplicate_id" | "wrong_list_membership" | "state_regression" | "preview_in_db";
  tradeId: string;
  details: string;
}

/**
 * Validate trade list invariants.
 *
 * Checks:
 * 1. No duplicate IDs across all lists
 * 2. Active trades are LOADED or ENTERED (not EXITED, not WATCHING)
 * 3. History trades are EXITED
 * 4. Preview trade (if any) is WATCHING
 *
 * @param lists - Trade lists to validate
 * @returns Array of violations (empty if valid)
 */
export function validateTradeListsInvariants(lists: TradeListsInput): TradeListViolation[] {
  const violations: TradeListViolation[] = [];
  const seenIds = new Map<string, string>(); // id -> list name

  // Check activeTrades
  for (const trade of lists.activeTrades) {
    // Duplicate check
    const seenIn = seenIds.get(trade.id);
    if (seenIn) {
      violations.push({
        type: "duplicate_id",
        tradeId: trade.id,
        details: `Trade appears in both ${seenIn} and activeTrades`,
      });
    } else {
      seenIds.set(trade.id, "activeTrades");
    }

    // State membership check
    if (trade.state === "EXITED") {
      violations.push({
        type: "wrong_list_membership",
        tradeId: trade.id,
        details: `EXITED trade ${trade.ticker} found in activeTrades (should be in historyTrades)`,
      });
    }
    if (trade.state === "WATCHING") {
      violations.push({
        type: "wrong_list_membership",
        tradeId: trade.id,
        details: `WATCHING trade ${trade.ticker} found in activeTrades (should be previewTrade)`,
      });
    }
  }

  // Check historyTrades
  for (const trade of lists.historyTrades) {
    // Duplicate check
    const seenIn = seenIds.get(trade.id);
    if (seenIn) {
      violations.push({
        type: "duplicate_id",
        tradeId: trade.id,
        details: `Trade appears in both ${seenIn} and historyTrades`,
      });
    } else {
      seenIds.set(trade.id, "historyTrades");
    }

    // State membership check
    if (trade.state !== "EXITED") {
      violations.push({
        type: "wrong_list_membership",
        tradeId: trade.id,
        details: `Non-EXITED trade ${trade.ticker} (state=${trade.state}) found in historyTrades`,
      });
    }
  }

  // Check previewTrade
  if (lists.previewTrade) {
    const seenIn = seenIds.get(lists.previewTrade.id);
    if (seenIn) {
      violations.push({
        type: "preview_in_db",
        tradeId: lists.previewTrade.id,
        details: `previewTrade also exists in ${seenIn}`,
      });
    }

    if (lists.previewTrade.state !== "WATCHING") {
      violations.push({
        type: "wrong_list_membership",
        tradeId: lists.previewTrade.id,
        details: `previewTrade has state ${lists.previewTrade.state} (should be WATCHING)`,
      });
    }
  }

  return violations;
}

/**
 * Assert that trade lists are valid (throws in development, logs in production)
 */
export function assertTradeListsValid(lists: TradeListsInput, context: string = "unknown"): void {
  const violations = validateTradeListsInvariants(lists);

  if (violations.length > 0) {
    const message = `[TradeLifecycle] Invariant violations in ${context}:\n${violations
      .map((v) => `  - ${v.type}: ${v.details}`)
      .join("\n")}`;

    if (process.env.NODE_ENV === "development") {
      console.error(message);
      // Optionally throw in dev to catch bugs early
      // throw new Error(message);
    } else {
      console.warn(message);
    }
  }
}
