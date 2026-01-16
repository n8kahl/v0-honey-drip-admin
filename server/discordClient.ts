export type DiscordAlertPayload = {
  content: string;
  embeds?: Array<Record<string, any>>;
  username?: string;
  avatar_url?: string;
};

export interface SendResult {
  ok: boolean;
  status: number;
  messageId?: string;
  timestamp?: string;
  error?: string;
}

// Test mode counter for deterministic message IDs
let testModeCounter = 0;

/**
 * Check if Discord test mode is enabled
 * In test mode, returns deterministic responses without calling Discord
 */
function isTestMode(): boolean {
  return process.env.DISCORD_TEST_MODE === "1";
}

/**
 * Generate a deterministic test response
 */
function getTestModeResponse(): SendResult {
  testModeCounter++;
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    status: 200,
    messageId: `test-msg-${testModeCounter.toString().padStart(6, "0")}`,
    timestamp,
  };
}

/**
 * Parse message ID and timestamp from Discord webhook response
 * When using ?wait=true, Discord returns the created message object
 */
function parseDiscordResponse(data: any): { messageId?: string; timestamp?: string } {
  if (data && typeof data === "object") {
    return {
      messageId: data.id || undefined,
      timestamp: data.timestamp || new Date().toISOString(),
    };
  }
  return { timestamp: new Date().toISOString() };
}

/**
 * Append ?wait=true to webhook URL to get message response
 */
function appendWaitParam(webhookUrl: string): string {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");
  return url.toString();
}

export async function sendToWebhook(
  webhookUrl: string,
  payload: DiscordAlertPayload
): Promise<SendResult> {
  // Test mode: return deterministic response without calling Discord
  if (isTestMode()) {
    console.log("[Discord] TEST MODE - returning deterministic response");
    return getTestModeResponse();
  }

  try {
    console.log("[Discord] Sending to webhook...");

    // Add ?wait=true to get message ID in response
    const urlWithWait = appendWaitParam(webhookUrl);

    // 30-second timeout for Discord requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(urlWithWait, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // With ?wait=true, Discord returns 200 with message JSON on success
    if (response.status === 200) {
      const data = await response.json();
      const { messageId, timestamp } = parseDiscordResponse(data);
      console.log("[Discord] Message sent successfully, messageId:", messageId);
      return { ok: true, status: response.status, messageId, timestamp };
    }

    // Fallback for 204 (shouldn't happen with ?wait=true but handle anyway)
    if (response.status === 204) {
      console.log("[Discord] Message sent successfully (no response body)");
      return { ok: true, status: response.status, timestamp: new Date().toISOString() };
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      const data: any = await response.json();
      const retryAfter = data.retry_after || 1;
      console.log(`[Discord] Rate limited, retrying after ${retryAfter}s...`);

      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

      // Retry once with 30s timeout
      const retryController = new AbortController();
      const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);

      const retryResponse = await fetch(urlWithWait, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: retryController.signal,
      });

      clearTimeout(retryTimeoutId);

      if (retryResponse.status === 200) {
        const retryData = await retryResponse.json();
        const { messageId, timestamp } = parseDiscordResponse(retryData);
        console.log("[Discord] Retry successful, messageId:", messageId);
        return { ok: true, status: retryResponse.status, messageId, timestamp };
      }

      if (retryResponse.status === 204) {
        console.log("[Discord] Retry successful (no response body)");
        return { ok: true, status: retryResponse.status, timestamp: new Date().toISOString() };
      }

      const retryError = await retryResponse.text();
      console.error("[Discord] Retry failed:", retryError);
      return { ok: false, status: retryResponse.status, error: retryError };
    }

    // Other errors
    const errorText = await response.text();
    console.error("[Discord] Send failed:", response.status, errorText);
    return { ok: false, status: response.status, error: errorText };
  } catch (error: any) {
    // Handle timeout specifically
    if (error.name === "AbortError") {
      console.error("[Discord] Request timeout after 30 seconds");
      return { ok: false, status: 0, error: "Discord request timeout after 30 seconds" };
    }
    console.error("[Discord] Request error:", error.message);
    return { ok: false, status: 0, error: error.message };
  }
}

/**
 * Reset test mode counter (useful for testing)
 */
export function resetTestModeCounter(): void {
  testModeCounter = 0;
}

// Optional: Supabase integration for webhook storage
export async function getWebhooksForChannels(
  adminId: string,
  channelIds: string[]
): Promise<string[]> {
  // TODO: Implement Supabase lookup if needed
  // For now, return empty array - webhooks should be passed from client
  console.warn("[Discord] Supabase webhook lookup not implemented");
  return [];
}
