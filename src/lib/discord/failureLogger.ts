/**
 * Discord Alert Failure Logger
 *
 * Logs failed Discord webhook deliveries to database for audit and manual retry
 */

import { supabase } from "../supabase/client";

export interface LogFailureParams {
  userId: string;
  tradeId?: string;
  alertType: string;
  webhookUrl: string;
  channelName?: string;
  payload: any; // Discord message payload
  errorMessage: string;
  httpStatus?: number;
}

export interface DiscordFailure {
  id: string;
  user_id: string;
  trade_id?: string;
  alert_type: string;
  webhook_url: string;
  channel_name?: string;
  payload: any;
  error_message?: string;
  http_status?: number;
  failed_at: string;
  retried_at?: string;
  succeeded_at?: string;
  user_notified: boolean;
}

/**
 * Log a failed Discord alert to database
 */
export async function logDiscordFailure(
  params: LogFailureParams
): Promise<{ success: boolean; failureId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("discord_alert_failures")
      .insert({
        user_id: params.userId,
        trade_id: params.tradeId,
        alert_type: params.alertType,
        webhook_url: params.webhookUrl,
        channel_name: params.channelName,
        payload: params.payload,
        error_message: params.errorMessage,
        http_status: params.httpStatus,
        user_notified: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[FailureLogger] Failed to log Discord failure:", error);
      return { success: false, error: error.message };
    }

    console.log("[FailureLogger] Logged Discord failure:", data.id);
    return { success: true, failureId: data.id };
  } catch (error: any) {
    console.error("[FailureLogger] Exception logging Discord failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's pending failed alerts (not yet successfully retried)
 */
export async function getPendingFailures(userId: string): Promise<DiscordFailure[]> {
  try {
    const { data, error } = await supabase
      .from("discord_alert_failures")
      .select("*")
      .eq("user_id", userId)
      .is("succeeded_at", null)
      .order("failed_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[FailureLogger] Failed to fetch pending failures:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[FailureLogger] Exception fetching pending failures:", error);
    return [];
  }
}

/**
 * Manually retry a failed alert
 */
export async function retryFailedAlert(
  failureId: string,
  webhookUrl: string,
  payload: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Send to backend proxy
    const response = await fetch("/api/discord/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl, message: payload }),
    });

    const result = await response.json();

    if (result.success) {
      // Mark as succeeded in database
      await supabase
        .from("discord_alert_failures")
        .update({
          retried_at: new Date().toISOString(),
          succeeded_at: new Date().toISOString(),
        })
        .eq("id", failureId);

      return { success: true };
    } else {
      // Update retry timestamp (but not succeeded)
      await supabase
        .from("discord_alert_failures")
        .update({
          retried_at: new Date().toISOString(),
          error_message: result.error || "Retry failed",
        })
        .eq("id", failureId);

      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error("[FailureLogger] Retry exception:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark failure as user notified (toast shown)
 */
export async function markFailureNotified(failureId: string): Promise<void> {
  try {
    await supabase
      .from("discord_alert_failures")
      .update({ user_notified: true })
      .eq("id", failureId);
  } catch (error) {
    console.error("[FailureLogger] Failed to mark as notified:", error);
  }
}

/**
 * Delete a failed alert record
 */
export async function deleteFailure(
  failureId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("discord_alert_failures")
      .delete()
      .eq("id", failureId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
