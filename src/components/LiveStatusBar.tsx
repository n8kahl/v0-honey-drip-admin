/**
 * LiveStatusBar.tsx - Real-time system status indicator
 * 
 * Shows:
 * - WebSocket connection status (green/red dot)
 * - Market status and data delay
 * - Active strategy setups across all symbols
 * - Total symbols being scanned
 */

import { useMemo } from 'react';
import { useMarketDataStore } from '../stores/marketDataStore';
import { cn } from '../lib/utils';

export function LiveStatusBar() {
  // Get WebSocket connection status
  const wsStatus = useMarketDataStore((state) => state.wsConnection.status);
  const wsConnected = wsStatus === 'connected' || wsStatus === 'authenticated';
  
  // Get market status
  const marketStatus = useMarketDataStore((state) => state.marketStatus);
  
  // Get all symbols and calculate active setups
  const symbols = useMarketDataStore((state) => state.symbols);
  
  const stats = useMemo(() => {
    const symbolsList = Object.values(symbols);
    const totalSymbols = symbolsList.length;
    
    // Count all active strategy signals across all symbols
    const activeSetups = symbolsList.reduce((count, symbolData) => {
      const activeSignals = symbolData.strategySignals?.filter(s => s.status === 'ACTIVE') || [];
      return count + activeSignals.length;
    }, 0);
    
    // Calculate average data delay (time since last update)
    const now = Date.now();
    const delays = symbolsList
      .filter(s => s.lastUpdated > 0)
      .map(s => (now - s.lastUpdated) / 1000); // Convert to seconds
    
    const avgDelay = delays.length > 0 
      ? delays.reduce((sum, d) => sum + d, 0) / delays.length 
      : 0;
    
    return {
      totalSymbols,
      activeSetups,
      avgDelay,
    };
  }, [symbols]);
  
  // Format market status text
  const marketStatusText = useMemo(() => {
    switch (marketStatus) {
      case 'premarket':
        return 'Pre-market';
      case 'open':
        return 'Market open';
      case 'afterhours':
        return 'After hours';
      case 'closed':
        return 'Market closed';
      default:
        return 'Unknown';
    }
  }, [marketStatus]);
  
  // Format delay
  const delayText = stats.avgDelay < 1 
    ? `${(stats.avgDelay * 1000).toFixed(0)}ms`
    : `${stats.avgDelay.toFixed(1)}s`;
  
  return (
    <div className="bg-[var(--surface-1)] border-b border-[var(--border-hairline)] px-4 lg:px-6 py-1.5">
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        {/* WebSocket Status */}
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'w-2 h-2 rounded-full transition-colors duration-300',
            wsConnected ? 'bg-[var(--accent-positive)] animate-pulse' : 'bg-[var(--accent-negative)]'
          )} />
          <span className={cn(
            'font-medium',
            wsConnected ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
          )}>
            {wsConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        
        {/* Separator */}
        <div className="w-px h-3 bg-[var(--border-hairline)]" />
        
        {/* Market Status + Delay */}
        <div className="flex items-center gap-1.5">
          <span>{marketStatusText}</span>
          <span className="text-[var(--text-faint)]">•</span>
          <span>Data delay: <span className={cn(
            'font-medium tabular-nums',
            stats.avgDelay < 2 ? 'text-[var(--accent-positive)]' : 
            stats.avgDelay < 5 ? 'text-amber-400' : 
            'text-[var(--accent-negative)]'
          )}>{delayText}</span></span>
        </div>
        
        {/* Separator */}
        <div className="w-px h-3 bg-[var(--border-hairline)]" />
        
        {/* Active Setups */}
        {stats.activeSetups > 0 && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-lg leading-none">🔥</span>
              <span className="font-medium text-[var(--accent-positive)]">
                {stats.activeSetups} active {stats.activeSetups === 1 ? 'setup' : 'setups'}
              </span>
            </div>
            <div className="w-px h-3 bg-[var(--border-hairline)]" />
          </>
        )}
        
        {/* Scanning Symbols */}
        <div className="flex items-center gap-1.5">
          <span>Scanning</span>
          <span className="font-medium text-[var(--text-high)] tabular-nums">
            {stats.totalSymbols}
          </span>
          <span>{stats.totalSymbols === 1 ? 'symbol' : 'symbols'}</span>
        </div>
      </div>
    </div>
  );
}
