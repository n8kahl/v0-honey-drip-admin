import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../contexts/AuthContext';

export interface TPSettings {
  tpNearThreshold: number; // 0..1 (e.g., 0.85)
  autoOpenTrim: boolean;
}

const DEFAULTS: TPSettings = {
  tpNearThreshold: 0.85,
  autoOpenTrim: true,
};

/**
 * Read Take Profit settings strictly from Supabase user profile. No localStorage fallback.
 * If columns are missing or not set, DEFAULTS are returned in-memory (non-persistent until saved).
 */
export function useTPSettings(): TPSettings {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TPSettings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user?.id) return;
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('tp_near_threshold,tp_auto_open_trim')
          .eq('id', user.id)
          .single();

        if (error) {
          // Column might not exist yet; ignore schema errors gracefully
          console.warn('[useTPSettings] profiles select error (likely missing columns):', (error as any)?.message || error);
          return;
        }

        if (!cancelled && data) {
          const next: TPSettings = {
            tpNearThreshold:
              typeof data.tp_near_threshold === 'number'
                ? Math.min(Math.max(data.tp_near_threshold, 0.5), 0.99)
                : settings.tpNearThreshold,
            autoOpenTrim:
              typeof data.tp_auto_open_trim === 'boolean'
                ? data.tp_auto_open_trim
                : settings.autoOpenTrim,
          };
          setSettings(next);
        }
      } catch (e) {
        console.warn('[useTPSettings] Failed to load TP settings:', (e as any)?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return settings;
}

export async function saveTPSettings(userId: string, updates: Partial<TPSettings>) {
  // Persist strictly to Supabase (no localStorage)
  try {
    const supabase = createClient();
    const payload: any = {};
    if (typeof updates.tpNearThreshold === 'number') payload.tp_near_threshold = updates.tpNearThreshold;
    if (typeof updates.autoOpenTrim === 'boolean') payload.tp_auto_open_trim = updates.autoOpenTrim;
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);
      if (error) {
        console.warn('[useTPSettings] Failed to update profiles row (likely missing columns):', (error as any)?.message || error);
      }
    }
  } catch (e) {
    console.warn('[useTPSettings] Supabase error:', (e as any)?.message || e);
  }
}
