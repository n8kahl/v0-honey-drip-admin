/* DEPRECATED: Legacy DesktopLiveCockpit retained for reference.
  Use DesktopLiveCockpitSlim instead. Original code commented out below. */
/*
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

interface DesktopLiveCockpitProps {
  watchlist: Ticker[];
  hotTrades: Trade[];
  challenges: Challenge[];
  onTickerClick: (ticker: Ticker) => void;
  onHotTradeClick: (trade: Trade) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onAddChallenge?: () => void;
  onRemoveChallenge?: (challenge: Challenge) => void;
  onTradesChange?: (trades: Trade[]) => void; // Callback to sync active trades to parent
  onExitedTrade?: (trade: Trade) => void; // Callback when a trade is exited
  channels: DiscordChannel[];
  focusedTrade?: Trade | null; // Trade to focus when coming from another tab
  onMobileTabChange?: (tab: 'live' | 'active' | 'history' | 'settings') => void; // Mobile tab switching
  hideDesktopPanels?: boolean; // Hide all panels except MobileNowPlayingSheet (for when on active tab)
  hideMobilePanelsOnActiveTab?: boolean; // Hide main content on mobile when on active tab
  updatedTradeIds?: Set<string>; // Track which trades just updated for flash effect
  onOpenActiveTrade?: (tradeId: string) => void; // Navigate to active trade
  onOpenReviewTrade?: (tradeId: string) => void; // Navigate to review trade
  activeTab?: 'live' | 'active' | 'history' | 'settings'; // Current active tab for closing modals
}

export function DesktopLiveCockpit(props: DesktopLiveCockpitProps) {
  const {
    watchlist,
    hotTrades,
    challenges,
    onTickerClick,
    onAddTicker,
    onRemoveTicker,
    onAddChallenge,
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
  
  // Fetch key technical levels (ORB, VWAP, Bollinger, pivots) from historical bars
  const { keyLevels, loading: keyLevelsLoading } = useKeyLevels(
    activeTicker?.symbol || '',
    { timeframe: '5', lookbackDays: 5, orbWindow: 5, enabled: !!activeTicker?.symbol }
  );
  
  // New streaming hook for options chain
  const streamingContracts = useStreamingOptionsChain(activeTicker?.symbol || '');
  
  useEffect(() => {
    if (streamingContracts && activeTicker) {
      console.log(`[DesktopLiveCockpit] Received ${streamingContracts.length} contracts for ${activeTicker.symbol}`);
      if (streamingContracts.length > 0) {
        console.log('[DesktopLiveCockpit] Sample contract strikes:', streamingContracts.slice(0, 5).map((c: any) => c.strike_price));
        console.log('[DesktopLiveCockpit] Sample expiration dates:', streamingContracts.slice(0, 3).map((c: any) => c.expiration_date));
      }
      const realContracts: Contract[] = streamingContracts.map((opt: any) => {
        const expiryDate = new Date(opt.expiration_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: opt.ticker || `${activeTicker.symbol}-${opt.strike_price}-${opt.expiration_date}-${opt.contract_type}`,
          ticker: activeTicker.symbol,
          strike: opt.strike_price,
          expiry: opt.expiration_date,
          expiryDate,
          daysToExpiry,
          type: opt.contract_type === 'call' ? 'C' as OptionType : 'P' as OptionType,
          bid: opt.last_quote?.bid || 0,
          ask: opt.last_quote?.ask || 0,
          mid: opt.last_quote?.midpoint || ((opt.last_quote?.bid || 0) + (opt.last_quote?.ask || 0)) / 2,
          iv: opt.implied_volatility || 0,
          delta: opt.greeks?.delta || 0,
          gamma: opt.greeks?.gamma || 0,
          theta: opt.greeks?.theta || 0,
          vega: opt.greeks?.vega || 0,
          volume: opt.day?.volume || 0,
          openInterest: opt.open_interest || 0,
        };
      });
      
      setContracts(realContracts);
    }
  }, [streamingContracts, activeTicker]);
  
  const openAlertComposer = (type: AlertType, options?: { updateKind?: 'trim' | 'generic' | 'sl' }) => {
    setAlertType(type);
    setAlertOptions(options || {});
    setShowAlert(true);
  };
  
  // Default to unified chain unless explicitly disabled
  const USE_UNIFIED_CHAIN = ((import.meta as any)?.env?.VITE_USE_UNIFIED_CHAIN ?? 'true') === 'true';

  const handleTickerClick = (ticker: Ticker) => {
    actions.handleTickerClick(ticker);
    onTickerClick(ticker);
  };
  
  const handleContractSelect = (contract: Contract) => {
    if (!activeTicker) return;
    
    // Fix #4: Calculate initial TP/SL for LOADED state using risk engine
    let targetPrice = contract.mid * 1.5;  // Default fallback
    let stopLoss = contract.mid * 0.5;     // Default fallback
    
    try {
      // Infer trade type from DTE
      const tradeType = inferTradeTypeByDTE(
        contract.expiry,
        new Date(),
        DEFAULT_DTE_THRESHOLDS
      );
      
      // Use key levels if available (they should be fetched by now)
      const levelsForCalculation = keyLevels || {
        preMarketHigh: 0,
        preMarketLow: 0,
        orbHigh: 0,
        orbLow: 0,
        priorDayHigh: 0,
        priorDayLow: 0,
        vwap: 0,
        vwapUpperBand: 0,
        vwapLowerBand: 0,
        bollingerUpper: 0,
        bollingerLower: 0,
        weeklyHigh: 0,
        weeklyLow: 0,
        monthlyHigh: 0,
        monthlyLow: 0,
        quarterlyHigh: 0,
        quarterlyLow: 0,
        yearlyHigh: 0,
        yearlyLow: 0,
      };
      
      // Get base profile and adjust by confluence metrics if available
      let riskProfile = RISK_PROFILES[tradeType];
      
      if (confluence.trend || confluence.volatility || confluence.liquidity) {
        riskProfile = adjustProfileByConfluence(riskProfile, {
          trend: confluence.trend,
          volatility: confluence.volatility,
          liquidity: confluence.liquidity,
        });
      }
      
      // Calculate TP/SL for preview
      const riskResult = calculateRisk({
        entryPrice: contract.mid,
        currentUnderlyingPrice: contract.mid,
        currentOptionMid: contract.mid,
        keyLevels: levelsForCalculation,
        expirationISO: contract.expiry,
        tradeType,
        delta: contract.delta || 0.5,
        gamma: contract.gamma || 0,
        defaults: {
          mode: 'percent' as const,
          tpPercent: 50,
          slPercent: 50,
          dteThresholds: DEFAULT_DTE_THRESHOLDS,
        },
      });
      
      if (riskResult.targetPrice) {
        targetPrice = riskResult.targetPrice;
      }
      if (riskResult.stopLoss) {
        stopLoss = riskResult.stopLoss;
      }
      
      console.log(
        '[v0] LOADED state: Calculated TP =',
        targetPrice.toFixed(2),
        ', SL =',
        stopLoss.toFixed(2),
        'for',
        tradeType,
        'trade'
      );
    } catch (err) {
      console.warn('[v0] Failed to calculate LOAD targets, using defaults:', err);
      // Fallback to defaults if calculation fails
    }
    
    const handleContractSelect = (contract: any) => actions.handleContractSelect(contract);
        const levelsForCalculation = keyLevels || {
          preMarketHigh: 0,
          preMarketLow: 0,
          const handleSendAlert = actions.handleSendAlert;
          const handleEnterTrade = () => actions.handleEnterTrade();
          const handleEnterAndAlert = actions.handleEnterAndAlert;
          const handleDiscard = actions.handleDiscard;
          const handleCancelAlert = actions.handleCancelAlert;
          const handleUnloadTrade = actions.handleUnloadTrade;
          const handleTrim = actions.handleTrim;
          const handleUpdate = actions.handleUpdate;
          const handleUpdateSL = actions.handleUpdateSL;
          const handleTrailStop = actions.handleTrailStop;
          const handleAdd = actions.handleAdd;
          const handleExit = actions.handleExit;
          stopLoss = riskResult.stopLoss;
          console.log('[v0] Entry: Recalculated SL =', stopLoss.toFixed(2), 'from', tradeType, 'profile');
        }
      } catch (err) {
        console.warn('[v0] Failed to recalculate TP/SL on entry, using defaults:', err);
        // Fallback to defaults if calculation fails
      }
      
      const finalTrade = {
        ...currentTrade,
        state: 'ENTERED' as TradeState,
        discordChannels: selectedChannels.filter(c => c && c.id).map(c => c.id),
        challenges: challengeIds,
        entryPrice,
        entryTime: new Date(),
        targetPrice,  // ← Updated with recalculation
        stopLoss,     // ← Updated with recalculation
        updates: [...previousUpdates, enterUpdate],
      };

      setActiveTrades(prev =>
        prev.map(t => (t.id === currentTrade.id ? finalTrade : t))
      );
      setCurrentTrade(finalTrade);
      setTradeState('ENTERED');
      setShowAlert(false);
      
      showAlertToast('enter', currentTrade.ticker, selectedChannels);
      
      // Fix #5: Persist updated TP/SL to Supabase database
      (async () => {
        try {
          await updateTrade(finalTrade.id, {
            state: 'ENTERED',
            entry_price: entryPrice,
            entry_time: finalTrade.entryTime?.toISOString(),
            target_price: targetPrice,
            stop_loss: stopLoss,
          });
          console.log('[v0] Trade entered and saved to database:', {
            id: finalTrade.id,
            entryPrice,
            targetPrice,
            stopLoss,
          });
        } catch (err) {
          console.error('[v0] Failed to save entered trade to database:', err);
          toast.error('Warning: Trade updated locally but failed to save to database');
        }
      })();
      
      if (onMobileTabChange) {
        setTimeout(() => {
          onMobileTabChange('active');
        }, 100);
      }
      return;
    }

    if (alertType === 'exit') {
      const exitUpdate = createUpdate('exit');
      const previousUpdates = currentTrade.updates || [];
      
      const exitedTrade = {
        ...updatedTrade,
        state: 'EXITED' as TradeState,
        updates: [...previousUpdates, exitUpdate],
      };

      setActiveTrades(prev => prev.filter(t => t.id !== currentTrade.id));
      setCurrentTrade(exitedTrade);
      setTradeState('EXITED');
      setShowAlert(false);
      
      const pnlText = currentTrade.movePercent 
        ? ` (${currentTrade.movePercent > 0 ? '+' : ''}${currentTrade.movePercent.toFixed(1)}%)` 
        : '';
      showAlertToast('exit', currentTrade.ticker, selectedChannels, currentTrade.movePercent);
      
      if (onExitedTrade) {
        onExitedTrade(exitedTrade);
      }
      return;
    }

    if (alertType === 'trail-stop') {
      const trailStopUpdate = createUpdate('trail-stop');
      const previousUpdates = currentTrade.updates || [];
      
      const finalTrade = {
        ...updatedTrade,
        state: 'ENTERED' as TradeState,
        stopMode: 'trailing' as const,
        updates: [...previousUpdates, trailStopUpdate],
      };

      setActiveTrades(prev =>
        prev.map(t => (t.id === currentTrade.id ? finalTrade : t))
      );
      setCurrentTrade(finalTrade);
      setTradeState('ENTERED');
      setShowAlert(false);
      
      showAlertToast('trail-stop', currentTrade.ticker, selectedChannels);
      return;
    }

    if (alertType === 'update') {
      let updateType: TradeUpdate['type'] = 'update';
      let toastMessage = 'Update sent';
      
      if (alertOptions?.updateKind === 'trim') {
        updateType = 'trim';
        toastMessage = 'Trim alert sent';
      } else if (alertOptions?.updateKind === 'sl') {
        updateType = 'update-sl';
        toastMessage = 'Stop loss updated';
      } else {
        updateType = 'update';
        toastMessage = 'Position updated';
      }
      
      const updateEntry = createUpdate(updateType);
      const previousUpdates = currentTrade.updates || [];
      
      const finalTrade = {
        ...updatedTrade,
        state: 'ENTERED' as TradeState,
        updates: [...previousUpdates, updateEntry],
      };

      setActiveTrades(prev =>
        prev.map(t => (t.id === currentTrade.id ? finalTrade : t))
      );
      setCurrentTrade(finalTrade);
      setTradeState('ENTERED');
      setShowAlert(false);
      
      showAlertToast(updateType, currentTrade.ticker, selectedChannels);
      return;
    }

    if (alertType === 'add') {
      const addUpdate = createUpdate('add');
      const previousUpdates = currentTrade.updates || [];
      
      const finalTrade = {
        ...updatedTrade,
        state: 'ENTERED' as TradeState,
        updates: [...previousUpdates, addUpdate],
      };

      setActiveTrades(prev =>
        prev.map(t => (t.id === currentTrade.id ? finalTrade : t))
      );
      setCurrentTrade(finalTrade);
      setTradeState('ENTERED');
      setShowAlert(false);
      
      showAlertToast('add', currentTrade.ticker, selectedChannels);
      return;
    }
  };
  
  const handleEnterTrade = () => {
    setAlertType('enter');
    setShowAlert(true);
    
    if (isMobile && onMobileTabChange) {
      onMobileTabChange('active');
    }
  };
  
  const handleDiscard = () => {
    if (currentTrade && currentTrade.state === 'LOADED') {
      setActiveTrades(prev => prev.filter(t => t.id !== currentTrade.id));
    }
    
    setCurrentTrade(null);
    setTradeState('WATCHING');
    setShowAlert(false);
  };
  
  const handleCancelAlert = () => {
    setShowAlert(false);
    
    if (isMobile && onMobileTabChange) {
      onMobileTabChange('live');
    }
  };
  
  const handleUnloadTrade = () => {
    if (currentTrade && currentTrade.state === 'LOADED') {
      setActiveTrades(prev => prev.filter(t => t.id !== currentTrade.id));
      toast.success(`${currentTrade.ticker} unloaded from watchlist`);
    }
    
    setCurrentTrade(null);
    setTradeState('WATCHING');
    setShowAlert(false);
    
    if (window.innerWidth < 1024 && onMobileTabChange) {
      onMobileTabChange('live');
    }
  };
  
  const handleRemoveLoadedTrade = (trade: Trade) => {
    setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
    toast.success(`${trade.ticker} removed from loaded trades`);
    
    if (currentTrade?.id === trade.id) {
      setCurrentTrade(null);
      setTradeState('WATCHING');
      setShowAlert(false);
    }
  };
  
  const handleEnterAndAlert = (
    channelIds: string[],
    challengeIds: string[],
    comment?: string
  ) => {
    if (!currentTrade) return;
    
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    
    const entryPrice = currentTrade.entryPrice || currentTrade.contract.mid;
    const targetPrice = currentTrade.targetPrice || currentTrade.contract.mid * 1.5;
    const stopLoss = currentTrade.stopLoss || currentTrade.contract.mid * 0.5;
    
    const enteredTrade: Trade = {
      ...currentTrade,
      state: 'ENTERED',
      entryPrice,
      currentPrice: entryPrice,
      targetPrice,
      stopLoss,
      movePercent: 0,
      discordChannels: channelIds,
      challenges: challengeIds,
      updates: [
        ...(currentTrade.updates || []),
        {
          id: `${currentTrade.id}-enter-${Date.now()}`,
          type: 'enter',
          timestamp: new Date(),
          message: comment || 'Entered position',
          price: entryPrice || currentTrade.contract.mid,
        },
      ],
    };
    
    setActiveTrades(prev => {
      const existingIndex = prev.findIndex(t => t.id === currentTrade.id);
      if (existingIndex >= 0) {
        return prev.map(t => t.id === currentTrade.id ? enteredTrade : t);
      } else {
        return [...prev, enteredTrade];
      }
    });
    setCurrentTrade(enteredTrade);
    setTradeState('ENTERED');
    
    showAlertToast('enter', currentTrade.ticker, selectedChannels);
    
    setShowAlert(false);
    
    if (window.innerWidth < 1024 && onMobileTabChange) {
      onMobileTabChange('active');
    }
  };
  
  const handleTrim = () => {
    if (!currentTrade) return;
    openAlertComposer('update', { updateKind: 'trim' });
  };

  const handleUpdate = () => {
    if (!currentTrade) return;
    openAlertComposer('update', { updateKind: 'generic' });
  };

  const handleUpdateSL = () => {
    if (!currentTrade) return;
    openAlertComposer('update', { updateKind: 'sl' });
  };

  const handleTrailStop = () => {
    if (!currentTrade) return;
    openAlertComposer('trail-stop');
  };

  const handleAdd = () => {
    if (!currentTrade) return;
    openAlertComposer('add');
  };

  const handleExit = () => {
    if (!currentTrade) return;
    openAlertComposer('exit');
  };
  
  const voice = useVoiceCommands({
    watchlist,
    activeTrades,
    currentTrade,
    onAddTicker: () => {},
    onRemoveTicker,
    onEnterTrade: handleEnterTrade,
    onTrimTrade: handleTrim,
    onUpdateSL: handleUpdateSL,
    onExitTrade: handleExit,
    onAddPosition: handleAdd,
  });
  
  const getVoiceState = (): 'idle' | 'listening' | 'processing' => {
    if (!voice.isListening) return 'idle';
    if (voice.hudState === 'processing') return 'processing';
    return 'listening';
  };
  
  useEffect(() => {
    const handles = watchlist.map(ticker => 
      streamingManager.subscribe(ticker.symbol, ['quotes'], (data) => {
        // Updates handled by individual useStreamingQuote hooks
      })
    );
    
    return () => {
      handles.forEach(handle => streamingManager.unsubscribe(handle));
    };
  }, [watchlist]);
  
  useEffect(() => {
    const enteredTrades = activeTrades.filter(t => t.state === 'ENTERED');
    if (enteredTrades.length === 0) return;
    
    const handles = enteredTrades.map(trade => 
      streamingManager.subscribe(trade.contract.id, ['quotes', 'agg1s'], (data) => {
        // Updates handled by HDEnteredTradeCard components
      })
    );
    
    return () => {
      handles.forEach(handle => streamingManager.unsubscribe(handle));
    };
  }, [activeTrades]);
  
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
        
        <div className={`
          w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[var(--border-hairline)] 
          overflow-y-auto
          ${hideDesktopPanels ? 'hidden' : ''}
          ${hideMobilePanelsOnActiveTab ? 'hidden lg:block' : ''}
          ${!hideDesktopPanels && !hideMobilePanelsOnActiveTab && ((tradeState === 'WATCHING' && contracts.length === 0) || tradeState === 'LOADED' || tradeState === 'ENTERED') ? 'flex-1 lg:flex-initial' : 'hidden lg:block'}
        `}>
          <div className="p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <HDMacroPanel />
          </div>
          
          <HDPanelWatchlist
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            allTrades={activeTrades}
            activeTicker={activeTicker?.symbol}
            expandLoadedList={expandedLoadedList}
            onTickerClick={handleTickerClick}
            onHotTradeClick={(trade) => {
              setCurrentTrade(trade);
              setTradeState(trade.state);
              setActiveTicker(watchlist.find(t => t.symbol === trade.ticker) || null);
              
              if (isMobile && trade.state === 'LOADED') {
                setShowAlert(true);
                setAlertType('enter');
              } else {
                setShowAlert(false);
              }
            }}
            onChallengeClick={(challenge) => {
              setSelectedChallenge(challenge);
              setShowChallengeDetail(true);
            }}
            onAddTicker={onAddTicker}
            onAddChallenge={onAddChallenge}
            onRemoveChallenge={onRemoveChallenge}
            onRemoveTicker={onRemoveTicker}
            onRemoveLoadedTrade={handleRemoveLoadedTrade}
            onOpenActiveTrade={onOpenActiveTrade}
            onOpenReviewTrade={onOpenReviewTrade}
          />
        </div>
        
        <div className={`
          flex-1 overflow-y-auto bg-[#0a0a0a] relative
          ${hideDesktopPanels ? 'hidden' : ''}
          ${!hideDesktopPanels && (tradeState === 'LOADED' || tradeState === 'ENTERED') ? 'hidden lg:block' : ''}
          ${!hideDesktopPanels && (tradeState === 'WATCHING' && !activeTicker) ? 'hidden lg:flex lg:flex-1' : ''}
          ${!hideDesktopPanels && (tradeState === 'WATCHING' && activeTicker) ? 'flex-1' : ''}
        `}>
          <MobileWatermark />
          
          {tradeState === 'WATCHING' && activeTicker ? (
            <div className="p-4 lg:p-6 space-y-3 pointer-events-auto relative z-10">
              <HDLiveChart
                ticker={activeTicker.symbol}
                timeframe="5"
                indicators={{
                  ema: { periods: [8, 21, 50, 200] },
                  vwap: { enabled: true, bands: false },
                }}
                events={[]}
                height={280}
              />
              
              {contracts.length > 0 ? (
                <HDContractGrid
                  contracts={contracts}
                  currentPrice={watchlist.find(t => t.symbol === activeTicker.symbol)?.last || activeTicker.last}
                  ticker={activeTicker.symbol}
                  onContractSelect={handleContractSelect}
                />
              ) : (
                <div className="flex items-center justify-center p-8 text-gray-400 text-sm">
                  Loading contracts for {activeTicker.symbol}...
                </div>
              )}
            </div>
          ) : tradeState === 'LOADED' && currentTrade && !showAlert ? (
            <div className="p-4 lg:p-6 pointer-events-auto">
              <HDLoadedTradeCard
                trade={currentTrade}
                onEnter={handleEnterTrade}
                onDiscard={handleDiscard}
                underlyingPrice={activeTicker?.last}
                underlyingChange={activeTicker?.changePercent}
                confluence={{
                  loading: confluence.loading,
                  error: confluence.error,
                  trend: confluence.trend,
                  volatility: confluence.volatility,
                  liquidity: confluence.liquidity,
                }}
              />
            </div>
          ) : tradeState === 'ENTERED' && currentTrade && !showAlert ? (
            <div className="p-4 lg:p-6 pointer-events-auto">
              <HDEnteredTradeCard
                trade={currentTrade}
                direction={currentTrade.contract.type === 'C' ? 'call' : 'put'}
                confluence={{
                  loading: confluence.loading,
                  error: confluence.error,
                  trend: confluence.trend,
                  volatility: confluence.volatility,
                  liquidity: confluence.liquidity,
                }}
              />
            </div>
          ) : showAlert ? (
            <div className="hidden lg:block p-4 lg:p-6 pointer-events-auto">
              {currentTrade && (
                <HDPanelFocusedTrade
                  trade={currentTrade}
                  ticker={activeTicker?.symbol}
                  state={tradeState}
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
                <img 
                  src="/src/assets/1ccfd6d57f7ce66b9991f55ed3e9ec600aadd57a.png" 
                  alt="Honey Drip"
                  className="w-auto h-[50vh] max-w-[60vw] object-contain"
                  onError={(e) => {
                    console.log('[v0] Watermark image failed to load:', e.currentTarget.src);
                  }}
                  onLoad={() => {
                    console.log('[v0] Watermark image loaded successfully');
                  }}
                />
              </div>
              
              <div className="relative z-10 text-center space-y-4 max-w-md">
                <h3 className="text-xl lg:text-2xl font-semibold text-white">
                  Honey Drip Admin
                </h3>
                <p className="text-gray-400 text-sm lg:text-base leading-relaxed">
                  Select a Ticker from the Watchlist or Loaded Trades to begin
                </p>
              </div>
            </div>
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
          onSendAlert={handleSendAlert}
          onEnterAndAlert={handleEnterAndAlert}
          onCancelAlert={handleCancelAlert}
          onUnload={handleUnloadTrade}
          onEnter={handleEnterTrade}
          onTrim={handleTrim}
          onUpdate={handleUpdate}
          onUpdateSL={handleUpdateSL}
          onTrailStop={handleTrailStop}
          onAdd={handleAdd}
          onExit={handleExit}
        />
        
        <HDDialogChallengeDetail
          open={showChallengeDetail}
          onOpenChange={setShowChallengeDetail}
          challenge={selectedChallenge}
          trades={activeTrades}
          channels={channels}
          onTradeClick={(trade) => {
            setShowChallengeDetail(false);
            
            if (trade.state === 'ENTERED' && onOpenActiveTrade) {
              onOpenActiveTrade(trade.id);
            } else if (trade.state === 'EXITED' && onOpenReviewTrade) {
              onOpenReviewTrade(trade.id);
            }
          }}
        />
      </div>
      
      <div className="lg:hidden">
        <MobileNowPlayingSheet
          trade={currentTrade}
          ticker={activeTicker?.symbol}
          state={tradeState}
          hideWhenAlert={showAlert}
          confluence={!showAlert && tradeState === 'ENTERED' ? {
            loading: confluence.loading,
            error: confluence.error,
            trend: confluence.trend,
            volatility: confluence.volatility,
            liquidity: confluence.liquidity,
          } : undefined}
          onEnter={handleEnterTrade}
          onDiscard={handleDiscard}
          onAction={(type) => {
            if (type === 'trim') {
              handleTrim();
            }
            else if (type === 'update-sl') {
              handleUpdateSL();
            }
            else if (type === 'update') {
              handleUpdate();
            }
            else if (type === 'add') {
              handleAdd();
            }
            else if (type === 'exit') {
              handleExit();
            }
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
            onSendAlert={handleSendAlert}
            onEnterAndAlert={handleEnterAndAlert}
            onCancelAlert={handleCancelAlert}
            onUnload={handleUnloadTrade}
            onEnter={handleEnterTrade}
            onTrim={handleTrim}
            onUpdate={handleUpdate}
            onUpdateSL={handleUpdateSL}
            onTrailStop={handleTrailStop}
            onAdd={handleAdd}
            onExit={handleExit}
          />
        </div>
      )}
      
      <div className="lg:hidden">
        <MobileWatermark />
      </div>
    </>
  );
}

// Legacy toast helper removed (logic now in hook)
*/
export {};
