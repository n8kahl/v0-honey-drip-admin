import { useState, useCallback, useEffect } from 'react';
import { VoiceHUDState, VoiceCommand } from '../components/hd/HDVoiceHUD';
import { Trade, Ticker, Contract } from '../types';

export type VoiceActionType = 
  | 'add-ticker'
  | 'remove-ticker'
  | 'load-contract'
  | 'enter-trade'
  | 'trim-trade'
  | 'update-sl'
  | 'exit-trade'
  | 'add-position'
  | 'unknown';

export interface ParsedVoiceAction {
  type: VoiceActionType;
  ticker?: string;
  strike?: number;
  optionType?: 'C' | 'P';
  expiry?: string;
  tradeId?: string;
}

interface UseVoiceCommandsProps {
  watchlist: Ticker[];
  activeTrades: Trade[];
  currentTrade: Trade | null;
  onAddTicker?: (symbol: string) => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onLoadContract?: (contract: Contract) => void;
  onEnterTrade?: () => void;
  onTrimTrade?: () => void;
  onUpdateSL?: () => void;
  onExitTrade?: () => void;
  onAddPosition?: () => void;
}

export function useVoiceCommands({
  watchlist,
  activeTrades,
  currentTrade,
  onAddTicker,
  onRemoveTicker,
  onLoadContract,
  onEnterTrade,
  onTrimTrade,
  onUpdateSL,
  onExitTrade,
  onAddPosition,
}: UseVoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const [hudState, setHudState] = useState<VoiceHUDState | null>(null);
  const [transcript, setTranscript] = useState('');
  const [command, setCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<ParsedVoiceAction | null>(null);

  // Parse voice transcript into action
  const parseVoiceCommand = useCallback((text: string): ParsedVoiceAction => {
    const lowerText = text.toLowerCase().trim();

    // Add ticker to watchlist
    if (lowerText.includes('add') && lowerText.includes('watchlist')) {
      const tickerMatch = lowerText.match(/add\s+([a-z]{1,5})\s+to/i);
      if (tickerMatch) {
        return { type: 'add-ticker', ticker: tickerMatch[1].toUpperCase() };
      }
    }

    // Remove ticker from watchlist
    if (lowerText.includes('remove') && lowerText.includes('watchlist')) {
      const tickerMatch = lowerText.match(/remove\s+([a-z]{1,5})\s+from/i);
      if (tickerMatch) {
        return { type: 'remove-ticker', ticker: tickerMatch[1].toUpperCase() };
      }
    }

    // Load a contract
    if (lowerText.includes('load')) {
      const tickerMatch = lowerText.match(/load\s+([a-z]{1,5})/i);
      const strikeMatch = lowerText.match(/(\d+)/);
      const callMatch = lowerText.includes('call');
      const putMatch = lowerText.includes('put');
      
      if (tickerMatch) {
        return {
          type: 'load-contract',
          ticker: tickerMatch[1].toUpperCase(),
          strike: strikeMatch ? parseInt(strikeMatch[1]) : undefined,
          optionType: callMatch ? 'C' : putMatch ? 'P' : undefined,
        };
      }
    }

    // Enter the loaded trade
    if (lowerText.includes('enter') && (lowerText.includes('trade') || lowerText.includes('loaded'))) {
      return { type: 'enter-trade' };
    }

    // Trim position
    if (lowerText.includes('trim')) {
      return { type: 'trim-trade' };
    }

    // Update stop loss
    if (lowerText.includes('update') && (lowerText.includes('stop') || lowerText.includes('sl'))) {
      return { type: 'update-sl' };
    }

    // Exit trade
    if (lowerText.includes('exit')) {
      return { type: 'exit-trade' };
    }

    // Add to position
    if (lowerText.includes('add') && !lowerText.includes('watchlist')) {
      return { type: 'add-position' };
    }

    return { type: 'unknown' };
  }, []);

  // Create voice command object for display
  const createVoiceCommand = useCallback((action: ParsedVoiceAction, text: string): VoiceCommand => {
    switch (action.type) {
      case 'add-ticker':
        return {
          transcript: text,
          action: `Add ${action.ticker} to watchlist`,
          details: `Will add ${action.ticker} to your watchlist`,
        };
      
      case 'remove-ticker':
        return {
          transcript: text,
          action: `Remove ${action.ticker} from watchlist`,
          details: `Will remove ${action.ticker} from your watchlist`,
        };
      
      case 'load-contract':
        const contractDesc = `${action.ticker}${action.strike ? ` ${action.strike}` : ''}${action.optionType || ''}`;
        return {
          transcript: text,
          action: `Load ${contractDesc} contract`,
          details: `Will load this contract as a trade idea`,
        };
      
      case 'enter-trade':
        return {
          transcript: text,
          action: 'Enter the loaded trade',
          details: currentTrade ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}` : 'No trade loaded',
        };
      
      case 'trim-trade':
        return {
          transcript: text,
          action: 'Trim current position',
          details: currentTrade ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}` : 'No active trade',
        };
      
      case 'update-sl':
        return {
          transcript: text,
          action: 'Update stop loss',
          details: currentTrade ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}` : 'No active trade',
        };
      
      case 'exit-trade':
        return {
          transcript: text,
          action: 'Exit current trade',
          details: currentTrade ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}` : 'No active trade',
        };
      
      case 'add-position':
        return {
          transcript: text,
          action: 'Add to position',
          details: currentTrade ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}` : 'No active trade',
        };
      
      default:
        return {
          transcript: text,
          action: 'Command not recognized',
          details: "Try: 'Add TSLA to the watchlist'",
        };
    }
  }, [currentTrade]);

  // Execute the confirmed action
  const executeAction = useCallback((action: ParsedVoiceAction) => {
    switch (action.type) {
      case 'add-ticker':
        if (action.ticker && onAddTicker) {
          onAddTicker(action.ticker);
        }
        break;
      
      case 'remove-ticker':
        if (action.ticker && onRemoveTicker) {
          const ticker = watchlist.find(t => t.symbol === action.ticker);
          if (ticker) {
            onRemoveTicker(ticker);
          }
        }
        break;
      
      case 'load-contract':
        // This would need more context - typically would require searching contracts
        // For now, just a placeholder
        console.log('Load contract action:', action);
        break;
      
      case 'enter-trade':
        if (onEnterTrade) {
          onEnterTrade();
        }
        break;
      
      case 'trim-trade':
        if (onTrimTrade) {
          onTrimTrade();
        }
        break;
      
      case 'update-sl':
        if (onUpdateSL) {
          onUpdateSL();
        }
        break;
      
      case 'exit-trade':
        if (onExitTrade) {
          onExitTrade();
        }
        break;
      
      case 'add-position':
        if (onAddPosition) {
          onAddPosition();
        }
        break;
    }
  }, [watchlist, onAddTicker, onRemoveTicker, onEnterTrade, onTrimTrade, onUpdateSL, onExitTrade, onAddPosition]);

  // Start listening
  const startListening = useCallback(() => {
    setIsListening(true);
    setHudState('listening');
    setTranscript('');
    setError('');
    setCommand(null);
    
    // Simulate voice recognition (in production, use Web Speech API)
    // This is a mock for demonstration
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    setIsListening(false);
    setHudState(null);
    setTranscript('');
  }, []);

  // Process voice input (simulated)
  const processVoiceInput = useCallback((text: string) => {
    setTranscript(text);
    setHudState('processing');

    // Simulate processing delay
    setTimeout(() => {
      const action = parseVoiceCommand(text);
      
      if (action.type === 'unknown') {
        setHudState('error');
        setError("Try: 'Add TSLA to the watchlist' or 'Trim the current trade'");
        return;
      }

      const cmd = createVoiceCommand(action, text);
      setCommand(cmd);
      setPendingAction(action);
      setHudState('confirming');
    }, 500);
  }, [parseVoiceCommand, createVoiceCommand]);

  // Confirm action
  const confirmAction = useCallback(() => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
    setHudState(null);
    setPendingAction(null);
    setCommand(null);
    setTranscript('');
    setIsListening(false);
  }, [pendingAction, executeAction]);

  // Cancel action
  const cancelAction = useCallback(() => {
    setHudState(null);
    setPendingAction(null);
    setCommand(null);
    setTranscript('');
    setIsListening(false);
  }, []);

  // Retry after error
  const retryAction = useCallback(() => {
    setHudState('listening');
    setError('');
    setTranscript('');
  }, []);

  // Keyboard shortcut (M key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        // Don't trigger if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        
        if (isListening) {
          stopListening();
        } else {
          startListening();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    hudState,
    transcript,
    command,
    error,
    startListening,
    stopListening,
    processVoiceInput,
    confirmAction,
    cancelAction,
    retryAction,
  };
}
