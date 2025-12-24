/**
 * Alert Draft Domain Logic
 *
 * Shared defaults for alert composition across desktop and mobile.
 * Ensures consistent field visibility, editable prices, and default values
 * regardless of which UI surface is used.
 *
 * @module domain/alertDraft
 */

import type { Trade, TradeState } from "../types";
import type { TradeActionIntent } from "./tradeActions";

// ============================================================================
// Types
// ============================================================================

/**
 * Field toggle configuration - which fields to show in alert composer
 */
export interface AlertDraftFieldToggles {
  showEntry: boolean;
  showCurrent: boolean;
  showTarget: boolean;
  showStop: boolean;
  showPnL: boolean;
  showRiskReward: boolean;
  showDTE: boolean;
  showGreeks: boolean;
  showConfluence: boolean;
  showUnderlying: boolean;
  showSetupType: boolean;
  showGainsImage: boolean; // Only for EXIT
}

/**
 * Editable price fields in the alert composer
 */
export interface AlertDraftEditablePrices {
  entry?: number;
  current?: number;
  target?: number;
  stop?: number;
  targetUnderlying?: number;
  stopUnderlying?: number;
}

/**
 * Complete alert draft - everything needed to compose and send an alert
 */
export interface AlertDraft {
  // Action context
  intent: TradeActionIntent;
  trade: Trade;

  // Editable fields
  editablePrices: AlertDraftEditablePrices;

  // Display configuration
  fieldToggles: AlertDraftFieldToggles;

  // Alert destinations
  channels: string[];
  challenges: string[];

  // Message
  comment: string;

  // Whether to actually send the Discord alert
  sendAlert: boolean;

  // Trim percent for partial exits (if applicable)
  trimPercent?: number;
}

/**
 * Context for creating an alert draft
 */
export interface CreateAlertDraftContext {
  intent: TradeActionIntent;
  trade: Trade;
  currentPrice?: number; // Current option price
  underlyingPrice?: number; // Current underlying price
  initialChannels?: string[];
  initialChallenges?: string[];
  trimPercent?: number;
}

// ============================================================================
// Default Field Toggles by Intent
// ============================================================================

/**
 * Get default field toggles for a given intent
 *
 * These defaults ensure consistent UX across desktop and mobile.
 * They define which fields are shown by default in the alert composer.
 */
export function getDefaultFieldToggles(intent: TradeActionIntent): AlertDraftFieldToggles {
  // Base defaults - most fields hidden
  const base: AlertDraftFieldToggles = {
    showEntry: false,
    showCurrent: false,
    showTarget: false,
    showStop: false,
    showPnL: false,
    showRiskReward: false,
    showDTE: true, // DTE almost always relevant
    showGreeks: false,
    showConfluence: false,
    showUnderlying: false,
    showSetupType: false,
    showGainsImage: false,
  };

  switch (intent) {
    case "LOAD":
      // Load alert: Show key info for evaluating the setup
      return {
        ...base,
        showCurrent: true, // Current option price
        showTarget: true, // Where we expect to exit
        showStop: true, // Risk management
        showRiskReward: true, // R:R ratio
        showDTE: true, // Time context
        showGreeks: true, // Delta, IV, etc.
        showUnderlying: true, // Underlying price context
        showSetupType: true, // What kind of setup
      };

    case "ENTER":
      // Enter alert: Show entry details and risk parameters
      return {
        ...base,
        showEntry: true, // Entry price (editable)
        showCurrent: true, // Current option price
        showTarget: true, // Target price
        showStop: true, // Stop loss
        showRiskReward: true, // R:R ratio
        showDTE: true, // Time context
        showGreeks: true, // Greeks for position sizing
        showUnderlying: true, // Underlying context
        showSetupType: true, // Setup type
      };

    case "UPDATE_SL":
      // Stop loss update: Focus on stop and current P&L context
      return {
        ...base,
        showCurrent: false,
        showStop: true, // The main field being updated
        showPnL: true, // Context for why SL is moving
        showDTE: true, // Time remaining
      };

    case "TRIM":
      // Trim alert: Show current price and P&L
      return {
        ...base,
        showCurrent: true, // Current exit price
        showPnL: true, // Realized/unrealized P&L
        showDTE: true, // Time context
      };

    case "ADD":
      // Add to position: Show current price and context
      return {
        ...base,
        showCurrent: true, // Where we're adding
        showPnL: true, // Current position P&L
        showDTE: true, // Time context
      };

    case "TRAIL_STOP":
      // Trailing stop: Focus on stop level
      return {
        ...base,
        showStop: true, // The trailing stop level
        showPnL: true, // Current P&L context
        showDTE: true, // Time context
      };

    case "EXIT":
      // Exit alert: Show final P&L and optional gains image
      return {
        ...base,
        showEntry: true, // Where we entered
        showCurrent: true, // Exit price
        showPnL: true, // Final P&L
        showDTE: true, // How much time was left
        showGainsImage: false, // Optional, user can enable
      };

    case "SHARE_EXIT":
      // Share recap: Same as exit but for already exited trades
      return {
        ...base,
        showEntry: true,
        showCurrent: true, // Was exit price
        showPnL: true,
        showDTE: true,
        showGainsImage: true, // More likely to want image for sharing
      };

    case "UNLOAD":
      // Unload: Minimal - just confirmation
      return base;

    default:
      return base;
  }
}

// ============================================================================
// Default Editable Prices
// ============================================================================

/**
 * Get DTE-aware price multipliers
 *
 * DTE-aware multipliers (aligned with mobile implementation):
 * - Scalp (≤1 DTE): 1.3x TP / 0.7x SL
 * - Day (≤7 DTE): 1.5x TP / 0.5x SL
 * - Swing/LEAP (>7 DTE): 2.0x TP / 0.3x SL
 */
function getDTEAwareMultipliers(daysToExpiry: number): {
  tpMultiplier: number;
  slMultiplier: number;
} {
  if (daysToExpiry <= 1) {
    return { tpMultiplier: 1.3, slMultiplier: 0.7 };
  } else if (daysToExpiry <= 7) {
    return { tpMultiplier: 1.5, slMultiplier: 0.5 };
  } else {
    return { tpMultiplier: 2.0, slMultiplier: 0.3 };
  }
}

/**
 * Get default editable prices for a given intent and trade
 */
export function getDefaultEditablePrices(
  intent: TradeActionIntent,
  trade: Trade,
  currentPrice?: number,
  underlyingPrice?: number
): AlertDraftEditablePrices {
  const contractMid = trade.contract?.mid;
  const effectiveCurrent = currentPrice || trade.currentPrice || contractMid || 0;

  // Calculate DTE-aware multipliers
  const daysToExpiry = trade.contract?.daysToExpiry ?? 0;
  const { tpMultiplier, slMultiplier } = getDTEAwareMultipliers(daysToExpiry);

  switch (intent) {
    case "LOAD":
      return {
        current: effectiveCurrent,
        target: trade.targetPrice || effectiveCurrent * tpMultiplier,
        stop: trade.stopLoss || effectiveCurrent * slMultiplier,
        targetUnderlying: trade.targetUnderlyingPrice,
        stopUnderlying: trade.stopUnderlyingPrice,
      };

    case "ENTER":
      return {
        entry: trade.entryPrice || effectiveCurrent,
        current: effectiveCurrent,
        target: trade.targetPrice || effectiveCurrent * tpMultiplier,
        stop: trade.stopLoss || effectiveCurrent * slMultiplier,
        targetUnderlying: trade.targetUnderlyingPrice,
        stopUnderlying: trade.stopUnderlyingPrice,
      };

    case "UPDATE_SL":
      return {
        stop: trade.stopLoss || effectiveCurrent * slMultiplier,
      };

    case "TRIM":
      return {
        current: effectiveCurrent,
      };

    case "ADD":
      return {
        current: effectiveCurrent,
      };

    case "TRAIL_STOP":
      return {
        stop: trade.stopLoss || trade.entryPrice || effectiveCurrent,
      };

    case "EXIT":
      return {
        entry: trade.entryPrice,
        current: effectiveCurrent,
      };

    case "SHARE_EXIT":
      return {
        entry: trade.entryPrice,
        current: trade.exitPrice || effectiveCurrent,
      };

    case "UNLOAD":
      return {};

    default:
      return {};
  }
}

// ============================================================================
// Default Comment
// ============================================================================

/**
 * Get default comment text for an intent
 */
export function getDefaultComment(intent: TradeActionIntent): string {
  switch (intent) {
    case "LOAD":
      return "";
    case "ENTER":
      return "";
    case "UPDATE_SL":
      return "Stop loss adjusted";
    case "TRIM":
      return "Taking partial profits";
    case "ADD":
      return "Adding to position";
    case "TRAIL_STOP":
      return "Activating trailing stop";
    case "EXIT":
      return "";
    case "SHARE_EXIT":
      return "";
    case "UNLOAD":
      return "";
    default:
      return "";
  }
}

// ============================================================================
// Create Alert Draft
// ============================================================================

/**
 * Create an AlertDraft with appropriate defaults for the given intent
 *
 * This is the canonical way to create a draft for the alert composer.
 * Both desktop and mobile should use this function to ensure consistent defaults.
 *
 * @param context - The context including intent, trade, and optional prices
 * @returns AlertDraft ready for display in the composer
 */
export function createAlertDraft(context: CreateAlertDraftContext): AlertDraft {
  const {
    intent,
    trade,
    currentPrice,
    underlyingPrice,
    initialChannels,
    initialChallenges,
    trimPercent,
  } = context;
  const defaultTrimPercent = intent === "TRIM" ? 50 : undefined;

  return {
    intent,
    trade,
    editablePrices: getDefaultEditablePrices(intent, trade, currentPrice, underlyingPrice),
    fieldToggles: getDefaultFieldToggles(intent),
    channels: initialChannels || trade.discordChannels || [],
    challenges: initialChallenges || trade.challenges || [],
    comment: getDefaultComment(intent),
    sendAlert: true, // Default to sending alert
    trimPercent: trimPercent ?? defaultTrimPercent,
  };
}

// ============================================================================
// Price Validation
// ============================================================================

/**
 * Validate editable prices for an intent
 *
 * @returns Array of validation error messages (empty if valid)
 */
export function validatePrices(
  intent: TradeActionIntent,
  prices: AlertDraftEditablePrices,
  trade: Trade
): string[] {
  const errors: string[] = [];

  // All prices should be positive if set
  if (prices.entry !== undefined && prices.entry <= 0) {
    errors.push("Entry price must be positive");
  }
  if (prices.current !== undefined && prices.current <= 0) {
    errors.push("Current price must be positive");
  }
  if (prices.target !== undefined && prices.target <= 0) {
    errors.push("Target price must be positive");
  }
  if (prices.stop !== undefined && prices.stop <= 0) {
    errors.push("Stop loss must be positive");
  }

  // Intent-specific validation
  if (intent === "ENTER" || intent === "LOAD") {
    // Stop should be below entry for calls, above for puts
    const isCall = trade.contract?.type === "C";
    const entry = prices.entry || prices.current || 0;
    const stop = prices.stop || 0;
    const target = prices.target || 0;

    if (isCall && stop > entry) {
      errors.push("Stop loss should be below entry for calls");
    }
    if (!isCall && stop < entry) {
      errors.push("Stop loss should be above entry for puts");
    }

    if (isCall && target < entry) {
      errors.push("Target should be above entry for calls");
    }
    if (!isCall && target > entry) {
      errors.push("Target should be below entry for puts");
    }
  }

  return errors;
}

// ============================================================================
// Draft Helpers
// ============================================================================

/**
 * Update a price in the draft (immutable)
 */
export function updateDraftPrice(
  draft: AlertDraft,
  field: keyof AlertDraftEditablePrices,
  value: number
): AlertDraft {
  return {
    ...draft,
    editablePrices: {
      ...draft.editablePrices,
      [field]: value,
    },
  };
}

/**
 * Update a field toggle in the draft (immutable)
 */
export function updateDraftToggle(
  draft: AlertDraft,
  field: keyof AlertDraftFieldToggles,
  value: boolean
): AlertDraft {
  return {
    ...draft,
    fieldToggles: {
      ...draft.fieldToggles,
      [field]: value,
    },
  };
}

/**
 * Update channels in the draft (immutable)
 */
export function updateDraftChannels(draft: AlertDraft, channels: string[]): AlertDraft {
  return {
    ...draft,
    channels,
  };
}

/**
 * Update challenges in the draft (immutable)
 */
export function updateDraftChallenges(draft: AlertDraft, challenges: string[]): AlertDraft {
  return {
    ...draft,
    challenges,
  };
}

/**
 * Update comment in the draft (immutable)
 */
export function updateDraftComment(draft: AlertDraft, comment: string): AlertDraft {
  return {
    ...draft,
    comment,
  };
}

/**
 * Toggle sendAlert in the draft (immutable)
 */
export function updateDraftSendAlert(draft: AlertDraft, sendAlert: boolean): AlertDraft {
  return {
    ...draft,
    sendAlert,
  };
}
