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
  underlyingPrice?: number; // Current stock/index price for ATM detection
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
  underlyingPrice = 0,
}: MobileContractSheetProps) {
  const [selectedType, setSelectedType] = useState<OptionType>("C");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showMoreOTM, setShowMoreOTM] = useState(false);
  const [showMoreITM, setShowMoreITM] = useState(false);

  // Filter contracts by type and show ATM-centered spread (matching desktop pattern)
  const { allContracts, limitedContracts, atmStrike, hiddenOTM, hiddenITM } = useMemo(() => {
    console.log("[v0] Mobile contract filter: input", {
      total: contracts.length,
      type: selectedType,
      underlyingPrice,
    });

    const typed = contracts.filter((c) => c.type === selectedType);
    if (typed.length === 0) {
      console.log("[v0] Mobile contract filter: no contracts of type", selectedType);
      return { allContracts: [], limitedContracts: [], atmStrike: 0, hiddenOTM: 0, hiddenITM: 0 };
    }

    // Group by expiration date
    const byExpiry = new Map<number, Contract[]>();
    typed.forEach((c) => {
      const dte = c.daysToExpiry || 0;
      if (!byExpiry.has(dte)) byExpiry.set(dte, []);
      byExpiry.get(dte)!.push(c);
    });

    console.log(
      "[v0] Mobile expiries found:",
      Array.from(byExpiry.keys()).sort((a, b) => a - b)
    );

    // Get unique DTEs sorted
    const dteSorted = Array.from(byExpiry.keys()).sort((a, b) => a - b);

    // Find expiry closest to 7 DTE (optimal for day/swing trades)
    const targetDTE = 7;
    const closestDTE = dteSorted.reduce((prev, curr) =>
      Math.abs(curr - targetDTE) < Math.abs(prev - targetDTE) ? curr : prev
    );

    console.log("[v0] Mobile selected DTE:", closestDTE, "from target", targetDTE);

    // Get contracts from closest expiry
    const expiryContracts = byExpiry.get(closestDTE) || [];

    console.log("[v0] Mobile expiry contracts:", expiryContracts.length);

    // Sort by strike price
    const sorted = [...expiryContracts].sort((a, b) => a.strike - b.strike);

    // Find ATM strike by proximity to underlying price (matching desktop)
    if (!underlyingPrice || underlyingPrice <= 0) {
      console.log("[v0] Mobile: No underlying price, using fallback");
      return {
        allContracts: sorted,
        limitedContracts: sorted.slice(0, 6),
        atmStrike: 0,
        hiddenOTM: 0,
        hiddenITM: 0,
      };
    }

    let closestStrike = sorted[0].strike;
    let minDiff = Math.abs(sorted[0].strike - underlyingPrice);
    let atmIndex = 0;

    for (let i = 0; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i].strike - underlyingPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestStrike = sorted[i].strike;
        atmIndex = i;
      }
    }

    console.log(
      "[v0] Mobile ATM:",
      closestStrike,
      "at index",
      atmIndex,
      "(underlying:",
      underlyingPrice,
      ")"
    );

    // Split into ITM/OTM relative to underlying price (matching desktop logic)
    const atmContract = sorted[atmIndex];
    const otmContracts: Contract[] = [];
    const itmContracts: Contract[] = [];

    for (const c of sorted) {
      if (c.strike === closestStrike) continue; // Skip ATM

      if (selectedType === "C") {
        // Calls: ITM when strike < underlying, OTM when strike > underlying
        if (c.strike < underlyingPrice) {
          itmContracts.push(c);
        } else {
          otmContracts.push(c);
        }
      } else {
        // Puts: ITM when strike > underlying, OTM when strike < underlying
        if (c.strike > underlyingPrice) {
          itmContracts.push(c);
        } else {
          otmContracts.push(c);
        }
      }
    }

    // Sort by distance from ATM (closest first)
    const sortByProximity = (arr: Contract[]) =>
      arr.sort((a, b) => Math.abs(a.strike - closestStrike) - Math.abs(b.strike - closestStrike));

    const sortedOTM = sortByProximity(otmContracts);
    const sortedITM = sortByProximity(itmContracts);

    // Desktop-style limits: 2 OTM + ATM + 3 ITM = 6 default, expandable to 7 + 1 + 7 = 15
    const otmLimit = showMoreOTM ? 7 : 2;
    const itmLimit = showMoreITM ? 7 : 3;

    const limitedOTM = sortedOTM.slice(0, otmLimit);
    const limitedITM = sortedITM.slice(0, itmLimit);

    const limited = [
      ...limitedOTM.sort((a, b) => a.strike - b.strike),
      atmContract,
      ...limitedITM.sort((a, b) => a.strike - b.strike),
    ];

    const all = [
      ...sortedOTM.sort((a, b) => a.strike - b.strike),
      atmContract,
      ...sortedITM.sort((a, b) => a.strike - b.strike),
    ];

    console.log(
      "[v0] Mobile contracts:",
      limited.length,
      "limited (",
      limitedOTM.length,
      "OTM +",
      limitedITM.length,
      "ITM ), total available:",
      all.length
    );

    return {
      allContracts: all,
      limitedContracts: limited,
      atmStrike: closestStrike,
      hiddenOTM: Math.max(0, sortedOTM.length - otmLimit),
      hiddenITM: Math.max(0, sortedITM.length - itmLimit),
    };
  }, [contracts, selectedType, underlyingPrice, showMoreOTM, showMoreITM]);

  // Auto-select best contract (highest liquidity near ATM)
  const bestContract = useMemo(() => {
    if (limitedContracts.length === 0) return null;
    // Find contract with best volume * OI near ATM strike
    return limitedContracts.reduce((best, curr) => {
      const currScore =
        (curr.volume || 0) *
        (curr.openInterest || 0) *
        (1 / (1 + Math.abs(curr.strike - atmStrike)));
      const bestScore =
        (best.volume || 0) *
        (best.openInterest || 0) *
        (1 / (1 + Math.abs(best.strike - atmStrike)));
      return currScore > bestScore ? curr : best;
    }, limitedContracts[0]);
  }, [limitedContracts, atmStrike]);

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
              ) : limitedContracts.length === 0 ? (
                <p className="text-[var(--text-muted)] text-center py-8">No contracts available</p>
              ) : (
                <>
                  {limitedContracts.map((contract) => {
                    const isSelected = selectedContract?.id === contract.id;
                    const isBest = bestContract?.id === contract.id && !selectedContract;

                    return (
                      <button
                        key={contract.id}
                        data-testid="contract-card"
                        onClick={() => setSelectedContract(isSelected ? null : contract)}
                        className={cn(
                          "w-full p-3 rounded-lg border flex items-center justify-between",
                          isSelected || isBest
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                            : contract.strike === atmStrike
                              ? "border-blue-500/30 bg-blue-500/5"
                              : "border-[var(--border-hairline)] bg-[var(--surface-1)]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {(isSelected || isBest) && (
                            <Check className="w-4 h-4 text-[var(--brand-primary)]" />
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--text-high)] font-medium">
                                ${contract.strike}
                                {contract.type}
                              </span>
                              {contract.strike === atmStrike && (
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-medium rounded">
                                  ATM
                                </span>
                              )}
                            </div>
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
                  })}

                  {/* Show More OTM button */}
                  {hiddenOTM > 0 && !showMoreOTM && (
                    <button
                      onClick={() => setShowMoreOTM(true)}
                      className="w-full mt-2 px-4 py-2.5 bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-lg text-[var(--text-med)] text-sm hover:bg-[var(--surface-2)] transition-colors"
                    >
                      Show {hiddenOTM} more OTM contracts
                    </button>
                  )}

                  {/* Show More ITM button */}
                  {hiddenITM > 0 && !showMoreITM && (
                    <button
                      onClick={() => setShowMoreITM(true)}
                      className="w-full mt-2 px-4 py-2.5 bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-lg text-[var(--text-med)] text-sm hover:bg-[var(--surface-2)] transition-colors"
                    >
                      Show {hiddenITM} more ITM contracts
                    </button>
                  )}
                </>
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
