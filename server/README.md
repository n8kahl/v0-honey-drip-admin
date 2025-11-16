# HoneyDrip Admin Server

Express backend for the Vite SPA that keeps Massive.com and Discord integrations secure.

## Environment Variables

**Required**
- `MASSIVE_API_KEY` – Your Massive.com API key (server-side only)
- `MASSIVE_PROXY_TOKEN` – Shared secret required by `/api/massive/*` routes and WebSocket proxies
- `NODE_ENV` – Typically `production` in deployment
- `PORT` – Server port (Railway expects `8080`, `NODE_ENV=production` uses that by default)

**Optional**
- `MASSIVE_BASE_URL` – Override the default `https://api.massive.com`
- `DISCORD_WEBHOOK_SECRET` – Used when sending alerts via Discord

## Development

```bash
pnpm install
pnpm run dev          # Vite dev server + tsx-watched Express server
pnpm run build        # Vite build + tsc (output in server/dist)
pnpm run start        # Production server (uses server/dist/index.js)
```

## API Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/health` | Basic uptime/health check |
| `POST` | `/api/massive/ws-token` | Returns an ephemeral Massive WS token (requires `x-massive-proxy-token` header) |
| `GET` | `/api/massive/options/chain` | Option chain snapshot (requires token header) |
| `GET` | `/api/massive/options/contracts` | Option contract reference (requires token header) |
| `GET` | `/api/massive/indices` | Snapshot for indices tickers (requires token header) |
| `ANY` | `/api/massive/*` | Generic Massive REST proxy (requires token header) |

## WebSocket Proxies

The server exposes `wss://<host>/ws/options` and `/ws/indices`. Each path:

1. Rejects connections without the `token` query parameter matching `MASSIVE_PROXY_TOKEN`
2. Authenticates to Massive with `MASSIVE_API_KEY` before subscribing
3. Mirrors subscribe/unsubscribe/ping flows between the client and Massive sockets

Use the client-side helper to call `/api/massive/ws-token`, then connect to `/ws/options?token=...`.

## Railway Deployment

Railway will detect the Node.js project and run:

1. `pnpm install --frozen-lockfile`
2. `pnpm run build`
3. `pnpm run start`

Make sure `PORT=8080` is set in the Railway environment, otherwise Railway's health checks see a refusal.

## Security

- API keys stay on the server and are never bundled into the Vite build
- Rate limiting and helmet harden critical API routes
- WebSocket proxies require the same shared `MASSIVE_PROXY_TOKEN` as the REST proxy
