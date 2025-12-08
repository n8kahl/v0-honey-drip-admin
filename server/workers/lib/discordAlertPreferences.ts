import { createClient } from "@supabase/supabase-js";

export type AlertType = "setup" | "ready" | "signal" | "error" | "heartbeat";

export type AlertPreference = {
  alert_type: AlertType;
  enabled: boolean;
  webhook_urls: string[] | null;
};

type PrefMap = Record<AlertType, AlertPreference>;

const cache: Record<string, { prefs: PrefMap; ts: number }> = {};
const CACHE_TTL_MS = 60_000;

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials missing for Discord alert preferences");
  }
  return createClient(url, key);
}

function buildDefaultPrefs(): PrefMap {
  return {
    setup: { alert_type: "setup", enabled: true, webhook_urls: null },
    ready: { alert_type: "ready", enabled: true, webhook_urls: null },
    signal: { alert_type: "signal", enabled: true, webhook_urls: null },
    error: { alert_type: "error", enabled: true, webhook_urls: null },
    heartbeat: { alert_type: "heartbeat", enabled: true, webhook_urls: null },
  };
}

export async function getAlertPreferencesForUser(userId: string): Promise<PrefMap> {
  const cacheKey = userId || "global";
  const now = Date.now();
  const cached = cache[cacheKey];
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.prefs;
  }

  const prefs = buildDefaultPrefs();

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("discord_alert_preferences")
      .select("alert_type, enabled, webhook_urls")
      .or(`user_id.eq.${userId},user_id.is.null`);

    if (error) {
      console.warn("[DiscordPrefs] Could not load preferences (using defaults):", error.message);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        const type = row.alert_type as AlertType;
        if (type && prefs[type]) {
          prefs[type] = {
            alert_type: type,
            enabled: row.enabled ?? true,
            webhook_urls: Array.isArray(row.webhook_urls) ? row.webhook_urls : null,
          };
        }
      }
    }
  } catch (err: any) {
    if (err?.message?.includes("discord_alert_preferences")) {
      console.warn("[DiscordPrefs] preferences table not found; using defaults");
    } else {
      console.warn(
        "[DiscordPrefs] error loading preferences; using defaults:",
        err?.message || err
      );
    }
  }

  cache[cacheKey] = { prefs, ts: now };
  return prefs;
}

export function pickWebhooks(
  alertType: AlertType,
  prefs: PrefMap,
  fallback: string[]
): { enabled: boolean; webhooks: string[] } {
  const pref = prefs[alertType] || prefs.signal;
  if (!pref?.enabled) {
    return { enabled: false, webhooks: [] };
  }
  const targets =
    Array.isArray(pref?.webhook_urls) && pref.webhook_urls.length > 0
      ? pref.webhook_urls
      : fallback;
  return { enabled: true, webhooks: targets };
}
