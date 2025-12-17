import { useState, useMemo } from "react";
import { Drawer } from "vaul";
import { Contract, OptionType } from "../../../types";
import { cn, formatPrice } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { TrendingUp, TrendingDown, Check } from "lucide-react";

interface MobileContractSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  contracts: Contract[];
  onSelect: (contract: Contract) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function MobileContractSheet({
  open,
  onOpenChange,
  symbol,
  contracts,
  onSelect,
  loading = false,
  error = null,
  onRetry,
}: MobileContractSheetProps) {
  const [selectedType, setSelectedType] = useState<OptionType>("C");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Filter contracts by type and sort by distance to ATM
  const filteredContracts = useMemo(() => {
    return contracts
      .filter((c) => c.type === selectedType)
      .sort((a, b) => {
        // Sort by DTE first, then by delta (closer to 0.50 = more ATM)
        if (a.daysToExpiry !== b.daysToExpiry) {
          return a.daysToExpiry - b.daysToExpiry;
        }
        const aDelta = Math.abs((a.delta || 0.5) - 0.5);
        const bDelta = Math.abs((b.delta || 0.5) - 0.5);
        return aDelta - bDelta;
      })
      .slice(0, 10); // Show top 10 most relevant
  }, [contracts, selectedType]);

  // Auto-select best contract (highest liquidity near ATM)
  const bestContract = useMemo(() => {
    if (filteredContracts.length === 0) return null;
    // Find contract with best volume * OI near 0.50 delta
    return filteredContracts.reduce((best, curr) => {
      const currScore =
        (curr.volume || 0) * (curr.openInterest || 0) * (1 - Math.abs((curr.delta || 0.5) - 0.5));
      const bestScore =
        (best.volume || 0) * (best.openInterest || 0) * (1 - Math.abs((best.delta || 0.5) - 0.5));
      return currScore > bestScore ? curr : best;
    }, filteredContracts[0]);
  }, [filteredContracts]);

  const handleConfirm = () => {
    const contractToLoad = selectedContract || bestContract;
    if (contractToLoad) {
      onSelect(contractToLoad);
      onOpenChange(false);
    }
  };

  const formatExpiry = (expiry: string) => {
    const date = new Date(expiry);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "0DTE";
    if (diffDays === 1) return "1DTE";
    return `${diffDays}DTE`;
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-base)] rounded-t-2xl">
          <div className="mx-auto w-12 h-1.5 bg-[var(--border-hairline)] rounded-full my-3" />

          <div className="px-4 pb-safe max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-high)]">
                Load {symbol} Contract
              </h2>
              <button
                onClick={() => onOpenChange(false)}
                className="text-[var(--text-muted)] text-sm"
              >
                Cancel
              </button>
            </div>

            {/* Call/Put Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectedType("C")}
                className={cn(
                  "flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2",
                  selectedType === "C"
                    ? "bg-[var(--accent-positive)] text-white"
                    : "bg-[var(--surface-1)] text-[var(--text-muted)]"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Calls
              </button>
              <button
                onClick={() => setSelectedType("P")}
                className={cn(
                  "flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2",
                  selectedType === "P"
                    ? "bg-[var(--accent-negative)] text-white"
                    : "bg-[var(--surface-1)] text-[var(--text-muted)]"
                )}
              >
                <TrendingDown className="w-4 h-4" />
                Puts
              </button>
            </div>

            {/* Best Contract Suggestion */}
            {!loading && bestContract && (
              <div className="mb-4 p-3 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-lg">
                <div className="text-xs text-[var(--brand-primary)] uppercase tracking-wide mb-1">
                  Recommended
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-high)] font-medium">
                    ${bestContract.strike}
                    {bestContract.type} {formatExpiry(bestContract.expiry)}
                  </span>
                  <span className="text-[var(--text-med)]">${formatPrice(bestContract.mid)}</span>
                </div>
              </div>
            )}

            {/* Contract List */}
            <div className="space-y-2 mb-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[var(--text-muted)] text-sm">Loading contracts...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="text-[var(--text-high)] font-medium">Failed to Load</p>
                  <p className="text-[var(--text-muted)] text-sm text-center px-4">{error}</p>
                  {onRetry && (
                    <Button onClick={onRetry} className="mt-2" variant="default">
                      Retry
                    </Button>
                  )}
                </div>
              ) : filteredContracts.length === 0 ? (
                <p className="text-[var(--text-muted)] text-center py-8">No contracts available</p>
              ) : (
                filteredContracts.map((contract) => {
                  const isSelected = selectedContract?.id === contract.id;
                  const isBest = bestContract?.id === contract.id && !selectedContract;

                  return (
                    <button
                      key={contract.id}
                      onClick={() => setSelectedContract(isSelected ? null : contract)}
                      className={cn(
                        "w-full p-3 rounded-lg border flex items-center justify-between",
                        isSelected || isBest
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                          : "border-[var(--border-hairline)] bg-[var(--surface-1)]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {(isSelected || isBest) && (
                          <Check className="w-4 h-4 text-[var(--brand-primary)]" />
                        )}
                        <div className="text-left">
                          <span className="text-[var(--text-high)] font-medium block">
                            ${contract.strike}
                            {contract.type}
                          </span>
                          <span className="text-[var(--text-muted)] text-xs">
                            {formatExpiry(contract.expiry)} | Vol: {contract.volume || 0}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[var(--text-high)] tabular-nums block">
                          ${formatPrice(contract.mid)}
                        </span>
                        <span className="text-[var(--text-muted)] text-xs">
                          {contract.delta !== undefined
                            ? `${(contract.delta * 100).toFixed(0)}D`
                            : ""}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Confirm Button */}
            <Button
              onClick={handleConfirm}
              disabled={!selectedContract && !bestContract}
              className="w-full py-3 bg-[var(--brand-primary)] text-black font-medium min-h-[48px]"
            >
              Load Contract
            </Button>

            {/* Safe area padding */}
            <div className="h-4" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
