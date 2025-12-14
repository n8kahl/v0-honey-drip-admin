import { useState } from "react";
import { Ticker } from "../../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { HDButton } from "../common/HDButton";
import { Plus } from "lucide-react";

interface HDDialogAddTickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTicker: (ticker: Ticker) => void;
}

export function HDDialogAddTicker({ open, onOpenChange, onAddTicker }: HDDialogAddTickerProps) {
  const [symbol, setSymbol] = useState("");

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
    setSymbol("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--text-high)]">
            <Plus className="w-5 h-5 text-[var(--brand-primary)]" />
            Add Ticker to Watchlist
          </DialogTitle>
          <DialogDescription className="text-[var(--text-muted)]">
            Enter a stock or index symbol to add to your watchlist.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="symbol" className="text-[var(--text-high)] text-sm">
              Symbol
            </Label>
            <Input
              id="symbol"
              placeholder="e.g., SPX, TSLA, NVDA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)] placeholder:text-[var(--text-faint)]"
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <HDButton type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </HDButton>
            <HDButton type="submit" variant="primary" disabled={!symbol.trim()}>
              Add Ticker
            </HDButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
