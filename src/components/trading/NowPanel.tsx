/**
 * NowPanel - Center Panel Component
 *
 * Displays contextual content based on the current focus target:
 * - focus === null → Empty state
 * - focus.kind === "symbol" → Symbol analysis (chart, chain, best pick) [SETUP MODE]
 * - focus.kind === "trade" → Trade details (varies by state)
 *   - WATCHING/LOADED → Options chain view (NowPanelSymbol) - allows contract changes
 *   - ENTERED → Management cockpit (NowPanelManage) [MANAGE MODE]
 *   - EXITED → Trade recap (NowPanelTrade)
 *
 * Mode switching between Setup and Manage modes uses smooth crossfade animation.
 *
 * NOTE: Inline alert flow has been moved to the right ActionRail (trading/ActionRail.tsx)
 */

import React, { useMemo } from "react";
import type { FocusTarget } from "../../hooks/useTradeStateMachine";
import type { Ticker, Contract, Trade, TradeState } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { NowPanelEmpty } from "./NowPanelEmpty";
import { NowPanelSymbol } from "./NowPanelSymbol";
import { NowPanelTrade } from "./NowPanelTrade";
import { NowPanelManage } from "./NowPanelManage";

// Mode type for distinguishing Setup vs Manage mode
export type PanelMode = "setup" | "manage";

export interface NowPanelProps {
  focus: FocusTarget;
  activeTicker: Ticker | null;
  currentTrade: Trade | null;
  tradeState: TradeState;
  contracts: Contract[];
  activeTrades: Trade[];
  onContractSelect: (contract: Contract) => void;
  compositeSignals?: CompositeSignal[];
  // For symbol view - watchlist reference
  watchlist?: Ticker[];
  /** Whether a trade action is currently in progress */
  isTransitioning?: boolean;
}

export function NowPanel({
  focus,
  activeTicker,
  currentTrade,
  tradeState,
  contracts,
  activeTrades,
  onContractSelect,
  compositeSignals,
  watchlist = [],
  isTransitioning = false,
}: NowPanelProps) {
  // Determine panel mode based on trade state
  const mode: PanelMode = useMemo(() => {
    if (!focus || focus.kind === "symbol") return "setup";
    if (focus.kind === "trade") {
      // Use tradeState directly if we have currentTrade matching the focus
      // This ensures immediate switch when entering a trade
      if (currentTrade?.id === focus.tradeId && tradeState === "ENTERED") {
        return "manage";
      }
      // Find the trade to check its state from activeTrades
      const trade = activeTrades.find((t) => t.id === focus.tradeId);
      if (trade?.state === "ENTERED") return "manage";
    }
    return "setup";
  }, [focus, currentTrade, activeTrades, tradeState]);

  // Empty state - no focus target
  if (!focus) {
    return <NowPanelEmpty />;
  }

  // Symbol focus - show chart, options chain, best pick [SETUP MODE]
  if (focus.kind === "symbol") {
    // Disable auto-select if:
    // 1. There's a trade in LOADED/ENTERED state, OR
    // 2. A transition is in progress
    const hasActiveTrade = tradeState === "LOADED" || tradeState === "ENTERED";
    return (
      <NowPanelSymbol
        symbol={focus.symbol}
        activeTicker={activeTicker}
        contracts={contracts}
        onContractSelect={onContractSelect}
        compositeSignals={compositeSignals}
        watchlist={watchlist}
        disableAutoSelect={hasActiveTrade || isTransitioning}
      />
    );
  }

  // Trade focus - show trade details based on state
  if (focus.kind === "trade") {
    // Find the trade from activeTrades or currentTrade
    const trade =
      currentTrade?.id === focus.tradeId
        ? currentTrade
        : activeTrades.find((t) => t.id === focus.tradeId) || null;

    if (!trade) {
      return <NowPanelEmpty message="Trade not found" />;
    }

    // Use trade.state as the primary source of truth since it's directly from the trade object
    // This fixes race conditions where tradeState (from derived selectors) lags behind
    const effectiveState = trade.state;

    // WATCHING/LOADED state → Show symbol view (options chain) with selected contract
    // This keeps the options chain visible so user can change their contract selection
    // before entering the trade - they're still in "setup" mode
    if ((effectiveState === "WATCHING" || effectiveState === "LOADED") && activeTicker) {
      return (
        <NowPanelSymbol
          symbol={activeTicker.symbol}
          activeTicker={activeTicker}
          contracts={contracts}
          onContractSelect={onContractSelect}
          compositeSignals={compositeSignals}
          watchlist={watchlist}
          disableAutoSelect={true} // Already selected, don't re-trigger
        />
      );
    }

    // ENTERED state → Management Cockpit [MANAGE MODE]
    if (effectiveState === "ENTERED") {
      return <NowPanelManage trade={trade} activeTicker={activeTicker} watchlist={watchlist} />;
    }

    // EXITED → Trade recap panel [SETUP MODE]
    return (
      <NowPanelTrade
        trade={trade}
        tradeState={effectiveState}
        activeTicker={activeTicker}
        watchlist={watchlist}
      />
    );
  }

  // Fallback
  return <NowPanelEmpty />;
}

export default NowPanel;
