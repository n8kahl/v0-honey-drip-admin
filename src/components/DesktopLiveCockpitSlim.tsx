import React, { useEffect } from "react";
import { Trade, Ticker, Challenge, DiscordChannel } from "../types";
import { HDPanelWatchlist } from "./hd/dashboard/HDPanelWatchlist";
import { HDMacroPanel } from "./hd/dashboard/HDMacroPanel";
import { HDWatchlistRail } from "./hd/layout/HDWatchlistRail";
import { HDPortfolioRail } from "./hd/layout/HDPortfolioRail";
import { MobileNowPlayingSheet } from "./MobileNowPlayingSheet";
import { MobileWatermark } from "./MobileWatermark";

import { useTradeStateMachine } from "../hooks/useTradeStateMachine";
import { useKeyLevels } from "../hooks/useKeyLevels";
import { NowPanel } from "./trading/NowPanel";
import { useStreamingOptionsChain } from "../hooks/useStreamingOptionsChain";
import type { CompositeSignal } from "../lib/composite/CompositeSignal";
import { useTradeStore } from "../stores/tradeStore";

// Default confluence object to prevent undefined errors in child components
const DEFAULT_CONFLUENCE = {
  loading: false,
  error: undefined,
  trend: undefined,
  volatility: undefined,
  liquidity: undefined,
};

interface DesktopLiveCockpitSlimProps {
  watchlist: Ticker[];
  challenges: Challenge[];
  onTickerClick: (ticker: Ticker) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onAddChallenge?: () => void;
  onRemoveChallenge?: (challenge: Challenge) => void;
  onExitedTrade?: (trade: Trade) => void;
  onEnteredTrade?: (trade: Trade) => void;
  channels: DiscordChannel[];
  onMobileTabChange?: (tab: "live" | "active" | "history" | "settings") => void;
  onOpenActiveTrade?: (tradeId: string) => void;
  onOpenReviewTrade?: (tradeId: string) => void;
  activeTab?: "live" | "active" | "history" | "settings";
  compositeSignals?: CompositeSignal[];
}

export function DesktopLiveCockpitSlim(props: DesktopLiveCockpitSlimProps) {
  const {
    watchlist,
    challenges,
    onTickerClick,
    onAddTicker,
    onRemoveTicker,
    onAddChallenge,
    compositeSignals,
    onRemoveChallenge,
    onExitedTrade,
    onEnteredTrade,
    channels, // Passed to NowPanel for alerts
    onMobileTabChange,
    onOpenActiveTrade,
    onOpenReviewTrade,
  } = props;

  // Store access for direct state updates
  const deleteTrade = useTradeStore((s) => s.deleteTrade);

  // Compute keyLevels for active ticker in real-time
  // Get current trade from store to compute keyLevels
  const storeCurrentTrade = useTradeStore((s) => s.getCurrentTrade());
  const levelsTicker = storeCurrentTrade?.ticker || "";
  const { keyLevels: computedKeyLevels } = useKeyLevels(levelsTicker, {
    timeframe: "5",
    lookbackDays: 5,
    orbWindow: 5,
    enabled: Boolean(levelsTicker),
  });

  const {
    activeTicker,
    contracts,
    currentTrade,
    tradeState,
    showAlert: _showAlert, // No longer used - alerts in NowPanel
    alertType: _alertType,
    alertOptions: _alertOptions,
    activeTrades,
    focus,
    isTransitioning,
    actions,
  } = useTradeStateMachine({
    onExitedTrade,
    onEnteredTrade,
    onMobileTabChange,
    keyLevels: computedKeyLevels,
  });

  // Fetch options chain when activeTicker changes
  const {
    contracts: streamingContracts,
    loading: optionsLoading,
    error: optionsError,
    isStale: optionsStale,
    asOf: optionsAsOf,
  } = useStreamingOptionsChain(activeTicker?.symbol || "");

  useEffect(() => {
    if (streamingContracts && activeTicker) {
      actions.setContracts(streamingContracts);
    }
  }, [streamingContracts, activeTicker, actions]);

  // NOTE: Removed empty subscription callbacks that were causing console noise
  // Quote data is fetched via useQuotes() hook in useMassiveData.ts which properly handles updates

  const handleTickerClick = (ticker: Ticker) => {
    actions.handleTickerClick(ticker);
    onTickerClick(ticker);
  };

  return (
    <>
      {/* Desktop: 3-Pane Grid Layout [280px | 1fr | 320px] */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr_320px] h-[calc(100vh-8rem)] overflow-hidden">
        {/* LEFT: HDWatchlistRail - Discovery (Watchlist + Challenges) */}
        <div className="overflow-hidden">
          <HDWatchlistRail
            onTickerClick={handleTickerClick}
            onAddTicker={onAddTicker}
            onRemoveTicker={onRemoveTicker}
            activeTicker={activeTicker?.symbol}
          />
        </div>

        {/* CENTER: NowPanel - Single focus target display */}
        <div className="min-w-0 overflow-hidden relative flex flex-col border-x border-[var(--border-hairline)]">
          {/* Loading/Error states */}
          {activeTicker && optionsLoading && (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
                Loading options chain for {activeTicker.symbol}...
              </div>
            </div>
          )}
          {activeTicker && optionsError && (
            <div className="flex-1 flex items-center justify-center text-[var(--accent-negative)] text-sm">
              Error loading options chain: {optionsError}
            </div>
          )}
          {/* Subtle, non-blocking stale badge - HIDE when trade is focused (NowPanelManage shows its own) */}
          {optionsStale && !optionsLoading && !optionsError && focus?.kind !== "trade" && (
            <div className="absolute top-2 right-2 z-10 text-xs text-[var(--data-stale)] bg-[var(--data-stale)]/10 border border-[var(--data-stale)]/30 rounded px-2 py-1">
              Stale · {optionsAsOf ? new Date(optionsAsOf).toLocaleTimeString() : "unknown"}
            </div>
          )}
          {/* NowPanel - handles empty, symbol, and trade focus states */}
          {!optionsLoading && !optionsError && (
            <NowPanel
              focus={focus}
              activeTicker={activeTicker}
              currentTrade={currentTrade}
              tradeState={tradeState}
              contracts={contracts}
              activeTrades={activeTrades}
              onContractSelect={(contract, options) =>
                actions.handleContractSelect(contract, options)
              }
              onLoadStrategy={(contract, options) => actions.handleLoadStrategy(contract, options)}
              compositeSignals={compositeSignals}
              watchlist={watchlist}
              isTransitioning={isTransitioning}
              channels={channels}
              challenges={challenges}
              // Action callbacks for NowPanelManage (absorbed from ActionRail)
              onTrim={actions.handleTrim}
              onMoveSLToBreakeven={actions.handleUpdateSL}
              onTrailStop={actions.handleTrailStop}
              onAdd={actions.handleAdd}
              onExit={(sendAlert) => actions.handleExit(sendAlert)}
              onTakeProfit={(sendAlert) => actions.handleTakeProfit(sendAlert)}
              onBroadcastUpdate={(_message) => {
                // Broadcast update to Discord channels linked to the trade
                if (currentTrade) {
                  actions.handleUpdate();
                }
              }}
            />
          )}
        </div>

        {/* RIGHT: Portfolio Rail - Active & Loaded Trades */}
        <HDPortfolioRail
          activeTrades={activeTrades.filter((t) => t.state === "ENTERED")}
          loadedTrades={activeTrades.filter((t) => t.state === "LOADED")}
          onTradeClick={(trade) => actions.handleActiveTradeClick(trade, watchlist)}
        />
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-7rem)] overflow-hidden">
        {/* Mobile: Show full panel */}
        <div className="w-full lg:hidden border-b border-[var(--border-hairline)] overflow-y-auto">
          <div className="p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <HDMacroPanel />
          </div>
          <HDPanelWatchlist
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            allTrades={activeTrades}
            activeTicker={activeTicker?.symbol}
            expandLoadedList={false}
            onTickerClick={handleTickerClick}
            onHotTradeClick={(trade) => {
              // Use the proper handler for trade clicks
              actions.handleActiveTradeClick(trade, watchlist);
            }}
            onChallengeClick={() => {}}
            onAddTicker={onAddTicker}
            onAddChallenge={onAddChallenge}
            onRemoveChallenge={onRemoveChallenge}
            onRemoveTicker={onRemoveTicker}
            onRemoveLoadedTrade={async (trade: Trade) => {
              // Use deleteTrade from store - it optimistically removes from state AND deletes from DB
              try {
                await deleteTrade(trade.id);
              } catch (error) {
                console.error("Failed to remove trade:", error);
              }
            }}
            onOpenActiveTrade={onOpenActiveTrade}
            onOpenReviewTrade={onOpenReviewTrade}
            compositeSignals={compositeSignals}
          />
        </div>
      </div>

      {/* Mobile Components */}
      <div className="lg:hidden">
        <MobileNowPlayingSheet
          trade={currentTrade}
          ticker={activeTicker?.symbol}
          state={tradeState}
          hideWhenAlert={_showAlert}
          confluence={DEFAULT_CONFLUENCE}
          onEnter={actions.handleEnterTrade}
          onDiscard={actions.handleDiscard}
          onAction={(type) => {
            if (type === "trim") actions.handleTrim();
            else if (type === "update-sl") actions.handleUpdateSL();
            else if (type === "update") actions.handleUpdate();
            else if (type === "add") actions.handleAdd();
            else if (type === "exit") actions.handleExit();
          }}
        />
      </div>
      <div className="lg:hidden">
        <MobileWatermark />
      </div>
    </>
  );
}
