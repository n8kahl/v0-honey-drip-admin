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

const barsCache = new LRUCache<string, any>({
  max: 300,
  ttl: 5_000, // 5 seconds for bars
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

export function getCachedBars(key: string): any | undefined {
  return barsCache.get(key);
}

export function setCachedBars(key: string, value: any): void {
  barsCache.set(key, value);
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
