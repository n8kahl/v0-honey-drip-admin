import { Router } from 'express';
import * as massive from '../massiveClient';
import * as discord from '../discordClient';

const router = Router();
const MASSIVE_PROXY_TOKEN = process.env.MASSIVE_PROXY_TOKEN || '';

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Massive.com proxy routes
router.get('/massive/options/chain', async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol parameter required' });
    }
    
    const data = await massive.getOptionsChain(symbol);
    res.json(data);
  } catch (error: any) {
    console.error('[API] Options chain error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

router.get('/massive/options/quote', async (req, res) => {
  try {
    const { underlying, contractSymbol } = req.query;
    
    if (!underlying || typeof underlying !== 'string') {
      return res.status(400).json({ error: 'Underlying parameter required' });
    }
    
    const data = await massive.getOptionQuote({
      underlying: underlying as string,
      contractSymbol: contractSymbol as string | undefined,
    });
    res.json(data);
  } catch (error: any) {
    console.error('[API] Option quote error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

router.get('/massive/options/aggregates', async (req, res) => {
  try {
    const { symbol, interval, from, to } = req.query;
    
    if (!symbol || !interval || !from) {
      return res.status(400).json({ error: 'Symbol, interval, and from parameters required' });
    }
    
    if (interval !== '1s' && interval !== '1m') {
      return res.status(400).json({ error: 'Interval must be 1s or 1m' });
    }
    
    const data = await massive.getOptionsAggregates({
      symbol: symbol as string,
      interval: interval as '1s' | '1m',
      from: from as string,
      to: to as string | undefined,
    });
    res.json(data);
  } catch (error: any) {
    console.error('[API] Aggregates error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

router.get('/massive/options/indicators', async (req, res) => {
  try {
    const { symbol, indicator, timeframes } = req.query;
    
    if (!symbol || !indicator || !timeframes) {
      return res.status(400).json({ error: 'Symbol, indicator, and timeframes parameters required' });
    }
    
    const timeframeArray = typeof timeframes === 'string' 
      ? timeframes.split(',') 
      : [];
    
    const data = await massive.getIndicators({
      symbol: symbol as string,
      indicator: indicator as string,
      timeframes: timeframeArray,
    });
    res.json(data);
  } catch (error: any) {
    console.error('[API] Indicators error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

router.get('/massive/market-status', async (req, res) => {
  try {
    const data = await massive.getMarketStatus();
    res.json(data);
  } catch (error: any) {
    console.error('[API] Market status error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

router.get('/massive/quotes', async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({ error: 'Symbols parameter required' });
    }
    
    const symbolArray = symbols.split(',');
    const data = await massive.getQuotes(symbolArray);
    res.json(data);
  } catch (error: any) {
    console.error('[API] Quotes error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

router.get('/massive/indices', async (req, res) => {
  try {
    const { tickers } = req.query;
    
    if (!tickers || typeof tickers !== 'string') {
      return res.status(400).json({ error: 'Tickers parameter required' });
    }
    
    const tickerArray = tickers.split(',');
    const data = await massive.getIndicesSnapshot(tickerArray);
    res.json(data);
  } catch (error: any) {
    console.error('[API] Indices error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

// Discord webhook proxy
router.post('/discord/send', async (req, res) => {
  try {
    const { adminId, channelIds, message, embeds, shareCardUrl, tradeId, webhookUrls } = req.body;
    
    if (!message || !channelIds || !Array.isArray(channelIds)) {
      return res.status(400).json({ error: 'Message and channelIds array required' });
    }
    
    // Use provided webhook URLs or look them up
    let urls: string[] = webhookUrls || [];
    
    if (urls.length === 0 && adminId) {
      // Optional: lookup from Supabase
      urls = await discord.getWebhooksForChannels(adminId, channelIds);
    }
    
    if (urls.length === 0) {
      return res.status(400).json({ error: 'No webhook URLs provided or found' });
    }
    
    // Build Discord payload
    const payload: discord.DiscordAlertPayload = {
      content: message,
      embeds: embeds || [],
    };
    
    if (shareCardUrl) {
      payload.embeds = payload.embeds || [];
      payload.embeds.push({
        image: { url: shareCardUrl },
      });
    }
    
    // Send to all webhooks
    const results = await Promise.all(
      urls.map(async (url, index) => {
        const result = await discord.sendToWebhook(url, payload);
        return {
          channelId: channelIds[index] || `channel-${index}`,
          ...result,
        };
      })
    );
    
    const successCount = results.filter(r => r.ok).length;
    const success = successCount > 0;
    
    console.log(`[API] Discord send: ${successCount}/${results.length} successful`);
    
    res.json({
      success,
      results,
      tradeId,
    });
  } catch (error: any) {
    console.error('[API] Discord send error:', error);
    res.status(500).json({ error: 'Discord send failed', message: error.message });
  }
});

// Catch-all proxy for any other Massive endpoints
router.all('/massive/*', async (req, res) => {
  try {
    if (MASSIVE_PROXY_TOKEN) {
      const providedToken = req.header('x-massive-proxy-token');
      if (providedToken !== MASSIVE_PROXY_TOKEN) {
        return res.status(403).json({ error: 'Invalid Massive proxy token' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[API] MASSIVE_PROXY_TOKEN is not configured; proxy endpoint is wide open');
    }

    const path = req.path.replace('/massive', '');
    const queryString = new URLSearchParams(req.query as any).toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;
    
    const hasBody = req.body && Object.keys(req.body).length > 0;
    const data = await massive.callMassive(fullPath, {
      method: req.method,
      body: hasBody ? req.body : undefined,
    });
    
    res.json(data);
  } catch (error: any) {
    console.error('[API] Massive proxy error:', error);
    res.status(502).json({ error: 'Massive request failed', message: error.message });
  }
});

export default router;
