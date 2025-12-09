/**
 * NowPanel - Center Panel Component
 *
 * Displays contextual content based on the current focus target:
 * - focus === null → Empty state
 * - focus.kind === "symbol" → Symbol analysis (chart, chain, best pick)
 * - focus.kind === "trade" → Trade details (varies by state)
 */

import React from "react";
import type { FocusTarget } from "../../hooks/useTradeStateMachine";
import type { Ticker, Contract, Trade, TradeState } from "../../types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { NowPanelEmpty } from "./NowPanelEmpty";
import { NowPanelSymbol } from "./NowPanelSymbol";
import { NowPanelTrade } from "./NowPanelTrade";

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
  // Empty state - no focus target
  if (!focus) {
    return <NowPanelEmpty />;
  }

  // Symbol focus - show chart, options chain, best pick
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
