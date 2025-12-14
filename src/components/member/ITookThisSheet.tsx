/**
 * ITookThisSheet - "I Took This Trade" subscription form
 *
 * Mobile-first bottom sheet for members to subscribe to admin trade threads.
 * Captures entry price (required), size (optional), notes (optional),
 * and toggle for using admin stop/targets.
 */

import { useState, useCallback } from "react";
import { X, DollarSign, Target, AlertTriangle, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useTradeThreadStore } from "@/stores/tradeThreadStore";
import type { TradeThread } from "@/types/tradeThreads";

interface ITookThisSheetProps {
  thread: TradeThread;
  isOpen: boolean;
  onClose: () => void;
  currentPrice?: number; // Live price for reference
}

export function ITookThisSheet({ thread, isOpen, onClose, currentPrice }: ITookThisSheetProps) {
  const { takeTrade, isLoading } = useTradeThreadStore();

  // Form state
  const [entryPrice, setEntryPrice] = useState<string>(
    currentPrice?.toFixed(2) || thread.entryPrice?.toFixed(2) || ""
  );
  const [sizeContracts, setSizeContracts] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [useAdminStopTargets, setUseAdminStopTargets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contract info
  const contractType = thread.contract?.type === "C" ? "Call" : "Put";
  const strike = thread.contract?.strike || 0;
  const expiry = thread.contract?.expiry || "";

  const handleSubmit = useCallback(async () => {
    setError(null);

    const entry = parseFloat(entryPrice);
    if (isNaN(entry) || entry <= 0) {
      setError("Please enter a valid entry price");
      return;
    }

    setIsSubmitting(true);
    try {
      await takeTrade({
        tradeThreadId: thread.id,
        entryPrice: entry,
        sizeContracts: sizeContracts ? parseInt(sizeContracts, 10) : undefined,
        notes: notes || undefined,
        useAdminStopTargets,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to take trade");
    } finally {
      setIsSubmitting(false);
    }
  }, [entryPrice, sizeContracts, notes, useAdminStopTargets, thread.id, takeTrade, onClose]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <span className="text-[var(--brand-primary)]">{thread.symbol}</span>
            <span className="text-[var(--text-muted)] font-normal text-base">
              ${strike} {contractType}
            </span>
          </SheetTitle>
          <SheetDescription>
            Subscribe to receive live updates and track your personal P/L
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-5">
          {/* Contract Summary */}
          <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Contract</span>
              <span className="text-[var(--text-high)] font-medium">
                ${strike} {contractType} • {expiry}
              </span>
            </div>
            {thread.entryPrice && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-[var(--text-muted)]">Admin Entry</span>
                <span className="text-[var(--text-high)] font-mono">
                  ${thread.entryPrice.toFixed(2)}
                </span>
              </div>
            )}
            {currentPrice && (
              <div className="flex justify-between text-sm mt-2">
                <span className="text-[var(--text-muted)]">Current Price</span>
                <span className="text-[var(--brand-primary)] font-mono">
                  ${currentPrice.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Entry Price (Required) */}
          <div className="space-y-2">
            <Label htmlFor="entry-price" className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="w-4 h-4 text-[var(--brand-primary)]" />
              Your Entry Price
              <span className="text-[var(--accent-negative)] text-xs">*required</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                $
              </span>
              <Input
                id="entry-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="pl-8 font-mono text-lg h-12 bg-[var(--surface-1)] border-[var(--border-hairline)]"
                autoFocus
              />
            </div>
          </div>

          {/* Size (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="size" className="flex items-center gap-2 text-sm font-medium">
              <Target className="w-4 h-4 text-[var(--text-muted)]" />
              Contracts
              <span className="text-[var(--text-faint)] text-xs">(optional)</span>
            </Label>
            <Input
              id="size"
              type="number"
              min="1"
              placeholder="Number of contracts"
              value={sizeContracts}
              onChange={(e) => setSizeContracts(e.target.value)}
              className="h-12 bg-[var(--surface-1)] border-[var(--border-hairline)]"
            />
          </div>

          {/* Use Admin Stop/Targets Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Use Admin's Stop & Targets</Label>
              <p className="text-xs text-[var(--text-muted)]">
                {useAdminStopTargets
                  ? "You'll use the same stop/targets as the admin"
                  : "You'll manage your own stop/targets"}
              </p>
            </div>
            <Switch checked={useAdminStopTargets} onCheckedChange={setUseAdminStopTargets} />
          </div>

          {/* Admin Stop/Target Display */}
          {useAdminStopTargets && (thread.stopLoss || thread.targetPrice) && (
            <div className="grid grid-cols-2 gap-3">
              {thread.stopLoss && (
                <div className="p-3 rounded-lg bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/20">
                  <div className="flex items-center gap-1 text-xs text-[var(--accent-negative)] mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    Stop Loss
                  </div>
                  <span className="font-mono text-[var(--text-high)]">
                    ${thread.stopLoss.toFixed(2)}
                  </span>
                </div>
              )}
              {thread.targetPrice && (
                <div className="p-3 rounded-lg bg-[var(--accent-positive)]/10 border border-[var(--accent-positive)]/20">
                  <div className="flex items-center gap-1 text-xs text-[var(--accent-positive)] mb-1">
                    <Target className="w-3 h-3" />
                    Target
                  </div>
                  <span className="font-mono text-[var(--text-high)]">
                    ${thread.targetPrice.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" />
              Notes
              <span className="text-[var(--text-faint)] text-xs">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Why are you taking this trade? Your reasoning..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] bg-[var(--surface-1)] border-[var(--border-hairline)] resize-none"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-[var(--accent-negative)]/10 border border-[var(--accent-negative)]/20 text-[var(--accent-negative)] text-sm">
              {error}
            </div>
          )}
        </div>

        <SheetFooter className="gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 border-[var(--border-hairline)] text-[var(--text-muted)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !entryPrice}
            className="flex-1 h-12 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--bg-base)] font-semibold"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-[var(--bg-base)]/30 border-t-[var(--bg-base)] rounded-full animate-spin" />
                Subscribing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />I Took This Trade
              </span>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
