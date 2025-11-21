import { useState } from 'react';
import { Trade, TradeState, AlertChannels } from '../types';
import { HDTagTradeType } from './hd/common/HDTagTradeType';
import { HDButton } from './hd/common/HDButton';
import { HDAlertPreview } from './hd/alerts/HDAlertPreview';
import { HDSparkline } from './hd/charts/HDSparkline';
import { HDMacroPanelMobile } from './hd/common/HDMacroPanelMobile';
import { formatPercent, formatPrice, formatTime, cn } from '../lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MobileNowPlayingProps {
  trade: Trade | null;
  ticker?: string;
  state: TradeState;
  onEnter?: () => void;
  onDiscard?: () => void;
  onAction?: (type: string) => void;
}

export function MobileNowPlaying({
  trade,
  ticker,
  state,
  onEnter,
  onDiscard,
  onAction
}: MobileNowPlayingProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSent, setAlertSent] = useState(false);
  const [sentTime, setSentTime] = useState('');
  
  const handleAction = (type: string) => {
    let message = '';
    
    if (type === 'enter' && trade) {
      message = `Entering ${trade.ticker} ${trade.contract.daysToExpiry}DTE ${trade.contract.strike}${trade.contract.type} (${trade.tradeType}) at mid $${formatPrice(trade.contract.mid)}. TP1/SL based on defaults.`;
    } else if (trade) {
      switch (type) {
        case 'light-trim':
          message = `Light trim on ${trade.ticker} ${trade.contract.strike}${trade.contract.type} here to lock partial profit.`;
          break;
        case 'heavy-trim':
          message = `Heavy trim on ${trade.ticker} ${trade.contract.strike}${trade.contract.type} here; taking most off.`;
          break;
        case 'add':
          message = `Adding to ${trade.ticker} ${trade.contract.strike}${trade.contract.type} position here based on momentum.`;
          break;
        case 'move-sl':
          message = `Moving SL on ${trade.ticker} ${trade.contract.strike}${trade.contract.type} to lock gains.`;
          break;
        case 'exit':
          message = `Exiting ${trade.ticker} ${trade.contract.strike}${trade.contract.type} position here.`;
          break;
      }
    }
    
    setAlertMessage(message);
    setShowAlert(true);
    setAlertSent(false);
  };
  
  const handleSendAlert = (channels: AlertChannels) => {
    console.log('Sending alert:', alertMessage, channels);
    
    if (onEnter && state === 'LOADED') {
      onEnter();
    } else if (onAction) {
      onAction(alertMessage);
    }
    
    setAlertSent(true);
    setSentTime(formatTime(new Date()));
    
    setTimeout(() => {
      setShowAlert(false);
      setAlertSent(false);
    }, 2000);
  };
  
  // Collapsed view
  const CollapsedView = () => {
    if (!trade && !ticker) {
      return (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-4 bg-[var(--surface-1)] border-t border-[var(--border-hairline)]"
        >
          <span className="text-[var(--text-muted)]">No active trade</span>
          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      );
    }
    
    const isPositive = (trade?.movePercent || 0) >= 0;
    
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-4 bg-[var(--surface-1)] border-t border-[var(--border-hairline)]"
      >
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-high)] font-medium">
            {trade?.ticker || ticker}
          </span>
          {trade && (
            <>
              <span className="text-[var(--text-muted)] text-sm">
                {trade.contract.strike}{trade.contract.type}
              </span>
              <HDTagTradeType type={trade.tradeType} />
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {trade?.movePercent !== undefined && (
            <span
              className={cn(
                'tabular-nums',
                isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}
            >
              {formatPercent(trade.movePercent)}
            </span>
          )}
          <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
      </button>
    );
  };
  
  // Expanded view
  if (!expanded) {
    return <CollapsedView />;
  }
  
  return (
    <div className="fixed inset-x-0 bottom-16 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] max-h-[70vh] overflow-y-auto">
      <HDMacroPanelMobile />
      
      {/* Drag Handle */}
      <button
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-center py-3 border-b border-[var(--border-hairline)]"
      >
        <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
      </button>
      
      <div className="p-4 space-y-4">
        {/* Trade Summary */}
        {trade ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[var(--text-high)] text-xl">{trade.ticker}</h2>
                <HDTagTradeType type={trade.tradeType} />
              </div>
              <div className="text-[var(--text-muted)] mb-2">
                {trade.contract.strike}{trade.contract.type} • {trade.contract.expiry} • {trade.contract.daysToExpiry}DTE
              </div>
              
              {/* Sparkline for LOADED trades - quick confidence check */}
              {state === 'LOADED' && (
                <div className="mt-3">
                  <HDSparkline currentPrice={trade.contract.mid} bars={30} />
                </div>
              )}
            </div>
            
            {state === 'ENTERED' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[var(--text-muted)] text-xs mb-1">Entry</div>
                  <div className="text-[var(--text-high)] tabular-nums">
                    ${formatPrice(trade.entryPrice || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-muted)] text-xs mb-1">Current</div>
                  <div className="text-[var(--text-high)] tabular-nums">
                    ${formatPrice(trade.currentPrice || 0)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-[var(--text-muted)]">
              {ticker ? `Watching ${ticker}` : 'Select a ticker'}
            </p>
          </div>
        )}
        
        {/* Alert Preview Sheet */}
        {showAlert && (
          <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
            <HDAlertPreview
              message={alertMessage}
              onSend={handleSendAlert}
              onEdit={() => setShowAlert(false)}
              sent={alertSent}
              sentTime={alertSent ? sentTime : undefined}
            />
          </div>
        )}
        
        {/* Quick Actions */}
        {!showAlert && (
          <div className="space-y-3">
            {state === 'LOADED' && (
              <>
                <HDButton
                  variant="primary"
                  className="w-full h-12"
                  onClick={() => handleAction('enter')}
                >
                  Enter Now
                </HDButton>
                <HDButton
                  variant="ghost"
                  className="w-full h-12"
                  onClick={onDiscard}
                >
                  Discard
                </HDButton>
              </>
            )}
            
            {state === 'ENTERED' && (
              <>
                <HDButton
                  variant="secondary"
                  className="w-full h-12"
                  onClick={() => handleAction('light-trim')}
                >
                  Light Trim
                </HDButton>
                <HDButton
                  variant="secondary"
                  className="w-full h-12"
                  onClick={() => handleAction('heavy-trim')}
                >
                  Heavy Trim
                </HDButton>
                <HDButton
                  variant="secondary"
                  className="w-full h-12"
                  onClick={() => handleAction('add')}
                >
                  Add to Position
                </HDButton>
                <HDButton
                  variant="secondary"
                  className="w-full h-12"
                  onClick={() => handleAction('move-sl')}
                >
                  Move Stop Loss
                </HDButton>
                <HDButton
                  variant="primary"
                  className="w-full h-12"
                  onClick={() => handleAction('exit')}
                >
                  Full Exit
                </HDButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
