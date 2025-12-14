/**
 * MemberExitSheet - Exit flow for member trades
 *
 * Simple single-exit flow (V1):
 * - Enter exit price (required)
 * - Optional notes
 * - Shows P/L calculation
 */

import { useState, useCallback, useMemo } from "react";
import { X, DollarSign, FileText, LogOut, TrendingUp, TrendingDown, Check } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { MemberTrade, TradeThread } from "@/types/tradeThreads";

interface MemberExitSheetProps {
  memberTrade: MemberTrade;
  thread: TradeThread;
  isOpen: boolean;
  onClose: () => void;
  currentPrice?: number;
}

export function MemberExitSheet({
  memberTrade,
  thread,
  isOpen,
  onClose,
  currentPrice,
}: MemberExitSheetProps) {
  const { exitMemberTrade, isLoading } = useTradeThreadStore();

  // Form state
  const [exitPrice, setExitPrice] = useState<string>(currentPrice?.toFixed(2) || "");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate P/L
  const pnlInfo = useMemo(() => {
    const exit = parseFloat(exitPrice);
    if (isNaN(exit) || exit <= 0) return null;

    const pnlPercent = ((exit - memberTrade.entryPrice) / memberTrade.entryPrice) * 100;
    const pnlDollar = exit - memberTrade.entryPrice;
    const isProfit = pnlPercent > 0;
    const isLoss = pnlPercent < 0;

    return {
      pnlPercent,
      pnlDollar,
      isProfit,
      isLoss,
      outcome: isProfit ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN",
    };
  }, [exitPrice, memberTrade.entryPrice]);

  // Contract info
  const contractType = thread.contract?.type === "C" ? "Call" : "Put";
  const strike = thread.contract?.strike || 0;

  const handleSubmit = useCallback(async () => {
    setError(null);

    const exit = parseFloat(exitPrice);
    if (isNaN(exit) || exit <= 0) {
      setError("Please enter a valid exit price");
      return;
    }

    setIsSubmitting(true);
    try {
      await exitMemberTrade(memberTrade.id, exit, notes || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to exit trade");
    } finally {
      setIsSubmitting(false);
    }
  }, [exitPrice, notes, memberTrade.id, exitMemberTrade, onClose]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <LogOut className="w-5 h-5 text-[var(--accent-negative)]" />
            Exit Trade
          </SheetTitle>
          <SheetDescription>
            Close your position in {thread.symbol} ${strike} {contractType}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-5">
          {/* Trade Summary */}
          <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-hairline)]">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-lg font-semibold text-[var(--text-high)]">{thread.symbol}</h4>
                <p className="text-sm text-[var(--text-muted)]">
                  ${strike} {contractType}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--text-muted)]">Your Entry</div>
                <div className="text-lg font-mono text-[var(--text-high)]">
                  ${formatPrice(memberTrade.entryPrice)}
                </div>
              </div>
            </div>

            {memberTrade.sizeContracts && (
              <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] text-sm">
                <span className="text-[var(--text-muted)]">Size:</span>{" "}
                <span className="text-[var(--text-high)]">
                  {memberTrade.sizeContracts} contract{memberTrade.sizeContracts > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Exit Price (Required) */}
          <div className="space-y-2">
            <Label htmlFor="exit-price" className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="w-4 h-4 text-[var(--brand-primary)]" />
              Exit Price
              <span className="text-[var(--accent-negative)] text-xs">*required</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                $
              </span>
              <Input
                id="exit-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="pl-8 font-mono text-lg h-12 bg-[var(--surface-1)] border-[var(--border-hairline)]"
                autoFocus
              />
            </div>
            {currentPrice && (
              <button
                onClick={() => setExitPrice(currentPrice.toFixed(2))}
                className="text-xs text-[var(--brand-primary)] hover:underline"
              >
                Use current price (${formatPrice(currentPrice)})
              </button>
            )}
          </div>

          {/* P/L Preview */}
          {pnlInfo && (
            <div
              className={cn(
                "p-4 rounded-lg border-2",
                pnlInfo.isProfit
                  ? "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]"
                  : pnlInfo.isLoss
                    ? "bg-[var(--accent-negative)]/10 border-[var(--accent-negative)]"
                    : "bg-[var(--surface-1)] border-[var(--border-hairline)]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pnlInfo.isProfit ? (
                    <TrendingUp className="w-6 h-6 text-[var(--accent-positive)]" />
                  ) : pnlInfo.isLoss ? (
                    <TrendingDown className="w-6 h-6 text-[var(--accent-negative)]" />
                  ) : null}
                  <span
                    className={cn(
                      "text-lg font-bold",
                      pnlInfo.isProfit
                        ? "text-[var(--accent-positive)]"
                        : pnlInfo.isLoss
                          ? "text-[var(--accent-negative)]"
                          : "text-[var(--text-high)]"
                    )}
                  >
                    {pnlInfo.outcome}
                  </span>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-2xl font-bold font-mono",
                      pnlInfo.isProfit
                        ? "text-[var(--accent-positive)]"
                        : pnlInfo.isLoss
                          ? "text-[var(--accent-negative)]"
                          : "text-[var(--text-high)]"
                    )}
                  >
                    {pnlInfo.pnlPercent >= 0 ? "+" : ""}
                    {pnlInfo.pnlPercent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-[var(--text-muted)] font-mono">
                    {pnlInfo.pnlDollar >= 0 ? "+" : ""}${pnlInfo.pnlDollar.toFixed(2)}/contract
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="exit-notes" className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" />
              Exit Notes
              <span className="text-[var(--text-faint)] text-xs">(optional)</span>
            </Label>
            <Textarea
              id="exit-notes"
              placeholder="Why are you exiting? Lessons learned..."
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
            disabled={isSubmitting || isLoading || !exitPrice}
            className={cn(
              "flex-1 h-12 font-semibold",
              pnlInfo?.isProfit
                ? "bg-[var(--accent-positive)] hover:bg-[var(--accent-positive)]/90"
                : "bg-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/90",
              "text-white"
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Closing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Close Position
              </span>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
