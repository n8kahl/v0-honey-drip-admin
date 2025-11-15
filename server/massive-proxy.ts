// Secure server proxy for Massive API
// Keeps API key server-side and provides ephemeral tokens for WebSocket auth
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Server-side API key - NEVER exposed to client
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || '';
const MASSIVE_API_BASE = 'https://api.massive.com';

if (!MASSIVE_API_KEY) {
  console.error('[Massive Proxy] WARNING: MASSIVE_API_KEY not configured!');
  console.error('[Massive Proxy] Set MASSIVE_API_KEY in your .env.local or environment');
}

// Store ephemeral tokens with expiry
const ephemeralTokens = new Map<string, { expiresAt: number; realKey: string }>();

// Clean up expired tokens every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of ephemeralTokens.entries()) {
    if (data.expiresAt < now) {
      ephemeralTokens.delete(token);
    }
  }
}, 60000);

// Generate short-lived ephemeral token for WebSocket auth
app.post('/api/massive/ws-token', (req, res) => {
  if (!MASSIVE_API_KEY) {
    return res.status(500).json({ error: 'Server not configured with MASSIVE_API_KEY' });
  }

  // Generate random token valid for 5 minutes
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (5 * 60 * 1000);
  
  ephemeralTokens.set(token, { expiresAt, realKey: MASSIVE_API_KEY });
  
  console.log('[Massive Proxy] Generated ephemeral WS token, expires in 5 minutes');
  res.json({ token });
});

// Proxy all Massive API REST requests
app.all('/api/massive/*', async (req, res) => {
  if (!MASSIVE_API_KEY) {
    return res.status(500).json({ error: 'Server not configured with MASSIVE_API_KEY' });
  }

  try {
    // Remove /api/massive prefix to get the actual API path
    const apiPath = req.path.replace('/api/massive', '');
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const url = `${MASSIVE_API_BASE}${apiPath}${queryString}`;
    
    console.log('[Massive Proxy]', req.method, apiPath);

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${MASSIVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[Massive Proxy] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Massive Proxy] Server running on http://localhost:${PORT}`);
  console.log(`[Massive Proxy] API Key configured: ${MASSIVE_API_KEY ? 'Yes' : 'No'}`);
  if (!MASSIVE_API_KEY) {
    console.log(`[Massive Proxy] Please set MASSIVE_API_KEY environment variable`);
  }
});
