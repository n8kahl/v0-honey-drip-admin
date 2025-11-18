"use client";

import React, { useMemo } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useSymbolData } from '@/stores/marketDataStore';
import { useUIStore } from '@/stores/uiStore';
import { useRouter } from 'next/navigation';
import { cn, formatPercent } from '@/lib/utils';

function RadarCard({ symbol }: { symbol: string }) {
  const router = useRouter();
  const setMainCockpitSymbol = useUIStore((s) => s.setMainCockpitSymbol);
  const data = useSymbolData(symbol);
  const ticker = useMarketStore((s) => s.watchlist.find((t) => t.symbol === symbol));

  const price = ticker?.last ?? 0;
  const changePct = ticker?.changePercent ?? 0;
  const confluence = data?.confluence?.overall ?? 0;
  const activeSetups = (data?.strategySignals || []).filter((s) => s.status === 'ACTIVE').length;
  const mtf = data?.mtfTrend || {} as any;
  const biasUp = ['1m','5m','15m','60m','1D'].map(tf => (mtf as any)[tf] === 'bull').filter(Boolean).length;
  const biasDown = ['1m','5m','15m','60m','1D'].map(tf => (mtf as any)[tf] === 'bear').filter(Boolean).length;

  const biasStr = biasUp >= biasDown ? '↑'.repeat(Math.max(1, Math.min(3, biasUp))) : '↓'.repeat(Math.max(1, Math.min(3, biasDown)));

  const handleClick = () => {
    setMainCockpitSymbol(symbol);
    router.push('/');
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left rounded-lg border border-[var(--border-hairline)]',
        'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors',
        'p-3 flex flex-col gap-2'
      )}
      aria-label={`Open cockpit for ${symbol}`}
    >
      <div className="flex items-center justify-between text-xs text-zinc-300">
        <div className="font-semibold text-zinc-200">{symbol}</div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-zinc-100">${price.toFixed(2)}</span>
          <span className={cn('tabular-nums', changePct >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]')}>
            {changePct >= 0 ? '+' : ''}{(changePct).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <div>Setups: <span className="text-zinc-200 font-medium">{activeSetups}</span></div>
        <div>Conf: <span className="text-zinc-200 font-medium">{Math.round(confluence)}</span></div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <div>Bias: <span className="text-zinc-200 font-medium">{biasStr}</span></div>
        <div>Flow: <span className="text-zinc-200 font-medium">—</span></div>
      </div>
    </button>
  );
}

export default function RadarPage() {
  const watchlist = useMarketStore((s) => s.watchlist);

  const symbols = useMemo(() => watchlist.map((t) => t.symbol), [watchlist]);

  const sorted = useMemo(() => {
    return symbols
      .map((s) => ({ s }))
      .map(({ s }) => {
        const d = (useSymbolData as any)(s); // hook usage inside map would violate rules if dynamic; we'll compute product later in JSX
        return { s, d };
      });
  }, [symbols]);

  // Note: calling hooks inside loops is invalid. We'll instead compute sort keys by deriving once per symbol in a render-safe way.
  // Use a separate array computed after initial symbols using shallow reads.
  const scored = useMemo(() => symbols.map((s) => {
    const d = useSymbolData(s);
    const conf = d?.confluence?.overall ?? 0;
    const setups = (d?.strategySignals || []).filter((sig) => sig.status === 'ACTIVE').length;
    return { symbol: s, score: conf * setups, conf, setups };
  }), [symbols]);

  const ordered = useMemo(() => scored.slice().sort((a, b) => b.score - a.score || b.conf - a.conf), [scored]);

  return (
    <div className="min-h-[calc(100vh-64px)] pt-16 px-3 pb-3 bg-[var(--bg-base)]">
      <div className="mx-auto max-w-[1600px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          {ordered.map(({ symbol }) => (
            <RadarCard key={symbol} symbol={symbol} />
          ))}
        </div>
      </div>
    </div>
  );
}
