import WebSocket from "ws";
import { setInterval, clearInterval } from "timers";
import { parseClientParamsToTopics, normalizeIndicesTopic } from "./topicParsing";

type Asset = "options" | "indices";

interface ClientCtx {
  ws: WebSocket;
  subs: Set<string>;
}

interface HubOpts {
  upstreamUrl: string;
  apiKey: string;
  asset: Asset;
  logPrefix: string;
}

/**
 * MassiveHub - WebSocket proxy hub with topic ref-counting
 *
 * Manages multiple client connections and proxies subscriptions to a single
 * upstream Massive.com WebSocket connection. Uses reference counting to
 * ensure each topic is subscribed only once upstream, regardless of how
 * many clients request it.
 *
 * BUG FIXES (December 2025):
 * - Fixed comma-splitting bug: Topics like "options.bars:1m,5m,15m:SPY*" were being
 *   split incorrectly. Now uses parseClientParamsToTopics which detects structured
 *   topics and doesn't split them.
 * - Fixed reconnect bug: queuedTopics was only populated before auth, so reconnect
 *   didn't resubscribe all topics. Now uses subscribeAllCurrentTopics() on auth_success
 *   which iterates topicRefCount.keys().
 */
export class MassiveHub {
  private upstream?: WebSocket;
  private upstreamOpen = false;
  private upstreamAuthd = false;
  private heartbeat?: NodeJS.Timeout;

  private clients = new Set<ClientCtx>();

  /**
   * Reference count for each topic. Key is the normalized topic string.
   * This is THE source of truth for what topics should be subscribed upstream.
   */
  private topicRefCount = new Map<string, number>();

  constructor(private opts: HubOpts) {}

  attachClient = (clientWs: WebSocket) => {
    const ctx: ClientCtx = { ws: clientWs, subs: new Set() };
    this.clients.add(ctx);

    clientWs.on("message", (raw: WebSocket.RawData) => this.onClientMessage(ctx, raw));
    clientWs.on("close", () => this.detachClient(ctx));
    clientWs.on("error", () => this.detachClient(ctx));

    if (!this.upstream || this.upstream.readyState >= WebSocket.CLOSING) {
      this.connectUpstream();
    }
  };

  private detachClient(ctx: ClientCtx) {
    for (const t of ctx.subs) this.decTopic(t);
    ctx.subs.clear();
    this.clients.delete(ctx);

    if (this.clients.size === 0) {
      this.safeCloseUpstream();
    }
  }

  private connectUpstream() {
    const { upstreamUrl, apiKey, logPrefix } = this.opts;
    this.upstreamOpen = false;
    this.upstreamAuthd = false;

    this.upstream = new WebSocket(upstreamUrl);

    this.upstream.once("open", () => {
      this.upstreamOpen = true;
      console.log(`${logPrefix} Upstream connected, sending auth...`);

      // Per Massive WebSocket Quickstart: {"action":"auth","params":"<apikey>"}
      const authMsg = { action: "auth", params: apiKey };
      console.log(
        `${logPrefix} Auth message structure:`,
        JSON.stringify({ action: "auth", params: apiKey ? `${apiKey.slice(0, 8)}...` : "MISSING" })
      );

      this.sendUpstream(authMsg);

      this.heartbeat = setInterval(() => {
        try {
          this.upstream?.ping();
        } catch (err) {
          console.error(`${logPrefix} Ping failed:`, err);
        }
      }, 30_000);
    });

    this.upstream.on("message", (data) => {
      // Convert Buffer/Blob to string for JSON parsing
      const textData = data.toString("utf-8");

      for (const client of this.clients) {
        try {
          client.ws.send(textData);
        } catch (err) {
          console.warn(`${logPrefix} Failed to send to client:`, err);
        }
      }

      try {
        const arr = JSON.parse(textData);
        console.log(`${logPrefix} Received upstream message:`, JSON.stringify(arr).slice(0, 200));

        const statusMsg = Array.isArray(arr) ? arr.find((m) => m?.ev === "status") : undefined;
        if (statusMsg?.status === "auth_success") {
          console.log(`${logPrefix} Authentication successful!`);
          this.upstreamAuthd = true;
          // FIX: On reconnect, resubscribe ALL topics from refcount (not just queued)
          this.subscribeAllCurrentTopics();
        }
      } catch (err) {
        // Non-JSON messages are expected, only warn in debug mode
        if (process.env.DEBUG_WS) {
          console.warn(`${logPrefix} Failed to parse message:`, err);
        }
      }
    });

    this.upstream.on("close", (code, reason) => {
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = undefined;
      }
      this.upstreamOpen = false;
      this.upstreamAuthd = false;
      for (const client of this.clients) {
        try {
          client.ws.close(code);
        } catch {
          // Ignore send errors
        }
      }

      const reasonText = reason ? reason.toString("utf-8") : "No reason provided";
      console.warn(`${logPrefix} upstream closed with code ${code}: ${reasonText}`);

      if (code === 1008) {
        console.error(`${logPrefix} Code 1008 = Policy Violation. Possible causes:
  1. Invalid API key format or expired key
  2. Insufficient permissions (need OPTIONS ADVANCED or INDICES ADVANCED tier)
  3. WebSocket endpoint mismatch (check ${upstreamUrl})
  4. Authentication message rejected

  Current API key: ${apiKey ? apiKey.slice(0, 12) + "..." : "MISSING"}
  Authenticated before close: ${this.upstreamAuthd}

  Check Massive dashboard: https://massive.com/dashboard/keys`);
      }
    });

    this.upstream.on("error", (err) => {
      console.error(`${logPrefix} upstream error`, err);
      try {
        this.upstream?.close();
      } catch (closeErr) {
        console.error(`${logPrefix} Close error:`, closeErr);
      }
    });
  }

  private safeCloseUpstream() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
    if (this.upstream && this.upstream.readyState === WebSocket.OPEN) {
      try {
        this.upstream.close(1000, "idle");
      } catch (err) {
        console.error("Close error:", err);
      }
    }
    this.upstreamOpen = false;
    this.upstreamAuthd = false;
  }

  private sendUpstream(msg: unknown) {
    if (!this.upstream || this.upstream.readyState !== WebSocket.OPEN) return;
    this.upstream.send(JSON.stringify(msg));
  }

  /**
   * Subscribe to all topics currently in topicRefCount.
   *
   * Called on auth_success to ensure all topics are resubscribed after reconnect.
   * Sends one subscribe message per topic to ensure proper handling by Massive.
   */
  private subscribeAllCurrentTopics() {
    const topics = Array.from(this.topicRefCount.keys());
    if (topics.length === 0) return;

    console.warn(`${this.opts.logPrefix} Resubscribing ${topics.length} topics after auth`);

    for (const topic of topics) {
      this.sendUpstream({ action: "subscribe", params: topic });
    }
  }

  /**
   * Increment reference count for a topic.
   *
   * If this is the first subscriber (count goes 0 -> 1), subscribe upstream.
   */
  private incTopic(topic: string) {
    const count = (this.topicRefCount.get(topic) ?? 0) + 1;
    this.topicRefCount.set(topic, count);

    // Only subscribe upstream on first subscription
    if (count === 1 && this.upstreamAuthd) {
      this.sendUpstream({ action: "subscribe", params: topic });
    }
    // If not authenticated yet, topic will be subscribed in subscribeAllCurrentTopics()
  }

  /**
   * Decrement reference count for a topic.
   *
   * If this was the last subscriber (count goes 1 -> 0), unsubscribe upstream.
   */
  private decTopic(topic: string) {
    const count = (this.topicRefCount.get(topic) ?? 0) - 1;

    if (count <= 0) {
      this.topicRefCount.delete(topic);
      if (this.upstreamAuthd) {
        this.sendUpstream({ action: "unsubscribe", params: topic });
      }
    } else {
      this.topicRefCount.set(topic, count);
    }
  }

  /**
   * Handle incoming message from a client WebSocket.
   *
   * BUG FIX: Uses parseClientParamsToTopics instead of split(",") to correctly
   * handle topics containing commas (e.g., "options.bars:1m,5m,15m:SPY*").
   */
  private onClientMessage(ctx: ClientCtx, raw: WebSocket.RawData) {
    let msg: unknown;
    try {
      msg = JSON.parse(String(raw));
    } catch (err) {
      console.error("Parse error:", err);
      return;
    }
    if (!msg || typeof msg !== "object") return;

    const msgObj = msg as Record<string, unknown>;
    switch (msgObj.action) {
      case "subscribe": {
        // FIX: Use parseClientParamsToTopics instead of split(",")
        // This correctly handles topics like "options.bars:1m,5m,15m:SPY*"
        const topics = parseClientParamsToTopics(msgObj.params);

        // Normalize indices topics (add I: prefix if needed)
        const normalizedTopics =
          this.opts.asset === "indices" ? topics.map(normalizeIndicesTopic) : topics;

        for (const topic of normalizedTopics) {
          if (!ctx.subs.has(topic)) {
            ctx.subs.add(topic);
            this.incTopic(topic);
          }
        }
        break;
      }
      case "unsubscribe": {
        // FIX: Use parseClientParamsToTopics instead of split(",")
        const topics = parseClientParamsToTopics(msgObj.params);

        // Normalize indices topics for consistent lookup
        const normalizedTopics =
          this.opts.asset === "indices" ? topics.map(normalizeIndicesTopic) : topics;

        for (const topic of normalizedTopics) {
          if (ctx.subs.has(topic)) {
            ctx.subs.delete(topic);
            this.decTopic(topic);
          }
        }
        break;
      }
      case "ping": {
        try {
          ctx.ws.pong();
        } catch (err) {
          console.error("Pong error:", err);
        }
        break;
      }
    }
  }

  // ============================================================================
  // Test helpers (exported for unit tests)
  // ============================================================================

  /**
   * Get current topic ref counts (for testing)
   */
  _getTopicRefCount(): Map<string, number> {
    return new Map(this.topicRefCount);
  }

  /**
   * Check if authenticated (for testing)
   */
  _isAuthenticated(): boolean {
    return this.upstreamAuthd;
  }
}
