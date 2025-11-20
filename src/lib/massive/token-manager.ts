/**
 * MassiveTokenManager
 *
 * Manages ephemeral authentication tokens for Massive API access.
 * Handles automatic token refresh before expiry.
 */

interface TokenResponse {
  token: string;
  expiresAt: number;
}

export class MassiveTokenManager {
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;

  /**
   * Get current token, refreshing if needed
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.token && this.isTokenValid()) {
      return this.token;
    }

    // If refresh in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Otherwise, fetch new token
    return this.refreshToken();
  }

  /**
   * Force refresh the token
   */
  async refreshToken(): Promise<string> {
    this.refreshPromise = this.fetchToken();

    try {
      this.token = await this.refreshPromise;
      return this.token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Fetch new token from server
   */
  private async fetchToken(): Promise<string> {
    try {
      const response = await fetch('/api/ws-token', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`);
      }

      const data: TokenResponse = await response.json();

      if (!data.token || !data.expiresAt) {
        throw new Error('Invalid token response format');
      }

      this.token = data.token;
      this.tokenExpiry = data.expiresAt;

      // Schedule auto-refresh 1 minute before expiry
      this.scheduleRefresh();

      console.log('[TokenManager] Token acquired, expires at', new Date(data.expiresAt).toISOString());

      return data.token;
    } catch (error) {
      console.error('[TokenManager] Failed to fetch token:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleRefresh(): void {
    // Clear existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    if (!this.tokenExpiry) return;

    // Refresh 1 minute before expiry
    const timeUntilRefresh = this.tokenExpiry - Date.now() - 60000;

    if (timeUntilRefresh > 0) {
      this.refreshTimeout = setTimeout(() => {
        console.log('[TokenManager] Auto-refreshing token');
        this.refreshToken().catch(err => {
          console.error('[TokenManager] Auto-refresh failed:', err);
        });
      }, timeUntilRefresh);
    }
  }

  /**
   * Check if current token is valid (has >1 minute remaining)
   */
  private isTokenValid(): boolean {
    if (!this.tokenExpiry || !this.token) return false;
    return this.tokenExpiry - Date.now() > 60000;
  }

  /**
   * Public method to check token validity
   */
  isValid(): boolean {
    return !!this.token && this.isTokenValid();
  }

  /**
   * Ensure token is available (fetch if needed)
   */
  async ensureToken(): Promise<void> {
    await this.getToken();
  }

  /**
   * Clear token and cancel auto-refresh
   */
  clear(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.refreshPromise = null;

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    console.log('[TokenManager] Token cleared');
  }

  /**
   * Get token info for debugging
   */
  getInfo(): { hasToken: boolean; expiresAt: number | null; isValid: boolean } {
    return {
      hasToken: !!this.token,
      expiresAt: this.tokenExpiry,
      isValid: this.isValid(),
    };
  }
}
