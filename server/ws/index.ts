import type { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { MassiveHub } from './hub';

export function attachWsServers(server: Server) {
  // Read environment variables at runtime (after dotenv has loaded)
  const MASSIVE_PROXY_TOKEN = process.env.MASSIVE_PROXY_TOKEN;
  const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;

  if (!MASSIVE_PROXY_TOKEN) {
    console.error('[WS hub] MASSIVE_PROXY_TOKEN not configured — upgrades will be rejected');
  }
  if (!MASSIVE_API_KEY) {
    console.error('[WS hub] MASSIVE_API_KEY not configured — upstream auth will fail');
  }
  const wssOptions = new WebSocketServer({ noServer: true });
  const wssIndices = new WebSocketServer({ noServer: true });

  const optionsHub = new MassiveHub({
    upstreamUrl: 'wss://socket.massive.com/options',
    apiKey: MASSIVE_API_KEY ?? '',
    asset: 'options',
    logPrefix: '[WS options]',
  });

  const indicesHub = new MassiveHub({
    upstreamUrl: 'wss://socket.massive.com/indices',
    apiKey: MASSIVE_API_KEY ?? '',
    asset: 'indices',
    logPrefix: '[WS indices]',
  });

  function verifyEphemeralToken(token: string | null | undefined): boolean {
    if (!token) return false;
    try {
      const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY ?? '';
      if (!MASSIVE_API_KEY) return false;
      const parts = token.split('.');
      if (parts.length !== 2) return false;
      const payloadB64 = parts[0];
      const sig = parts[1];
      const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf-8');
      const obj = JSON.parse(payloadJson) as { exp?: number; n?: string };
      if (!obj?.exp || typeof obj.exp !== 'number') return false;
      if (Date.now() > obj.exp) return false;
      const expected = crypto.createHmac('sha256', MASSIVE_API_KEY).update(payloadJson).digest('hex');
      const a = Buffer.from(sig, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.byteLength !== b.byteLength) return false;
      return crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
    } catch {
      return false;
    }
  }

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', process.env.WEB_ORIGIN || 'http://localhost');
    const pathname = url.pathname;
    const token = url.searchParams.get('token');

    const allow =
      (MASSIVE_PROXY_TOKEN && token === MASSIVE_PROXY_TOKEN) ||
      verifyEphemeralToken(token);

    if (!allow) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    if (MASSIVE_PROXY_TOKEN && token === MASSIVE_PROXY_TOKEN) {
      console.warn('[WS hub] Deprecated static token used for WS auth; switch client to /api/ws-token');
    }

    if (pathname === '/ws/options') {
      wssOptions.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wssOptions.emit('connection', ws, req);
        optionsHub.attachClient(ws);
      });
    } else if (pathname === '/ws/indices') {
      wssIndices.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wssIndices.emit('connection', ws, req);
        indicesHub.attachClient(ws);
      });
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });
}
