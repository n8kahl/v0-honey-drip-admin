import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Immediate check when module loads
const ENV_CHECK = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  MODE: import.meta.env.MODE,
  ALL_KEYS: Object.keys(import.meta.env),
};

console.log('[v0] 🔍 Supabase client module loading - IMMEDIATE CHECK');
console.log('[v0] 📋 All import.meta.env keys:', ENV_CHECK.ALL_KEYS);
console.log('[v0] 🔑 VITE_SUPABASE_URL:', ENV_CHECK.VITE_SUPABASE_URL || '❌ UNDEFINED');
console.log('[v0] 🔑 VITE_SUPABASE_ANON_KEY:', ENV_CHECK.VITE_SUPABASE_ANON_KEY ? '✅ Present (length: ' + ENV_CHECK.VITE_SUPABASE_ANON_KEY.length + ')' : '❌ UNDEFINED');
console.log('[v0] 🔑 MODE:', ENV_CHECK.MODE);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Singleton pattern - create client once and reuse
let supabaseInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  // console.log('[v0] 🚀 createClient() called');

  if (!supabaseInstance) {
    // console.log('[v0] Creating new Supabase instance...');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[v0] Missing environment variables!', {
        supabaseUrl: supabaseUrl || 'MISSING',
        supabaseAnonKey: supabaseAnonKey ? 'Present' : 'MISSING',
      });
      throw new Error(
        'Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Railway.'
      );
    }
    
    console.log('[v0] Calling createSupabaseClient()...');
    try {
      supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      console.log('[v0] Supabase client created successfully');
      console.log('[v0] Supabase client auth object:', supabaseInstance?.auth ? 'Present' : 'MISSING');
    } catch (error) {
      console.error('[v0] Error creating Supabase client:', error);
      throw error;
    }
  } else {
    // console.log('[v0] Returning existing Supabase instance');
  }

  return supabaseInstance;
}
