import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

// Detect if running in Node.js (server-side worker) or browser (Vite)
const isNode = typeof process !== "undefined" && process.versions?.node;

// Get environment variables from correct source
function getEnvVar(key: string): string | undefined {
  if (isNode) {
    // Node.js environment - use process.env
    return process.env[key];
  } else {
    // Browser/Vite environment - use import.meta.env
    return (import.meta as any).env?.[key];
  }
}

// Singleton pattern - create client once and reuse
let supabaseInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!supabaseInstance) {
    // Get credentials at runtime (after dotenv has loaded)
    const supabaseUrl = getEnvVar("VITE_SUPABASE_URL") || "";
    const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      const env = isNode ? "Node.js (process.env)" : "Browser (import.meta.env)";
      console.error(`[Supabase Client] Missing environment variables in ${env}:`, {
        VITE_SUPABASE_URL: supabaseUrl ? "✓ Present" : "✗ MISSING",
        VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? "✓ Present" : "✗ MISSING",
      });
      throw new Error(
        "Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      );
    }

    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseInstance;
}
