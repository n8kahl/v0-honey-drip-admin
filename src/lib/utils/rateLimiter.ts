/**
 * Simple client-side rate limiter to prevent Discord webhook spam
 * Tracks timestamps of recent actions and rejects if limit exceeded
 */

interface RateLimiterConfig {
  maxRequests: number;  // Maximum number of requests allowed
  windowMs: number;     // Time window in milliseconds
}

class RateLimiter {
  private timestamps: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Check if an action is allowed under the rate limit
   * @returns true if allowed, false if rate-limited
   */
  canProceed(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove timestamps outside the current window
    this.timestamps = this.timestamps.filter(ts => ts > windowStart);

    // Check if we're under the limit
    if (this.timestamps.length >= this.config.maxRequests) {
      return false;
    }

    // Record this request
    this.timestamps.push(now);
    return true;
  }

  /**
   * Get how long to wait before the next request is allowed (in milliseconds)
   */
  getWaitTime(): number {
    if (this.timestamps.length < this.config.maxRequests) {
      return 0;
    }

    const oldestTimestamp = this.timestamps[0];
    const windowStart = Date.now() - this.config.windowMs;

    if (oldestTimestamp > windowStart) {
      return oldestTimestamp + this.config.windowMs - Date.now();
    }

    return 0;
  }

  /**
   * Reset the rate limiter (clear all timestamps)
   */
  reset(): void {
    this.timestamps = [];
  }
}

// Singleton rate limiter for Discord alerts
// Limit: 10 alerts per minute per user
export const discordAlertLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Format wait time into a human-readable string
 */
export function formatWaitTime(ms: number): string {
  if (ms < 1000) return "less than a second";

  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds > 1 ? "s" : ""}`;

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}
