/**
 * Strategy Scanner API Route
 * Manual trigger for testing scanner logic before automation
 * 
 * NOTE: This is a placeholder endpoint for testing. Full scanner implementation
 * requires client-side integration via useMassiveData hooks calling scanner directly.
 * Scanner logic lives in src/lib/strategy/scanner.ts (client-side).
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * POST /api/strategies/trigger-scan
 * 
 * Placeholder endpoint - returns strategy count for testing
 * Actual scanning happens client-side in browser context
 * 
 * Body:
 * {
 *   "owner": "user-uuid"
 * }
 */
router.post('/trigger-scan', async (req, res) => {
  try {
    const { owner } = req.body;

    if (!owner) {
      return res.status(400).json({
        error: 'Missing required field: owner (string)',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Just count enabled strategies as a health check
    const { data, error } = await supabase
      .from('strategy_definitions')
      .select('id, name, slug')
      .eq('enabled', true)
      .or(`owner.eq.${owner},is_core_library.eq.true`);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Scanner trigger received. Actual scanning happens client-side.',
      enabledStrategies: data?.length || 0,
      strategies: data?.map((s: any) => ({ id: s.id, name: s.name, slug: s.slug })) || [],
    });
  } catch (error: any) {
    console.error('[Scanner] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/strategies/list
 * 
 * List all enabled strategies for debugging
 */
router.get('/list', async (req, res) => {
  try {
    const { owner } = req.query;

    if (!owner || typeof owner !== 'string') {
      return res.status(400).json({ error: 'Missing owner query parameter' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('strategy_definitions')
      .select('*')
      .eq('enabled', true)
      .or(`owner.eq.${owner},is_core_library.eq.true`);

    if (error) throw error;

    return res.json({
      success: true,
      count: data.length,
      strategies: data.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        entrySide: s.entry_side,
        enabled: s.enabled,
        isCoreLibrary: s.is_core_library,
      })),
    });
  } catch (error: any) {
    console.error('[Scanner] Error listing strategies:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
