export type DiscordAlertPayload = {
  content: string;
  embeds?: Array<Record<string, any>>;
  username?: string;
  avatar_url?: string;
};

interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function sendToWebhook(
  webhookUrl: string,
  payload: DiscordAlertPayload
): Promise<SendResult> {
  try {
    console.log("[Discord] Sending to webhook...");

    // 30-second timeout for Discord requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Discord returns 204 on success
    if (response.status === 204 || response.status === 200) {
      console.log("[Discord] Message sent successfully");
      return { ok: true, status: response.status };
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

      const retryResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: retryController.signal,
      });

      clearTimeout(retryTimeoutId);

      if (retryResponse.status === 204 || retryResponse.status === 200) {
        console.log("[Discord] Retry successful");
        return { ok: true, status: retryResponse.status };
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
