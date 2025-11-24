/**
 * Volume Profile Calculations
 * Analyzes volume at different price levels to identify support/resistance
 */

import type { Bar } from "../indicators";

export interface VolumeProfileBucket {
  priceLevel: number;
  volume: number;
  percentage: number;
}

export interface VolumeProfile {
  buckets: VolumeProfileBucket[];
  highVolumeNodes: number[]; // Price levels with highest volume
  maxVolume: number;
}

/**
 * Calculate volume profile for a set of bars
 * Groups volume by price level and identifies key volume nodes
 * @param bars - Array of OHLCV bars
 * @param bucketCount - Number of price buckets (default 50)
 * @returns Volume profile with buckets and high volume nodes
 */
export function calculateVolumeProfile(bars: Bar[], bucketCount: number = 50): VolumeProfile {
  if (bars.length === 0) {
    return {
      buckets: [],
      highVolumeNodes: [],
      maxVolume: 0,
    };
  }

  // Find price range
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const bar of bars) {
    minPrice = Math.min(minPrice, bar.low);
    maxPrice = Math.max(maxPrice, bar.high);
  }

  const priceRange = maxPrice - minPrice;
  const bucketSize = priceRange / bucketCount;

  // Initialize buckets
  const buckets = new Map<number, number>();
  for (let i = 0; i < bucketCount; i++) {
    const levelPrice = minPrice + i * bucketSize;
    buckets.set(levelPrice, 0);
  }

  // Distribute volume across price levels within each bar's range
  for (const bar of bars) {
    const barRange = bar.high - bar.low || 0.0001; // Avoid division by zero
    const volumePerLevel = bar.volume / Math.ceil((bar.high - bar.low) / bucketSize + 1);

    for (let price = bar.low; price <= bar.high; price += bucketSize) {
      const bucketKey = Math.round(price / bucketSize) * bucketSize;
      buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + volumePerLevel);
    }
  }

  // Convert to array and sort
  const totalVolume = Array.from(buckets.values()).reduce((a, b) => a + b, 0);
  const maxVolume = Math.max(...buckets.values());

  const profileBuckets: VolumeProfileBucket[] = Array.from(buckets.entries())
    .map(([priceLevel, volume]) => ({
      priceLevel: Number(priceLevel),
      volume,
      percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
    }))
    .sort((a, b) => a.priceLevel - b.priceLevel);

  // Identify high volume nodes (top 20% of volume areas)
  const volumeThreshold = maxVolume * 0.2;
  const highVolumeNodes = profileBuckets
    .filter((bucket) => bucket.volume >= volumeThreshold)
    .map((bucket) => bucket.priceLevel);

  return {
    buckets: profileBuckets,
    highVolumeNodes,
    maxVolume,
  };
}

/**
 * Get point of control (price level with highest volume)
 */
export function getPointOfControl(profile: VolumeProfile): number | null {
  if (profile.buckets.length === 0) return null;
  return profile.buckets.reduce((max, bucket) => (bucket.volume > max.volume ? bucket : max))
    .priceLevel;
}

/**
 * Get value area (price range containing 70% of volume)
 */
export function getValueArea(profile: VolumeProfile): { high: number; low: number } | null {
  if (profile.buckets.length === 0) return null;

  const sorted = [...profile.buckets].sort((a, b) => b.volume - a.volume);
  let volumeSum = 0;
  const targetVolume = profile.buckets.reduce((sum, b) => sum + b.volume, 0) * 0.7;

  const includedBuckets = sorted
    .filter(() => {
      if (volumeSum >= targetVolume) return false;
      volumeSum += sorted.find((b) => b === sorted[sorted.indexOf(sorted[0])])?.volume || 0;
      return true;
    })
    .map((b) => b.priceLevel)
    .sort((a, b) => a - b);

  if (includedBuckets.length === 0) return null;

  return {
    high: Math.max(...includedBuckets),
    low: Math.min(...includedBuckets),
  };
}
