"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { optionsAdvanced, type OptionsTrade } from '@/lib/massive/options-advanced';
import { cn } from '@/lib/utils';
import type { Contract } from '@/types';

type Row = {
  time: number;
  underlying: string;
  ticker: string;
  strike: number;
  cp: 'C' | 'P';
  contracts: number; // size
  premium: number; // price * size
  venue: number | string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
};

interface FlowPanelProps {
  symbol: string;
  contracts: Contract[] | null | undefined;
}

export default function FlowPanel({ symbol, contracts }: FlowPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  // Rolling baselines per contract (avg size over last 10 minutes)
  const tradeBucketsRef = useRef<Map<string, { trades: { ts: number; size: number; price: number }[]; lastPrice?: number }>>(new Map());

  const now = Date.now();
  const recentWindowMs = 10 * 60 * 1000;

  // Select a manageable set of contracts to subscribe when expanded: prefer top by open interest, otherwise first N
  const subscribeTickers = useMemo(() => {
    if (!contracts || contracts.length === 0) return [] as { ticker: string; strike: number; cp: 'C' | 'P' }[];
    const sorted = [...contracts].sort((a: any, b: any) => (b.oi ?? 0) - (a.oi ?? 0));
    const top = sorted.slice(0, 40);
    return top.map((c: any) => ({ ticker: c.ticker || c.id, strike: Number(c.strike) || 0, cp: (c.type || 'C') as 'C' | 'P' })).filter((t) => !!t.ticker);
  }, [contracts]);

  useEffect(() => {
    if (!expanded) return;
    if (!subscribeTickers.length) return;

    const unsubscribes: (() => void)[] = [];
    let mounted = true;

    const handleTradeFactory = (contractMeta: { ticker: string; strike: number; cp: 'C' | 'P' }) => (trade: OptionsTrade) => {
      if (!mounted) return;
      const key = contractMeta.ticker;
      const bucket = tradeBucketsRef.current.get(key) || { trades: [] as any[], lastPrice: undefined };

      // Push trade and prune old
      bucket.trades.push({ ts: trade.timestamp, size: trade.size, price: trade.price });
      const cutoff = Date.now() - recentWindowMs;
      bucket.trades = bucket.trades.filter((t) => t.ts >= cutoff);

      // Compute avg size baseline
      const sum = bucket.trades.reduce((acc, t) => acc + (t.size || 0), 0);
      const avg = bucket.trades.length > 0 ? sum / bucket.trades.length : 0;

      const lastPrice = bucket.lastPrice;
      bucket.lastPrice = trade.price;

      tradeBucketsRef.current.set(key, bucket);

      const threshold = avg > 0 ? avg * 5 : 100; // fallback threshold when avg unknown
      if (trade.size < threshold) return; // not significant

      // Sentiment heuristic
      let sentiment: Row['sentiment'] = 'neutral';
      if (typeof lastPrice === 'number') {
        if (trade.price > lastPrice) sentiment = 'bullish';
        else if (trade.price < lastPrice) sentiment = 'bearish';
      }

      const row: Row = {
        time: trade.timestamp,
        underlying: symbol,
        ticker: contractMeta.ticker,
        strike: contractMeta.strike,
        cp: contractMeta.cp,
        contracts: trade.size,
        premium: (trade.size || 0) * (trade.price || 0),
        venue: trade.exchange,
        sentiment,
      };

      setRows((prev) => {
        const next = [row, ...prev].filter((r) => r.time >= Date.now() - recentWindowMs).slice(0, 200);
        return next;
      });
    };

    for (const meta of subscribeTickers) {
      const unsub = optionsAdvanced.subscribeTrades(meta.ticker, handleTradeFactory(meta));
      unsubscribes.push(unsub);
    }

    return () => {
      mounted = false;
      unsubscribes.forEach((u) => u());
    };
  }, [expanded, subscribeTickers, recentWindowMs, symbol]);

  return (
    <div className="fixed right-4 bottom-20 z-40 w-[min(560px,92vw)]">
      <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] shadow">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-[var(--surface-2)] rounded-t-lg flex items-center justify-between"
        >
          <span className="font-medium">Flow · Last 10 min</span>
          <span className="text-zinc-400">{expanded ? '−' : '+'}</span>
        </button>

        {expanded && (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs text-zinc-300">
              <thead className="sticky top-0 bg-[var(--surface-2)] text-zinc-400">
                <tr>
                  <th className="px-3 py-1 font-normal text-left">Time</th>
                  <th className="px-3 py-1 font-normal text-left">Symbol</th>
                  <th className="px-3 py-1 font-normal text-right">Strike</th>
                  <th className="px-3 py-1 font-normal text-center">C/P</th>
                  <th className="px-3 py-1 font-normal text-right">Contracts</th>
                  <th className="px-3 py-1 font-normal text-right">Premium</th>
                  <th className="px-3 py-1 font-normal text-left">Venue</th>
                  <th className="px-3 py-1 font-normal text-left">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.ticker}-${r.time}-${idx}`} className="border-t border-[var(--border-hairline)]">
                    <td className="px-3 py-1 tabular-nums text-zinc-400">{new Date(r.time).toLocaleTimeString([], { hour12: false })}</td>
                    <td className="px-3 py-1">{r.underlying}</td>
                    <td className="px-3 py-1 tabular-nums text-right">{r.strike.toFixed(2)}</td>
                    <td className="px-3 py-1 text-center">{r.cp}</td>
                    <td className="px-3 py-1 tabular-nums text-right">{r.contracts}</td>
                    <td className="px-3 py-1 tabular-nums text-right">${(r.premium/1000).toFixed(1)}k</td>
                    <td className="px-3 py-1">{String(r.venue)}</td>
                    <td className={cn('px-3 py-1', r.sentiment === 'bullish' ? 'text-green-400' : r.sentiment === 'bearish' ? 'text-red-400' : 'text-zinc-400')}>{r.sentiment}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-zinc-500" colSpan={8}>No significant prints yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
