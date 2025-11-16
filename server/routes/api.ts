import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { callMassive, getOptionChain, listOptionContracts, getIndicesSnapshot } from '../massiveClient';

const router = Router();
const MASSIVE_PROXY_TOKEN = process.env.MASSIVE_PROXY_TOKEN || '';

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

router.get('/massive/options/chain', requireProxyToken, async (req, res) => {
  try {
    const underlying = String(req.query.underlying || req.query.symbol || '');
    if (!underlying) return res.status(400).json({ error: 'underlying required' });
    const data = await getOptionChain(underlying, req.query as Record<string, string>);
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'Massive request failed', message: e.message });
  }
});

router.get('/massive/options/contracts', requireProxyToken, async (req, res) => {
  try {
    const data = await listOptionContracts(req.query as Record<string, string>);
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'Massive request failed', message: e.message });
  }
});

router.get('/massive/indices', requireProxyToken, async (req, res) => {
  try {
    const tickers = String(req.query.tickers || '');
    if (!tickers) return res.status(400).json({ error: 'tickers required' });
    const data = await getIndicesSnapshot(tickers.split(','));
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'Massive request failed', message: e.message });
  }
});

router.all('/massive/*', requireProxyToken, async (req, res) => {
  try {
    const subPath = ((req.params as any)[0] as string) || '';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const fullPath = `/${subPath}${qs}`;
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined;
    const data = await callMassive(fullPath, { method: req.method as any, body });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'Massive request failed', message: e.message });
  }
});

export default router;
