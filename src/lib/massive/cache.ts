/**
 * MassiveCache
 *
 * Centralized caching layer with TTL management for all Massive data.
 * Provides unified cache interface across REST and WebSocket data.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class MassiveCache {
  private store: Map<string, CacheEntry<any>>;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    this.store = new Map();
    this.startCleanupInterval();
  }

  /**
   * Get or fetch data with caching
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Get cached value if not expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    const now = Date.now();
    this.store.set(key, {
      data,
      expiresAt: now + ttlMs,
      createdAt: now,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear cache by pattern (regex)
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      console.log('[Cache] Cleared all entries');
      return;
    }

    const regex = new RegExp(pattern);
    let cleared = 0;

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        cleared++;
      }
    }

    console.log(`[Cache] Cleared ${cleared} entries matching pattern: ${pattern}`);
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[Cache] Cleared ${cleared} expired entries`);
    }

    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.clearExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Get time until key expires (ms)
   */
  getTTL(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const remaining = entry.expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Extend TTL for existing key
   */
  extend(key: string, additionalMs: number): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    entry.expiresAt += additionalMs;
    return true;
  }
}
