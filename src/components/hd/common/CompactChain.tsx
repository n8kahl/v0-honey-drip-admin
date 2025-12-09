/**
 * CompactChain - Streamlined Options Chain for Setup Mode
 *
 * Requirements:
 * - Default: ATM ±2 strikes (max 5 rows)
 * - Key columns only: Strike | Mid | Δ | Spread% | OI | IV
 * - Expandable "More strikes" toggle
 * - Expanded content scrolls internally (capped height)
 * - Highlights recommended contract with pulsing indicator
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Contract } from "../../../types";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { cn } from "../../../lib/utils";
import { Star, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

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
  const [expanded, setExpanded] = useState(false);
  const selectedRowRef = useRef<HTMLButtonElement>(null);

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

  // Group by expiry and use nearest expiry
  const { nearestExpiry, contractsForExpiry } = useMemo(() => {
    const byExpiry = new Map<string, Contract[]>();
    for (const c of filtered) {
      const arr = byExpiry.get(c.expiry) || [];
      arr.push(c);
      byExpiry.set(c.expiry, arr);
    }

    // Sort expiries chronologically
    const sortedExpiries = Array.from(byExpiry.keys()).sort((a, b) => {
      const dteA = byExpiry.get(a)?.[0]?.daysToExpiry ?? Infinity;
      const dteB = byExpiry.get(b)?.[0]?.daysToExpiry ?? Infinity;
      return dteA - dteB;
    });

    // Pick expiry containing recommended contract, or nearest
    let targetExpiry = sortedExpiries[0];
    if (recommendation?.bestContract?.expiry && byExpiry.has(recommendation.bestContract.expiry)) {
      targetExpiry = recommendation.bestContract.expiry;
    }

    const contractsList = byExpiry.get(targetExpiry) || [];
    // Sort by strike
    contractsList.sort((a, b) => a.strike - b.strike);

    return {
      nearestExpiry: targetExpiry,
      contractsForExpiry: contractsList,
    };
  }, [filtered, recommendation?.bestContract?.expiry]);

  // Find ATM strike
  const atmStrike = useMemo(() => {
    if (contractsForExpiry.length === 0) return currentPrice;
    let closest = contractsForExpiry[0].strike;
    let minDiff = Math.abs(closest - currentPrice);
    for (const c of contractsForExpiry) {
      const diff = Math.abs(c.strike - currentPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closest = c.strike;
      }
    }
    return closest;
  }, [contractsForExpiry, currentPrice]);

  // Get ATM ±2 strikes for compact view
  const compactContracts = useMemo(() => {
    const atmIdx = contractsForExpiry.findIndex((c) => c.strike === atmStrike);
    if (atmIdx === -1) return contractsForExpiry.slice(0, 5);
    const start = Math.max(0, atmIdx - 2);
    const end = Math.min(contractsForExpiry.length, atmIdx + 3);
    return contractsForExpiry.slice(start, end);
  }, [contractsForExpiry, atmStrike]);

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

  // Display contracts based on expanded state
  const displayContracts = expanded ? contractsForExpiry : compactContracts;
  const hiddenCount = contractsForExpiry.length - compactContracts.length;

  // DTE for display
  const dte = contractsForExpiry[0]?.daysToExpiry ?? 0;

  const handleSelect = useCallback(
    (contract: Contract) => {
      onContractSelect?.(contract);
    },
    [onContractSelect]
  );

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

  return (
    <div
      className={cn(
        "bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)] overflow-hidden",
        className
      )}
    >
      {/* Header Row: Calls/Puts Toggle + Expiry */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
        {/* Calls/Puts Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setOptionType("C")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded transition-all",
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
              "px-2.5 py-1 text-[10px] font-medium rounded transition-all",
              optionType === "P"
                ? "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-high)]"
            )}
          >
            Puts
          </button>
        </div>

        {/* Expiry Badge */}
        <div className="flex-1 text-right">
          <span className="text-[10px] text-[var(--text-muted)]">
            {nearestExpiry} ({dte}D)
          </span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_60px_45px_50px_55px_45px] gap-1 px-3 py-1.5 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] text-[9px] text-[var(--text-faint)] uppercase tracking-wide font-medium">
        <div>Strike</div>
        <div className="text-right">Mid</div>
        <div className="text-right">Δ</div>
        <div className="text-right">Spread</div>
        <div className="text-right">OI</div>
        <div className="text-right">IV</div>
      </div>

      {/* Contract Rows - Scrollable when expanded */}
      <div
        className={cn(
          "overflow-y-auto scrollbar-thin transition-all duration-300",
          expanded ? "max-h-[280px]" : "max-h-[200px]"
        )}
      >
        {displayContracts.map((contract, idx) => {
          const isSelected = contract.id === selectedContractId;
          const isRecommended = recommendedIds.has(contract.id);
          const isAtm = contract.strike === atmStrike;
          const spreadPct =
            contract.mid > 0
              ? (((contract.ask - contract.bid) / contract.mid) * 100).toFixed(1)
              : "—";

          return (
            <button
              key={contract.id}
              ref={isSelected ? selectedRowRef : undefined}
              onClick={() => handleSelect(contract)}
              className={cn(
                "w-full grid grid-cols-[1fr_60px_45px_50px_55px_45px] gap-1 px-3 py-2 text-xs transition-all",
                "border-b border-[var(--border-hairline)] hover:bg-[var(--surface-3)]",
                idx % 2 === 1 && "bg-[var(--zebra-stripe)]",
                isAtm && "bg-[var(--surface-2)]",
                isSelected && "bg-[var(--brand-primary)]/10 ring-1 ring-[var(--brand-primary)]",
                isRecommended &&
                  !isSelected &&
                  "bg-amber-500/10 ring-1 ring-amber-400/30 animate-pulse-subtle"
              )}
            >
              {/* Strike */}
              <div className="flex items-center gap-1.5 font-medium">
                {isRecommended && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                )}
                <span className={cn(isRecommended && "text-amber-400")}>${contract.strike}</span>
                {isAtm && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--text-muted)]/20 text-[var(--text-muted)]">
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
                  parseFloat(spreadPct) > 3
                    ? "text-[var(--accent-negative)]"
                    : "text-[var(--text-muted)]"
                )}
              >
                {spreadPct}%
              </div>

              {/* OI */}
              <div className="text-right tabular-nums text-[var(--text-muted)]">
                {contract.openInterest > 1000
                  ? `${(contract.openInterest / 1000).toFixed(1)}k`
                  : contract.openInterest.toLocaleString()}
              </div>

              {/* IV */}
              <div className="text-right tabular-nums text-[var(--text-muted)]">
                {contract.iv ? `${(contract.iv * 100).toFixed(0)}%` : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Expand/Collapse Footer */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-[var(--brand-primary)] hover:bg-[var(--surface-2)] transition-colors border-t border-[var(--border-hairline)]"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show fewer strikes
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show {hiddenCount} more strikes
            </>
          )}
        </button>
      )}

      {/* Best Pick Banner (if recommendation exists and not yet selected) */}
      {recommendation?.hasRecommendation &&
        recommendation.bestContract &&
        selectedContractId !== recommendation.bestContract.id && (
          <div className="px-3 py-2 bg-amber-500/5 border-t border-amber-500/20 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">
              Best Pick: ${recommendation.bestContract.strike}{" "}
              {recommendation.bestContract.type === "C" ? "Call" : "Put"}
            </span>
            <button
              onClick={() => handleSelect(recommendation.bestContract!)}
              className="ml-auto text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              Select
            </button>
          </div>
        )}
    </div>
  );
}

export default CompactChain;
