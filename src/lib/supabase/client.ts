import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

console.log('[v0] Supabase client module loaded');
console.log('[v0] Environment variables check:', {
  hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasSupabaseAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...',
  anonKeyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length || 0,
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Singleton pattern - create client once and reuse
let supabaseInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  console.log('[v0] createClient() called');
  
  if (!supabaseInstance) {
    console.log('[v0] Creating new Supabase instance...');
    
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
    console.log('[v0] Returning existing Supabase instance');
  }
  
  return supabaseInstance;
}
