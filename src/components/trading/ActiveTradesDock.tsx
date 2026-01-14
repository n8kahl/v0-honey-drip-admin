import React, { useEffect, useRef, useState } from "react";
import { useTradeStore } from "../../stores/tradeStore";
import { useActiveTradesDockStore } from "../../stores/activeTradesDockStore";
import { Trade } from "../../types";
import { formatPrice, formatPercent, cn } from "../../lib/utils";
import { X } from "lucide-react";

// Utility: compute R-multiple ( (current - entry) / (entry - stop) )
function computeRMultiple(trade: Trade): number | null {
  if (!trade.entryPrice || !trade.stopLoss || trade.stopLoss === trade.entryPrice) return null;
  return (
    ((trade.currentPrice ?? trade.entryPrice) - trade.entryPrice) /
    (trade.entryPrice - trade.stopLoss)
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
}

const InlineSlider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  color,
}) => {
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] w-8">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn("flex-1 accent-[var(--brand-primary)]", color)}
      />
      <span className="text-[10px] tabular-nums text-[var(--text-high)] w-10 text-right">
        {formatPrice(value)}
      </span>
    </div>
  );
};

// Individual trade card
const DockTradeCard: React.FC<{
  trade: Trade;
  index: number;
  dragging: boolean;
  onReorderDrop: (index: number) => void;
}> = ({ trade, index, dragging, onReorderDrop }) => {
  const { updateTrade, deleteTrade } = useTradeStore();
  const { startDrag, updateDragPos, endDrag, draggingId, cards } = useActiveTradesDockStore();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isDragging = draggingId === trade.id;
  const rMultiple = computeRMultiple(trade);

  // Live P&L
  const entry = trade.entryPrice ?? 0;
  const current = trade.currentPrice ?? entry;
  const pnl = current - entry;
  const pnlPercent = entry ? (pnl / entry) * 100 : 0;
  const isProfit = pnl > 0;

  // Sliders: stop & target fallback
  const stop = trade.stopLoss ?? entry * 0.5;
  const target = trade.targetPrice ?? entry * 1.5;

  const handleStopChange = (v: number) => {
    updateTrade(trade.id, { stopLoss: v });
  };
  const handleTargetChange = (v: number) => {
    updateTrade(trade.id, { targetPrice: v });
  };

  // Drag Handlers (desktop)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    startDrag(trade.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateDragPos(trade.id, e.movementX, e.movementY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    endDrag(trade.id, index); // simplistic: drop where started
    onReorderDrop(index);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative rounded-md bg-[var(--surface-2)] border border-[var(--border-hairline)] p-2 flex flex-col gap-1 w-56 select-none",
        "transition-all duration-150 ease-out",
        "hover:scale-105 hover:shadow-lg",
        isProfit
          ? "border-l-2 border-l-green-500 hover:shadow-green-500/20"
          : "border-l-2 border-l-red-500 hover:shadow-red-500/20",
        isDragging ? "shadow-lg cursor-grabbing scale-105" : "cursor-grab"
      )}
      style={isDragging ? { opacity: 0.85 } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-[var(--text-high)]">
            {trade.ticker} {trade.contract?.strike}
            {trade.contract?.type}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium",
              isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
            )}
          >
            {isProfit ? "↑" : "↓"}
          </span>
        </div>
        <button
          onClick={() => deleteTrade(trade.id)}
          className="min-w-[32px] min-h-[32px] flex items-center justify-center opacity-60 hover:opacity-100 transition-all rounded hover:bg-[var(--surface-3)] touch-manipulation active:scale-95"
          title="Close trade"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {/* Prices */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--text-muted)]">Entry {formatPrice(entry)}</span>
        <span
          className={cn(
            isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {formatPrice(current)}
        </span>
      </div>
      {/* P&L */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            isProfit ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
          )}
        >
          {isProfit ? "+" : ""}
          {formatPrice(pnl)} ({isProfit ? "+" : ""}
          {formatPercent(pnlPercent)})
        </span>
        {rMultiple !== null && (
          <span className="text-[10px] text-[var(--text-muted)]">R: {rMultiple.toFixed(2)}</span>
        )}
      </div>
      {/* Sliders */}
      <div className="flex flex-col gap-1">
        <InlineSlider
          label="Stop"
          value={stop}
          min={Math.max(0, entry * 0.1)}
          max={entry * 0.99}
          onChange={handleStopChange}
        />
        <InlineSlider
          label="Target"
          value={target}
          min={entry * 1.01}
          max={entry * 3}
          onChange={handleTargetChange}
        />
      </div>
    </div>
  );
};

export const ActiveTradesDock: React.FC = () => {
  const activeTrades = useTradeStore((s) => s.activeTrades);
  const ensureCards = useActiveTradesDockStore((s) => s.ensureCards);
  const collapsedMobile = useActiveTradesDockStore((s) => s.collapsedMobile);
  const setCollapsedMobile = useActiveTradesDockStore((s) => s.setCollapsedMobile);
  const cards = useActiveTradesDockStore((s) => s.cards);
  const draggingId = useActiveTradesDockStore((s) => s.draggingId);

  // Sync cards with active trades
  useEffect(() => {
    ensureCards(activeTrades.map((t) => t.id));
  }, [activeTrades, ensureCards]);

  // Swipe detection (mobile)
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 30) setCollapsedMobile(false); // swipe up
    if (delta < -30) setCollapsedMobile(true); // swipe down
    touchStartY.current = null;
  };

  // Layout calculations
  const orderedTrades: Trade[] = cards
    .sort((a, b) => a.order - b.order)
    .map((c) => activeTrades.find((t) => t.id === c.id))
    .filter((t): t is Trade => !!t);

  const displayTrades = orderedTrades;

  // Desktop rows: max 2 rows, wrap then scroll
  // We'll use flex-wrap and a max-h with overflow-y auto for multi-row.

  return (
    <div
      className={cn(
        "fixed left-0 right-0 bottom-14 lg:bottom-0 z-40 bg-[var(--surface-1)] border-t border-[var(--border-hairline)]",
        "shadow-[0_-2px_6px_-2px_rgba(0,0,0,0.4)]",
        "backdrop-blur-sm"
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile collapsed header */}
      <div className="lg:hidden flex items-center gap-2 px-2 py-1 overflow-x-auto no-scrollbar">
        {collapsedMobile &&
          displayTrades.map((trade) => (
            <span
              key={trade.id}
              className="px-2 py-1 rounded-full bg-[var(--surface-2)] text-[10px] font-medium text-[var(--text-high)] border border-[var(--border-hairline)]"
            >
              {trade.ticker}
            </span>
          ))}
        {displayTrades.length === 0 && (
          <span className="text-[10px] text-[var(--text-muted)]">No active trades</span>
        )}
      </div>
      {/* Expanded content */}
      <div
        className={cn(
          "transition-all duration-200",
          collapsedMobile
            ? "max-h-0 lg:max-h-full overflow-hidden lg:overflow-visible"
            : "max-h-[240px] lg:max-h-[340px]"
        )}
      >
        <div className="px-2 pt-2 pb-2 flex flex-wrap gap-2 lg:max-h-[180px] lg:overflow-y-auto">
          {displayTrades.map((trade, i) => (
            <DockTradeCard
              key={trade.id}
              trade={trade}
              index={i}
              dragging={draggingId === trade.id}
              onReorderDrop={() => {}}
            />
          ))}
          {displayTrades.length === 0 && (
            <div className="text-[10px] text-[var(--text-muted)] px-2 py-1">No active trades</div>
          )}
        </div>
        {/* Drag hint */}
        <div className="hidden lg:flex items-center justify-end px-3 pb-1">
          <span className="text-[10px] text-[var(--text-muted)]">
            Drag cards to reorder • Adjust stop/target live
          </span>
        </div>
      </div>
      {/* Mobile expand chevron area */}
      <div
        className="lg:hidden flex items-center justify-center py-1"
        onClick={() => setCollapsedMobile(!collapsedMobile)}
      >
        <div className="w-8 h-1 rounded bg-[var(--surface-3)]" />
      </div>
    </div>
  );
};

export default ActiveTradesDock;
