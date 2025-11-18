export type UnifiedQuote = {
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  asOf: number;
  source: string;
};

const PROXY_TOKEN = (import.meta as any).env?.VITE_MASSIVE_PROXY_TOKEN as string | undefined;

import { useEffect, useState, useRef } from 'react';

export async function fetchQuotes(symbols: string[]): Promise<UnifiedQuote[]> {
  const qs = new URLSearchParams({ tickers: symbols.join(',') }).toString();
  const headers: Record<string, string> = {};
  if (PROXY_TOKEN) headers['x-massive-proxy-token'] = PROXY_TOKEN;
  const resp = await fetch(`/api/quotes?${qs}`, { headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`[v0] /api/quotes failed ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return (data?.results ?? []) as UnifiedQuote[];
}

export function useUnifiedQuotes(symbols: string[], intervalMs = 3000) {
  // lightweight polling hook; streaming can be layered later if needed
  const [quotes, setQuotes] = useState<UnifiedQuote[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Guard: Don't fetch if no symbols provided
    if (!symbols || symbols.length === 0) {
      setQuotes([]);
      return;
    }

    let active = true;
    async function load() {
      try {
        const q = await fetchQuotes(symbols);
        if (active) setQuotes(q);
      } catch (e) {
        // swallow for now; UI can show stale indicator
        console.error('[v0] useUnifiedQuotes error', e);
      }
    }
    load();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(load, intervalMs) as unknown as number;
    return () => {
      active = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [JSON.stringify(symbols), intervalMs]);

  return quotes;
}
