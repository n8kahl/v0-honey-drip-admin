import React, { useEffect } from 'react';
import { Trade, Ticker, Challenge, DiscordChannel } from '../types';
import { HDPanelWatchlist } from './hd/HDPanelWatchlist';
import { HDVoiceHUD } from './hd/HDVoiceHUD';
import { HDDialogChallengeDetail } from './hd/HDDialogChallengeDetail';
import { HDMacroPanel } from './hd/HDMacroPanel';
import { MobileNowPlayingSheet } from './MobileNowPlayingSheet';
import { MobileWatermark } from './MobileWatermark';
import { useConfluenceData } from '../hooks/useConfluenceData';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { cn } from '../lib/utils';
import { streamingManager } from '../lib/massive/streaming-manager';
import { useTradeStateMachine } from '../hooks/useTradeStateMachine';
import { TradingWorkspace } from './trading/TradingWorkspace';
import { ActiveTradesPanel } from './trading/ActiveTradesPanel';
import { useStreamingOptionsChain } from '../hooks/useStreamingOptionsChain';
import { Contract, OptionType } from '../types';

import type { SymbolSignals } from '../hooks/useStrategyScanner';

interface DesktopLiveCockpitSlimProps {
  watchlist: Ticker[];
  hotTrades: Trade[];
  challenges: Challenge[];
  onTickerClick: (ticker: Ticker) => void;
  onHotTradeClick: (trade: Trade) => void; // legacy placeholder
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onAddChallenge?: () => void;
  onRemoveChallenge?: (challenge: Challenge) => void;
  onTradesChange?: (trades: Trade[]) => void;
  onExitedTrade?: (trade: Trade) => void;
  channels: DiscordChannel[];
  focusedTrade?: Trade | null;
  onMobileTabChange?: (tab: 'live' | 'active' | 'history' | 'settings') => void;
  hideDesktopPanels?: boolean;
  hideMobilePanelsOnActiveTab?: boolean;
  updatedTradeIds?: Set<string>;
  onOpenActiveTrade?: (tradeId: string) => void;
  onOpenReviewTrade?: (tradeId: string) => void;
  activeTab?: 'live' | 'active' | 'history' | 'settings';
  signalsBySymbol?: Map<string, SymbolSignals>; // Strategy signals
}

export function DesktopLiveCockpitSlim(props: DesktopLiveCockpitSlimProps) {
  const {
    watchlist,
    hotTrades,
    challenges,
    onTickerClick,
    onAddTicker,
    onRemoveTicker,
    onAddChallenge,
    signalsBySymbol,
    onRemoveChallenge,
    onTradesChange,
    onExitedTrade,
    channels,
    focusedTrade,
    onMobileTabChange,
    hideDesktopPanels,
    hideMobilePanelsOnActiveTab,
    onOpenActiveTrade,
    onOpenReviewTrade,
  } = props;

  const {
    activeTicker,
    contracts,
    currentTrade,
    tradeState,
    alertType,
    alertOptions,
    showAlert,
    activeTrades,
    actions,
  } = useTradeStateMachine({
    hotTrades,
    onTradesChange,
    onExitedTrade,
    focusedTrade,
    onMobileTabChange,
    confluence: undefined,
  });

  const confluence = useConfluenceData(currentTrade, tradeState);

  // Fetch options chain when activeTicker changes
  const { contracts: streamingContracts, loading: optionsLoading, error: optionsError, isStale: optionsStale, asOf: optionsAsOf } = useStreamingOptionsChain(activeTicker?.symbol || '');

  useEffect(() => {
    if (streamingContracts && activeTicker) {
      actions.setContracts(streamingContracts);
    }
  }, [streamingContracts, activeTicker, actions]);

  const voice = useVoiceCommands({
    watchlist,
    activeTrades,
    currentTrade,
    onAddTicker: () => {},
    onRemoveTicker,
    onEnterTrade: actions.handleEnterTrade,
    onTrimTrade: actions.handleTrim,
    onUpdateSL: actions.handleUpdateSL,
    onExitTrade: actions.handleExit,
    onAddPosition: actions.handleAdd,
  });

  useEffect(() => {
    const handles = watchlist.map(t => streamingManager.subscribe(t.symbol, ['quotes'], () => {}));
    return () => handles.forEach(h => streamingManager.unsubscribe(h));
  }, [watchlist]);
  useEffect(() => {
    const entered = activeTrades.filter(t => t.state === 'ENTERED');
    const handles = entered.map(trade => streamingManager.subscribe(trade.contract.id, ['quotes'], () => {}));
    return () => handles.forEach(h => streamingManager.unsubscribe(h));
  }, [activeTrades]);

  const handleTickerClick = (ticker: Ticker) => {
    actions.handleTickerClick(ticker);
    onTickerClick(ticker);
  };

  return (
    <>
      <div className={cn('relative flex flex-col lg:flex-row h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] overflow-hidden', hideMobilePanelsOnActiveTab ? 'hidden lg:flex' : '')}>
        {voice.hudState && (
          <div className="hidden lg:block">
            <HDVoiceHUD
              state={voice.hudState}
              transcript={voice.transcript}
              command={voice.command || undefined}
              error={voice.error}
              onConfirm={voice.confirmAction}
              onCancel={voice.cancelAction}
              onRetry={voice.retryAction}
            />
          </div>
        )}
        <div className={cn('w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[var(--border-hairline)] overflow-y-auto', hideDesktopPanels && 'hidden', hideMobilePanelsOnActiveTab && 'hidden lg:block')}>
          <div className="p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]"><HDMacroPanel /></div>
          <HDPanelWatchlist
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            allTrades={activeTrades}
            activeTicker={activeTicker?.symbol}
            expandLoadedList={false}
            onTickerClick={handleTickerClick}
            onHotTradeClick={(trade) => {
              actions.setCurrentTrade(trade);
              actions.setTradeState(trade.state);
              actions.setActiveTicker(watchlist.find(w => w.symbol === trade.ticker) || null);
            }}
            onChallengeClick={() => {}}
            onAddTicker={onAddTicker}
            onAddChallenge={onAddChallenge}
            onRemoveChallenge={onRemoveChallenge}
            onRemoveTicker={onRemoveTicker}
            onRemoveLoadedTrade={(trade: Trade) => actions.setActiveTrades(prev => prev.filter(t => t.id !== trade.id))}
            onOpenActiveTrade={onOpenActiveTrade}
            onOpenReviewTrade={onOpenReviewTrade}
            signalsBySymbol={signalsBySymbol}
          />
        </div>
        {/* Options chain area */}
        <div className="flex-1 relative flex flex-col">
          {optionsLoading && (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
              Loading options chain...
            </div>
          )}
          {optionsError && (
            <div className="flex-1 flex items-center justify-center text-[var(--text-danger)] text-sm">
              Error loading options chain: {optionsError}
            </div>
          )}
          {/* Subtle, non-blocking stale badge */}
          {optionsStale && !optionsLoading && !optionsError && (
            <div className="absolute top-2 right-2 z-10 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
              Stale · {optionsAsOf ? new Date(optionsAsOf).toLocaleTimeString() : 'unknown'}
            </div>
          )}
          {!optionsLoading && !optionsError && streamingContracts && streamingContracts.length > 0 && (
            <TradingWorkspace
              watchlist={watchlist}
              activeTicker={activeTicker}
              contracts={contracts}
              currentTrade={currentTrade}
              tradeState={tradeState}
              showAlert={showAlert}
              confluence={confluence}
              alertType={alertType}
              onContractSelect={(contract, confluenceData) => 
                actions.handleContractSelect(contract, confluenceData || confluence)
              }
              onEnterTrade={actions.handleEnterTrade}
              onDiscard={actions.handleDiscard}
              onAutoTrim={() => actions.handleTrim()}
              signalsBySymbol={signalsBySymbol}
            />
          )}
        </div>
        <ActiveTradesPanel
          tradeState={tradeState}
          currentTrade={currentTrade}
          showAlert={showAlert}
          alertType={alertType}
          alertOptions={alertOptions}
          channels={channels}
          challenges={challenges}
          onSendAlert={actions.handleSendAlert}
          onEnterAndAlert={actions.handleEnterAndAlert}
          onCancelAlert={actions.handleCancelAlert}
          onUnload={actions.handleUnloadTrade}
          onEnter={actions.handleEnterTrade}
          onTrim={actions.handleTrim}
          onUpdate={actions.handleUpdate}
          onUpdateSL={actions.handleUpdateSL}
          onTrailStop={actions.handleTrailStop}
          onAdd={actions.handleAdd}
          onExit={actions.handleExit}
        />
        <HDDialogChallengeDetail
          open={false}
          onOpenChange={() => {}}
          challenge={null}
          trades={activeTrades}
          channels={channels}
          onTradeClick={(trade) => {
            if (trade.state === 'ENTERED' && onOpenActiveTrade) onOpenActiveTrade(trade.id);
            else if (trade.state === 'EXITED' && onOpenReviewTrade) onOpenReviewTrade(trade.id);
          }}
        />
      </div>
      <div className="lg:hidden">
        <MobileNowPlayingSheet
          trade={currentTrade}
          ticker={activeTicker?.symbol}
          state={tradeState}
          hideWhenAlert={showAlert}
          confluence={!showAlert && tradeState === 'ENTERED' ? confluence : undefined}
          onEnter={actions.handleEnterTrade}
          onDiscard={actions.handleDiscard}
          onAction={(type) => {
            if (type === 'trim') actions.handleTrim();
            else if (type === 'update-sl') actions.handleUpdateSL();
            else if (type === 'update') actions.handleUpdate();
            else if (type === 'add') actions.handleAdd();
            else if (type === 'exit') actions.handleExit();
          }}
        />
      </div>
      {showAlert && currentTrade && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-[var(--bg-base)] flex flex-col">
          <ActiveTradesPanel
            tradeState={tradeState}
            currentTrade={currentTrade}
            showAlert={showAlert}
            alertType={alertType}
            alertOptions={alertOptions}
            channels={channels}
            challenges={challenges}
            onSendAlert={actions.handleSendAlert}
            onEnterAndAlert={actions.handleEnterAndAlert}
            onCancelAlert={actions.handleCancelAlert}
            onUnload={actions.handleUnloadTrade}
            onEnter={actions.handleEnterTrade}
            onTrim={actions.handleTrim}
            onUpdate={actions.handleUpdate}
            onUpdateSL={actions.handleUpdateSL}
            onTrailStop={actions.handleTrailStop}
            onAdd={actions.handleAdd}
            onExit={actions.handleExit}
          />
        </div>
      )}
      <div className="lg:hidden"><MobileWatermark /></div>
    </>
  );
}
