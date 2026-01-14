/**
 * useAlertDraft - Hook for creating and managing AlertDrafts
 *
 * Provides a unified interface for creating, validating, and sending
 * trade alerts using the AlertDraft system. Ensures consistent behavior
 * across desktop and mobile.
 *
 * @module hooks/useAlertDraft
 */

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { Trade, DiscordChannel } from "../types";
import type { TradeActionIntent } from "../domain/tradeActions";
import {
  createAlertDraft,
  type AlertDraft,
  type CreateAlertDraftContext,
} from "../domain/alertDraft";
import {
  sendTradeAlertFromDraft,
  validateAlertDraftForSend,
  type SendAlertResult,
  type AlertValidationResult,
} from "../domain/alerts/commitAlertDraft";
import { useAuth } from "../contexts/AuthContext";
import { useDiscord } from "./useDiscord";
import { useSettingsStore } from "../stores/settingsStore";

// ============================================================================
// Types
// ============================================================================

export interface UseAlertDraftOptions {
  /** Initial intent for the draft */
  intent?: TradeActionIntent;
  /** Trade context */
  trade?: Trade | null;
  /** Current option price */
  currentPrice?: number;
  /** Current underlying price */
  underlyingPrice?: number;
}

export interface UseAlertDraftReturn {
  /** Current draft (null if not started) */
  draft: AlertDraft | null;
  /** Validation result */
  validation: AlertValidationResult;
  /** Whether the draft is valid and can be sent */
  isValid: boolean;
  /** Whether send is in progress */
  isSending: boolean;
  /** Create a new draft for an intent */
  createDraft: (context: CreateAlertDraftContext) => AlertDraft;
  /** Update draft prices */
  updatePrices: (prices: Partial<AlertDraft["editablePrices"]>) => void;
  /** Update draft channels */
  updateChannels: (channelIds: string[]) => void;
  /** Update draft challenges */
  updateChallenges: (challengeIds: string[]) => void;
  /** Update draft comment */
  updateComment: (comment: string) => void;
  /** Toggle send alert flag */
  toggleSendAlert: (sendAlert: boolean) => void;
  /** Validate current draft */
  validate: () => AlertValidationResult;
  /** Send the alert (validates first) */
  send: () => Promise<SendAlertResult>;
  /** Clear the draft */
  clear: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAlertDraft(options: UseAlertDraftOptions = {}): UseAlertDraftReturn {
  const { user } = useAuth();
  const discord = useDiscord();
  const discordChannels = useSettingsStore((s) => s.discordChannels);

  // State
  const [draft, setDraft] = useState<AlertDraft | null>(() => {
    if (options.intent && options.trade) {
      return createAlertDraft({
        intent: options.intent,
        trade: options.trade,
        currentPrice: options.currentPrice,
        underlyingPrice: options.underlyingPrice,
      });
    }
    return null;
  });
  const [isSending, setIsSending] = useState(false);

  // Validation
  const validation = useMemo<AlertValidationResult>(() => {
    if (!draft) {
      return { valid: false, errors: ["No draft created"] };
    }
    return validateAlertDraftForSend(draft);
  }, [draft]);

  const isValid = validation.valid;

  // Actions
  const createDraft = useCallback((context: CreateAlertDraftContext): AlertDraft => {
    // Get default channels
    const defaultChannelIds = discordChannels
      .filter((ch) => ch.isGlobalDefault || ch.isDefaultLoad || ch.isDefaultEnter)
      .map((ch) => ch.id);

    const newDraft = createAlertDraft({
      ...context,
      initialChannels: context.initialChannels || defaultChannelIds,
    });
    setDraft(newDraft);
    return newDraft;
  }, [discordChannels]);

  const updatePrices = useCallback((prices: Partial<AlertDraft["editablePrices"]>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        editablePrices: {
          ...prev.editablePrices,
          ...prices,
        },
      };
    });
  }, []);

  const updateChannels = useCallback((channelIds: string[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, channels: channelIds };
    });
  }, []);

  const updateChallenges = useCallback((challengeIds: string[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, challenges: challengeIds };
    });
  }, []);

  const updateComment = useCallback((comment: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, comment };
    });
  }, []);

  const toggleSendAlert = useCallback((sendAlert: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, sendAlert };
    });
  }, []);

  const validate = useCallback((): AlertValidationResult => {
    if (!draft) {
      return { valid: false, errors: ["No draft created"] };
    }
    return validateAlertDraftForSend(draft);
  }, [draft]);

  const send = useCallback(async (): Promise<SendAlertResult> => {
    if (!draft) {
      return { success: false, error: "No draft created" };
    }

    if (!user?.id) {
      toast.error("Authentication Required", {
        description: "Please sign in to send alerts",
      });
      return { success: false, error: "Not authenticated" };
    }

    // Validate first
    const validationResult = validateAlertDraftForSend(draft);
    if (!validationResult.valid) {
      toast.error("Validation Failed", {
        description: validationResult.errors[0],
      });
      return {
        success: false,
        validationErrors: validationResult.errors,
        error: validationResult.errors[0],
      };
    }

    setIsSending(true);
    try {
      const result = await sendTradeAlertFromDraft(draft, user.id, discord);

      if (result.success) {
        toast.success("Alert Sent", {
          description: `${draft.intent} alert processed successfully`,
        });
      } else {
        toast.error("Alert Failed", {
          description: result.error || "Unknown error",
        });
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      toast.error("Alert Failed", { description: error });
      return { success: false, error };
    } finally {
      setIsSending(false);
    }
  }, [draft, user?.id, discord]);

  const clear = useCallback(() => {
    setDraft(null);
  }, []);

  return {
    draft,
    validation,
    isValid,
    isSending,
    createDraft,
    updatePrices,
    updateChannels,
    updateChallenges,
    updateComment,
    toggleSendAlert,
    validate,
    send,
    clear,
  };
}

export default useAlertDraft;
