import { useState, useEffect } from 'react';
import { Trade, TradeState } from '../types';
import { HDTagTradeType } from './hd/HDTagTradeType';
import { formatPercent, formatPrice, cn } from '../lib/utils';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, X } from 'lucide-react';
import {
  MassiveTrendMetrics,
  MassiveVolatilityMetrics,
  MassiveLiquidityMetrics,
} from '../services/massiveClient';

interface MobileNowPlayingSheetProps {
  trade: Trade | null;
  ticker?: string;
  state: TradeState;
  hideWhenAlert?: boolean;
  confluence?: {
    loading: boolean;
    error?: string;
    trend?: MassiveTrendMetrics;
    volatility?: MassiveVolatilityMetrics;
    liquidity?: MassiveLiquidityMetrics;
  };
  onEnter?: () => void;
  onDiscard?: () => void;
  onAction?: (type: 'trim' | 'update-sl' | 'update' | 'add' | 'exit') => void;
}

export function MobileNowPlayingSheet({
  trade,
  ticker,
  state,
  hideWhenAlert = false,
  confluence,
  onEnter,
  onDiscard,
  onAction
}: MobileNowPlayingSheetProps) {
  console.log('🚨 MobileNowPlayingSheet FUNCTION CALLED - START');
  
  const [expanded, setExpanded] = useState(state === 'LOADED' || state === 'ENTERED');

  console.log('🎭 MobileNowPlayingSheet rendered:', { 
    state, 
    expanded, 
    hasTrade: !!trade, 
    ticker,
    hideWhenAlert,
    onActionExists: !!onAction,
    tradeState: trade?.state
  });

  // Auto-expand when trade or state changes (e.g., clicking a loaded trade from the list)
  // This ensures clicking a trade always opens the modal, even if it's the same trade
  useEffect(() => {
    if (trade && (state === 'LOADED' || state === 'ENTERED')) {
      setExpanded(true);
    }
  }, [trade, state]);

  // Don't show if no trade and no ticker
  if (!trade && !ticker) {
    console.log('🚨 Returning NULL: no trade and no ticker');
    return null;
  }
  
  // Hide when alert composer is showing
  if (hideWhenAlert) {
    console.log('🚨 Returning NULL: hideWhenAlert is true');
    return null;
  }
  
  console.log('🚨 MobileNowPlayingSheet WILL RENDER UI');

  const isPositive = (trade?.movePercent || 0) >= 0;
  const borderColor = state === 'ENTERED' 
    ? isPositive ? 'border-[var(--accent-positive)]' : 'border-[var(--accent-negative)]'
    : state === 'LOADED' ? 'border-blue-500/30' : 'border-[var(--border-hairline)]';

  // COLLAPSED VIEW
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          'fixed bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t p-4 flex items-center justify-between z-10 pointer-events-auto',
          borderColor
        )}
      >
        <div className="flex-1 min-w-0">
          {state === 'WATCHING' && ticker ? (
            <>
              <div className="text-[var(--text-high)] font-medium mb-1">
                Watching {ticker}
              </div>
              <div className="text-[var(--text-muted)] text-xs">
                Tap to select a contract
              </div>
            </>
          ) : trade ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[var(--text-high)] font-medium truncate">
                  {trade.ticker} {trade.contract.strike}{trade.contract.type}
                </span>
                {state === 'LOADED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide bg-blue-500/20 text-blue-400 flex-shrink-0">
                    Loaded
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <HDTagTradeType type={trade.tradeType} />
                {state === 'LOADED' && (
                  <span className="text-[var(--text-muted)]">Not entered yet</span>
                )}
                {state === 'ENTERED' && trade.movePercent !== undefined && (
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-positive)]" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-[var(--accent-negative)]" />
                    )}
                    <span className={cn(
                      'font-medium tabular-nums',
                      isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                    )}>
                      {formatPercent(trade.movePercent)}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
        <ChevronUp className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 ml-3" />
      </button>
    );
  }

  // EXPANDED VIEW
  return (
    <div className={cn(
      'fixed bottom-16 left-0 right-0 bg-[var(--surface-1)] border-t max-h-[75vh] flex flex-col z-10 pointer-events-auto',
      state === 'ENTERED' && isPositive && 'border-t-2 border-[var(--accent-positive)]',
      state === 'ENTERED' && !isPositive && 'border-t-2 border-[var(--accent-negative)]',
      state === 'LOADED' && 'border-t border-[var(--border-hairline)]',
      state === 'WATCHING' && 'border-t border-[var(--border-hairline)]'
    )}>
      {/* Drag Handle & Close Button */}
      <div className="relative flex items-center justify-center py-2">
        <div 
          className="w-10 h-1 rounded-full bg-[var(--border-hairline)] cursor-pointer" 
          onClick={() => setExpanded(false)}
        />
        <button
          onClick={() => setExpanded(false)}
          className="absolute right-3 top-2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-3)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {state === 'WATCHING' && ticker ? (
          // WATCHING STATE
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--text-high)] text-lg font-medium">{ticker}</h3>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  Watching
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-[var(--text-muted)] mt-8">
              Browse contracts to load a trade idea
            </p>
          </div>
        ) : state === 'LOADED' && trade ? (
          // LOADED STATE
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--text-high)] text-lg font-medium">
                  {trade.ticker} {trade.contract.daysToExpiry}DTE {trade.contract.strike}{trade.contract.type}
                </h3>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400">
                  📋 Loaded
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HDTagTradeType type={trade.tradeType} />
                <span className="text-xs text-[var(--text-muted)]">
                  Loaded at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Contract</div>
                <div className="text-[var(--text-high)]">
                  ${trade.contract.strike} {trade.contract.type === 'C' ? 'Call' : 'Put'} • {trade.contract.daysToExpiry}DTE ({trade.contract.expiry})
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Current Mid</div>
                <div className="text-[var(--text-high)] font-medium">${formatPrice(trade.contract.mid)}</div>
              </div>

              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Status</div>
                <div className="text-[var(--text-high)] text-sm">Not entered yet</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Entry, TP, SL will be set when entering
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={onEnter}
                className="w-full py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-[var(--bg-base)] rounded-lg font-medium transition-colors text-center flex items-center justify-center"
              >
                Enter Now
              </button>
              <button 
                onClick={onDiscard}
                className="w-full py-3 bg-transparent border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-high)] rounded-lg transition-colors text-center flex items-center justify-center"
              >
                Discard Idea
              </button>
            </div>
          </div>
        ) : state === 'ENTERED' && trade ? (
          // ENTERED STATE
          <div>
            {/* Header with P&L */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[var(--text-high)] text-lg font-medium mb-1">
                    {trade.ticker} {trade.contract.daysToExpiry}DTE {trade.contract.strike}{trade.contract.type}
                  </h3>
                  <div className="flex items-center gap-2">
                    <HDTagTradeType type={trade.tradeType} />
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]">
                      ✓ Entered
                    </span>
                  </div>
                </div>
                {trade.movePercent !== undefined && (
                  <div className="text-right">
                    <div className={cn(
                      'text-xl font-medium flex items-center gap-1',
                      isPositive ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
                    )}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {formatPercent(trade.movePercent)}
                    </div>
                    {trade.movePrice !== undefined && (
                      <div className="text-xs text-[var(--text-muted)]">
                        {isPositive ? '+' : ''}${formatPrice(trade.movePrice)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Confluence Panel (if available) */}
            {confluence && !confluence.loading && !confluence.error && (
              <div className="mb-4 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-hairline)]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  Confluence
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {confluence.trend && (
                    <div className="text-center">
                      <div className={cn(
                        'text-xs font-medium mb-0.5',
                        confluence.trend.signal === 'bullish' ? 'text-[var(--accent-positive)]' : 
                        confluence.trend.signal === 'bearish' ? 'text-[var(--accent-negative)]' : 
                        'text-[var(--text-muted)]'
                      )}>
                        {confluence.trend.signal === 'bullish' ? '↑' : confluence.trend.signal === 'bearish' ? '↓' : '→'}
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)]">Trend</div>
                    </div>
                  )}
                  {confluence.volatility && (
                    <div className="text-center">
                      <div className={cn(
                        'text-xs font-medium mb-0.5',
                        confluence.volatility.level === 'high' ? 'text-[var(--accent-negative)]' :
                        confluence.volatility.level === 'medium' ? 'text-[var(--brand-primary)]' :
                        'text-[var(--accent-positive)]'
                      )}>
                        {confluence.volatility.level === 'high' ? 'H' : confluence.volatility.level === 'medium' ? 'M' : 'L'}
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)]">Vol</div>
                    </div>
                  )}
                  {confluence.liquidity && (
                    <div className="text-center">
                      <div className={cn(
                        'text-xs font-medium mb-0.5',
                        confluence.liquidity.level === 'high' ? 'text-[var(--accent-positive)]' :
                        confluence.liquidity.level === 'medium' ? 'text-[var(--brand-primary)]' :
                        'text-[var(--accent-negative)]'
                      )}>
                        {confluence.liquidity.level === 'high' ? 'H' : confluence.liquidity.level === 'medium' ? 'M' : 'L'}
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)]">Liq</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Entry</div>
                <div className="text-[var(--text-high)] font-medium">${formatPrice(trade.entryPrice || 0)}</div>
              </div>
              <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Current</div>
                <div className="text-[var(--text-high)] font-medium">${formatPrice(trade.currentPrice || 0)}</div>
              </div>
              {trade.targetPrice && (
                <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Target</div>
                  <div className="text-[var(--accent-positive)] font-medium">${formatPrice(trade.targetPrice)}</div>
                  {trade.entryPrice && (
                    <div className="text-[9px] text-[var(--text-muted)]">
                      +{(((trade.targetPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}
              {trade.stopLoss && (
                <div className="p-3 bg-[var(--surface-2)] rounded-lg">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Stop</div>
                  <div className="text-[var(--accent-negative)] font-medium">${formatPrice(trade.stopLoss)}</div>
                  {trade.entryPrice && (
                    <div className="text-[9px] text-[var(--text-muted)]">
                      {(((trade.stopLoss - trade.entryPrice) / trade.entryPrice) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Position Management Actions */}
            <div className="space-y-2">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                Position Management
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onMouseDown={() => console.log('🖱️ TRIM mouseDown')}
                  onTouchStart={() => console.log('👆 TRIM touchStart')}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔥 TRIM button clicked, onAction exists?', !!onAction);
                    console.log('🔥 onAction type:', typeof onAction);
                    onAction?.('trim');
                    console.log('✅ onAction("trim") called');
                  }}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border-2 border-[var(--brand-primary)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">📊</div>
                  <div className="text-xs text-[var(--text-high)]">Trim</div>
                </button>
                
                <button
                  onMouseDown={() => console.log('🖱️ UPDATE SL mouseDown')}
                  onTouchStart={() => console.log('👆 UPDATE SL touchStart')}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔥 UPDATE SL button clicked, onAction exists?', !!onAction);
                    onAction?.('update-sl');
                    console.log('✅ onAction("update-sl") called');
                  }}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border-2 border-[var(--brand-primary)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">🛡️</div>
                  <div className="text-xs text-[var(--text-high)]">Update SL</div>
                </button>

                <button
                  onMouseDown={() => console.log('🖱️ UPDATE mouseDown')}
                  onTouchStart={() => console.log('👆 UPDATE touchStart')}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔥 UPDATE button clicked, onAction exists?', !!onAction);
                    onAction?.('update');
                    console.log('✅ onAction("update") called');
                  }}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border-2 border-[var(--brand-primary)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">◈◈◈</div>
                  <div className="text-xs text-[var(--text-high)]">Update</div>
                </button>

                <button
                  onMouseDown={() => console.log('🖱️ ADD mouseDown')}
                  onTouchStart={() => console.log('👆 ADD touchStart')}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔥 ADD button clicked, onAction exists?', !!onAction);
                    onAction?.('add');
                    console.log('✅ onAction("add") called');
                  }}
                  className="p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 border-2 border-[var(--brand-primary)] rounded-lg transition-colors flex flex-col items-center justify-center"
                >
                  <div className="text-lg mb-1">➕</div>
                  <div className="text-xs text-[var(--text-high)]">Add</div>
                </button>
              </div>

              <button
                onMouseDown={() => console.log('🖱️ EXIT mouseDown')}
                onTouchStart={() => console.log('👆 EXIT touchStart')}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('🔥 EXIT button clicked, onAction exists?', !!onAction);
                  onAction?.('exit');
                  console.log('✅ onAction("exit") called');
                }}
                className="w-full p-3 bg-[var(--accent-negative)]/10 hover:bg-[var(--accent-negative)]/20 border border-[var(--accent-negative)]/30 rounded-lg transition-colors text-[var(--accent-negative)] font-medium text-center"
              >
                Full Exit
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
