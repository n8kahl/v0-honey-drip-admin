import { useState, useEffect } from 'react';
import { optionsAdvanced } from '../lib/massive/options-advanced';
import type { TradeTape } from '../lib/massive/options-advanced';

interface TradeFlowSignal {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  buyPressure: number; // 0-100
  largeTradeCount: number;
  timestamp: number;
}

// Trade buffer for aggregation
const tradeBuffer = new Map<string, any[]>();
const BUFFER_FLUSH_MS = 500; // Aggregate trades every 500ms

/**
 * Hook to track trade flow sentiment for a given symbol
 * Subscribes to real-time option trades and computes bullish/bearish signals
 */
export function useTradeFlow(symbol: string): TradeFlowSignal | null {
  const [signal, setSignal] = useState<TradeFlowSignal | null>(null);

  useEffect(() => {
    if (!symbol) return;

    let flushTimer: any = null;
    let isActive = true;

    const handleTrade = (trade: any) => {
      if (!isActive) return;

      // Buffer trades for aggregation
      if (!tradeBuffer.has(symbol)) {
        tradeBuffer.set(symbol, []);
      }
      tradeBuffer.get(symbol)!.push(trade);

      // Schedule flush if not already scheduled
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          if (!isActive) return;

          const trades = tradeBuffer.get(symbol) || [];
          if (trades.length === 0) return;

          // Compute trade tape sentiment from buffered trades
          const tape = analyzeTradeTape(trades);

          setSignal({
            symbol,
            sentiment: tape.sentiment,
            buyPressure: tape.buyPressure,
            largeTradeCount: tape.largeTradeCount,
            timestamp: Date.now(),
          });

          // Clear buffer
          tradeBuffer.set(symbol, []);
          flushTimer = null;
        }, BUFFER_FLUSH_MS);
      }
    };

    // Subscribe to trades
    const unsubscribe = optionsAdvanced.subscribeTrades(symbol, handleTrade);

    return () => {
      isActive = false;
      if (flushTimer) clearTimeout(flushTimer);
      unsubscribe();
    };
  }, [symbol]);

  return signal;
}

/**
 * Analyze trade tape to determine sentiment
 * Similar to analyzeTradeTape in options-advanced.ts but optimized for streaming
 */
function analyzeTradeTape(trades: any[]): TradeTape {
  if (!trades.length) {
    return {
      sentiment: 'neutral',
      buyVolume: 0,
      sellVolume: 0,
      largeTradeCount: 0,
      vwap: 0,
      buyPressure: 0,
    };
  }

  let buyVolume = 0;
  let sellVolume = 0;
  let largeTradeCount = 0;
  let prevPrice = trades[0].price;

  for (const t of trades) {
    const size = t.size || 0;
    const isAggressiveBuy = t.conditions?.includes(37) || (t.price > prevPrice && prevPrice > 0);
    const isAggressiveSell = !isAggressiveBuy && t.price < prevPrice;

    if (isAggressiveBuy) buyVolume += size;
    if (isAggressiveSell) sellVolume += size;
    if (size >= 100) largeTradeCount += 1;

    prevPrice = t.price;
  }

  const totalVolume = buyVolume + sellVolume || 1;
  const buyPressure = (buyVolume / totalVolume) * 100;

  let sentiment: TradeTape['sentiment'] = 'neutral';
  if (buyVolume > sellVolume * 1.2) sentiment = 'bullish';
  else if (sellVolume > buyVolume * 1.2) sentiment = 'bearish';

  return {
    sentiment,
    buyVolume,
    sellVolume,
    largeTradeCount,
    vwap: 0, // Not needed for signals
    buyPressure,
  };
}

