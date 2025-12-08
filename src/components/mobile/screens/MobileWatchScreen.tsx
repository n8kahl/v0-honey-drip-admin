import { Trade, Ticker } from "../../../types";
import { MobileLoadedCard } from "../cards/MobileLoadedCard";
import { MobileWatchlistCard } from "../cards/MobileWatchlistCard";
import { Eye, Plus } from "lucide-react";
import { useUIStore } from "../../../stores";

interface MobileWatchScreenProps {
  watchlist: Ticker[];
  loadedTrades: Trade[];
  onEnter: (trade: Trade) => void;
  onDismiss: (trade: Trade) => void;
  onLoad: (ticker: Ticker) => void;
}

export function MobileWatchScreen({
  watchlist,
  loadedTrades,
  onEnter,
  onDismiss,
  onLoad,
}: MobileWatchScreenProps) {
  const setShowAddTickerDialog = useUIStore((s) => s.setShowAddTickerDialog);

  const hasContent = loadedTrades.length > 0 || watchlist.length > 0;

  if (!hasContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-2">Watchlist Empty</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-[280px] mb-6">
          Add tickers to your watchlist to quickly load trades.
        </p>
        <button
          onClick={() => setShowAddTickerDialog(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-primary)] text-black font-semibold min-h-[48px]"
        >
          <Plus className="w-5 h-5" />
          Add Ticker
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Loaded Trades Section */}
      {loadedTrades.length > 0 && (
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
              Loaded
            </span>
            <span className="text-xs text-[var(--text-muted)]">({loadedTrades.length})</span>
          </div>
          <div className="space-y-2">
            {loadedTrades.map((trade) => (
              <MobileLoadedCard
                key={trade.id}
                trade={trade}
                onEnter={() => onEnter(trade)}
                onDismiss={() => onDismiss(trade)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Watchlist Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Watchlist
            </span>
            <span className="text-xs text-[var(--text-muted)]">({watchlist.length})</span>
          </div>
          <button
            onClick={() => setShowAddTickerDialog(true)}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="space-y-2">
          {watchlist.map((ticker) => (
            <MobileWatchlistCard key={ticker.id} ticker={ticker} onLoad={() => onLoad(ticker)} />
          ))}
        </div>
      </div>
    </div>
  );
}
