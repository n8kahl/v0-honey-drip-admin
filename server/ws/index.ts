import type { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { MassiveHub } from './hub';

const MASSIVE_PROXY_TOKEN = process.env.MASSIVE_PROXY_TOKEN;
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;

export function attachWsServers(server: Server) {
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

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', process.env.WEB_ORIGIN || 'http://localhost');
    const pathname = url.pathname;
    const token = url.searchParams.get('token');

    if (token !== MASSIVE_PROXY_TOKEN) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
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
