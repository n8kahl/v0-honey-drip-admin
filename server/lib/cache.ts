import { LRUCache } from 'lru-cache';

// Short TTL cache for frequently accessed Massive data
interface CacheOptions {
  ttl: number; // milliseconds
  max?: number; // max entries
}

const DEFAULT_MAX = 500;

// Create specialized caches with different TTLs
const snapshotCache = new LRUCache<string, any>({
  max: DEFAULT_MAX,
  ttl: 1000, // 1 second for real-time snapshots
});

const contractsCache = new LRUCache<string, any>({
  max: 200,
  ttl: 30_000, // 30 seconds for reference contracts
});

const indexCache = new LRUCache<string, any>({
  max: 100,
  ttl: 500, // 500ms for index values
});

// Smart TTL for bars cache (historical data cached longer)
const barsCache = new LRUCache<string, any>({
  max: 500, // Increased from 300 to handle more historical data
  ttl: 5_000, // Default TTL (overridden per entry)
  ttlAutopurge: true, // Automatically purge expired entries
  updateAgeOnGet: false, // Don't reset TTL on read (keep historical data stable)
});

export function getCachedSnapshot(key: string): any | undefined {
  return snapshotCache.get(key);
}

export function setCachedSnapshot(key: string, value: any): void {
  snapshotCache.set(key, value);
}

export function getCachedContracts(key: string): any | undefined {
  return contractsCache.get(key);
}

export function setCachedContracts(key: string, value: any): void {
  contractsCache.set(key, value);
}

export function getCachedIndex(key: string): any | undefined {
  return indexCache.get(key);
}

export function setCachedIndex(key: string, value: any): void {
  indexCache.set(key, value);
}

/**
 * Calculate smart TTL based on data recency
 * - Historical data (>1 day old): 7 days
 * - Recent data (>1 hour old): 1 hour
 * - Live data (<1 hour old): 5 seconds
 */
function getSmartTTL(timestamp: number): number {
  const age = Date.now() - timestamp;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const sevenDays = 7 * oneDay;

  if (age > oneDay) {
    // Historical data (>1 day old): cache for 7 days
    return sevenDays;
  } else if (age > oneHour) {
    // Recent data (>1 hour old): cache for 1 hour
    return oneHour;
  } else {
    // Live data (<1 hour old): cache for 5 seconds
    return 5_000;
  }
}

/**
 * Extract most recent timestamp from bars data
 */
function getMostRecentTimestamp(value: any): number {
  // Handle different response formats
  if (Array.isArray(value?.bars)) {
    const bars = value.bars;
    if (bars.length > 0) {
      const lastBar = bars[bars.length - 1];
      return lastBar.timestamp || lastBar.t || Date.now();
    }
  } else if (Array.isArray(value?.results)) {
    const results = value.results;
    if (results.length > 0) {
      const lastBar = results[results.length - 1];
      return lastBar.t || Date.now();
    }
  } else if (Array.isArray(value)) {
    if (value.length > 0) {
      const lastBar = value[value.length - 1];
      return lastBar.timestamp || lastBar.t || Date.now();
    }
  }

  // Default to current time (live data)
  return Date.now();
}

export function getCachedBars(key: string): any | undefined {
  return barsCache.get(key);
}

export function setCachedBars(key: string, value: any): void {
  // Calculate smart TTL based on most recent timestamp in the data
  const timestamp = getMostRecentTimestamp(value);
  const ttl = getSmartTTL(timestamp);

  barsCache.set(key, value, { ttl });
}

// Generic cache wrapper with exponential backoff
export async function cachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  cacheGetter: (key: string) => T | undefined,
  cacheSetter: (key: string, value: T) => void,
  maxRetries = 3
): Promise<T> {
  // Check cache first
  const cached = cacheGetter(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Fetch with exponential backoff on errors
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fetcher();
      cacheSetter(cacheKey, result);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error?.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms...
      if (attempt < maxRetries - 1) {
        const delay = Math.min(100 * Math.pow(2, attempt), 2000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Clear all caches (useful for testing or forced refresh)
export function clearAllCaches(): void {
  snapshotCache.clear();
  contractsCache.clear();
  indexCache.clear();
  barsCache.clear();
}
