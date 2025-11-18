import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTradeStore } from '../../stores/tradeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Contract } from '../../types';
import { cn } from '../../lib/utils';

interface QuickOrderBarProps {
  symbol: string;
  currentPrice: number;
  selectedContract?: Contract | null;
  accountBalance?: number;
}

type RiskPercent = 0.5 | 1 | 2;
type RMultiple = 2 | 3 | 4;

export const QuickOrderBar: React.FC<QuickOrderBarProps> = ({
  symbol,
  currentPrice,
  selectedContract,
  accountBalance = 10000, // Default account size
}) => {
  const [riskPercent, setRiskPercent] = useState<RiskPercent>(1);
  const [rMultiple, setRMultiple] = useState<RMultiple>(3);
  const createTrade = useTradeStore((s) => s.createTrade);
  const challenges = useSettingsStore((s) => s.challenges);
  const activeChallenges = challenges.filter((c) => c.isActive);

  // Calculate position size based on risk
  const { contracts: contractQty, riskAmount } = useMemo(() => {
    const risk = accountBalance * (riskPercent / 100);
    
    if (!selectedContract || !selectedContract.mid || selectedContract.mid === 0) {
      return { contracts: 1, riskAmount: risk };
    }

    // Simple position sizing: risk / contract price
    // In reality, would factor in stop loss distance
    const qty = Math.max(1, Math.floor(risk / (selectedContract.mid * 100))); // Options are $100/contract
    
    return { contracts: qty, riskAmount: risk };
  }, [accountBalance, riskPercent, selectedContract]);

  // Calculate target and stop based on R-multiple
  const { targetPrice, stopPrice } = useMemo(() => {
    if (!selectedContract) {
      return { targetPrice: 0, stopPrice: 0 };
    }

    const entry = selectedContract.mid;
    const riskPerContract = entry * 0.15; // Assume 15% risk per contract
    const target = entry + (riskPerContract * rMultiple);
    const stop = entry - riskPerContract;

    return { targetPrice: target, stopPrice: stop };
  }, [selectedContract, rMultiple]);

  const handleEnterTrade = async (side: 'LONG' | 'SHORT') => {
    if (!selectedContract) {
      console.warn('[v0] QuickOrderBar: No contract selected');
      return;
    }

    console.log('[v0] QuickOrderBar: Entering trade', {
      side,
      contract: selectedContract,
      qty: contractQty,
      risk: riskPercent,
      rMultiple,
    });

    try {
      // Create trade with ENTERED state (skip LOADED)
      const userId = 'current-user'; // TODO: Get from auth context
      
      await createTrade(userId, {
        ticker: symbol,
        contract: selectedContract,
        state: 'ENTERED',
        entryPrice: selectedContract.mid,
        currentPrice: selectedContract.mid,
        targetPrice,
        stopLoss: stopPrice,
        entryTime: new Date(),
        tradeType: selectedContract.daysToExpiry < 5 ? 'Day' : 'Swing',
        challenges: activeChallenges.map((c) => c.id),
        discordChannels: [],
        updates: [],
      });

      console.log('[v0] QuickOrderBar: Trade created successfully');
      
      // TODO: Send Discord alert if configured
      // TODO: Flash success indicator
    } catch (error) {
      console.error('[v0] QuickOrderBar: Failed to create trade:', error);
      // TODO: Show error toast
    }
  };

  const isReady = Boolean(selectedContract && selectedContract.mid > 0);

  return (
    <div className="w-full border-t border-[var(--border-hairline)] bg-[var(--surface-2)] px-3 py-2 flex items-center gap-3">
      {/* Risk % Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Risk:</span>
        <div className="flex items-center rounded overflow-hidden border border-[var(--border-hairline)]">
          {[0.5, 1, 2].map((pct) => (
            <button
              key={pct}
              onClick={() => setRiskPercent(pct as RiskPercent)}
              className={cn(
                'px-2 py-1 text-xs font-medium transition-colors',
                riskPercent === pct
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--surface-3)] text-[var(--text-high)] hover:bg-[var(--surface-2)]'
              )}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* R-Multiple Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Target:</span>
        <div className="flex items-center rounded overflow-hidden border border-[var(--border-hairline)]">
          {[2, 3, 4].map((r) => (
            <button
              key={r}
              onClick={() => setRMultiple(r as RMultiple)}
              className={cn(
                'px-2 py-1 text-xs font-medium transition-colors',
                rMultiple === r
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--surface-3)] text-[var(--text-high)] hover:bg-[var(--surface-2)]'
              )}
            >
              {r}R
            </button>
          ))}
        </div>
      </div>

      {/* Contract Preview */}
      <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded bg-[var(--surface-1)] border border-[var(--border-hairline)]">
        {selectedContract ? (
          <>
            <span className="text-xs font-medium text-[var(--text-high)]">
              {selectedContract.strike}
              {selectedContract.type}
            </span>
            <span className="text-xs text-[var(--text-muted)]">×{contractQty}</span>
            <span className="text-xs text-[var(--text-muted)] ml-auto">
              Risk: ${riskAmount.toFixed(0)}
            </span>
          </>
        ) : (
          <span className="text-xs text-[var(--text-muted)] italic">
            Select a contract from chain above
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleEnterTrade('LONG')}
          disabled={!isReady}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all',
            'bg-[var(--accent-positive)] text-white',
            'hover:opacity-90 active:scale-95',
            !isReady && 'opacity-50 cursor-not-allowed'
          )}
        >
          <TrendingUp className="w-4 h-4" />
          ENTER LONG
        </button>
        <button
          onClick={() => handleEnterTrade('SHORT')}
          disabled={!isReady}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all',
            'bg-[var(--accent-negative)] text-white',
            'hover:opacity-90 active:scale-95',
            !isReady && 'opacity-50 cursor-not-allowed'
          )}
        >
          <TrendingDown className="w-4 h-4" />
          ENTER SHORT
        </button>
      </div>
    </div>
  );
};

export default QuickOrderBar;
