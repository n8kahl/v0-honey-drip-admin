import React, { useEffect, useState, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { useEnrichedMarketSession, useCandles } from '../../stores/marketDataStore';
import { cn } from '../../lib/utils';

interface ChartReplayControlsProps {
  symbol: string;
  timeframe?: '1m' | '5m';
  onReplayBarChange?: (bar: any) => void; // callback with selected bar
}

export const ChartReplayControls: React.FC<ChartReplayControlsProps> = ({ symbol, timeframe = '1m', onReplayBarChange }) => {
  const session = useEnrichedMarketSession();
  const candles = useCandles(symbol, timeframe) || [];
  const [index, setIndex] = useState<number>(candles.length - 1);
  const [playing, setPlaying] = useState(false);
  
  const isClosed = session && !session.isOpen;
  
  useEffect(() => {
    // Reset index when candles update
    setIndex(candles.length - 1);
  }, [candles.length]);
  
  useEffect(() => {
    if (!isClosed) return;
    if (index >= 0 && index < candles.length) {
      onReplayBarChange?.(candles[index]);
    }
  }, [index, isClosed, candles, onReplayBarChange]);
  
  useEffect(() => {
    if (!playing || !isClosed) return;
    const timer = setInterval(() => {
      setIndex(prev => {
        if (prev >= candles.length - 1) return 0; // loop
        return prev + 1;
      });
    }, 750);
    return () => clearInterval(timer);
  }, [playing, isClosed, candles.length]);
  
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIndex(Number(e.target.value));
    setPlaying(false);
  };
  
  if (!isClosed) return null;
  if (candles.length === 0) return null;
  
  const current = candles[index];
  const ts = current?.time ? new Date(current.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  
  return (
    <div className="flex flex-col gap-2 p-2 bg-[var(--surface-2)] border border-[var(--border-hairline)] rounded-md">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-muted)] font-medium">Replay Mode • {symbol} • {ts}</span>
        <button
          onClick={() => setPlaying(p => !p)}
          className={cn('w-7 h-7 flex items-center justify-center rounded-md bg-[var(--surface-3)] hover:bg-[var(--surface-4)] transition-colors')}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
        >
          {playing ? <Pause className="w-4 h-4 text-[var(--text-high)]" /> : <Play className="w-4 h-4 text-[var(--text-high)]" />}
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={candles.length - 1}
        value={index}
        onChange={handleSlider}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
        <span>Start</span>
        <span>End</span>
      </div>
    </div>
  );
};
