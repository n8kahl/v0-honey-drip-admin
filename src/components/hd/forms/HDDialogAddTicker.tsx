import { useState } from 'react';
import { Ticker } from '../../../types';
import { AppSheet } from '../../../ui/AppSheet';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { HDButton } from '../common/HDButton';

interface HDDialogAddTickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTicker: (ticker: Ticker) => void;
}

export function HDDialogAddTicker({
  open,
  onOpenChange,
  onAddTicker,
}: HDDialogAddTickerProps) {
  const [symbol, setSymbol] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!symbol.trim()) return;

    const newTicker: Ticker = {
      id: `ticker-${Date.now()}`,
      symbol: symbol.trim().toUpperCase(),
      last: 0, // Default to 0, will be updated by live data
      change: 0,
      changePercent: 0,
    };

    onAddTicker(newTicker);
    setSymbol('');
    onOpenChange(false);
  };

  return (
    <AppSheet 
      open={open} 
      onOpenChange={onOpenChange}
      title="Add Ticker to Watchlist"
      snapPoint="half"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="symbol" className="text-[var(--text-high)] text-sm">
            Symbol
          </Label>
          <Input
            id="symbol"
            placeholder="e.g., SPX, TSLA"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)]"
            autoFocus
          />
        </div>
        <div className="flex gap-2 justify-end">
          <HDButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </HDButton>
          <HDButton
            type="submit"
            variant="primary"
            disabled={!symbol.trim()}
          >
            Add Ticker
          </HDButton>
        </div>
      </form>
    </AppSheet>
  );
}
