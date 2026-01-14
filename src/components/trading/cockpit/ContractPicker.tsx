/**
 * ContractPicker - Reusable contract selection modal/sheet
 *
 * Displays an options chain for selecting contracts.
 * - Desktop: Opens in a Dialog
 * - Mobile: Opens in an AppSheet
 *
 * Features:
 * - Calls/Puts toggle
 * - Expiry selection
 * - Strike window around ATM
 * - Highlights recommended contract
 * - Calls onSelect(contract) when user picks a contract
 */

import React, { useState, useCallback, useMemo } from "react";
import type { Contract } from "../../../types";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { useStreamingOptionsChain } from "../../../hooks/useStreamingOptionsChain";
import { HDContractGrid } from "../../hd/common/HDContractGrid";
import { useIsMobile } from "../../ui/use-mobile";
import { AppSheet } from "../../ui/AppSheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { ListFilter, X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";

interface ContractPickerProps {
  /** Symbol to fetch options chain for */
  symbol: string;
  /** Current underlying price for ATM calculation */
  currentPrice: number;
  /** Whether the picker is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a contract is selected */
  onSelect: (contract: Contract) => void;
  /** Optional recommended contract to highlight */
  recommendation?: ContractRecommendation | null;
  /** Current contract (for highlighting) */
  currentContract?: Contract | null;
  /** Whether selection is disabled (e.g., trade is ENTERED) */
  disabled?: boolean;
  /** Tooltip message when disabled */
  disabledReason?: string;
}

export function ContractPicker({
  symbol,
  currentPrice,
  open,
  onOpenChange,
  onSelect,
  recommendation,
  currentContract,
  disabled = false,
  disabledReason,
}: ContractPickerProps) {
  const isMobile = useIsMobile();

  // Fetch options chain
  const { contracts, loading, error, isStale } = useStreamingOptionsChain(symbol);

  // Handle contract selection
  const handleContractSelect = useCallback(
    (contract: Contract) => {
      onSelect(contract);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  // Filter contracts to a reasonable strike window (12-20 strikes around ATM)
  const filteredContracts = useMemo(() => {
    if (!contracts || contracts.length === 0 || currentPrice <= 0) {
      return contracts || [];
    }

    // Find ATM strike
    const atmStrike = contracts.reduce((closest, contract) => {
      const closestDiff = Math.abs(closest.strike - currentPrice);
      const contractDiff = Math.abs(contract.strike - currentPrice);
      return contractDiff < closestDiff ? contract : closest;
    }, contracts[0]).strike;

    // Calculate strike step (typical: $1 for <$100, $5 for $100-$500, $10 for >$500)
    const strikes = [...new Set(contracts.map((c) => c.strike))].sort((a, b) => a - b);
    const strikeStep = strikes.length > 1 ? strikes[1] - strikes[0] : 1;

    // Window: 10 strikes above and below ATM
    const windowSize = 10;
    const minStrike = atmStrike - strikeStep * windowSize;
    const maxStrike = atmStrike + strikeStep * windowSize;

    return contracts.filter((c) => c.strike >= minStrike && c.strike <= maxStrike);
  }, [contracts, currentPrice]);

  // Content to render
  const content = (
    <div className="flex flex-col h-full">
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-primary)]" />
          <span className="ml-2 text-sm text-[var(--text-muted)]">Loading options chain...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--accent-negative)] mb-2" />
          <p className="text-sm text-[var(--text-high)]">Failed to load options chain</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      )}

      {/* Stale data warning */}
      {isStale && !loading && !error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">
            Options data may be stale. Prices shown might not be current.
          </span>
        </div>
      )}

      {/* Contract grid */}
      {!loading && !error && filteredContracts.length > 0 && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <HDContractGrid
            contracts={filteredContracts}
            currentPrice={currentPrice}
            ticker={symbol}
            onContractSelect={handleContractSelect}
            recommendation={recommendation}
            className="h-full"
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredContracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <ListFilter className="w-8 h-8 text-[var(--text-faint)] mb-2" />
          <p className="text-sm text-[var(--text-high)]">No contracts available</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Options chain for {symbol} is empty or not available.
          </p>
        </div>
      )}
    </div>
  );

  // Render as AppSheet on mobile
  if (isMobile) {
    return (
      <AppSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`Select Contract · ${symbol}`}
        snapPoint="full"
      >
        {content}
      </AppSheet>
    );
  }

  // Render as Dialog on desktop
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 bg-[var(--surface-1)]"
        showCloseButton={false}
      >
        <DialogHeader className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-hairline)] flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold text-[var(--text-high)]">
            Select Contract · {symbol}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ContractPickerTrigger - Button to open the contract picker
// ============================================================================

interface ContractPickerTriggerProps {
  /** Whether the trigger opens the picker */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Tooltip when disabled */
  disabledReason?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional class names */
  className?: string;
  /** Button label */
  label?: string;
}

export function ContractPickerTrigger({
  onClick,
  disabled = false,
  disabledReason,
  variant = "outline",
  size = "sm",
  className,
  label = "Select Contract",
}: ContractPickerTriggerProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={cn("text-xs", disabled && "opacity-50 cursor-not-allowed", className)}
    >
      <ListFilter className="w-3 h-3 mr-1" />
      {label}
    </Button>
  );
}

export default ContractPicker;
