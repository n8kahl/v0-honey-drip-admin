/**
 * Alert Intent Mapping
 *
 * Unified mapping between UI alert types and domain TradeActionIntent.
 * Both mobile and desktop should use these functions to ensure
 * consistent behavior.
 *
 * @module domain/alerts/intentMapping
 */

import type { TradeActionIntent } from "../tradeActions";

// ============================================================================
// UI Alert Types
// ============================================================================

/**
 * Alert types as used by UI components (HDAlertComposer, MobileAlertSheet)
 */
export type UIAlertType =
  | "load"
  | "enter"
  | "trim"
  | "update"
  | "update-sl"
  | "trail-stop"
  | "add"
  | "exit";

/**
 * Update kind for "update" alert type
 */
export type UIUpdateKind = "trim" | "sl" | "trail" | "generic";

// ============================================================================
// Alert Type → Intent Mapping
// ============================================================================

/**
 * Convert UI alert type to domain TradeActionIntent
 *
 * This is the canonical mapping used by both mobile and desktop.
 * Handles the "update" type by looking at updateKind.
 *
 * @param alertType - UI alert type
 * @param updateKind - Optional update kind for "update" type
 * @returns TradeActionIntent
 */
export function alertTypeToIntent(
  alertType: UIAlertType,
  updateKind?: UIUpdateKind
): TradeActionIntent {
  switch (alertType) {
    case "load":
      return "LOAD";

    case "enter":
      return "ENTER";

    case "trim":
      return "TRIM";

    case "update":
      // "update" is ambiguous - use updateKind to determine intent
      if (updateKind === "trim") return "TRIM";
      if (updateKind === "trail") return "TRAIL_STOP";
      // Default to UPDATE_SL for "sl", "generic", or undefined
      return "UPDATE_SL";

    case "update-sl":
      return "UPDATE_SL";

    case "trail-stop":
      return "TRAIL_STOP";

    case "add":
      return "ADD";

    case "exit":
      return "EXIT";

    default: {
      // Exhaustive check - should never reach here
      const _exhaustive: never = alertType;
      console.warn(`[intentMapping] Unknown alert type: ${alertType}`);
      return "UPDATE_SL";
    }
  }
}

// ============================================================================
// Intent → Alert Type Mapping
// ============================================================================

/**
 * Convert domain TradeActionIntent to UI alert type
 *
 * Used when opening the alert composer for a specific intent.
 *
 * @param intent - TradeActionIntent
 * @returns UI alert type
 */
export function intentToAlertType(intent: TradeActionIntent): UIAlertType {
  switch (intent) {
    case "LOAD":
      return "load";
    case "ENTER":
      return "enter";
    case "TRIM":
      return "trim";
    case "UPDATE_SL":
      return "update-sl";
    case "TRAIL_STOP":
      return "trail-stop";
    case "ADD":
      return "add";
    case "EXIT":
    case "SHARE_EXIT":
      return "exit";
    case "UNLOAD":
      return "load"; // Unload reuses load composer
    default:
      return "update";
  }
}

/**
 * Convert domain TradeActionIntent to update kind
 *
 * Used when opening the alert composer in "update" mode.
 *
 * @param intent - TradeActionIntent
 * @returns Update kind or undefined
 */
export function intentToUpdateKind(intent: TradeActionIntent): UIUpdateKind | undefined {
  switch (intent) {
    case "TRIM":
      return "trim";
    case "UPDATE_SL":
      return "sl";
    case "TRAIL_STOP":
      return "trail";
    default:
      return undefined;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if an alert type is valid
 */
export function isValidAlertType(type: string): type is UIAlertType {
  return ["load", "enter", "trim", "update", "update-sl", "trail-stop", "add", "exit"].includes(
    type
  );
}

/**
 * Check if an update kind is valid
 */
export function isValidUpdateKind(kind: string): kind is UIUpdateKind {
  return ["trim", "sl", "trail", "generic"].includes(kind);
}

// ============================================================================
// Display Labels
// ============================================================================

/**
 * Get human-readable label for an intent
 */
export function getIntentLabel(intent: TradeActionIntent): string {
  switch (intent) {
    case "LOAD":
      return "Load Setup";
    case "ENTER":
      return "Enter Position";
    case "TRIM":
      return "Trim Position";
    case "UPDATE_SL":
      return "Update Stop Loss";
    case "TRAIL_STOP":
      return "Trail Stop";
    case "ADD":
      return "Add to Position";
    case "EXIT":
      return "Exit Position";
    case "SHARE_EXIT":
      return "Share Exit";
    case "UNLOAD":
      return "Remove Setup";
    default:
      return "Update";
  }
}

/**
 * Get human-readable label for an alert type
 */
export function getAlertTypeLabel(alertType: UIAlertType): string {
  switch (alertType) {
    case "load":
      return "Load";
    case "enter":
      return "Enter";
    case "trim":
      return "Trim";
    case "update":
      return "Update";
    case "update-sl":
      return "Update SL";
    case "trail-stop":
      return "Trail Stop";
    case "add":
      return "Add";
    case "exit":
      return "Exit";
    default:
      return "Update";
  }
}
