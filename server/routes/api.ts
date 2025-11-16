import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { callMassive, getOptionChain, listOptionContracts, getIndicesSnapshot } from '../massiveClient';

const router = Router();
const MASSIVE_PROXY_TOKEN = process.env.MASSIVE_PROXY_TOKEN || '';
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || '';
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;

function requireProxyToken(req: Request, res: Response, next: NextFunction) {
  if (!MASSIVE_PROXY_TOKEN) {
    return res.status(500).json({ error: 'Server not configured: MASSIVE_PROXY_TOKEN' });
  }
  const token = req.header('x-massive-proxy-token');
  if (token !== MASSIVE_PROXY_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.post('/massive/ws-token', requireProxyToken, (_req, res) => {
  if (!MASSIVE_API_KEY) return res.status(500).json({ error: 'MASSIVE_API_KEY missing' });
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  const payload = JSON.stringify({ apiKey: MASSIVE_API_KEY, expiresAt });
  const signature = crypto.createHmac('sha256', MASSIVE_API_KEY).update(payload).digest('hex');
  const token = `${Buffer.from(payload).toString('base64')}.${signature}`;
  res.json({ token, expiresAt });
});

router.get('/massive/options/chain', requireProxyToken, async (req, res) => {
  try {
    const underlying = String(req.query.underlying || req.query.symbol || '');
    if (!underlying) return res.status(400).json({ error: 'underlying required' });
    const limitParam = Array.isArray(req.query.limit)
      ? req.query.limit[0]
      : String(req.query.limit || '');
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const limit = typeof parsedLimit === 'number' && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : undefined;
    const data = await getOptionChain(underlying, limit);
    res.json(data);
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const status =
      msg.includes('403') || msg.toLowerCase().includes('forbidden') ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? 'Massive 403: Forbidden' : 'Massive request failed',
      message: msg,
    });
  }
});

router.get('/massive/options/contracts', requireProxyToken, async (req, res) => {
  try {
    const data = await listOptionContracts(req.query as Record<string, string>);
    res.json(data);
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const status =
      msg.includes('403') || msg.toLowerCase().includes('forbidden') ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? 'Massive 403: Forbidden' : 'Massive request failed',
      message: msg,
    });
  }
});

router.get('/massive/indices', requireProxyToken, async (req, res) => {
  try {
    const tickers = String(req.query.tickers || '');
    if (!tickers) return res.status(400).json({ error: 'tickers required' });
    const data = await getIndicesSnapshot(tickers.split(','));
    res.json(data);
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const status =
      msg.includes('403') || msg.toLowerCase().includes('forbidden') ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? 'Massive 403: Forbidden' : 'Massive request failed',
      message: msg,
    });
  }
});

router.all('/massive/*', requireProxyToken, async (req, res) => {
  try {
    const subPath = ((req.params as any)[0] as string) || '';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const fullPath = `/${subPath}${qs}`;
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined;
    const response = await callMassive(fullPath, { method: req.method as any, body });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Massive ${response.status}: ${payload?.error || response.statusText}`);
    }
    res.json(payload);
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const status =
      msg.includes('403') || msg.toLowerCase().includes('forbidden') ? 403 : 502;

    res.status(status).json({
      error: status === 403 ? 'Massive 403: Forbidden' : 'Massive request failed',
      message: msg,
    });
  }
});

export default router;
