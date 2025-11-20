/**
 * VIX Level Classification
 *
 * Fetches and classifies VIX (CBOE Volatility Index) to gauge market fear/complacency:
 * - low: VIX < 15 (complacent market, breakouts work well)
 * - medium: VIX 15-25 (normal market conditions)
 * - high: VIX 25-35 (elevated fear, wider stops needed)
 * - extreme: VIX > 35 (panic, avoid new positions or trade very defensively)
 */

import { massive } from '../massive/index.js';

export type VIXLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface VIXResult {
  level: VIXLevel;
  value: number;
  timestamp: number;
  confidence: number; // 0-100
}

/**
 * VIX cache to avoid excessive API calls
 * Cache duration: 5 minutes (VIX doesn't change that fast for our purposes)
 */
interface VIXCache {
  value: number;
  timestamp: number;
}

let vixCache: VIXCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch current VIX value from Polygon
 * Uses 5-minute cache to reduce API calls
 */
async function fetchVIX(): Promise<number> {
  const now = Date.now();

  // Return cached value if still fresh
  if (vixCache && now - vixCache.timestamp < CACHE_DURATION_MS) {
    return vixCache.value;
  }

  try {
    // Fetch VIX snapshot from Polygon Indices API
    const snapshot = await massive.rest.getIndicesSnapshot(['VIX']);

    if (snapshot?.results?.[0]?.value) {
      const vixValue = snapshot.results[0].value;

      // Update cache
      vixCache = {
        value: vixValue,
        timestamp: now,
      };

      return vixValue;
    }

    // If API fails, return cached value if available (even if stale)
    if (vixCache) {
      console.warn('[VIX] API returned no data, using stale cache');
      return vixCache.value;
    }

    // No data available, return default (assume medium volatility)
    console.warn('[VIX] No data available, defaulting to 20');
    return 20;
  } catch (error) {
    console.error('[VIX] Error fetching VIX:', error);

    // Return cached value if available
    if (vixCache) {
      console.warn('[VIX] Using stale cache due to error');
      return vixCache.value;
    }

    // Default to medium volatility
    return 20;
  }
}

/**
 * Classify VIX level and return recommendation
 *
 * VIX Levels:
 * - LOW (< 15): Market is complacent, low fear
 *   → Breakouts work well, tight stops acceptable
 * - MEDIUM (15-25): Normal market conditions
 *   → Standard strategies, normal risk management
 * - HIGH (25-35): Elevated fear, increased volatility
 *   → Wider stops, reduce position size, favor mean reversion
 * - EXTREME (> 35): Panic mode, extreme uncertainty
 *   → Avoid new positions or trade very defensively
 *
 * @returns VIX classification with confidence score
 */
export async function classifyVIXLevel(): Promise<VIXResult> {
  const vixValue = await fetchVIX();
  const timestamp = Date.now();

  let level: VIXLevel;
  let confidence: number;

  if (vixValue < 15) {
    level = 'low';
    // Confidence increases as VIX drops below 15
    // VIX 10 = 100 conf, VIX 15 = 50 conf
    confidence = Math.min(100, (15 - vixValue) * 10 + 50);
  } else if (vixValue < 25) {
    level = 'medium';
    // Medium has high confidence in the middle of range
    // VIX 20 = 100 conf, VIX 15/25 = 50 conf
    const distanceFromCenter = Math.abs(vixValue - 20);
    confidence = Math.max(50, 100 - distanceFromCenter * 10);
  } else if (vixValue < 35) {
    level = 'high';
    // Confidence increases as VIX rises above 25
    // VIX 25 = 50 conf, VIX 30 = 75 conf, VIX 35 = 100 conf
    confidence = Math.min(100, (vixValue - 25) * 5 + 50);
  } else {
    level = 'extreme';
    // VIX > 35 is extreme fear
    // VIX 35 = 70 conf, VIX 50 = 100 conf
    confidence = Math.min(100, (vixValue - 35) * 2 + 70);
  }

  return {
    level,
    value: vixValue,
    timestamp,
    confidence,
  };
}

/**
 * Get strategy adjustments for each VIX level
 */
export function getVIXStrategyAdjustments(level: VIXLevel): {
  stopMultiplier: number; // Multiply normal stop distance by this
  sizeMultiplier: number; // Multiply normal position size by this
  recommendedTypes: string[];
  avoid: string[];
} {
  switch (level) {
    case 'low':
      return {
        stopMultiplier: 0.8, // Tighter stops work in low volatility
        sizeMultiplier: 1.2, // Can size up slightly
        recommendedTypes: ['breakout', 'trend-continuation', 'opening-range'],
        avoid: [],
      };

    case 'medium':
      return {
        stopMultiplier: 1.0, // Normal stops
        sizeMultiplier: 1.0, // Normal size
        recommendedTypes: ['all'],
        avoid: [],
      };

    case 'high':
      return {
        stopMultiplier: 1.5, // Wider stops needed
        sizeMultiplier: 0.7, // Reduce size
        recommendedTypes: ['mean-reversion', 'support-resistance', 'divergence'],
        avoid: ['tight-breakout', 'scalp-momentum'],
      };

    case 'extreme':
      return {
        stopMultiplier: 2.0, // Very wide stops
        sizeMultiplier: 0.5, // Cut size in half
        recommendedTypes: ['extreme-oversold', 'capitulation-bounce'],
        avoid: ['breakout', 'trend-continuation', 'most-strategies'],
      };

    default:
      return {
        stopMultiplier: 1.0,
        sizeMultiplier: 1.0,
        recommendedTypes: [],
        avoid: [],
      };
  }
}

/**
 * Clear VIX cache (useful for testing or forcing refresh)
 */
export function clearVIXCache(): void {
  vixCache = null;
}
