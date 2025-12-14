/**
 * CompactChain - Streamlined Options Chain for Setup Mode (Webull-Style Accordion)
 *
 * Requirements:
 * - Each expiry date is a collapsible accordion row
 * - Expanding an expiry shows OTM, ATM, and ITM contracts for that expiry
 * - Auto-expands the expiry containing the recommended contract
 * - Highlights recommended contract with pulsing indicator
 * - Narrower layout optimized for 50% width display
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Contract } from "../../../types";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { cn } from "../../../lib/utils";
import { Star, ChevronRight, ChevronDown, Sparkles } from "lucide-react";

type Moneyness = "itm" | "atm" | "otm";

interface ExpiryData {
  expiry: string;
  dte: number;
  contracts: Contract[];
  hasRecommended: boolean;
}

interface CompactChainProps {
  contracts: Contract[];
  currentPrice: number;
  ticker: string;
  onContractSelect?: (contract: Contract) => void;
  recommendation?: ContractRecommendation | null;
  selectedContractId?: string | null;
  className?: string;
}

export function CompactChain({
  contracts,
  currentPrice,
  ticker,
  onContractSelect,
  recommendation,
  selectedContractId,
  className,
}: CompactChainProps) {
  const [optionType, setOptionType] = useState<"C" | "P">("P");
  const [expandedExpiry, setExpandedExpiry] = useState<string | null>(null);
  const [expandedOTM, setExpandedOTM] = useState<Record<string, boolean>>({});
  const [expandedITM, setExpandedITM] = useState<Record<string, boolean>>({});
  const selectedRowRef = useRef<HTMLButtonElement>(null);
  const hasAutoSelected = useRef(false);

  // Auto-switch to calls/puts based on recommendation direction
  useEffect(() => {
    if (recommendation?.direction) {
      const newType = recommendation.direction === "call" ? "C" : "P";
      if (optionType !== newType) {
        setOptionType(newType);
      }
    }
  }, [recommendation?.direction]);

  // Filter by option type
  const filtered = useMemo(
    () => contracts.filter((c) => c.type === optionType),
    [contracts, optionType]
  );

  // Group contracts by expiry
  const expiryDataList = useMemo((): ExpiryData[] => {
    const byExpiry = new Map<string, Contract[]>();
    for (const c of filtered) {
      const arr = byExpiry.get(c.expiry) || [];
      arr.push(c);
      byExpiry.set(c.expiry, arr);
    }

    const list: ExpiryData[] = [];
    for (const [expiry, expContracts] of byExpiry) {
      const dte = expContracts[0]?.daysToExpiry ?? 0;
      const hasRecommended = recommendation?.bestContract?.expiry === expiry;
      list.push({
        expiry,
        dte,
        contracts: expContracts.sort((a, b) => a.strike - b.strike),
        hasRecommended,
      });
    }

    // Sort chronologically by DTE
    list.sort((a, b) => a.dte - b.dte);
    return list;
  }, [filtered, recommendation?.bestContract?.expiry]);

  // Auto-expand the expiry containing the recommended contract
  useEffect(() => {
    if (recommendation?.bestContract?.expiry && expandedExpiry === null) {
      setExpandedExpiry(recommendation.bestContract.expiry);
    } else if (expiryDataList.length > 0 && expandedExpiry === null) {
      setExpandedExpiry(expiryDataList[0].expiry);
    }
  }, [recommendation?.bestContract?.expiry, expiryDataList, expandedExpiry]);

  // Reset expanded state when ticker or option type changes
  useEffect(() => {
    setExpandedExpiry(null);
    setExpandedOTM({});
    setExpandedITM({});
  }, [ticker, optionType]);

  // Recommended contract IDs
  const recommendedIds = useMemo(() => {
    const ids = new Set<string>();
    if (recommendation?.bestContract?.id) {
      ids.add(recommendation.bestContract.id);
    }
    if (recommendation?.rankedContracts) {
      for (const r of recommendation.rankedContracts) {
        if (r.isRecommended && r.contract.id) {
          ids.add(r.contract.id);
        }
      }
    }
    return ids;
  }, [recommendation]);

  const handleSelect = useCallback(
    (contract: Contract) => {
      onContractSelect?.(contract);
    },
    [onContractSelect]
  );

  const toggleExpiry = useCallback((expiry: string) => {
    setExpandedExpiry((prev) => (prev === expiry ? null : expiry));
  }, []);

  // Auto-select recommended contract on mount or when recommendation changes
  useEffect(() => {
    if (recommendation?.bestContract && !selectedContractId && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      onContractSelect?.(recommendation.bestContract);
    }
  }, [recommendation?.bestContract?.id, selectedContractId, onContractSelect]);

  // Reset auto-select flag when ticker changes
  useEffect(() => {
    hasAutoSelected.current = false;
  }, [ticker]);

  // Scroll selected into view
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedContractId]);

  if (contracts.length === 0) {
    return (
      <div className={cn("bg-[var(--surface-1)] rounded-lg p-4 text-center", className)}>
        <p className="text-xs text-[var(--text-muted)]">No options available</p>
      </div>
    );
  }

  // Format expiry for display (e.g., "Dec 13" from "2024-12-13")
  const formatExpiry = (expiry: string) => {
    try {
      const date = new Date(expiry + "T00:00:00");
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return expiry;
    }
  };

  // Helper to determine moneyness of a contract
  const getMoneyness = (contract: Contract, atmStrike: number): Moneyness => {
    if (contract.strike === atmStrike) return "atm";
    if (contract.type === "C") {
      return contract.strike < currentPrice ? "itm" : "otm";
    } else {
      return contract.strike > currentPrice ? "itm" : "otm";
    }
  };

  // Render a single contract row (compact version for accordion)
  const renderContractRow = (contract: Contract, moneyness: Moneyness, atmStrike: number) => {
    const isSelected = contract.id === selectedContractId;
    const isRecommended = recommendedIds.has(contract.id);
    const isAtm = moneyness === "atm";
    const spreadPct =
      contract.mid > 0 ? (((contract.ask - contract.bid) / contract.mid) * 100).toFixed(1) : "—";

    return (
      <button
        key={contract.id}
        ref={isSelected ? selectedRowRef : undefined}
        onClick={() => handleSelect(contract)}
        className={cn(
          "w-full grid grid-cols-[1fr_50px_40px_40px] gap-0.5 px-2 py-1.5 text-[10px] transition-all",
          "border-b border-[var(--border-hairline)] hover:bg-[var(--surface-3)]",
          moneyness === "otm" && "bg-[var(--surface-1)]",
          moneyness === "itm" && "bg-[var(--itm-background)]",
          moneyness === "atm" && "bg-[var(--surface-2)]",
          isSelected && "bg-[var(--brand-primary)]/10 ring-1 ring-[var(--brand-primary)]",
          isRecommended &&
            !isSelected &&
            "bg-amber-500/10 ring-1 ring-amber-400/30 animate-pulse-subtle"
        )}
      >
        {/* Strike */}
        <div className="flex items-center gap-1 font-medium">
          {isRecommended && (
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 flex-shrink-0" />
          )}
          <span className={cn(isRecommended && "text-amber-400")}>${contract.strike}</span>
          {isAtm && (
            <span className="text-[7px] px-0.5 rounded bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] font-semibold">
              ATM
            </span>
          )}
        </div>

        {/* Mid */}
        <div className="text-right tabular-nums text-[var(--text-high)]">
          ${contract.mid.toFixed(2)}
        </div>

        {/* Delta */}
        <div className="text-right tabular-nums text-[var(--text-muted)]">
          {contract.delta?.toFixed(2) ?? "—"}
        </div>

        {/* Spread % */}
        <div
          className={cn(
            "text-right tabular-nums",
            parseFloat(spreadPct) > 3 ? "text-[var(--accent-negative)]" : "text-[var(--text-muted)]"
          )}
        >
          {spreadPct}%
        </div>
      </button>
    );
  };

  // Render contracts for an expiry (OTM/ATM/ITM sections)
  const renderExpiryContracts = (expiryData: ExpiryData) => {
    const { contracts: expiryContracts, expiry } = expiryData;

    // Find ATM strike for this expiry
    let atmStrike = currentPrice;
    let minDiff = Infinity;
    for (const c of expiryContracts) {
      const diff = Math.abs(c.strike - currentPrice);
      if (diff < minDiff) {
        minDiff = diff;
        atmStrike = c.strike;
      }
    }

    // Separate into OTM, ATM, ITM
    const otm: Contract[] = [];
    const itm: Contract[] = [];
    let atm: Contract | null = null;

    for (const c of expiryContracts) {
      const moneyness = getMoneyness(c, atmStrike);
      if (moneyness === "atm") {
        atm = c;
      } else if (moneyness === "otm") {
        otm.push(c);
      } else {
        itm.push(c);
      }
    }

    // Sort by distance from ATM
    otm.sort((a, b) => Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike));
    itm.sort((a, b) => Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike));

    const isOTMExpanded = expandedOTM[expiry] ?? false;
    const isITMExpanded = expandedITM[expiry] ?? false;

    const displayOTM = isOTMExpanded ? otm.slice(0, 15) : otm.slice(0, 3);
    const displayITM = isITMExpanded ? itm.slice(0, 15) : itm.slice(0, 3);
    const hiddenOTMCount = otm.length - 3;
    const hiddenITMCount = itm.length - 3;

    return (
      <div className="bg-[var(--surface-1)]">
        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_50px_40px_40px] gap-0.5 px-2 py-1 bg-[var(--surface-2)] text-[8px] text-[var(--text-faint)] uppercase tracking-wide font-medium border-b border-[var(--border-hairline)]">
          <div>Strike</div>
          <div className="text-right">Mid</div>
          <div className="text-right">Δ</div>
          <div className="text-right">Sprd</div>
        </div>

        {/* OTM Section */}
        {otm.length > 0 && (
          <>
            <div className="px-2 py-0.5 text-[8px] text-[var(--text-faint)] uppercase tracking-wider bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
              OTM ({otm.length})
            </div>
            {displayOTM.map((contract) => renderContractRow(contract, "otm", atmStrike))}
            {hiddenOTMCount > 0 && (
              <button
                onClick={() => setExpandedOTM((prev) => ({ ...prev, [expiry]: !isOTMExpanded }))}
                className="w-full flex items-center justify-center gap-1 px-2 py-0.5 text-[8px] text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border-hairline)]"
              >
                {isOTMExpanded ? "Show Less" : `+${hiddenOTMCount} more`}
              </button>
            )}
          </>
        )}

        {/* ATM */}
        {atm && (
          <div className="border-y border-[var(--brand-primary)]/30">
            {renderContractRow(atm, "atm", atmStrike)}
          </div>
        )}

        {/* ITM Section */}
        {itm.length > 0 && (
          <>
            <div className="px-2 py-0.5 text-[8px] text-[var(--text-faint)] uppercase tracking-wider bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
              ITM ({itm.length})
            </div>
            {displayITM.map((contract) => renderContractRow(contract, "itm", atmStrike))}
            {hiddenITMCount > 0 && (
              <button
                onClick={() => setExpandedITM((prev) => ({ ...prev, [expiry]: !isITMExpanded }))}
                className="w-full flex items-center justify-center gap-1 px-2 py-0.5 text-[8px] text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border-hairline)]"
              >
                {isITMExpanded ? "Show Less" : `+${hiddenITMCount} more`}
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] overflow-hidden",
        className
      )}
    >
      {/* Header Row: Calls/Puts Toggle */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
        {/* Calls/Puts Toggle */}
        <div className="flex gap-0.5">
          <button
            onClick={() => setOptionType("C")}
            className={cn(
              "px-2 py-0.5 text-[9px] font-medium rounded transition-all",
              optionType === "C"
                ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
            )}
          >
            Calls
          </button>
          <button
            onClick={() => setOptionType("P")}
            className={cn(
              "px-2 py-0.5 text-[9px] font-medium rounded transition-all",
              optionType === "P"
                ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
            )}
          >
            Puts
          </button>
        </div>

        {/* Expiry Count */}
        <div className="flex-1 text-right text-[8px] text-[var(--text-muted)]">
          {expiryDataList.length} expiries
        </div>
      </div>

      {/* Accordion Expiry List */}
      <div className="overflow-y-auto scrollbar-thin max-h-[500px]">
        {expiryDataList.map((expiryData) => {
          const isExpanded = expandedExpiry === expiryData.expiry;

          return (
            <div
              key={expiryData.expiry}
              className="border-b border-[var(--border-hairline)] last:border-b-0"
            >
              {/* Expiry Row Header */}
              <button
                onClick={() => toggleExpiry(expiryData.expiry)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 text-left transition-all",
                  "hover:bg-[var(--surface-2)]",
                  isExpanded && "bg-[var(--surface-2)]",
                  expiryData.hasRecommended && !isExpanded && "bg-amber-500/5"
                )}
              >
                {/* Chevron */}
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                )}

                {/* Expiry Date */}
                <div className="flex items-center gap-1 flex-1">
                  {expiryData.hasRecommended && (
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      expiryData.hasRecommended ? "text-amber-400" : "text-[var(--text-high)]"
                    )}
                  >
                    {formatExpiry(expiryData.expiry)}
                  </span>
                </div>

                {/* DTE */}
                <span className="text-[9px] text-[var(--text-muted)] tabular-nums w-8 text-right">
                  {expiryData.dte}D
                </span>

                {/* Strike Count */}
                <span className="text-[9px] text-[var(--text-faint)] w-12 text-right">
                  {expiryData.contracts.length} strikes
                </span>
              </button>

              {/* Expanded Content */}
              {isExpanded && renderExpiryContracts(expiryData)}
            </div>
          );
        })}
      </div>

      {/* Best Pick Banner (compact) */}
      {recommendation?.hasRecommendation &&
        recommendation.bestContract &&
        selectedContractId !== recommendation.bestContract.id && (
          <div className="px-2 py-1 bg-amber-500/5 border-t border-amber-500/20 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] text-amber-400 font-medium truncate">
              Best: ${recommendation.bestContract.strike}
              {recommendation.bestContract.type === "C" ? "C" : "P"} ·{" "}
              {formatExpiry(recommendation.bestContract.expiry)}
            </span>
            <button
              onClick={() => handleSelect(recommendation.bestContract!)}
              className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex-shrink-0"
            >
              Select
            </button>
          </div>
        )}
    </div>
  );
}

export default CompactChain;
