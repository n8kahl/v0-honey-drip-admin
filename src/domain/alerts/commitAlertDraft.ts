/**
 * Alert Draft Commit Pipeline
 *
 * Unified commit layer for alert drafts. Wraps commitTradeAction with:
 * 1. Discord channel resolution
 * 2. Alert sending orchestration
 * 3. Simplified error handling
 *
 * Both HDAlertComposer (desktop) and MobileApp should use this module
 * to ensure consistent alert commit behavior.
 *
 * @module domain/alerts/commitAlertDraft
 */

import type { Trade } from "../../types";
import type { AlertDraft } from "../alertDraft";
import { commitTradeAction, type CommitResult } from "../tradeActions";
import { useSettingsStore } from "../../stores/settingsStore";
import { validateAlertDraftWithContext } from "./validation";
import { toast } from "sonner";
import { logDiscordFailure } from "../../lib/discord/failureLogger";

// ============================================================================
// Types
// ============================================================================

/**
 * Discord service interface (same as commitTradeAction expects)
 */
export interface DiscordAlertService {
  sendLoadAlert: (
    channels: any[],
    trade: Trade,
    comment?: string,
    priceOverrides?: any
  ) => Promise<any>;
  sendEntryAlert: (
    channels: any[],
    trade: Trade,
    comment?: string,
    priceOverrides?: any
  ) => Promise<any>;
  sendUpdateAlert: (
    channels: any[],
    trade: Trade,
    updateKind: string,
    message?: string
  ) => Promise<any>;
  sendTrailingStopAlert: (channels: any[], trade: Trade) => Promise<any>;
  sendExitAlert: (
    channels: any[],
    trade: Trade,
    comment?: string,
    imageUrl?: string
  ) => Promise<any>;
}

/**
 * Simplified commit result for UI consumption
 */
export interface AlertCommitResult {
  success: boolean;
  error?: string;
  trade?: Trade;
}

// ============================================================================
// Commit Alert Draft
// ============================================================================

/**
 * Commit an AlertDraft - unified pipeline for desktop and mobile
 *
 * This function:
 * 1. Resolves Discord channel IDs to channel objects
 * 2. Calls commitTradeAction for DB persistence
 * 3. Sends Discord alerts if enabled
 * 4. Returns simplified result
 *
 * @param draft - The completed AlertDraft from the composer
 * @param userId - Authenticated user ID
 * @param discord - Discord service instance (optional)
 * @returns Simplified commit result
 */
export async function commitAlertDraft(
  draft: AlertDraft,
  userId: string,
  discord?: DiscordAlertService
): Promise<AlertCommitResult> {
  try {
    // Validate alert draft with zod schema
    const validation = validateAlertDraftWithContext(draft);
    if (!validation.success) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // Resolve channel IDs to channel objects (needed for Discord alerts)
    const discordChannels = useSettingsStore.getState().discordChannels;
    const resolvedChannels = draft.channels
      .map((id) => discordChannels.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    // Call core commit function
    const coreResult: CommitResult = await commitTradeAction(draft, userId, discord);

    // Handle Discord alerts if enabled
    if (draft.sendAlert && discord && resolvedChannels.length > 0 && coreResult.trade) {
      try {
        const priceOverrides = {
          entryPrice: draft.editablePrices.entry,
          currentPrice: draft.editablePrices.current,
          targetPrice: draft.editablePrices.target,
          stopLoss: draft.editablePrices.stop,
        };

        const tradeCopy = coreResult.trade;
        let results: { success: number; failed: number } | undefined;
        const alertType = draft.intent.toLowerCase().replace("_", "-");

        // Send appropriate Discord alert based on intent
        switch (draft.intent) {
          case "LOAD":
            results = await discord.sendLoadAlert(
              resolvedChannels,
              tradeCopy,
              draft.comment,
              priceOverrides
            );
            break;

          case "ENTER":
            results = await discord.sendEntryAlert(
              resolvedChannels,
              tradeCopy,
              draft.comment,
              priceOverrides
            );
            break;

          case "UPDATE_SL":
            results = await discord.sendUpdateAlert(
              resolvedChannels,
              tradeCopy,
              "update-sl",
              draft.comment
            );
            break;

          case "TRIM":
            results = await discord.sendUpdateAlert(
              resolvedChannels,
              tradeCopy,
              "trim",
              draft.comment
            );
            break;

          case "ADD":
            results = await discord.sendUpdateAlert(
              resolvedChannels,
              tradeCopy,
              "add",
              draft.comment
            );
            break;

          case "TRAIL_STOP":
            results = await discord.sendTrailingStopAlert(resolvedChannels, tradeCopy);
            break;

          case "EXIT":
          case "SHARE_EXIT":
            results = await discord.sendExitAlert(resolvedChannels, tradeCopy, draft.comment);
            break;

          case "UNLOAD":
            // No alert for unload
            break;
        }

        // Handle failures: log to database and notify user
        if (results && results.failed > 0) {
          console.warn(`[commitAlertDraft] ${results.failed} Discord alert(s) failed`);

          // Log each failed channel to database for audit
          const failedChannels = resolvedChannels.slice(results.success);
          for (const channel of failedChannels) {
            await logDiscordFailure({
              userId,
              tradeId: tradeCopy.id,
              alertType,
              webhookUrl: channel.webhookUrl,
              channelName: channel.name,
              payload: { content: draft.comment || "Alert", trade: tradeCopy },
              errorMessage: "Discord not responding or timeout after 30 seconds",
            });
          }

          // Show toast notification with manual retry option
          toast.error("Discord alert failed", {
            description: `Failed to send ${alertType} alert to ${results.failed} channel(s). Check Settings > Discord to retry.`,
            duration: 10000, // 10 seconds
          });
        } else if (results && results.success > 0) {
          // Success toast for confirmation
          toast.success("Discord alert sent", {
            description: `Alert sent to ${results.success} channel(s)`,
            duration: 4000,
          });
        }
      } catch (discordError) {
        console.warn("[commitAlertDraft] Discord alert exception:", discordError);

        // Log the exception as a failure
        const errorMessage = discordError instanceof Error ? discordError.message : "Unknown error";
        for (const channel of resolvedChannels) {
          await logDiscordFailure({
            userId,
            tradeId: coreResult.trade?.id,
            alertType: draft.intent.toLowerCase().replace("_", "-"),
            webhookUrl: channel.webhookUrl,
            channelName: channel.name,
            payload: { content: draft.comment || "Alert" },
            errorMessage,
          });
        }

        // Show error toast
        toast.error("Discord alert failed", {
          description: "Discord not responding. Check Settings > Discord to retry.",
          duration: 10000,
        });
      }
    }

    // Return simplified result
    return {
      success: coreResult.success,
      error: coreResult.error,
      trade: coreResult.trade,
    };
  } catch (error) {
    console.error("[commitAlertDraft] Commit failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate an AlertDraft before committing
 *
 * @param draft - The draft to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateAlertDraft(draft: AlertDraft): string[] {
  const errors: string[] = [];

  // Validate trade has required data
  if (!draft.trade.id && draft.intent !== "LOAD" && draft.intent !== "ENTER") {
    errors.push("Trade must have an ID for this action");
  }

  if (!draft.trade.contract) {
    errors.push("Trade must have a contract");
  }

  // Validate prices for intents that require them
  if (draft.intent === "LOAD" || draft.intent === "ENTER") {
    if (!draft.editablePrices.target || draft.editablePrices.target <= 0) {
      errors.push("Target price is required and must be positive");
    }
    if (!draft.editablePrices.stop || draft.editablePrices.stop <= 0) {
      errors.push("Stop loss is required and must be positive");
    }
  }

  if (draft.intent === "ENTER" && !draft.editablePrices.entry) {
    errors.push("Entry price is required for ENTER action");
  }

  if (draft.intent === "UPDATE_SL" && !draft.editablePrices.stop) {
    errors.push("Stop loss price is required for UPDATE_SL action");
  }

  if (draft.intent === "EXIT" && !draft.editablePrices.current) {
    errors.push("Exit price is required for EXIT action");
  }

  // Validate channels if sendAlert is enabled
  if (draft.sendAlert && draft.channels.length === 0) {
    errors.push("At least one Discord channel required when sending alerts");
  }

  return errors;
}
