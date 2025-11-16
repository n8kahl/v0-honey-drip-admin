import WebSocket, { WebSocket as WS } from 'ws';
import { setInterval, clearInterval } from 'timers';

type Asset = 'options' | 'indices';

interface ClientCtx {
  ws: WS;
  subs: Set<string>;
}

interface HubOpts {
  upstreamUrl: string;
  apiKey: string;
  asset: Asset;
  logPrefix: string;
}

export class MassiveHub {
  private upstream?: WS;
  private upstreamOpen = false;
  private upstreamAuthd = false;
  private heartbeat?: NodeJS.Timeout;

  private clients = new Set<ClientCtx>();
  private topicRefCount = new Map<string, number>();
  private queuedTopics = new Set<string>();

  constructor(private opts: HubOpts) {}

  attachClient = (clientWs: WS) => {
    const ctx: ClientCtx = { ws: clientWs, subs: new Set() };
    this.clients.add(ctx);

    clientWs.on('message', (raw) => this.onClientMessage(ctx, raw));
    clientWs.on('close', () => this.detachClient(ctx));
    clientWs.on('error', () => this.detachClient(ctx));

    if (!this.upstream || this.upstream.readyState >= WS.CLOSING) {
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

    this.upstream.once('open', () => {
      this.upstreamOpen = true;
      this.sendUpstream({ action: 'auth', params: apiKey });
      this.heartbeat = setInterval(() => {
        try {
          this.upstream?.ping();
        } catch {}
      }, 30_000);
    });

    this.upstream.on('message', (data) => {
      for (const client of this.clients) {
        try {
          client.ws.send(data);
        } catch {}
      }

      try {
        const arr = JSON.parse(String(data));
        const statusMsg = Array.isArray(arr) ? arr.find((m) => m?.ev === 'status') : undefined;
        if (statusMsg?.status === 'auth_success') {
          this.upstreamAuthd = true;
          this.flushQueuedTopics();
        }
      } catch {}
    });

    this.upstream.on('close', (code) => {
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = undefined;
      }
      this.upstreamOpen = false;
      this.upstreamAuthd = false;
      for (const client of this.clients) {
        try {
          client.ws.close(code);
        } catch {}
      }
      console.warn(`${logPrefix} upstream closed`, code);
    });

    this.upstream.on('error', (err) => {
      console.error(`${logPrefix} upstream error`, err);
      try {
        this.upstream?.close();
      } catch {}
    });
  }

  private safeCloseUpstream() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
    if (this.upstream && this.upstream.readyState === WS.OPEN) {
      try {
        this.upstream.close(1000, 'idle');
      } catch {}
    }
    this.upstreamOpen = false;
    this.upstreamAuthd = false;
  }

  private sendUpstream(msg: unknown) {
    if (!this.upstream || this.upstream.readyState !== WS.OPEN) return;
    this.upstream.send(JSON.stringify(msg));
  }

  private flushQueuedTopics() {
    if (!this.queuedTopics.size) return;
    const params = Array.from(this.queuedTopics).join(',');
    this.sendUpstream({ action: 'subscribe', params });
    this.queuedTopics.clear();
  }

  private incTopic(topic: string) {
    const count = (this.topicRefCount.get(topic) ?? 0) + 1;
    this.topicRefCount.set(topic, count);
    if (count === 1) {
      if (!this.upstreamAuthd) {
        this.queuedTopics.add(topic);
      } else {
        this.sendUpstream({ action: 'subscribe', params: topic });
      }
    }
  }

  private decTopic(topic: string) {
    const count = (this.topicRefCount.get(topic) ?? 0) - 1;
    if (count <= 0) {
      this.topicRefCount.delete(topic);
      if (this.upstreamAuthd) {
        this.sendUpstream({ action: 'unsubscribe', params: topic });
      } else {
        this.queuedTopics.delete(topic);
      }
    } else {
      this.topicRefCount.set(topic, count);
    }
  }

  private onClientMessage(ctx: ClientCtx, raw: WS.RawData) {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    switch (msg.action) {
      case 'subscribe': {
        const rawParams: string = msg.params ?? '';
        const topics = rawParams.split(',').map((s) => s.trim()).filter(Boolean);
        const fixed = topics.map((topic) => {
          if (this.opts.asset !== 'indices') return topic;
          const match = topic.match(/^(V|AM|A)\.(.+)$/);
          if (!match) return topic;
          const ev = match[1];
          const sym = match[2];
          return sym.startsWith('I:') ? topic : `${ev}.I:${sym}`;
        });
        for (const topic of fixed) {
          if (!ctx.subs.has(topic)) {
            ctx.subs.add(topic);
            this.incTopic(topic);
          }
        }
        break;
      }
      case 'unsubscribe': {
        const rawParams: string = msg.params ?? '';
        const topics = rawParams.split(',').map((s) => s.trim()).filter(Boolean);
        for (const topic of topics) {
          if (ctx.subs.has(topic)) {
            ctx.subs.delete(topic);
            this.decTopic(topic);
          }
        }
        break;
      }
      case 'ping': {
        try {
          ctx.ws.pong();
        } catch {}
        break;
      }
    }
  }
}
