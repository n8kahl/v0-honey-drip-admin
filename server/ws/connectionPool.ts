/**
 * WebSocket Connection Pool Manager
 *
 * Manages WebSocket connections to respect API provider limits while supporting
 * multiple concurrent admin users and browser tabs.
 *
 * Architecture:
 * - Single shared upstream connection per asset type (options, indices)
 * - All clients (users/tabs) share the same upstream connection
 * - Topic-based subscription with reference counting
 * - Graceful degradation to REST polling when connection limit reached
 *
 * Multi-Admin Support:
 * - Each admin/tab gets their own client connection to our server
 * - Server maintains a single upstream connection to Massive.com
 * - Topics are ref-counted: subscribe once upstream, broadcast to all clients
 * - No connection limit issues regardless of number of admins
 *
 * Example: 10 admins × 5 tabs = 50 client connections → 1 upstream to Massive
 */

interface ConnectionMetrics {
  totalClients: number;
  upstreamConnections: number;
  activeSubscriptions: number;
  connectionState: "connected" | "connecting" | "disconnected" | "error";
  lastError?: string;
  lastConnectedAt?: Date;
  reconnectAttempts: number;
}

interface ConnectionLimits {
  maxUpstreamConnections: number;
  maxClientsPerConnection: number;
  reconnectBackoffMs: number[];
}

const DEFAULT_LIMITS: ConnectionLimits = {
  maxUpstreamConnections: parseInt(process.env.MAX_WS_CONNECTIONS || "5"),
  maxClientsPerConnection: 100,
  reconnectBackoffMs: [1000, 2000, 5000, 10000, 30000],
};

export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager;
  private limits: ConnectionLimits;
  private metrics: Map<string, ConnectionMetrics> = new Map();

  private constructor() {
    this.limits = DEFAULT_LIMITS;
    console.log("[ConnectionPool] Initialized with limits:", this.limits);
  }

  static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }

  canAcceptClient(asset: "options" | "indices"): boolean {
    const metrics = this.getMetrics(asset);

    if (metrics.upstreamConnections >= this.limits.maxUpstreamConnections) {
      console.warn(
        `[ConnectionPool] Cannot accept new ${asset} client: upstream limit reached (${metrics.upstreamConnections}/${this.limits.maxUpstreamConnections})`
      );
      return false;
    }

    return true;
  }

  registerClient(asset: "options" | "indices"): void {
    const metrics = this.getMetrics(asset);
    metrics.totalClients++;
    this.updateMetrics(asset, metrics);
  }

  unregisterClient(asset: "options" | "indices"): void {
    const metrics = this.getMetrics(asset);
    metrics.totalClients = Math.max(0, metrics.totalClients - 1);
    this.updateMetrics(asset, metrics);
  }

  updateUpstreamState(
    asset: "options" | "indices",
    state: "connected" | "connecting" | "disconnected" | "error",
    error?: string
  ): void {
    const metrics = this.getMetrics(asset);
    metrics.connectionState = state;

    if (state === "connected") {
      metrics.upstreamConnections = 1;
      metrics.lastConnectedAt = new Date();
      metrics.reconnectAttempts = 0;
    } else if (state === "disconnected" || state === "error") {
      metrics.upstreamConnections = 0;
      if (error) {
        metrics.lastError = error;
      }
    }

    this.updateMetrics(asset, metrics);
  }

  recordReconnectAttempt(asset: "options" | "indices"): void {
    const metrics = this.getMetrics(asset);
    metrics.reconnectAttempts++;
    this.updateMetrics(asset, metrics);
  }

  getReconnectDelay(asset: "options" | "indices"): number {
    const metrics = this.getMetrics(asset);
    const attemptIndex = Math.min(
      metrics.reconnectAttempts,
      this.limits.reconnectBackoffMs.length - 1
    );
    return this.limits.reconnectBackoffMs[attemptIndex];
  }

  updateSubscriptionCount(asset: "options" | "indices", count: number): void {
    const metrics = this.getMetrics(asset);
    metrics.activeSubscriptions = count;
    this.updateMetrics(asset, metrics);
  }

  getMetrics(asset: "options" | "indices"): ConnectionMetrics {
    if (!this.metrics.has(asset)) {
      this.metrics.set(asset, {
        totalClients: 0,
        upstreamConnections: 0,
        activeSubscriptions: 0,
        connectionState: "disconnected",
        reconnectAttempts: 0,
      });
    }
    return this.metrics.get(asset)!;
  }

  getHealthStatus(): {
    healthy: boolean;
    details: Record<string, ConnectionMetrics>;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const details: Record<string, ConnectionMetrics> = {};

    for (const [asset, metrics] of this.metrics.entries()) {
      details[asset] = { ...metrics };

      if (metrics.connectionState === "error") {
        warnings.push(`${asset} connection error: ${metrics.lastError || "Unknown"}`);
      }

      if (metrics.reconnectAttempts > 3) {
        warnings.push(`${asset} has ${metrics.reconnectAttempts} reconnect attempts`);
      }

      if (metrics.upstreamConnections >= this.limits.maxUpstreamConnections * 0.8) {
        warnings.push(
          `${asset} approaching connection limit (${metrics.upstreamConnections}/${this.limits.maxUpstreamConnections})`
        );
      }
    }

    return {
      healthy: warnings.length === 0,
      details,
      warnings,
    };
  }

  private updateMetrics(asset: "options" | "indices", metrics: ConnectionMetrics): void {
    this.metrics.set(asset, metrics);
  }

  updateLimits(limits: Partial<ConnectionLimits>): void {
    this.limits = { ...this.limits, ...limits };
    console.log("[ConnectionPool] Updated limits:", this.limits);
  }
}

export function connectionPoolHealthEndpoint(req: any, res: any): void {
  const pool = ConnectionPoolManager.getInstance();
  const health = pool.getHealthStatus();

  res.status(health.healthy ? 200 : 503).json({
    healthy: health.healthy,
    timestamp: new Date().toISOString(),
    metrics: health.details,
    warnings: health.warnings,
    limits: {
      maxUpstreamConnections: parseInt(process.env.MAX_WS_CONNECTIONS || "5"),
    },
  });
}
