/**
 * Zod Schema Validation for Alert Drafts
 *
 * Provides runtime validation for AlertDraft and related types.
 * Ensures data integrity before committing alerts.
 *
 * @module domain/alerts/validation
 */

import { z } from "zod";
import type { TradeActionIntent } from "../tradeActions";

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * TradeActionIntent schema
 */
export const TradeActionIntentSchema = z.enum([
  "LOAD",
  "ENTER",
  "UPDATE_SL",
  "TRIM",
  "ADD",
  "TRAIL_STOP",
  "EXIT",
  "UNLOAD",
  "SHARE_EXIT",
]);

/**
 * AlertDraftEditablePrices schema
 */
export const AlertDraftEditablePricesSchema = z.object({
  entry: z.number().positive().optional(),
  current: z.number().positive().optional(),
  target: z.number().positive().optional(),
  stop: z.number().positive().optional(),
  targetUnderlying: z.number().positive().optional(),
  stopUnderlying: z.number().positive().optional(),
});

/**
 * AlertDraftFieldToggles schema
 */
export const AlertDraftFieldTogglesSchema = z.object({
  showEntry: z.boolean(),
  showCurrent: z.boolean(),
  showTarget: z.boolean(),
  showStop: z.boolean(),
  showPnL: z.boolean(),
  showRiskReward: z.boolean(),
  showDTE: z.boolean(),
  showGreeks: z.boolean(),
  showConfluence: z.boolean(),
  showUnderlying: z.boolean(),
  showSetupType: z.boolean(),
  showGainsImage: z.boolean(),
});

/**
 * AlertDraft schema (simplified - doesn't validate full Trade object)
 */
export const AlertDraftSchema = z.object({
  intent: TradeActionIntentSchema,
  trade: z
    .object({
      id: z.string(),
      ticker: z.string().min(1),
      state: z.enum(["WATCHING", "LOADED", "ENTERED", "EXITED"]),
      contract: z
        .object({
          mid: z.number().positive(),
          daysToExpiry: z.number().nonnegative(),
        })
        .passthrough(), // Allow other contract fields
    })
    .passthrough(), // Allow other trade fields
  editablePrices: AlertDraftEditablePricesSchema,
  fieldToggles: AlertDraftFieldTogglesSchema,
  channels: z.array(z.string()),
  challenges: z.array(z.string()),
  comment: z.string(),
  sendAlert: z.boolean(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate an AlertDraft
 *
 * @param draft - The draft to validate
 * @returns Validation result with parsed data or error
 */
export function validateAlertDraft(draft: unknown) {
  return AlertDraftSchema.safeParse(draft);
}

/**
 * Validate AlertDraft prices based on intent
 *
 * @param intent - The trade action intent
 * @param prices - The editable prices to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateAlertDraftPrices(
  intent: TradeActionIntent,
  prices: z.infer<typeof AlertDraftEditablePricesSchema>
): string[] {
  const errors: string[] = [];

  // Intent-specific price validation
  switch (intent) {
    case "LOAD":
    case "ENTER":
      if (!prices.target || prices.target <= 0) {
        errors.push("Target price is required and must be positive");
      }
      if (!prices.stop || prices.stop <= 0) {
        errors.push("Stop loss is required and must be positive");
      }
      if (intent === "ENTER" && (!prices.entry || prices.entry <= 0)) {
        errors.push("Entry price is required for ENTER action");
      }
      break;

    case "UPDATE_SL":
    case "TRAIL_STOP":
      if (!prices.stop || prices.stop <= 0) {
        errors.push("Stop loss price is required and must be positive");
      }
      break;

    case "TRIM":
    case "EXIT":
      if (!prices.current || prices.current <= 0) {
        errors.push("Current/exit price is required and must be positive");
      }
      break;

    case "ADD":
      if (!prices.current || prices.current <= 0) {
        errors.push("Current price is required for ADD action");
      }
      break;

    case "UNLOAD":
    case "SHARE_EXIT":
      // No price validation needed
      break;
  }

  return errors;
}

/**
 * Validate AlertDraft with full context validation
 *
 * @param draft - The draft to validate
 * @returns Validation result with detailed errors
 */
export function validateAlertDraftWithContext(draft: unknown): {
  success: boolean;
  errors: string[];
  data?: z.infer<typeof AlertDraftSchema>;
} {
  // First, validate schema
  const schemaValidation = validateAlertDraft(draft);

  if (!schemaValidation.success) {
    const errors = schemaValidation.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`
    );
    return { success: false, errors };
  }

  const validDraft = schemaValidation.data;
  const errors: string[] = [];

  // Validate prices for the specific intent
  const priceErrors = validateAlertDraftPrices(validDraft.intent, validDraft.editablePrices);
  errors.push(...priceErrors);

  // Validate channels if sendAlert is enabled
  if (validDraft.sendAlert && validDraft.channels.length === 0) {
    errors.push("At least one Discord channel required when sending alerts");
  }

  // Validate trade has ID for non-creation intents
  if (
    !validDraft.trade.id &&
    validDraft.intent !== "LOAD" &&
    validDraft.intent !== "ENTER" &&
    validDraft.intent !== "UNLOAD"
  ) {
    errors.push("Trade must have an ID for this action");
  }

  return {
    success: errors.length === 0,
    errors,
    data: validDraft,
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type AlertDraftSchemaType = z.infer<typeof AlertDraftSchema>;
export type AlertDraftEditablePricesSchemaType = z.infer<typeof AlertDraftEditablePricesSchema>;
export type AlertDraftFieldTogglesSchemaType = z.infer<typeof AlertDraftFieldTogglesSchema>;
