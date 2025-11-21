import { useState } from 'react';
import { AppSheet } from '../../ui/AppSheet';
import { Challenge, Trade, DiscordChannel } from '../../types';
import { formatPrice, formatPercent, cn } from '../../lib/utils';
import { Download, Share2, TrendingUp, TrendingDown } from 'lucide-react';
import { HDButton } from '../common/HDButton';
import { formatChallengeDiscordExport } from '../../lib/discordFormatter';
import { useAppToast } from '../../hooks/useAppToast';

interface HDDialogChallengeDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  trades: Trade[];
  channels: DiscordChannel[];
  onTradeClick?: (trade: Trade) => void; // Navigate to trade detail
}

export function HDDialogChallengeDetail({
  open,
  onOpenChange,
  challenge,
  trades,
  channels,
  onTradeClick
}: HDDialogChallengeDetailProps) {
  const toast = useAppToast();
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  
  if (!challenge) return null;
  
  // Filter to only ENTERED or EXITED trades for this challenge
  const challengeTrades = trades.filter(
    t => (t.state === 'ENTERED' || t.state === 'EXITED') && t.challenges.includes(challenge.id)
  );
  
  // Calculate stats
  const stats = calculateChallengeStats(challengeTrades);
  
  const handleExportToDiscord = () => {
    if (selectedChannels.length === 0) {
      toast.error('Please select at least one Discord channel');
      return;
    }
    
    const message = formatChallengeDiscordExport(challenge.name, challengeTrades, stats);
    
    // In a real app, this would send to Discord webhooks
    console.log('Exporting to Discord channels:', selectedChannels);
    console.log(message);
    
    // Try to copy to clipboard, but handle if it fails
    navigator.clipboard.writeText(message)
      .then(() => {
        toast.success(`Challenge summary copied to clipboard! Will send to ${selectedChannels.length} channel(s).`);
        onOpenChange(false); // Close the dialog
      })
      .catch((err) => {
        console.warn('Failed to copy to clipboard:', err);
        toast.success(`Challenge summary ready to send to ${selectedChannels.length} channel(s).`);
        onOpenChange(false); // Close the dialog
      });
  };
  
  const handleDownload = () => {
    const message = formatChallengeDiscordExport(challenge.name, challengeTrades, stats);
    const blob = new Blob([message], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${challenge.name.replace(/\s+/g, '-')}-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Challenge summary downloaded');
  };
  
  return (
    <AppSheet 
      open={open} 
      onOpenChange={onOpenChange}
      title={`🏆 ${challenge.name}`}
      snapPoint="full"
    >
      <div className="p-4 space-y-4">
        {challenge.scope === 'honeydrip-wide' && (
          <div className="text-xs px-2 py-1 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase tracking-wide inline-block">
            HD Wide
          </div>
        )}
        <div className="text-sm text-[var(--text-muted)]">
          View trade performance and statistics for this challenge
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-[var(--text-high)]">{stats.totalTrades}</div>
            </div>
            
            <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-[var(--text-high)]">{stats.winRate.toFixed(1)}%</div>
            </div>
            
            <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">Avg P&L</div>
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                stats.avgPnL >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}>
                {stats.avgPnL >= 0 ? '+' : ''}{stats.avgPnL.toFixed(1)}%
              </div>
            </div>
            
            <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-wide mb-1">Total P&L</div>
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                stats.totalPnL >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
              )}>
                {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(1)}%
              </div>
            </div>
          </div>
          
          {/* Best/Worst Trades */}
          {(stats.bestTrade || stats.worstTrade) && (
            <div className="grid grid-cols-2 gap-4">
              {stats.bestTrade && (
                <div className="p-4 bg-[var(--accent-positive)]/5 rounded-[var(--radius)] border border-[var(--accent-positive)]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-[var(--accent-positive)]" />
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Best Trade</span>
                  </div>
                  <div className="text-[var(--text-high)] font-medium">{stats.bestTrade.ticker}</div>
                  <div className="text-xl font-bold text-[var(--accent-positive)]">
                    +{stats.bestTrade.pnl.toFixed(1)}%
                  </div>
                </div>
              )}
              
              {stats.worstTrade && (
                <div className="p-4 bg-[var(--accent-negative)]/5 rounded-[var(--radius)] border border-[var(--accent-negative)]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-[var(--accent-negative)]" />
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Worst Trade</span>
                  </div>
                  <div className="text-[var(--text-high)] font-medium">{stats.worstTrade.ticker}</div>
                  <div className="text-xl font-bold text-[var(--accent-negative)]">
                    {stats.worstTrade.pnl.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trade Lists - Grouped by status */}
          <div className="space-y-6">
            {/* Active Trades */}
            {(() => {
              const activeTrades = challengeTrades.filter(t => t.state === 'ENTERED');
              if (activeTrades.length === 0) return null;
              
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
                    <h3 className="text-[var(--text-high)] font-medium">
                      Active Trades ({activeTrades.length})
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    {activeTrades.map((trade) => {
                      const pnl = trade.movePercent || 0;
                      const isPositive = pnl >= 0;
                      
                      return (
                        <button
                          key={trade.id}
                          onClick={() => onTradeClick?.(trade)}
                          className="w-full text-left p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border-2 border-[var(--brand-primary)]/30 hover:border-[var(--brand-primary)] transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[var(--text-high)] font-medium">
                                  {trade.ticker} ${trade.contract.strike}{trade.contract.type}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">
                                  {trade.contract.expiry}
                                </span>
                                <span className="px-2 py-0.5 rounded text-micro uppercase tracking-wide bg-[var(--surface-1)] text-[var(--text-muted)]">
                                  {trade.tradeType}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                                {trade.entryPrice && <span>Entry: ${formatPrice(trade.entryPrice)}</span>}
                                {trade.currentPrice && <span>Current: ${formatPrice(trade.currentPrice)}</span>}
                              </div>
                              <div className="text-micro text-[var(--brand-primary)] mt-1">
                                Click to manage in Live view →
                              </div>
                            </div>
                            
                            <div className={cn(
                              'px-4 py-2 rounded-[var(--radius)] font-bold text-lg tabular-nums ml-4',
                              isPositive ? 'bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]' : 'bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]'
                            )}>
                              {isPositive ? '+' : ''}{pnl.toFixed(1)}%
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            
            {/* Exited Trades */}
            {(() => {
              const exitedTrades = challengeTrades.filter(t => t.state === 'EXITED');
              if (exitedTrades.length === 0) return null;
              
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                    <h3 className="text-[var(--text-high)] font-medium">
                      Exited Trades ({exitedTrades.length})
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    {exitedTrades.map((trade) => {
                      const pnl = trade.movePercent || 0;
                      const isPositive = pnl >= 0;
                      
                      return (
                        <button
                          key={trade.id}
                          onClick={() => onTradeClick?.(trade)}
                          className="w-full text-left p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] hover:border-[var(--text-muted)] transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[var(--text-high)] font-medium">
                                  {trade.ticker} ${trade.contract.strike}{trade.contract.type}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">
                                  {trade.contract.expiry}
                                </span>
                                <span className="px-2 py-0.5 rounded text-micro uppercase tracking-wide bg-[var(--surface-1)] text-[var(--text-muted)]">
                                  {trade.tradeType}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                                {trade.entryPrice && <span>Entry: ${formatPrice(trade.entryPrice)}</span>}
                                {trade.exitPrice && <span>Exit: ${formatPrice(trade.exitPrice)}</span>}
                              </div>
                              <div className="text-micro text-[var(--text-muted)] mt-1">
                                Click to view in Review →
                              </div>
                            </div>
                            
                            <div className={cn(
                              'px-4 py-2 rounded-[var(--radius)] font-bold text-lg tabular-nums ml-4',
                              isPositive ? 'bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]' : 'bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]'
                            )}>
                              {isPositive ? '+' : ''}{pnl.toFixed(1)}%
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            
            {/* Empty State */}
            {challengeTrades.length === 0 && (
              <div className="p-8 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-[var(--radius)]">
                No trades entered for this challenge yet
              </div>
            )}
          </div>
          
          {/* Export Section */}
          {challengeTrades.length > 0 && (
            <div className="p-4 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <h3 className="text-[var(--text-high)] font-medium mb-3">Export Challenge Summary</h3>
              
              {/* Channel Selection */}
              <div className="mb-4">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 block">
                  Select Discord Channels
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {channels.map((channel) => (
                    <label
                      key={channel.id}
                      className="flex items-center gap-2 p-2 rounded-[var(--radius)] hover:bg-[var(--surface-1)] transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(channel.id)}
                        onChange={() => {
                          setSelectedChannels(prev =>
                            prev.includes(channel.id)
                              ? prev.filter(id => id !== channel.id)
                              : [...prev, channel.id]
                          );
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[var(--text-high)]">#{channel.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <HDButton
                  variant="primary"
                  onClick={handleExportToDiscord}
                  disabled={selectedChannels.length === 0}
                  className="flex-1"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Export to Discord
                </HDButton>
                
                <HDButton
                  variant="outline"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </HDButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppSheet>
  );
}

function calculateChallengeStats(trades: Trade[]) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnL: 0,
      totalPnL: 0,
      bestTrade: null,
      worstTrade: null
    };
  }
  
  const pnls = trades.map(t => t.movePercent || 0);
  const wins = pnls.filter(p => p > 0).length;
  const totalPnL = pnls.reduce((sum, p) => sum + p, 0);
  const avgPnL = totalPnL / trades.length;
  
  const best = trades.reduce((best, trade) => {
    const pnl = trade.movePercent || 0;
    return pnl > (best?.movePercent || -Infinity) ? trade : best;
  }, trades[0]);
  
  const worst = trades.reduce((worst, trade) => {
    const pnl = trade.movePercent || 0;
    return pnl < (worst?.movePercent || Infinity) ? trade : worst;
  }, trades[0]);
  
  return {
    totalTrades: trades.length,
    winRate: (wins / trades.length) * 100,
    avgPnL,
    totalPnL,
    bestTrade: best ? { ticker: best.ticker, pnl: best.movePercent || 0 } : null,
    worstTrade: worst ? { ticker: worst.ticker, pnl: worst.movePercent || 0 } : null
  };
}
