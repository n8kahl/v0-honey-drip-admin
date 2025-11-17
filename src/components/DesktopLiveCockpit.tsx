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
import { useKeyLevels } from '../hooks/useKeyLevels';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { toast } from 'sonner';
import { massiveClient } from '../lib/massive/client';
import { useStreamingOptionsChain } from '../hooks/useStreamingOptionsChain';
import { calculateRisk } from '../lib/riskEngine/calculator';
import { RISK_PROFILES, inferTradeTypeByDTE, DEFAULT_DTE_THRESHOLDS } from '../lib/riskEngine/profiles';
import { adjustProfileByConfluence, getConfluenceAdjustmentReasoning } from '../lib/riskEngine/confluenceAdjustment';
import { updateTrade } from '../lib/supabase/database';
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
    if (focusedTrade) {
      setCurrentTrade(focusedTrade);
      setTradeState(focusedTrade.state);
      setActiveTicker(watchlist.find(t => t.symbol === focusedTrade.ticker) || null);
      setShowAlert(false);
    }
  }, [focusedTrade, watchlist]);
  
  // Fetch real-time confluence data from Massive
  const confluence = useConfluenceData(currentTrade, tradeState);
  
  // Fetch key technical levels (ORB, VWAP, Bollinger, pivots) from historical bars
  const { keyLevels, loading: keyLevelsLoading } = useKeyLevels(
    activeTicker?.symbol || null,
    { timeframe: '5', lookbackDays: 5, orbWindow: 5, enabled: !!activeTicker?.symbol }
  );
  
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
      
      setContracts(realContracts);
    }
  }, [streamingContracts, activeTicker]);
  
  const openAlertComposer = (type: AlertType, options?: { updateKind?: 'trim' | 'generic' | 'sl' }) => {
    setAlertType(type);
    setAlertOptions(options || {});
    setShowAlert(true);
  };
  
  const handleTickerClick = async (ticker: Ticker) => {
    setActiveTicker(ticker);
    setTradeState('WATCHING');
    setCurrentTrade(null);
    setShowAlert(false);
    onTickerClick(ticker);
    
    try {
      const optionsData = await massiveClient.getOptionsChain(ticker.symbol);
      
      if (!optionsData || !optionsData.results || optionsData.results.length === 0) {
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
      
      setContracts(realContracts);
      
    } catch (error: any) {
      console.error('Failed to fetch options chain:', error);
      toast.error(`Failed to load options for ${ticker.symbol}: ${error.message}`);
      setContracts([]);
    }
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
    
    const trade: Trade = {
      id: `trade-${Date.now()}`,
      ticker: activeTicker.symbol,
      contract,
      state: 'LOADED',
      entryPrice: contract.mid,
      currentPrice: contract.mid,
      targetPrice,
      stopLoss,
      movePercent: 0,
      movePrice: 0,
      discordChannels: [],
      challenges: [],
      updates: [],
      timestamp: new Date(),
    };
    
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
    
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    
    const createUpdate = (type: TradeUpdate['type']): TradeUpdate => {
      let message = comment || '';
      
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
      setActiveTrades(prev => [...prev, updatedTrade]);
      setCurrentTrade(updatedTrade);
      setTradeState('LOADED');
      setShowAlert(false);
      setExpandedLoadedList(true);
      setContracts([]);
      setActiveTicker(null);
      
      showAlertToast('load', currentTrade.ticker, selectedChannels);
      return;
    }

    if (alertType === 'enter') {
      const enterUpdate = createUpdate('enter');
      const previousUpdates = currentTrade.updates || [];
      
      // Fix #1: Recalculate TP/SL on entry with actual entry price + confluence
      const entryPrice = currentTrade.contract.mid;
      let targetPrice = currentTrade.targetPrice || entryPrice * 1.5;
      let stopLoss = currentTrade.stopLoss || entryPrice * 0.5;
      let riskResult = null;
      
      try {
        // Infer trade type from DTE
        const tradeType = inferTradeTypeByDTE(
          currentTrade.contract.expiry,
          new Date(),
          DEFAULT_DTE_THRESHOLDS
        );
        
        // Use computed key levels if available, otherwise fallback to zeros
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
        
        // Fix #3: Apply confluence adjustments to risk profile
        // Get base profile and adjust by confluence metrics
        let riskProfile = RISK_PROFILES[tradeType];
        let confluenceReasoning = '';
        
        if (confluence.trend || confluence.volatility || confluence.liquidity) {
          riskProfile = adjustProfileByConfluence(riskProfile, {
            trend: confluence.trend,
            volatility: confluence.volatility,
            liquidity: confluence.liquidity,
          });
          confluenceReasoning = getConfluenceAdjustmentReasoning({
            trend: confluence.trend,
            volatility: confluence.volatility,
            liquidity: confluence.liquidity,
          });
          console.log('[v0] Confluence adjustments applied:', confluenceReasoning);
        }
        
        // Recalculate TP/SL using confluence-adjusted risk profile + key levels
        riskResult = calculateRisk({
          entryPrice,
          currentUnderlyingPrice: currentTrade.contract.mid,
          currentOptionMid: currentTrade.contract.mid,
          keyLevels: levelsForCalculation,
          expirationISO: currentTrade.contract.expiry,
          tradeType,
          delta: currentTrade.contract.delta || 0.5,
          gamma: currentTrade.contract.gamma || 0,
          defaults: {
            mode: 'percent' as const,
            tpPercent: 50,
            slPercent: 50,
            dteThresholds: DEFAULT_DTE_THRESHOLDS,
          },
        });
        
        // Use calculated TP/SL if available
        if (riskResult.targetPrice) {
          targetPrice = riskResult.targetPrice;
          console.log(
            '[v0] Entry: Recalculated TP =',
            targetPrice.toFixed(2),
            'from',
            tradeType,
            'profile with confluence adjustments'
          );
        }
        if (riskResult.stopLoss) {
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

    if (alertType === 'trail_stop') {
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
  
  const voice = useVoiceCommands({
    watchlist,
    activeTrades,
    currentTrade,
    onAddTicker: (symbol) => {
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
      <div className={`relative flex flex-col lg:flex-row h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] overflow-hidden ${hideMobilePanelsOnActiveTab ? 'hidden lg:flex' : ''}`}>
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
          ${!hideDesktopPanels && (tradeState === 'WATCHING' && contracts.length === 0) ? 'hidden lg:flex lg:flex-1' : ''}
          ${!hideDesktopPanels && (tradeState === 'WATCHING' && contracts.length > 0) ? 'flex-1' : ''}
        `}>
          <MobileWatermark />
          
          {tradeState === 'WATCHING' && contracts.length > 0 && activeTicker ? (
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
            <div className="flex items-center justify-center h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6 min-h-[200px]">
              <p className="text-[var(--text-muted)] text-sm text-center">
                Select a contract to load a trade
              </p>
            </div>
          )}
        </div>
        
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
