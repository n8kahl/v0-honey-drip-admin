import { useState, useMemo, useEffect } from "react";
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
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);

  // Get available expiries from contracts (for expiry chip selector)
  // Returns array of { expiry: string, dte: number, label: string }
  const availableExpiries = useMemo(() => {
    const typed = contracts.filter((c) => c.type === selectedType);
    const expiryMap = new Map<string, number>();

    typed.forEach((c) => {
      if (c.expiry && !expiryMap.has(c.expiry)) {
        expiryMap.set(c.expiry, c.daysToExpiry || 0);
      }
    });

    // Sort by DTE (earliest first)
    return Array.from(expiryMap.entries())
      .map(([expiry, dte]) => {
        // Format expiry date as "Dec 16" or "12/16"
        const date = new Date(expiry);
        const month = date.toLocaleDateString("en-US", { month: "short" });
        const day = date.getDate();
        return {
          expiry,
          dte,
          label: `${month} ${day}`,
        };
      })
      .sort((a, b) => a.dte - b.dte);
  }, [contracts, selectedType]);

  // Auto-select first expiry when sheet opens or expiries change
  useEffect(() => {
    if (open && availableExpiries.length > 0 && selectedExpiry === null) {
      setSelectedExpiry(availableExpiries[0].expiry);
    }
  }, [open, availableExpiries, selectedExpiry]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setSelectedContract(null);
      setShowMoreOTM(false);
      setShowMoreITM(false);
      setSelectedExpiry(null);
    }
  }, [open]);

  // Filter contracts by type and selected expiry, then organize into OTM/ATM/ITM sections
  const { otmContracts, atmContract, itmContracts, atmStrike } = useMemo(() => {
    // Filter by type AND selected expiry
    const filtered = contracts.filter(
      (c) => c.type === selectedType && c.expiry === selectedExpiry
    );

    if (filtered.length === 0 || !underlyingPrice || underlyingPrice <= 0) {
      return { otmContracts: [], atmContract: null, itmContracts: [], atmStrike: 0 };
    }

    // Sort by strike price
    const sorted = [...filtered].sort((a, b) => a.strike - b.strike);

    // Find ATM strike (closest to underlying price)
    let closestStrike = sorted[0].strike;
    let minDiff = Math.abs(sorted[0].strike - underlyingPrice);

    for (const c of sorted) {
      const diff = Math.abs(c.strike - underlyingPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestStrike = c.strike;
      }
    }

    // Split into OTM/ATM/ITM
    const otm: Contract[] = [];
    const itm: Contract[] = [];
    let atm: Contract | null = null;

    for (const c of sorted) {
      if (c.strike === closestStrike) {
        atm = c;
      } else if (selectedType === "C") {
        // Calls: ITM = strike < underlying, OTM = strike > underlying
        if (c.strike < underlyingPrice) {
          itm.push(c);
        } else {
          otm.push(c);
        }
      } else {
        // Puts: ITM = strike > underlying, OTM = strike < underlying
        if (c.strike > underlyingPrice) {
          itm.push(c);
        } else {
          otm.push(c);
        }
      }
    }

    // Sort by distance from ATM (closest first)
    otm.sort((a, b) => Math.abs(a.strike - closestStrike) - Math.abs(b.strike - closestStrike));
    itm.sort((a, b) => Math.abs(a.strike - closestStrike) - Math.abs(b.strike - closestStrike));

    return { otmContracts: otm, atmContract: atm, itmContracts: itm, atmStrike: closestStrike };
  }, [contracts, selectedType, selectedExpiry, underlyingPrice]);

  // Auto-select best contract (ATM with highest liquidity)
  const bestContract = useMemo(() => {
    // Prefer ATM contract if available
    if (atmContract) return atmContract;

    // Fall back to best liquidity from OTM/ITM
    const allContracts = [...otmContracts, ...itmContracts];
    if (allContracts.length === 0) return null;

    return allContracts.reduce((best, curr) => {
      const currScore =
        (curr.volume || 0) *
        (curr.openInterest || 0) *
        (1 / (1 + Math.abs(curr.strike - atmStrike)));
      const bestScore =
        (best.volume || 0) *
        (best.openInterest || 0) *
        (1 / (1 + Math.abs(best.strike - atmStrike)));
      return currScore > bestScore ? curr : best;
    }, allContracts[0]);
  }, [atmContract, otmContracts, itmContracts, atmStrike]);

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
            <div className="flex gap-2 mb-3">
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

            {/* Expiry Selector - Horizontal Scrollable Chips */}
            {!loading && availableExpiries.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-1 px-1 scrollbar-hide">
                {availableExpiries.map(({ expiry, dte, label }) => (
                  <button
                    key={expiry}
                    onClick={() => setSelectedExpiry(expiry)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors",
                      selectedExpiry === expiry
                        ? "bg-[var(--brand-primary)] text-black font-medium"
                        : "bg-[var(--surface-1)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                    )}
                  >
                    <span>{label}</span>
                    <span className="ml-1 text-[10px] opacity-70">({dte}d)</span>
                  </button>
                ))}
              </div>
            )}

            {/* Contract List - Sectioned OTM/ATM/ITM */}
            <div className="space-y-3 mb-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[var(--text-muted)] text-sm">Loading contracts...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-2xl">!</span>
                  </div>
                  <p className="text-[var(--text-high)] font-medium">Failed to Load</p>
                  <p className="text-[var(--text-muted)] text-sm text-center px-4">{error}</p>
                  {onRetry && (
                    <Button onClick={onRetry} className="mt-2" variant="default">
                      Retry
                    </Button>
                  )}
                </div>
              ) : !atmContract && otmContracts.length === 0 && itmContracts.length === 0 ? (
                <p className="text-[var(--text-muted)] text-center py-8">No contracts available</p>
              ) : (
                <>
                  {/* OTM Section */}
                  {otmContracts.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5 px-1">
                        OTM ({otmContracts.length})
                      </div>
                      <div className="space-y-2">
                        {otmContracts.slice(0, showMoreOTM ? 10 : 3).map((contract) => (
                          <ContractButton
                            key={contract.id}
                            contract={contract}
                            isSelected={selectedContract?.id === contract.id}
                            isBest={bestContract?.id === contract.id && !selectedContract}
                            isATM={false}
                            onSelect={() =>
                              setSelectedContract(
                                selectedContract?.id === contract.id ? null : contract
                              )
                            }
                          />
                        ))}
                      </div>
                      {otmContracts.length > 3 && !showMoreOTM && (
                        <button
                          onClick={() => setShowMoreOTM(true)}
                          className="w-full mt-2 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
                        >
                          Show {otmContracts.length - 3} more OTM
                        </button>
                      )}
                    </div>
                  )}

                  {/* ATM Section with Indicator */}
                  {atmContract && (
                    <div className="py-2 border-y border-blue-500/30 bg-blue-500/5 rounded-lg">
                      <div className="text-[10px] text-blue-400 text-center mb-1.5 uppercase tracking-wide">
                        ATM · {symbol} @ ${underlyingPrice.toFixed(2)}
                      </div>
                      <div className="px-2">
                        <ContractButton
                          contract={atmContract}
                          isSelected={selectedContract?.id === atmContract.id}
                          isBest={bestContract?.id === atmContract.id && !selectedContract}
                          isATM={true}
                          onSelect={() =>
                            setSelectedContract(
                              selectedContract?.id === atmContract.id ? null : atmContract
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* ITM Section */}
                  {itmContracts.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5 px-1">
                        ITM ({itmContracts.length})
                      </div>
                      <div className="space-y-2">
                        {itmContracts.slice(0, showMoreITM ? 10 : 3).map((contract) => (
                          <ContractButton
                            key={contract.id}
                            contract={contract}
                            isSelected={selectedContract?.id === contract.id}
                            isBest={bestContract?.id === contract.id && !selectedContract}
                            isATM={false}
                            onSelect={() =>
                              setSelectedContract(
                                selectedContract?.id === contract.id ? null : contract
                              )
                            }
                          />
                        ))}
                      </div>
                      {itmContracts.length > 3 && !showMoreITM && (
                        <button
                          onClick={() => setShowMoreITM(true)}
                          className="w-full mt-2 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-high)] transition-colors"
                        >
                          Show {itmContracts.length - 3} more ITM
                        </button>
                      )}
                    </div>
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

// Contract Button Component - Reusable button for each contract
interface ContractButtonProps {
  contract: Contract;
  isSelected: boolean;
  isBest: boolean;
  isATM: boolean;
  onSelect: () => void;
}

function ContractButton({ contract, isSelected, isBest, isATM, onSelect }: ContractButtonProps) {
  return (
    <button
      data-testid="contract-card"
      onClick={onSelect}
      className={cn(
        "w-full p-3 rounded-lg border flex items-center justify-between transition-colors",
        isSelected || isBest
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
          : isATM
            ? "border-blue-500/40 bg-blue-500/10"
            : "border-[var(--border-hairline)] bg-[var(--surface-1)]"
      )}
    >
      <div className="flex items-center gap-3">
        {(isSelected || isBest) && <Check className="w-4 h-4 text-[var(--brand-primary)]" />}
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-high)] font-medium">
              ${contract.strike}
              {contract.type}
            </span>
            {isATM && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-medium rounded">
                ATM
              </span>
            )}
          </div>
          <span className="text-[var(--text-muted)] text-xs">
            {contract.daysToExpiry || 0}DTE | Vol: {contract.volume || 0}
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[var(--text-high)] tabular-nums block">
          ${formatPrice(contract.mid)}
        </span>
        <span className="text-[var(--text-muted)] text-xs">
          {contract.delta !== undefined ? `${(contract.delta * 100).toFixed(0)}D` : ""}
        </span>
      </div>
    </button>
  );
}
