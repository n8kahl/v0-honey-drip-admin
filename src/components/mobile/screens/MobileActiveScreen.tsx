import { Trade } from "../../../types";
import { MobileActiveCard } from "../cards/MobileActiveCard";
import { Zap } from "lucide-react";

interface MobileActiveScreenProps {
  trades: Trade[];
  onTrim: (trade: Trade) => void;
  onUpdateSL: (trade: Trade) => void;
  onExit: (trade: Trade) => void;
}

export function MobileActiveScreen({
  trades,
  onTrim,
  onUpdateSL,
  onExit,
}: MobileActiveScreenProps) {
  if (trades.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-high)] mb-2">No Active Trades</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-[280px]">
          Enter a trade from the Watch tab to see it here. Active trades show real-time P&L.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-3">
        {trades.map((trade) => (
          <MobileActiveCard
            key={trade.id}
            trade={trade}
            onTrim={() => onTrim(trade)}
            onUpdateSL={() => onUpdateSL(trade)}
            onExit={() => onExit(trade)}
          />
        ))}
      </div>
    </div>
  );
}
