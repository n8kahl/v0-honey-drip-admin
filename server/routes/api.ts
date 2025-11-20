import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { massiveFetch, callMassive, getOptionChain, listOptionContracts, getIndicesSnapshot } from '../massive/client.js';
import { tradierGetUnderlyingPrice, tradierGetExpirations, tradierGetNormalizedForExpiration, tradierGetHistory } from '../vendors/tradier.js';
import { isV2AggsPath, rememberFailure, shouldShortCircuit, buildEmptyAggsResponse } from '../lib/fallbackAggs.js';
import { normalizeSymbolForMassive } from '../lib/symbolUtils.js';
import { cachedFetch, getCachedBars, setCachedBars, getCachedContracts, setCachedContracts, getCachedSnapshot, setCachedSnapshot, getCachedIndex, setCachedIndex } from '../lib/cache.js';
import { calculateDTE, getMarketStatus } from '../lib/marketCalendar.js';

const router = Router();
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;

// Lazy-loaded environment variable (read at runtime after dotenv loads)
function getMassiveApiKey(): string {
  return process.env.MASSIVE_API_KEY || '';
}

/**
 * Validate ephemeral token (signed with MASSIVE_API_KEY)
 * Same validation logic as WebSocket server
 */
function requireProxyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-massive-proxy-token');

  if (!token) {
    return res.status(403).json({ error: 'Forbidden: Missing token' });
  }

  try {
    const MASSIVE_API_KEY = getMassiveApiKey();
    if (!MASSIVE_API_KEY) {
      return res.status(500).json({ error: 'Server not configured: MASSIVE_API_KEY' });
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return res.status(403).json({ error: 'Forbidden: Invalid token format' });
    }

    const payloadB64 = parts[0];
    const sig = parts[1];
    const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf-8');
    const obj = JSON.parse(payloadJson) as { exp?: number; n?: string };

    if (!obj?.exp || typeof obj.exp !== 'number') {
      return res.status(403).json({ error: 'Forbidden: Invalid token payload' });
    }

    if (Date.now() > obj.exp) {
      return res.status(403).json({ error: 'Forbidden: Token expired' });
    }

    const expected = crypto.createHmac('sha256', MASSIVE_API_KEY).update(payloadJson).digest('hex');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');

    if (a.byteLength !== b.byteLength || !crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b))) {
      return res.status(403).json({ error: 'Forbidden: Invalid signature' });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Token validation failed' });
  }
}

function handleMassiveError(res: Response, error: any) {
  const msg = String(error?.message || error || '');
  const lower = msg.toLowerCase();
  const statusCode = error?.status || 502;
  const status =
    statusCode === 403 || lower.includes('403') || lower.includes('forbidden') ? 403 : 502;
  res.status(status).json({
    error: status === 403 ? 'Massive 403: Forbidden' : 'Massive request failed',
    message: msg,
  });
}

type BarsQuery = {
  symbol?: string;
  ticker?: string;
  multiplier?: string;
  timespan?: string;
  from?: string;
  to?: string;
  limit?: string;
  adjusted?: string;
  sort?: string;
};

function ensureParams(required: string[], query: Record<string, string | undefined>) {
  const missing = required.filter((key) => !query[key]);
  return missing;
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Market status endpoint
router.get('/market/status', (_req, res) => {
  const status = getMarketStatus();
  res.json({
    ...status,
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
// Note: Actual metrics data is tracked client-side via the MonitoringDashboard component
// which has real-time access to the MetricsService singleton. This endpoint indicates
// that metrics monitoring is active. The MonitoringDashboard polls metrics every 5 seconds.
router.get('/metrics', (_req, res) => {
  res.json({
    status: 'ok',
    monitoring: true,
    message: 'Production metrics are tracked client-side via MonitoringDashboard',
    metricsTracked: [
      'Provider Health (Massive/Tradier uptime, response times)',
      'Greeks Quality (validation rates, bounds checking)',
      'P&L Accuracy (gross vs net P&L, cost impact)',
      'System Health (API times, errors, WebSocket status)',
    ],
    updateFrequency: '5 seconds',
    timestamp: new Date().toISOString(),
  });
});

// Backwards-compatible token mint (requires proxy token header). Deprecated: do not include apiKey in payload.
router.post('/massive/ws-token', requireProxyToken, (_req, res) => {
  const MASSIVE_API_KEY = getMassiveApiKey();
  if (!MASSIVE_API_KEY) return res.status(500).json({ error: 'MASSIVE_API_KEY missing' });
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const payloadObj = { exp, n: crypto.randomBytes(16).toString('hex') };
  const payload = JSON.stringify(payloadObj);
  const sig = crypto.createHmac('sha256', MASSIVE_API_KEY).update(payload).digest('hex');
  const token = `${Buffer.from(payload).toString('base64')}.${sig}`;
  res.json({ token, expiresAt: exp });
});

// Public ephemeral token route for client WS auth (no long-lived secret in browser)
router.post('/ws-token', (_req, res) => {
  const MASSIVE_API_KEY = getMassiveApiKey();
  if (!MASSIVE_API_KEY) return res.status(500).json({ error: 'MASSIVE_API_KEY missing' });
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const payloadObj = { exp, n: crypto.randomBytes(16).toString('hex') };
  const payload = JSON.stringify(payloadObj);
  const sig = crypto.createHmac('sha256', MASSIVE_API_KEY).update(payload).digest('hex');
  const token = `${Buffer.from(payload).toString('base64')}.${sig}`;
  res.json({ token, expiresAt: exp });
});

// Removed /massive/stocks/bars endpoint: application operates solely on indices and options.

router.get('/massive/indices/bars', requireProxyToken, async (req, res) => {
  const { symbol, multiplier, timespan, from, to, limit = '250', adjusted = 'true', sort = 'asc' } =
    req.query as BarsQuery;

  const missing = ensureParams(['symbol', 'multiplier', 'timespan', 'from', 'to'], req.query as Record<string, string>);
  if (missing.length) {
    return res.status(400).json({ error: `Missing query params: ${missing.join(', ')}` });
  }

  try {
    const path = `/v2/aggs/ticker/${encodeURIComponent(symbol!)}`
      + `/range/${multiplier}/${timespan}/${from}/${to}`
      + `?adjusted=${adjusted}&sort=${sort}&limit=${limit}`;
    const json = await massiveFetch(path);
    res.json(json);
  } catch (error) {
    handleMassiveError(res, error);
  }
});

router.get('/massive/options/bars', requireProxyToken, async (req, res) => {
  const { ticker, multiplier, timespan, from, to, limit = '5000', adjusted = 'true', sort = 'asc' } =
    req.query as BarsQuery;

  const missing = ensureParams(['ticker', 'multiplier', 'timespan', 'from', 'to'], req.query as Record<string, string>);
  if (missing.length) {
    return res.status(400).json({ error: `Missing query params: ${missing.join(', ')}` });
  }

  try {
    const path = `/v2/aggs/ticker/${encodeURIComponent(ticker!)}`
      + `/range/${multiplier}/${timespan}/${from}/${to}`
      + `?adjusted=${adjusted}&sort=${sort}&limit=${limit}`;
    const json = await massiveFetch(path);
    res.json(json);
  } catch (error) {
    handleMassiveError(res, error);
  }
});

// Tradier stock bars endpoint - fallback for stocks when user doesn't have Massive stocks plan
router.get('/massive/tradier/stocks/bars', requireProxyToken, async (req, res) => {
  const { symbol, interval = '5min', start, end } = req.query as {
    symbol?: string;
    interval?: '1min' | '5min' | '15min' | 'daily' | 'weekly' | 'monthly';
    start?: string;
    end?: string;
  };

  if (!symbol) {
    return res.status(400).json({ error: 'Missing query param: symbol' });
  }

  try {
    console.log(`[Tradier] Fetching ${symbol} bars: interval=${interval}, start=${start}, end=${end}`);
    const bars = await tradierGetHistory(symbol, interval, start, end);
    console.log(`[Tradier] ✅ Received ${bars.length} bars for ${symbol}`);
    // Return in Massive-compatible format
    res.json({ results: bars.map(bar => ({ t: bar.time * 1000, o: bar.open, h: bar.high, l: bar.low, c: bar.close, v: bar.volume })) });
  } catch (error: any) {
    console.error('[Tradier] ❌ Stock bars error for', symbol, ':', error.message || error);
    res.status(502).json({ error: error?.message || 'Tradier API error' });
  }
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
    
    // Extract filter parameters (e.g., ?strike_price.gte=400&expiration_date.lte=...)
    const filters = extractFilterParams(req.query);
    
    const data = await getOptionChain(underlying, limit, filters);
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

// Helper to extract filter parameters (.gte, .lte, etc.)
function extractFilterParams(query: Record<string, any>): Record<string, any> {
  const filters: Record<string, any> = {};
  
  Object.entries(query).forEach(([key, value]) => {
    if (key.includes('.') && !['limit', 'underlying', 'symbol'].includes(key.split('.')[0])) {
      filters[key] = value;  // Preserve .gte, .lte etc.
    }
  });
  
  return filters;
}

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

// Unified, normalized options chain for UI consumption
// GET /api/options/chain?symbol=SPX&window=10
router.get('/options/chain', requireProxyToken, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || req.query.underlying || '').toUpperCase();
    console.log(`[v0] 🔥 /api/options/chain called for ${symbol} (unified endpoint)`);
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    // Provider: 'massive' | 'tradier'
    // Priority: query.provider > env OPTIONS_PROVIDER > presence of TRADIER_ACCESS_TOKEN
    let provider = String((req.query as any).provider || '').toLowerCase();
    if (!provider) {
      const envProvider = String(process.env.OPTIONS_PROVIDER || '').toLowerCase();
      if (envProvider === 'massive' || envProvider === 'tradier') provider = envProvider;
      else if (process.env.TRADIER_ACCESS_TOKEN) provider = 'tradier';
      else provider = 'massive';
    }
    // window = optional number of expirations to include (Webull-like)
    const windowParam = Array.isArray(req.query.window) ? req.query.window[0] : (req.query.window ? String(req.query.window) : undefined);
    const expWindow = typeof windowParam !== 'undefined' ? Math.max(1, Math.min(250, Number(windowParam) || 0)) : undefined;
    // strikeWindow controls strikes per side around ATM
    const strikeWindowParam = Array.isArray((req.query as any).strikeWindow)
      ? (req.query as any).strikeWindow[0]
      : String((req.query as any).strikeWindow || '10');
    const perSide = Math.max(1, Math.min(25, Number(strikeWindowParam) || 10));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // 1) Resolve underlying price and expirations window
    let price = 0;

    // 2) Build target expirations list out to ~1 year, limited by expWindow
    // endDate = optional upper bound for expirations (YYYY-MM-DD). If omitted, include all available.
    const endDateParam = Array.isArray((req.query as any).endDate)
      ? (req.query as any).endDate[0]
      : String((req.query as any).endDate || '');
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(endDateParam) ? endDateParam : undefined;

    // Provider branch: Tradier vs Massive (default)
    const useTradier = provider === 'tradier';
    let expirations: string[] = [];
    if (useTradier) {
      try {
        price = await tradierGetUnderlyingPrice(symbol);
      } catch (e) {
        console.warn('[v0] Tradier underlying price failed; defaulting to 0', e);
        price = 0;
      }
      expirations = await tradierGetExpirations(symbol, todayStr, endDate);
      if (typeof expWindow === 'number' && expWindow > 0) expirations = expirations.slice(0, expWindow);
      console.log(`[v0] Tradier ${symbol} expirations: ${expirations.length}`);
    } else {
      const indexLike = ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol) || symbol.startsWith('I:');
      if (indexLike) {
        const snap = await getIndicesSnapshot([symbol.replace(/^I:/, '')]);
        const v = Array.isArray(snap?.results) ? snap.results[0]?.value : snap?.value;
        price = typeof v === 'number' ? v : 0;
      } else {
        const optSnap = await getOptionChain(symbol.replace(/^I:/, ''), 1);
        const u = optSnap?.results?.[0]?.underlying_asset?.price;
        price = typeof u === 'number' ? u : 0;
      }
      console.log(`[v0] ${symbol} underlying price: $${price.toFixed(2)}`);

      // Prefer reference contracts for a complete expiration calendar
      try {
        const params: any = {
          underlying_ticker: symbol.replace(/^I:/, ''),
          'expiration_date.gte': todayStr,
          limit: '1000',
        };
        if (endDate) params['expiration_date.lte'] = endDate;
        const ref = await listOptionContracts(params as any);
        const refResults: any[] = Array.isArray(ref?.results) ? ref.results : [];
        const expSet = new Set<string>(
          refResults.map((c: any) => c.expiration_date || c.details?.expiration_date).filter(Boolean)
        );
        expirations = Array.from(expSet).sort();
      } catch (err) {
        console.warn(`[v0] reference contracts failed, falling back to snapshot expirations:`, err);
        // Fallback: take expirations from a single snapshot page
        const contractsSnap = await getOptionChain(symbol.replace(/^I:/, ''), 250);
        const contractsList = Array.isArray(contractsSnap?.results) ? contractsSnap.results : [];
        const expSet = new Set<string>(
          contractsList.map((c: any) => c.details?.expiration_date || c.expiration_date).filter(Boolean)
        );
        expirations = Array.from(expSet).sort();
      }

      // Trim to endDate and optional expWindow
      if (endDate) expirations = expirations.filter((date) => date <= endDate);
      if (typeof expWindow === 'number' && expWindow > 0) {
        expirations = expirations.slice(0, expWindow);
      }
      console.log(`[v0] ${symbol} selected expirations: ${expirations.length}${endDate ? ` (endDate=${endDate}` : ''}${expWindow ? `${endDate ? ',' : ' ('} window=${expWindow}` : ''}${endDate || expWindow ? ')' : ''}`, expirations.slice(0, 10));
    }

    // 4) Normalize and group by expiration
    // Greeks & Mid-Price Policy:
    // - Greeks sourced from options snapshot (greeks.delta/gamma/theta/vega)
    // - Mid-price: prefer NBBO mid ((bid+ask)/2) when both available
    // - Fallback: last_trade.p, then single-side quote (ap or bp)
    // - IV from snapshot implied_volatility
    type Norm = {
      id: string;
      ticker: string;
      type: 'C' | 'P';
      strike: number;
      expiration: string;
      dte: number;
      iv?: number;
      delta?: number;
      gamma?: number;
      theta?: number;
      vega?: number;
      bid?: number;
      ask?: number;
      last?: number;
      oi?: number;
    };

    // 3) Fetch contract pages per expiration and normalize
    let normalized: Norm[] = [];
    if (useTradier) {
      for (const date of expirations) {
        const norms = await tradierGetNormalizedForExpiration(symbol, date, today);
        normalized.push(...(norms as any as Norm[]));
      }
    } else {
      const pages: any[] = [];
      for (const date of expirations) {
        const snap = await getOptionChain(symbol.replace(/^I:/, ''), 250, { expiration_date: date });
        const arr = Array.isArray(snap?.results) ? snap.results : [];
        pages.push(...arr);
      }

      normalized = pages.map((c: any) => {
      // Snapshot data structure: c has details, greeks, last_quote, last_trade, etc.
      const details = c.details || {};
      const ticker = details.ticker || c.ticker;
      const expiration = details.expiration_date || c.expiration_date;
      const strike = details.strike_price || c.strike_price;
      const contractType = details.contract_type || c.contract_type || c.type || '';
      
      const exp = new Date(expiration);
      // Use market calendar for accurate DTE (trading days, not calendar days)
      const dte = calculateDTE(exp, today);
      const side = contractType.toString().toUpperCase().startsWith('C') ? 'C' : 'P';
      
      // Greeks from snapshot
      const greeks = c.greeks || {};
      
      // Price sourcing with NBBO mid preference
      const bid = c.last_quote?.bid || c.last_quote?.bp;
      const ask = c.last_quote?.ask || c.last_quote?.ap;
      const last = (c.last_trade?.price || c.last_trade?.p) ?? (bid && ask ? undefined : (ask ?? bid));
      
      return {
        id: ticker,
        ticker: ticker,
        type: side,
        strike: Number(strike) || 0,
        expiration: expiration,
        dte,
        iv: c.implied_volatility,
        delta: greeks?.delta,
        gamma: greeks?.gamma,
        theta: greeks?.theta,
        vega: greeks?.vega,
        bid,
        ask,
        last,
        oi: c.open_interest,
      } as Norm;
      }).filter((n: Norm) => Number.isFinite(n.strike) && n.strike > 0);
    }

    const byExp = new Map<string, Norm[]>();
    for (const n of normalized) {
      const arr = byExp.get(n.expiration) || [];
      arr.push(n);
      byExp.set(n.expiration, arr);
    }

    function windowAroundATM(items: Norm[], atm: number, side: 'C' | 'P') {
      const sameSide = items.filter((i) => i.type === side).sort((a, b) => a.strike - b.strike);
      if (sameSide.length === 0) return [] as Norm[];
      
      // Find the strike closest to ATM
      let atmIdx = 0;
      let bestDiff = Math.abs(sameSide[0].strike - atm);
      for (let i = 1; i < sameSide.length; i++) {
        const d = Math.abs(sameSide[i].strike - atm);
        if (d < bestDiff) {
          bestDiff = d;
          atmIdx = i;
        }
      }
      
      // Return exactly perSide ITM + ATM + perSide OTM (total: 2*perSide + 1)
      // For calls: ITM is below ATM (lower strikes), OTM is above (higher strikes)
      // For puts: ITM is above ATM (higher strikes), OTM is below (lower strikes)
      // Since we're sorting ascending, we just take perSide on each side of ATM
      const start = Math.max(0, atmIdx - perSide);
      const end = Math.min(sameSide.length, atmIdx + perSide + 1);
      
      const result = sameSide.slice(start, end);
      console.log(`[v0] windowAroundATM ${side}: total=${sameSide.length}, atmIdx=${atmIdx}, atmStrike=${sameSide[atmIdx].strike}, window=[${start},${end}), returned=${result.length}`);
      
      return result;
    }

    const allExpirations = Array.from(byExp.keys()).sort();
    const payload = expirations.map((date) => {
      const items = byExp.get(date)!;
      // ATM is closest strike among all items
      let atmStrike = items[0].strike;
      let minD = Math.abs(items[0].strike - price);
      for (let i = 1; i < items.length; i++) {
        const d = Math.abs(items[i].strike - price);
        if (d < minD) {
          minD = d;
          atmStrike = items[i].strike;
        }
      }
      return {
        date,
        dte: Math.max(0, Math.ceil((new Date(date).getTime() - today.getTime()) / 86_400_000)),
        atmStrike,
        calls: windowAroundATM(items, atmStrike, 'C'),
        puts: windowAroundATM(items, atmStrike, 'P'),
      };
    });

    res.json({
      symbol,
      price,
      asOf: new Date().toISOString(),
      expirations: payload,
    });
  } catch (error) {
    handleMassiveError(res, error);
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

// Unified bars endpoint (stocks/indices/options) -> normalized shape for UI
// GET /api/bars?symbol=SPY&timespan=minute&multiplier=1&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500
router.get('/bars', requireProxyToken, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').toUpperCase();
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    
    const timespan = String(req.query.timespan || 'minute');
    const multiplier = String(req.query.multiplier || '1');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const limit = String(req.query.limit || '500');
    const adjusted = String(req.query.adjusted || 'true');
    const sort = String(req.query.sort || 'asc');

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD)' });
    }

    // Normalize symbol for Massive API
    const massiveSymbol = normalizeSymbolForMassive(symbol);

    const path = `/v2/aggs/ticker/${encodeURIComponent(massiveSymbol)}`
      + `/range/${multiplier}/${timespan}/${from}/${to}`
      + `?adjusted=${adjusted}&sort=${sort}&limit=${limit}`;
    
    // Use cache with 5-second TTL
    const cacheKey = `bars:${symbol}:${timespan}:${multiplier}:${from}:${to}:${limit}`;
    const data = await cachedFetch(
      cacheKey,
      () => massiveFetch(path),
      getCachedBars,
      setCachedBars
    ) as any;
    
    // Normalize response shape
    const results = Array.isArray(data?.results) ? data.results : [];
    const normalized = results.map((bar: any) => ({
      timestamp: bar.t || 0, // epoch ms
      open: Number(bar.o) || 0,
      high: Number(bar.h) || 0,
      low: Number(bar.l) || 0,
      close: Number(bar.c) || 0,
      volume: Number(bar.v) || 0,
      vwap: bar.vw ? Number(bar.vw) : undefined,
      trades: bar.n ? Number(bar.n) : undefined,
    }));

    res.json({
      symbol,
      timespan,
      multiplier: Number(multiplier),
      from,
      to,
      adjusted: adjusted === 'true',
      count: normalized.length,
      bars: normalized,
    });
  } catch (error) {
    handleMassiveError(res, error);
  }
});

// Unified quotes endpoint (stocks + indices) -> normalized shape for UI
// GET /api/quotes?tickers=SPY,SPX,NDX
router.get('/quotes', requireProxyToken, async (req, res) => {
  try {
    const tickersParam = String(req.query.tickers || '');
    if (!tickersParam) return res.status(400).json({ error: 'tickers required' });
    const symbols = tickersParam.split(',').map((s) => s.trim()).filter(Boolean);

    // Partition into index-like and stock-like
    const isIndexLike = (s: string) => s.startsWith('I:') || ['SPX','NDX','VIX','RUT'].includes(s);
    const indexSymbols = symbols.filter(isIndexLike).map((s) => s.replace(/^I:/, ''));
    const stockSymbols = symbols.filter((s) => !isIndexLike(s));

    const results: Array<{ symbol: string; last: number; change: number; changePercent: number; asOf: number; source: string }>
      = [];

    // Fetch indices snapshot (with caching)
    if (indexSymbols.length) {
      const cacheKey = `indices:${indexSymbols.sort().join(',')}`;
      const idxSnap = await cachedFetch(
        cacheKey,
        () => getIndicesSnapshot(indexSymbols),
        getCachedIndex,
        setCachedIndex
      );
      const items: any[] = Array.isArray(idxSnap?.results) ? idxSnap.results : [];
      for (const it of items) {
        const symbol = it.ticker || it.symbol || '';
        results.push({
          symbol: symbol,
          last: Number(it.value) || 0,
          change: Number(it.session?.change || 0),
          changePercent: Number(it.session?.change_percent || 0),
          asOf: Date.now(),
          source: 'indices',
        });
      }
    }

    // Fetch stocks via batch ticker snapshot (optimized to reduce N+1 queries)
    if (stockSymbols.length) {
      try {
        // Batch fetch all stock symbols in a single request
        const tickersParam = stockSymbols.join(',');
        const path = `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickersParam)}`;
        const snap = await callMassive<any>(path);

        if (snap.ok) {
          const tickers = (snap.data as any)?.tickers || [];

          // Create a map for quick lookup
          const tickerMap = new Map();
          for (const ticker of tickers) {
            const last = Number(
              ticker?.day?.c ??
              ticker?.lastTrade?.p ??
              ticker?.lastQuote?.ap ??
              ticker?.lastQuote?.bp ??
              0
            );
            const prevClose = Number(ticker?.prevDay?.c ?? 0);
            const change = prevClose > 0 ? last - prevClose : 0;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

            tickerMap.set(ticker.ticker, {
              symbol: ticker.ticker,
              last,
              change,
              changePercent,
              asOf: Date.now(),
              source: 'stocks-snapshot',
            });
          }

          // Add results for all requested symbols
          for (const s of stockSymbols) {
            if (tickerMap.has(s)) {
              results.push(tickerMap.get(s));
            } else {
              console.log(`[v0] /api/quotes ${s}: not found in batch response, trying fallback`);

              // Fallback to individual options snapshot for missing symbols
              try {
                const fallbackPath = `/v3/snapshot/options/${encodeURIComponent(s)}?limit=1`;
                const fallbackSnap = await callMassive<any>(fallbackPath);
                if (fallbackSnap.ok) {
                  const r = (fallbackSnap.data as any)?.results?.[0];
                  const underlying = r?.underlying_asset || {};
                  const last = Number(
                    underlying?.price ??
                    r?.last_trade?.p ??
                    r?.last_quote?.ap ??
                    r?.last_quote?.bp ??
                    0
                  );

                  results.push({
                    symbol: s,
                    last,
                    change: 0,
                    changePercent: 0,
                    asOf: Date.now(),
                    source: 'options-snapshot',
                  });
                } else {
                  results.push({ symbol: s, last: 0, change: 0, changePercent: 0, asOf: Date.now(), source: 'error' });
                }
              } catch (fallbackErr) {
                console.error(`[v0] /api/quotes ${s}: fallback error`, fallbackErr);
                results.push({ symbol: s, last: 0, change: 0, changePercent: 0, asOf: Date.now(), source: 'error' });
              }
            }
          }
        } else {
          console.log(`[v0] /api/quotes: batch snapshot !ok, falling back to individual requests`);

          // Fallback to individual requests if batch fails
          for (const s of stockSymbols) {
            try {
              const path = `/v3/snapshot/options/${encodeURIComponent(s)}?limit=1`;
              const snap = await callMassive<any>(path);
              if (snap.ok) {
                const r = (snap.data as any)?.results?.[0];
                const underlying = r?.underlying_asset || {};
                const last = Number(
                  underlying?.price ??
                  r?.last_trade?.p ??
                  r?.last_quote?.ap ??
                  r?.last_quote?.bp ??
                  0
                );

                results.push({
                  symbol: s,
                  last,
                  change: 0,
                  changePercent: 0,
                  asOf: Date.now(),
                  source: 'options-snapshot',
                });
              } else {
                results.push({ symbol: s, last: 0, change: 0, changePercent: 0, asOf: Date.now(), source: 'error' });
              }
            } catch (err) {
              console.error(`[v0] /api/quotes ${s}: error`, err);
              results.push({ symbol: s, last: 0, change: 0, changePercent: 0, asOf: Date.now(), source: 'error' });
            }
          }
        }
      } catch (err) {
        console.error(`[v0] /api/quotes: batch fetch error`, err);

        // Add error results for all stock symbols
        for (const s of stockSymbols) {
          results.push({ symbol: s, last: 0, change: 0, changePercent: 0, asOf: Date.now(), source: 'error' });
        }
      }
    }

    // Ensure every requested symbol returns something (even zeros)
    const map = new Map(results.map((r) => [r.symbol.replace(/^I:/,''), r]));
    const final = symbols.map((s) => {
      const key = s.replace(/^I:/,'');
      return map.get(key) || { symbol: s, last: 0, change: 0, changePercent: 0, asOf: Date.now(), source: 'none' };
    });

    res.json({ results: final });
  } catch (e) {
    handleMassiveError(res, e);
  }
});

router.all('/massive/*', requireProxyToken, async (req, res) => {
  const subPath = ((req.params as any)[0] as string) || '';
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const fullPath = `/${subPath}${qs}`;
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined;

  try {
    // Test-mode short-circuit for Massive endpoints
    if (process.env.TEST_FAKE_DATA === 'true') {
      // Minimal fake data for options snapshots and contracts to support E2E
      const url = new URL(`http://localhost${fullPath}`);
      const pathname = url.pathname;
      const params = url.searchParams;

      // Helper: build a synthetic options contracts list across a date range
      const buildContracts = (underlying: string, spot: number, range?: { gte?: string | null; lte?: string | null }) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = (() => {
          const s = range?.gte ? new Date(range.gte) : new Date(today);
          s.setHours(0, 0, 0, 0);
          return isNaN(s.getTime()) ? new Date(today) : s;
        })();
        const end = (() => {
          if (range?.lte) {
            const e = new Date(range.lte);
            e.setHours(0, 0, 0, 0);
            if (!isNaN(e.getTime())) return e;
          }
          const e = new Date(today);
          e.setFullYear(e.getFullYear() + 3); // up to ~3 years out for dev
          e.setHours(0, 0, 0, 0);
          return e;
        })();

        const exps: Date[] = [];

        // Weekly expirations from start for 26 weeks
        for (let w = 1; w <= 26; w++) {
          const exp = new Date(start);
          exp.setDate(exp.getDate() + 7 * w);
          if (exp <= end) exps.push(exp);
        }

        // Monthly expirations (third Friday) from start month through end month (cap at 48 months)
        const startMonth = new Date(start);
        startMonth.setDate(1);
        const endMonth = new Date(end);
        endMonth.setDate(1);
        const totalMonths = Math.min(48, (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + (endMonth.getMonth() - startMonth.getMonth()));
        for (let m = 0; m <= totalMonths; m++) {
          const exp = new Date(startMonth);
          exp.setMonth(startMonth.getMonth() + m);
          exp.setDate(1);
          const firstDay = exp.getDay();
          const firstFriday = firstDay <= 5 ? 6 - firstDay : 13 - firstDay;
          exp.setDate(firstFriday + 14); // Third Friday
          if (exp >= start && exp <= end) exps.push(exp);
        }
        
        const strikes: number[] = [];
        const step = underlying === 'SPX' || underlying === 'I:SPX' ? 5 : 2;
        for (let s = Math.floor(spot) - 20; s <= Math.ceil(spot) + 20; s += step) strikes.push(s);

        const results: any[] = [];
        for (const exp of exps) {
          const expStr = exp.toISOString().slice(0, 10);
          for (const strike of strikes) {
            // Calls and puts
            ['call', 'put'].forEach((ct) => {
              results.push({
                ticker: `${underlying}-${strike}-${expStr}-${ct[0].toUpperCase()}`,
                underlying_ticker: underlying,
                expiration_date: expStr,
                contract_type: ct,
                strike_price: strike,
              });
            });
          }
        }
        return { results };
      };

      // /v3/snapshot/options/:underlying
      if (/^\/v3\/snapshot\/options\//.test(pathname)) {
        const underlying = decodeURIComponent(pathname.split('/').pop() || 'QQQ').replace(/^I:/, '');
        const price = underlying.toUpperCase() === 'SPX' ? 5000 : underlying.toUpperCase() === 'QQQ' ? 400 : 300;
        const limit = Number(params.get('limit') || '1');
        const base = {
          results: [
            {
              underlying_asset: { price },
              last_quote: { bp: price - 0.5, ap: price + 0.5 },
              last_trade: { p: price },
              greeks: { delta: 0.5, gamma: 0.01, theta: -0.02, vega: 0.1 },
              implied_volatility: 0.25,
              open_interest: 1000,
            },
          ],
        } as any;
        if (limit > 1) {
          // Return a few fabricated option snapshots referencing synthetic tickers
          const today = new Date();
          const expParam = params.get('expiration_date');
          const exp = expParam ? new Date(String(expParam)) : new Date(today);
          if (!expParam) exp.setDate(exp.getDate() + 5);
          const expStr = exp.toISOString().slice(0, 10);
          const snaps: any[] = [];
          for (let k = -4; k <= 4; k++) {
            const strike = Math.round(price + k * 2);
            ['C', 'P'].forEach((side) => {
              snaps.push({
                ticker: `${underlying}-${strike}-${expStr}-${side}`,
                last_quote: { bp: 1 + Math.max(0, -k) * 0.1, ap: 1.2 + Math.max(0, k) * 0.1 },
                last_trade: { p: 1.1 },
                greeks: { delta: side === 'C' ? 0.4 : -0.4, gamma: 0.01, theta: -0.02, vega: 0.1 },
                implied_volatility: 0.25,
                open_interest: 500 + (5 - Math.abs(k)) * 10,
                details: {
                  expiration_date: expStr,
                  strike_price: strike,
                  contract_type: side === 'C' ? 'call' : 'put',
                },
              });
            });
          }
          return res.json({ results: snaps });
        }
        return res.json(base);
      }

      // /v3/reference/options/contracts?underlying_ticker=...
      if (pathname === '/v3/reference/options/contracts') {
        const underlying = String(params.get('underlying_ticker') || params.get('underlying') || 'QQQ').toUpperCase();
        const spot = underlying === 'SPX' ? 5000 : underlying === 'QQQ' ? 400 : 300;
        const gte = params.get('expiration_date.gte') || '';
        const lte = params.get('expiration_date.lte') || '';
        return res.json(buildContracts(underlying, spot, { gte, lte }));
      }
    }

    // Short-circuit noisy v2 aggs failures for a brief window
    if (req.method === 'GET' && isV2AggsPath(fullPath) && shouldShortCircuit(fullPath)) {
      console.log(`[v0] fallback(short-circuit) ${fullPath}`);
      res.setHeader('x-v0-fallback', 'aggs-empty-cache');
      return res.status(200).json(buildEmptyAggsResponse());
    }

    const massiveResponse = await callMassive<{ error?: string; [key: string]: any }>(fullPath, {
      method: req.method as any,
      body,
    });

    if (!massiveResponse.ok) {
      // If this is a v2 aggs path, serve graceful empty payload and remember failure
      if (req.method === 'GET' && isV2AggsPath(fullPath)) {
        rememberFailure(fullPath);
        console.warn(`[v0] fallback(aggs-empty) ${fullPath} -> Massive ${massiveResponse.status}`);
        res.setHeader('x-v0-fallback', 'aggs-empty');
        return res.status(200).json(buildEmptyAggsResponse());
      }

      throw new Error(
        `Massive ${massiveResponse.status}: ${massiveResponse.error ?? 'Massive request failed'}`
      );
    }

    res.json(massiveResponse.data);
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const lower = msg.toLowerCase();

    // On network/5xx errors for v2 aggs, provide graceful empty response
    if (req.method === 'GET' && isV2AggsPath(fullPath) && !lower.includes('403')) {
      rememberFailure(fullPath);
      console.warn(`[v0] fallback(aggs-empty-catch) ${fullPath} -> ${msg}`);
      res.setHeader('x-v0-fallback', 'aggs-empty-catch');
      return res.status(200).json(buildEmptyAggsResponse());
    }

    const status = lower.includes('403') || lower.includes('forbidden') ? 403 : 502;
    res.status(status).json({
      error: status === 403 ? 'Massive 403: Forbidden' : 'Massive request failed',
      message: msg,
    });
  }
});

// ===== Strategy Scanner Routes =====
// NOTE: Scanner runs client-side via hooks, server endpoint moved to future iteration
// import strategiesRouter from './strategies';
// router.use('/strategies', strategiesRouter);

export default router;
