/**
 * NowPanel - Center Panel Component
 *
 * Displays contextual content based on the current focus target:
 * - focus === null → Empty state
 * - focus.kind === "symbol" → Symbol analysis (chart, chain, best pick) [SETUP MODE]
 * - focus.kind === "trade" → Trade details (varies by state)
 *   - WATCHING/LOADED → Setup-style view (NowPanelTrade)
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
}: NowPanelProps) {
  // Determine panel mode based on trade state
  const mode: PanelMode = useMemo(() => {
    if (!focus || focus.kind === "symbol") return "setup";
    if (focus.kind === "trade") {
      // Find the trade to check its state
      const trade =
        currentTrade?.id === focus.tradeId
          ? currentTrade
          : activeTrades.find((t) => t.id === focus.tradeId);

      // ENTERED state → Manage mode, everything else → Setup mode
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
    return (
      <NowPanelSymbol
        symbol={focus.symbol}
        activeTicker={activeTicker}
        contracts={contracts}
        onContractSelect={onContractSelect}
        compositeSignals={compositeSignals}
        watchlist={watchlist}
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

    // ENTERED state → Management Cockpit [MANAGE MODE]
    if (trade.state === "ENTERED") {
      return <NowPanelManage trade={trade} activeTicker={activeTicker} watchlist={watchlist} />;
    }

    // WATCHING/LOADED/EXITED → Standard trade panel [SETUP MODE]
    return (
      <NowPanelTrade
        trade={trade}
        tradeState={tradeState}
        activeTicker={activeTicker}
        watchlist={watchlist}
      />
    );
  }

  // Fallback
  return <NowPanelEmpty />;
}

export default NowPanel;
