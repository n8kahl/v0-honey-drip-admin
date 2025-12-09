/**
 * useSetupState - Two-Scope Selection Model for Setup/Load Trade Experience
 *
 * Manages the separation between:
 * 1. Symbol-scoped state (focusedSymbol) - drives symbol-level panels
 * 2. Contract-scoped state (activeContract) - drives contract-level UI
 *
 * Rules:
 * - On watchlist symbol click: Set focusedSymbol, auto-select recommended contract
 * - On manual contract click: Set activeContract.source = "manual"
 * - Symbol-scoped panels must NOT depend on activeContract
 * - Contract-scoped UI updates instantly when selection changes
 */

import { useState, useCallback, useMemo } from "react";
import type { Contract } from "../types";

// ============================================================================
// Types
// ============================================================================

export type ContractSource = "recommended" | "manual";

export interface ActiveContract {
  source: ContractSource;
  contract: Contract;
}

export interface SetupState {
  focusedSymbol: string | null;
  activeContract: ActiveContract | null;
  activeTradeId: string | null; // If LOADED state
}

export interface UseSetupStateReturn {
  // State
  state: SetupState;

  // Derived
  focusedSymbol: string | null;
  activeContract: Contract | null;
  contractSource: ContractSource | null;
  isManualSelection: boolean;
  hasActiveContract: boolean;
  activeTradeId: string | null;

  // Actions
  focusSymbol: (symbol: string, recommendedContract?: Contract | null) => void;
  selectContract: (contract: Contract, source?: ContractSource) => void;
  revertToRecommended: (recommendedContract: Contract) => void;
  setActiveTradeId: (tradeId: string | null) => void;
  clearFocus: () => void;
  clearContract: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: SetupState = {
  focusedSymbol: null,
  activeContract: null,
  activeTradeId: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSetupState(): UseSetupStateReturn {
  const [state, setState] = useState<SetupState>(initialState);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Focus a symbol from watchlist
   * - Sets focusedSymbol
   * - Auto-selects recommended contract if provided
   * - Clears activeTradeId (not viewing a trade)
   */
  const focusSymbol = useCallback((symbol: string, recommendedContract?: Contract | null) => {
    setState((prev) => ({
      focusedSymbol: symbol,
      activeContract: recommendedContract
        ? { source: "recommended", contract: recommendedContract }
        : prev.focusedSymbol === symbol
          ? prev.activeContract // Keep existing if same symbol
          : null,
      activeTradeId: null,
    }));
  }, []);

  /**
   * Select a specific contract (manual selection from chain)
   * - Sets activeContract with source
   * - Does NOT change focusedSymbol
   */
  const selectContract = useCallback((contract: Contract, source: ContractSource = "manual") => {
    setState((prev) => ({
      ...prev,
      activeContract: { source, contract },
    }));
  }, []);

  /**
   * Revert to recommended contract
   * - Changes source back to 'recommended'
   */
  const revertToRecommended = useCallback((recommendedContract: Contract) => {
    setState((prev) => ({
      ...prev,
      activeContract: { source: "recommended", contract: recommendedContract },
    }));
  }, []);

  /**
   * Set active trade ID (when LOADED state)
   */
  const setActiveTradeId = useCallback((tradeId: string | null) => {
    setState((prev) => ({
      ...prev,
      activeTradeId: tradeId,
    }));
  }, []);

  /**
   * Clear symbol focus
   */
  const clearFocus = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Clear contract selection only
   */
  const clearContract = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeContract: null,
    }));
  }, []);

  /**
   * Full reset
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const focusedSymbol = state.focusedSymbol;
  const activeContract = state.activeContract?.contract ?? null;
  const contractSource = state.activeContract?.source ?? null;
  const isManualSelection = contractSource === "manual";
  const hasActiveContract = activeContract !== null;
  const activeTradeId = state.activeTradeId;

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return useMemo(
    () => ({
      // State
      state,

      // Derived
      focusedSymbol,
      activeContract,
      contractSource,
      isManualSelection,
      hasActiveContract,
      activeTradeId,

      // Actions
      focusSymbol,
      selectContract,
      revertToRecommended,
      setActiveTradeId,
      clearFocus,
      clearContract,
      reset,
    }),
    [
      state,
      focusedSymbol,
      activeContract,
      contractSource,
      isManualSelection,
      hasActiveContract,
      activeTradeId,
      focusSymbol,
      selectContract,
      revertToRecommended,
      setActiveTradeId,
      clearFocus,
      clearContract,
      reset,
    ]
  );
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get contract key for comparison/highlighting
 */
export function getContractKey(contract: Contract | null): string | null {
  if (!contract) return null;
  return `${contract.symbol || ""}_${contract.expiry}_${contract.strike}_${contract.contractType}`;
}

/**
 * Check if two contracts are the same
 */
export function isSameContract(a: Contract | null, b: Contract | null): boolean {
  if (!a || !b) return false;
  return getContractKey(a) === getContractKey(b);
}

/**
 * Get badge label for contract source
 */
export function getSourceBadgeLabel(source: ContractSource | null): string {
  switch (source) {
    case "recommended":
      return "Recommended";
    case "manual":
      return "Manual";
    default:
      return "";
  }
}

/**
 * Get badge style for contract source
 */
export function getSourceBadgeStyle(source: ContractSource | null): string {
  switch (source) {
    case "recommended":
      return "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30";
    case "manual":
      return "bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border-hairline)]";
    default:
      return "";
  }
}

export default useSetupState;
