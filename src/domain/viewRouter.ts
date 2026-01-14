/**
 * viewRouter.ts - Single Source of Truth for View Routing
 *
 * This module provides centralized logic for determining what view to show
 * based on the current trade state and user focus. Both desktop and mobile
 * should use this to ensure consistent behavior.
 *
 * Key concepts:
 * - FocusTarget: What the user is focusing on (symbol or trade)
 * - ViewState: What view should be rendered
 * - AlertMode: What type of alert UI should be available
 */

import type { Trade, TradeState, Ticker } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * FocusTarget - What the CENTER panel should display
 *
 * - null: No focus, show empty state
 * - { kind: "symbol" }: Show options chain for the symbol
 * - { kind: "trade" }: Show trade details/management
 */
export type FocusTarget =
  | { kind: "symbol"; symbol: string }
  | { kind: "trade"; tradeId: string }
  | null;

/**
 * ViewState - Which view component to render
 *
 * - empty: No selection (NowPanelEmpty)
 * - symbol: Options chain view (NowPanelSymbol)
 * - plan: Trade preview/planning view (NowPanelTrade) - for WATCHING state (not yet persisted)
 * - loaded: Trade setup view (NowPanelTrade) - for LOADED state (persisted, ready to enter)
 * - entered: Trade management view (NowPanelManage)
 * - exited: Trade recap view (NowPanelTrade in recap mode)
 */
export type ViewState = "empty" | "symbol" | "plan" | "loaded" | "entered" | "exited";

/**
 * AlertMode - What type of alert UI is available
 *
 * - load: "Load and Alert" option
 * - entry: "Enter and Alert" option
 * - update: Update/trim/exit options
 * - exit: Final exit recap
 */
export type AlertMode = "load" | "entry" | "update" | "exit";

// ============================================================================
// Focus Derivation
// ============================================================================

/**
 * Derive the focus target from current state
 *
 * Priority:
 * 1. If currentTradeId is explicitly null → show symbol focus (if ticker exists)
 * 2. If currentTrade exists → show trade focus
 * 3. Fallback to symbol focus (if ticker exists)
 * 4. Otherwise null (empty state)
 *
 * @param currentTradeId - ID of focused trade (null means explicitly cleared)
 * @param currentTrade - The focused trade object
 * @param activeTicker - Currently selected ticker from watchlist
 */
export function deriveFocus(
  currentTradeId: string | null,
  currentTrade: Trade | null,
  activeTicker: Ticker | null
): FocusTarget {
  // PRIORITY 1: If currentTradeId is explicitly null, show symbol focus
  // This ensures clicking a watchlist item clears trade focus immediately
  if (currentTradeId === null) {
    if (activeTicker) {
      return { kind: "symbol", symbol: activeTicker.symbol };
    }
    return null;
  }

  // PRIORITY 2: If we have a currentTrade, show trade focus
  if (currentTrade) {
    const effectiveState = currentTrade.state;
    if (["WATCHING", "LOADED", "ENTERED", "EXITED"].includes(effectiveState)) {
      return { kind: "trade", tradeId: currentTrade.id };
    }
  }

  // PRIORITY 3: Fallback to symbol focus if we have an active ticker
  if (activeTicker) {
    return { kind: "symbol", symbol: activeTicker.symbol };
  }

  return null;
}

// ============================================================================
// View State Derivation
// ============================================================================

/**
 * Derive the view state from focus and trade data
 *
 * @param focus - Current focus target
 * @param currentTrade - The focused trade (may be preview or persisted)
 * @param activeTrades - All active trades (LOADED + ENTERED)
 * @param tradeState - Current trade state from store
 */
export function deriveViewState(
  focus: FocusTarget,
  currentTrade: Trade | null,
  activeTrades: Trade[],
  tradeState: TradeState
): ViewState {
  // No focus → empty
  if (!focus) {
    return "empty";
  }

  // Symbol focus → symbol view (options chain)
  if (focus.kind === "symbol") {
    return "symbol";
  }

  // Trade focus → determine based on trade state
  if (focus.kind === "trade") {
    // Find the trade from currentTrade or activeTrades
    const trade =
      currentTrade?.id === focus.tradeId
        ? currentTrade
        : activeTrades.find((t) => t.id === focus.tradeId);

    if (!trade) {
      return "empty";
    }

    // Use trade.state as the source of truth
    const effectiveState = trade.state;

    switch (effectiveState) {
      case "WATCHING":
        // WATCHING = preview state (not yet persisted) - show planning view
        return "plan";
      case "LOADED":
        // LOADED = persisted but not entered - show trade setup ready to enter
        return "loaded";
      case "ENTERED":
        // ENTERED = active trade - show management view
        return "entered";
      case "EXITED":
        // EXITED = completed - show recap
        return "exited";
      default:
        return "symbol";
    }
  }

  return "empty";
}

// ============================================================================
// Alert Mode Derivation
// ============================================================================

/**
 * Derive the alert mode based on view state and trade state
 *
 * @param viewState - Current view state
 * @param trade - The focused trade
 */
export function deriveAlertMode(viewState: ViewState, trade: Trade | null): AlertMode {
  if (viewState === "entered") return "update";
  if (viewState === "exited") return "exit";
  if (viewState === "loaded") return "entry"; // LOADED state = ready to enter
  if (viewState === "plan") return "load"; // WATCHING/plan state = "Load and Alert"
  return "load";
}

// ============================================================================
// Combined Routing
// ============================================================================

export interface ViewRoutingResult {
  focus: FocusTarget;
  viewState: ViewState;
  alertMode: AlertMode;
}

/**
 * Get complete view routing result from all inputs
 *
 * This is the main function that combines all routing logic into a single call.
 * Use this when you need all routing information at once.
 *
 * @param currentTradeId - ID of focused trade
 * @param currentTrade - The focused trade object
 * @param activeTrades - All active trades
 * @param activeTicker - Currently selected ticker
 * @param tradeState - Current trade state from store
 */
export function getViewRouting(
  currentTradeId: string | null,
  currentTrade: Trade | null,
  activeTrades: Trade[],
  activeTicker: Ticker | null,
  tradeState: TradeState
): ViewRoutingResult {
  const focus = deriveFocus(currentTradeId, currentTrade, activeTicker);
  const viewState = deriveViewState(focus, currentTrade, activeTrades, tradeState);
  const alertMode = deriveAlertMode(viewState, currentTrade);

  return { focus, viewState, alertMode };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSymbolFocus(focus: FocusTarget): focus is { kind: "symbol"; symbol: string } {
  return focus !== null && focus.kind === "symbol";
}

export function isTradeFocus(focus: FocusTarget): focus is { kind: "trade"; tradeId: string } {
  return focus !== null && focus.kind === "trade";
}

/**
 * Check if the current state allows trade actions (trim, exit, etc.)
 */
export function canPerformTradeActions(viewState: ViewState): boolean {
  return viewState === "entered";
}

/**
 * Check if the current state allows loading a trade
 */
export function canLoadTrade(viewState: ViewState): boolean {
  return viewState === "symbol";
}

/**
 * Check if the current state allows entering a trade
 * - "plan" state (WATCHING) allows entering after load
 * - "loaded" state (LOADED) allows direct entry
 */
export function canEnterTrade(viewState: ViewState, tradeState: TradeState): boolean {
  return (viewState === "plan" || viewState === "loaded") && (tradeState === "WATCHING" || tradeState === "LOADED");
}
