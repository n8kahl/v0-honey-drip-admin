import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[v0] AuthProvider rendering');
  console.log('[v0] VITE_TEST_AUTO_LOGIN value:', (import.meta as any)?.env?.VITE_TEST_AUTO_LOGIN);
  console.log('[v0] import.meta.env:', import.meta.env);
  
  const autoLogin = ((import.meta as any)?.env?.VITE_TEST_AUTO_LOGIN === 'true')
    || (typeof navigator !== 'undefined' && (navigator as any)?.webdriver === true);
  
  console.log('[v0] autoLogin computed as:', autoLogin);
  
  // Initialize with test user if auto-login enabled
  const [user, setUser] = useState<User | null>(
    autoLogin ? ({ id: 'test-user', email: 'test@example.com' } as any) : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!autoLogin); // Start not loading if auto-login
  const [initError, setInitError] = useState<string | null>(null);
  
  let supabase;
  if (!autoLogin) {
    try {
      console.log('[v0] AuthProvider: Calling createClient()...');
      supabase = createClient();
      console.log('[v0] AuthProvider: createClient() succeeded');
      console.log('[v0] AuthProvider: supabase object:', {
        hasAuth: !!supabase?.auth,
        hasFrom: !!supabase?.from,
        authKeys: supabase?.auth ? Object.keys(supabase.auth) : [],
      });
    } catch (error) {
      console.error('[v0] AuthProvider: createClient() failed:', error);
      setInitError(error instanceof Error ? error.message : 'Failed to initialize Supabase');
      setLoading(false);
    }
  } else {
    console.log('[v0] AuthProvider: Auto-login enabled, skipping Supabase entirely');
  }

  // Log auto-login mode
  useEffect(() => {
    if (autoLogin) {
      console.log('[v0] AuthProvider: Auto-login mode - user set at initialization');
    }
  }, [autoLogin]);

  useEffect(() => {
    if (autoLogin) return; // skip supabase wiring in test mode
    if (!supabase) {
      console.log('[v0] AuthProvider useEffect: No supabase client, skipping');
      return;
    }
    
    console.log('[v0] AuthProvider useEffect: Getting initial session...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[v0] AuthProvider: getSession complete', {
        hasSession: !!session,
        hasUser: !!session?.user,
      });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('[v0] AuthProvider: getSession error:', error);
      setLoading(false);
    });

    // Listen for auth changes
    console.log('[v0] AuthProvider: Setting up auth state listener...');
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[v0] AuthProvider: Auth state changed', {
        event: _event,
        hasSession: !!session,
        hasUser: !!session?.user,
      });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('[v0] AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  if (initError) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-base)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-[var(--text-high)] mb-2">Configuration Error</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">{initError}</p>
          <div className="text-xs text-[var(--text-low)] space-y-1">
            <p>Required environment variables:</p>
            <ul className="list-disc list-inside ml-2">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const signIn = async (email: string, password: string) => {
    if (autoLogin) {
      console.log('[v0] signIn: Auto-login mode, skipping Supabase auth');
      return { error: null }; // Already logged in
    }
    if (!supabase) return { error: new Error('Supabase not initialized') };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!supabase) return { error: new Error('Supabase not initialized') };
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/` 
      : 'http://localhost:3000/';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    if (autoLogin) {
      console.log('[v0] signOut: Auto-login mode, cannot sign out');
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    if (autoLogin) {
      console.log('[v0] resetPassword: Auto-login mode, skipping');
      return { error: null };
    }
    if (!supabase) return { error: new Error('Supabase not initialized') };

    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : 'http://localhost:3000/reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
