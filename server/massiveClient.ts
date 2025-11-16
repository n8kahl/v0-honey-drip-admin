import fetch from 'node-fetch';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY || '';
const MASSIVE_BASE_URL = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';

interface MassiveRequestOptions {
  method?: string;
  body?: any;
  timeout?: number;
}

export async function callMassive(path: string, options: MassiveRequestOptions = {}) {
  const { method = 'GET', body, timeout = 30000 } = options;
  
  if (!MASSIVE_API_KEY) {
    throw new Error('MASSIVE_API_KEY not configured');
  }

  const url = `${MASSIVE_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`[Massive] ${method} ${path}`);
    
    const normalizedMethod = method.toUpperCase();
    const hasBody = normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD';
    const response = await fetch(url, {
      method: normalizedMethod,
      headers: {
        'Authorization': `Bearer ${MASSIVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: hasBody && body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Massive] Error ${response.status}:`, errorText);
      throw new Error(`Massive API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[Massive] Request failed:', error.message);
    throw error;
  }
}

export async function getOptionsChain(symbol: string) {
  return callMassive(`/v3/reference/options/contracts?underlying_ticker=${symbol}&limit=1000`);
}

export async function getOptionQuote(params: { underlying: string; contractSymbol?: string }) {
  const { underlying, contractSymbol } = params;
  if (contractSymbol) {
    return callMassive(`/v3/snapshot/options/${contractSymbol}`);
  }
  return callMassive(`/v3/snapshot/options/${underlying}?limit=1`);
}

export async function getOptionsAggregates(params: { 
  symbol: string; 
  interval: '1s' | '1m'; 
  from: string; 
  to?: string 
}) {
  const { symbol, interval, from, to } = params;
  const multiplier = interval === '1s' ? 1 : 1;
  const timespan = interval === '1s' ? 'second' : 'minute';
  const toParam = to || new Date().toISOString().split('T')[0];
  
  return callMassive(`/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${toParam}`);
}

export async function getIndicators(params: { 
  symbol: string; 
  indicator: string; 
  timeframes: string[] 
}) {
  const { symbol, indicator, timeframes } = params;
  const timeframeQuery = timeframes.join(',');
  
  return callMassive(`/v1/indicators/${indicator}/${symbol}?timeframe=${timeframeQuery}`);
}

export async function getMarketStatus() {
  return callMassive('/v1/marketstatus/now');
}

export async function getQuotes(symbols: string[]) {
  const quoteRequests = symbols.map(async (symbol) => {
    try {
      const isIndex = symbol.startsWith('I:') || ['SPX', 'NDX', 'VIX', 'RUT'].includes(symbol);

      if (isIndex) {
        const cleanTicker = symbol.replace('I:', '');
        const data = await callMassive(`/v3/snapshot/indices?tickers=${cleanTicker}`);
        return data;
      }

      const data = await callMassive(`/v3/snapshot/options/${symbol}?limit=1`);
      return data;
    } catch (error: any) {
      console.error(`[Massive] Failed to get quote for ${symbol}:`, error);
      return { error: `Failed to fetch ${symbol}` };
    }
  });

  return Promise.all(quoteRequests);
}

export async function getIndicesSnapshot(tickers: string[]) {
  const cleanTickers = tickers.map(t => t.replace('I:', '')).join(',');
  return callMassive(`/v3/snapshot/indices?tickers=${cleanTickers}`);
}
