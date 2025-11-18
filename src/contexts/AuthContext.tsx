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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[v0] AuthProvider rendering');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const autoLogin = ((import.meta as any)?.env?.VITE_TEST_AUTO_LOGIN === 'true')
    || (typeof navigator !== 'undefined' && (navigator as any)?.webdriver === true);
  
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
  }

  // In test auto-login mode, set a dummy user and skip Supabase
  useEffect(() => {
    if (autoLogin) {
      console.log('[v0] AuthProvider: VITE_TEST_AUTO_LOGIN enabled - using dummy user');
      setUser({ id: 'test-user', email: 'test@example.com' } as any);
      setSession(null);
      setLoading(false);
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
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
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
