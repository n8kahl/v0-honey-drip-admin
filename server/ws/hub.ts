import WebSocket from "ws";
import { setInterval, clearInterval } from "timers";

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

export class MassiveHub {
  private upstream?: WebSocket;
  private upstreamOpen = false;
  private upstreamAuthd = false;
  private heartbeat?: NodeJS.Timeout;

  private clients = new Set<ClientCtx>();
  private topicRefCount = new Map<string, number>();
  private queuedTopics = new Set<string>();

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
          console.error(`${logPrefix} Send failed:`, err);
        }
      }

      try {
        const arr = JSON.parse(textData);
        console.warn(`${logPrefix} Received upstream message:`, JSON.stringify(arr).slice(0, 200));

        const statusMsg = Array.isArray(arr) ? arr.find((m) => m?.ev === "status") : undefined;
        if (statusMsg?.status === "auth_success") {
          console.warn(`${logPrefix} ✅ Authentication successful!`);
          this.upstreamAuthd = true;
          this.flushQueuedTopics();
        }
      } catch (err) {
        console.error(`${logPrefix} Parse error:`, err);
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
        console.error(`${logPrefix} ❌ Code 1008 = Policy Violation. Possible causes:
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

  private flushQueuedTopics() {
    if (!this.queuedTopics.size) return;
    const params = Array.from(this.queuedTopics).join(",");
    this.sendUpstream({ action: "subscribe", params });
    this.queuedTopics.clear();
  }

  private incTopic(topic: string) {
    const count = (this.topicRefCount.get(topic) ?? 0) + 1;
    this.topicRefCount.set(topic, count);
    if (count === 1) {
      if (!this.upstreamAuthd) {
        this.queuedTopics.add(topic);
      } else {
        this.sendUpstream({ action: "subscribe", params: topic });
      }
    }
  }

  private decTopic(topic: string) {
    const count = (this.topicRefCount.get(topic) ?? 0) - 1;
    if (count <= 0) {
      this.topicRefCount.delete(topic);
      if (this.upstreamAuthd) {
        this.sendUpstream({ action: "unsubscribe", params: topic });
      } else {
        this.queuedTopics.delete(topic);
      }
    } else {
      this.topicRefCount.set(topic, count);
    }
  }

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
        const rawParams: string = (msgObj.params as string) ?? "";
        const topics = rawParams
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const fixed = topics.map((topic) => {
          if (this.opts.asset !== "indices") return topic;
          const match = topic.match(/^(V|AM|A)\.(.+)$/);
          if (!match) return topic;
          const ev = match[1];
          const sym = match[2];
          return sym.startsWith("I:") ? topic : `${ev}.I:${sym}`;
        });
        for (const topic of fixed) {
          if (!ctx.subs.has(topic)) {
            ctx.subs.add(topic);
            this.incTopic(topic);
          }
        }
        break;
      }
      case "unsubscribe": {
        const rawParams: string = (msgObj.params as string) ?? "";
        const topics = rawParams
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const topic of topics) {
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
}
