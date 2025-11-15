import { useState, useEffect } from 'react';
import { Trade, Ticker, Challenge, DiscordChannel, Contract, TradeState, AlertType, TradeUpdate, OptionType } from '../types';
import { HDPanelWatchlist } from './hd/HDPanelWatchlist';
import { HDContractGrid } from './hd/HDContractGrid';
import { HDAlertComposer } from './hd/HDAlertComposer';
import { HDQuickActions } from './hd/HDQuickActions';
import { HDLoadedTradeCard } from './hd/HDLoadedTradeCard';
import { HDEnteredTradeCard } from './hd/HDEnteredTradeCard';
import { HDPanelFocusedTrade } from './hd/HDPanelFocusedTrade';
import { HDLiveChart } from './hd/HDLiveChart';
import { HDVoiceHUD } from './hd/HDVoiceHUD';
import { HDDialogChallengeDetail } from './hd/HDDialogChallengeDetail';
import { HDMacroPanel } from './hd/HDMacroPanel';
import { MobileNowPlayingSheet } from './MobileNowPlayingSheet';
import { MobileWatermark } from './MobileWatermark';
import { useConfluenceData } from '../hooks/useConfluenceData';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { toast } from 'sonner';
import { massiveClient } from '../lib/massive/client';
import { useStreamingOptionsChain } from '../hooks/useStreamingOptionsChain';
import { 
  inferTradeType,
  cn
} from '../lib/utils';
import { streamingManager } from '../lib/massive/streaming-manager';

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

export function DesktopLiveCockpit({
  watchlist,
  hotTrades,
  challenges,
  onTickerClick,
  onHotTradeClick,
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
  updatedTradeIds,
  onOpenActiveTrade,
  onOpenReviewTrade,
  activeTab,
}: DesktopLiveCockpitProps) {
  const [activeTicker, setActiveTicker] = useState<Ticker | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
  const [tradeState, setTradeState] = useState<TradeState>('WATCHING');
  const [alertType, setAlertType] = useState<AlertType>('load');
  const [alertOptions, setAlertOptions] = useState<{ updateKind?: 'trim' | 'generic' | 'sl' }>({});
  const [showAlert, setShowAlert] = useState(false);
  const [activeTrades, setActiveTrades] = useState<Trade[]>(hotTrades);
  const [expandedLoadedList, setExpandedLoadedList] = useState(false); // Track loaded trades expansion
  const [showChallengeDetail, setShowChallengeDetail] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  
  // Detect mobile viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  
  // Close all modals when tab changes on mobile
  useEffect(() => {
    if (isMobile && activeTab) {
      console.log('📱 Mobile tab changed to:', activeTab, '- closing modals');
      setShowAlert(false);
      setShowChallengeDetail(false);
    }
  }, [activeTab, isMobile]);
  
  // Sync active trades back to parent
  useEffect(() => {
    if (onTradesChange) {
      onTradesChange(activeTrades);
    }
  }, [activeTrades, onTradesChange]);
  
  // Handle focused trade from external navigation (e.g., clicking from Active tab)
  useEffect(() => {
    console.log('🔍 focusedTrade effect triggered:', { focusedTrade: focusedTrade?.ticker, hasFocusedTrade: !!focusedTrade });
    if (focusedTrade) {
      console.log('⚠️ CLOSING ALERT DUE TO FOCUSED TRADE CHANGE');
      setCurrentTrade(focusedTrade);
      setTradeState(focusedTrade.state);
      setActiveTicker(watchlist.find(t => t.symbol === focusedTrade.ticker) || null);
      setShowAlert(false);
      // Clear the focused trade signal after handling it
      // (We rely on parent to pass null or a new trade next time)
    }
  }, [focusedTrade, watchlist]);
  
  // Fetch real-time confluence data from Massive
  const confluence = useConfluenceData(currentTrade, tradeState);
  
  // New streaming hook for options chain
  const streamingContracts = useStreamingOptionsChain(activeTicker?.symbol || null);
  
  useEffect(() => {
    if (streamingContracts && activeTicker) {
      const realContracts: Contract[] = streamingContracts.map((opt: any) => {
        const expiryDate = new Date(opt.expiration_date);
        const today = new Date();
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
      
      console.log('[v0] Auto-refreshed streaming contracts:', realContracts.length, 'contracts');
      setContracts(realContracts);
    }
  }, [streamingContracts, activeTicker]);
  
  const openAlertComposer = (type: AlertType, options?: { updateKind?: 'trim' | 'generic' | 'sl' }) => {
    console.log('🚀 Opening alert composer:', { type, options, currentTrade });
    setAlertType(type);
    setAlertOptions(options || {});
    setShowAlert(true);
    console.log('✅ Alert state set to true');
  };
  
  // Add effect to track showAlert changes
  useEffect(() => {
    console.log('⚡ showAlert changed to:', showAlert);
    if (showAlert) {
      console.log('📝 Alert type:', alertType, 'Alert options:', alertOptions);
      console.log('💡 Current trade:', currentTrade?.ticker);
    }
  }, [showAlert, alertType, alertOptions, currentTrade]);
  
  const handleTickerClick = async (ticker: Ticker) => {
    console.log('[v0] ==> handleTickerClick called for:', ticker.symbol);
    
    setActiveTicker(ticker);
    setTradeState('WATCHING');
    setCurrentTrade(null);
    setShowAlert(false);
    onTickerClick(ticker);
    
    console.log('[v0] Fetching real options chain for', ticker.symbol);
    try {
      const optionsData = await massiveClient.getOptionsChain(ticker.symbol);
      console.log('[v0] Received options chain data:', optionsData);
      
      if (!optionsData || !optionsData.results || optionsData.results.length === 0) {
        console.log('[v0] No options contracts found in response');
        toast.error(`No options contracts found for ${ticker.symbol}`);
        setContracts([]);
        return;
      }
      
      const realContracts: Contract[] = (optionsData.results || []).map((opt: any) => {
        const expiryDate = new Date(opt.expiration_date);
        const today = new Date();
        const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: opt.ticker || `${ticker.symbol}-${opt.strike_price}-${opt.expiration_date}-${opt.contract_type}`,
          ticker: ticker.symbol,
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
      
      console.log('[v0] Transformed contracts:', realContracts.length, 'contracts');
      setContracts(realContracts);
      
    } catch (error: any) {
      console.error('[v0] Failed to fetch options chain:', error);
      toast.error(`Failed to load options for ${ticker.symbol}: ${error.message}`);
      setContracts([]);
    }
  };
  
  const handleContractSelect = (contract: Contract) => {
    if (!activeTicker) return;
    
    console.log('[v0] Creating trade from real contract:', contract);
    const trade: Trade = {
      id: `trade-${Date.now()}`,
      ticker: activeTicker.symbol,
      contract,
      state: 'LOADED',
      entryPrice: contract.mid,
      currentPrice: contract.mid,
      targetPrice: contract.mid * 1.5,
      stopLoss: contract.mid * 0.5,
      movePercent: 0,
      movePrice: 0,
      discordChannels: [],
      challenges: [],
      updates: [],
      timestamp: new Date(),
    };
    
    console.log('[v0] Created trade:', trade);
    setCurrentTrade(trade);
    setTradeState('LOADED');
    setAlertType('load');
    setShowAlert(true);
  };
  
  const handleSendAlert = (
    channelIds: string[],
    challengeIds: string[],
    comment?: string
  ) => {
    if (!currentTrade) return;
    
    // Convert channel IDs to channel objects
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    
    console.log('Sending alert:', { channels: selectedChannels, challengeIds, comment, alertType, alertOptions });
    
    // Helper to create a TradeUpdate entry
    const createUpdate = (type: TradeUpdate['type']): TradeUpdate => {
      let message = comment || '';
      
      // Default messages if no comment provided
      if (!message) {
        switch (type) {
          case 'enter':
            message = 'Entered position';
            break;
          case 'exit':
            message = 'Exited position';
            break;
          case 'trim':
            message = 'Trimmed position';
            break;
          case 'add':
            message = 'Added to position';
            break;
          case 'update-sl':
            message = 'Updated stop loss';
            break;
          case 'trail-stop':
            message = 'Enabled trailing stop';
            break;
          case 'update':
            message = 'Updated position';
            break;
        }
      }
      
      return {
        id: `update-${Date.now()}`,
        type,
        timestamp: new Date(),
        message,
        price: currentTrade.currentPrice || currentTrade.entryPrice || 0,
        pnlPercent: currentTrade.movePercent,
      };
    };
    
    const updatedTrade = {
      ...currentTrade,
      discordChannels: selectedChannels.filter(c => c && c.id).map(c => c.id),
      challenges: challengeIds,
    };
    
    if (alertType === 'load') {
      // Loaded idea – add to active list, remain LOADED
      // No update logged for 'load' since it's not a trade action yet
      setActiveTrades(prev => [...prev, updatedTrade]);
      setCurrentTrade(updatedTrade);
      setTradeState('LOADED');
      setShowAlert(false);
      setExpandedLoadedList(true); // Expand the loaded trades section
      // Reset contract view to go back to main cockpit
      setContracts([]);
      setActiveTicker(null);
      
      // Show success toast
      showAlertToast('load', currentTrade.ticker, selectedChannels);
      return;
    }

    if (alertType === 'enter') {
      // Transition to ENTERED
      const enterUpdate = createUpdate('enter');
      const previousUpdates = currentTrade.updates || [];
      
      const finalTrade = {
        ...currentTrade,
        state: 'ENTERED' as TradeState,
        discordChannels: selectedChannels.filter(c => c && c.id).map(c => c.id),
        challenges: challengeIds,
        entryPrice: currentTrade.contract.mid, // Set entry price
        entryTime: new Date(),
        updates: [...previousUpdates, enterUpdate],
      };

      setActiveTrades(prev =>
        prev.map(t => (t.id === currentTrade.id ? finalTrade : t))
      );
      setCurrentTrade(finalTrade);
      setTradeState('ENTERED');
      setShowAlert(false);
      
      // Show success toast
      showAlertToast('enter', currentTrade.ticker, selectedChannels);
      
      // On mobile, when entering a trade, switch to Trade tab after state updates
      if (onMobileTabChange) {
        // Small delay to ensure state has propagated before tab switch
        setTimeout(() => {
          onMobileTabChange('active');
        }, 100);
      }
      return;
    }

    if (alertType === 'exit') {
      // Mark as EXITED and remove from Active Trades
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
      
      // Show success toast
      const pnlText = currentTrade.movePercent 
        ? ` (${currentTrade.movePercent > 0 ? '+' : ''}${currentTrade.movePercent.toFixed(1)}%)` 
        : '';
      showAlertToast('exit', currentTrade.ticker, selectedChannels, currentTrade.movePercent);
      
      // Call the onExitedTrade callback if provided
      if (onExitedTrade) {
        onExitedTrade(exitedTrade);
      }
      return;
    }

    if (alertType === 'trail_stop') {
      // Enable trailing stop, stay ENTERED
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
      
      // Show success toast
      showAlertToast('trail-stop', currentTrade.ticker, selectedChannels);
      return;
    }

    // Handle 'update' alert type with different updateKind variations
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
      
      // Show success toast
      showAlertToast(updateType, currentTrade.ticker, selectedChannels);
      return;
    }

    // Handle 'add' alert type
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
      
      // Show success toast
      showAlertToast('add', currentTrade.ticker, selectedChannels);
      return;
    }
  };
  
  const handleEnterTrade = () => {
    setAlertType('enter');
    setShowAlert(true);
    
    // On mobile, when entering a trade, switch to Trade tab after alert is sent
    // The actual tab switch happens in handleSendAlert for enter alerts
  };
  
  const handleDiscard = () => {
    // If discarding a LOADED trade, remove it from activeTrades
    if (currentTrade && currentTrade.state === 'LOADED') {
      setActiveTrades(prev => prev.filter(t => t.id !== currentTrade.id));
    }
    
    // Reset to WATCHING state and show contract grid
    setCurrentTrade(null);
    setTradeState('WATCHING');
    setShowAlert(false);
  };
  
  const handleCancelAlert = () => {
    // Cancel without removing trade - just close the alert and go back to Watch tab
    setShowAlert(false);
    
    // On mobile, switch back to Watch tab
    if (isMobile && onMobileTabChange) {
      onMobileTabChange('live');
    }
  };
  
  const handleUnloadTrade = () => {
    // Remove trade from loaded list and close alert
    if (currentTrade && currentTrade.state === 'LOADED') {
      setActiveTrades(prev => prev.filter(t => t.id !== currentTrade.id));
      toast.success(`${currentTrade.ticker} unloaded from watchlist`);
    }
    
    // Reset to WATCHING state
    setCurrentTrade(null);
    setTradeState('WATCHING');
    setShowAlert(false);
    
    // On mobile, switch back to the Watch tab
    if (window.innerWidth < 1024 && onMobileTabChange) {
      onMobileTabChange('live');
    }
  };
  
  const handleRemoveLoadedTrade = (trade: Trade) => {
    // Remove loaded trade without alerting
    setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
    toast.success(`${trade.ticker} removed from loaded trades`);
    
    // If this was the current trade, reset state
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
    console.log('🚀 handleEnterAndAlert START');
    if (!currentTrade) return;
    
    // Convert channel IDs to channel objects
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    
    console.log('Enter and Alert:', { channels: selectedChannels, challengeIds, comment });
    
    // Transition trade to ENTERED state
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
      movePrice: 0,
      discordChannels: channelIds,
      challenges: challengeIds,
      updates: [
        ...(currentTrade.updates || []),
        {
          type: 'enter',
          timestamp: new Date(),
          message: comment || 'Entered position',
        },
      ],
    };
    
    console.log('✅ Trade transitioned to ENTERED:', enteredTrade);
    
    // Update the trade in active trades list
    setActiveTrades(prev => {
      const existingIndex = prev.findIndex(t => t.id === currentTrade.id);
      if (existingIndex >= 0) {
        // Trade exists - update it
        return prev.map(t => t.id === currentTrade.id ? enteredTrade : t);
      } else {
        // Trade doesn't exist yet - add it
        return [...prev, enteredTrade];
      }
    });
    setCurrentTrade(enteredTrade);
    setTradeState('ENTERED');
    
    console.log('📢 Showing toast and closing alert...');
    
    // Show success toast
    showAlertToast('enter', currentTrade.ticker, selectedChannels);
    
    // Close the alert composer
    console.log('🔒 CALLING setShowAlert(false)');
    setShowAlert(false);
    
    // On mobile, switch to the Trade tab to show the entered trade
    if (window.innerWidth < 1024 && onMobileTabChange) {
      console.log('📱 CALLING onMobileTabChange("active")');
      onMobileTabChange('active');
    }
    
    console.log('🏁 handleEnterAndAlert END');
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
    openAlertComposer('trail_stop');
  };

  const handleAdd = () => {
    if (!currentTrade) return;
    openAlertComposer('add');
  };

  const handleExit = () => {
    if (!currentTrade) return;
    openAlertComposer('exit');
  };
  
  // Voice Commands Integration
  const voice = useVoiceCommands({
    watchlist,
    activeTrades,
    currentTrade,
    onAddTicker: (symbol) => {
      // Mock implementation - would need actual ticker adding logic
      toast.success(`Added ${symbol} to watchlist`);
    },
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
    console.log('[StreamingManager] Subscribing to watchlist quotes');
    
    // Subscribe to all visible watchlist tickers
    const handles = watchlist.map(ticker => 
      streamingManager.subscribe(ticker.symbol, ['quotes'], (data) => {
        console.log(`[StreamingManager] Quote update for ${ticker.symbol}:`, data);
        // Updates are handled by individual useStreamingQuote hooks in HDRowWatchlist
      })
    );
    
    return () => {
      console.log('[StreamingManager] Unsubscribing from watchlist quotes');
      handles.forEach(handle => streamingManager.unsubscribe(handle));
    };
  }, [watchlist]);
  
  useEffect(() => {
    const enteredTrades = activeTrades.filter(t => t.state === 'ENTERED');
    if (enteredTrades.length === 0) return;
    
    console.log('[StreamingManager] Subscribing to entered trade contracts');
    
    const handles = enteredTrades.map(trade => 
      streamingManager.subscribe(trade.contract.id, ['quotes', 'agg1s'], (data) => {
        console.log(`[StreamingManager] Real-time update for ${trade.ticker}:`, data);
        // Updates are handled by HDEnteredTradeCard components
      })
    );
    
    return () => {
      console.log('[StreamingManager] Unsubscribing from trade contracts');
      handles.forEach(handle => streamingManager.unsubscribe(handle));
    };
  }, [activeTrades]);
  
  return (
    <>
      {/* Main three-panel cockpit - hide on mobile when on active tab */}
      <div className={`relative flex flex-col lg:flex-row h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] overflow-hidden ${hideMobilePanelsOnActiveTab ? 'hidden lg:flex' : ''}`}>
        {/* Voice Command HUD - Desktop only */}
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
        
        {/* Left Panel - Watchlist + Challenges */}
        <div className={`
          w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[var(--border-hairline)] 
          overflow-y-auto
          ${hideDesktopPanels ? 'hidden' : ''}
          ${hideMobilePanelsOnActiveTab ? 'hidden lg:block' : ''}
          ${!hideDesktopPanels && !hideMobilePanelsOnActiveTab && ((tradeState === 'WATCHING' && contracts.length === 0) || tradeState === 'LOADED' || tradeState === 'ENTERED') ? 'flex-1 lg:flex-initial' : 'hidden lg:block'}
        `}>
          {/* Macro Panel at top of watchlist panel */}
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
              console.log('Challenge clicked:', challenge);
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
        
        {/* Center Panel - Contract Grid / Trade Details */}
        {/* On mobile (< lg), only show when we have contracts OR LOADED/ENTERED trade */}
        {/* On desktop (>= lg), always show */}
        {/* Hide completely when hideDesktopPanels is true */}
        <div className={`
          flex-1 overflow-y-auto bg-[#0a0a0a] relative
          ${hideDesktopPanels ? 'hidden' : ''}
          ${!hideDesktopPanels && (tradeState === 'LOADED' || tradeState === 'ENTERED') ? 'hidden lg:block' : ''}
          ${!hideDesktopPanels && (tradeState === 'WATCHING' && contracts.length === 0) ? 'hidden lg:flex lg:flex-1' : ''}
          ${!hideDesktopPanels && (tradeState === 'WATCHING' && contracts.length > 0) ? 'flex-1' : ''}
        `}>
          {/* Watermark - visible on all states */}
          <MobileWatermark />
          
          {tradeState === 'WATCHING' && contracts.length > 0 && activeTicker ? (
            // Contract Grid for selecting contracts
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
              
              <HDContractGrid
                contracts={contracts}
                currentPrice={activeTicker.last}
                ticker={activeTicker.symbol}
                onContractSelect={handleContractSelect}
              />
            </div>
          ) : tradeState === 'LOADED' && currentTrade && !showAlert ? (
            // LOADED Trade Card with Enter/Discard CTAs (Desktop only now)
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
            // ENTERED Trade Card (compact with confluence)
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
            // When alert is showing on mobile, hide center content
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
              {/* Background logo - large and visible */}
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
              
              {/* Foreground text */}
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
        
        {/* Right Panel - Alert Composer & Quick Actions */}
        {/* On mobile: Show as full screen when alert is open */}
        {/* On desktop: Always show appropriate content */}
        <div className={cn(
          "w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[var(--border-hairline)] flex flex-col h-full",
          !showAlert && tradeState === 'LOADED' && "hidden lg:flex",
          !showAlert && tradeState === 'WATCHING' && "hidden lg:flex",
          !showAlert && tradeState === 'ENTERED' && "hidden lg:flex"
        )}>
          {showAlert && currentTrade ? (
            <div className="hidden lg:flex lg:flex-col lg:h-full">
              <HDAlertComposer
                trade={currentTrade}
                alertType={alertType}
                alertOptions={alertOptions}
                availableChannels={channels}
                challenges={challenges}
                onSend={handleSendAlert}
                onEnterAndAlert={handleEnterAndAlert}
                onCancel={handleCancelAlert}
                onUnload={handleUnloadTrade}
              />
            </div>
          ) : tradeState === 'LOADED' && currentTrade ? (
            // Right panel reminder for LOADED state (desktop only) - NO DUPLICATE CTA
            <div className="flex flex-col h-auto lg:h-full bg-[var(--surface-2)] p-6">
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center space-y-3 max-w-[200px]">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius)] bg-[var(--brand-primary)]/10">
                    <span className="text-2xl">📋</span>
                  </div>
                  <p className="text-[var(--text-high)] font-medium">
                    Idea Loaded
                  </p>
                  <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                    Use the <span className="text-[var(--brand-primary)] font-medium">Enter Trade</span> button below to proceed when ready.
                  </p>
                </div>
              </div>
            </div>
          ) : tradeState === 'ENTERED' && currentTrade ? (
            // Quick Actions for ENTERED state
            <div className="h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6">
              <HDQuickActions
                state={tradeState}
                onTrim={handleTrim}
                onUpdate={handleUpdate}
                onUpdateSL={handleUpdateSL}
                onTrailStop={handleTrailStop}
                onAdd={handleAdd}
                onExit={handleExit}
              />
            </div>
          ) : (
            // Empty state
            <div className="flex items-center justify-center h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6 min-h-[200px]">
              <p className="text-[var(--text-muted)] text-sm text-center">
                Select a contract to load a trade
              </p>
            </div>
          )}
        </div>
        
        {/* Challenge Detail Dialog */}
        <HDDialogChallengeDetail
          open={showChallengeDetail}
          onOpenChange={setShowChallengeDetail}
          challenge={selectedChallenge}
          trades={activeTrades}
          channels={channels}
          onTradeClick={(trade) => {
            // Close the dialog
            setShowChallengeDetail(false);
            
            // Navigate based on trade state
            if (trade.state === 'ENTERED' && onOpenActiveTrade) {
              onOpenActiveTrade(trade.id);
            } else if (trade.state === 'EXITED' && onOpenReviewTrade) {
              onOpenReviewTrade(trade.id);
            }
          }}
        />
      </div>
      
      {/* Mobile Now Playing Sheet - Always render outside main cockpit so it works even when cockpit is hidden */}
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
            console.log('📱 MobileNowPlayingSheet onAction called with type:', type);
            if (type === 'trim') {
              console.log('→ Calling handleTrim()');
              handleTrim();
            }
            else if (type === 'update-sl') {
              console.log('→ Calling handleUpdateSL()');
              handleUpdateSL();
            }
            else if (type === 'update') {
              console.log('→ Calling handleUpdate()');
              handleUpdate();
            }
            else if (type === 'add') {
              console.log('→ Calling handleAdd()');
              handleAdd();
            }
            else if (type === 'exit') {
              console.log('→ Calling handleExit()');
              handleExit();
            }
          }}
        />
      </div>
      
      {/* Mobile Alert Composer - Fullscreen overlay (outside main cockpit) */}
      {showAlert && currentTrade && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-[var(--bg-base)] flex flex-col">
          <HDAlertComposer
            trade={currentTrade}
            alertType={alertType}
            alertOptions={alertOptions}
            availableChannels={channels}
            challenges={challenges}
            onSend={handleSendAlert}
            onEnterAndAlert={handleEnterAndAlert}
            onCancel={handleCancelAlert}
            onUnload={handleUnloadTrade}
          />
        </div>
      )}
      
      {/* Mobile Watermark - Always render outside main cockpit so it works even when cockpit is hidden */}
      <div className="lg:hidden">
        <MobileWatermark />
      </div>
    </>
  );
}

function showAlertToast(type: AlertType, ticker: string, channels: DiscordChannel[], movePercent?: number) {
  const channelNames = channels.map(c => c.name).join(', ');
  const message = movePercent !== undefined
    ? `${ticker} ${type.charAt(0).toUpperCase() + type.slice(1)}: ${movePercent.toFixed(1)}%`
    : `${ticker} ${type.charAt(0).toUpperCase() + type.slice(1)} sent`;
  toast.success(message);
}
