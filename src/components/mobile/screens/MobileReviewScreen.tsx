import { useState } from "react";
import { Trade } from "../../../types";
import { MobileExitedCard } from "../cards/MobileExitedCard";
import { MobileTradeDetailSheet } from "../sheets/MobileTradeDetailSheet";
import { History } from "lucide-react";

interface MobileReviewScreenProps {
  trades: Trade[];
  onShare: (trade: Trade) => void;
}

export function MobileReviewScreen({ trades, onShare }: MobileReviewScreenProps) {
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null);
  // Sort by exit time, most recent first
  const sortedTrades = [...trades].sort((a, b) => {
    const aTime = a.exitTime ? new Date(a.exitTime).getTime() : 0;
    const bTime = b.exitTime ? new Date(b.exitTime).getTime() : 0;
    return bTime - aTime;
  });

  // Separate today's trades from older
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysTrades = sortedTrades.filter((t) => {
    const exitTime = t.exitTime ? new Date(t.exitTime) : null;
    return exitTime && exitTime >= today;
  });

  const olderTrades = sortedTrades.filter((t) => {
    const exitTime = t.exitTime ? new Date(t.exitTime) : null;
    return !exitTime || exitTime < today;
  });

  if (trades.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <History className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-2">No Closed Trades</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-[280px]">
          Your closed trades will appear here. Share your wins to Discord!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Today's trades */}
      {todaysTrades.length > 0 && (
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
              Today
            </span>
            <span className="text-xs text-[var(--text-muted)]">({todaysTrades.length})</span>
          </div>
          <div className="space-y-2">
            {todaysTrades.map((trade) => (
              <MobileExitedCard
                key={trade.id}
                trade={trade}
                onShare={() => onShare(trade)}
                onTap={() => setDetailTrade(trade)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Older trades */}
      {olderTrades.length > 0 && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Earlier
            </span>
            <span className="text-xs text-[var(--text-muted)]">({olderTrades.length})</span>
          </div>
          <div className="space-y-2">
            {olderTrades.map((trade) => (
              <MobileExitedCard
                key={trade.id}
                trade={trade}
                onShare={() => onShare(trade)}
                onTap={() => setDetailTrade(trade)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trade Detail Drawer (desktop pattern) */}
      <MobileTradeDetailSheet
        open={!!detailTrade}
        onOpenChange={(open) => !open && setDetailTrade(null)}
        trade={detailTrade}
      />
    </div>
  );
}
