// Secure server proxy for Massive API
// Keeps API key server-side and provides ephemeral tokens for WebSocket auth
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_API_BASE = 'https://api.massive.com';

if (!MASSIVE_API_KEY) {
  throw new Error('[Massive Proxy] MASSIVE_API_KEY is not set');
}

const ephemeralTokens = new Map<string, { expiresAt: number; realKey: string }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of ephemeralTokens.entries()) {
    if (data.expiresAt < now) {
      ephemeralTokens.delete(token);
    }
  }
}, 60000);

app.post('/api/massive/ws-token', (_req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000;
  ephemeralTokens.set(token, { expiresAt, realKey: MASSIVE_API_KEY });
  res.json({ token });
});

app.all('/api/massive/*', async (req, res) => {
  const upstreamPath = req.originalUrl.replace(/^\/api\/massive/, '');
  const upstreamUrl = `${MASSIVE_API_BASE}${upstreamPath}`;
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body =
    hasBody && req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : undefined;

  try {
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${MASSIVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error: any) {
    console.error('[Massive Proxy] Error:', error);
    res.status(502).json({
      error: 'Massive request failed',
      message: error?.message ?? String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Massive Proxy] Server running on http://localhost:${PORT}`);
});
