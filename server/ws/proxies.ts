import WebSocket, { WebSocketServer } from 'ws';
import type { Server } from 'http';
import { URL } from 'url';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || '';
const MASSIVE_PROXY_TOKEN = process.env.MASSIVE_PROXY_TOKEN || '';
const WS_BASE = 'wss://socket.massive.com';

type Asset = 'options' | 'indices';

interface CreateArgs { server: Server }

export function createWebSocketProxies({ server }: CreateArgs) {
  if (!MASSIVE_API_KEY) {
    console.warn('[WS] MASSIVE_API_KEY not set — WS proxy will reject connections');
  }
  if (!MASSIVE_PROXY_TOKEN) {
    console.warn('[WS] MASSIVE_PROXY_TOKEN not set — require it in the query string');
  }

  makeProxy(server, 'options');
  makeProxy(server, 'indices');
}

function makeProxy(server: Server, asset: Asset) {
  const path = `/ws/${asset}`;
  const wss = new WebSocketServer({ server, path });

  wss.on('connection', (client, req) => {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!MASSIVE_PROXY_TOKEN || token !== MASSIVE_PROXY_TOKEN) {
        client.close(4403, 'Forbidden');
        return;
      }
      if (!MASSIVE_API_KEY) {
        client.close(4500, 'Server not configured');
        return;
      }

      const upstreamUrl = `${WS_BASE}/${asset}`;
      const upstream = new WebSocket(upstreamUrl);
      let subscriptions = new Set<string>();
      let authenticated = false;
      let closed = false;
      let hb: NodeJS.Timeout | null = null;

      const sendClient = (data: any) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      };
      const sendUpstream = (obj: any) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(JSON.stringify(obj));
        }
      };

      upstream.on('open', () => {
        sendUpstream({ action: 'auth', params: MASSIVE_API_KEY });
        hb = setInterval(() => sendUpstream({ action: 'ping' }), 25_000);
      });

      upstream.on('message', (buf) => {
        const payload = buf.toString();
        let arr: any[] = [];
        try {
          arr = JSON.parse(payload);
        } catch {
          // ignore parse failures
        }
        if (Array.isArray(arr)) {
          for (const msg of arr) {
            if (msg?.ev === 'status' && msg?.status === 'auth_success') {
              authenticated = true;
              if (subscriptions.size) {
                sendUpstream({ action: 'subscribe', params: Array.from(subscriptions).join(',') });
              }
            }
          }
        }
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });

      upstream.on('close', () => {
        authenticated = false;
        if (!closed) client.close(4501, 'Upstream closed');
        if (hb) clearInterval(hb);
      });

      upstream.on('error', () => {
        if (!closed) client.close(4502, 'Upstream error');
      });

      client.on('message', (buf) => {
        try {
          const msg = JSON.parse(buf.toString());
          if (!authenticated && msg?.action !== 'ping') return;

          if (msg?.action === 'subscribe' && typeof msg?.params === 'string') {
            const incoming = msg.params.split(',').map((s: string) => s.trim()).filter(Boolean);
            for (const s of incoming) subscriptions.add(s);
            if (asset === 'options' && subscriptions.size > 1000) {
              sendClient({ ev: 'error', message: 'subscription limit exceeded (1000)' });
              return;
            }
            sendUpstream({ action: 'subscribe', params: Array.from(subscriptions).join(',') });
          } else if (msg?.action === 'unsubscribe' && typeof msg?.params === 'string') {
            const list = msg.params.split(',').map((s: string) => s.trim());
            for (const s of list) subscriptions.delete(s);
            sendUpstream({ action: 'unsubscribe', params: list.join(',') });
          } else if (msg?.action === 'ping') {
            sendUpstream({ action: 'ping' });
          }
        } catch {
          // ignore
        }
      });

      client.on('close', () => {
        closed = true;
        if (hb) clearInterval(hb);
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
          upstream.close();
        }
      });

      client.on('error', () => {
        closed = true;
        if (hb) clearInterval(hb);
        try { upstream.close(); } catch {}
      });
    } catch {
      client.close(1011, 'Proxy error');
    }
  });

  console.log(`✓ WS proxy ready at ${path} -> ${WS_BASE}/${asset}`);
}
